# Supabase Edge Functions

Server-side functions running on the Deno runtime at the edge.

## Planned Edge Functions (ARCHITECTURE.md Section 8)
- `create-group`: Validates mutual friendship and creates temporary group container atomically.
- `invite-member`: Enforces two-way friendship requirement prior to group admission.
- `location-update`: Ingests throttled GPS telemetry, updates ephemeral current_locations, and checks destination geofence.
- `route-request`: Proxies Valhalla routing and ETA requests.
- `lifecycle-worker`: Scheduled worker transitioning expired groups and terminating sessions.
- `purge-worker`: Background worker purging soft-deleted records and media according to retention policy.
- `send-notification`: Coordinates APNs and FCM push notification dispatches.
- `username-search`: Constant-time exact username search with anti-enumeration rate limiting.
