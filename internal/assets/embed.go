package assets

import "embed"

// Files holds the generated client build. The static directory is produced by
// `npm run build` and committed so `go build` needs no Node toolchain.
//
//go:embed all:static
var Files embed.FS
