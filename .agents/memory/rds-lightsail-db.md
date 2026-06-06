---
name: Lightsail/RDS database connection
description: How this app connects to its AWS Lightsail/RDS PostgreSQL and the TLS quirk involved
---

# Lightsail/RDS PostgreSQL connection

The app connects directly to AWS Lightsail/RDS PostgreSQL using `RDS_ENDPOINT`,
`RDS_USER`, `RDS_PASSWORD` secrets (DB name defaults to `ideacompiler`, override
with `RDS_DATABASE`). There is intentionally **no fallback** to the
Replit-provisioned `DATABASE_URL` — both `server/db.ts` and `drizzle.config.ts`
build the connection from `RDS_*`.

## TLS quirk
**Rule:** Connecting requires either `RDS_CA_CERT` (verified TLS) or
`rejectUnauthorized: false`. With default Node trust store and no CA, the
connection fails with `SELF_SIGNED_CERT_IN_CHAIN` / "self-signed certificate in
certificate chain".

**Why:** The RDS server certificate's CA is not in Node's default trust store,
so verification fails unless you supply the CA bundle.

**How to apply:** For one-off scripts/migrations set
`NODE_TLS_REJECT_UNAUTHORIZED=0` or pass `ssl: { rejectUnauthorized: false }`.
For the app, set `RDS_CA_CERT` (PEM) to get verified TLS; otherwise it falls back
to no cert verification. `npm run db:push` targets RDS via drizzle.config.ts.
