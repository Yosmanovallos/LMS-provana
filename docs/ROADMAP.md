# Roadmap

## Done in this repo (MVP, Phases 0–8)
Foundation kernel · Identity/AuthZ/Org · Learning catalog + My Learning · Assessments ·
Evidence · Certifications + Analytics v1 · Gamification · Promotion engine · Notifications ·
Next.js frontend shells for the three personas.

## Explicitly deferred (do not build pre-MVP)
- Teams/Slack notification channels (adapter slots reserved in notification module)
- SCIM provisioning, Entra ID cutover (Phase 9, master plan §20)
- Multi-tenancy beyond the `tenantId` column placeholder
- Full row-level security; k6 performance suite; Playwright E2E against deployed previews
- Azure landing zone (Bicep), Service Bus adapter, Blob adapter

## Azure migration triggers
SSO mandate (most likely first), compliance requirements, or infra cost > ~$500/mo.
Runbook: master plan §20.
