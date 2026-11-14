# Plans

Proposal set for the Academic Integrity Workflow, designed from [../requirements.md](../requirements.md) and critically reviewed.
Earlier architecture notes, decisions and draft code are superseded where these plans differ (list in 04-review).

| Read in this order | What |
|---|---|
| [00-hld.md](00-hld.md) | System design, score/triage rule, lifecycle, negative scenarios, decisions, build order, risks |
| [01-database-plan.md](01-database-plan.md) | Entities, constraints, immutability, privileges, views, load path |
| [02-backend-plan.md](02-backend-plan.md) | Layout, API, rules, datagen, validator, auditor, eval, tests |
| [03-frontend-plan.md](03-frontend-plan.md) | Screens, stack, behaviours, tests |
| [04-review.md](04-review.md) | Critical review: findings, coverage A1-L1, changes made, open questions |

Key conventions shared by all plans: scores are fractions 0-1 (thresholds 0.30/0.60/0.80); a flag is a report with
`raw >= review threshold` (view, not table); validator must pass, auditor finds the labelled anomalies.
Each plan ends with "Not doing" and "Open questions".
