# Notification

**Purpose:** multi-channel dispatch (Email + In-App now; Teams/Slack adapter slots reserved),
templates, per-user preferences, dispatch log.

## Aggregates
- **NotificationTemplate** — key, channel, subject, body (handlebars-lite `{{var}}`).
- **Preference** — userId, channel, enabled (default: both enabled).
- **DispatchRecord** (append-only) — eventType, userId, channel, status `sent|failed|skipped`,
  at, error?.
- **InAppNotification** — userId, title, body, readAt?.

## Event → notification mapping
| Event | Recipient | Template key |
|---|---|---|
| `EnrollmentCreated` (assigned) | learner | `assignment.new` |
| `EvidenceSubmitted` | learner's manager | `evidence.submitted` |
| `EvidenceApproved` / `EvidenceRejected` | learner | `evidence.decided` |
| `AssessmentPassed` / `AssessmentFailed` | learner | `assessment.result` |
| `PromotionEligible` | learner + manager | `promotion.eligible` |

## Public queries
`NotificationQueries.inbox(userId)`, `.unreadCount(userId)`.

## Events published
`NotificationSent { userId, channel, templateKey }`.

## Invariants
- Preferences respected (disabled channel → `skipped` record, not silent drop).
- Email goes through `EmailPort` only. Dispatch failures recorded, never thrown into consumers.
- In-app marked read via `markRead(userId, id)` — only by the owner.

## Permissions
`notifications.read-self`, `notifications.manage-templates` (admin).
