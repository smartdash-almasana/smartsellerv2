# SmartSeller V2

Runtime clínico determinístico. Pipeline: webhook → domain_event → engine → score.

## Stack
- TypeScript · Next.js · Supabase JS · Postgres 17

## Setup
1. Completar `.env.local` con credenciales Supabase
2. `npm install`
3. `supabase db push`
4. `npm run dev`

## Arquitectura
Provider → v2_webhook_events → v2_domain_events → v2_engine_runs → v2_health_scores

## Pipeline (manual para demo)
1. POST /api/ingest         → persiste webhook de MercadoLibre
2. POST /api/normalize/:id  → normaliza webhook_event → domain_event
3. POST /api/engine/:store_id → corre engine RPC, produce score
4. GET  /api/score/:store_id  → lee score producido

## Schema
5 tablas base + 3 tablas engine. Migraciones en supabase/migrations/.
