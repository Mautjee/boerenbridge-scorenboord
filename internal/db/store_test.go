package db

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestSchemaVersionMatchesPinnedFile(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "testdata", "schema-version.txt"))
	if err != nil {
		t.Fatalf("lees testdata/schema-version.txt: %v", err)
	}
	expected, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		t.Fatalf("parse testdata/schema-version.txt: %v", err)
	}
	if SchemaVersion != expected {
		t.Fatalf("SchemaVersion = %d, pinned file says %d", SchemaVersion, expected)
	}
}

func TestStoreStartsEmptyAndVersioned(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "snapshots.sqlite"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer store.Close()

	count, err := store.Count(context.Background())
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if count != 0 {
		t.Fatalf("Count = %d, want 0", count)
	}
}

func TestPublishGetAndRevisionRules(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "snapshots.sqlite"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer store.Close()

	ctx := context.Background()
	id := "6f9619ff-8b86-4d01-b42d-00cf4fc964ff"
	body := []byte(`{"schemaVersion":2,"id":"` + id + `"}`)

	outcome, err := store.Publish(ctx, id, 1, body)
	if err != nil || outcome != Created {
		t.Fatalf("first Publish = %v, %v; want Created, nil", outcome, err)
	}

	got, err := store.Get(ctx, id)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if string(got.Body) != string(body) || got.Revision != 1 || got.SchemaVersion != SchemaVersion {
		t.Fatalf("Get = %+v", got)
	}

	if _, err := store.Publish(ctx, id, 1, body); !errors.Is(err, ErrConflict) {
		t.Fatalf("same revision err = %v, want ErrConflict", err)
	}
	if _, err := store.Publish(ctx, id, 0, body); !errors.Is(err, ErrConflict) {
		t.Fatalf("older revision err = %v, want ErrConflict", err)
	}

	outcome, err = store.Publish(ctx, id, 2, []byte(`{"schemaVersion":2,"revision":2}`))
	if err != nil || outcome != Updated {
		t.Fatalf("newer Publish = %v, %v; want Updated, nil", outcome, err)
	}
	got, err = store.Get(ctx, id)
	if err != nil || got.Revision != 2 {
		t.Fatalf("Get after update = %+v, %v", got, err)
	}

	if _, err := store.Get(ctx, "missing"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing Get err = %v, want ErrNotFound", err)
	}
}

func TestOpenRefusesAnotherSchemaVersion(t *testing.T) {
	path := filepath.Join(t.TempDir(), "snapshots.sqlite")
	store, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	store.Close()

	database, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	if _, err := database.Exec("UPDATE meta SET value = '1' WHERE key = 'schema_version'"); err != nil {
		database.Close()
		t.Fatalf("UPDATE meta: %v", err)
	}
	database.Close()

	_, err = Open(path)
	if err == nil || !strings.Contains(err.Error(), "wordt niet ondersteund") {
		t.Fatalf("Open after version change = %v, want a refusal", err)
	}
}
