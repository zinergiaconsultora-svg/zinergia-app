-- =============================================
-- FASE 1: PERFIL FISCAL + FACTURACIÓN
-- Ejecutar en: SQL Editor de Supabase
-- =============================================

-- 1. EXTENDER TABLA PROFILES CON DATOS FISCALES
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nif_cif TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fiscal_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fiscal_city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fiscal_province TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fiscal_postal_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fiscal_country TEXT DEFAULT 'España';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_type TEXT CHECK (company_type IN ('autonomo','sociedad_limitada','sociedad_anonima','cooperativa','otros'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'FAC';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invoice_next_number INTEGER DEFAULT 1;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS retention_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fiscal_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fiscal_verified_at TIMESTAMPTZ;

-- 2. CREAR TABLA INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES franchises(id),

    issuer_name TEXT NOT NULL,
    issuer_nif TEXT NOT NULL,
    issuer_address TEXT,
    issuer_city TEXT,
    issuer_postal_code TEXT,

    recipient_name TEXT NOT NULL,
    recipient_nif TEXT NOT NULL,
    recipient_address TEXT,
    recipient_city TEXT,
    recipient_postal_code TEXT,

    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    billing_period_start DATE,
    billing_period_end DATE,

    invoice_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    retention_total NUMERIC(10,2) DEFAULT 0,
    retention_percent NUMERIC(5,2) DEFAULT 0,
    tax_base NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_type TEXT DEFAULT 'IVA',
    tax_percent NUMERIC(5,2) DEFAULT 21.00,
    tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,

    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','cancelled')),
    paid_date DATE,
    payment_method TEXT CHECK (payment_method IN ('transferencia','bizum','efectivo','otros')),
    payment_reference TEXT,
    notes TEXT,
    pdf_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_agent ON invoices(agent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_franchise ON invoices(franchise_id);

-- 3. AÑADIR COLUMNA INVOICE_ID A NETWORK_COMMISSIONS
ALTER TABLE network_commissions ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);
ALTER TABLE network_commissions ADD COLUMN IF NOT EXISTS invoiced BOOLEAN DEFAULT FALSE;

-- 4. RLS PARA INVOICES
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent sees own invoices"
    ON invoices FOR SELECT
    USING (agent_id = auth.uid());

CREATE POLICY "Franchise sees agents invoices"
    ON invoices FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = agent_id AND parent_id = auth.uid()
        )
    );

CREATE POLICY "Admin sees all invoices"
    ON invoices FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admin manages all invoices"
    ON invoices FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Franchise manages agents invoices"
    ON invoices FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = agent_id AND parent_id = auth.uid()
        )
    );

-- 5. TRIGGER UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. FUNCIÓN PARA GENERAR NÚMERO DE FACTURA SECUENCIAL
CREATE OR REPLACE FUNCTION generate_invoice_number(p_agent_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_prefix TEXT;
    v_next INTEGER;
    v_year TEXT;
    v_number TEXT;
BEGIN
    SELECT invoice_prefix, invoice_next_number
    INTO v_prefix, v_next
    FROM profiles
    WHERE id = p_agent_id;

    IF v_prefix IS NULL THEN v_prefix := 'FAC'; END IF;
    IF v_next IS NULL THEN v_next := 1; END IF;

    v_year := EXTRACT(YEAR FROM NOW())::TEXT;

    v_number := v_prefix || '-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');

    UPDATE profiles
    SET invoice_next_number = v_next + 1
    WHERE id = p_agent_id;

    RETURN v_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. VERIFICACIÓN FINAL
SELECT
    'profiles' AS tabla,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
    AND column_name IN (
        'nif_cif','fiscal_address','fiscal_city','fiscal_province',
        'fiscal_postal_code','fiscal_country','iban','company_name',
        'company_type','invoice_prefix','invoice_next_number',
        'retention_percent','fiscal_verified','fiscal_verified_at'
    )
ORDER BY ordinal_position;

SELECT
    'invoices' AS tabla,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

SELECT
    'RLS policies' AS info,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'invoices'
ORDER BY policyname;