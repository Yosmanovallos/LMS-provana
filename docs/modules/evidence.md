# Evidence

**Purpose (core domain):** evidence upload → review → approve/reject workflow with feedback
and full audit history.

## Aggregates
- **EvidenceItem** — userId, targetRequirementId?, file `{ storageKey, mime, sizeBytes,
  checksum }`, description, status `submitted → under-review → approved | rejected`,
  review `{ reviewerId, decidedAt, feedback? }`, resubmissionOf?, history[] (append-only
  state transitions `{ from, to, byUserId, at, note? }`).

## Public queries
`EvidenceQueries.listForUser(userId)`, `.reviewQueue(managerId)` (items of the manager's
team members), `.getItem(id, requesterId)` (visibility: owner, their manager, admin).

## Events published
`EvidenceSubmitted { evidenceId, userId, targetRequirementId? }`,
`EvidenceApproved { evidenceId, userId, targetRequirementId?, reviewerId }`,
`EvidenceRejected { evidenceId, userId, reviewerId, feedback }`.

## Events consumed — none.

## Invariants
- Only the submitter's assigned manager or an admin may start review / decide.
- **Rejection requires non-empty feedback.** Approved items are immutable.
- Resubmission creates a NEW item linked via `resubmissionOf` (history preserved).
- Allowed mime types: pdf, docx, png, jpg; max size enforced at upload port.
- Every transition appended to history — never rewritten.

## Permissions
`evidence.submit` (employee), `evidence.review` (manager own-team / admin).
