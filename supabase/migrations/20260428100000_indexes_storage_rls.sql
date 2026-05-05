-- ============================================================
-- Performance indexes + Storage RLS security fix
-- ============================================================

-- ═══════════════════════════════════════════
-- 1. CRITICAL: proposals — agent_id sin índice
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_proposals_agent_id
    ON proposals(agent_id);

CREATE INDEX IF NOT EXISTS idx_proposals_agent_created
    ON proposals(agent_id, created_at DESC);

-- ═══════════════════════════════════════════
-- 2. CRITICAL: ocr_jobs — cero índices
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_agent_id
    ON ocr_jobs(agent_id);

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_agent_status_created
    ON ocr_jobs(agent_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_client_status
    ON ocr_jobs(client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status
    ON ocr_jobs(status);

-- ═══════════════════════════════════════════
-- 3. HIGH: contracts — proposal_id (idempotencia)
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_contracts_proposal_id
    ON contracts(proposal_id);

CREATE INDEX IF NOT EXISTS idx_contracts_agent_status_enddate
    ON contracts(agent_id, status, end_date)
    WHERE status = 'active';

-- ═══════════════════════════════════════════
-- 4. HIGH: network_commissions — franchise + invoiced
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_commissions_franchise_id
    ON network_commissions(franchise_id);

CREATE INDEX IF NOT EXISTS idx_commissions_agent_status_invoiced
    ON network_commissions(agent_id, status, invoiced)
    WHERE invoiced = false;

CREATE INDEX IF NOT EXISTS idx_commissions_created_at
    ON network_commissions(created_at DESC);

-- ═══════════════════════════════════════════
-- 5. HIGH: notifications — unread lookup
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON notifications(user_id, read)
    WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(user_id, created_at DESC);

-- ═══════════════════════════════════════════
-- 6. MEDIUM: tasks — due date ordering
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_tasks_agent_duedate
    ON tasks(agent_id, due_date ASC)
    WHERE status IN ('pending', 'in_progress');

-- ═══════════════════════════════════════════
-- 7. MEDIUM: client_activities — franchise feed
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_activities_franchise_created
    ON client_activities(franchise_id, created_at DESC);

-- ═══════════════════════════════════════════
-- 8. MEDIUM: proposals — smart alerts compound
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_proposals_agent_status_updated
    ON proposals(agent_id, status, updated_at DESC);

-- ═══════════════════════════════════════════
-- 9. SECURITY: Storage RLS — reemplazar policies
--    abiertas por policies con ownership check
-- ═══════════════════════════════════════════

-- Eliminar policies inseguras
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;

-- Upload: solo si el agent es owner del cliente (via client_documents) o admin/franchise
CREATE POLICY "Upload own client documents"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'client_documents'
        AND auth.role() = 'authenticated'
        AND (
            -- El agent es dueño del cliente (owner_id en clients)
            EXISTS (
                SELECT 1 FROM client_documents cd
                JOIN clients c ON c.id = cd.client_id
                WHERE cd.file_path = storage.objects.name
                AND c.owner_id = auth.uid()
            )
            -- O es admin/franchise
            OR EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid() AND role IN ('admin', 'franchise')
            )
            -- Permite si el path empieza con un client_id propiedad del usuario
            OR EXISTS (
                SELECT 1 FROM clients c
                WHERE c.id = split_part(storage.objects.name, '/', 1)::uuid
                AND (c.owner_id = auth.uid()
                     OR c.franchise_id = (SELECT franchise_id FROM profiles WHERE id = auth.uid()))
            )
        )
    );

-- Read: solo si el agent es owner, o admin/franchise de la franquicia
CREATE POLICY "Read own client documents"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'client_documents'
        AND (
            -- Owner del cliente
            EXISTS (
                SELECT 1 FROM clients c
                WHERE c.id = split_part(storage.objects.name, '/', 1)::uuid
                AND c.owner_id = auth.uid()
            )
            -- Admin/franchise de la franquicia del cliente
            OR EXISTS (
                SELECT 1 FROM clients c
                JOIN profiles p ON p.franchise_id = c.franchise_id
                WHERE c.id = split_part(storage.objects.name, '/', 1)::uuid
                AND p.id = auth.uid()
                AND p.role IN ('admin', 'franchise')
            )
            -- Admin global
            OR EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid() AND role = 'admin'
            )
        )
    );

-- Update: mismo criterio que read
CREATE POLICY "Update own client documents"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'client_documents'
        AND (
            EXISTS (
                SELECT 1 FROM clients c
                WHERE c.id = split_part(storage.objects.name, '/', 1)::uuid
                AND c.owner_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid() AND role IN ('admin', 'franchise')
            )
        )
    );

-- Delete: mismo criterio que read
CREATE POLICY "Delete own client documents"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'client_documents'
        AND (
            EXISTS (
                SELECT 1 FROM clients c
                WHERE c.id = split_part(storage.objects.name, '/', 1)::uuid
                AND c.owner_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid() AND role IN ('admin', 'franchise')
            )
        )
    );
