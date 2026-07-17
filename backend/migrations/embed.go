// Package migrations embeds the SQL migration files so the API binary can
// bring the schema up to date at startup without the migrate CLI.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
