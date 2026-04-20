-- =====================================================================
-- BASELINE MIGRATION — Zinergia
-- =====================================================================
-- Generated: 2026-04-20
-- Source:    pg_dump --schema-only --schema=public --no-owner --no-privileges
--            against production (proyectozinergia, eu-central-1)
-- Purpose:   Snapshot of the full production schema as of 2026-04-20.
--            From this point forward, ALL schema changes must go through
--            a new migration file in this directory. NO manual edits on
--            the Supabase dashboard.
--
-- Scope: 24 tables, 58 RLS policies, 9 functions, 11 triggers, 41 indexes.
-- Schema: public (auth, storage, realtime are managed by Supabase).
--
-- Previous migrations (pre-baseline) are archived in ./_archive/ for
-- historical reference only — they are already subsumed by this file.
-- =====================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: get_dashboard_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_stats(p_franchise_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_now         timestamptz := NOW();
  v_month_start timestamptz := DATE_TRUNC('month', NOW());
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      -- Financials (single pass over proposals)
      'total_detected',    COALESCE(SUM(annual_savings), 0),
      'secured',           COALESCE(SUM(annual_savings) FILTER (WHERE status = 'accepted'), 0),
      'pipeline',          COALESCE(SUM(annual_savings) FILTER (WHERE status IN ('sent', 'draft')), 0),
      'accepted_count',    COUNT(*) FILTER (WHERE status = 'accepted'),
      'total_count',       COUNT(*),
      'month_savings',     COALESCE(SUM(annual_savings) FILTER (WHERE created_at >= v_month_start), 0),
      'conversion_rate',   CASE WHEN COUNT(*) > 0
                                THEN ROUND((COUNT(*) FILTER (WHERE status = 'accepted'))::numeric / COUNT(*) * 100)
                                ELSE 0 END,

      -- Recent proposals (top 5, latest first)
      'recent_proposals', (
        SELECT COALESCE(jsonb_agg(r ORDER BY r.created_at DESC), '[]'::jsonb)
        FROM (
          SELECT p2.id,
                 p2.annual_savings,
                 p2.status,
                 p2.created_at,
                 COALESCE(c.name, 'Cliente') AS client_name
          FROM   proposals p2
          LEFT JOIN clients c ON c.id = p2.client_id
          WHERE  p2.franchise_id = p_franchise_id
          ORDER  BY p2.created_at DESC
          LIMIT  5
        ) r
      ),

      -- Savings trend: last 7 months, one row per month
      'savings_trend', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object('name', month_name, 'value', total_savings)
          ORDER BY month_start
        ), '[]'::jsonb)
        FROM (
          SELECT DATE_TRUNC('month', created_at) AS month_start,
                 TO_CHAR(DATE_TRUNC('month', created_at), 'Mon')   AS month_name,
                 COALESCE(SUM(annual_savings), 0)                  AS total_savings
          FROM   proposals
          WHERE  franchise_id = p_franchise_id
            AND  created_at >= DATE_TRUNC('month', NOW() - INTERVAL '6 months')
          GROUP  BY 1, 2
        ) t
      )
    )
    FROM proposals
    WHERE franchise_id = p_franchise_id
  );
END;
$$;


--
-- Name: get_my_franchise_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_franchise_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT franchise_id FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: get_my_parent_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_parent_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT parent_id
  FROM profiles
  WHERE id = auth.uid();
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
        'agent'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;
    RETURN new;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;


--
-- Name: is_superadmin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_superadmin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    );
$$;


--
-- Name: update_billing_cycles_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_billing_cycles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: academy_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.academy_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'training'::text NOT NULL,
    file_url text NOT NULL,
    file_type text DEFAULT 'pdf'::text,
    role_restriction text DEFAULT 'agent'::text NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT academy_resources_category_check CHECK ((category = ANY (ARRAY['training'::text, 'contract'::text, 'marketing'::text]))),
    CONSTRAINT academy_resources_file_type_check CHECK ((file_type = ANY (ARRAY['pdf'::text, 'video'::text, 'link'::text]))),
    CONSTRAINT academy_resources_role_restriction_check CHECK ((role_restriction = ANY (ARRAY['agent'::text, 'franchise'::text, 'admin'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    old_data jsonb,
    new_data jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: billing_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    franchise_id uuid NOT NULL,
    month_year text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    total_commissions numeric DEFAULT 0 NOT NULL,
    total_proposals integer DEFAULT 0 NOT NULL,
    snapshot_data jsonb,
    closed_by uuid,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT billing_cycles_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'voided'::text])))
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    franchise_id uuid,
    name text NOT NULL,
    email text,
    phone text,
    notes text,
    lead_source text,
    last_contact_date date,
    status text DEFAULT 'new'::text,
    average_monthly_bill numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cups text,
    current_supplier text,
    tariff_type text,
    contracted_power jsonb,
    city text,
    zip_code text,
    latitude numeric,
    longitude numeric,
    type text DEFAULT 'residential'::text NOT NULL,
    address text,
    dni_cif text,
    CONSTRAINT clients_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'in_process'::text, 'won'::text, 'lost'::text])))
);


--
-- Name: commission_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    commission_rate numeric(5,4) DEFAULT 0.15 NOT NULL,
    agent_share numeric(5,4) DEFAULT 0.30 NOT NULL,
    franchise_share numeric(5,4) DEFAULT 0.50 NOT NULL,
    hq_share numeric(5,4) DEFAULT 0.20 NOT NULL,
    collaborator_pct numeric(5,4) DEFAULT 0.50 NOT NULL,
    points_per_win integer DEFAULT 50 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shares_sum_to_one CHECK ((round(((agent_share + franchise_share) + hq_share), 4) = 1.0)),
    CONSTRAINT valid_agent_share CHECK (((agent_share > (0)::numeric) AND (agent_share < (1)::numeric))),
    CONSTRAINT valid_collaborator_pct CHECK (((collaborator_pct >= (0)::numeric) AND (collaborator_pct <= (1)::numeric))),
    CONSTRAINT valid_commission_rate CHECK (((commission_rate > (0)::numeric) AND (commission_rate <= (1)::numeric))),
    CONSTRAINT valid_franchise_share CHECK (((franchise_share > (0)::numeric) AND (franchise_share < (1)::numeric))),
    CONSTRAINT valid_hq_share CHECK (((hq_share > (0)::numeric) AND (hq_share < (1)::numeric)))
);


--
-- Name: COLUMN commission_rules.collaborator_pct; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.commission_rules.collaborator_pct IS 'Fracción de la comisión bruta (tariff_commissions) que se abona al colaborador. Ej: 0.50 = el colaborador recibe el 50% de la comisión de la comercializadora.';


--
-- Name: commission_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_tracking (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    proposal_id uuid,
    agent_id uuid,
    franchise_id uuid,
    commission_amount numeric NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    paid_date date,
    notes text,
    CONSTRAINT commission_tracking_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text, 'rejected'::text])))
);


--
-- Name: dashboard_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_preferences (
    user_id uuid NOT NULL,
    widgets jsonb DEFAULT '[]'::jsonb,
    theme text DEFAULT 'light'::text,
    language text DEFAULT 'es'::text,
    date_format text DEFAULT 'DD/MM/YYYY'::text,
    currency text DEFAULT 'EUR'::text,
    notifications_enabled boolean DEFAULT true,
    email_alerts boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: empresas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresas (
    user_id uuid NOT NULL,
    nif character varying(20) NOT NULL,
    nombre character varying(255) NOT NULL,
    direccion text,
    municipio character varying(100),
    provincia character varying(100),
    cp character varying(20),
    pais character varying(50) DEFAULT 'ES'::character varying,
    cert_path text,
    cert_password text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: franchise_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.franchise_config (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    franchise_id uuid NOT NULL,
    company_name text,
    royalty_percent numeric DEFAULT 10.0,
    entry_fee numeric DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: network_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.network_commissions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    proposal_id uuid,
    agent_id uuid,
    franchise_id uuid,
    agent_commission numeric NOT NULL,
    franchise_commission numeric NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    paid_date date,
    billing_cycle_id uuid,
    CONSTRAINT network_commissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text, 'rejected'::text])))
);


--
-- Name: franchise_wallet; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.franchise_wallet AS
 SELECT franchise_id,
    COALESCE(sum(
        CASE
            WHEN (status = 'cleared'::text) THEN franchise_commission
            ELSE (0)::numeric
        END), (0)::numeric) AS balance_available,
    COALESCE(sum(
        CASE
            WHEN (status = 'paid'::text) THEN franchise_commission
            ELSE (0)::numeric
        END), (0)::numeric) AS balance_paid,
    COALESCE(sum(
        CASE
            WHEN (status = 'pending'::text) THEN franchise_commission
            ELSE (0)::numeric
        END), (0)::numeric) AS balance_pending,
    COALESCE(sum(
        CASE
            WHEN (status <> 'rejected'::text) THEN franchise_commission
            ELSE (0)::numeric
        END), (0)::numeric) AS total_earned,
    count(
        CASE
            WHEN (status = 'cleared'::text) THEN 1
            ELSE NULL::integer
        END) AS proposals_cleared,
    count(
        CASE
            WHEN (status = 'paid'::text) THEN 1
            ELSE NULL::integer
        END) AS proposals_paid,
    count(
        CASE
            WHEN (status = 'pending'::text) THEN 1
            ELSE NULL::integer
        END) AS proposals_pending
   FROM public.network_commissions nc
  GROUP BY franchise_id;


--
-- Name: franchises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.franchises (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: lv_zinergia_tarifas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lv_zinergia_tarifas (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    company text NOT NULL,
    tariff_name text NOT NULL,
    tariff_type text,
    offer_type text DEFAULT 'fixed'::text,
    contract_duration text DEFAULT '12 meses'::text,
    power_price_p1 numeric DEFAULT 0 NOT NULL,
    power_price_p2 numeric DEFAULT 0 NOT NULL,
    power_price_p3 numeric DEFAULT 0 NOT NULL,
    power_price_p4 numeric DEFAULT 0 NOT NULL,
    power_price_p5 numeric DEFAULT 0 NOT NULL,
    power_price_p6 numeric DEFAULT 0 NOT NULL,
    energy_price_p1 numeric DEFAULT 0 NOT NULL,
    energy_price_p2 numeric DEFAULT 0 NOT NULL,
    energy_price_p3 numeric DEFAULT 0 NOT NULL,
    energy_price_p4 numeric DEFAULT 0 NOT NULL,
    energy_price_p5 numeric DEFAULT 0 NOT NULL,
    energy_price_p6 numeric DEFAULT 0 NOT NULL,
    connection_fee numeric DEFAULT 0,
    fixed_fee numeric DEFAULT 0,
    logo_color text DEFAULT 'bg-slate-600'::text,
    description text,
    is_active boolean DEFAULT true,
    supply_type text DEFAULT 'electricity'::text NOT NULL,
    modelo text,
    tipo_cliente text DEFAULT 'PYME'::text NOT NULL,
    codigo_producto text,
    consumption_min_kwh numeric DEFAULT 0 NOT NULL,
    consumption_max_kwh numeric DEFAULT '9999999999'::bigint NOT NULL,
    fixed_annual_fee_gas numeric DEFAULT 0 NOT NULL,
    variable_price_kwh_gas numeric DEFAULT 0 NOT NULL,
    notes text,
    CONSTRAINT chk_supply_type CHECK ((supply_type = ANY (ARRAY['electricity'::text, 'gas'::text]))),
    CONSTRAINT chk_tipo_cliente CHECK ((tipo_cliente = ANY (ARRAY['PYME'::text, 'RESIDENCIAL'::text, 'GRAN_CUENTA'::text]))),
    CONSTRAINT lv_zinergia_tarifas_offer_type_check CHECK ((offer_type = ANY (ARRAY['fixed'::text, 'indexed'::text])))
);


--
-- Name: COLUMN lv_zinergia_tarifas.supply_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lv_zinergia_tarifas.supply_type IS 'Tipo de suministro: electricity (luz) | gas.';


--
-- Name: COLUMN lv_zinergia_tarifas.modelo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lv_zinergia_tarifas.modelo IS 'Canal de venta / tier del producto: BASE, ONE, SUPRA. NULL = sin distinción de modelo.';


--
-- Name: COLUMN lv_zinergia_tarifas.fixed_annual_fee_gas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lv_zinergia_tarifas.fixed_annual_fee_gas IS 'Gas: término fijo anual en €/año (equivale al término de abono).';


--
-- Name: COLUMN lv_zinergia_tarifas.variable_price_kwh_gas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lv_zinergia_tarifas.variable_price_kwh_gas IS 'Gas: término variable en €/kWh consumido.';


--
-- Name: network_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.network_invitations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    creator_id uuid NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    code text NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    CONSTRAINT chk_valid_invitation_role CHECK ((role = ANY (ARRAY['agent'::text, 'franchise'::text]))),
    CONSTRAINT network_invitations_role_check CHECK ((role = ANY (ARRAY['franchise'::text, 'agent'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text,
    link text,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text])))
);


--
-- Name: ocr_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ocr_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    franchise_id uuid,
    agent_id uuid,
    client_id uuid,
    file_name text NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    attempts integer DEFAULT 1 NOT NULL,
    error_message text,
    extracted_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    file_path text,
    CONSTRAINT ocr_jobs_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: ocr_training_examples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ocr_training_examples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    file_hash text NOT NULL,
    raw_text_sample text,
    raw_fields jsonb,
    extracted_fields jsonb NOT NULL,
    corrected_fields jsonb,
    is_validated boolean DEFAULT false NOT NULL,
    confidence_avg numeric(4,3),
    n8n_model text,
    ocr_job_id uuid,
    franchise_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    franchise_id uuid,
    marketer_name text NOT NULL,
    tariff_name text NOT NULL,
    description text,
    contract_duration text,
    logo_color text,
    type text DEFAULT 'fixed'::text,
    power_price jsonb DEFAULT '{}'::jsonb,
    energy_price jsonb DEFAULT '{}'::jsonb,
    fixed_fee numeric DEFAULT 0,
    is_active boolean DEFAULT true,
    CONSTRAINT offers_type_check CHECK ((type = ANY (ARRAY['fixed'::text, 'indexed'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    phone text,
    bio text,
    timezone text DEFAULT 'Europe/Madrid'::text,
    role text DEFAULT 'agent'::text,
    parent_id uuid,
    franchise_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'franchise'::text, 'agent'::text])))
);


--
-- Name: proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    franchise_id uuid,
    status text DEFAULT 'draft'::text,
    created_at timestamp with time zone DEFAULT now(),
    sent_date date,
    accepted_date date,
    rejected_date date,
    rejection_reason text,
    probability_score integer DEFAULT 50,
    offer_snapshot jsonb NOT NULL,
    calculation_data jsonb NOT NULL,
    current_annual_cost numeric NOT NULL,
    offer_annual_cost numeric NOT NULL,
    annual_savings numeric NOT NULL,
    savings_percent numeric NOT NULL,
    optimization_result jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    followup_3d_at timestamp with time zone,
    followup_7d_at timestamp with time zone,
    agent_id uuid,
    aletheia_summary jsonb,
    CONSTRAINT proposals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'rejected'::text, 'expired'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text,
    auth text,
    subscription_json jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tariff_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tariff_commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company text NOT NULL,
    modelo text,
    supply_type text DEFAULT 'electricity'::text NOT NULL,
    tipo_cliente text DEFAULT 'PYME'::text NOT NULL,
    producto_tipo text,
    consumption_min_mwh numeric DEFAULT 0 NOT NULL,
    consumption_max_mwh numeric DEFAULT '9999999999'::bigint NOT NULL,
    commission_fixed_eur numeric DEFAULT 0 NOT NULL,
    commission_variable_mwh numeric DEFAULT 0 NOT NULL,
    servicio text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT tariff_commissions_supply_type_check CHECK ((supply_type = ANY (ARRAY['electricity'::text, 'gas'::text]))),
    CONSTRAINT tariff_commissions_tipo_cliente_check CHECK ((tipo_cliente = ANY (ARRAY['PYME'::text, 'RESIDENCIAL'::text, 'GRAN_CUENTA'::text])))
);


--
-- Name: TABLE tariff_commissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tariff_commissions IS 'Comisiones brutas que paga cada comercializadora a Zinergia por contrato firmado. El reparto con el colaborador se gestiona en commission_rules.collaborator_pct.';


--
-- Name: tax_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_parameters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    key text NOT NULL,
    value numeric NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE tax_parameters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tax_parameters IS 'Parámetros fiscales (IEE, IVA, IGIC) editables por el admin sin tocar código.';


--
-- Name: user_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_points (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    points integer DEFAULT 0,
    level text DEFAULT 'bronze'::text,
    badges jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_points_level_check CHECK ((level = ANY (ARRAY['bronze'::text, 'silver'::text, 'gold'::text, 'platinum'::text])))
);


--
-- Name: v_active_tariffs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_active_tariffs AS
 SELECT id,
    company,
    tariff_name,
    tariff_type,
    offer_type,
    contract_duration,
    logo_color,
    power_price_p1,
    power_price_p2,
    power_price_p3,
    power_price_p4,
    power_price_p5,
    power_price_p6,
    energy_price_p1,
    energy_price_p2,
    energy_price_p3,
    energy_price_p4,
    energy_price_p5,
    energy_price_p6,
    connection_fee,
    fixed_fee,
    updated_at
   FROM public.lv_zinergia_tarifas
  WHERE (is_active = true)
  ORDER BY company, tariff_name;


--
-- Name: v_franchise_client_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_franchise_client_stats AS
 SELECT f.id AS franchise_id,
    f.full_name AS company_name,
    count(DISTINCT c.id) AS total_clients,
    count(DISTINCT c.id) FILTER (WHERE (c.status = 'won'::text)) AS active_clients,
    count(DISTINCT c.id) FILTER (WHERE (c.status = ANY (ARRAY['new'::text, 'contacted'::text, 'in_process'::text]))) AS pending_clients,
    count(DISTINCT c.id) FILTER (WHERE (c.status = 'new'::text)) AS new_clients,
    sum(c.average_monthly_bill) FILTER (WHERE (c.status = 'won'::text)) AS total_monthly_revenue
   FROM (public.profiles f
     LEFT JOIN public.clients c ON ((c.franchise_id = f.id)))
  WHERE ((f.role = 'franchise'::text) OR (f.role = 'admin'::text))
  GROUP BY f.id, f.full_name
  ORDER BY (count(DISTINCT c.id)) DESC;


--
-- Name: v_proposal_funnel; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_proposal_funnel AS
 SELECT status,
    count(*) AS count,
    sum(annual_savings) AS total_savings,
    avg(annual_savings) AS avg_savings,
    count(DISTINCT franchise_id) AS franchises_involved
   FROM public.proposals p
  WHERE (created_at >= (now() - '30 days'::interval))
  GROUP BY status
  ORDER BY
        CASE status
            WHEN 'draft'::text THEN 1
            WHEN 'sent'::text THEN 2
            WHEN 'accepted'::text THEN 3
            WHEN 'rejected'::text THEN 4
            WHEN 'expired'::text THEN 5
            ELSE NULL::integer
        END;


--
-- Name: v_tariff_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_tariff_stats AS
 SELECT tariff_type,
    offer_type,
    count(*) AS total_tariffs,
    count(*) FILTER (WHERE (is_active = true)) AS active_tariffs,
    avg(power_price_p1) AS avg_power_p1,
    avg(energy_price_p1) AS avg_energy_p1,
    avg(connection_fee) AS avg_connection_fee
   FROM public.lv_zinergia_tarifas
  GROUP BY tariff_type, offer_type
  ORDER BY tariff_type, offer_type;


--
-- Name: verifactu_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifactu_invoices (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    ejercicio integer NOT NULL,
    periodo integer NOT NULL,
    estado character varying(50) DEFAULT 'pendiente'::character varying,
    huella text,
    fecha_generacion timestamp with time zone DEFAULT now(),
    xml_generado text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: academy_resources academy_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academy_resources
    ADD CONSTRAINT academy_resources_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: billing_cycles billing_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_cycles
    ADD CONSTRAINT billing_cycles_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: commission_rules commission_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_pkey PRIMARY KEY (id);


--
-- Name: commission_tracking commission_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_tracking
    ADD CONSTRAINT commission_tracking_pkey PRIMARY KEY (id);


--
-- Name: dashboard_preferences dashboard_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_preferences
    ADD CONSTRAINT dashboard_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (user_id);


--
-- Name: franchise_config franchise_config_franchise_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchise_config
    ADD CONSTRAINT franchise_config_franchise_id_key UNIQUE (franchise_id);


--
-- Name: franchise_config franchise_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchise_config
    ADD CONSTRAINT franchise_config_pkey PRIMARY KEY (id);


--
-- Name: franchises franchises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchises
    ADD CONSTRAINT franchises_pkey PRIMARY KEY (id);


--
-- Name: franchises franchises_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchises
    ADD CONSTRAINT franchises_slug_key UNIQUE (slug);


--
-- Name: lv_zinergia_tarifas lv_zinergia_tarifas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lv_zinergia_tarifas
    ADD CONSTRAINT lv_zinergia_tarifas_pkey PRIMARY KEY (id);


--
-- Name: network_commissions network_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_commissions
    ADD CONSTRAINT network_commissions_pkey PRIMARY KEY (id);


--
-- Name: network_commissions network_commissions_proposal_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_commissions
    ADD CONSTRAINT network_commissions_proposal_id_key UNIQUE (proposal_id);


--
-- Name: network_invitations network_invitations_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_invitations
    ADD CONSTRAINT network_invitations_code_key UNIQUE (code);


--
-- Name: network_invitations network_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_invitations
    ADD CONSTRAINT network_invitations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: ocr_jobs ocr_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_jobs
    ADD CONSTRAINT ocr_jobs_pkey PRIMARY KEY (id);


--
-- Name: ocr_training_examples ocr_training_examples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_training_examples
    ADD CONSTRAINT ocr_training_examples_pkey PRIMARY KEY (id);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: tariff_commissions tariff_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tariff_commissions
    ADD CONSTRAINT tariff_commissions_pkey PRIMARY KEY (id);


--
-- Name: tax_parameters tax_parameters_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_parameters
    ADD CONSTRAINT tax_parameters_key_key UNIQUE (key);


--
-- Name: tax_parameters tax_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_parameters
    ADD CONSTRAINT tax_parameters_pkey PRIMARY KEY (id);


--
-- Name: billing_cycles unique_franchise_cycle; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_cycles
    ADD CONSTRAINT unique_franchise_cycle UNIQUE (franchise_id, month_year);


--
-- Name: user_points user_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_pkey PRIMARY KEY (id);


--
-- Name: user_points user_points_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_user_id_key UNIQUE (user_id);


--
-- Name: verifactu_invoices verifactu_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifactu_invoices
    ADD CONSTRAINT verifactu_invoices_pkey PRIMARY KEY (id);


--
-- Name: commission_rules_single_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commission_rules_single_active ON public.commission_rules USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_academy_resources_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_academy_resources_published ON public.academy_resources USING btree (is_published, category);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_table_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_table_name ON public.audit_logs USING btree (table_name);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_billing_cycles_franchise; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_cycles_franchise ON public.billing_cycles USING btree (franchise_id);


--
-- Name: idx_billing_cycles_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_cycles_month ON public.billing_cycles USING btree (month_year DESC);


--
-- Name: idx_billing_cycles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_cycles_status ON public.billing_cycles USING btree (status);


--
-- Name: idx_clients_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_created_at ON public.clients USING btree (created_at DESC);


--
-- Name: idx_clients_cups; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_cups ON public.clients USING btree (cups);


--
-- Name: idx_clients_franchise_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_franchise_id ON public.clients USING btree (franchise_id);


--
-- Name: idx_clients_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_owner_id ON public.clients USING btree (owner_id);


--
-- Name: idx_clients_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_status ON public.clients USING btree (status);


--
-- Name: idx_commissions_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_agent_id ON public.network_commissions USING btree (agent_id);


--
-- Name: idx_commissions_billing_cycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_billing_cycle ON public.network_commissions USING btree (billing_cycle_id);


--
-- Name: idx_commissions_proposal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_proposal_id ON public.network_commissions USING btree (proposal_id);


--
-- Name: idx_commissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commissions_status ON public.network_commissions USING btree (status);


--
-- Name: idx_invitations_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_expires_at ON public.network_invitations USING btree (expires_at);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_ocr_examples_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ocr_examples_company ON public.ocr_training_examples USING btree (company_name, created_at DESC);


--
-- Name: idx_ocr_examples_file_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ocr_examples_file_hash ON public.ocr_training_examples USING btree (file_hash);


--
-- Name: idx_ocr_examples_validated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ocr_examples_validated ON public.ocr_training_examples USING btree (company_name, is_validated) WHERE (is_validated = true);


--
-- Name: idx_proposals_annual_savings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_annual_savings ON public.proposals USING btree (annual_savings DESC);


--
-- Name: idx_proposals_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_client_id ON public.proposals USING btree (client_id);


--
-- Name: idx_proposals_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_created_at ON public.proposals USING btree (created_at DESC);


--
-- Name: idx_proposals_franchise_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_franchise_id ON public.proposals USING btree (franchise_id);


--
-- Name: idx_proposals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proposals_status ON public.proposals USING btree (status);


--
-- Name: idx_push_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_tarifas_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarifas_active ON public.lv_zinergia_tarifas USING btree (is_active);


--
-- Name: idx_tarifas_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarifas_company ON public.lv_zinergia_tarifas USING btree (company);


--
-- Name: idx_tarifas_offer_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarifas_offer_type ON public.lv_zinergia_tarifas USING btree (offer_type);


--
-- Name: idx_tarifas_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tarifas_type ON public.lv_zinergia_tarifas USING btree (tariff_type);


--
-- Name: idx_tc_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tc_active ON public.tariff_commissions USING btree (is_active);


--
-- Name: idx_tc_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tc_company ON public.tariff_commissions USING btree (company);


--
-- Name: idx_tc_supply; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tc_supply ON public.tariff_commissions USING btree (supply_type);


--
-- Name: idx_user_points_points; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_points_points ON public.user_points USING btree (points DESC);


--
-- Name: idx_user_points_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_points_user_id ON public.user_points USING btree (user_id);


--
-- Name: unique_tariff_commission; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_tariff_commission ON public.tariff_commissions USING btree (company, COALESCE(modelo, ''::text), supply_type, tipo_cliente, COALESCE(producto_tipo, ''::text), consumption_min_mwh);


--
-- Name: unique_tariff_v2; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_tariff_v2 ON public.lv_zinergia_tarifas USING btree (company, tariff_name, tariff_type, COALESCE(modelo, ''::text));


--
-- Name: academy_resources handle_updated_at_academy_resources; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_academy_resources BEFORE UPDATE ON public.academy_resources FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: ocr_jobs handle_updated_at_ocr_jobs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_ocr_jobs BEFORE UPDATE ON public.ocr_jobs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: push_subscriptions handle_updated_at_push_subscriptions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_push_subscriptions BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: billing_cycles tr_billing_cycles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_billing_cycles_updated_at BEFORE UPDATE ON public.billing_cycles FOR EACH ROW EXECUTE FUNCTION public.update_billing_cycles_updated_at();


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: dashboard_preferences update_dashboard_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_dashboard_preferences_updated_at BEFORE UPDATE ON public.dashboard_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lv_zinergia_tarifas update_lv_zinergia_tarifas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lv_zinergia_tarifas_updated_at BEFORE UPDATE ON public.lv_zinergia_tarifas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: proposals update_proposals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tariff_commissions update_tariff_commissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tariff_commissions_updated_at BEFORE UPDATE ON public.tariff_commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_points update_user_points_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_points_updated_at BEFORE UPDATE ON public.user_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: billing_cycles billing_cycles_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_cycles
    ADD CONSTRAINT billing_cycles_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.profiles(id);


--
-- Name: billing_cycles billing_cycles_franchise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_cycles
    ADD CONSTRAINT billing_cycles_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: clients clients_franchise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.franchises(id) ON DELETE SET NULL;


--
-- Name: clients clients_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: commission_rules commission_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: commission_tracking commission_tracking_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_tracking
    ADD CONSTRAINT commission_tracking_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.profiles(id);


--
-- Name: commission_tracking commission_tracking_franchise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_tracking
    ADD CONSTRAINT commission_tracking_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.profiles(id);


--
-- Name: commission_tracking commission_tracking_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_tracking
    ADD CONSTRAINT commission_tracking_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: dashboard_preferences dashboard_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_preferences
    ADD CONSTRAINT dashboard_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: empresas empresas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: franchise_config franchise_config_franchise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.franchise_config
    ADD CONSTRAINT franchise_config_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.profiles(id);


--
-- Name: network_commissions network_commissions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_commissions
    ADD CONSTRAINT network_commissions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.profiles(id);


--
-- Name: network_commissions network_commissions_billing_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_commissions
    ADD CONSTRAINT network_commissions_billing_cycle_id_fkey FOREIGN KEY (billing_cycle_id) REFERENCES public.billing_cycles(id);


--
-- Name: network_commissions network_commissions_franchise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_commissions
    ADD CONSTRAINT network_commissions_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.profiles(id);


--
-- Name: network_commissions network_commissions_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_commissions
    ADD CONSTRAINT network_commissions_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: network_invitations network_invitations_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_invitations
    ADD CONSTRAINT network_invitations_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: ocr_jobs ocr_jobs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_jobs
    ADD CONSTRAINT ocr_jobs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ocr_jobs ocr_jobs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_jobs
    ADD CONSTRAINT ocr_jobs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: ocr_jobs ocr_jobs_franchise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_jobs
    ADD CONSTRAINT ocr_jobs_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.franchises(id) ON DELETE CASCADE;


--
-- Name: ocr_training_examples ocr_training_examples_franchise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_training_examples
    ADD CONSTRAINT ocr_training_examples_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.franchises(id) ON DELETE CASCADE;


--
-- Name: ocr_training_examples ocr_training_examples_ocr_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ocr_training_examples
    ADD CONSTRAINT ocr_training_examples_ocr_job_id_fkey FOREIGN KEY (ocr_job_id) REFERENCES public.ocr_jobs(id) ON DELETE SET NULL;


--
-- Name: offers offers_franchise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.franchises(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.profiles(id);


--
-- Name: proposals proposals_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES auth.users(id);


--
-- Name: proposals proposals_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_franchise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_franchise_id_fkey FOREIGN KEY (franchise_id) REFERENCES public.franchises(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_points user_points_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_points
    ADD CONSTRAINT user_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: verifactu_invoices verifactu_invoices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifactu_invoices
    ADD CONSTRAINT verifactu_invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: commission_rules Admin and franchise can manage commission rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin and franchise can manage commission rules" ON public.commission_rules USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'franchise'::text]))))));


--
-- Name: profiles Admin sees all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin sees all" ON public.profiles FOR SELECT USING (public.is_admin());


--
-- Name: tariff_commissions Admins can manage commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage commissions" ON public.tariff_commissions USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: franchises Admins can manage franchises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage franchises" ON public.franchises USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: lv_zinergia_tarifas Admins can manage tariffs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage tariffs" ON public.lv_zinergia_tarifas USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: tax_parameters Admins can manage tax params; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage tax params" ON public.tax_parameters USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: audit_logs Admins can see all audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can see all audit logs" ON public.audit_logs USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: network_invitations Anyone can validate unexpired invitation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can validate unexpired invitation" ON public.network_invitations FOR SELECT USING (((used = false) AND (expires_at > now())));


--
-- Name: tariff_commissions Authenticated can read active commissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can read active commissions" ON public.tariff_commissions FOR SELECT USING (((auth.uid() IS NOT NULL) AND (is_active = true)));


--
-- Name: tax_parameters Authenticated can read tax params; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can read tax params" ON public.tax_parameters FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: lv_zinergia_tarifas Authenticated users can view active tariffs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view active tariffs" ON public.lv_zinergia_tarifas FOR SELECT USING (((auth.uid() IS NOT NULL) AND (is_active = true)));


--
-- Name: profiles Franchises can see their agents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Franchises can see their agents" ON public.profiles FOR SELECT USING (((auth.uid() = parent_id) OR (id = public.get_my_parent_id())));


--
-- Name: network_invitations Only admin and franchise can create invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admin and franchise can create invitations" ON public.network_invitations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'franchise'::text]))))));


--
-- Name: franchises Public can view franchises; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view franchises" ON public.franchises FOR SELECT USING (true);


--
-- Name: empresas Users can insert own empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own empresa" ON public.empresas FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: verifactu_invoices Users can insert own verifactu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own verifactu" ON public.verifactu_invoices FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: dashboard_preferences Users can manage own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own preferences" ON public.dashboard_preferences USING ((auth.uid() = user_id));


--
-- Name: notifications Users can see own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can see own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: empresas Users can update own empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own empresa" ON public.empresas FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: verifactu_invoices Users can update own verifactu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own verifactu" ON public.verifactu_invoices FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: empresas Users can view own empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own empresa" ON public.empresas FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: verifactu_invoices Users can view own verifactu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own verifactu" ON public.verifactu_invoices FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: academy_resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.academy_resources ENABLE ROW LEVEL SECURITY;

--
-- Name: ocr_training_examples admin_read_all_examples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_read_all_examples ON public.ocr_training_examples FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: clients agents_insert_own_clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_insert_own_clients ON public.clients FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: ocr_training_examples agents_read_own_franchise_examples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_read_own_franchise_examples ON public.ocr_training_examples FOR SELECT USING ((franchise_id IN ( SELECT profiles.franchise_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: ocr_jobs agents_read_own_ocr_jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_read_own_ocr_jobs ON public.ocr_jobs FOR SELECT USING ((auth.uid() = agent_id));


--
-- Name: clients agents_select_franchise_clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_select_franchise_clients ON public.clients FOR SELECT TO authenticated USING ((franchise_id IN ( SELECT profiles.franchise_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: clients agents_update_own_clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_update_own_clients ON public.clients FOR UPDATE TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_cycles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_cycles billing_cycles_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_cycles_insert_admin ON public.billing_cycles FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (franchise_id = auth.uid())));


--
-- Name: billing_cycles billing_cycles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_cycles_select_own ON public.billing_cycles FOR SELECT USING (((franchise_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))));


--
-- Name: billing_cycles billing_cycles_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_cycles_update_admin ON public.billing_cycles FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))) OR (franchise_id = auth.uid())));


--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: commission_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commission_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboard_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: empresas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

--
-- Name: franchise_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.franchise_config ENABLE ROW LEVEL SECURITY;

--
-- Name: franchises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;

--
-- Name: lv_zinergia_tarifas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lv_zinergia_tarifas ENABLE ROW LEVEL SECURITY;

--
-- Name: network_commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.network_commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: network_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.network_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: ocr_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ocr_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: ocr_training_examples; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ocr_training_examples ENABLE ROW LEVEL SECURITY;

--
-- Name: offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions push_subs_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subs_admin ON public.push_subscriptions USING (public.is_superadmin());


--
-- Name: push_subscriptions push_subs_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subs_own ON public.push_subscriptions USING ((user_id = auth.uid()));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: academy_resources rls_academy_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_academy_admin_all ON public.academy_resources USING (public.is_superadmin());


--
-- Name: academy_resources rls_academy_agent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_academy_agent_select ON public.academy_resources FOR SELECT USING (((is_published = true) AND ((role_restriction = 'agent'::text) OR ((role_restriction = 'franchise'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['franchise'::text, 'admin'::text])))))) OR ((role_restriction = 'admin'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))))));


--
-- Name: clients rls_clients_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_clients_admin_all ON public.clients USING (public.is_superadmin());


--
-- Name: clients rls_clients_agent_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_clients_agent_insert ON public.clients FOR INSERT WITH CHECK (((owner_id = auth.uid()) AND ((franchise_id IS NULL) OR (franchise_id = public.get_my_franchise_id()))));


--
-- Name: clients rls_clients_agent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_clients_agent_select ON public.clients FOR SELECT USING (((franchise_id = public.get_my_franchise_id()) OR (owner_id = auth.uid())));


--
-- Name: clients rls_clients_agent_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_clients_agent_update ON public.clients FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: commission_tracking rls_commission_tracking_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_commission_tracking_admin_all ON public.commission_tracking USING (public.is_superadmin());


--
-- Name: commission_tracking rls_commission_tracking_agent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_commission_tracking_agent_select ON public.commission_tracking FOR SELECT USING (((agent_id = auth.uid()) OR (franchise_id = auth.uid())));


--
-- Name: network_commissions rls_commissions_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_commissions_admin_all ON public.network_commissions USING (public.is_superadmin());


--
-- Name: network_commissions rls_commissions_agent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_commissions_agent_select ON public.network_commissions FOR SELECT USING (((agent_id = auth.uid()) OR (franchise_id = auth.uid())));


--
-- Name: network_invitations rls_invitations_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_invitations_admin_all ON public.network_invitations USING (public.is_superadmin());


--
-- Name: network_invitations rls_invitations_creator_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_invitations_creator_select ON public.network_invitations FOR SELECT USING ((creator_id = auth.uid()));


--
-- Name: ocr_jobs rls_ocr_jobs_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ocr_jobs_admin_all ON public.ocr_jobs USING (public.is_superadmin());


--
-- Name: ocr_jobs rls_ocr_jobs_agent_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ocr_jobs_agent_insert ON public.ocr_jobs FOR INSERT WITH CHECK (((agent_id = auth.uid()) AND ((franchise_id IS NULL) OR (franchise_id = public.get_my_franchise_id()))));


--
-- Name: ocr_jobs rls_ocr_jobs_agent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ocr_jobs_agent_select ON public.ocr_jobs FOR SELECT USING (((franchise_id = public.get_my_franchise_id()) OR (agent_id = auth.uid())));


--
-- Name: ocr_jobs rls_ocr_jobs_agent_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_ocr_jobs_agent_update ON public.ocr_jobs FOR UPDATE USING (((agent_id = auth.uid()) OR (franchise_id = public.get_my_franchise_id())));


--
-- Name: offers rls_offers_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_offers_admin_all ON public.offers USING (public.is_superadmin());


--
-- Name: offers rls_offers_agent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_offers_agent_select ON public.offers FOR SELECT USING (((franchise_id IS NULL) OR (franchise_id = public.get_my_franchise_id())));


--
-- Name: proposals rls_proposals_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_proposals_admin_all ON public.proposals USING (public.is_superadmin());


--
-- Name: proposals rls_proposals_agent_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_proposals_agent_insert ON public.proposals FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.clients
  WHERE ((clients.id = proposals.client_id) AND (clients.owner_id = auth.uid())))));


--
-- Name: proposals rls_proposals_agent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_proposals_agent_select ON public.proposals FOR SELECT USING (((franchise_id = public.get_my_franchise_id()) OR (EXISTS ( SELECT 1
   FROM public.clients
  WHERE ((clients.id = proposals.client_id) AND (clients.owner_id = auth.uid()))))));


--
-- Name: proposals rls_proposals_agent_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rls_proposals_agent_update ON public.proposals FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.clients
  WHERE ((clients.id = proposals.client_id) AND (clients.owner_id = auth.uid())))));


--
-- Name: tariff_commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tariff_commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_parameters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tax_parameters ENABLE ROW LEVEL SECURITY;

--
-- Name: user_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

--
-- Name: verifactu_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verifactu_invoices ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


