# Certification

**Purpose:** issuance, expiry, and registry of internal/external certifications.

## Aggregates
- **Certification** — userId, name, type `internal|external`, source
  `assessment|course|evidence|manual`, sourceRefId?, issuedAt, expiresAt?,
  verificationRef?, status `valid|expired|revoked`.

## Public queries
`CertificationQueries.listForUser(userId)`, `.registry(filter)` (admin/manager scope).

## Events published
`CertificationEarned { certificationId, userId, name, source, sourceRefId? }`,
`CertificationExpired { certificationId, userId, name }`.

## Events consumed
- `AssessmentPassed` → issue cert when the assessment is configured as certifying
  (config: `certifyingAssessments` map name per assessmentId).
- `CourseCompleted` → same pattern for certifying courses.
- `EvidenceApproved` with targetRequirementId of certification kind → manual-style issuance.

## Invariants
- Issuance is idempotent per (userId, source, sourceRefId).
- Expiry job transitions `valid → expired` exactly once and publishes the event.
- Revocation is a status change with audit note, never deletion.

## Permissions
`cert.read` (self/manager-scope/admin), `cert.manage` (admin manual issuance/revocation).
