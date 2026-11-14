# Validation summary

Result: **PASS**

## Row counts

| table | rows |
|---|---|
| reviewer | 64 |
| learner | 200 |
| assessment | 15 |
| integrity_rule | 2 |
| submission | 1000 |
| similarity_report | 1000 |
| integrity_case | 30 |
| case_reviewer | 27 |
| evidence_item | 65 |
| decision | 15 |
| decision_evidence | 31 |
| appeal | 5 |
| case_event | 156 |
| flags | 100 |

## Checks

| check | violations | rule |
|---|---|---|
| report_per_submission | 0 | every submission has exactly one similarity report (1:1) |
| rule_in_force | 0 | the report's rule was in force when the submission was made |
| rules_do_not_overlap | 0 | rule versions have disjoint effective periods |
| triage_reconciliation | 0 | a case exists exactly for flags whose adjusted band is review or priority_review |
| assessment_instructor_role | 0 | an assessment's instructor has the instructor role |
| id_sequences | 0 | evidence (001..), decision (01..) and appeal (-01) suffixes are contiguous per case |
| date_order | 0 | submitted <= generated <= opened <= decided <= filed <= appeal decided <= closed |
| case_opened_event | 0 | each case has exactly one case_opened event at its opened_at |
| transition_pairs | 0 | every event's (type, from, to) is a legal lifecycle transition |
| transition_chain | 0 | each status-changing event starts from the status the previous one reached |
| event_references | 0 | event ref_id points at the reviewer, evidence, decision or appeal the event is about |
| status_matches_rows | 0 | the derived status is backed by rows (reviewers, decision, appeal, appeal outcome) |
| cited_evidence_same_case | 0 | a decision cites only evidence of its own case, added no later than the decision |
| appeal_decision_same_case | 0 | an appeal targets a decision of its own case |
| duplicate_evidence | 0 | no case holds the same evidence (kind and description) twice |

## raw score by tenth

| value | count |
|---|---|
| 0.0 | 432 |
| 0.1 | 303 |
| 0.2 | 117 |
| 0.3 | 34 |
| 0.4 | 8 |
| 0.5 | 6 |
| 0.6 | 30 |
| 0.7 | 32 |
| 0.8 | 26 |
| 0.9 | 12 |

## adjusted score by tenth

| value | count |
|---|---|
| 0.0 | 513 |
| 0.1 | 282 |
| 0.2 | 101 |
| 0.3 | 31 |
| 0.4 | 22 |
| 0.5 | 21 |
| 0.6 | 11 |
| 0.7 | 8 |
| 0.8 | 6 |
| 0.9 | 5 |

## flags by band

| value | count |
|---|---|
| log_only | 47 |
| no_action | 23 |
| priority_review | 8 |
| review | 22 |

## flag outcomes

| value | count |
|---|---|
| case_opened | 30 |
| dismissed (quote_only) | 38 |
| dismissed (template_match) | 32 |

## cases by status

| value | count |
|---|---|
| appeal_decided | 1 |
| appealed | 1 |
| appeal_review | 1 |
| closed | 7 |
| decided | 4 |
| open | 7 |
| under_review | 9 |

## cases by band

| value | count |
|---|---|
| priority_review | 8 |
| review | 22 |

## decisions by outcome

| value | count |
|---|---|
| no_violation | 2 |
| violation_confirmed | 13 |

## appeals by outcome

| value | count |
|---|---|
| overturned | 1 |
| pending | 2 |
| upheld | 2 |

## effective outcomes

| value | count |
|---|---|
| no_violation | 3 |
| undecided | 15 |
| violation_confirmed | 12 |

## reviewers per case

| value | count |
|---|---|
| 0 | 7 |
| 1 | 19 |
| 2 | 4 |

## evidence per case

| value | count |
|---|---|
| 1 | 1 |
| 2 | 23 |
| 3 | 6 |

## staff by role

| value | count |
|---|---|
| academic_administrator | 6 |
| academic_reviewer | 24 |
| instructor | 24 |
| support_staff | 10 |

## reports by rule

| value | count |
|---|---|
| INT-2026-000001 | 856 |
| INT-2026-000002 | 144 |

## boundary adjusted scores

| value | count |
|---|---|
| 0.299 | 2 |
| 0.300 | 1 |
| 0.599 | 3 |
| 0.600 | 4 |
| 0.799 | 2 |
| 0.800 | 1 |

Limits: the validator proves the data is well formed (keys, joins, dates, reconciliation, lifecycle). It does not prove due process was followed; the auditor reports that.
