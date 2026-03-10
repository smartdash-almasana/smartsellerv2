# Roadmap Status Contrast (Repo Audit)

Fecha de corte: 2026-03-09

## Qué se auditó
- Estado DB refactor y gates QA asociados.
- Estado typed writer y materialización de entidades V1.
- Estado clinical engine V0 (orquestador + 3 workers + señales).
- Trazabilidad por tramo del pipeline aguas abajo (`domain_events → … → health_scores`).
- Evidencia de wiring runtime en ingest/engine vía validación real en entorno de despliegue.

---

## Qué existe hoy (repo)

- Fases DB 1.A/1.B/1.C/2.A/2.B0 + drift patch con migraciones `20260303_09` a `20260303_14`.
- Gate DB refactor reportado en `docs/qa/QA_DB_REFACTOR_GATE.sql` (**13/13 PASS**).
- Typed writer operativo para `v2_orders`, `v2_order_items`, `v2_payments`, `v2_refunds`.
- DLQ tipada `v2_dlq_events` con gate `docs/qa/QA_TYPED_WRITER_GATE.sql` (**16/16 PASS**).
- Clinical V0 operativo con señales funcionales post-baseline.
- Función `ensureSnapshotForRun` incorporada y ahora expuesta vía endpoint worker HTTP.

---

## Estado del pipeline por tramo (auditado 2026-03-09)

| Tramo                             | Estado declarado hasta hoy    | Estado real post-auditoría              |
|-----------------------------------|-------------------------------|-----------------------------------------|
| webhook_events → domain_events    | OK                            | OK (verificado en sesión E2E 2026-03-03)|
| domain_events → snapshots         | FIXED IN CODE                 | **FIXED** (Operativo verificado)        |
| snapshots → metrics_daily         | (auditado 2026-03-09)         | **FIXED** (Lectura validada operativamente desde snapshot genérico en pipeline) |
| metrics_daily → clinical_signals  | OK                            | OK                                      |
| clinical_signals → health_scores  | OK                            | OK                                      |

---

## Detalle del cierre funcional en Tramo 1 (`domain_events → snapshots`)

Bloqueo original superado:
- Se implementó ruta en Next.js `src/app/(v2)/api/worker/run-daily-clinical/route.ts`.
- Desplegado a Vercel Producción exitosamente (`smartsellerv2.vercel.app`).
- Disparo manual programático mediante autenticación `x-cron-secret`.

Fix validado operativamente:
- **Deploy + Trigger real:** API invocada en Vercel, respondiendo HTTP 200 con JSON content (`{ok: true, run_id: "...003", snapshot_id: "...9ee"}`).
- **Validación SQL:** Confirmado el `snapshot_id` vinculado al `run_id` y su payload canónico respectivo (contiene arrays de `worker_results` y fecha `metric_date`).
- **Verificación linkage:** En base de datos de producción el motor enlaza este `snapshot_id` explícito a las filas relacionales afectadas en las tablas de `v2_clinical_signals` y `v2_health_scores`.
- Cierre definitivo post-auditoría clínica.

---

## Mapeo a roadmap (workstream clínico habilitador)

- **Habilitado:** base de datos robusta + writer tipado + motor clínico v0 parcial.
- **Tramo 1 Runtime Verificado:** El endpoint del orquestador está expuesto, certificando la creación materializada de la imagen mediante `ensureSnapshotForRun`.
- **Tramo 2 Runtime Verificado (SNAPSHOT CANÓNICO):** El código actual fue validado funcionalmente post-deploy (forzado sin cache) en el entorno de despliegue principal; los workers nutren el daily_metrics abstractamente desde los snapshots `clinical_inputs` sin pegarle al dataset vivo.
- **En cierre:** observabilidad de notificaciones (3.B) y expansión de entidad fulfillment.

---

## Cierre final del Core Clínico V2

### Estado final por tramo
| Tramo | Estado final |
|---|---|
| `webhook_events → domain_events` | `OK` |
| `domain_events → snapshots` | `FIXED` |
| `snapshots → metrics_daily` | `FIXED` |
| `metrics_daily → clinical_signals` | `OK` |
| `clinical_signals → health_scores` | `OK` |

### Dictamen
El core clínico queda **cerrado y operativo** para el alcance V2 auditado.

### Evidencia operativa mínima consolidada
- Route productiva para orquestador clínico disponible y autenticada por `x-cron-secret`.
- Ejecuciones reales con retorno de `run_id`/`snapshot_id`.
- Snapshot canónico usado como fuente de inputs para métricas.
- Persistencia de métricas con merge JSON no destructivo para evitar pérdida de keys entre sub-workers.

### Siguientes frentes (fuera del core)
1. **Reconciliación** — ver `docs/architecture/RECONCILIATION_AUDIT.md`. Estado formal: **FIXED / OPERATIONAL**.
2. Observabilidad/QA.
3. Hardening de workers.

---

## Reconciliación Operativa (auditada 2026-03-10)

### Dictamen: `FIXED / OPERATIONAL`

| Componente | Estado real |
|---|---|
| Worker `meli-reconcile` | ✅ Implementado (idempotencia, cursor, backoff, DLQ, heartbeat, SKIP LOCKED) |
| Tabla `v2_reconciliation_jobs` | ✅ 0 rows — nunca usada |
| `v2_claim_reconciliation_jobs` RPC | ✅ Existe |
| `v2_enqueue_reconciliation_jobs` RPC | ✅ Implementada en migración `20260310_v2_reconciliation_cron.sql` |
| Cron/schedule para `meli-reconcile` | ✅ `meli_reconcile_6h` (`0 */6 * * *`) en migración `20260310_v2_reconciliation_cron.sql` |
| Ejecuciones históricas | ❌ **0** (heartbeats = 0, domain_events `order.reconciled` = 0) |
| Entidades cubiertas por worker | ⚠️ Solo `orders` — payments/refunds/fulfillments sin implementar |

### Próximo paso mínimo
Validar primera ejecución operativa post-activación:
1. `v2_reconciliation_jobs` con filas en `done`/`pending` según cursor
2. `v2_worker_heartbeats` con `worker_name = 'meli-reconcile'`
3. `v2_domain_events` con eventos `order.reconciled`
