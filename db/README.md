## DB Files

Canonical database files in this repo live under `db/`.

- `db/schema.sql`
  Current full schema snapshot. Use this as the reference for the latest database shape.
- `db/migrations/*.sql`
  Incremental migrations for upgrading an existing database.

## Migration Source Of Truth

Use `db/migrations/` as the only migration source of truth for this project.

`supabase/migrations/` is not canonical in this repo and should not receive new migrations unless the project is explicitly migrated to a Supabase CLI-managed workflow.

## Naming Convention

Use `YYYYMMDDHHMMSS_description.sql` for every migration.

- If the exact historical time is unknown for an older migration, normalize it to midnight with `000000`.
- Keep filenames sortable so apply order is obvious from `ls`.

## Current Order

Apply these in filename order when bringing an existing database forward:

1. `db/migrations/20260227000000_incremental_only.sql`
2. `db/migrations/20260303000000_records_indexes_and_annotation_anchor.sql`
3. `db/migrations/20260304000000_review_log_decision_metadata.sql`
4. `db/migrations/20260305000000_user_preferences_and_tag_ci.sql`
5. `db/migrations/20260306124142_atomic_record_write_functions.sql`
6. `db/migrations/20260306173000_import_sources_and_provenance.sql`

## Notes

- Do not re-run `db/schema.sql` against an existing database.
- New schema changes should update both `db/migrations/` and `db/schema.sql`.
