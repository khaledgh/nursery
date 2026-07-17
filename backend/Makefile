# Sunny Stars API — common tasks.
# Migrations use golang-migrate: https://github.com/golang-migrate/migrate
# install: go install -tags 'mysql' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

include .env
export

DB_URL := mysql://$(DB_USER):$(DB_PASSWORD)@tcp($(DB_HOST):$(DB_PORT))/$(DB_NAME)

.PHONY: run build seed test lint migrate-up migrate-down migrate-new

run:
	go run ./cmd/api

build:
	go build -trimpath -ldflags "-s -w" -o bin/api ./cmd/api
	go build -trimpath -ldflags "-s -w" -o bin/seed ./cmd/seed

seed:
	go run ./cmd/seed

test:
	go test ./... -count=1

lint:
	go vet ./...

migrate-up:
	migrate -path migrations -database "$(DB_URL)" up

migrate-down:
	migrate -path migrations -database "$(DB_URL)" down 1

# usage: make migrate-new name=add_events
migrate-new:
	migrate create -ext sql -dir migrations -seq $(name)
