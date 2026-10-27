FROM node:22-alpine AS web

WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY web ./web
COPY scripts ./scripts
COPY testdata ./testdata

RUN npm run build && npm test

FROM golang:1.23-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=web /src/internal/assets/static ./internal/assets/static

ARG GIT_SHA=dev

RUN CGO_ENABLED=0 go test ./... \
    && CGO_ENABLED=0 go build \
        -ldflags "-s -w -X boerenbridge-scorenboord/internal/version.Commit=${GIT_SHA}" \
        -o /boerenbridge ./cmd/server

FROM alpine:3.20

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=build /boerenbridge /boerenbridge

EXPOSE 8080

ENV DB_PATH=/data/snapshots.sqlite
VOLUME ["/data"]

CMD ["/boerenbridge"]
