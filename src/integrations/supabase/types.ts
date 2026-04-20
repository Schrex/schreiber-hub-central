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
          created_at: string
          created_by: string | null
          customer: string | null
          dispatch_date: string
          driver_name: string | null
          driver_user_id: string | null
          dump_location: string | null
          gc: string | null
          id: string
          job_id: string | null
          job_name: string | null
          load_quantity: number | null
          material: string | null
          notes: string | null
          pickup_location: string | null
          sort_order: number
          start_time: string | null
          status: Database["public"]["Enums"]["dispatch_status"]
          truck_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer?: string | null
          dispatch_date?: string
          driver_name?: string | null
          driver_user_id?: string | null
          dump_location?: string | null
          gc?: string | null
          id?: string
          job_id?: string | null
          job_name?: string | null
          load_quantity?: number | null
          material?: string | null
          notes?: string | null
          pickup_location?: string | null
          sort_order?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["dispatch_status"]
          truck_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer?: string | null
          dispatch_date?: string
          driver_name?: string | null
          driver_user_id?: string | null
          dump_location?: string | null
          gc?: string | null
          id?: string
          job_id?: string | null
          job_name?: string | null
          load_quantity?: number | null
          material?: string | null
          notes?: string | null
          pickup_location?: string | null
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
      job_permits: {
        Row: {
          created_at: string
          created_by: string | null
          expiration_date: string | null
          id: string
          issue_date: string | null
          issuing_agency: string | null
          job_id: string
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
          id?: string
          issue_date?: string | null
          issuing_agency?: string | null
          job_id: string
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
          id?: string
          issue_date?: string | null
          issuing_agency?: string | null
          job_id?: string
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
      jobs: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          customer: string | null
          end_date: string | null
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
          created_at?: string
          created_by?: string | null
          customer?: string | null
          end_date?: string | null
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
          created_at?: string
          created_by?: string | null
          customer?: string | null
          end_date?: string | null
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
      profiles: {
        Row: {
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
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_driver?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
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
      dispatch_status: "scheduled" | "in_progress" | "complete" | "cancelled"
      job_status: "active" | "on_hold" | "complete"
      permit_status:
        | "not_started"
        | "applied"
        | "in_review"
        | "approved"
        | "issued"
        | "expired"
        | "denied"
      referral_status:
        | "new"
        | "reviewing"
        | "hired_won"
        | "paid"
        | "closed"
        | "rejected"
      referral_type: "hire" | "job"
      time_off_half_day: "none" | "am" | "pm"
      time_off_status: "pending" | "approved" | "denied" | "cancelled"
      time_off_type: "vacation" | "sick" | "personal" | "other"
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
      dispatch_status: ["scheduled", "in_progress", "complete", "cancelled"],
      job_status: ["active", "on_hold", "complete"],
      permit_status: [
        "not_started",
        "applied",
        "in_review",
        "approved",
        "issued",
        "expired",
        "denied",
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
      time_off_half_day: ["none", "am", "pm"],
      time_off_status: ["pending", "approved", "denied", "cancelled"],
      time_off_type: ["vacation", "sick", "personal", "other"],
    },
  },
} as const
