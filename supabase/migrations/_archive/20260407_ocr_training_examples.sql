-- ============================================================
-- OCR Training Examples — Fase 1: Memoria Few-Shot
-- ============================================================
-- Cada extracción exitosa se guarda aquí como ejemplo de
-- referencia. N8N consulta esta tabla antes de procesar
-- una factura nueva para obtener few-shot context por
-- comercializadora.
-- ============================================================

create table if not exists public.ocr_training_examples (
    id              uuid primary key default gen_random_uuid(),

    -- Quién emitió la factura (normalizado a mayúsculas: "NATURGY", "ENDESA"…)
    company_name    text not null,

    -- Hash ligero para evitar duplicados exactos (nombre_archivo + agente + fecha)
    file_hash       text not null,

    -- Muestra de texto crudo enviado por N8N (primeros 1500 chars del PDF extraído)
    -- Nil si N8N no lo envía todavía — se rellena cuando N8N lo soporte
    raw_text_sample text,

    -- Campos tal como los devolvió el modelo de N8N (antes de normalizar)
    raw_fields      jsonb,

    -- Campos tras la normalización final en el callback (los que se guardan en ocr_jobs)
    extracted_fields jsonb not null,

    -- Correcciones manuales del agente (null hasta Fase 2)
    corrected_fields jsonb,

    -- true = validado manualmente por un agente (más peso en few-shot)
    is_validated    boolean not null default false,

    -- Media de confidence scores enviados por N8N (0-1)
    confidence_avg  numeric(4,3),

    -- Modelo N8N que generó la extracción (ej: "gpt-4o", "claude-haiku")
    n8n_model       text,

    -- Referencia al job original para auditoría
    ocr_job_id      uuid references public.ocr_jobs(id) on delete set null,

    franchise_id    uuid references public.franchises(id) on delete cascade,

    created_at      timestamptz not null default now()
);

-- Índice principal: búsqueda por comercializadora ordenada por fecha
create index if not exists idx_ocr_examples_company
    on public.ocr_training_examples (company_name, created_at desc);

-- Índice para evitar duplicados exactos
create unique index if not exists idx_ocr_examples_file_hash
    on public.ocr_training_examples (file_hash);

-- Índice para filtrar solo los validados manualmente
create index if not exists idx_ocr_examples_validated
    on public.ocr_training_examples (company_name, is_validated)
    where is_validated = true;

-- ── RLS ──────────────────────────────────────────────────────
alter table public.ocr_training_examples enable row level security;

-- El endpoint de N8N usa service role → bypassa RLS (lectura y escritura)
-- Los agentes autenticados pueden leer los ejemplos de su franquicia
create policy "agents_read_own_franchise_examples"
    on public.ocr_training_examples for select
    using (
        franchise_id in (
            select franchise_id from public.profiles
            where id = auth.uid()
        )
    );

-- Admin puede leer todos
create policy "admin_read_all_examples"
    on public.ocr_training_examples for select
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );
