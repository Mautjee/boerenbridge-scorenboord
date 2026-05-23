FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /boerenbridge ./cmd/server

FROM alpine:3.20

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /boerenbridge /boerenbridge
COPY --from=builder /app/templates/ /app/templates/

EXPOSE 8080

ENV DB_PATH=/data/db.sqlite
VOLUME ["/data"]

CMD ["/boerenbridge"]