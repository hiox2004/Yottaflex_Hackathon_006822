# Database

PostgreSQL 16, run by `../docker-compose.yml` (host port 5433). Database files live in a Docker volume and are never committed.

- `schema.sql`: tables, keys, allowed values, derived columns and views, append-only event tables.
- Field-by-field reference: [../docs/DATA_DICTIONARY.md](../docs/DATA_DICTIONARY.md).
- Structural rules live here; business rules live in the backend ([decision 0004](../docs/decisions/0004-where-rules-are-enforced.md)).

Create or reset the database (from the repo root, with the container running):
```bash
python -m integrity.dbload                  # empty schema
python -m integrity.dbload --scale starter  # schema + data/starter/seed.sql
```
This wipes the `public` schema first. See [decision 0009](../docs/decisions/0009-generated-data-and-loading.md).
