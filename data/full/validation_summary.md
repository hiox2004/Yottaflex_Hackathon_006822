# Validation summary

Result: **PASS**

## Row counts

| table | rows |
|---|---|
| reviewer | 64 |
| learner | 2000 |
| assessment | 151 |
| integrity_rule | 2 |
| submission | 10000 |
| similarity_report | 10000 |
| integrity_case | 300 |
| case_reviewer | 294 |
| evidence_item | 676 |
| decision | 147 |
| decision_evidence | 317 |
| appeal | 45 |
| case_event | 1594 |
| flags | 1000 |

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
| 0.0 | 4301 |
| 0.1 | 2975 |
| 0.2 | 1284 |
| 0.3 | 350 |
| 0.4 | 66 |
| 0.5 | 24 |
| 0.6 | 306 |
| 0.7 | 292 |
| 0.8 | 265 |
| 0.9 | 136 |
| 1.0 | 1 |

## adjusted score by tenth

| value | count |
|---|---|
| 0.0 | 4981 |
| 0.1 | 3001 |
| 0.2 | 1058 |
| 0.3 | 290 |
| 0.4 | 185 |
| 0.5 | 185 |
| 0.6 | 126 |
| 0.7 | 95 |
| 0.8 | 55 |
| 0.9 | 24 |

## flags by band

| value | count |
|---|---|
| log_only | 450 |
| no_action | 250 |
| priority_review | 66 |
| review | 234 |

## flag outcomes

| value | count |
|---|---|
| case_opened | 300 |
| dismissed (quote_only) | 375 |
| dismissed (template_match) | 325 |

## cases by status

| value | count |
|---|---|
| appeal_decided | 9 |
| appealed | 9 |
| appeal_review | 9 |
| closed | 69 |
| decided | 43 |
| open | 69 |
| under_review | 92 |

## cases by band

| value | count |
|---|---|
| priority_review | 66 |
| review | 234 |

## decisions by outcome

| value | count |
|---|---|
| inconclusive | 10 |
| no_violation | 26 |
| violation_confirmed | 111 |

## appeals by outcome

| value | count |
|---|---|
| overturned | 4 |
| partially_upheld | 6 |
| pending | 18 |
| upheld | 17 |

## effective outcomes

| value | count |
|---|---|
| inconclusive | 16 |
| no_violation | 30 |
| undecided | 153 |
| violation_confirmed | 101 |

## reviewers per case

| value | count |
|---|---|
| 0 | 69 |
| 1 | 168 |
| 2 | 63 |

## evidence per case

| value | count |
|---|---|
| 1 | 19 |
| 2 | 188 |
| 3 | 91 |
| 4 | 2 |

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
| INT-2026-000001 | 5588 |
| INT-2026-000002 | 4412 |

## boundary adjusted scores

| value | count |
|---|---|
| 0.299 | 5 |
| 0.300 | 4 |
| 0.599 | 5 |
| 0.600 | 4 |
| 0.799 | 2 |
| 0.800 | 3 |

Limits: the validator proves the data is well formed (keys, joins, dates, reconciliation, lifecycle). It does not prove due process was followed; the auditor reports that.
