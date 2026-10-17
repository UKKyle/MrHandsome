# Mr Handsome — administration security and recovery

## Current protections
- Cloudflare Access is required for `/admin` and `/admin/api/*`, with signed token verified again by the Worker (issuer, audience and approved email).
- State-changing admin API requests reject cross-origin requests.
- Admin HTML is returned with no-store, no-referrer, frame-deny, nosniff and restrictive CSP headers.
- Admin booking changes record an audit event in D1 `admin_audit_log` with actor, action, target, timestamp and minimal change details. Do not store customer names or email addresses in audit details.
- Customer-facing slots API must expose only date and time.

## Before production onboarding
1. Configure a client-specific Cloudflare Access application and authorised staff identities. Enforce MFA through a suitable identity provider; never share your own Cloudflare credentials.
2. Set short Access session lifetimes and remove staff access promptly when roles change.
3. Use a dedicated admin hostname if a domain is purchased, but keep Worker JWT checks; hostname separation alone is not authentication.
4. Review privacy notice, retention periods and a data-processing agreement for booking records.
5. Test owner/staff access and negative tests with an unauthorised identity before handover.

## Backup and recovery
- Before any destructive schema migration, create a point-in-time D1 backup/export using Cloudflare's supported backup tools and store it securely outside the public repository.
- Confirm D1's available Time Travel/backup retention and limits in the active account. Do not assume permanent backups.
- Test restoration into a separate staging database; compare booking counts, unique date/time keys and assigned barber fields before directing production traffic to restored data.
- For an incident: disable affected admin identities in Cloudflare Access; preserve audit evidence; export/restore using Cloudflare tools; verify availability consistency; rotate exposed secrets; inform the data controller where applicable.
- Never place a real booking database dump or admin access token into GitHub.

## Audit queries (authorised operator only)
`SELECT occurred_at,actor_email,action,target,details FROM admin_audit_log ORDER BY occurred_at DESC LIMIT 50;`

## Remaining verification
- Authenticated in-browser smoke test of assignment, cancellation and availability changes.
- Public unauthenticated requests to admin pages and APIs must return 403 or the Cloudflare Access challenge, never private customer records.
- Test session expiry and recoverability with an actual client identity.
