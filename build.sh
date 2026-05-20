#!/bin/bash
set -e

echo "Building Boerenbridge Scorebord..."

# Build the binary
echo "Compiling Go binary..."
export CGO_ENABLED=0
export GOPATH=~/go
export PATH=~/go-sdk/go/bin:$PATH
cd "$(dirname "$0")"
go build -o boerenbridge ./cmd/server

echo ""
echo "Build successful!"
echo ""
echo "To run locally:"
echo "  DB_PATH=./data/db.sqlite ./boerenbridge"
echo ""
echo "To build Docker image:"
echo "  docker build -t boerenbridge ."
echo "  docker run -p 8080:8080 -v boerenbridge_data:/data boerenbridge"