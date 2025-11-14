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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      customer_analytics: {
        Row: {
          avg_rating_given: number | null
          created_at: string | null
          customer_segment: string | null
          days_since_last_visit: number | null
          first_order_date: string | null
          first_waitlist_date: string | null
          id: string
          last_order_date: string | null
          last_waitlist_date: string | null
          total_orders: number | null
          total_waitlist_joins: number | null
          updated_at: string | null
          user_id: string | null
          venue_id: string | null
          visit_frequency_days: number | null
        }
        Insert: {
          avg_rating_given?: number | null
          created_at?: string | null
          customer_segment?: string | null
          days_since_last_visit?: number | null
          first_order_date?: string | null
          first_waitlist_date?: string | null
          id?: string
          last_order_date?: string | null
          last_waitlist_date?: string | null
          total_orders?: number | null
          total_waitlist_joins?: number | null
          updated_at?: string | null
          user_id?: string | null
          venue_id?: string | null
          visit_frequency_days?: number | null
        }
        Update: {
          avg_rating_given?: number | null
          created_at?: string | null
          customer_segment?: string | null
          days_since_last_visit?: number | null
          first_order_date?: string | null
          first_waitlist_date?: string | null
          id?: string
          last_order_date?: string | null
          last_waitlist_date?: string | null
          total_orders?: number | null
          total_waitlist_joins?: number | null
          updated_at?: string | null
          user_id?: string | null
          venue_id?: string | null
          visit_frequency_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_analytics_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_venue_snapshots: {
        Row: {
          avg_prep_time_minutes: number | null
          avg_rating: number | null
          avg_wait_time_minutes: number | null
          completed_orders: number | null
          created_at: string | null
          id: string
          new_customers: number | null
          on_time_percentage: number | null
          returning_customers: number | null
          snapshot_date: string
          total_customers: number | null
          total_orders: number | null
          total_waitlist_joins: number | null
          venue_id: string | null
        }
        Insert: {
          avg_prep_time_minutes?: number | null
          avg_rating?: number | null
          avg_wait_time_minutes?: number | null
          completed_orders?: number | null
          created_at?: string | null
          id?: string
          new_customers?: number | null
          on_time_percentage?: number | null
          returning_customers?: number | null
          snapshot_date: string
          total_customers?: number | null
          total_orders?: number | null
          total_waitlist_joins?: number | null
          venue_id?: string | null
        }
        Update: {
          avg_prep_time_minutes?: number | null
          avg_rating?: number | null
          avg_wait_time_minutes?: number | null
          completed_orders?: number | null
          created_at?: string | null
          id?: string
          new_customers?: number | null
          on_time_percentage?: number | null
          returning_customers?: number | null
          snapshot_date?: string
          total_customers?: number | null
          total_orders?: number | null
          total_waitlist_joins?: number | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_venue_snapshots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      order_analytics: {
        Row: {
          actual_prep_time: number | null
          collected_at: string | null
          created_at: string
          day_of_week: number
          delay_reason: string | null
          hour_of_day: number
          id: string
          in_prep_at: string | null
          items_count: number
          order_id: string
          placed_at: string
          quoted_prep_time: number
          ready_at: string | null
          venue_id: string
        }
        Insert: {
          actual_prep_time?: number | null
          collected_at?: string | null
          created_at?: string
          day_of_week: number
          delay_reason?: string | null
          hour_of_day: number
          id?: string
          in_prep_at?: string | null
          items_count?: number
          order_id: string
          placed_at: string
          quoted_prep_time: number
          ready_at?: string | null
          venue_id: string
        }
        Update: {
          actual_prep_time?: number | null
          collected_at?: string | null
          created_at?: string
          day_of_week?: number
          delay_reason?: string | null
          hour_of_day?: number
          id?: string
          in_prep_at?: string | null
          items_count?: number
          order_id?: string
          placed_at?: string
          quoted_prep_time?: number
          ready_at?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_analytics_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_analytics_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      order_ratings: {
        Row: {
          created_at: string
          feedback_text: string | null
          id: string
          order_id: string
          rating: number
          user_id: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          order_id: string
          rating: number
          user_id?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          order_id?: string
          rating?: number
          user_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_ratings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          awaiting_merchant_confirmation: boolean | null
          awaiting_patron_confirmation: boolean | null
          confidence: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          eta: string | null
          id: string
          items: Json
          marked_ready_by_staff_id: string | null
          notes: string | null
          order_number: string
          prepared_by_staff_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string | null
          venue_id: string
        }
        Insert: {
          awaiting_merchant_confirmation?: boolean | null
          awaiting_patron_confirmation?: boolean | null
          confidence?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          eta?: string | null
          id?: string
          items?: Json
          marked_ready_by_staff_id?: string | null
          notes?: string | null
          order_number: string
          prepared_by_staff_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string | null
          venue_id: string
        }
        Update: {
          awaiting_merchant_confirmation?: boolean | null
          awaiting_patron_confirmation?: boolean | null
          confidence?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          eta?: string | null
          id?: string
          items?: Json
          marked_ready_by_staff_id?: string | null
          notes?: string | null
          order_number?: string
          prepared_by_staff_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_marked_ready_by_staff_id_fkey"
            columns: ["marked_ready_by_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_prepared_by_staff_id_fkey"
            columns: ["prepared_by_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          email_verified: boolean | null
          fcm_token: string | null
          full_name: string
          id: string
          last_verification_sent_at: string | null
          phone: string | null
          phone_verified: boolean | null
          updated_at: string
          verification_attempts: number | null
          verification_code: string | null
          verification_code_expires_at: string | null
          verification_method: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          fcm_token?: string | null
          full_name: string
          id: string
          last_verification_sent_at?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string
          verification_attempts?: number | null
          verification_code?: string | null
          verification_code_expires_at?: string | null
          verification_method?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          fcm_token?: string | null
          full_name?: string
          id?: string
          last_verification_sent_at?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string
          verification_attempts?: number | null
          verification_code?: string | null
          verification_code_expires_at?: string | null
          verification_method?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_capacity_snapshots: {
        Row: {
          current_orders: number
          current_waitlist: number
          day_of_week: number
          hour_of_day: number
          id: string
          tables_occupied: number | null
          timestamp: string
          venue_id: string
        }
        Insert: {
          current_orders?: number
          current_waitlist?: number
          day_of_week: number
          hour_of_day: number
          id?: string
          tables_occupied?: number | null
          timestamp?: string
          venue_id: string
        }
        Update: {
          current_orders?: number
          current_waitlist?: number
          day_of_week?: number
          hour_of_day?: number
          id?: string
          tables_occupied?: number | null
          timestamp?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_capacity_snapshots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          service_types: string[] | null
          settings: Json | null
          updated_at: string
          waitlist_preferences: Json | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          service_types?: string[] | null
          settings?: Json | null
          updated_at?: string
          waitlist_preferences?: Json | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          service_types?: string[] | null
          settings?: Json | null
          updated_at?: string
          waitlist_preferences?: Json | null
        }
        Relationships: []
      }
      waitlist_analytics: {
        Row: {
          actual_wait_time: number | null
          created_at: string
          day_of_week: number
          entry_id: string
          hour_of_day: number
          id: string
          joined_at: string
          party_size: number
          quoted_wait_time: number
          ready_at: string | null
          seated_at: string | null
          venue_id: string
          was_no_show: boolean | null
        }
        Insert: {
          actual_wait_time?: number | null
          created_at?: string
          day_of_week: number
          entry_id: string
          hour_of_day: number
          id?: string
          joined_at: string
          party_size: number
          quoted_wait_time: number
          ready_at?: string | null
          seated_at?: string | null
          venue_id: string
          was_no_show?: boolean | null
        }
        Update: {
          actual_wait_time?: number | null
          created_at?: string
          day_of_week?: number
          entry_id?: string
          hour_of_day?: number
          id?: string
          joined_at?: string
          party_size?: number
          quoted_wait_time?: number
          ready_at?: string | null
          seated_at?: string | null
          venue_id?: string
          was_no_show?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_analytics_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "waitlist_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_analytics_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          awaiting_merchant_confirmation: boolean | null
          cancellation_reason: string | null
          confidence: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          delayed_until: string | null
          eta: string | null
          id: string
          party_size: number
          patron_delayed: boolean | null
          position: number | null
          preferences: string[] | null
          reservation_time: string | null
          reservation_type: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
          user_id: string | null
          venue_id: string
        }
        Insert: {
          awaiting_merchant_confirmation?: boolean | null
          cancellation_reason?: string | null
          confidence?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          delayed_until?: string | null
          eta?: string | null
          id?: string
          party_size?: number
          patron_delayed?: boolean | null
          position?: number | null
          preferences?: string[] | null
          reservation_time?: string | null
          reservation_type?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          user_id?: string | null
          venue_id: string
        }
        Update: {
          awaiting_merchant_confirmation?: boolean | null
          cancellation_reason?: string | null
          confidence?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          delayed_until?: string | null
          eta?: string | null
          id?: string
          party_size?: number
          patron_delayed?: boolean | null
          position?: number | null
          preferences?: string[] | null
          reservation_time?: string | null
          reservation_type?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          user_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_ratings: {
        Row: {
          created_at: string
          feedback_text: string | null
          id: string
          rating: number
          updated_at: string
          user_id: string | null
          venue_id: string
          waitlist_entry_id: string
        }
        Insert: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          rating: number
          updated_at?: string
          user_id?: string | null
          venue_id: string
          waitlist_entry_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string | null
          venue_id?: string
          waitlist_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_ratings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_ratings_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "waitlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_dynamic_prep_time: {
        Args: {
          p_current_load?: number
          p_day_of_week: number
          p_hour: number
          p_venue_id: string
        }
        Returns: {
          base_time: number
          confidence_score: number
          data_points: number
          estimated_minutes: number
          load_multiplier: number
        }[]
      }
      calculate_dynamic_wait_time: {
        Args: {
          p_current_waitlist_length?: number
          p_day_of_week: number
          p_hour: number
          p_party_size: number
          p_venue_id: string
        }
        Returns: {
          base_time: number
          confidence_score: number
          data_points: number
          estimated_minutes: number
          party_size_factor: number
          position_multiplier: number
        }[]
      }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_venue: { Args: { _user_id: string }; Returns: string }
      get_venue_capacity_status: {
        Args: { p_venue_id: string }
        Returns: {
          capacity_percentage: number
          current_orders: number
          current_waitlist: number
          is_busy: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      notify_user_via_push: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      update_customer_days_since_visit: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "staff" | "super_admin" | "patron"
      order_status:
        | "awaiting_verification"
        | "placed"
        | "in_prep"
        | "ready"
        | "collected"
        | "no_show"
        | "rejected"
      waitlist_status: "waiting" | "ready" | "seated" | "cancelled" | "no_show"
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
      app_role: ["admin", "staff", "super_admin", "patron"],
      order_status: [
        "awaiting_verification",
        "placed",
        "in_prep",
        "ready",
        "collected",
        "no_show",
        "rejected",
      ],
      waitlist_status: ["waiting", "ready", "seated", "cancelled", "no_show"],
    },
  },
} as const
