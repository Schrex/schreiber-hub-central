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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accident_reports: {
        Row: {
          body_part: string | null
          contributing_factors: string | null
          created_at: string
          description: string
          id: string
          immediate_action: string | null
          incident_at: string
          incident_type: Database["public"]["Enums"]["accident_incident_type"]
          injured_person_name: string | null
          job_id: string | null
          job_name_snapshot: string | null
          job_number_snapshot: string | null
          location: string | null
          office_notes: string | null
          photo_paths: string[]
          reported_by: string
          reported_by_email: string | null
          reported_by_name: string
          severity: Database["public"]["Enums"]["accident_severity"]
          signature_data: string | null
          status: Database["public"]["Enums"]["accident_status"]
          updated_at: string
          witnesses: string | null
        }
        Insert: {
          body_part?: string | null
          contributing_factors?: string | null
          created_at?: string
          description: string
          id?: string
          immediate_action?: string | null
          incident_at: string
          incident_type?: Database["public"]["Enums"]["accident_incident_type"]
          injured_person_name?: string | null
          job_id?: string | null
          job_name_snapshot?: string | null
          job_number_snapshot?: string | null
          location?: string | null
          office_notes?: string | null
          photo_paths?: string[]
          reported_by: string
          reported_by_email?: string | null
          reported_by_name: string
          severity?: Database["public"]["Enums"]["accident_severity"]
          signature_data?: string | null
          status?: Database["public"]["Enums"]["accident_status"]
          updated_at?: string
          witnesses?: string | null
        }
        Update: {
          body_part?: string | null
          contributing_factors?: string | null
          created_at?: string
          description?: string
          id?: string
          immediate_action?: string | null
          incident_at?: string
          incident_type?: Database["public"]["Enums"]["accident_incident_type"]
          injured_person_name?: string | null
          job_id?: string | null
          job_name_snapshot?: string | null
          job_number_snapshot?: string | null
          location?: string | null
          office_notes?: string | null
          photo_paths?: string[]
          reported_by?: string
          reported_by_email?: string | null
          reported_by_name?: string
          severity?: Database["public"]["Enums"]["accident_severity"]
          signature_data?: string | null
          status?: Database["public"]["Enums"]["accident_status"]
          updated_at?: string
          witnesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accident_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      benefit_types: {
        Row: {
          created_at: string
          default_annual_value: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_annual_value?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_annual_value?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      bid_item_activities: {
        Row: {
          bid_item_id: string
          code: string
          created_at: string
          crew_id: string | null
          description: string
          equipment: string[]
          id: string
          manhours: number | null
          notes: string | null
          qty: number
          rate: number | null
          rate_by: string
          shifts: number | null
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          bid_item_id: string
          code?: string
          created_at?: string
          crew_id?: string | null
          description: string
          equipment?: string[]
          id?: string
          manhours?: number | null
          notes?: string | null
          qty?: number
          rate?: number | null
          rate_by?: string
          shifts?: number | null
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          bid_item_id?: string
          code?: string
          created_at?: string
          crew_id?: string | null
          description?: string
          equipment?: string[]
          id?: string
          manhours?: number | null
          notes?: string | null
          qty?: number
          rate?: number | null
          rate_by?: string
          shifts?: number | null
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_item_activities_bid_item_id_fkey"
            columns: ["bid_item_id"]
            isOneToOne: false
            referencedRelation: "bid_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_item_activities_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_item_materials: {
        Row: {
          bid_item_id: string
          created_at: string
          description: string
          id: string
          notes: string | null
          quantity: number
          sort_order: number
          unit: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          bid_item_id: string
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          bid_item_id?: string
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bid_item_materials_bid_item_id_fkey"
            columns: ["bid_item_id"]
            isOneToOne: false
            referencedRelation: "bid_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_items: {
        Row: {
          created_at: string
          description: string
          id: string
          item_code: string
          job_id: string
          notes: string | null
          phase_id: string | null
          quantity: number
          sort_order: number
          sub: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_code: string
          job_id: string
          notes?: string | null
          phase_id?: string | null
          quantity?: number
          sort_order?: number
          sub?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_code?: string
          job_id?: string
          notes?: string | null
          phase_id?: string | null
          quantity?: number
          sort_order?: number
          sub?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_items_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "bid_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_phases: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          name: string
          short_label: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          id?: string
          name: string
          short_label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          short_label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      celebration_log: {
        Row: {
          created_at: string
          event_date: string
          id: string
          kind: string
          stage: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date: string
          id?: string
          kind: string
          stage: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_date?: string
          id?: string
          kind?: string
          stage?: string
          user_id?: string
        }
        Relationships: []
      }
      clothing_items: {
        Row: {
          colors: string[]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sizes: string[]
          sort_order: number
          updated_at: string
        }
        Insert: {
          colors?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sizes?: string[]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          colors?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sizes?: string[]
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      clothing_orders: {
        Row: {
          color: string
          created_at: string
          id: string
          item_id: string
          item_name: string
          notes: string | null
          quantity: number
          size: string
          status: Database["public"]["Enums"]["clothing_order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          item_id: string
          item_name: string
          notes?: string | null
          quantity: number
          size: string
          status?: Database["public"]["Enums"]["clothing_order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          item_id?: string
          item_name?: string
          notes?: string | null
          quantity?: number
          size?: string
          status?: Database["public"]["Enums"]["clothing_order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clothing_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "clothing_items"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          size: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          size?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          size?: number
          updated_at?: string
        }
        Relationships: []
      }
      dig_tickets: {
        Row: {
          created_at: string
          created_by: string | null
          dig_end_date: string | null
          dig_start_date: string | null
          expiration_date: string | null
          id: string
          job_id: string
          latitude: number | null
          longitude: number | null
          request_type: Database["public"]["Enums"]["dig_ticket_request_type"]
          requested_at: string | null
          requested_by_name: string | null
          response_notes: string | null
          status: Database["public"]["Enums"]["dig_ticket_status"]
          ticket_number: string | null
          ticket_url: string | null
          updated_at: string
          work_description: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dig_end_date?: string | null
          dig_start_date?: string | null
          expiration_date?: string | null
          id?: string
          job_id: string
          latitude?: number | null
          longitude?: number | null
          request_type?: Database["public"]["Enums"]["dig_ticket_request_type"]
          requested_at?: string | null
          requested_by_name?: string | null
          response_notes?: string | null
          status?: Database["public"]["Enums"]["dig_ticket_status"]
          ticket_number?: string | null
          ticket_url?: string | null
          updated_at?: string
          work_description?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dig_end_date?: string | null
          dig_start_date?: string | null
          expiration_date?: string | null
          id?: string
          job_id?: string
          latitude?: number | null
          longitude?: number | null
          request_type?: Database["public"]["Enums"]["dig_ticket_request_type"]
          requested_at?: string | null
          requested_by_name?: string | null
          response_notes?: string | null
          status?: Database["public"]["Enums"]["dig_ticket_status"]
          ticket_number?: string | null
          ticket_url?: string | null
          updated_at?: string
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dig_tickets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_orders: {
        Row: {
          bill_to: string | null
          billed_quantity: number | null
          billing_notes: string | null
          billing_total: number | null
          created_at: string
          created_by: string | null
          customer: string | null
          dispatch_date: string
          driver_name: string | null
          driver_user_id: string | null
          dump_location: string | null
          gc: string | null
          id: string
          invoice_status: Database["public"]["Enums"]["dispatch_invoice_status"]
          job_id: string | null
          job_name: string | null
          job_number: string | null
          load_quantity: number | null
          material: string | null
          notes: string | null
          pickup_location: string | null
          po_number: string | null
          rate_amount: number | null
          rate_type: Database["public"]["Enums"]["dispatch_rate_type"] | null
          sort_order: number
          start_time: string | null
          status: Database["public"]["Enums"]["dispatch_status"]
          truck_number: string | null
          updated_at: string
        }
        Insert: {
          bill_to?: string | null
          billed_quantity?: number | null
          billing_notes?: string | null
          billing_total?: number | null
          created_at?: string
          created_by?: string | null
          customer?: string | null
          dispatch_date?: string
          driver_name?: string | null
          driver_user_id?: string | null
          dump_location?: string | null
          gc?: string | null
          id?: string
          invoice_status?: Database["public"]["Enums"]["dispatch_invoice_status"]
          job_id?: string | null
          job_name?: string | null
          job_number?: string | null
          load_quantity?: number | null
          material?: string | null
          notes?: string | null
          pickup_location?: string | null
          po_number?: string | null
          rate_amount?: number | null
          rate_type?: Database["public"]["Enums"]["dispatch_rate_type"] | null
          sort_order?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["dispatch_status"]
          truck_number?: string | null
          updated_at?: string
        }
        Update: {
          bill_to?: string | null
          billed_quantity?: number | null
          billing_notes?: string | null
          billing_total?: number | null
          created_at?: string
          created_by?: string | null
          customer?: string | null
          dispatch_date?: string
          driver_name?: string | null
          driver_user_id?: string | null
          dump_location?: string | null
          gc?: string | null
          id?: string
          invoice_status?: Database["public"]["Enums"]["dispatch_invoice_status"]
          job_id?: string | null
          job_name?: string | null
          job_number?: string | null
          load_quantity?: number | null
          material?: string | null
          notes?: string | null
          pickup_location?: string | null
          po_number?: string | null
          rate_amount?: number | null
          rate_type?: Database["public"]["Enums"]["dispatch_rate_type"] | null
          sort_order?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["dispatch_status"]
          truck_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employee_benefits: {
        Row: {
          annual_value: number
          benefit_type_id: string
          created_at: string
          created_by: string | null
          effective_date: string
          end_date: string | null
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_value: number
          benefit_type_id: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_value?: number
          benefit_type_id?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_benefits_benefit_type_id_fkey"
            columns: ["benefit_type_id"]
            isOneToOne: false
            referencedRelation: "benefit_types"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_compensation_history: {
        Row: {
          base_salary: number
          benefits_value: number
          bonus: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          total_compensation: number | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          base_salary?: number
          benefits_value?: number
          bonus?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          total_compensation?: number | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          base_salary?: number
          benefits_value?: number
          bonus?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          total_compensation?: number | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      employee_contacts: {
        Row: {
          address: string | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_name: string | null
          bank_routing_number: string | null
          converted_user_id: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          department: string | null
          drivers_license_class: string | null
          drivers_license_expires: string | null
          drivers_license_number: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string | null
          hire_date: string | null
          id: string
          is_active: boolean
          job_title: string | null
          last_name: string | null
          manager_contact_id: string | null
          middle_initial: string | null
          name: string
          notes: string | null
          osha_card_number: string | null
          osha_expires: string | null
          other_certifications: string | null
          personal_email: string | null
          phone: string | null
          ssn: string | null
          terminated_by: string | null
          termination_date: string | null
          termination_reason: string | null
          updated_at: string
          work_email: string | null
        }
        Insert: {
          address?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          converted_user_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department?: string | null
          drivers_license_class?: string | null
          drivers_license_expires?: string | null
          drivers_license_number?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_name?: string | null
          manager_contact_id?: string | null
          middle_initial?: string | null
          name: string
          notes?: string | null
          osha_card_number?: string | null
          osha_expires?: string | null
          other_certifications?: string | null
          personal_email?: string | null
          phone?: string | null
          ssn?: string | null
          terminated_by?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string
          work_email?: string | null
        }
        Update: {
          address?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          converted_user_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department?: string | null
          drivers_license_class?: string | null
          drivers_license_expires?: string | null
          drivers_license_number?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_name?: string | null
          manager_contact_id?: string | null
          middle_initial?: string | null
          name?: string
          notes?: string | null
          osha_card_number?: string | null
          osha_expires?: string | null
          other_certifications?: string | null
          personal_email?: string | null
          phone?: string | null
          ssn?: string | null
          terminated_by?: string | null
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string
          work_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_contacts_manager_contact_id_fkey"
            columns: ["manager_contact_id"]
            isOneToOne: false
            referencedRelation: "employee_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_positions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          end_date: string | null
          id: string
          is_salaried: boolean
          notes: string | null
          pay_rate: number
          position_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          end_date?: string | null
          id?: string
          is_salaried?: boolean
          notes?: string | null
          pay_rate: number
          position_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          end_date?: string | null
          id?: string
          is_salaried?: boolean
          notes?: string | null
          pay_rate?: number
          position_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_items: {
        Row: {
          created_at: string
          daily_rate: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_rate?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_rate?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      equipment_rentals: {
        Row: {
          created_at: string
          end_date: string
          equipment_id: string
          equipment_name: string
          id: string
          notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["equipment_rental_status"]
          updated_at: string
          user_id: string
          waiver_agreed_at: string
          waiver_name: string
          waiver_signature_path: string
          waiver_text: string
        }
        Insert: {
          created_at?: string
          end_date: string
          equipment_id: string
          equipment_name: string
          id?: string
          notes?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["equipment_rental_status"]
          updated_at?: string
          user_id: string
          waiver_agreed_at?: string
          waiver_name: string
          waiver_signature_path: string
          waiver_text: string
        }
        Update: {
          created_at?: string
          end_date?: string
          equipment_id?: string
          equipment_name?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["equipment_rental_status"]
          updated_at?: string
          user_id?: string
          waiver_agreed_at?: string
          waiver_name?: string
          waiver_signature_path?: string
          waiver_text?: string
        }
        Relationships: []
      }
      handbook_documents: {
        Row: {
          created_at: string
          description: string | null
          file_path: string
          file_size: number | null
          id: string
          is_current: boolean
          title: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
          version: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          is_current?: boolean
          title: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          is_current?: boolean
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          version?: string | null
        }
        Relationships: []
      }
      job_contact_template_slots: {
        Row: {
          category: string
          created_at: string
          default_name: string | null
          id: string
          is_active: boolean
          material: string | null
          role_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          default_name?: string | null
          id?: string
          is_active?: boolean
          material?: string | null
          role_label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_name?: string | null
          id?: string
          is_active?: boolean
          material?: string | null
          role_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      job_contacts: {
        Row: {
          address: string | null
          category: string | null
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          employee_contact_id: string | null
          id: string
          is_template_slot: boolean
          job_id: string
          manager: string | null
          material: string | null
          name: string | null
          notes: string | null
          phone: string | null
          role_label: string | null
          sort_order: number
          title: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          employee_contact_id?: string | null
          id?: string
          is_template_slot?: boolean
          job_id: string
          manager?: string | null
          material?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          role_label?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          employee_contact_id?: string | null
          id?: string
          is_template_slot?: boolean
          job_id?: string
          manager?: string | null
          material?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          role_label?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_contacts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_estimates: {
        Row: {
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          job_id: string
          mime_type: string | null
          notes: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          job_id: string
          mime_type?: string | null
          notes?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          job_id?: string
          mime_type?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: []
      }
      job_exclusions: {
        Row: {
          body: string
          created_at: string
          id: string
          job_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          job_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          job_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_exclusions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          job_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          job_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          job_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_permits: {
        Row: {
          created_at: string
          created_by: string | null
          expiration_date: string | null
          file_path: string | null
          file_size: number | null
          id: string
          issue_date: string | null
          issuing_agency: string | null
          job_id: string
          mime_type: string | null
          notes: string | null
          permit_number: string | null
          permit_type: string
          responsible_name: string | null
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["permit_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          issue_date?: string | null
          issuing_agency?: string | null
          job_id: string
          mime_type?: string | null
          notes?: string | null
          permit_number?: string | null
          permit_type: string
          responsible_name?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["permit_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          issue_date?: string | null
          issuing_agency?: string | null
          job_id?: string
          mime_type?: string | null
          notes?: string | null
          permit_number?: string | null
          permit_type?: string
          responsible_name?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["permit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_permits_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          caption: string | null
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          job_id: string
          mime_type: string | null
          taken_on: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          job_id: string
          mime_type?: string | null
          taken_on?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          job_id?: string
          mime_type?: string | null
          taken_on?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: []
      }
      job_plans: {
        Row: {
          category: Database["public"]["Enums"]["plan_category"]
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          is_current: boolean
          job_id: string
          mime_type: string | null
          notes: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
          version: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["plan_category"]
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          is_current?: boolean
          job_id: string
          mime_type?: string | null
          notes?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          version?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["plan_category"]
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_current?: boolean
          job_id?: string
          mime_type?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_plans_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_scope_items: {
        Row: {
          body: string
          created_at: string
          id: string
          job_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          job_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          job_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      job_submittals: {
        Row: {
          approved_at: string | null
          created_at: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          job_id: string
          mime_type: string | null
          notes: string | null
          sort_order: number
          status: Database["public"]["Enums"]["submittal_status"]
          submitted_at: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          job_id: string
          mime_type?: string | null
          notes?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["submittal_status"]
          submitted_at?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          job_id?: string
          mime_type?: string | null
          notes?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["submittal_status"]
          submitted_at?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: []
      }
      job_unit_pricing: {
        Row: {
          code: string
          created_at: string
          id: string
          job_id: string
          name: string
          price: number
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          job_id: string
          name: string
          price: number
          sort_order?: number
          unit: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          job_id?: string
          name?: string
          price?: number
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_unit_pricing_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string | null
          contract_file_name: string | null
          contract_file_path: string | null
          contract_uploaded_at: string | null
          contract_uploaded_by: string | null
          created_at: string
          created_by: string | null
          customer: string | null
          end_date: string | null
          foreman_id: string | null
          gc: string | null
          id: string
          job_number: string | null
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          on_site_contact_name: string | null
          on_site_contact_phone: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          contract_file_name?: string | null
          contract_file_path?: string | null
          contract_uploaded_at?: string | null
          contract_uploaded_by?: string | null
          created_at?: string
          created_by?: string | null
          customer?: string | null
          end_date?: string | null
          foreman_id?: string | null
          gc?: string | null
          id?: string
          job_number?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          on_site_contact_name?: string | null
          on_site_contact_phone?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          contract_file_name?: string | null
          contract_file_path?: string | null
          contract_uploaded_at?: string | null
          contract_uploaded_by?: string | null
          created_at?: string
          created_by?: string | null
          customer?: string | null
          end_date?: string | null
          foreman_id?: string | null
          gc?: string | null
          id?: string
          job_number?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          on_site_contact_name?: string | null
          on_site_contact_phone?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link_url: string | null
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link_url?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_url?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_document_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_path: string
          file_size: number | null
          id: string
          is_active: boolean
          is_built_in: boolean
          mime_type: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          is_built_in?: boolean
          mime_type?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          is_built_in?: boolean
          mime_type?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_documents: {
        Row: {
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          id: string
          sent_at: string
          sent_by: string | null
          signed_at: string | null
          signed_file_path: string | null
          source_file_path: string
          status: Database["public"]["Enums"]["onboarding_doc_status"]
          template_id: string | null
          title: string
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          sent_at?: string
          sent_by?: string | null
          signed_at?: string | null
          signed_file_path?: string | null
          source_file_path: string
          status?: Database["public"]["Enums"]["onboarding_doc_status"]
          template_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          sent_at?: string
          sent_by?: string | null
          signed_at?: string | null
          signed_file_path?: string | null
          source_file_path?: string
          status?: Database["public"]["Enums"]["onboarding_doc_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_signatures: {
        Row: {
          document_id: string
          id: string
          signature_image: string
          signed_at: string
          signed_ip: string | null
          signed_user_agent: string | null
          typed_name: string
          user_id: string
        }
        Insert: {
          document_id: string
          id?: string
          signature_image: string
          signed_at?: string
          signed_ip?: string | null
          signed_user_agent?: string | null
          typed_name: string
          user_id: string
        }
        Update: {
          document_id?: string
          id?: string
          signature_image?: string
          signed_at?: string
          signed_ip?: string | null
          signed_user_agent?: string | null
          typed_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "onboarding_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      org_chart_nodes: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          name: string
          parent_id: string | null
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_chart_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "org_chart_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_audit_log: {
        Row: {
          action: string
          affected_user_id: string | null
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          affected_user_id?: string | null
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          affected_user_id?: string | null
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      performance_reviews: {
        Row: {
          acknowledged_at: string | null
          areas_for_improvement: string | null
          attendance: number | null
          comments: string | null
          created_at: string
          created_by: string | null
          employee_acknowledgment: string | null
          employee_name: string | null
          employee_user_id: string
          goals: string | null
          id: string
          overall_rating: number | null
          productivity: number | null
          quality_of_work: number | null
          review_date: string
          review_period_end: string | null
          review_period_start: string | null
          reviewer_name: string | null
          reviewer_user_id: string | null
          safety: number | null
          status: Database["public"]["Enums"]["performance_review_status"]
          strengths: string | null
          teamwork: number | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          areas_for_improvement?: string | null
          attendance?: number | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          employee_acknowledgment?: string | null
          employee_name?: string | null
          employee_user_id: string
          goals?: string | null
          id?: string
          overall_rating?: number | null
          productivity?: number | null
          quality_of_work?: number | null
          review_date?: string
          review_period_end?: string | null
          review_period_start?: string | null
          reviewer_name?: string | null
          reviewer_user_id?: string | null
          safety?: number | null
          status?: Database["public"]["Enums"]["performance_review_status"]
          strengths?: string | null
          teamwork?: number | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          areas_for_improvement?: string | null
          attendance?: number | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          employee_acknowledgment?: string | null
          employee_name?: string | null
          employee_user_id?: string
          goals?: string | null
          id?: string
          overall_rating?: number | null
          productivity?: number | null
          quality_of_work?: number | null
          review_date?: string
          review_period_end?: string | null
          review_period_start?: string | null
          reviewer_name?: string | null
          reviewer_user_id?: string | null
          safety?: number | null
          status?: Database["public"]["Enums"]["performance_review_status"]
          strengths?: string | null
          teamwork?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_salaried: boolean
          max_pay_rate: number
          min_pay_rate: number
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_salaried?: boolean
          max_pay_rate: number
          min_pay_rate: number
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_salaried?: boolean
          max_pay_rate?: number
          min_pay_rate?: number
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          contact_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_active: boolean
          is_driver: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_driver?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_driver?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "employee_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          fee_amount: number | null
          id: string
          notes: string | null
          paid_at: string | null
          referee_email: string | null
          referee_name: string
          referee_phone: string | null
          referrer_name: string | null
          referrer_user_id: string
          relationship: string | null
          status: Database["public"]["Enums"]["referral_status"]
          type: Database["public"]["Enums"]["referral_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_amount?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          referee_email?: string | null
          referee_name: string
          referee_phone?: string | null
          referrer_name?: string | null
          referrer_user_id: string
          relationship?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          type: Database["public"]["Enums"]["referral_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_amount?: number | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          referee_email?: string | null
          referee_name?: string
          referee_phone?: string | null
          referrer_name?: string | null
          referrer_user_id?: string
          relationship?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          type?: Database["public"]["Enums"]["referral_type"]
          updated_at?: string
        }
        Relationships: []
      }
      safety_inspections: {
        Row: {
          created_at: string
          id: string
          job_id: string
          notes: string | null
          recipient_email: string
          requested_by: string | null
          requested_by_name: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          recipient_email: string
          requested_by?: string | null
          requested_by_name?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          recipient_email?: string
          requested_by?: string | null
          requested_by_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_inspections_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_rules: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      safety_violations: {
        Row: {
          comments: string | null
          created_at: string
          department: string | null
          disciplinary_action: Database["public"]["Enums"]["violation_disciplinary_action"]
          employee_acknowledged: boolean
          employee_contact_id: string | null
          employee_name: string
          employee_signature_path: string | null
          filed_by: string
          filed_by_name: string
          id: string
          job_id: string | null
          job_name_snapshot: string | null
          job_number_snapshot: string | null
          office_notes: string | null
          photo_paths: string[]
          status: Database["public"]["Enums"]["violation_status"]
          supervisor_signature_path: string | null
          suspension_from: string | null
          suspension_to: string | null
          updated_at: string
          violation_date: string
          violations: Json
        }
        Insert: {
          comments?: string | null
          created_at?: string
          department?: string | null
          disciplinary_action?: Database["public"]["Enums"]["violation_disciplinary_action"]
          employee_acknowledged?: boolean
          employee_contact_id?: string | null
          employee_name: string
          employee_signature_path?: string | null
          filed_by: string
          filed_by_name: string
          id?: string
          job_id?: string | null
          job_name_snapshot?: string | null
          job_number_snapshot?: string | null
          office_notes?: string | null
          photo_paths?: string[]
          status?: Database["public"]["Enums"]["violation_status"]
          supervisor_signature_path?: string | null
          suspension_from?: string | null
          suspension_to?: string | null
          updated_at?: string
          violation_date: string
          violations?: Json
        }
        Update: {
          comments?: string | null
          created_at?: string
          department?: string | null
          disciplinary_action?: Database["public"]["Enums"]["violation_disciplinary_action"]
          employee_acknowledged?: boolean
          employee_contact_id?: string | null
          employee_name?: string
          employee_signature_path?: string | null
          filed_by?: string
          filed_by_name?: string
          id?: string
          job_id?: string | null
          job_name_snapshot?: string | null
          job_number_snapshot?: string | null
          office_notes?: string | null
          photo_paths?: string[]
          status?: Database["public"]["Enums"]["violation_status"]
          supervisor_signature_path?: string | null
          suspension_from?: string | null
          suspension_to?: string | null
          updated_at?: string
          violation_date?: string
          violations?: Json
        }
        Relationships: []
      }
      schedule_assignments: {
        Row: {
          assignment_date: string
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          notes: string | null
          role_on_job: string | null
          start_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          notes?: string | null
          role_on_job?: string | null
          start_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          role_on_job?: string | null
          start_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_reservations: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          purpose: string
          reserved_date: string
          status: Database["public"]["Enums"]["shop_reservation_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          purpose: string
          reserved_date: string
          status?: Database["public"]["Enums"]["shop_reservation_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          purpose?: string
          reserved_date?: string
          status?: Database["public"]["Enums"]["shop_reservation_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      swpppp_reports: {
        Row: {
          created_at: string
          email_from: string | null
          email_received_at: string | null
          email_subject: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          job_id: string
          mime_type: string | null
          notes: string | null
          report_date: string | null
          source: string
          title: string | null
          updated_at: string
          uploaded_by: string | null
          uploaded_by_name: string | null
          week_of: string
        }
        Insert: {
          created_at?: string
          email_from?: string | null
          email_received_at?: string | null
          email_subject?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          job_id: string
          mime_type?: string | null
          notes?: string | null
          report_date?: string | null
          source?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          week_of: string
        }
        Update: {
          created_at?: string
          email_from?: string | null
          email_received_at?: string | null
          email_subject?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          job_id?: string
          mime_type?: string | null
          notes?: string | null
          report_date?: string | null
          source?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          week_of?: string
        }
        Relationships: []
      }
      time_off_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          denial_reason: string | null
          end_date: string
          half_day: Database["public"]["Enums"]["time_off_half_day"]
          id: string
          invites_sent_at: string | null
          reason: string | null
          requester_name: string | null
          start_date: string
          status: Database["public"]["Enums"]["time_off_status"]
          type: Database["public"]["Enums"]["time_off_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          denial_reason?: string | null
          end_date: string
          half_day?: Database["public"]["Enums"]["time_off_half_day"]
          id?: string
          invites_sent_at?: string | null
          reason?: string | null
          requester_name?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["time_off_status"]
          type?: Database["public"]["Enums"]["time_off_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          denial_reason?: string | null
          end_date?: string
          half_day?: Database["public"]["Enums"]["time_off_half_day"]
          id?: string
          invites_sent_at?: string | null
          reason?: string | null
          requester_name?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["time_off_status"]
          type?: Database["public"]["Enums"]["time_off_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      toolbox_talk_attendees: {
        Row: {
          access_token: string | null
          attendee_name: string
          created_at: string
          id: string
          initial_quiz_score: number | null
          initial_quiz_total: number | null
          notified_at: string | null
          notify_channel: string | null
          phone_snapshot: string | null
          quiz_answers: Json | null
          quiz_attempts: number
          quiz_completed_at: string | null
          quiz_score: number | null
          quiz_total: number | null
          session_id: string
          signature_data: string | null
          signed_at: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          attendee_name: string
          created_at?: string
          id?: string
          initial_quiz_score?: number | null
          initial_quiz_total?: number | null
          notified_at?: string | null
          notify_channel?: string | null
          phone_snapshot?: string | null
          quiz_answers?: Json | null
          quiz_attempts?: number
          quiz_completed_at?: string | null
          quiz_score?: number | null
          quiz_total?: number | null
          session_id: string
          signature_data?: string | null
          signed_at?: string | null
          source?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          attendee_name?: string
          created_at?: string
          id?: string
          initial_quiz_score?: number | null
          initial_quiz_total?: number | null
          notified_at?: string | null
          notify_channel?: string | null
          phone_snapshot?: string | null
          quiz_answers?: Json | null
          quiz_attempts?: number
          quiz_completed_at?: string | null
          quiz_score?: number | null
          quiz_total?: number | null
          session_id?: string
          signature_data?: string | null
          signed_at?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_talk_attendees_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "toolbox_talk_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_talk_sessions: {
        Row: {
          audio_path: string | null
          completed_at: string | null
          created_at: string
          delivery_mode: string
          foreman_id: string
          foreman_name: string | null
          id: string
          job_id: string | null
          recording_started_at: string | null
          recording_stopped_at: string | null
          started_at: string
          status: string
          talk_id: string
          topic_source: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          audio_path?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_mode?: string
          foreman_id: string
          foreman_name?: string | null
          id?: string
          job_id?: string | null
          recording_started_at?: string | null
          recording_stopped_at?: string | null
          started_at?: string
          status?: string
          talk_id: string
          topic_source?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          audio_path?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_mode?: string
          foreman_id?: string
          foreman_name?: string | null
          id?: string
          job_id?: string | null
          recording_started_at?: string | null
          recording_stopped_at?: string | null
          started_at?: string
          status?: string
          talk_id?: string
          topic_source?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_talk_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toolbox_talk_sessions_talk_id_fkey"
            columns: ["talk_id"]
            isOneToOne: false
            referencedRelation: "toolbox_talks"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_talks: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          created_with_ai: boolean
          id: string
          image_url: string | null
          is_active: boolean
          quiz_questions: Json
          title: string
          updated_at: string
          video_url: string | null
          voice_script: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          created_with_ai?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          quiz_questions?: Json
          title: string
          updated_at?: string
          video_url?: string | null
          voice_script?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          created_with_ai?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          quiz_questions?: Json
          title?: string
          updated_at?: string
          video_url?: string | null
          voice_script?: string | null
        }
        Relationships: []
      }
      truck_requests: {
        Row: {
          assigned_driver_name: string | null
          assigned_driver_user_id: string | null
          assigned_truck_number: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          dispatch_order_id: string | null
          dump_location: string | null
          id: string
          job_id: string
          load_quantity: number | null
          material: string | null
          pickup_location: string | null
          requested_date: string
          requester_id: string | null
          requester_name: string | null
          requester_notes: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["truck_request_status"]
          updated_at: string
        }
        Insert: {
          assigned_driver_name?: string | null
          assigned_driver_user_id?: string | null
          assigned_truck_number?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          dispatch_order_id?: string | null
          dump_location?: string | null
          id?: string
          job_id: string
          load_quantity?: number | null
          material?: string | null
          pickup_location?: string | null
          requested_date: string
          requester_id?: string | null
          requester_name?: string | null
          requester_notes?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["truck_request_status"]
          updated_at?: string
        }
        Update: {
          assigned_driver_name?: string | null
          assigned_driver_user_id?: string | null
          assigned_truck_number?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          dispatch_order_id?: string | null
          dump_location?: string | null
          id?: string
          job_id?: string
          load_quantity?: number | null
          material?: string | null
          pickup_location?: string | null
          requested_date?: string
          requester_id?: string | null
          requester_name?: string | null
          requester_notes?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["truck_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_requests_dispatch_order_id_fkey"
            columns: ["dispatch_order_id"]
            isOneToOne: false
            referencedRelation: "dispatch_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          category: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      positions_public: {
        Row: {
          description: string | null
          id: string | null
          is_active: boolean | null
          is_salaried: boolean | null
          sort_order: number | null
          title: string | null
        }
        Insert: {
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          is_salaried?: boolean | null
          sort_order?: number | null
          title?: string | null
        }
        Update: {
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          is_salaried?: boolean | null
          sort_order?: number | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_role: {
        Args: {
          _body: string
          _kind: string
          _link: string
          _metadata?: Json
          _role: Database["public"]["Enums"]["app_role"]
          _title: string
        }
        Returns: undefined
      }
      notify_user: {
        Args: {
          _body: string
          _kind: string
          _link: string
          _metadata?: Json
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      seed_job_contact_slots: { Args: { _job_id: string }; Returns: undefined }
    }
    Enums: {
      accident_incident_type:
        | "injury"
        | "near_miss"
        | "property_damage"
        | "vehicle"
        | "other"
      accident_severity:
        | "none"
        | "first_aid"
        | "medical_treatment"
        | "lost_time"
        | "fatality"
      accident_status: "submitted" | "in_review" | "closed"
      app_role: "employee" | "foreman" | "office" | "admin"
      clothing_order_status:
        | "requested"
        | "ordered"
        | "received"
        | "distributed"
        | "cancelled"
      dig_ticket_request_type: "normal" | "emergency" | "update" | "remark"
      dig_ticket_status:
        | "requested"
        | "marked"
        | "cleared"
        | "expired"
        | "cancelled"
      dispatch_invoice_status: "not_billed" | "billed" | "paid"
      dispatch_rate_type: "hourly" | "per_load" | "per_ton" | "flat" | "other"
      dispatch_status: "scheduled" | "in_progress" | "complete" | "cancelled"
      equipment_rental_status:
        | "requested"
        | "approved"
        | "denied"
        | "picked_up"
        | "returned"
        | "cancelled"
      job_status: "active" | "on_hold" | "complete"
      onboarding_doc_status: "pending" | "viewed" | "signed" | "declined"
      performance_review_status: "draft" | "submitted" | "acknowledged"
      permit_status:
        | "not_started"
        | "applied"
        | "in_review"
        | "approved"
        | "issued"
        | "expired"
        | "denied"
      plan_category:
        | "civil"
        | "structural"
        | "plumbing"
        | "electrical"
        | "architectural"
        | "gps_model"
        | "surface"
        | "linework"
      referral_status:
        | "new"
        | "reviewing"
        | "hired_won"
        | "paid"
        | "closed"
        | "rejected"
      referral_type: "hire" | "job"
      shop_reservation_status:
        | "requested"
        | "approved"
        | "denied"
        | "completed"
        | "cancelled"
      submittal_status:
        | "pending"
        | "submitted"
        | "under_review"
        | "approved"
        | "revise_resubmit"
        | "rejected"
      time_off_half_day: "none" | "am" | "pm"
      time_off_status: "pending" | "approved" | "denied" | "cancelled"
      time_off_type: "vacation" | "sick" | "personal" | "other"
      truck_request_status: "pending" | "approved" | "declined" | "cancelled"
      violation_disciplinary_action:
        | "verbal"
        | "written"
        | "suspension"
        | "termination"
      violation_status: "open" | "acknowledged" | "resolved"
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
    Enums: {
      accident_incident_type: [
        "injury",
        "near_miss",
        "property_damage",
        "vehicle",
        "other",
      ],
      accident_severity: [
        "none",
        "first_aid",
        "medical_treatment",
        "lost_time",
        "fatality",
      ],
      accident_status: ["submitted", "in_review", "closed"],
      app_role: ["employee", "foreman", "office", "admin"],
      clothing_order_status: [
        "requested",
        "ordered",
        "received",
        "distributed",
        "cancelled",
      ],
      dig_ticket_request_type: ["normal", "emergency", "update", "remark"],
      dig_ticket_status: [
        "requested",
        "marked",
        "cleared",
        "expired",
        "cancelled",
      ],
      dispatch_invoice_status: ["not_billed", "billed", "paid"],
      dispatch_rate_type: ["hourly", "per_load", "per_ton", "flat", "other"],
      dispatch_status: ["scheduled", "in_progress", "complete", "cancelled"],
      equipment_rental_status: [
        "requested",
        "approved",
        "denied",
        "picked_up",
        "returned",
        "cancelled",
      ],
      job_status: ["active", "on_hold", "complete"],
      onboarding_doc_status: ["pending", "viewed", "signed", "declined"],
      performance_review_status: ["draft", "submitted", "acknowledged"],
      permit_status: [
        "not_started",
        "applied",
        "in_review",
        "approved",
        "issued",
        "expired",
        "denied",
      ],
      plan_category: [
        "civil",
        "structural",
        "plumbing",
        "electrical",
        "architectural",
        "gps_model",
        "surface",
        "linework",
      ],
      referral_status: [
        "new",
        "reviewing",
        "hired_won",
        "paid",
        "closed",
        "rejected",
      ],
      referral_type: ["hire", "job"],
      shop_reservation_status: [
        "requested",
        "approved",
        "denied",
        "completed",
        "cancelled",
      ],
      submittal_status: [
        "pending",
        "submitted",
        "under_review",
        "approved",
        "revise_resubmit",
        "rejected",
      ],
      time_off_half_day: ["none", "am", "pm"],
      time_off_status: ["pending", "approved", "denied", "cancelled"],
      time_off_type: ["vacation", "sick", "personal", "other"],
      truck_request_status: ["pending", "approved", "declined", "cancelled"],
      violation_disciplinary_action: [
        "verbal",
        "written",
        "suspension",
        "termination",
      ],
      violation_status: ["open", "acknowledged", "resolved"],
    },
  },
} as const
