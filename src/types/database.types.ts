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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      client_activities: {
        Row: {
          agent_id: string
          client_id: string
          created_at: string | null
          description: string
          franchise_id: string | null
          id: string
          metadata: Json | null
          type: string
        }
        Insert: {
          agent_id: string
          client_id: string
          created_at?: string | null
          description: string
          franchise_id?: string | null
          id?: string
          metadata?: Json | null
          type: string
        }
        Update: {
          agent_id?: string
          client_id?: string
          created_at?: string | null
          description?: string
          franchise_id?: string | null
          id?: string
          metadata?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_activities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_activities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "client_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_activities_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          agent_id: string
          category: string
          client_id: string
          created_at: string | null
          file_path: string
          file_type: string
          franchise_id: string | null
          id: string
          name: string
          size_bytes: number
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          category?: string
          client_id: string
          created_at?: string | null
          file_path: string
          file_type: string
          franchise_id?: string | null
          id?: string
          name: string
          size_bytes: number
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          category?: string
          client_id?: string
          created_at?: string | null
          file_path?: string
          file_type?: string
          franchise_id?: string | null
          id?: string
          name?: string
          size_bytes?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      client_status_transitions: {
        Row: {
          agent_id: string
          client_id: string
          created_at: string | null
          franchise_id: string | null
          from_status: string | null
          id: string
          to_status: string
        }
        Insert: {
          agent_id: string
          client_id: string
          created_at?: string | null
          franchise_id?: string | null
          from_status?: string | null
          id?: string
          to_status: string
        }
        Update: {
          agent_id?: string
          client_id?: string
          created_at?: string | null
          franchise_id?: string | null
          from_status?: string | null
          id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_status_transitions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_status_transitions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "client_status_transitions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_status_transitions_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
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
          cups_ciphertext: string | null
          cups_hash: string | null
          current_supplier: string | null
          dni_cif_ciphertext: string | null
          dni_cif_hash: string | null
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
          segment: string | null
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
          cups_ciphertext?: string | null
          cups_hash?: string | null
          current_supplier?: string | null
          dni_cif_ciphertext?: string | null
          dni_cif_hash?: string | null
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
          segment?: string | null
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
          cups_ciphertext?: string | null
          cups_hash?: string | null
          current_supplier?: string | null
          dni_cif_ciphertext?: string | null
          dni_cif_hash?: string | null
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
          segment?: string | null
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
          {
            foreignKeyName: "commission_tracking_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_alta"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          agent_id: string
          annual_savings: number | null
          client_id: string
          contract_type: string
          created_at: string | null
          end_date: string | null
          franchise_id: string | null
          id: string
          marketer_name: string
          monthly_cost_estimate: number | null
          notes: string | null
          notice_date: string | null
          proposal_id: string | null
          start_date: string
          status: string
          tariff_name: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          annual_savings?: number | null
          client_id: string
          contract_type?: string
          created_at?: string | null
          end_date?: string | null
          franchise_id?: string | null
          id?: string
          marketer_name: string
          monthly_cost_estimate?: number | null
          notes?: string | null
          notice_date?: string | null
          proposal_id?: string | null
          start_date?: string
          status?: string
          tariff_name?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          annual_savings?: number | null
          client_id?: string
          contract_type?: string
          created_at?: string | null
          end_date?: string | null
          franchise_id?: string | null
          id?: string
          marketer_name?: string
          monthly_cost_estimate?: number | null
          notes?: string | null
          notice_date?: string | null
          proposal_id?: string | null
          start_date?: string
          status?: string
          tariff_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_alta"
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
      empresas: {
        Row: {
          cert_password: string | null
          cert_path: string | null
          cp: string | null
          created_at: string | null
          direccion: string | null
          municipio: string | null
          nif: string
          nombre: string
          pais: string | null
          provincia: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cert_password?: string | null
          cert_path?: string | null
          cp?: string | null
          created_at?: string | null
          direccion?: string | null
          municipio?: string | null
          nif: string
          nombre: string
          pais?: string | null
          provincia?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cert_password?: string | null
          cert_path?: string | null
          cp?: string | null
          created_at?: string | null
          direccion?: string | null
          municipio?: string | null
          nif?: string
          nombre?: string
          pais?: string | null
          provincia?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      integration_credentials: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          created_at: string
          encrypted_refresh_token: string
          id: string
          last_error: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          encrypted_refresh_token: string
          id?: string
          last_error?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          encrypted_refresh_token?: string
          id?: string
          last_error?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          agent_id: string
          billing_period_end: string | null
          billing_period_start: string | null
          created_at: string | null
          due_date: string
          franchise_id: string | null
          id: string
          invoice_lines: Json
          invoice_number: string
          issue_date: string
          issuer_address: string | null
          issuer_city: string | null
          issuer_name: string
          issuer_nif: string
          issuer_postal_code: string | null
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          payment_reference: string | null
          pdf_url: string | null
          recipient_address: string | null
          recipient_city: string | null
          recipient_name: string
          recipient_nif: string
          recipient_postal_code: string | null
          retention_percent: number | null
          retention_total: number | null
          status: string | null
          subtotal: number
          tax_amount: number
          tax_base: number
          tax_percent: number | null
          tax_type: string | null
          total: number
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string | null
          due_date: string
          franchise_id?: string | null
          id?: string
          invoice_lines?: Json
          invoice_number: string
          issue_date?: string
          issuer_address?: string | null
          issuer_city?: string | null
          issuer_name: string
          issuer_nif: string
          issuer_postal_code?: string | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          recipient_address?: string | null
          recipient_city?: string | null
          recipient_name: string
          recipient_nif: string
          recipient_postal_code?: string | null
          retention_percent?: number | null
          retention_total?: number | null
          status?: string | null
          subtotal?: number
          tax_amount?: number
          tax_base?: number
          tax_percent?: number | null
          tax_type?: string | null
          total?: number
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string | null
          due_date?: string
          franchise_id?: string | null
          id?: string
          invoice_lines?: Json
          invoice_number?: string
          issue_date?: string
          issuer_address?: string | null
          issuer_city?: string | null
          issuer_name?: string
          issuer_nif?: string
          issuer_postal_code?: string | null
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          recipient_address?: string | null
          recipient_city?: string | null
          recipient_name?: string
          recipient_nif?: string
          recipient_postal_code?: string | null
          retention_percent?: number | null
          retention_total?: number | null
          status?: string | null
          subtotal?: number
          tax_amount?: number
          tax_base?: number
          tax_percent?: number | null
          tax_type?: string | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "invoices_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_audit_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: string
          job_id: string
          metadata: Json
          title: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          job_id: string
          metadata?: Json
          title: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          job_id?: string
          metadata?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "lead_audit_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "invoice_registry"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "lead_audit_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ocr_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      lv_zinergia_tarifas: {
        Row: {
          catalog_version: number
          codigo_producto: string | null
          company: string
          connection_fee: number | null
          consumption_max_kwh: number
          consumption_min_kwh: number
          contract_duration: string | null
          created_at: string | null
          description: string | null
          effective_from: string
          effective_to: string | null
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
          price_fingerprint: string | null
          supply_type: string
          surplus_compensation_price: number
          tariff_name: string
          tariff_type: string | null
          tipo_cliente: string
          updated_at: string | null
          variable_price_kwh_gas: number
        }
        Insert: {
          catalog_version?: number
          codigo_producto?: string | null
          company: string
          connection_fee?: number | null
          consumption_max_kwh?: number
          consumption_min_kwh?: number
          contract_duration?: string | null
          created_at?: string | null
          description?: string | null
          effective_from?: string
          effective_to?: string | null
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
          price_fingerprint?: string | null
          supply_type?: string
          surplus_compensation_price?: number
          tariff_name: string
          tariff_type?: string | null
          tipo_cliente?: string
          updated_at?: string | null
          variable_price_kwh_gas?: number
        }
        Update: {
          catalog_version?: number
          codigo_producto?: string | null
          company?: string
          connection_fee?: number | null
          consumption_max_kwh?: number
          consumption_min_kwh?: number
          contract_duration?: string | null
          created_at?: string | null
          description?: string | null
          effective_from?: string
          effective_to?: string | null
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
          price_fingerprint?: string | null
          supply_type?: string
          surplus_compensation_price?: number
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
          invoice_id: string | null
          invoiced: boolean | null
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
          invoice_id?: string | null
          invoiced?: boolean | null
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
          invoice_id?: string | null
          invoiced?: boolean | null
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
            foreignKeyName: "network_commissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_commissions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_commissions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals_alta"
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
      next_actions: {
        Row: {
          action_type: string
          agent_id: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          franchise_id: string
          id: string
          metadata: Json | null
          priority: string
          proposal_id: string | null
          reason: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_type: string
          agent_id: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          franchise_id: string
          id?: string
          metadata?: Json | null
          priority?: string
          proposal_id?: string | null
          reason?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          agent_id?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          franchise_id?: string
          id?: string
          metadata?: Json | null
          priority?: string
          proposal_id?: string | null
          reason?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "next_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_actions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_actions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_alta"
            referencedColumns: ["id"]
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
          binary_purged_at: string | null
          client_id: string | null
          client_segment: string | null
          closed: boolean
          closed_at: string | null
          closed_company: string | null
          closed_tariff: string | null
          commission_amount: number | null
          compared_at: string | null
          created_at: string
          drive_file_id: string | null
          drive_synced_at: string | null
          drive_view_link: string | null
          duplicate_of: string | null
          error_message: string | null
          extracted_data: Json | null
          file_content_hash: string | null
          file_name: string
          file_path: string | null
          franchise_id: string | null
          id: string
          lost: boolean
          lost_at: string | null
          lost_reason: string | null
          permanence_reminded_at: string | null
          permanence_until: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          attempts?: number
          binary_purged_at?: string | null
          client_id?: string | null
          client_segment?: string | null
          closed?: boolean
          closed_at?: string | null
          closed_company?: string | null
          closed_tariff?: string | null
          commission_amount?: number | null
          compared_at?: string | null
          created_at?: string
          drive_file_id?: string | null
          drive_synced_at?: string | null
          drive_view_link?: string | null
          duplicate_of?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          file_content_hash?: string | null
          file_name: string
          file_path?: string | null
          franchise_id?: string | null
          id?: string
          lost?: boolean
          lost_at?: string | null
          lost_reason?: string | null
          permanence_reminded_at?: string | null
          permanence_until?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          attempts?: number
          binary_purged_at?: string | null
          client_id?: string | null
          client_segment?: string | null
          closed?: boolean
          closed_at?: string | null
          closed_company?: string | null
          closed_tariff?: string | null
          commission_amount?: number | null
          compared_at?: string | null
          created_at?: string
          drive_file_id?: string | null
          drive_synced_at?: string | null
          drive_view_link?: string | null
          duplicate_of?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          file_content_hash?: string | null
          file_name?: string
          file_path?: string | null
          franchise_id?: string | null
          id?: string
          lost?: boolean
          lost_at?: string | null
          lost_reason?: string | null
          permanence_reminded_at?: string | null
          permanence_until?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
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
            foreignKeyName: "ocr_jobs_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "invoice_registry"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ocr_jobs_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "ocr_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
        ]
      }
      ocr_training_examples: {
        Row: {
          company_name: string
          confidence_avg: number | null
          corrected_fields: Json | null
          created_at: string
          extracted_fields: Json
          file_hash: string
          franchise_id: string | null
          id: string
          is_validated: boolean
          n8n_model: string | null
          ocr_job_id: string | null
          raw_fields: Json | null
          raw_text_sample: string | null
        }
        Insert: {
          company_name: string
          confidence_avg?: number | null
          corrected_fields?: Json | null
          created_at?: string
          extracted_fields: Json
          file_hash: string
          franchise_id?: string | null
          id?: string
          is_validated?: boolean
          n8n_model?: string | null
          ocr_job_id?: string | null
          raw_fields?: Json | null
          raw_text_sample?: string | null
        }
        Update: {
          company_name?: string
          confidence_avg?: number | null
          corrected_fields?: Json | null
          created_at?: string
          extracted_fields?: Json
          file_hash?: string
          franchise_id?: string | null
          id?: string
          is_validated?: boolean
          n8n_model?: string | null
          ocr_job_id?: string | null
          raw_fields?: Json | null
          raw_text_sample?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_training_examples_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_training_examples_ocr_job_id_fkey"
            columns: ["ocr_job_id"]
            isOneToOne: false
            referencedRelation: "invoice_registry"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "ocr_training_examples_ocr_job_id_fkey"
            columns: ["ocr_job_id"]
            isOneToOne: false
            referencedRelation: "ocr_jobs"
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
          company_name: string | null
          company_type: string | null
          created_at: string | null
          drive_folder_id: string | null
          email: string | null
          fiscal_address: string | null
          fiscal_city: string | null
          fiscal_country: string | null
          fiscal_postal_code: string | null
          fiscal_province: string | null
          fiscal_verified: boolean | null
          fiscal_verified_at: string | null
          franchise_id: string | null
          full_name: string | null
          iban: string | null
          id: string
          invoice_next_number: number | null
          invoice_prefix: string | null
          nif_cif: string | null
          parent_id: string | null
          phone: string | null
          retention_percent: number | null
          role: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          company_name?: string | null
          company_type?: string | null
          created_at?: string | null
          drive_folder_id?: string | null
          email?: string | null
          fiscal_address?: string | null
          fiscal_city?: string | null
          fiscal_country?: string | null
          fiscal_postal_code?: string | null
          fiscal_province?: string | null
          fiscal_verified?: boolean | null
          fiscal_verified_at?: string | null
          franchise_id?: string | null
          full_name?: string | null
          iban?: string | null
          id: string
          invoice_next_number?: number | null
          invoice_prefix?: string | null
          nif_cif?: string | null
          parent_id?: string | null
          phone?: string | null
          retention_percent?: number | null
          role?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          company_name?: string | null
          company_type?: string | null
          created_at?: string | null
          drive_folder_id?: string | null
          email?: string | null
          fiscal_address?: string | null
          fiscal_city?: string | null
          fiscal_country?: string | null
          fiscal_postal_code?: string | null
          fiscal_province?: string | null
          fiscal_verified?: boolean | null
          fiscal_verified_at?: string | null
          franchise_id?: string | null
          full_name?: string | null
          iban?: string | null
          id?: string
          invoice_next_number?: number | null
          invoice_prefix?: string | null
          nif_cif?: string | null
          parent_id?: string | null
          phone?: string | null
          retention_percent?: number | null
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
      proposal_alta_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: string
          metadata: Json | null
          proposal_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          proposal_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_alta_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_alta_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_alta"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_date: string | null
          agent_id: string | null
          aletheia_summary: Json | null
          alta_completada_at: string | null
          alta_completada_by: string | null
          alta_rejected_at: string | null
          alta_rejection_note: string | null
          alta_rejection_reason: string | null
          alta_requested_at: string | null
          alta_requested_by: string | null
          alta_status: Database["public"]["Enums"]["alta_status_enum"] | null
          annual_savings: number
          calculation_data: Json
          client_id: string
          close_probability: number | null
          consent_confirmed_at: string | null
          consent_confirmed_by: string | null
          created_at: string | null
          current_annual_cost: number
          followup_3d_at: string | null
          followup_7d_at: string | null
          franchise_id: string | null
          id: string
          ocr_job_id: string | null
          offer_annual_cost: number
          offer_snapshot: Json
          optimization_result: Json | null
          price_snapshot: Json
          price_snapshot_at: string
          pricing_status: string
          probability_score: number | null
          proposal_version: number
          public_accepted_at: string | null
          public_expires_at: string | null
          public_token: string | null
          rejected_date: string | null
          rejection_reason: string | null
          repriced_at: string | null
          repricing_delta_eur: number | null
          savings_percent: number
          sent_date: string | null
          sepa_confirmed_at: string | null
          signature_data: string | null
          signed_at: string | null
          signed_name: string | null
          source_proposal_id: string | null
          source_tariff_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_date?: string | null
          agent_id?: string | null
          aletheia_summary?: Json | null
          alta_completada_at?: string | null
          alta_completada_by?: string | null
          alta_rejected_at?: string | null
          alta_rejection_note?: string | null
          alta_rejection_reason?: string | null
          alta_requested_at?: string | null
          alta_requested_by?: string | null
          alta_status?: Database["public"]["Enums"]["alta_status_enum"] | null
          annual_savings: number
          calculation_data: Json
          client_id: string
          close_probability?: number | null
          consent_confirmed_at?: string | null
          consent_confirmed_by?: string | null
          created_at?: string | null
          current_annual_cost: number
          followup_3d_at?: string | null
          followup_7d_at?: string | null
          franchise_id?: string | null
          id?: string
          ocr_job_id?: string | null
          offer_annual_cost: number
          offer_snapshot: Json
          optimization_result?: Json | null
          price_snapshot?: Json
          price_snapshot_at?: string
          pricing_status?: string
          probability_score?: number | null
          proposal_version?: number
          public_accepted_at?: string | null
          public_expires_at?: string | null
          public_token?: string | null
          rejected_date?: string | null
          rejection_reason?: string | null
          repriced_at?: string | null
          repricing_delta_eur?: number | null
          savings_percent: number
          sent_date?: string | null
          sepa_confirmed_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_name?: string | null
          source_proposal_id?: string | null
          source_tariff_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_date?: string | null
          agent_id?: string | null
          aletheia_summary?: Json | null
          alta_completada_at?: string | null
          alta_completada_by?: string | null
          alta_rejected_at?: string | null
          alta_rejection_note?: string | null
          alta_rejection_reason?: string | null
          alta_requested_at?: string | null
          alta_requested_by?: string | null
          alta_status?: Database["public"]["Enums"]["alta_status_enum"] | null
          annual_savings?: number
          calculation_data?: Json
          client_id?: string
          close_probability?: number | null
          consent_confirmed_at?: string | null
          consent_confirmed_by?: string | null
          created_at?: string | null
          current_annual_cost?: number
          followup_3d_at?: string | null
          followup_7d_at?: string | null
          franchise_id?: string | null
          id?: string
          ocr_job_id?: string | null
          offer_annual_cost?: number
          offer_snapshot?: Json
          optimization_result?: Json | null
          price_snapshot?: Json
          price_snapshot_at?: string
          pricing_status?: string
          probability_score?: number | null
          proposal_version?: number
          public_accepted_at?: string | null
          public_expires_at?: string | null
          public_token?: string | null
          rejected_date?: string | null
          rejection_reason?: string | null
          repriced_at?: string | null
          repricing_delta_eur?: number | null
          savings_percent?: number
          sent_date?: string | null
          sepa_confirmed_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_name?: string | null
          source_proposal_id?: string | null
          source_tariff_id?: string | null
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
          {
            foreignKeyName: "proposals_ocr_job_id_fkey"
            columns: ["ocr_job_id"]
            isOneToOne: false
            referencedRelation: "invoice_registry"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "proposals_ocr_job_id_fkey"
            columns: ["ocr_job_id"]
            isOneToOne: false
            referencedRelation: "ocr_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_source_proposal_id_fkey"
            columns: ["source_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_source_proposal_id_fkey"
            columns: ["source_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_alta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_source_tariff_id_fkey"
            columns: ["source_tariff_id"]
            isOneToOne: false
            referencedRelation: "lv_zinergia_tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_source_tariff_id_fkey"
            columns: ["source_tariff_id"]
            isOneToOne: false
            referencedRelation: "v_active_tariffs"
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
      renewal_opportunities: {
        Row: {
          agent_id: string
          best_marketer: string | null
          best_new_annual_cost: number
          best_tariff_id: string | null
          best_tariff_name: string | null
          client_id: string
          contacted_at: string | null
          created_at: string
          current_annual_cost: number
          detected_at: string
          expires_at: string | null
          franchise_id: string
          id: string
          original_proposal_id: string | null
          potential_savings: number
          priority_score: number
          reason: string
          savings_percent: number
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          best_marketer?: string | null
          best_new_annual_cost?: number
          best_tariff_id?: string | null
          best_tariff_name?: string | null
          client_id: string
          contacted_at?: string | null
          created_at?: string
          current_annual_cost?: number
          detected_at?: string
          expires_at?: string | null
          franchise_id: string
          id?: string
          original_proposal_id?: string | null
          potential_savings?: number
          priority_score?: number
          reason?: string
          savings_percent?: number
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          best_marketer?: string | null
          best_new_annual_cost?: number
          best_tariff_id?: string | null
          best_tariff_name?: string | null
          client_id?: string
          contacted_at?: string | null
          created_at?: string
          current_annual_cost?: number
          detected_at?: string
          expires_at?: string | null
          franchise_id?: string
          id?: string
          original_proposal_id?: string | null
          potential_savings?: number
          priority_score?: number
          reason?: string
          savings_percent?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_opportunities_original_proposal_id_fkey"
            columns: ["original_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_opportunities_original_proposal_id_fkey"
            columns: ["original_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_alta"
            referencedColumns: ["id"]
          },
        ]
      }
      sips_consents: {
        Row: {
          client_id: string | null
          consent_at: string
          consent_source: string
          created_at: string
          cups_hash: string
          id: string
          notes: string | null
          revoked_at: string | null
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          consent_at?: string
          consent_source?: string
          created_at?: string
          cups_hash: string
          id?: string
          notes?: string | null
          revoked_at?: string | null
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          consent_at?: string
          consent_source?: string
          created_at?: string
          cups_hash?: string
          id?: string
          notes?: string | null
          revoked_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sips_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sips_consumption_cache: {
        Row: {
          annual_consumption_kwh: number
          annual_consumption_mwh: number
          created_at: string
          cups_hash: string
          expires_at: string
          fetched_at: string
          id: string
          rows_count: number
          source: string
          updated_at: string
        }
        Insert: {
          annual_consumption_kwh?: number
          annual_consumption_mwh?: number
          created_at?: string
          cups_hash: string
          expires_at?: string
          fetched_at?: string
          id?: string
          rows_count?: number
          source?: string
          updated_at?: string
        }
        Update: {
          annual_consumption_kwh?: number
          annual_consumption_mwh?: number
          created_at?: string
          cups_hash?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          rows_count?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      sips_query_audit: {
        Row: {
          created_at: string
          cups_hash: string
          error_message: string | null
          id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          cups_hash: string
          error_message?: string | null
          id?: string
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          cups_hash?: string
          error_message?: string | null
          id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      supply_points: {
        Row: {
          address: string | null
          annual_consumption_kwh: number | null
          city: string | null
          client_id: string
          contracted_power: Json | null
          created_at: string
          cups: string | null
          cups_ciphertext: string | null
          cups_hash: string | null
          cups_last4: string | null
          current_marketer: string | null
          current_tariff: string | null
          id: string
          is_primary: boolean
          supply_type: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          annual_consumption_kwh?: number | null
          city?: string | null
          client_id: string
          contracted_power?: Json | null
          created_at?: string
          cups?: string | null
          cups_ciphertext?: string | null
          cups_hash?: string | null
          cups_last4?: string | null
          current_marketer?: string | null
          current_tariff?: string | null
          id?: string
          is_primary?: boolean
          supply_type?: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          annual_consumption_kwh?: number | null
          city?: string | null
          client_id?: string
          contracted_power?: Json | null
          created_at?: string
          cups?: string | null
          cups_ciphertext?: string | null
          cups_hash?: string | null
          cups_last4?: string | null
          current_marketer?: string | null
          current_tariff?: string | null
          id?: string
          is_primary?: boolean
          supply_type?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_points_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      switch_events: {
        Row: {
          annual_savings: number | null
          client_id: string
          created_at: string
          cups: string | null
          cups_ciphertext: string | null
          cups_hash: string | null
          cups_last4: string | null
          id: string
          new_annual_cost: number | null
          new_marketer: string
          new_tariff: string | null
          notes: string | null
          previous_annual_cost: number | null
          previous_marketer: string | null
          previous_tariff: string | null
          proposal_id: string | null
          reason: string | null
          supply_point_id: string | null
          switch_date: string
        }
        Insert: {
          annual_savings?: number | null
          client_id: string
          created_at?: string
          cups?: string | null
          cups_ciphertext?: string | null
          cups_hash?: string | null
          cups_last4?: string | null
          id?: string
          new_annual_cost?: number | null
          new_marketer: string
          new_tariff?: string | null
          notes?: string | null
          previous_annual_cost?: number | null
          previous_marketer?: string | null
          previous_tariff?: string | null
          proposal_id?: string | null
          reason?: string | null
          supply_point_id?: string | null
          switch_date?: string
        }
        Update: {
          annual_savings?: number | null
          client_id?: string
          created_at?: string
          cups?: string | null
          cups_ciphertext?: string | null
          cups_hash?: string | null
          cups_last4?: string | null
          id?: string
          new_annual_cost?: number | null
          new_marketer?: string
          new_tariff?: string | null
          notes?: string | null
          previous_annual_cost?: number | null
          previous_marketer?: string | null
          previous_tariff?: string | null
          proposal_id?: string | null
          reason?: string | null
          supply_point_id?: string | null
          switch_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "switch_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "switch_events_supply_point_id_fkey"
            columns: ["supply_point_id"]
            isOneToOne: false
            referencedRelation: "supply_points"
            referencedColumns: ["id"]
          },
        ]
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
      tasks: {
        Row: {
          agent_id: string
          auto_generated: boolean | null
          client_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          franchise_id: string | null
          id: string
          priority: string
          proposal_id: string | null
          status: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          auto_generated?: boolean | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          franchise_id?: string | null
          id?: string
          priority?: string
          proposal_id?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          auto_generated?: boolean | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          franchise_id?: string | null
          id?: string
          priority?: string
          proposal_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals_alta"
            referencedColumns: ["id"]
          },
        ]
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
      verifactu_invoices: {
        Row: {
          created_at: string | null
          ejercicio: number
          estado: string | null
          fecha_generacion: string | null
          huella: string | null
          id: string
          periodo: number
          user_id: string
          xml_generado: string | null
        }
        Insert: {
          created_at?: string | null
          ejercicio: number
          estado?: string | null
          fecha_generacion?: string | null
          huella?: string | null
          id?: string
          periodo: number
          user_id: string
          xml_generado?: string | null
        }
        Update: {
          created_at?: string | null
          ejercicio?: number
          estado?: string | null
          fecha_generacion?: string | null
          huella?: string | null
          id?: string
          periodo?: number
          user_id?: string
          xml_generado?: string | null
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          commission_ids: Json
          created_at: string
          iban: string
          id: string
          paid_at: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          commission_ids?: Json
          created_at?: string
          iban: string
          id?: string
          paid_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          commission_ids?: Json
          created_at?: string
          iban?: string
          id?: string
          paid_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_franchise_client_stats"
            referencedColumns: ["franchise_id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
      invoice_registry: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          annual_savings: number | null
          archived_in_drive: boolean | null
          closed: boolean | null
          closed_at: string | null
          comercializadora_actual: string | null
          commission_amount: number | null
          compania_contratada: string | null
          compared_at: string | null
          created_at: string | null
          cups: string | null
          drive_synced_at: string | null
          drive_view_link: string | null
          franchise_id: string | null
          franchise_name: string | null
          has_proposal: boolean | null
          importe_total: string | null
          job_id: string | null
          lost: boolean | null
          lost_reason: string | null
          ocr_status: string | null
          period_days: string | null
          permanencia_hasta: string | null
          process_status: string | null
          reviewed_at: string | null
          savings_percent: number | null
          tarifa_actual: string | null
          tarifa_contratada: string | null
          titular: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_jobs_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals_alta: {
        Row: {
          agent_email: string | null
          agent_id: string | null
          agent_name: string | null
          alta_completada_at: string | null
          alta_rejected_at: string | null
          alta_rejection_note: string | null
          alta_rejection_reason: string | null
          alta_requested_at: string | null
          alta_requested_by: string | null
          alta_status: Database["public"]["Enums"]["alta_status_enum"] | null
          annual_savings: number | null
          calculation_data: Json | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          consent_confirmed_at: string | null
          created_at: string | null
          current_annual_cost: number | null
          franchise_id: string | null
          id: string | null
          offer_annual_cost: number | null
          offer_snapshot: Json | null
          sepa_confirmed_at: string | null
          status: string | null
          updated_at: string | null
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
      generate_invoice_number: { Args: { p_agent_id: string }; Returns: string }
      get_conversion_funnel: {
        Args: { p_agent_id?: string }
        Returns: {
          count: number
          percentage: number
          status: string
        }[]
      }
      get_dashboard_stats: { Args: { p_franchise_id: string }; Returns: Json }
      get_expiring_contracts: {
        Args: { p_days_threshold?: number }
        Returns: {
          agent_id: string
          annual_savings: number
          client_id: string
          client_name: string
          days_remaining: number
          end_date: string
          id: string
          marketer_name: string
          tariff_name: string
        }[]
      }
      get_lead_agent_ranking: {
        Args: never
        Returns: {
          agent_id: string
          agent_name: string
          commission: number
          lost: number
          open_leads: number
          won: number
        }[]
      }
      get_lead_analytics: { Args: never; Returns: Json }
      get_lead_metrics: { Args: never; Returns: Json }
      get_monthly_metrics: {
        Args: { p_months?: number }
        Returns: {
          lost_clients: number
          month: string
          new_clients: number
          proposals_accepted: number
          proposals_sent: number
          total_savings: number
          won_clients: number
        }[]
      }
      get_my_franchise_id: { Args: never; Returns: string }
      get_my_parent_id: { Args: never; Returns: string }
      get_withdrawal_growth: {
        Args: { p_user_id: string }
        Returns: {
          current_month_earned: number
          growth_percent: number
          previous_month_earned: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
    }
    Enums: {
      alta_status_enum:
        | "pendiente_consent"
        | "lista_admin"
        | "en_alta"
        | "activada"
        | "rechazada"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      alta_status_enum: [
        "pendiente_consent",
        "lista_admin",
        "en_alta",
        "activada",
        "rechazada",
      ],
    },
  },
} as const
