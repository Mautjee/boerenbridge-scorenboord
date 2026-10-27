package version

// Version is the application version shown by /healthz and the app footer.
const Version = "2.0.0"

// Commit is replaced at build time:
//
//	go build -ldflags "-X boerenbridge-scorenboord/internal/version.Commit=<sha>"
var Commit = "dev"
