# Pipeline Clínico V2 (Source of Truth)

Este documento describe la arquitectura y el flujo físico de datos desde la recepción de eventos externos hasta la generación de scores clínicos, consolidando las decisiones de observabilidad y resiliencia (ADR-004, ADR-005, ADR-006, ADR-007).

## Flujo de Ingesta y Motor Clínico

El pipeline es **estrictamente de un solo sentido (unidireccional), append-only y event-driven**.
Se basa en Postgres como cola persistente (FV) y Next.js Workers para computo.

```mermaid
flowchart TD
    %% Fuentes Externas
    ML[Mercado Libre Webhook] -.-> API_WH(API: /api/meli/webhook)
    SHOP[Shopify Webhook] -.-> API_WH
    SYNC[Manual Sync Worker] -.-> API_WH

    %% Capa Ingesta (Bruta)
    API_WH -- Insert (Idempotente) --> V2_WH[(v2_webhook_events)]

    %% Capa Procesamiento Normal
    V2_WH -- Fetch Batch --> API_WORKER(API: /api/worker/v2-webhook-to-domain)
    
    %% Capa Dominio (Normalizada, 1:1)
    API_WORKER -- Upsert --> V2_DOM[(v2_domain_events)]
    
    %% Observabilidad Worker
    API_WORKER -- Log (Best Effort) --> V2_ATT[(v2_ingest_attempts)]

    %% DLQ Reprocessor Flow
    CRON_SYS((pg_cron)) -- run_dlq_reprocessor() --> POSTGRES_PROC{Postgres}
    
    POSTGRES_PROC -- Audit Log (Best Effort) --> V2_CRON[(v2_cron_runs)]
    
    %% El DLQ Llama al worker
    POSTGRES_PROC -- HTTP GET pg_net --> API_DLQ_WORKER(API: /api/worker... ?mode=dlq)

    API_DLQ_WORKER -- Upsert --> V2_DOM
    API_DLQ_WORKER -- Log Error/Ok --> V2_ATT
    
    %% Capa Clínica (Motor)
    V2_DOM -- Run Engine --> API_ENG(API: /api/engine/run)
    API_ENG -- Extract --> V2_SIG[(v2_clinical_signals)]
    API_ENG -- Evaluate --> V2_SCORE[(v2_health_scores)]

    classDef db fill:#f9f,stroke:#333,stroke-width:2px;
    class V2_WH,V2_DOM,V2_ATT,V2_SIG,V2_SCORE,V2_CRON db;
    
    classDef api fill:#bbf,stroke:#333,stroke-width:2px;
    class API_WH,API_WORKER,API_ENG,API_DLQ_WORKER api;
```

### Componentes Clave

1. **`v2_webhook_events`**: Tabla bruta, conserva el payload original del proveedor. **Idempotencia** garantizada vía `provider_event_id`.
2. **`v2-webhook-to-domain` (Worker Normal)**: Lee webhooks no procesados y los normaliza. Escribe un `domain_event` e inserta el resultado (éxito o error) en `v2_ingest_attempts`. Cardinalidad garantizada `1:1`.
3. **`v2-webhook-to-domain?mode=dlq` (Worker DLQ)**: Lee vía consulta SQL los eventos registrados en `v2_ingest_attempts` como 'error', sin un domain event creado, menores a 10 reintentos y que cuenten con un cooldown de 10 min.
4. **`pg_cron` y `v2_cron_runs`**: Supabase dispara `run_dlq_reprocessor()` en Postgres cada 10 minutos. Esta función manda un request HTTP con `pg_net` al *Worker DLQ*. La tabla `v2_cron_runs` ofrece visibilidad directa si este job funcionó, para auditar silencios operativos (append-only).
5. **Capa Clínica (`v2_clinical_signals` / `v2_health_scores`)**: Se nutre de los Domain Events limpios para evaluar la fisiología de la tienda de forma inmutable.

> **Regla de Oro**: Jamás mutar la historia logueada en las tablas con formato append-only. Tampoco tocar payload bruto. Todo error debe remediarse actualizando la lógica en el Worker.
