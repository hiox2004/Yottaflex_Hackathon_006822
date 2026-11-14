"""Refusal wording for the case lifecycle. Text only: `lifecycle` decides which message applies."""

from integrity.models import Action

LABELS: dict[Action, str] = {
    Action.ASSIGN_REVIEWER: "assign a reviewer",
    Action.ADD_EVIDENCE: "add evidence",
    Action.REOPEN: "reopen the case",
    Action.DECIDE: "record a decision",
    Action.FILE_APPEAL: "file an appeal",
    Action.ASSIGN_APPEAL_REVIEWER: "assign an appeal reviewer",
    Action.DECIDE_APPEAL: "decide the appeal",
    Action.CLOSE: "close the case",
    Action.RECUSE: "step aside from the case",
}
ROLE_MESSAGES: dict[Action, str] = {
    Action.ASSIGN_REVIEWER: "Only an academic administrator can assign reviewers.",
    Action.ADD_EVIDENCE: "Only reviewers and support staff can add evidence.",
    Action.REOPEN: "Only reviewers and academic administrators can reopen a case.",
    Action.DECIDE: "Only reviewers can record a decision.",
    Action.FILE_APPEAL: "Only support staff and academic administrators can file an appeal.",
    Action.ASSIGN_APPEAL_REVIEWER: "Only an academic administrator can assign an appeal reviewer.",
    Action.DECIDE_APPEAL: "Only reviewers can decide an appeal.",
    Action.CLOSE: "Only an academic administrator can close a case.",
    Action.RECUSE: "Only a reviewer assigned to this case can step aside from it.",
}
# Shown when the case is in the wrong state for the action: says what the state must be first.
WHEN_MESSAGES: dict[Action, str] = {
    Action.ASSIGN_REVIEWER: (
        "Reviewers can only be assigned while the case is open or under review."
    ),
    Action.ADD_EVIDENCE: "Evidence can only be added to an open or under-review case.",
    Action.REOPEN: "Only a decided case can be reopened.",
    Action.DECIDE: "A decision can only be recorded while the case is under review.",
    Action.FILE_APPEAL: "An appeal can only be filed on a decided case.",
    Action.ASSIGN_APPEAL_REVIEWER: (
        "An appeal reviewer can only be assigned once an appeal is filed."
    ),
    Action.DECIDE_APPEAL: (
        "An appeal can only be decided after it is filed and assigned to a reviewer."
    ),
    Action.CLOSE: "A case can only be closed once it is decided or its appeal is decided.",
    Action.RECUSE: "A reviewer can only step aside while the case is under review.",
}

OWN_CASE_MESSAGE = "You can only view your own cases."
LEARNER_MESSAGE = "Learners can only add a statement or file an appeal on their own case."
INDEPENDENCE_MESSAGE = (
    "The appeal reviewer must be independent: someone who did not decide this case "
    "and has no conflict."
)
