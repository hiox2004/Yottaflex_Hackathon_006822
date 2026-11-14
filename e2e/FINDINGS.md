# Lifecycle E2E findings (partial run)

## Status
- JOURNEY A 'cleared': PASSES end to end (assign with ineligible reasons shown; stale-tab assign refused with plain message; support staff has no decide action, reason shown; evidence; Clear decision; Cleared badge; Decided stage; close blocked by appeal window with plain reason).
- JOURNEY B 'failed + appeal': PASSES up to appeal reviewer assignment (original reviewer shown disabled with reason). BLOCKED at reassignment.

## Finding 1: reassign appeal reviewer refused in appeal_review (backend vs working copy)
- Case: CAS-2026-000258 (status appeal_review, appeal reviewer REV-000020).
- Expected: admin sees 'Reassign appeal reviewer' (labels.ts / NextStep copy promise it); lifecycle.py working copy has (APPEAL_REVIEW, ASSIGN_APPEAL_REVIEWER) -> APPEAL_REVIEW.
- Actual: action_checks reports assign_appeal_reviewer blocked: "An appeal reviewer can only be assigned once an appeal is filed." Button not offered.
- Unverified: whether the running backend container predates the uncommitted lifecycle.py change (container inspection not completed).

## Other observations
- ErrorBanner shows the raw reason code in parentheses after the plain message, e.g. "(ALREADY_ON_CASE)". Plain text is present; code display may conflict with "plain language, not a raw code".
- Stale-tab screenshot: e2e/results/screens/lifecycle-A-stale-assign-refusal.png

## Not done
- Journey B reassignment, appeal decision, close.
- Reseed (not run, per coordinator).
