# SmartSeller v2 — Technical Documentation

## Purpose

Canonical entry point for SmartSeller v2 technical documentation.

This directory defines the architectural, authentication, database, operational, and product foundations of SmartSeller v2 as a clinical, multi-tenant operational monitoring system.

---

## Architecture

- [Overview](./architecture/overview.md)
- [Identity Model](./architecture/identity-model.md)
- [Event Pipeline](./architecture/event-pipeline.md)

Defines the core system principles, identity boundaries, and deterministic clinical pipeline:
`webhook_events → domain_events → snapshots → metrics → clinical_signals → health_score`.

---

## Auth

- [OAuth Supabase + Google](./auth/oauth-supabase-google.md)
- [OAuth Mercado Libre](./auth/oauth-mercadolibre.md)
- [Session & Cookies Model](./auth/session-and-cookies.md)
- [Documento OAuth](./Documento%20OAuth.md)

Documents:
- Human session model (Google via Supabase)
- External account linkage (Mercado Libre OAuth)
- Cookie propagation rules
- Installation and token lifecycle
- Session invariants and failure modes

---

## Database

- [DDL Core](./database/ddl-core.md)
- [RLS Policies](./database/rls-policies.md)

Defines:
- Canonical identity model (`tenant_id`, `store_id`, `seller_uuid`)
- Multi-tenant isolation guarantees
- Idempotent ingestion rules
- Reproducible clinical state

---

## Operations

- [Vercel Environment Variables](./operations/vercel-env.md)
- [Runbooks](./operations/runbooks.md)

Operational procedures for:
- OAuth failures
- Session 401 errors
- Token expiration
- Webhook failures
- Clinical drift detection

---

## Product

- [Dashboard Clinical UX](./product/dashboard-clinical-ux.md)

Defines the clinical dashboard information hierarchy:

1. State  
2. Alerts  
3. Operational Context  
4. Configuration  

Includes wizard activation rules and UX invariants.

---

## ADR

- [ADR-0003 — Session Model](./adr/ADR-0003-session-model.md)

Architectural Decision Records define irreversible or high-impact structural decisions affecting:

- Identity model
- OAuth boundaries
- RLS guarantees
- Clinical scoring rules
- Token persistence model

---

## Global Invariants

- SmartSeller v2 is a **clinical multi-tenant system**, not a vanity analytics dashboard.
- The dashboard never consumes raw `webhook_events`.
- Every clinical state must be reconstructible from persisted history.
- Identity separation between internal (`store_id`) and external (`external_account_id`) is mandatory.
- Scores must be deterministic for a given time window and rule version.

---

## Maintenance Rules

Whenever architecture changes:

- Update `architecture/`
- Update `auth/`
- Update `database/`
- Update `operations/`
- Update `product/`
- Create or update an ADR when required

Documentation drift is considered a structural defect.