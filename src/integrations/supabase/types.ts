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
      ai_operations_log: {
        Row: {
          action_type: string
          created_at: string
          duration_ms: number | null
          id: string
          input_data: Json | null
          output_data: Json | null
          tokens_used: number | null
        }
        Insert: {
          action_type: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          tokens_used?: number | null
        }
        Update: {
          action_type?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          tokens_used?: number | null
        }
        Relationships: []
      }
      alert_rules: {
        Row: {
          comparison: string
          cooldown_minutes: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          metric: string
          notification_channel: string
          threshold: number
          updated_at: string
        }
        Insert: {
          comparison?: string
          cooldown_minutes?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          metric: string
          notification_channel?: string
          threshold: number
          updated_at?: string
        }
        Update: {
          comparison?: string
          cooldown_minutes?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          metric?: string
          notification_channel?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          line_items: Json
          notes: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          sent_at: string | null
          status: string
          stripe_invoice_id: string | null
          subscription_id: string | null
          venue_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          subscription_id?: string | null
          venue_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          subscription_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "merchant_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      client_logos: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string
          name: string
          sort_order: number
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url: string
          name: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string
          name?: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
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
          rejected_orders_count: number | null
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
          rejected_orders_count?: number | null
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
          rejected_orders_count?: number | null
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
      data_deletion_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          request_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dev_pricing_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          custom_annual_price: number | null
          custom_monthly_price: number | null
          discount_percent: number | null
          expires_at: string | null
          id: string
          override_type: string
          reason: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_annual_price?: number | null
          custom_monthly_price?: number | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          override_type: string
          reason?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_annual_price?: number | null
          custom_monthly_price?: number | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          override_type?: string
          reason?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_pricing_overrides_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          redeemed_at: string | null
          redeemed_by_staff_id: string | null
          reward_id: string | null
          reward_name: string | null
          status: string
          user_id: string
          venue_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          redeemed_at?: string | null
          redeemed_by_staff_id?: string | null
          reward_id?: string | null
          reward_name?: string | null
          status?: string
          user_id: string
          venue_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          redeemed_at?: string | null
          redeemed_by_staff_id?: string | null
          reward_id?: string | null
          reward_name?: string | null
          status?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_redeemed_by_staff_id_fkey"
            columns: ["redeemed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_codes_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_codes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rate_cache: {
        Row: {
          base_currency: string
          fetched_at: string
          id: string
          rate: number
          target_currency: string
        }
        Insert: {
          base_currency?: string
          fetched_at?: string
          id?: string
          rate: number
          target_currency: string
        }
        Update: {
          base_currency?: string
          fetched_at?: string
          id?: string
          rate?: number
          target_currency?: string
        }
        Relationships: []
      }
      feature_requests: {
        Row: {
          ai_summary: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          priority: string | null
          similar_request_ids: string[] | null
          source: string
          status: string
          submitter_id: string | null
          title: string
          updated_at: string
          votes: number | null
        }
        Insert: {
          ai_summary?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          priority?: string | null
          similar_request_ids?: string[] | null
          source?: string
          status?: string
          submitter_id?: string | null
          title: string
          updated_at?: string
          votes?: number | null
        }
        Update: {
          ai_summary?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: string | null
          similar_request_ids?: string[] | null
          source?: string
          status?: string
          submitter_id?: string | null
          title?: string
          updated_at?: string
          votes?: number | null
        }
        Relationships: []
      }
      loyalty_challenges: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          goal_type: string
          goal_value: number
          id: string
          is_active: boolean
          reward_description: string | null
          reward_name: string
          reward_points: number | null
          reward_stamps: number | null
          start_date: string
          title: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          goal_type?: string
          goal_value?: number
          id?: string
          is_active?: boolean
          reward_description?: string | null
          reward_name: string
          reward_points?: number | null
          reward_stamps?: number | null
          start_date?: string
          title: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          goal_type?: string
          goal_value?: number
          id?: string
          is_active?: boolean
          reward_description?: string | null
          reward_name?: string
          reward_points?: number | null
          reward_stamps?: number | null
          start_date?: string
          title?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_challenges_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          admin_enabled: boolean | null
          admin_notes: string | null
          created_at: string
          earning_sources: string[] | null
          id: string
          is_active: boolean
          points_per_order: number | null
          points_per_visit: number | null
          stamp_threshold: number | null
          type: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          admin_enabled?: boolean | null
          admin_notes?: string | null
          created_at?: string
          earning_sources?: string[] | null
          id?: string
          is_active?: boolean
          points_per_order?: number | null
          points_per_visit?: number | null
          stamp_threshold?: number | null
          type?: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          admin_enabled?: boolean | null
          admin_notes?: string | null
          created_at?: string
          earning_sources?: string[] | null
          id?: string
          is_active?: boolean
          points_per_order?: number | null
          points_per_visit?: number | null
          stamp_threshold?: number | null
          type?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          points_required: number | null
          program_id: string
          reward_type: string
          stamps_required: number | null
          updated_at: string
          venue_id: string
          voucher_validity_days: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          points_required?: number | null
          program_id: string
          reward_type?: string
          stamps_required?: number | null
          updated_at?: string
          venue_id: string
          voucher_validity_days?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          points_required?: number | null
          program_id?: string
          reward_type?: string
          stamps_required?: number | null
          updated_at?: string
          venue_id?: string
          voucher_validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_rewards_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_tiers: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          min_lifetime_points: number | null
          min_lifetime_stamps: number | null
          perks: Json | null
          sort_order: number | null
          tier_name: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          min_lifetime_points?: number | null
          min_lifetime_stamps?: number | null
          perks?: Json | null
          sort_order?: number | null
          tier_name: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          min_lifetime_points?: number | null
          min_lifetime_stamps?: number | null
          perks?: Json | null
          sort_order?: number | null
          tier_name?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_tiers_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          id: string
          points_delta: number | null
          program_id: string
          source_id: string | null
          source_type: string | null
          stamps_delta: number | null
          type: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_delta?: number | null
          program_id: string
          source_id?: string | null
          source_type?: string | null
          stamps_delta?: number | null
          type: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_delta?: number | null
          program_id?: string
          source_id?: string | null
          source_type?: string | null
          stamps_delta?: number | null
          type?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "merchant_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_announcements: {
        Row: {
          audience: string
          created_at: string
          created_by: string | null
          dismissible: boolean
          expires_at: string | null
          id: string
          is_active: boolean
          message: string
          priority: number
          target_venue_ids: string[] | null
          title: string
          type: string
        }
        Insert: {
          audience?: string
          created_at?: string
          created_by?: string | null
          dismissible?: boolean
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          priority?: number
          target_venue_ids?: string[] | null
          title: string
          type?: string
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string | null
          dismissible?: boolean
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          priority?: number
          target_venue_ids?: string[] | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      merchant_subscriptions: {
        Row: {
          billing_cycle: string
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          pending_billing_cycle: string | null
          pending_change_at: string | null
          pending_plan_id: string | null
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          pending_billing_cycle?: string | null
          pending_change_at?: string | null
          pending_plan_id?: string | null
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          pending_billing_cycle?: string | null
          pending_change_at?: string | null
          pending_plan_id?: string | null
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscriptions_pending_plan_id_fkey"
            columns: ["pending_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_subscriptions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          order_id: string | null
          read_at: string | null
          sender_id: string
          sender_type: string
          venue_inquiry_id: string | null
          waitlist_entry_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          order_id?: string | null
          read_at?: string | null
          sender_id: string
          sender_type: string
          venue_inquiry_id?: string | null
          waitlist_entry_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          order_id?: string | null
          read_at?: string | null
          sender_id?: string
          sender_type?: string
          venue_inquiry_id?: string | null
          waitlist_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_venue_inquiry_id_fkey"
            columns: ["venue_inquiry_id"]
            isOneToOne: false
            referencedRelation: "venue_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "waitlist_entries"
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
          cancellation_type: string | null
          cancelled_by: string | null
          confidence: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          eta: string | null
          id: string
          items: Json
          marked_ready_by_staff_id: string | null
          merchant_dismissed: boolean
          notes: string | null
          order_number: string
          original_eta: string | null
          patron_dismissed: boolean | null
          prepared_by_staff_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string | null
          venue_id: string
        }
        Insert: {
          awaiting_merchant_confirmation?: boolean | null
          awaiting_patron_confirmation?: boolean | null
          cancellation_type?: string | null
          cancelled_by?: string | null
          confidence?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          eta?: string | null
          id?: string
          items?: Json
          marked_ready_by_staff_id?: string | null
          merchant_dismissed?: boolean
          notes?: string | null
          order_number: string
          original_eta?: string | null
          patron_dismissed?: boolean | null
          prepared_by_staff_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string | null
          venue_id: string
        }
        Update: {
          awaiting_merchant_confirmation?: boolean | null
          awaiting_patron_confirmation?: boolean | null
          cancellation_type?: string | null
          cancelled_by?: string | null
          confidence?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          eta?: string | null
          id?: string
          items?: Json
          marked_ready_by_staff_id?: string | null
          merchant_dismissed?: boolean
          notes?: string | null
          order_number?: string
          original_eta?: string | null
          patron_dismissed?: boolean | null
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
      password_reset_requests: {
        Row: {
          created_at: string | null
          email: string
          id: string
          notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string | null
          venue_name: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string | null
          venue_name?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      patron_cashback_balance: {
        Row: {
          balance: number
          created_at: string
          id: string
          lifetime_earned: number
          updated_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          updated_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          updated_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patron_cashback_balance_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      patron_challenge_progress: {
        Row: {
          challenge_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          current_progress: number
          id: string
          reward_claimed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_progress?: number
          id?: string
          reward_claimed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_progress?: number
          id?: string
          reward_claimed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patron_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "loyalty_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      patron_checkins: {
        Row: {
          checked_in_at: string
          expires_at: string
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          checked_in_at?: string
          expires_at?: string
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          checked_in_at?: string
          expires_at?: string
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patron_checkins_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      patron_connections: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      patron_dining_preferences: {
        Row: {
          avoid_ingredients: string[] | null
          created_at: string
          cuisine_preferences: string[] | null
          dietary_requirements: string[] | null
          id: string
          max_wait_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avoid_ingredients?: string[] | null
          created_at?: string
          cuisine_preferences?: string[] | null
          dietary_requirements?: string[] | null
          id?: string
          max_wait_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avoid_ingredients?: string[] | null
          created_at?: string
          cuisine_preferences?: string[] | null
          dietary_requirements?: string[] | null
          id?: string
          max_wait_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patron_dining_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patron_loyalty: {
        Row: {
          created_at: string
          id: string
          lifetime_points: number
          lifetime_stamps: number
          points_balance: number
          program_id: string
          stamps_count: number
          updated_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lifetime_points?: number
          lifetime_stamps?: number
          points_balance?: number
          program_id: string
          stamps_count?: number
          updated_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lifetime_points?: number
          lifetime_stamps?: number
          points_balance?: number
          program_id?: string
          stamps_count?: number
          updated_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patron_loyalty_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patron_loyalty_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patron_loyalty_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      patron_notification_preferences: {
        Row: {
          created_at: string
          favorite_venue_alerts: boolean
          id: string
          max_nudges_per_day: number
          mealtime_nudges: boolean
          nudge_frequency: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reengagement_nudges: boolean
          updated_at: string
          user_id: string
          weekend_planning_nudges: boolean
        }
        Insert: {
          created_at?: string
          favorite_venue_alerts?: boolean
          id?: string
          max_nudges_per_day?: number
          mealtime_nudges?: boolean
          nudge_frequency?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reengagement_nudges?: boolean
          updated_at?: string
          user_id: string
          weekend_planning_nudges?: boolean
        }
        Update: {
          created_at?: string
          favorite_venue_alerts?: boolean
          id?: string
          max_nudges_per_day?: number
          mealtime_nudges?: boolean
          nudge_frequency?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reengagement_nudges?: boolean
          updated_at?: string
          user_id?: string
          weekend_planning_nudges?: boolean
        }
        Relationships: []
      }
      patron_nudge_history: {
        Row: {
          body: string
          clicked: boolean | null
          created_at: string
          dismissed_at: string | null
          id: string
          nudge_type: string
          opened_at: string | null
          sent_at: string
          title: string
          user_id: string
          venue_id: string | null
        }
        Insert: {
          body: string
          clicked?: boolean | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          nudge_type: string
          opened_at?: string | null
          sent_at?: string
          title: string
          user_id: string
          venue_id?: string | null
        }
        Update: {
          body?: string
          clicked?: boolean | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          nudge_type?: string
          opened_at?: string | null
          sent_at?: string
          title?: string
          user_id?: string
          venue_id?: string | null
        }
        Relationships: []
      }
      patron_tier_status: {
        Row: {
          achieved_at: string
          created_at: string
          current_tier_id: string | null
          id: string
          updated_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          achieved_at?: string
          created_at?: string
          current_tier_id?: string | null
          id?: string
          updated_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          achieved_at?: string
          created_at?: string
          current_tier_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patron_tier_status_current_tier_id_fkey"
            columns: ["current_tier_id"]
            isOneToOne: false
            referencedRelation: "loyalty_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patron_tier_status_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_currency_overrides: {
        Row: {
          annual_price: number
          created_at: string | null
          currency: string
          id: string
          monthly_price: number
          plan_id: string
          stripe_annual_price_id: string | null
          stripe_monthly_price_id: string | null
          updated_at: string | null
        }
        Insert: {
          annual_price: number
          created_at?: string | null
          currency: string
          id?: string
          monthly_price: number
          plan_id: string
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          updated_at?: string | null
        }
        Update: {
          annual_price?: number
          created_at?: string | null
          currency?: string
          id?: string
          monthly_price?: number
          plan_id?: string
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_currency_overrides_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          key: string
          rollout_percentage: number
          updated_at: string | null
          updated_by: string | null
          user_segments: Json
          value: Json
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          rollout_percentage?: number
          updated_at?: string | null
          updated_by?: string | null
          user_segments?: Json
          value: Json
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          rollout_percentage?: number
          updated_at?: string | null
          updated_by?: string | null
          user_segments?: Json
          value?: Json
        }
        Relationships: []
      }
      platform_errors: {
        Row: {
          ai_analysis: Json | null
          browser_info: string | null
          component: string | null
          created_at: string
          device_info: string | null
          error_message: string
          error_type: string
          first_seen_at: string
          id: string
          issue_category: string | null
          last_seen_at: string
          occurrence_count: number | null
          resolved_at: string | null
          route: string | null
          screenshot_url: string | null
          source: string | null
          stack_trace: string | null
          status: string
          user_id: string | null
          venue_id: string | null
          venue_name: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          browser_info?: string | null
          component?: string | null
          created_at?: string
          device_info?: string | null
          error_message: string
          error_type: string
          first_seen_at?: string
          id?: string
          issue_category?: string | null
          last_seen_at?: string
          occurrence_count?: number | null
          resolved_at?: string | null
          route?: string | null
          screenshot_url?: string | null
          source?: string | null
          stack_trace?: string | null
          status?: string
          user_id?: string | null
          venue_id?: string | null
          venue_name?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          browser_info?: string | null
          component?: string | null
          created_at?: string
          device_info?: string | null
          error_message?: string
          error_type?: string
          first_seen_at?: string
          id?: string
          issue_category?: string | null
          last_seen_at?: string
          occurrence_count?: number | null
          resolved_at?: string | null
          route?: string | null
          screenshot_url?: string | null
          source?: string | null
          stack_trace?: string | null
          status?: string
          user_id?: string | null
          venue_id?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          email_verified: boolean | null
          fcm_token: string | null
          full_name: string
          id: string
          patron_code: string | null
          phone: string | null
          phone_verified: boolean | null
          preferred_language: string
          updated_at: string
          verification_method: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          fcm_token?: string | null
          full_name: string
          id: string
          patron_code?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          preferred_language?: string
          updated_at?: string
          verification_method?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          email_verified?: boolean | null
          fcm_token?: string | null
          full_name?: string
          id?: string
          patron_code?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          preferred_language?: string
          updated_at?: string
          verification_method?: string | null
        }
        Relationships: []
      }
      promo_campaigns: {
        Row: {
          amount_charged: number | null
          banner_image_url: string | null
          clicks_count: number
          created_at: string
          created_by: string | null
          cta_link: string | null
          cta_text: string | null
          description: string | null
          end_date: string | null
          estimated_reach: number | null
          id: string
          impressions_count: number
          is_active: boolean
          payment_notes: string | null
          payment_status: string
          placements: string[]
          review_notes: string | null
          review_status: string
          start_date: string
          stripe_payment_intent_id: string | null
          submitted_by: string | null
          targeting_type: string
          title: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          amount_charged?: number | null
          banner_image_url?: string | null
          clicks_count?: number
          created_at?: string
          created_by?: string | null
          cta_link?: string | null
          cta_text?: string | null
          description?: string | null
          end_date?: string | null
          estimated_reach?: number | null
          id?: string
          impressions_count?: number
          is_active?: boolean
          payment_notes?: string | null
          payment_status?: string
          placements?: string[]
          review_notes?: string | null
          review_status?: string
          start_date?: string
          stripe_payment_intent_id?: string | null
          submitted_by?: string | null
          targeting_type?: string
          title: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          amount_charged?: number | null
          banner_image_url?: string | null
          clicks_count?: number
          created_at?: string
          created_by?: string | null
          cta_link?: string | null
          cta_text?: string | null
          description?: string | null
          end_date?: string | null
          estimated_reach?: number | null
          id?: string
          impressions_count?: number
          is_active?: boolean
          payment_notes?: string | null
          payment_status?: string
          placements?: string[]
          review_notes?: string | null
          review_status?: string
          start_date?: string
          stripe_payment_intent_id?: string | null
          submitted_by?: string | null
          targeting_type?: string
          title?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_campaigns_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_impressions: {
        Row: {
          campaign_id: string
          clicked: boolean
          created_at: string
          id: string
          placement: string
          targeting_match_type: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          clicked?: boolean
          created_at?: string
          id?: string
          placement: string
          targeting_match_type?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          clicked?: boolean
          created_at?: string
          id?: string
          placement?: string
          targeting_match_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_impressions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_pricing_rules: {
        Row: {
          base_price_per_day: number
          created_at: string
          id: string
          is_active: boolean
          placement_multipliers: Json
          reach_tiers: Json
          updated_at: string
        }
        Insert: {
          base_price_per_day?: number
          created_at?: string
          id?: string
          is_active?: boolean
          placement_multipliers?: Json
          reach_tiers?: Json
          updated_at?: string
        }
        Update: {
          base_price_per_day?: number
          created_at?: string
          id?: string
          is_active?: boolean
          placement_multipliers?: Json
          reach_tiers?: Json
          updated_at?: string
        }
        Relationships: []
      }
      promo_targeting_rules: {
        Row: {
          campaign_id: string
          created_at: string
          cuisine_tags: string[] | null
          id: string
          location_lat: number | null
          location_lng: number | null
          location_radius_km: number | null
          target_past_visitors: boolean | null
          time_slots: Json | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          cuisine_tags?: string[] | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_radius_km?: number | null
          target_past_visitors?: boolean | null
          time_slots?: Json | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          cuisine_tags?: string[] | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_radius_km?: number | null
          target_past_visitors?: boolean | null
          time_slots?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_targeting_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "promo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          user_id: string
          uses_count: number
          venue_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          user_id: string
          uses_count?: number
          venue_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          user_id?: string
          uses_count?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_completions: {
        Row: {
          completed_at: string
          id: string
          referee_id: string
          referee_reward_type: string | null
          referee_reward_value: number | null
          referee_rewarded: boolean
          referrer_id: string
          referrer_reward_type: string | null
          referrer_reward_value: number | null
          referrer_rewarded: boolean
          venue_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          referee_id: string
          referee_reward_type?: string | null
          referee_reward_value?: number | null
          referee_rewarded?: boolean
          referrer_id: string
          referrer_reward_type?: string | null
          referrer_reward_value?: number | null
          referrer_rewarded?: boolean
          venue_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          referee_id?: string
          referee_reward_type?: string | null
          referee_reward_value?: number | null
          referee_rewarded?: boolean
          referrer_id?: string
          referrer_reward_type?: string | null
          referrer_reward_value?: number | null
          referrer_rewarded?: boolean
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_completions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_addon_assignments: {
        Row: {
          addon_id: string
          created_at: string
          id: string
          subscription_id: string
        }
        Insert: {
          addon_id: string
          created_at?: string
          id?: string
          subscription_id: string
        }
        Update: {
          addon_id?: string
          created_at?: string
          id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_addon_assignments_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "subscription_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_addon_assignments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "merchant_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_addons: {
        Row: {
          annual_price: number
          created_at: string
          feature_key: string
          id: string
          is_active: boolean
          monthly_price: number
          name: string
          updated_at: string
        }
        Insert: {
          annual_price?: number
          created_at?: string
          feature_key: string
          id?: string
          is_active?: boolean
          monthly_price?: number
          name: string
          updated_at?: string
        }
        Update: {
          annual_price?: number
          created_at?: string
          feature_key?: string
          id?: string
          is_active?: boolean
          monthly_price?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          annual_price: number
          created_at: string
          description: string | null
          id: string
          included_features: Json
          is_active: boolean
          monthly_price: number
          name: string
          sort_order: number
          stripe_annual_price_id: string | null
          stripe_annual_product_id: string | null
          stripe_monthly_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          annual_price?: number
          created_at?: string
          description?: string | null
          id?: string
          included_features?: Json
          is_active?: boolean
          monthly_price?: number
          name: string
          sort_order?: number
          stripe_annual_price_id?: string | null
          stripe_annual_product_id?: string | null
          stripe_monthly_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          annual_price?: number
          created_at?: string
          description?: string | null
          id?: string
          included_features?: Json
          is_active?: boolean
          monthly_price?: number
          name?: string
          sort_order?: number
          stripe_annual_price_id?: string | null
          stripe_annual_product_id?: string | null
          stripe_monthly_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
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
      venue_cashback_config: {
        Row: {
          created_at: string
          fixed_amount: number
          id: string
          is_active: boolean
          max_credit_per_order: number | null
          min_order_value: number | null
          percentage: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          fixed_amount?: number
          id?: string
          is_active?: boolean
          max_credit_per_order?: number | null
          min_order_value?: number | null
          percentage?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          fixed_amount?: number
          id?: string
          is_active?: boolean
          max_credit_per_order?: number | null
          min_order_value?: number | null
          percentage?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_cashback_config_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_inquiries: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_inquiries_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_referral_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          referee_reward_type: string
          referee_reward_value: number
          referrer_reward_type: string
          referrer_reward_value: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          referee_reward_type?: string
          referee_reward_value?: number
          referrer_reward_type?: string
          referrer_reward_value?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          referee_reward_type?: string
          referee_reward_value?: number
          referrer_reward_type?: string
          referrer_reward_value?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_referral_config_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          display_address: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          onboarding_completed: boolean | null
          phone: string | null
          service_types: string[] | null
          settings: Json | null
          timezone: string | null
          updated_at: string
          waitlist_preferences: Json | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          display_address?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          onboarding_completed?: boolean | null
          phone?: string | null
          service_types?: string[] | null
          settings?: Json | null
          timezone?: string | null
          updated_at?: string
          waitlist_preferences?: Json | null
        }
        Update: {
          address?: string | null
          created_at?: string
          display_address?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          onboarding_completed?: boolean | null
          phone?: string | null
          service_types?: string[] | null
          settings?: Json | null
          timezone?: string | null
          updated_at?: string
          waitlist_preferences?: Json | null
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
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
          assigned_table_id: string | null
          awaiting_merchant_confirmation: boolean | null
          cancellation_reason: string | null
          cancelled_by: string | null
          confidence: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          delayed_until: string | null
          edit_summary: string | null
          eta: string | null
          group_id: string | null
          id: string
          last_edited_at: string | null
          linked_reservation_id: string | null
          merchant_acknowledged: boolean | null
          merchant_seen: boolean | null
          notes: string | null
          original_eta: string | null
          party_size: number
          patron_delayed: boolean | null
          patron_dismissed: boolean | null
          position: number | null
          preferences: string[] | null
          ready_at: string | null
          ready_deadline: string | null
          reservation_time: string | null
          reservation_type: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
          user_id: string | null
          venue_id: string
        }
        Insert: {
          assigned_table_id?: string | null
          awaiting_merchant_confirmation?: boolean | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          confidence?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          delayed_until?: string | null
          edit_summary?: string | null
          eta?: string | null
          group_id?: string | null
          id?: string
          last_edited_at?: string | null
          linked_reservation_id?: string | null
          merchant_acknowledged?: boolean | null
          merchant_seen?: boolean | null
          notes?: string | null
          original_eta?: string | null
          party_size?: number
          patron_delayed?: boolean | null
          patron_dismissed?: boolean | null
          position?: number | null
          preferences?: string[] | null
          ready_at?: string | null
          ready_deadline?: string | null
          reservation_time?: string | null
          reservation_type?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          user_id?: string | null
          venue_id: string
        }
        Update: {
          assigned_table_id?: string | null
          awaiting_merchant_confirmation?: boolean | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          confidence?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          delayed_until?: string | null
          edit_summary?: string | null
          eta?: string | null
          group_id?: string | null
          id?: string
          last_edited_at?: string | null
          linked_reservation_id?: string | null
          merchant_acknowledged?: boolean | null
          merchant_seen?: boolean | null
          notes?: string | null
          original_eta?: string | null
          party_size?: number
          patron_delayed?: boolean | null
          patron_dismissed?: boolean | null
          position?: number | null
          preferences?: string[] | null
          ready_at?: string | null
          ready_deadline?: string | null
          reservation_time?: string | null
          reservation_type?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          user_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "waitlist_entries"
            referencedColumns: ["id"]
          },
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
      analytics_avg_wait_time_all_time: {
        Args: never
        Returns: {
          avg_wait_time_minutes: number
        }[]
      }
      analytics_top_venue_orders_last_7_days: {
        Args: { p_limit?: number }
        Returns: {
          total_orders: number
          venue_name: string
        }[]
      }
      analytics_top_venue_orders_this_week: {
        Args: { p_limit?: number }
        Returns: {
          total_orders: number
          venue_name: string
        }[]
      }
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
      cancel_expired_ready_entries: { Args: never; Returns: undefined }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      extract_extension_reason: { Args: { p_notes: string }; Returns: string }
      format_eta_time: { Args: { p_eta: string }; Returns: string }
      generate_patron_code: { Args: never; Returns: string }
      get_occupied_tables: {
        Args: {
          p_buffer_minutes?: number
          p_time_slot: string
          p_venue_id: string
        }
        Returns: {
          customer_name: string
          party_size: number
          reservation_time: string
          table_id: string
        }[]
      }
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
      increment_promo_clicks: {
        Args: { campaign_uuid: string }
        Returns: undefined
      }
      increment_promo_impressions: {
        Args: { campaign_uuid: string }
        Returns: undefined
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id: string
          p_entity_type: string
        }
        Returns: undefined
      }
      notify_user_via_push: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      notify_venue_users_via_push: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_venue_id: string
        }
        Returns: undefined
      }
      process_stamp_card_redemption: {
        Args: { p_program_id: string; p_user_id: string; p_venue_id: string }
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
        | "cancelled"
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
        "cancelled",
      ],
      waitlist_status: ["waiting", "ready", "seated", "cancelled", "no_show"],
    },
  },
} as const
