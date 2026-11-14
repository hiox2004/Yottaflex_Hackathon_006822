# Generated data

Output of the seeded generator (seed `20261022`). Never edit by hand; regenerate instead
([decision 0009](../docs/decisions/0009-generated-data-and-loading.md)).

```
data/
  starter/          small slice from the same generator (committed)
  full/             10,000 submissions / 1,000 flags / 300 cases (bulk files not committed;
                    manifest.json with SHA-256 checksums and VALIDATION.md are)
  ground_truth/     labels for injected anomalies, kept apart from operational data on purpose
    starter/  full/
```

Each scale folder holds `*.csv`, `*.json`, `seed.sql` and a manifest. Load one into PostgreSQL with
`python -m integrity.dbload --scale starter` (see [database/README.md](../database/README.md)).

Application code, the validator and the auditor must never read `ground_truth/` (enforced by a unit test).
