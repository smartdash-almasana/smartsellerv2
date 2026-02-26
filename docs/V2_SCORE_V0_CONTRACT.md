# SmartSeller V2 - Score V0 Contract

## 1) Scope & Invariants
- Scope: contrato funcional minimo para calcular Score V0 de forma determinista y auditable.
- Invariant: scoring se basa solo en DB (`domain_events`, `snapshots`, `metrics_daily`, `clinical_signals`, `health_scores`).
- Invariant: no APIs externas durante scoring.
- Invariant: seguridad multi-tenant obligatoria en todos los filtros (`tenant_id`, `store_id`, `seller_uuid`, `provider_key`).
- Invariant: trazabilidad obligatoria por `run_id` y `snapshot_id`.

## 2) Event Vocabulary (`domain_events.event_type`)
Eventos soportados V0:
- `order.created`: alta de orden comercial.
- `order.cancelled`: cancelacion de orden.
- `message.received`: mensaje entrante del canal.
- `message.answered`: respuesta emitida por la tienda/vendedor.
- `claim.opened`: apertura de reclamo.

Origen desde topics ML (placeholder, sin prometer exactitud):
- `orders.created` -> `order.created`
- `orders.cancelled` -> `order.cancelled`
- `messages.received` -> `message.received`
- `messages.answered` -> `message.answered`
- `claims.opened` -> `claim.opened`

Nota: cualquier `event_type` fuera de este vocabulario se ignora en Score V0.

## 3) Metrics Schema (`v2_metrics_daily.metrics`)
- Tipo: `jsonb`.
- Bucket: UTC diario (`day_utc` / fecha canonicamente truncada a dia UTC).
- Upsert key esperada: (`tenant_id`, `store_id`, `seller_uuid`, `provider_key`, `day_utc`).
- Keys y tipos (`int`):
  - `orders_created_1d`
  - `orders_cancelled_1d`
  - `messages_received_1d`
  - `messages_answered_1d`
  - `claims_opened_1d`

Agregados de ventana (7d/14d) se derivan por suma de buckets diarios.

## 4) Signal Schema (`v2_clinical_signals`)
Campos contractuales:
- `signal_key` (`text`)
- `severity` (`low|medium|high`)
- `active` (`boolean`)
- `penalty` (`int`)
- `evidence` (`jsonb`)
- `run_id` (`uuid/text` segun schema vigente)
- `snapshot_id` (`uuid/text` segun schema vigente)

## 5) Rules (exactas, V0)
- `no_orders_7d`: active if `orders_created_7d == 0`, penalty `40`.
- `cancellation_spike`: active if `orders_created_7d > 0 AND orders_cancelled_7d >= max(3, ceil(orders_created_7d*0.30))`, penalty `25`.
- `unanswered_messages_spike`: `pending = messages_received_7d - messages_answered_7d`; active if `pending >= 5`, penalty `20`.
- `claims_opened`: active if `claims_opened_7d >= 1`, penalty `10`.
- `low_activity_14d`: `activity14 = orders_created_14d + messages_received_14d + claims_opened_14d`; active if `0 < activity14 < 3`, penalty `5`.

Score final:
- `score = clamp(100 - sum(active.penalty), 0..100)`

## 6) Snapshot Payload Contract (`v2_snapshots.payload`)
Ejemplo JSON compacto:
```json
{
  "version": "score-v0",
  "computed_at": "2026-02-26T18:05:00Z",
  "metrics_daily_today": {
    "orders_created_1d": 1,
    "orders_cancelled_1d": 0,
    "messages_received_1d": 2,
    "messages_answered_1d": 1,
    "claims_opened_1d": 0
  },
  "aggregates": {
    "orders_created_7d": 4,
    "orders_cancelled_7d": 2,
    "messages_received_7d": 11,
    "messages_answered_7d": 5,
    "claims_opened_7d": 1,
    "orders_created_14d": 6,
    "messages_received_14d": 17,
    "claims_opened_14d": 1
  },
  "signals": [
    {"signal_key": "no_orders_7d", "active": false, "penalty": 40, "severity": "high", "evidence": {"orders_created_7d": 4}},
    {"signal_key": "cancellation_spike", "active": false, "penalty": 25, "severity": "medium", "evidence": {"orders_created_7d": 4, "orders_cancelled_7d": 2, "threshold": 3}},
    {"signal_key": "unanswered_messages_spike", "active": true, "penalty": 20, "severity": "medium", "evidence": {"messages_received_7d": 11, "messages_answered_7d": 5, "pending": 6}},
    {"signal_key": "claims_opened", "active": true, "penalty": 10, "severity": "low", "evidence": {"claims_opened_7d": 1}},
    {"signal_key": "low_activity_14d", "active": false, "penalty": 5, "severity": "low", "evidence": {"activity14": 24}}
  ],
  "score": {
    "base": 100,
    "penalty_total": 30,
    "value": 70
  }
}
```

## 7) Recompute Gate (1h) + Idempotencia
- Recompute gate: recalcular solo si `computed_at < now() - interval '1 hour'`; en caso contrario devolver ultimo resultado persistido.
- Idempotencia operacional: `store_id + run_id` debe ser unico en escritura de artefactos de scoring.

## 8) DB Queries for Audit
```sql
-- Q1: ultimo health score por store
select id, tenant_id, store_id, score, run_id, snapshot_id, computed_at
from v2_health_scores
where tenant_id = :tenant_id and store_id = :store_id
order by computed_at desc
limit 20;

-- Q2: snapshots recientes con payload
select id, tenant_id, store_id, run_id, created_at, payload
from v2_snapshots
where tenant_id = :tenant_id and store_id = :store_id
order by created_at desc
limit 20;

-- Q3: senales clinicas por run
select id, tenant_id, store_id, run_id, snapshot_id, signal_key, severity, active, penalty, evidence, created_at
from v2_clinical_signals
where tenant_id = :tenant_id and store_id = :store_id
order by created_at desc
limit 100;

-- Q4: metrics daily para ventanas 14d
select tenant_id, store_id, seller_uuid, provider_key, day_utc, metrics
from v2_metrics_daily
where tenant_id = :tenant_id
  and store_id = :store_id
  and day_utc >= (current_date - interval '14 day')
order by day_utc desc;
```

## 9) Non-goals (V0)
No incluye en V0:
- refunds
- payments
- fulfillment/logistica
- reputacion ML avanzada
- scoring predictivo no determinista
- fuentes externas en tiempo real para modificar score
