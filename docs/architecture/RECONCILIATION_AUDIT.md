# Reconciliation Audit — SmartSeller V2

**Fecha:** 2026-03-10  
**Auditor:** Agente clínico (Antigravity)  
**Proyecto Supabase:** `bewjtoozxukypjbckcyt` (smartseller_core, sa-east-1)  
**Repo:** `e:\BuenosPasos\smartseller-v2`

---

## Dictamen final (reconciliación operativa): `FIXED / OPERATIONAL`  
## Dictamen final (consistencia con v2_orders): `PARTIAL — STRUCTURAL GAP`

El worker de reconciliación está **operativo y verificado empíricamente** (jobs done, heartbeats, events `order.reconciled` en DB).  
Sin embargo, la auditoría de consistencia reveló una **brecha estructural crítica**: los `order.reconciled` events **no actualizan `v2_orders`**, porque el typed writer `orders-writer.ts` solo procesa `event_type = 'order.updated'`.

---

## A) Muestra SQL auditada

### A1. Eventos `order.reconciled` en `v2_domain_events`

```
total_reconciled_events       = 6
distinct_reconciled_order_ids = 6
duplicate_reconciled_ids      = 0  ✅ sin duplicados
```

IDs reconciliadas (de ML API):
| entity_id (ML order_id) | reconcile_status | currency | total_amount | date_last_updated     |
|---|---|---|---|---|
| 2000010994106530 | cancelled | ARS | 71,419.94 | 2025-04-16T21:15:07Z |
| 2000012328887856 | paid      | ARS | 85,000.00 | 2025-07-22T15:10:27Z |
| 2000012424638060 | paid      | ARS | 85,000.00 | 2025-08-22T17:16:32Z |
| 2000013334511380 | cancelled | ARS | 85,000.00 | 2025-10-21T20:27:23Z |
| 2000013338945356 | paid      | ARS | 85,000.00 | 2025-10-13T18:00:48Z |
| 2000014741316270 | cancelled | ARS | 145,000.00 | 2026-01-19T12:43:43Z |

**Sin duplicados**: constraint `store_id, provider_event_id` + `source_event_id` idempotente cumple. ✅

### A2. Estado de `v2_orders`

```
total_typed_orders                    = 3  (external_id: 999123, 999124, 999125)
reconciled_ids_matched_in_v2_orders   = 0  ❌ NINGUNA coincidencia
```

Las 3 filas en `v2_orders` son órdenes de prueba (external_id: `999123-999125`), generadas por el flujo `order.updated` del pipeline webhook. **Ninguna** de las 6 órdenes reales de ML (2000010994106530, etc.) tiene fila correspondiente en `v2_orders`.

### A3. Overlap reconciliados ↔ order.updated

```
6 reconciled orders → 0 tienen order.updated en v2_domain_events
```

Los 6 orders reales de ML **nunca pasaron por el pipeline de webhooks** (`order.updated`). Son órdenes históricas captadas solo por reconciliación.

### A4. Typed writer — qué event_type procesa

```typescript
// orders-writer.ts, línea 21
if (domainEvent.event_type !== 'order.updated') {
    return;  // ← sale inmediatamente para event_type = 'order.reconciled'
}
```

El typed writer `writeOrderFromDomainEvent` **ignora explícitamente** cualquier evento que no sea `order.updated`. Los `order.reconciled` no actualizan `v2_orders`.

---

## B) Inconsistencias encontradas

### Inconsistencia 1 — CRÍTICA: `order.reconciled` NO actualiza `v2_orders`

**Causa raíz:** `orders-writer.ts` filtra solo `event_type === 'order.updated'`.  
**Efecto:** Los 6 orders reales de ML (años 2025–2026) están en `v2_domain_events` como `order.reconciled` pero son **invisibles** para el typed writer y por ende para:
- `v2_orders` (tabla de snapshot tipada)
- `v2_metrics_daily` (biomarkers clínicos)
- `v2_clinical_signals` (señales de riesgo)
- `v2_health_scores` (score final)

**El motor clínico NO ve las órdenes reconciliadas.**

### Inconsistencia 2 — ALTA: Los únicos orders en `v2_orders` son datos de prueba

Los 3 únicos registros en `v2_orders` (`999123`, `999124`, `999125`) son órdenes sintéticas creadas durante pruebas E2E, con `last_source_event_id` apuntando a eventos `order.updated` de webhook test. Los **orders reales** captados por reconciliación no tienen fila aquí.

### Inconsistencia 3 — ALTA: El pipeline `order.reconciled → v2_orders` no existe

No hay ningún mecanismo en el sistema (worker, engine, cron) que tome un `order.reconciled` y lo promueva a:
- `v2_orders` via typed writer
- `v2_order_items` via items writer  
- Señales clínicas downstream

El ciclo `reconciled → typed → engine → score` está **desconectado**.

### Inconsistencia 4 — MEDIA: `order.reconciled` vs `order.updated` — sin overlap

No hay overlap: los 6 ML orders reales nunca tuvieron un webhook `order.updated`. Son órdenes históricas que el motor clínico **no puede consumir**.

---

## C) Dictamen final de consistencia: `PARTIAL`

```
PARTIAL = el worker de reconciliación funciona operativamente (FIXED),
          pero el ciclo de propagación downstream está incompleto:
          order.reconciled → v2_orders NO EXISTE.

          Los events order.reconciled son datos huérfanos desde la
          perspectiva del motor clínico. Ninguno de ellos alimenta
          scores, señales ni métricas.
```

| Check | Resultado |
|---|---|
| `order.reconciled` sin duplicados | ✅ |
| `order.reconciled` con payload válido (status, amount, currency) | ✅ |
| `order.reconciled` → FK correcta `v2_webhook_events` | ✅ |
| Heartbeats del worker | ✅ |
| `order.reconciled` → actualiza `v2_orders` | ❌ NO |
| `order.reconciled` → visible en motor clínico | ❌ NO |
| Órdenes reales de ML en `v2_orders` | ❌ 0 filas |
| Orders de prueba en `v2_orders` | ✅ 3 filas (sintéticas, via order.updated) |

---

## D) Inventario de worker y activación (estado post-FIXED)

### 1. Worker HTTP: `meli-reconcile`

| Atributo | Valor |
|---|---|
| Ruta | `src/app/(v2)/api/worker/meli-reconcile/route.ts` |
| Entidades cubiertas | **Solo `orders`** (scope `orders` hardcodeado como default) |
| Entidades ausentes | `payments`, `refunds`, `fulfillments` |
| Fuente de datos | Mercado Libre API `/orders/search` (paginado) |
| Destino inmediato | `v2_webhook_events` + `v2_domain_events` (event_type: `order.reconciled`) |
| Destino faltante | `v2_orders` (typed writer no conectado) |
| Auth | `x-cron-secret` (idéntico al resto de workers) |

**Capacidades implementadas en el worker:**

| Capacidad | Estado | Notas |
|---|---|---|
| Idempotencia | ✅ | Via `store_id, provider_event_id` UNIQUE + `source_event_id` ON CONFLICT |
| Cursor de reinicio (paginación) | ✅ | Campo `cursor.offset` en `v2_reconciliation_jobs` |
| Backoff exponencial | ✅ | Base 60s, cap 30min, jitter ±10% |
| Dead Letter Queue | ✅ | threshold 10 intentos o `ReauthorizationRequired` |
| Heartbeat | ✅ | `v2_worker_heartbeats` |
| Multi-page per run | ✅ | `MAX_PAGES_PER_RUN = 5`, `PAGE_SIZE = 50` |
| Claim con SKIP LOCKED | ✅ | Via `v2_claim_reconciliation_jobs` RPC |
| Propagación a v2_orders | ❌ | typed writer no procesa `order.reconciled` |

### 2. Tabla: `v2_reconciliation_jobs`

| Atributo | Valor |
|---|---|
| Existe en DB | ✅ |
| Rows actuales | **1 (status = done)** |
| Constraints | PK + UNIQUE(store_id, scope) + FK(store_id) + CHECKs de status/scope |

### 3. RPCs de reconciliación en DB

| RPC | Estado |
|---|---|
| `v2_claim_reconciliation_jobs(p_limit, p_worker, p_scope)` | ✅ Existe y funciona (SKIP LOCKED) |
| `v2_enqueue_reconciliation_jobs(p_scope)` | ✅ Implementada en migración `20260310_v2_reconciliation_cron.sql` |

### 4. Cron / Schedule

| Job | Schedule | Estado |
|---|---|---|
| `meli_reconcile_6h` | `0 */6 * * *` | ✅ Activo en pg_cron |
| `ingest_orchestrator_2m` | `*/2 * * * *` | ✅ Activo |
| `dlq_reprocessor_10m` | `*/10 * * * *` | ✅ Activo |

### 5. Evidencia operativa validada

| Tabla | Evidencia |
|---|---|
| `v2_worker_heartbeats` | ✅ `meli-reconcile` registrado, `processed=6`, `failed=0` |
| `v2_reconciliation_jobs` | ✅ 1 job `status=done`, `last_error=null` |
| `v2_domain_events` | ✅ 6 eventos `order.reconciled` con payload real de ML |
| `v2_orders` | ❌ 0 filas de órdenes reales (brecha de consistencia) |

---

## E) Próximo paso mínimo recomendado

**Una sola tarea de alto impacto (no implementado en este ciclo):**

Extender el typed writer (`orders-writer.ts`) para aceptar también `event_type = 'order.reconciled'`.

```typescript
// PROPUESTA (no implementado aún):
if (!['order.updated', 'order.reconciled'].includes(domainEvent.event_type)) {
    return;
}
```

Con este cambio + re-ejecución del motor clínico sobre los 6 events `order.reconciled` existentes, las órdenes históricas de ML quedarían tipadas en `v2_orders` y visibles para scores y señales.

**Prioridad:** ALTA — sin este fix, la reconciliación operativa no genera valor clínico.

---

## Anexo: Constraints y schema de `v2_reconciliation_jobs`

```sql
job_id          uuid NOT NULL (PK)
store_id        uuid NOT NULL (FK → v2_stores)
scope           text NOT NULL (CHECK: 'orders')
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

-- Constraint clave:
UNIQUE(store_id, scope)  -- un job por (store, scope) a la vez
```
