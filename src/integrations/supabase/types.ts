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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          amount: number | null
          approver_id: string | null
          approver_role: string | null
          created_at: string
          currency: string
          decided_at: string | null
          decision_note: string | null
          department_id: string | null
          detail: string | null
          due_on: string | null
          entity_id: string | null
          entity_type: string
          evidence_url: string | null
          external_reference: string | null
          id: string
          kind: string
          property_id: string | null
          requested_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          approver_id?: string | null
          approver_role?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decision_note?: string | null
          department_id?: string | null
          detail?: string | null
          due_on?: string | null
          entity_id?: string | null
          entity_type: string
          evidence_url?: string | null
          external_reference?: string | null
          id?: string
          kind: string
          property_id?: string | null
          requested_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          approver_id?: string | null
          approver_role?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decision_note?: string | null
          department_id?: string | null
          detail?: string | null
          due_on?: string | null
          entity_id?: string | null
          entity_type?: string
          evidence_url?: string | null
          external_reference?: string | null
          id?: string
          kind?: string
          property_id?: string | null
          requested_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          after_value: Json | null
          before_value: Json | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      coach_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          follow_ups: Json
          guidance: Json
          id: string
          property_id: string | null
          question: string
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          follow_ups?: Json
          guidance?: Json
          id?: string
          property_id?: string | null
          question: string
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          follow_ups?: Json
          guidance?: Json
          id?: string
          property_id?: string | null
          question?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_sessions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_sessions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      department_members: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          level: string
          market_scope: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          level?: string
          market_scope?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          level?: string
          market_scope?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean
          blurb: string | null
          code: string
          created_at: string
          id: string
          label: string
          landing_path: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          blurb?: string | null
          code: string
          created_at?: string
          id?: string
          label: string
          landing_path?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          blurb?: string | null
          code?: string
          created_at?: string
          id?: string
          label?: string
          landing_path?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          archived_at: string | null
          created_at: string
          department_id: string | null
          entity_id: string
          entity_type: string
          external_url: string | null
          id: string
          kind: string
          note: string | null
          required: boolean
          storage_path: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          department_id?: string | null
          entity_id: string
          entity_type: string
          external_url?: string | null
          id?: string
          kind?: string
          note?: string | null
          required?: boolean
          storage_path?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          department_id?: string | null
          entity_id?: string
          entity_type?: string
          external_url?: string | null
          id?: string
          kind?: string
          note?: string | null
          required?: boolean
          storage_path?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          purpose: string
          recipient: string
          reply_to: string | null
          sender: string | null
          sent_at: string | null
          status: string
          subject: string
          ticket_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          purpose?: string
          recipient: string
          reply_to?: string | null
          sender?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          ticket_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          purpose?: string
          recipient?: string
          reply_to?: string | null
          sender?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          ticket_id?: string | null
        }
        Relationships: []
      }
      external_links: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          external_id: string
          external_parent_id: string | null
          external_url: string | null
          id: string
          last_error: string | null
          last_sync_status: string
          last_synced_at: string | null
          payload_hash: string | null
          system: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          external_id: string
          external_parent_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          payload_hash?: string | null
          system: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          external_id?: string
          external_parent_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          last_sync_status?: string
          last_synced_at?: string | null
          payload_hash?: string | null
          system?: string
          updated_at?: string
        }
        Relationships: []
      }
      field_conflicts: {
        Row: {
          chosen_source: string | null
          created_at: string
          detected_at: string
          entity_id: string
          entity_type: string
          external_value: string | null
          field_key: string
          field_label: string
          final_value: string | null
          id: string
          note: string | null
          resolve_value: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          system: string
          updated_at: string
        }
        Insert: {
          chosen_source?: string | null
          created_at?: string
          detected_at?: string
          entity_id: string
          entity_type: string
          external_value?: string | null
          field_key: string
          field_label: string
          final_value?: string | null
          id?: string
          note?: string | null
          resolve_value?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          system: string
          updated_at?: string
        }
        Update: {
          chosen_source?: string | null
          created_at?: string
          detected_at?: string
          entity_id?: string
          entity_type?: string
          external_value?: string | null
          field_key?: string
          field_label?: string
          final_value?: string | null
          id?: string
          note?: string | null
          resolve_value?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          system?: string
          updated_at?: string
        }
        Relationships: []
      }
      functional_roles: {
        Row: {
          active: boolean
          backup_role_code: string | null
          code: string
          coverage_window: string | null
          created_at: string
          current_seat_holder: string | null
          current_seat_name: string | null
          id: string
          lunch_coverage: string | null
          lunch_window: string | null
          name: string
          sort_order: number
          team: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          backup_role_code?: string | null
          code: string
          coverage_window?: string | null
          created_at?: string
          current_seat_holder?: string | null
          current_seat_name?: string | null
          id?: string
          lunch_coverage?: string | null
          lunch_window?: string | null
          name: string
          sort_order?: number
          team?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          backup_role_code?: string | null
          code?: string
          coverage_window?: string | null
          created_at?: string
          current_seat_holder?: string | null
          current_seat_name?: string | null
          id?: string
          lunch_coverage?: string | null
          lunch_window?: string | null
          name?: string
          sort_order?: number
          team?: string
          updated_at?: string
        }
        Relationships: []
      }
      gatekeeper_requirements: {
        Row: {
          active: boolean
          applies_to_category: string | null
          applies_to_class: string
          applies_to_market: string | null
          approver_role: string
          code: string
          created_at: string
          detail: string | null
          expires_after_days: number | null
          id: string
          label: string
          requirement_level: string
          sort_order: number
          updated_at: string
          verification_method: string | null
        }
        Insert: {
          active?: boolean
          applies_to_category?: string | null
          applies_to_class?: string
          applies_to_market?: string | null
          approver_role?: string
          code: string
          created_at?: string
          detail?: string | null
          expires_after_days?: number | null
          id?: string
          label: string
          requirement_level?: string
          sort_order?: number
          updated_at?: string
          verification_method?: string | null
        }
        Update: {
          active?: boolean
          applies_to_category?: string | null
          applies_to_class?: string
          applies_to_market?: string | null
          approver_role?: string
          code?: string
          created_at?: string
          detail?: string | null
          expires_after_days?: number | null
          id?: string
          label?: string
          requirement_level?: string
          sort_order?: number
          updated_at?: string
          verification_method?: string | null
        }
        Relationships: []
      }
      handoffs: {
        Row: {
          actions_completed: string
          created_at: string
          current_status: string
          due_at: string | null
          from_user: string | null
          guest_comm_status: string
          handoff_type: string
          id: string
          next_action: string
          priority: string
          responded_at: string | null
          response_reason: string | null
          risks: string | null
          status: string
          summary: string
          ticket_id: string
          to_role_code: string | null
          to_user: string | null
        }
        Insert: {
          actions_completed: string
          created_at?: string
          current_status: string
          due_at?: string | null
          from_user?: string | null
          guest_comm_status?: string
          handoff_type?: string
          id?: string
          next_action: string
          priority?: string
          responded_at?: string | null
          response_reason?: string | null
          risks?: string | null
          status?: string
          summary: string
          ticket_id: string
          to_role_code?: string | null
          to_user?: string | null
        }
        Update: {
          actions_completed?: string
          created_at?: string
          current_status?: string
          due_at?: string | null
          from_user?: string | null
          guest_comm_status?: string
          handoff_type?: string
          id?: string
          next_action?: string
          priority?: string
          responded_at?: string | null
          response_reason?: string | null
          risks?: string | null
          status?: string
          summary?: string
          ticket_id?: string
          to_role_code?: string | null
          to_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handoffs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          attempts: number
          created_at: string
          direction: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          external_id: string | null
          id: string
          next_attempt_at: string | null
          operation: string
          payload_hash: string | null
          previous_value: Json | null
          request_payload: Json | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          system: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          direction: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          next_attempt_at?: string | null
          operation: string
          payload_hash?: string | null
          previous_value?: Json | null
          request_payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          system: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          direction?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          next_attempt_at?: string | null
          operation?: string
          payload_hash?: string | null
          previous_value?: Json | null
          request_payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          system?: string
          updated_at?: string
        }
        Relationships: []
      }
      metric_definitions: {
        Row: {
          business_definition: string
          connected: boolean
          created_at: string
          department_id: string | null
          drill_path: string | null
          higher_is_better: boolean
          id: string
          key: string
          label: string
          section: string
          sort_order: number
          source_system: string
          target_high: number | null
          target_low: number | null
          target_text: string | null
          unavailable_reason: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          business_definition: string
          connected?: boolean
          created_at?: string
          department_id?: string | null
          drill_path?: string | null
          higher_is_better?: boolean
          id?: string
          key: string
          label: string
          section: string
          sort_order?: number
          source_system: string
          target_high?: number | null
          target_low?: number | null
          target_text?: string | null
          unavailable_reason?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          business_definition?: string
          connected?: boolean
          created_at?: string
          department_id?: string | null
          drill_path?: string | null
          higher_is_better?: boolean
          id?: string
          key?: string
          label?: string
          section?: string
          sort_order?: number
          source_system?: string
          target_high?: number | null
          target_low?: number | null
          target_text?: string | null
          unavailable_reason?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_definitions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          assigned_to: string | null
          blocker: string | null
          blocks_handoff: boolean
          carryover_of: string | null
          carryover_reason: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          detail: string | null
          due_on: string | null
          evidence_note: string | null
          evidence_required: boolean
          id: string
          owner_approval_status: string
          property_id: string
          requires_owner_approval: boolean
          stage: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          blocker?: string | null
          blocks_handoff?: boolean
          carryover_of?: string | null
          carryover_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          due_on?: string | null
          evidence_note?: string | null
          evidence_required?: boolean
          id?: string
          owner_approval_status?: string
          property_id: string
          requires_owner_approval?: boolean
          stage?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          blocker?: string | null
          blocks_handoff?: boolean
          carryover_of?: string | null
          carryover_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          due_on?: string | null
          evidence_note?: string | null
          evidence_required?: boolean
          id?: string
          owner_approval_status?: string
          property_id?: string
          requires_owner_approval?: boolean
          stage?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_carryover_of_fkey"
            columns: ["carryover_of"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_alert_log: {
        Row: {
          alert_kind: string
          id: string
          program_id: string
          sent_at: string
          severity: number
          status_at_send: string | null
        }
        Insert: {
          alert_kind: string
          id?: string
          program_id: string
          sent_at?: string
          severity?: number
          status_at_send?: string | null
        }
        Update: {
          alert_kind?: string
          id?: string
          program_id?: string
          sent_at?: string
          severity?: number
          status_at_send?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_alert_log_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_badges: {
        Row: {
          awarded_at: string
          code: string
          id: string
          needs_review: boolean
          program_id: string
          review_note: string | null
          supporting: Json
          trigger_rule: string
        }
        Insert: {
          awarded_at?: string
          code: string
          id?: string
          needs_review?: boolean
          program_id: string
          review_note?: string | null
          supporting?: Json
          trigger_rule: string
        }
        Update: {
          awarded_at?: string
          code?: string
          id?: string
          needs_review?: boolean
          program_id?: string
          review_note?: string | null
          supporting?: Json
          trigger_rule?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_badges_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_contact_alerts: {
        Row: {
          body: string
          created_at: string
          handled_at: string | null
          handled_by: string | null
          handled_note: string | null
          id: string
          notification_id: string | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          priority: string
          program_id: string
          reason: string
          status: string
          ticket_id: string | null
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          handled_note?: string | null
          id?: string
          notification_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          priority?: string
          program_id: string
          reason?: string
          status?: string
          ticket_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          handled_note?: string | null
          id?: string
          notification_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          priority?: string
          program_id?: string
          reason?: string
          status?: string
          ticket_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_contact_alerts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "owner_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_contact_alerts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_contact_alerts_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          owner_email: string | null
          program_id: string
          redeemed_at: string | null
          redeemed_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          owner_email?: string | null
          program_id: string
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          owner_email?: string | null
          program_id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_invites_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_notifications: {
        Row: {
          action_path: string | null
          body: string
          created_at: string
          delivered_at: string | null
          delivery_error: string | null
          email_status: string
          id: string
          kind: string
          owner_user_id: string | null
          priority: string
          program_id: string
          read_at: string | null
          review_id: string | null
          sms_status: string
          ticket_id: string | null
          title: string
        }
        Insert: {
          action_path?: string | null
          body?: string
          created_at?: string
          delivered_at?: string | null
          delivery_error?: string | null
          email_status?: string
          id?: string
          kind: string
          owner_user_id?: string | null
          priority?: string
          program_id: string
          read_at?: string | null
          review_id?: string | null
          sms_status?: string
          ticket_id?: string | null
          title: string
        }
        Update: {
          action_path?: string | null
          body?: string
          created_at?: string
          delivered_at?: string | null
          delivery_error?: string | null
          email_status?: string
          id?: string
          kind?: string
          owner_user_id?: string | null
          priority?: string
          program_id?: string
          read_at?: string | null
          review_id?: string | null
          sms_status?: string
          ticket_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_notifications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_notifications_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "owner_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_program_events: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          created_at: string
          detail: Json
          entry_id: string | null
          id: string
          kind: string
          new_value: string | null
          previous_value: string | null
          program_id: string
          property_id: string | null
          reason: string | null
          review_id: string | null
          summary: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          detail?: Json
          entry_id?: string | null
          id?: string
          kind: string
          new_value?: string | null
          previous_value?: string | null
          program_id: string
          property_id?: string | null
          reason?: string | null
          review_id?: string | null
          summary: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          detail?: Json
          entry_id?: string | null
          id?: string
          kind?: string
          new_value?: string | null
          previous_value?: string | null
          program_id?: string
          property_id?: string | null
          reason?: string | null
          review_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_program_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "owner_time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_program_events_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_program_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_program_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "owner_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_program_properties: {
        Row: {
          added_by: string | null
          added_on: string
          closing_confirmed: boolean
          closing_date: string | null
          coverage_status: string
          created_at: string
          id: string
          inclusion_status: string
          last_owner_activity_at: string | null
          launch_status: string
          notes: string | null
          onboarding_status: string
          program_id: string
          property_id: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          added_on?: string
          closing_confirmed?: boolean
          closing_date?: string | null
          coverage_status?: string
          created_at?: string
          id?: string
          inclusion_status?: string
          last_owner_activity_at?: string | null
          launch_status?: string
          notes?: string | null
          onboarding_status?: string
          program_id: string
          property_id: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          added_on?: string
          closing_confirmed?: boolean
          closing_date?: string | null
          coverage_status?: string
          created_at?: string
          id?: string
          inclusion_status?: string
          last_owner_activity_at?: string | null
          launch_status?: string
          notes?: string | null
          onboarding_status?: string
          program_id?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_program_properties_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_program_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_programs: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          dfy_confirmed: boolean
          dfy_confirmed_at: string | null
          ends_on: string | null
          id: string
          internal_notes: string | null
          last_owner_activity_at: string | null
          notes: string | null
          notify_email: boolean
          notify_push: boolean
          notify_sms_p1: boolean
          onboarding_lead: string | null
          onboarding_milestone_day: number
          onboarding_milestone_hours: number
          onboarding_target_hours: number
          ongoing_target_hours: number
          operating_target_hours: number
          operations_lead: string | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          owner_user_id: string | null
          property_id: string | null
          started_on: string | null
          status: string
          target_hours: number
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          dfy_confirmed?: boolean
          dfy_confirmed_at?: string | null
          ends_on?: string | null
          id?: string
          internal_notes?: string | null
          last_owner_activity_at?: string | null
          notes?: string | null
          notify_email?: boolean
          notify_push?: boolean
          notify_sms_p1?: boolean
          onboarding_lead?: string | null
          onboarding_milestone_day?: number
          onboarding_milestone_hours?: number
          onboarding_target_hours?: number
          ongoing_target_hours?: number
          operating_target_hours?: number
          operations_lead?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_user_id?: string | null
          property_id?: string | null
          started_on?: string | null
          status?: string
          target_hours?: number
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          dfy_confirmed?: boolean
          dfy_confirmed_at?: string | null
          ends_on?: string | null
          id?: string
          internal_notes?: string | null
          last_owner_activity_at?: string | null
          notes?: string | null
          notify_email?: boolean
          notify_push?: boolean
          notify_sms_p1?: boolean
          onboarding_lead?: string | null
          onboarding_milestone_day?: number
          onboarding_milestone_hours?: number
          onboarding_target_hours?: number
          ongoing_target_hours?: number
          operating_target_hours?: number
          operations_lead?: string | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          owner_user_id?: string | null
          property_id?: string | null
          started_on?: string | null
          status?: string
          target_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_programs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_review_properties: {
        Row: {
          created_at: string
          id: string
          property_id: string
          review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_review_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_review_properties_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "owner_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_reviews: {
        Row: {
          attachment_path: string | null
          business_question: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          decision_path: string
          evidence: string | null
          id: string
          impact: string | null
          notified_at: string | null
          outcome: string | null
          owner_decision: string | null
          owner_response: string | null
          phase: string
          program_id: string
          property_id: string | null
          recommendation: string | null
          respond_by: string | null
          responded_at: string | null
          sort_order: number
          stage: string
          status: string
          task_type: string
          template_id: string | null
          ticket_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attachment_path?: string | null
          business_question?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          decision_path?: string
          evidence?: string | null
          id?: string
          impact?: string | null
          notified_at?: string | null
          outcome?: string | null
          owner_decision?: string | null
          owner_response?: string | null
          phase: string
          program_id: string
          property_id?: string | null
          recommendation?: string | null
          respond_by?: string | null
          responded_at?: string | null
          sort_order?: number
          stage: string
          status?: string
          task_type?: string
          template_id?: string | null
          ticket_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attachment_path?: string | null
          business_question?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          decision_path?: string
          evidence?: string | null
          id?: string
          impact?: string | null
          notified_at?: string | null
          outcome?: string | null
          owner_decision?: string | null
          owner_response?: string | null
          phase?: string
          program_id?: string
          property_id?: string | null
          recommendation?: string | null
          respond_by?: string | null
          responded_at?: string | null
          sort_order?: number
          stage?: string
          status?: string
          task_type?: string
          template_id?: string | null
          ticket_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_reviews_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_reviews_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "owner_task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_reviews_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_task_templates: {
        Row: {
          active: boolean
          code: string
          created_at: string
          decision_path: string
          id: string
          owner_action: string
          phase: string
          planning_hours_high: number
          planning_hours_low: number
          recurring: boolean
          respond_within_days: number
          sort_order: number
          stage: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          decision_path?: string
          id?: string
          owner_action: string
          phase: string
          planning_hours_high?: number
          planning_hours_low?: number
          recurring?: boolean
          respond_within_days?: number
          sort_order?: number
          stage: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          decision_path?: string
          id?: string
          owner_action?: string
          phase?: string
          planning_hours_high?: number
          planning_hours_low?: number
          recurring?: boolean
          respond_within_days?: number
          sort_order?: number
          stage?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      owner_time_entries: {
        Row: {
          activity: string
          activity_category: string | null
          amends_entry_id: string | null
          attachment_path: string | null
          attested: boolean
          comments: string | null
          correction_reason: string | null
          created_at: string
          decision_outcome: string | null
          entry_date: string
          id: string
          materials_reviewed: string | null
          minutes: number
          output: string | null
          owner_user_id: string
          phase: string
          program_id: string
          review_id: string | null
          ticket_id: string | null
        }
        Insert: {
          activity: string
          activity_category?: string | null
          amends_entry_id?: string | null
          attachment_path?: string | null
          attested?: boolean
          comments?: string | null
          correction_reason?: string | null
          created_at?: string
          decision_outcome?: string | null
          entry_date?: string
          id?: string
          materials_reviewed?: string | null
          minutes: number
          output?: string | null
          owner_user_id: string
          phase: string
          program_id: string
          review_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          activity?: string
          activity_category?: string | null
          amends_entry_id?: string | null
          attachment_path?: string | null
          attested?: boolean
          comments?: string | null
          correction_reason?: string | null
          created_at?: string
          decision_outcome?: string | null
          entry_date?: string
          id?: string
          materials_reviewed?: string | null
          minutes?: number
          output?: string | null
          owner_user_id?: string
          phase?: string
          program_id?: string
          review_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_time_entries_amends_entry_id_fkey"
            columns: ["amends_entry_id"]
            isOneToOne: false
            referencedRelation: "owner_time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_time_entries_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_time_entries_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "owner_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_time_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_time_entry_properties: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          property_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          property_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_time_entry_properties_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "owner_time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_time_entry_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_steps: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          instruction: string
          photo_required: boolean
          playbook_id: string
          position: number
          required: boolean
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          instruction: string
          photo_required?: boolean
          playbook_id: string
          position: number
          required?: boolean
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          instruction?: string
          photo_required?: boolean
          playbook_id?: string
          position?: number
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "playbook_steps_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          id?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          access_notes: string | null
          active: boolean
          address_line1: string | null
          archive_reason: string | null
          archived_at: string | null
          breezeway_property_id: string | null
          breezeway_synced_at: string | null
          city: string | null
          created_at: string
          created_by: string | null
          formatted_address: string | null
          geocode_status: string | null
          geocoded_at: string | null
          handoff_accepted_at: string | null
          id: string
          last_quarterly_review_at: string | null
          latitude: number | null
          lifecycle_status: string
          longitude: number | null
          name: string
          nickname: string | null
          notes: string | null
          onboarding_owner: string | null
          onboarding_stage: string | null
          onboarding_started_at: string | null
          ownerrez_property_id: string | null
          ownerrez_synced_at: string | null
          postal_code: string | null
          quarterly_review_due_on: string
          state: string | null
          unit: string | null
          updated_at: string
          wifi_notes: string | null
        }
        Insert: {
          access_notes?: string | null
          active?: boolean
          address_line1?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          breezeway_property_id?: string | null
          breezeway_synced_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          formatted_address?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          handoff_accepted_at?: string | null
          id?: string
          last_quarterly_review_at?: string | null
          latitude?: number | null
          lifecycle_status?: string
          longitude?: number | null
          name: string
          nickname?: string | null
          notes?: string | null
          onboarding_owner?: string | null
          onboarding_stage?: string | null
          onboarding_started_at?: string | null
          ownerrez_property_id?: string | null
          ownerrez_synced_at?: string | null
          postal_code?: string | null
          quarterly_review_due_on?: string
          state?: string | null
          unit?: string | null
          updated_at?: string
          wifi_notes?: string | null
        }
        Update: {
          access_notes?: string | null
          active?: boolean
          address_line1?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          breezeway_property_id?: string | null
          breezeway_synced_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          formatted_address?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          handoff_accepted_at?: string | null
          id?: string
          last_quarterly_review_at?: string | null
          latitude?: number | null
          lifecycle_status?: string
          longitude?: number | null
          name?: string
          nickname?: string | null
          notes?: string | null
          onboarding_owner?: string | null
          onboarding_stage?: string | null
          onboarding_started_at?: string | null
          ownerrez_property_id?: string | null
          ownerrez_synced_at?: string | null
          postal_code?: string | null
          quarterly_review_due_on?: string
          state?: string | null
          unit?: string | null
          updated_at?: string
          wifi_notes?: string | null
        }
        Relationships: []
      }
      property_handoffs: {
        Row: {
          carryover_accepted: boolean
          checklist: Json
          corrections: string | null
          created_at: string
          id: string
          notes: string | null
          open_task_ids: string[]
          property_id: string
          requested_at: string
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          validation: Json
        }
        Insert: {
          carryover_accepted?: boolean
          checklist?: Json
          corrections?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          open_task_ids?: string[]
          property_id: string
          requested_at?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          validation?: Json
        }
        Update: {
          carryover_accepted?: boolean
          checklist?: Json
          corrections?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          open_task_ids?: string[]
          property_id?: string
          requested_at?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "property_handoffs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_vendor_coverage: {
        Row: {
          access_requirements: string | null
          approval_limit: number | null
          coverage_priority: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          excluded: boolean
          exclusion_reason: string | null
          id: string
          last_verified_at: string | null
          org_id: string
          playbook_id: string | null
          property_id: string
          rate_note: string | null
          service_category: string
          updated_at: string
        }
        Insert: {
          access_requirements?: string | null
          approval_limit?: number | null
          coverage_priority?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          excluded?: boolean
          exclusion_reason?: string | null
          id?: string
          last_verified_at?: string | null
          org_id: string
          playbook_id?: string | null
          property_id: string
          rate_note?: string | null
          service_category: string
          updated_at?: string
        }
        Update: {
          access_requirements?: string | null
          approval_limit?: number | null
          coverage_priority?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          excluded?: boolean
          exclusion_reason?: string | null
          id?: string
          last_verified_at?: string | null
          org_id?: string
          playbook_id?: string | null
          property_id?: string
          rate_note?: string | null
          service_category?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_vendor_coverage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_vendor_coverage_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_vendor_coverage_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          invitee_email: string | null
          invitee_name: string | null
          note: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          invitee_email?: string | null
          invitee_name?: string | null
          note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          invitee_email?: string | null
          invitee_name?: string | null
          note?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      ticket_activity: {
        Row: {
          author_id: string | null
          body: string
          channel: string | null
          created_at: string
          event_at: string
          event_type: string
          evidence_url: string | null
          from_owner: string | null
          id: string
          kind: string
          ticket_id: string
          to_owner: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          channel?: string | null
          created_at?: string
          event_at?: string
          event_type?: string
          evidence_url?: string | null
          from_owner?: string | null
          id?: string
          kind?: string
          ticket_id: string
          to_owner?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          channel?: string | null
          created_at?: string
          event_at?: string
          event_type?: string
          evidence_url?: string | null
          from_owner?: string | null
          id?: string
          kind?: string
          ticket_id?: string
          to_owner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activity_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_steps: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          detail: string | null
          id: string
          instruction: string
          note: string | null
          photo_required: boolean
          position: number
          required: boolean
          ticket_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          instruction: string
          note?: string | null
          photo_required?: boolean
          position: number
          required?: boolean
          ticket_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          instruction?: string
          note?: string | null
          photo_required?: boolean
          position?: number
          required?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_steps_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_visits: {
        Row: {
          check_in_accuracy_m: number | null
          check_in_distance_m: number | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_verified: boolean
          check_out_accuracy_m: number | null
          check_out_distance_m: number | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_verified: boolean
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          id: string
          minutes_on_site: number | null
          notes: string | null
          property_id: string | null
          ticket_id: string
          updated_at: string
          vendor_user_id: string
        }
        Insert: {
          check_in_accuracy_m?: number | null
          check_in_distance_m?: number | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_verified?: boolean
          check_out_accuracy_m?: number | null
          check_out_distance_m?: number | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_verified?: boolean
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          id?: string
          minutes_on_site?: number | null
          notes?: string | null
          property_id?: string | null
          ticket_id: string
          updated_at?: string
          vendor_user_id: string
        }
        Update: {
          check_in_accuracy_m?: number | null
          check_in_distance_m?: number | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_verified?: boolean
          check_out_accuracy_m?: number | null
          check_out_distance_m?: number | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_verified?: boolean
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          id?: string
          minutes_on_site?: number | null
          notes?: string | null
          property_id?: string | null
          ticket_id?: string
          updated_at?: string
          vendor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_visits_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          accountable_owner: string | null
          acknowledged_at: string | null
          action_due_at: string | null
          action_started_at: string | null
          assigned_to: string | null
          avoidable_reopen: boolean
          breezeway_synced_at: string | null
          breezeway_task_id: string | null
          breezeway_task_status: string | null
          breezeway_task_url: string | null
          bucket: string | null
          category: string
          closure_evidence: string | null
          closure_qa_result: string
          created_at: string
          created_by: string | null
          created_on_behalf_of: string | null
          cross_team: boolean
          current_action_owner: string | null
          department_code: string | null
          description: string | null
          due_at: string | null
          escalated_at: string | null
          escalation_level: string
          external_id: string | null
          external_source: string | null
          external_status: string | null
          external_synced_at: string | null
          external_url: string | null
          final_communication_sent: boolean
          functional_role_code: string | null
          guest_comm_owner: string | null
          guest_confirmed: boolean
          guest_contact: string | null
          guest_impact: string
          guest_in_residence: boolean
          guest_name: string | null
          handoff_note: string | null
          handoff_status: string
          handoff_type: string | null
          id: string
          initiator_type: string
          last_reopened_at: string | null
          late_reason: string | null
          next_action: string | null
          next_action_due_at: string | null
          next_review_at: string | null
          occupancy_status: string
          outcome_type: string | null
          ownerrez_booking_id: string | null
          pending_handoff_to: string | null
          playbook_id: string | null
          priority: string
          priority_override_reason: string | null
          project_id: string | null
          promised_update_due_at: string | null
          property_id: string | null
          reclassified_at: string | null
          record_owner: string | null
          record_type: string
          ref: number
          reopen_count: number
          reported_at: string
          resolution_notes: string | null
          resolved_at: string | null
          response_due_at: string | null
          source_channel: string
          source_reference: string | null
          status: string
          suggested_priority: string | null
          supervisor_caught: boolean
          title: string
          updated_at: string
          vendor_accepted_at: string | null
          vendor_brief: string | null
          vendor_completed_at: string | null
          vendor_dispatched_at: string | null
          vendor_name: string | null
          vendor_status: string
          vendor_user_id: string | null
          waiting_on: string | null
          waiting_reason: string | null
          work_type_id: string | null
        }
        Insert: {
          accountable_owner?: string | null
          acknowledged_at?: string | null
          action_due_at?: string | null
          action_started_at?: string | null
          assigned_to?: string | null
          avoidable_reopen?: boolean
          breezeway_synced_at?: string | null
          breezeway_task_id?: string | null
          breezeway_task_status?: string | null
          breezeway_task_url?: string | null
          bucket?: string | null
          category?: string
          closure_evidence?: string | null
          closure_qa_result?: string
          created_at?: string
          created_by?: string | null
          created_on_behalf_of?: string | null
          cross_team?: boolean
          current_action_owner?: string | null
          department_code?: string | null
          description?: string | null
          due_at?: string | null
          escalated_at?: string | null
          escalation_level?: string
          external_id?: string | null
          external_source?: string | null
          external_status?: string | null
          external_synced_at?: string | null
          external_url?: string | null
          final_communication_sent?: boolean
          functional_role_code?: string | null
          guest_comm_owner?: string | null
          guest_confirmed?: boolean
          guest_contact?: string | null
          guest_impact?: string
          guest_in_residence?: boolean
          guest_name?: string | null
          handoff_note?: string | null
          handoff_status?: string
          handoff_type?: string | null
          id?: string
          initiator_type?: string
          last_reopened_at?: string | null
          late_reason?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          next_review_at?: string | null
          occupancy_status?: string
          outcome_type?: string | null
          ownerrez_booking_id?: string | null
          pending_handoff_to?: string | null
          playbook_id?: string | null
          priority?: string
          priority_override_reason?: string | null
          project_id?: string | null
          promised_update_due_at?: string | null
          property_id?: string | null
          reclassified_at?: string | null
          record_owner?: string | null
          record_type?: string
          ref?: number
          reopen_count?: number
          reported_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          response_due_at?: string | null
          source_channel?: string
          source_reference?: string | null
          status?: string
          suggested_priority?: string | null
          supervisor_caught?: boolean
          title: string
          updated_at?: string
          vendor_accepted_at?: string | null
          vendor_brief?: string | null
          vendor_completed_at?: string | null
          vendor_dispatched_at?: string | null
          vendor_name?: string | null
          vendor_status?: string
          vendor_user_id?: string | null
          waiting_on?: string | null
          waiting_reason?: string | null
          work_type_id?: string | null
        }
        Update: {
          accountable_owner?: string | null
          acknowledged_at?: string | null
          action_due_at?: string | null
          action_started_at?: string | null
          assigned_to?: string | null
          avoidable_reopen?: boolean
          breezeway_synced_at?: string | null
          breezeway_task_id?: string | null
          breezeway_task_status?: string | null
          breezeway_task_url?: string | null
          bucket?: string | null
          category?: string
          closure_evidence?: string | null
          closure_qa_result?: string
          created_at?: string
          created_by?: string | null
          created_on_behalf_of?: string | null
          cross_team?: boolean
          current_action_owner?: string | null
          department_code?: string | null
          description?: string | null
          due_at?: string | null
          escalated_at?: string | null
          escalation_level?: string
          external_id?: string | null
          external_source?: string | null
          external_status?: string | null
          external_synced_at?: string | null
          external_url?: string | null
          final_communication_sent?: boolean
          functional_role_code?: string | null
          guest_comm_owner?: string | null
          guest_confirmed?: boolean
          guest_contact?: string | null
          guest_impact?: string
          guest_in_residence?: boolean
          guest_name?: string | null
          handoff_note?: string | null
          handoff_status?: string
          handoff_type?: string | null
          id?: string
          initiator_type?: string
          last_reopened_at?: string | null
          late_reason?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          next_review_at?: string | null
          occupancy_status?: string
          outcome_type?: string | null
          ownerrez_booking_id?: string | null
          pending_handoff_to?: string | null
          playbook_id?: string | null
          priority?: string
          priority_override_reason?: string | null
          project_id?: string | null
          promised_update_due_at?: string | null
          property_id?: string | null
          reclassified_at?: string | null
          record_owner?: string | null
          record_type?: string
          ref?: number
          reopen_count?: number
          reported_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          response_due_at?: string | null
          source_channel?: string
          source_reference?: string | null
          status?: string
          suggested_priority?: string | null
          supervisor_caught?: boolean
          title?: string
          updated_at?: string
          vendor_accepted_at?: string | null
          vendor_brief?: string | null
          vendor_completed_at?: string | null
          vendor_dispatched_at?: string | null
          vendor_name?: string | null
          vendor_status?: string
          vendor_user_id?: string | null
          waiting_on?: string | null
          waiting_reason?: string | null
          work_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "work_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_work_type_id_fkey"
            columns: ["work_type_id"]
            isOneToOne: false
            referencedRelation: "work_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_attestations: {
        Row: {
          accepted_at: string
          id: string
          org_id: string
          statement: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          org_id: string
          statement: string
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          id?: string
          org_id?: string
          statement?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_attestations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_contacts: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          legacy_account_state: string | null
          legacy_departments: string[]
          legacy_groups: string[]
          match_status: string
          org_id: string | null
          phone: string | null
          role_note: string | null
          source_system: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          legacy_account_state?: string | null
          legacy_departments?: string[]
          legacy_groups?: string[]
          match_status?: string
          org_id?: string | null
          phone?: string | null
          role_note?: string | null
          source_system?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          legacy_account_state?: string | null
          legacy_departments?: string[]
          legacy_groups?: string[]
          match_status?: string
          org_id?: string | null
          phone?: string | null
          role_note?: string | null
          source_system?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_documents: {
        Row: {
          created_at: string
          doc_type: string
          expires_on: string | null
          external_url: string | null
          id: string
          note: string | null
          org_id: string
          restricted: boolean
          storage_path: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          expires_on?: string | null
          external_url?: string | null
          id?: string
          note?: string | null
          org_id: string
          restricted?: boolean
          storage_path?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          expires_on?: string | null
          external_url?: string | null
          id?: string
          note?: string | null
          org_id?: string
          restricted?: boolean
          storage_path?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_gatekeeper_results: {
        Row: {
          created_at: string
          expires_on: string | null
          id: string
          note: string | null
          org_id: string
          requirement_id: string
          result: string
          updated_at: string
          verification_method: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          expires_on?: string | null
          id?: string
          note?: string | null
          org_id: string
          requirement_id: string
          result?: string
          updated_at?: string
          verification_method?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          expires_on?: string | null
          id?: string
          note?: string | null
          org_id?: string
          requirement_id?: string
          result?: string
          updated_at?: string
          verification_method?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_gatekeeper_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_gatekeeper_results_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "gatekeeper_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          note: string | null
          source_system: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          note?: string | null
          source_system: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          note?: string | null
          source_system?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendor_import_rows: {
        Row: {
          batch_id: string
          created_at: string
          created_contact_id: string | null
          created_org_id: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string
          decision_note: string | null
          departments: string[]
          display_name: string
          email: string | null
          groups: string[]
          id: string
          match_confidence: number | null
          match_org_id: string | null
          match_reasons: string[]
          phone: string | null
          proposed_action: string
          raw: Json
          source_role: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_contact_id?: string | null
          created_org_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_note?: string | null
          departments?: string[]
          display_name: string
          email?: string | null
          groups?: string[]
          id?: string
          match_confidence?: number | null
          match_org_id?: string | null
          match_reasons?: string[]
          phone?: string | null
          proposed_action?: string
          raw?: Json
          source_role?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_contact_id?: string | null
          created_org_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_note?: string | null
          departments?: string[]
          display_name?: string
          email?: string | null
          groups?: string[]
          id?: string
          match_confidence?: number | null
          match_org_id?: string | null
          match_reasons?: string[]
          phone?: string | null
          proposed_action?: string
          raw?: Json
          source_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "vendor_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_import_rows_created_contact_id_fkey"
            columns: ["created_contact_id"]
            isOneToOne: false
            referencedRelation: "vendor_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_import_rows_created_org_id_fkey"
            columns: ["created_org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_import_rows_match_org_id_fkey"
            columns: ["match_org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_job_ratings: {
        Row: {
          communication: number
          created_at: string
          id: string
          note: string | null
          on_time: boolean
          overall: number
          photos_complete: boolean
          points: number
          rated_by: string | null
          reopened: boolean
          thoroughness: number
          ticket_id: string
          timeliness: number
          vendor_user_id: string
        }
        Insert: {
          communication: number
          created_at?: string
          id?: string
          note?: string | null
          on_time?: boolean
          overall?: number
          photos_complete?: boolean
          points?: number
          rated_by?: string | null
          reopened?: boolean
          thoroughness: number
          ticket_id: string
          timeliness: number
          vendor_user_id: string
        }
        Update: {
          communication?: number
          created_at?: string
          id?: string
          note?: string | null
          on_time?: boolean
          overall?: number
          photos_complete?: boolean
          points?: number
          rated_by?: string | null
          reopened?: boolean
          thoroughness?: number
          ticket_id?: string
          timeliness?: number
          vendor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_job_ratings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_org_members: {
        Row: {
          active: boolean
          attestation_version: string | null
          attested_at: string | null
          created_at: string
          id: string
          masked_code: string
          org_id: string
          updated_at: string
          user_id: string
          vendor_role: string
        }
        Insert: {
          active?: boolean
          attestation_version?: string | null
          attested_at?: string | null
          created_at?: string
          id?: string
          masked_code: string
          org_id: string
          updated_at?: string
          user_id: string
          vendor_role?: string
        }
        Update: {
          active?: boolean
          attestation_version?: string | null
          attested_at?: string | null
          created_at?: string
          id?: string
          masked_code?: string
          org_id?: string
          updated_at?: string
          user_id?: string
          vendor_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_orgs: {
        Row: {
          approval_limit: number | null
          capacity_note: string | null
          created_at: string
          created_by: string | null
          display_name: string
          emergency_available: boolean
          google_place_id: string | null
          google_rating: number | null
          google_refreshed_at: string | null
          google_review_count: number | null
          id: string
          insurance_expires_on: string | null
          insurance_status: string
          last_verified_at: string | null
          legacy_all_groups: boolean
          legacy_market_hints: string[]
          legal_name: string
          license_expires_on: string | null
          license_status: string
          markets: string[]
          notes: string | null
          payment_terms: string | null
          pricing_note: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          response_time_note: string | null
          service_categories: string[]
          status: string
          tier: string | null
          trial_jobs_required: number
          trial_score: number | null
          updated_at: string
          vendor_class: string
          w9_status: string
          website: string | null
        }
        Insert: {
          approval_limit?: number | null
          capacity_note?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          emergency_available?: boolean
          google_place_id?: string | null
          google_rating?: number | null
          google_refreshed_at?: string | null
          google_review_count?: number | null
          id?: string
          insurance_expires_on?: string | null
          insurance_status?: string
          last_verified_at?: string | null
          legacy_all_groups?: boolean
          legacy_market_hints?: string[]
          legal_name: string
          license_expires_on?: string | null
          license_status?: string
          markets?: string[]
          notes?: string | null
          payment_terms?: string | null
          pricing_note?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          response_time_note?: string | null
          service_categories?: string[]
          status?: string
          tier?: string | null
          trial_jobs_required?: number
          trial_score?: number | null
          updated_at?: string
          vendor_class?: string
          w9_status?: string
          website?: string | null
        }
        Update: {
          approval_limit?: number | null
          capacity_note?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          emergency_available?: boolean
          google_place_id?: string | null
          google_rating?: number | null
          google_refreshed_at?: string | null
          google_review_count?: number | null
          id?: string
          insurance_expires_on?: string | null
          insurance_status?: string
          last_verified_at?: string | null
          legacy_all_groups?: boolean
          legacy_market_hints?: string[]
          legal_name?: string
          license_expires_on?: string | null
          license_status?: string
          markets?: string[]
          notes?: string | null
          payment_terms?: string | null
          pricing_note?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          response_time_note?: string | null
          service_categories?: string[]
          status?: string
          tier?: string | null
          trial_jobs_required?: number
          trial_score?: number | null
          updated_at?: string
          vendor_class?: string
          w9_status?: string
          website?: string | null
        }
        Relationships: []
      }
      vendor_service_areas: {
        Row: {
          coverage_priority: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          org_id: string
          postal_code: string
          service_category: string
          territory_label: string | null
          travel_note: string | null
          updated_at: string
        }
        Insert: {
          coverage_priority?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          org_id: string
          postal_code: string
          service_category: string
          territory_label?: string | null
          travel_note?: string | null
          updated_at?: string
        }
        Update: {
          coverage_priority?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          org_id?: string
          postal_code?: string
          service_category?: string
          territory_label?: string | null
          travel_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_service_areas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_status_events: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          created_at: string
          from_status: string | null
          id: string
          org_id: string
          reason: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          org_id: string
          reason: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          org_id?: string
          reason?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_status_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      work_projects: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          name: string
          owner_id: string | null
          property_id: string | null
          starts_on: string | null
          status: string
          summary: string | null
          target_on: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          name: string
          owner_id?: string | null
          property_id?: string | null
          starts_on?: string | null
          status?: string
          summary?: string | null
          target_on?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          property_id?: string | null
          starts_on?: string | null
          status?: string
          summary?: string | null
          target_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      work_types: {
        Row: {
          action_start_minutes: number
          active: boolean
          backup_coverage: string | null
          bucket: string
          category: string
          clock_type: string
          completion_target: string | null
          created_at: string
          default_priority: string
          functional_role_code: string | null
          guest_communication_required: boolean
          id: string
          name: string
          operating_standard: string | null
          pending_approval: boolean
          playbook_id: string | null
          required_closure_evidence: string | null
          response_minutes: number
          sort_order: number
          team: string
          updated_at: string
        }
        Insert: {
          action_start_minutes?: number
          active?: boolean
          backup_coverage?: string | null
          bucket?: string
          category: string
          clock_type?: string
          completion_target?: string | null
          created_at?: string
          default_priority?: string
          functional_role_code?: string | null
          guest_communication_required?: boolean
          id?: string
          name: string
          operating_standard?: string | null
          pending_approval?: boolean
          playbook_id?: string | null
          required_closure_evidence?: string | null
          response_minutes?: number
          sort_order?: number
          team?: string
          updated_at?: string
        }
        Update: {
          action_start_minutes?: number
          active?: boolean
          backup_coverage?: string | null
          bucket?: string
          category?: string
          clock_type?: string
          completion_target?: string | null
          created_at?: string
          default_priority?: string
          functional_role_code?: string | null
          guest_communication_required?: boolean
          id?: string
          name?: string
          operating_standard?: string | null
          pending_approval?: boolean
          playbook_id?: string | null
          required_closure_evidence?: string | null
          response_minutes?: number
          sort_order?: number
          team?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_types_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_onboarding_staff: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_supervisor: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "tech" | "vendor" | "owner" | "onboarding"
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
      app_role: ["admin", "manager", "tech", "vendor", "owner", "onboarding"],
    },
  },
} as const
