# ADR-0002: Score V0 determinista desde DB (domain_events -> metrics -> signals -> score)

- Status: Accepted
- Date: 2026-02-26

## Context
- SmartSeller V2 se define como sistema clinico operacional, no analitica exploratoria.
- El score debe ser reproducible y auditable solo con datos persistidos en DB, sin dependencias de APIs externas en tiempo de scoring.
- Identidad core multi-tenant obligatoria: `tenant_id`, `store_id`, `seller_uuid`, `external_account_id`, `provider_key`.
- Existe drift potencial en webhooks/fuentes de ingreso; por eso el score debe poder reconstruirse desde `snapshots` y `metrics_daily`, no desde eventos efimeros.

## Decision
- Se congela Score V0 con pipeline canonico: `webhook_events -> domain_events -> snapshots -> metrics_daily -> clinical_signals -> health_scores`.
- Event types soportados en V0 (forward-looking):
  - `order.created`
  - `order.cancelled`
  - `message.received`
  - `message.answered`
  - `claim.opened`
  - Cualquier otro `event_type` se ignora en V0.
- `v2_metrics_daily.metrics` (`jsonb`) mantiene 5 keys base para ventanas 1d:
  - `orders_created_1d`
  - `orders_cancelled_1d`
  - `messages_received_1d`
  - `messages_answered_1d`
  - `claims_opened_1d`
- Se evalua un set fijo de 5 senales con penalidades `40/25/20/10/5` y severidades `low|medium|high`.
- Formula de score: `score = clamp(100 - sum(penalidades_activas), 0..100)`.
- Recompute gate: si `computed_at < now() - 1h`, recalcular; si no, devolver el ultimo score persistido.
- Trazabilidad obligatoria: `run_id` + `snapshot_id` en `v2_health_scores` y `v2_clinical_signals`.

## Consequences
- Pros:
  - Determinismo operativo.
  - Offline scoring sin proveedores externos.
  - Auditoria reproducible por `run_id`/`snapshot_id`.
- Cons:
  - Sensibilidad temporal por ventanas relativas a `now`.
  - Dependencia de `metrics_daily` para performance.
- Mitigations:
  - `v2_snapshots.payload` conserva evidencia y breakdown de scoring.
  - Reconciliacion/backfill se resuelve en ingesta, no en runtime de scoring.

## Links
- Commit SHAs relacionados:
  - `9aaf1e8` fix(v2): add minimal pages _document for stable next build
  - `a34ceb2` chore(v2): track project files
  - `b4787c3` feat(v2): implement score v0 from persisted domain events
  - `3331c91` chore(v2): add not-found page and stabilize playwright webServer
  - `042794e` feat(v2): link score outputs to snapshot evidence (run_id + snapshot_id)
- Auditoria de pipeline: `docs/AUDIT_PIPELINE_SMOKE.md`
- Contrato operativo: `docs/V2_SCORE_V0_CONTRACT.md`
