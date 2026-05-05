-- =============================================
-- DOCUMENTS — Gestión documental por cliente
-- =============================================

-- 1. Tabla de metadatos
CREATE TABLE IF NOT EXISTS client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES franchises(id),

    name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    size_bytes INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'otro' CHECK (category IN ('factura', 'contrato', 'dni', 'escritura', 'otro')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_client ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_docs_agent ON client_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_docs_franchise ON client_documents(franchise_id);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent manages own client documents"
    ON client_documents FOR ALL
    USING (
        agent_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM clients c
            WHERE c.id = client_documents.client_id
            AND c.owner_id = auth.uid()
        )
    );

CREATE POLICY "Franchise sees franchise documents"
    ON client_documents FOR SELECT
    USING (
        franchise_id IN (
            SELECT franchise_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admin manages all documents"
    ON client_documents FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP TRIGGER IF EXISTS docs_updated_at ON client_documents;
CREATE TRIGGER docs_updated_at
    BEFORE UPDATE ON client_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('client_documents', 'client_documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS Policies
-- Nota: La tabla es storage.objects y debemos filtrar por bucket_id = 'client_documents'
CREATE POLICY "Authenticated users can upload documents"
    ON storage.objects FOR INSERT
    WITH CHECK ( bucket_id = 'client_documents' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can update their documents"
    ON storage.objects FOR UPDATE
    USING ( bucket_id = 'client_documents' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can read documents"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'client_documents' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can delete documents"
    ON storage.objects FOR DELETE
    USING ( bucket_id = 'client_documents' AND auth.role() = 'authenticated' );

-- Verificación
SELECT
    'client_documents' AS tabla,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'client_documents'
ORDER BY ordinal_position;

SELECT
    'RLS - Tabla' AS info,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'client_documents'
ORDER BY policyname;
