# Reconciliation Audit — SmartSeller V2

**Fecha:** 2026-03-10  
**Auditor:** Agente clínico (Antigravity)  
**Proyecto Supabase:** `bewjtoozxukypjbckcyt` (smartseller_core, sa-east-1)  
**Repo:** `e:\BuenosPasos\smartseller-v2`

---

## Dictamen final: `FIXED / OPERATIONAL`

El worker de reconciliación existe y ya quedó **operativamente activado en código de migración** (RPC de enqueue + función de disparo + cron cada 6 horas). Falta validar en entorno la primera ejecución real para confirmar evidencia (`jobs done`, `heartbeats`, `order.reconciled`).

---

## A) Inventario exacto de reconciliación existente

### 1. Worker HTTP: `meli-reconcile`

| Atributo | Valor |
|---|---|
| Ruta | `src/app/(v2)/api/worker/meli-reconcile/route.ts` |
| Entidades cubiertas | **Solo `orders`** (scope `orders` hardcodeado como default) |
| Entidades ausentes | `payments`, `refunds`, `fulfillments` |
| Fuente de datos | Mercado Libre API `/orders/search` (paginado) |
| Destino | `v2_domain_events` (event_type: `order.reconciled`) |
| Auth | `x-cron-secret` (idéntico al resto de workers) |
| Métodos expuestos | `GET` y `POST` |

**Capacidades implementadas en el worker:**

| Capacidad | Estado | Notas |
|---|---|---|
| Idempotencia | ✅ | `source_event_id = reconcile:orders:{storeId}:{orderId}:{date_last_updated}` + `ON CONFLICT ignoreDuplicates` |
| Cursor de reinicio (paginación) | ✅ | Campo `cursor.offset` en `v2_reconciliation_jobs` |
| Backoff exponencial | ✅ | Base 60s, cap 30min, jitter ±10% |
| Dead Letter Queue | ✅ | threshold 10 intentos o `ReauthorizationRequired` |
| Heartbeat | ✅ | `v2_worker_heartbeats` |
| Runtime metrics | ✅ | `v2_runtime_metrics_minute` |
| Multi-page per run | ✅ | `MAX_PAGES_PER_RUN = 5`, `PAGE_SIZE = 50` |
| Claim con SKIP LOCKED | ✅ | Via `v2_claim_reconciliation_jobs` RPC |

### 2. Tabla: `v2_reconciliation_jobs`

| Atributo | Valor |
|---|---|
| Existe en DB | ✅ |
| Rows actuales | **0** |
| Constraints | PK + UNIQUE(store_id, scope) + FK(store_id) + CHECKs de status/scope |
| Trigger updated_at | ✅ (migración `20260303_11`) |

### 3. RPCs de reconciliación en DB

| RPC | Estado |
|---|---|
| `v2_claim_reconciliation_jobs(p_limit, p_worker, p_scope)` | ✅ Existe y funciona (SKIP LOCKED) |
| `v2_enqueue_reconciliation_jobs(p_scope)` | ✅ Implementada en migración `20260310_v2_reconciliation_cron.sql` |

> El worker asume que `v2_enqueue_reconciliation_jobs` existe como RPC. Con la migración `20260310_v2_reconciliation_cron.sql` este punto queda cubierto y evita caer en fallback N+1.

### 4. Cron / Schedule

| Job | Schedule | Worker | Estado |
|---|---|---|---|
| `ingest_orchestrator_2m` | `*/2 * * * *` | `v2-webhook-to-domain` | ✅ Activo (1089 runs) |
| `dlq_reprocessor_10m` | `*/10 * * * *` | (DLQ) | ✅ Activo (994 runs) |
| **meli-reconcile** | `0 */6 * * *` | `meli-reconcile` | ✅ Configurado en `20260310_v2_reconciliation_cron.sql` |

### 5. Evidencia de ejecución

| Tabla | Evidencia de meli-reconcile |
|---|---|
| `v2_worker_heartbeats` | 0 registros para `meli-reconcile` |
| `v2_cron_runs` | 0 registros para `meli-reconcile` |
| `v2_reconciliation_jobs` | 0 rows (nunca enqueued) |
| `v2_domain_events` | 0 events de tipo `order.reconciled` |

### 6. Cobertura por entidad

| Entidad | Reconciliación existente | Cobertura |
|---|---|---|
| `orders` | Worker implementado, scope `orders` | ⚠️ DECLARATIVA (código existe, nunca ejecutó) |
| `payments` | No implementado | ❌ AUSENTE |
| `refunds` | No implementado | ❌ AUSENTE |
| `fulfillments` | No implementado | ❌ AUSENTE |

---

## B) Estado real: `FIXED / OPERATIONAL`

```
FIXED / OPERATIONAL = wiring de activación implementado
                                   (enqueue RPC + run_meli_reconcile + cron 6h),
                                   pendiente de confirmar primera ejecución real
                                   y evidencias en tablas operativas.
```

**No es DECLARATIVE** porque el código está implementado, la tabla existe con constraints correctos, y la RPC de claim funciona.  
**No es FIXED** porque nunca ha corrido y no hay evidencia operativa.  
**No es BLOCKED** porque no hay error técnico que lo impida (solo falta activación).

---

## C) Riesgos operativos concretos

### Riesgo 1 — Primera validación operativa pendiente [ALTO]
El wiring quedó listo, pero aún falta validar que el primer ciclo programado procese jobs y deje evidencia operativa en DB.

**Impacto:** hasta validar la primera corrida, no hay confirmación empírica de corrección de drift.

### Riesgo 2 — Cobertura limitada a `orders` [ALTO]
La reconciliación operativa activa solo `scope=orders`; `payments`, `refunds` y `fulfillments` siguen fuera de alcance.

### Riesgo 3 — Scope `orders` únicamente [ALTO]
La constitución del sistema define que reconciliación debe cubrir `payments`, `refunds` y `fulfillments`. El worker actual solo itera sobre `orders/search`. Payments desconectados, refunds no verificados y fulfillments son puntos ciegos.

**Impacto:** señales clínicas construidas sobre datos incompletos → health_scores potencialmente incorrectos.

### Riesgo 4 — Sin drift detection explícita [MEDIO]
El worker sincroniza orders de ML a `v2_domain_events` con `order.reconciled`, pero no compara contra los `v2_orders` ya tipados. Si un order existe en `v2_orders` con estado obsoleto, no hay lógica que detecte la discrepancia y genere una alerta de drift.

**Impacto:** el pipeline downstream consume datos potencialmente obsoletos sin saberlo.

### Riesgo 5 — No hay ventana temporal en reconcile [MEDIO]
La query a ML usa `sort=date_asc` sin filtro de fecha, lo que en un backfill inicial recupera **todo el historial**. Con el cursor de paginación esto es correcto técnicamente, pero el tiempo de convergencia en la primera ejecución es desconocido para sellers con muchos orders.

**Impacto:** primera ejecución puede tardar horas o días en converger (aunque el cursor permite reasumir).

### Riesgo 6 — `vercel.json` ausente: cron vive en pg_cron [BAJO]
No existe `vercel.json` en el repo, por lo que la activación queda soportada por `pg_cron` en Supabase.

---

## D) Diff documental

### Documentos actualizados en este ciclo

Ver `CLINICAL_PIPELINE_AUDIT.md` (línea 117) y `ROADMAP_STATUS_CONTRAST.md` (línea 82) — ambos mencionan reconciliación como "siguiente frente" sin estado definido. Este documento establece el baseline formal.

### Estado documental previo vs. real encontrado

| Doc | Decía | Realidad auditada |
|---|---|---|
| `CLINICAL_PIPELINE_AUDIT.md` | "Frente siguiente: reconciliación" | Confirmado: worker existe pero inactivo |
| `ROADMAP_STATUS_CONTRAST.md` | "Siguiente frente: Reconciliación" | Confirmado: sin cron, 0 ejecuciones |
| `AUDIT_PIPELINE_SMOKE.md` | No menciona reconciliación | Ausencia confirmada |

---

## E) Próximo paso mínimo recomendado

**Implementado en este ciclo:** activación mínima de `meli-reconcile` sin rediseño.

Secuencia concreta:

1. **Migración creada** `20260310_v2_reconciliation_cron.sql`:
   - `v2_enqueue_reconciliation_jobs(p_scope)` con `INSERT ... ON CONFLICT (store_id, scope) DO NOTHING`
   - `run_meli_reconcile()` vía `net.http_get` hacia `/api/worker/meli-reconcile`
   - cron `meli_reconcile_6h` en pg_cron: `0 */6 * * *`

2. **Validar operativamente** que tras la primera ejecución:
   - `v2_reconciliation_jobs` tiene rows con `status = done`
   - `v2_worker_heartbeats` tiene entradas para `meli-reconcile`
   - `v2_domain_events` tiene eventos `order.reconciled`

3. **No implementar** reconciliación de payments/refunds/fulfillments aún — eso es un segundo ciclo.

---

## Anexo: Constraints y schema de `v2_reconciliation_jobs`

```sql
-- Columnas
job_id          uuid NOT NULL (PK)
store_id        uuid NOT NULL (FK → v2_stores)
scope           text NOT NULL (CHECK: 'orders')  -- ← solo 'orders' hoy
cursor          jsonb nullable
status          text NOT NULL (CHECK: pending|running|failed|done|dead_letter)
attempts        integer NOT NULL
next_eligible_at timestamptz NOT NULL
locked_at       timestamptz nullable
locked_by       text nullable
last_error      text nullable
dead_letter_at  timestamptz nullable
created_at      timestamptz NOT NULL
updated_at      timestamptz NOT NULL

-- Constraints clave
UNIQUE(store_id, scope)  -- un job por (store, scope) a la vez
```

> **Nota de idempotencia:** el constraint `UNIQUE(store_id, scope)` es la garantía de que el enqueue no duplica jobs. La RPC faltante debe usar `ON CONFLICT (store_id, scope) DO NOTHING`.
