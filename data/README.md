# Generated data

Output of the seeded generator (seed `20261022`). Never edit by hand; regenerate instead.

```
data/
  starter/          small slice, same generator
  full/             10,000 submissions / 1,000 flags / 300 cases: CSV, JSON, SQL, manifest, validation summary
  ground_truth/     labels for injected anomalies, kept apart from operational data on purpose
    starter/  full/
```

Application code, the validator and the auditor must never read `ground_truth/` (enforced by a unit test).
