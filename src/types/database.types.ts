export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academy_resources: {
        Row: {
          category: string
          created_at: string
          description: string | null
          file_type: string | null
          file_url: string
          id: string
          is_published: boolean
          role_restriction: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          is_published?: boolean
          role_restriction?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_published?: boolean
          role_restriction?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
        ]
      }
      billing_cycles: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          franchise_id: string
          id: string
          month_year: string
          snapshot_data: Json | null
          status: string
          total_commissions: number
          total_proposals: number
          updated_at: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          franchise_id: string
          id?: string
          month_year: string
          snapshot_data?: Json | null
          status?: string
          total_commissions?: number
          total_proposals?: number
          updated_at?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          franchise_id?: string
          id?: string
          month_year?: string
          snapshot_data?: Json | null
          status?: string
          total_commissions?: number
          total_proposals?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_cycles_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_cycles_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "billing_cycles_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_cycles_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          average_monthly_bill: number | null
          city: string | null
          contracted_power: Json | null
          created_at: string | null
          cups: string | null
          current_supplier: string | null
          dni_cif: string | null
          email: string | null
          franchise_id: string | null
          id: string
          last_contact_date: string | null
          latitude: number | null
          lead_source: string | null
          longitude: number | null
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          status: string | null
          tariff_type: string | null
          type: string
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          average_monthly_bill?: number | null
          city?: string | null
          contracted_power?: Json | null
          created_at?: string | null
          cups?: string | null
          current_supplier?: string | null
          dni_cif?: string | null
          email?: string | null
          franchise_id?: string | null
          id?: string
          last_contact_date?: string | null
          latitude?: number | null
          lead_source?: string | null
          longitude?: number | null
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          status?: string | null
          tariff_type?: string | null
          type?: string
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          average_monthly_bill?: number | null
          city?: string | null
          contracted_power?: Json | null
          created_at?: string | null
          cups?: string | null
          current_supplier?: string | null
          dni_cif?: string | null
          email?: string | null
          franchise_id?: string | null
          id?: string
          last_contact_date?: string | null
          latitude?: number | null
          lead_source?: string | null
          longitude?: number | null
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          status?: string | null
          tariff_type?: string | null
          type?: string
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          agent_share: number
          collaborator_pct: number
          commission_rate: number
          created_at: string
          created_by: string | null
          effective_from: string
          franchise_share: number
          hq_share: number
          id: string
          is_active: boolean
          name: string
          points_per_win: number
        }
        Insert: {
          agent_share?: number
          collaborator_pct?: number
          commission_rate?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          franchise_share?: number
          hq_share?: number
          id?: string
          is_active?: boolean
          name: string
          points_per_win?: number
        }
        Update: {
          agent_share?: number
          collaborator_pct?: number
          commission_rate?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          franchise_share?: number
          hq_share?: number
          id?: string
          is_active?: boolean
          name?: string
          points_per_win?: number
        }
        Relationships: []
      }
      commission_tracking: {
        Row: {
          agent_id: string | null
          commission_amount: number
          created_at: string | null
          franchise_id: string | null
          id: string
          notes: string | null
          paid_date: string | null
          proposal_id: string | null
          status: string | null
        }
        Insert: {
          agent_id?: string | null
          commission_amount: number
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          proposal_id?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string | null
          commission_amount?: number
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          proposal_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_tracking_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_tracking_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "commission_tracking_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_tracking_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "commission_tracking_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_preferences: {
        Row: {
          currency: string | null
          date_format: string | null
          email_alerts: boolean | null
          language: string | null
          notifications_enabled: boolean | null
          theme: string | null
          updated_at: string | null
          user_id: string
          widgets: Json | null
        }
        Insert: {
          currency?: string | null
          date_format?: string | null
          email_alerts?: boolean | null
          language?: string | null
          notifications_enabled?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
          widgets?: Json | null
        }
        Update: {
          currency?: string | null
          date_format?: string | null
          email_alerts?: boolean | null
          language?: string | null
          notifications_enabled?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
          widgets?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
        ]
      }
      franchise_config: {
        Row: {
          active: boolean | null
          company_name: string | null
          created_at: string | null
          entry_fee: number | null
          franchise_id: string
          id: string
          royalty_percent: number | null
        }
        Insert: {
          active?: boolean | null
          company_name?: string | null
          created_at?: string | null
          entry_fee?: number | null
          franchise_id: string
          id?: string
          royalty_percent?: number | null
        }
        Update: {
          active?: boolean | null
          company_name?: string | null
          created_at?: string | null
          entry_fee?: number | null
          franchise_id?: string
          id?: string
          royalty_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "franchise_config_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "franchise_config_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: true
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
        ]
      }
      franchises: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      lv_zinergia_tarifas: {
        Row: {
          codigo_producto: string | null
          company: string
          connection_fee: number | null
          consumption_max_kwh: number
          consumption_min_kwh: number
          contract_duration: string | null
          created_at: string | null
          description: string | null
          energy_price_p1: number
          energy_price_p2: number
          energy_price_p3: number
          energy_price_p4: number
          energy_price_p5: number
          energy_price_p6: number
          fixed_annual_fee_gas: number
          fixed_fee: number | null
          id: string
          is_active: boolean | null
          logo_color: string | null
          modelo: string | null
          notes: string | null
          offer_type: string | null
          power_price_p1: number
          power_price_p2: number
          power_price_p3: number
          power_price_p4: number
          power_price_p5: number
          power_price_p6: number
          supply_type: string
          tariff_name: string
          tariff_type: string | null
          tipo_cliente: string
          updated_at: string | null
          variable_price_kwh_gas: number
        }
        Insert: {
          codigo_producto?: string | null
          company: string
          connection_fee?: number | null
          consumption_max_kwh?: number
          consumption_min_kwh?: number
          contract_duration?: string | null
          created_at?: string | null
          description?: string | null
          energy_price_p1?: number
          energy_price_p2?: number
          energy_price_p3?: number
          energy_price_p4?: number
          energy_price_p5?: number
          energy_price_p6?: number
          fixed_annual_fee_gas?: number
          fixed_fee?: number | null
          id?: string
          is_active?: boolean | null
          logo_color?: string | null
          modelo?: string | null
          notes?: string | null
          offer_type?: string | null
          power_price_p1?: number
          power_price_p2?: number
          power_price_p3?: number
          power_price_p4?: number
          power_price_p5?: number
          power_price_p6?: number
          supply_type?: string
          tariff_name: string
          tariff_type?: string | null
          tipo_cliente?: string
          updated_at?: string | null
          variable_price_kwh_gas?: number
        }
        Update: {
          codigo_producto?: string | null
          company?: string
          connection_fee?: number | null
          consumption_max_kwh?: number
          consumption_min_kwh?: number
          contract_duration?: string | null
          created_at?: string | null
          description?: string | null
          energy_price_p1?: number
          energy_price_p2?: number
          energy_price_p3?: number
          energy_price_p4?: number
          energy_price_p5?: number
          energy_price_p6?: number
          fixed_annual_fee_gas?: number
          fixed_fee?: number | null
          id?: string
          is_active?: boolean | null
          logo_color?: string | null
          modelo?: string | null
          notes?: string | null
          offer_type?: string | null
          power_price_p1?: number
          power_price_p2?: number
          power_price_p3?: number
          power_price_p4?: number
          power_price_p5?: number
          power_price_p6?: number
          supply_type?: string
          tariff_name?: string
          tariff_type?: string | null
          tipo_cliente?: string
          updated_at?: string | null
          variable_price_kwh_gas?: number
        }
        Relationships: []
      }
      network_commissions: {
        Row: {
          agent_commission: number
          agent_id: string | null
          billing_cycle_id: string | null
          created_at: string | null
          franchise_commission: number
          franchise_id: string | null
          id: string
          paid_date: string | null
          proposal_id: string | null
          status: string | null
        }
        Insert: {
          agent_commission: number
          agent_id?: string | null
          billing_cycle_id?: string | null
          created_at?: string | null
          franchise_commission: number
          franchise_id?: string | null
          id?: string
          paid_date?: string | null
          proposal_id?: string | null
          status?: string | null
        }
        Update: {
          agent_commission?: number
          agent_id?: string | null
          billing_cycle_id?: string | null
          created_at?: string | null
          franchise_commission?: number
          franchise_id?: string | null
          id?: string
          paid_date?: string | null
          proposal_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "network_commissions_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_commissions_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_commissions_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "network_commissions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      network_invitations: {
        Row: {
          code: string
          created_at: string | null
          creator_id: string
          email: string
          expires_at: string | null
          id: string
          role: string
          used: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          creator_id: string
          email: string
          expires_at?: string | null
          id?: string
          role: string
          used?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          creator_id?: string
          email?: string
          expires_at?: string | null
          id?: string
          role?: string
          used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "network_invitations_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_invitations_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          link: string | null
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
        ]
      }
      ocr_jobs: {
        Row: {
          agent_id: string | null
          attempts: number
          client_id: string | null
          created_at: string
          error_message: string | null
          extracted_data: Json | null
          file_name: string
          file_path: string | null
          franchise_id: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          attempts?: number
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          extracted_data?: Json | null
          file_name: string
          file_path?: string | null
          franchise_id?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          attempts?: number
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          extracted_data?: Json | null
          file_name?: string
          file_path?: string | null
          franchise_id?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          contract_duration: string | null
          created_at: string | null
          description: string | null
          energy_price: Json | null
          fixed_fee: number | null
          franchise_id: string | null
          id: string
          is_active: boolean | null
          logo_color: string | null
          marketer_name: string
          power_price: Json | null
          tariff_name: string
          type: string | null
        }
        Insert: {
          contract_duration?: string | null
          created_at?: string | null
          description?: string | null
          energy_price?: Json | null
          fixed_fee?: number | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          logo_color?: string | null
          marketer_name: string
          power_price?: Json | null
          tariff_name: string
          type?: string | null
        }
        Update: {
          contract_duration?: string | null
          created_at?: string | null
          description?: string | null
          energy_price?: Json | null
          fixed_fee?: number | null
          franchise_id?: string | null
          id?: string
          is_active?: boolean | null
          logo_color?: string | null
          marketer_name?: string
          power_price?: Json | null
          tariff_name?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          email: string | null
          franchise_id: string | null
          full_name: string | null
          id: string
          parent_id: string | null
          phone: string | null
          role: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          email?: string | null
          franchise_id?: string | null
          full_name?: string | null
          id: string
          parent_id?: string | null
          phone?: string | null
          role?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          email?: string | null
          franchise_id?: string | null
          full_name?: string | null
          id?: string
          parent_id?: string | null
          phone?: string | null
          role?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_date: string | null
          agent_id: string | null
          aletheia_summary: Json | null
          annual_savings: number
          calculation_data: Json
          client_id: string
          created_at: string | null
          current_annual_cost: number
          followup_3d_at: string | null
          followup_7d_at: string | null
          franchise_id: string | null
          id: string
          offer_annual_cost: number
          offer_snapshot: Json
          optimization_result: Json | null
          probability_score: number | null
          rejected_date: string | null
          rejection_reason: string | null
          savings_percent: number
          sent_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_date?: string | null
          agent_id?: string | null
          aletheia_summary?: Json | null
          annual_savings: number
          calculation_data: Json
          client_id: string
          created_at?: string | null
          current_annual_cost: number
          followup_3d_at?: string | null
          followup_7d_at?: string | null
          franchise_id?: string | null
          id?: string
          offer_annual_cost: number
          offer_snapshot: Json
          optimization_result?: Json | null
          probability_score?: number | null
          rejected_date?: string | null
          rejection_reason?: string | null
          savings_percent: number
          sent_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_date?: string | null
          agent_id?: string | null
          aletheia_summary?: Json | null
          annual_savings?: number
          calculation_data?: Json
          client_id?: string
          created_at?: string | null
          current_annual_cost?: number
          followup_3d_at?: string | null
          followup_7d_at?: string | null
          franchise_id?: string | null
          id?: string
          offer_annual_cost?: number
          offer_snapshot?: Json
          optimization_result?: Json | null
          probability_score?: number | null
          rejected_date?: string | null
          rejection_reason?: string | null
          savings_percent?: number
          sent_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          endpoint: string
          id: string
          p256dh: string | null
          subscription_json: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          endpoint: string
          id?: string
          p256dh?: string | null
          subscription_json: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string | null
          subscription_json?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tariff_commissions: {
        Row: {
          commission_fixed_eur: number
          commission_variable_mwh: number
          company: string
          consumption_max_mwh: number
          consumption_min_mwh: number
          created_at: string
          id: string
          is_active: boolean
          modelo: string | null
          notes: string | null
          producto_tipo: string | null
          servicio: string | null
          supply_type: string
          tipo_cliente: string
          updated_at: string
        }
        Insert: {
          commission_fixed_eur?: number
          commission_variable_mwh?: number
          company: string
          consumption_max_mwh?: number
          consumption_min_mwh?: number
          created_at?: string
          id?: string
          is_active?: boolean
          modelo?: string | null
          notes?: string | null
          producto_tipo?: string | null
          servicio?: string | null
          supply_type?: string
          tipo_cliente?: string
          updated_at?: string
        }
        Update: {
          commission_fixed_eur?: number
          commission_variable_mwh?: number
          company?: string
          consumption_max_mwh?: number
          consumption_min_mwh?: number
          created_at?: string
          id?: string
          is_active?: boolean
          modelo?: string | null
          notes?: string | null
          producto_tipo?: string | null
          servicio?: string | null
          supply_type?: string
          tipo_cliente?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_parameters: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      user_points: {
        Row: {
          badges: Json | null
          id: string
          level: string | null
          points: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          badges?: Json | null
          id?: string
          level?: string | null
          points?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          badges?: Json | null
          id?: string
          level?: string | null
          points?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
        ]
      }
    }
    Views: {
      franchise_wallet: {
        Row: {
          balance_available: number | null
          balance_paid: number | null
          balance_pending: number | null
          franchise_id: string | null
          proposals_cleared: number | null
          proposals_paid: number | null
          proposals_pending: number | null
          total_earned: number | null
        }
        Relationships: [
          {
            foreignKeyName: "network_commissions_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_commissions_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
        ]
      }
      v_active_tariffs: {
        Row: {
          company: string | null
          connection_fee: number | null
          contract_duration: string | null
          energy_price_p1: number | null
          energy_price_p2: number | null
          energy_price_p3: number | null
          energy_price_p4: number | null
          energy_price_p5: number | null
          energy_price_p6: number | null
          fixed_fee: number | null
          id: string | null
          logo_color: string | null
          offer_type: string | null
          power_price_p1: number | null
          power_price_p2: number | null
          power_price_p3: number | null
          power_price_p4: number | null
          power_price_p5: number | null
          power_price_p6: number | null
          tariff_name: string | null
          tariff_type: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          connection_fee?: number | null
          contract_duration?: string | null
          energy_price_p1?: number | null
          energy_price_p2?: number | null
          energy_price_p3?: number | null
          energy_price_p4?: number | null
          energy_price_p5?: number | null
          energy_price_p6?: number | null
          fixed_fee?: number | null
          id?: string | null
          logo_color?: string | null
          offer_type?: string | null
          power_price_p1?: number | null
          power_price_p2?: number | null
          power_price_p3?: number | null
          power_price_p4?: number | null
          power_price_p5?: number | null
          power_price_p6?: number | null
          tariff_name?: string | null
          tariff_type?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          connection_fee?: number | null
          contract_duration?: string | null
          energy_price_p1?: number | null
          energy_price_p2?: number | null
          energy_price_p3?: number | null
          energy_price_p4?: number | null
          energy_price_p5?: number | null
          energy_price_p6?: number | null
          fixed_fee?: number | null
          id?: string | null
          logo_color?: string | null
          offer_type?: string | null
          power_price_p1?: number | null
          power_price_p2?: number | null
          power_price_p3?: number | null
          power_price_p4?: number | null
          power_price_p5?: number | null
          power_price_p6?: number | null
          tariff_name?: string | null
          tariff_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_franchise_client_stats: {
        Row: {
          active_clients: number | null
          company_name: string | null
          franchise_id: string | null
          new_clients: number | null
          pending_clients: number | null
          total_clients: number | null
          total_monthly_revenue: number | null
        }
        Relationships: []
      }
      v_proposal_funnel: {
        Row: {
          avg_savings: number | null
          count: number | null
          franchises_involved: number | null
          status: string | null
          total_savings: number | null
        }
        Relationships: []
      }
      v_tariff_stats: {
        Row: {
          active_tariffs: number | null
          avg_connection_fee: number | null
          avg_energy_p1: number | null
          avg_power_p1: number | null
          offer_type: string | null
          tariff_type: string | null
          total_tariffs: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_dashboard_stats: { Args: { p_franchise_id: string }; Returns: Json }
      get_my_franchise_id: { Args: never; Returns: string }
      get_my_parent_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
