package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	_ "modernc.org/sqlite"
)

// SchemaVersion is the only snapshot schema this release reads or writes.
// It is pinned to testdata/schema-version.txt by store_test.go.
const SchemaVersion = 2

var (
	// ErrNotFound means the requested snapshot does not exist.
	ErrNotFound = errors.New("snapshot niet gevonden")
	// ErrConflict means a stored snapshot already has the same or a newer revision.
	ErrConflict = errors.New("snapshot heeft al een gelijke of nieuwere revisie")
)

// Outcome describes what Publish did.
type Outcome int

const (
	Created Outcome = iota
	Updated
)

// Snapshot is one stored game body plus its indexing columns.
type Snapshot struct {
	ID            string
	SchemaVersion int
	Revision      int
	PublishedAt   string
	UpdatedAt     string
	Body          []byte
}

// Store is the server-side snapshot store. It starts empty, carries an explicit
// schema version, and refuses a store written by another version.
type Store struct {
	db *sql.DB
}

// Open creates or opens the snapshot store at path.
func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("maak databasemap: %w", err)
	}

	database, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	database.SetMaxOpenConns(1)
	database.SetMaxIdleConns(1)

	if _, err := database.Exec("PRAGMA journal_mode=WAL"); err != nil {
		database.Close()
		return nil, fmt.Errorf("zet WAL-modus: %w", err)
	}
	if _, err := database.Exec("PRAGMA busy_timeout=5000"); err != nil {
		database.Close()
		return nil, fmt.Errorf("zet busy_timeout: %w", err)
	}
	if _, err := database.Exec(`
		CREATE TABLE IF NOT EXISTS meta (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS snapshots (
			id             TEXT PRIMARY KEY,
			schema_version INTEGER NOT NULL,
			revision       INTEGER NOT NULL,
			published_at   TEXT NOT NULL,
			updated_at     TEXT NOT NULL,
			body           BLOB NOT NULL
		);
	`); err != nil {
		database.Close()
		return nil, fmt.Errorf("maak tabellen: %w", err)
	}

	if err := ensureVersion(database); err != nil {
		database.Close()
		return nil, err
	}

	return &Store{db: database}, nil
}

func ensureVersion(database *sql.DB) error {
	var value string
	err := database.QueryRow("SELECT value FROM meta WHERE key = 'schema_version'").Scan(&value)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		_, err = database.Exec(
			"INSERT INTO meta (key, value) VALUES ('schema_version', ?)",
			strconv.Itoa(SchemaVersion),
		)
		if err != nil {
			return fmt.Errorf("schrijf schema_version: %w", err)
		}
		return nil
	case err != nil:
		return fmt.Errorf("lees schema_version: %w", err)
	}

	version, err := strconv.Atoi(value)
	if err != nil {
		return fmt.Errorf("ongeldige schema_version %q in de opslag", value)
	}
	if version != SchemaVersion {
		return fmt.Errorf(
			"de opgeslagen schema_version %d wordt niet ondersteund (deze versie verwacht %d). Maak een back-up en reset de opslag",
			version, SchemaVersion,
		)
	}
	return nil
}

// Publish stores a snapshot. It returns Created for a new id, Updated when the
// incoming revision is newer, and ErrConflict otherwise.
func (s *Store) Publish(ctx context.Context, id string, revision int, body []byte) (Outcome, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Created, err
	}
	defer tx.Rollback()

	var storedRevision int
	err = tx.QueryRowContext(ctx, "SELECT revision FROM snapshots WHERE id = ?", id).Scan(&storedRevision)
	now := time.Now().UTC().Format(time.RFC3339)

	switch {
	case errors.Is(err, sql.ErrNoRows):
		_, err = tx.ExecContext(ctx,
			`INSERT INTO snapshots (id, schema_version, revision, published_at, updated_at, body)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			id, SchemaVersion, revision, now, now, body,
		)
		if err != nil {
			return Created, err
		}
		if err := tx.Commit(); err != nil {
			return Created, err
		}
		return Created, nil
	case err != nil:
		return Created, err
	}

	if revision <= storedRevision {
		return Created, ErrConflict
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE snapshots
		 SET schema_version = ?, revision = ?, updated_at = ?, body = ?
		 WHERE id = ?`,
		SchemaVersion, revision, now, body, id,
	)
	if err != nil {
		return Created, err
	}
	if err := tx.Commit(); err != nil {
		return Created, err
	}
	return Updated, nil
}

// Get returns a stored snapshot.
func (s *Store) Get(ctx context.Context, id string) (*Snapshot, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, schema_version, revision, published_at, updated_at, body
		 FROM snapshots WHERE id = ?`, id)
	var snapshot Snapshot
	if err := row.Scan(
		&snapshot.ID,
		&snapshot.SchemaVersion,
		&snapshot.Revision,
		&snapshot.PublishedAt,
		&snapshot.UpdatedAt,
		&snapshot.Body,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &snapshot, nil
}

// Count returns the number of stored snapshots.
func (s *Store) Count(ctx context.Context) (int, error) {
	var count int
	if err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM snapshots").Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

// Close closes the underlying database.
func (s *Store) Close() error {
	return s.db.Close()
}
