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
      app_user_connections: {
        Row: {
          connected_identity: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_identity?: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_identity?: string | null
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      approval_email_responses: {
        Row: {
          approval_id: string | null
          attachments: Json
          body_text: string | null
          candidates: Json
          conversation_id: string | null
          created_at: string
          from_address: string | null
          from_name: string | null
          has_attachments: boolean
          id: string
          internet_message_id: string
          is_demo: boolean
          linked_at: string | null
          linked_by: string | null
          match_method: string | null
          message_id: string | null
          received_at: string | null
          status: string
          subject: string | null
          web_link: string | null
        }
        Insert: {
          approval_id?: string | null
          attachments?: Json
          body_text?: string | null
          candidates?: Json
          conversation_id?: string | null
          created_at?: string
          from_address?: string | null
          from_name?: string | null
          has_attachments?: boolean
          id?: string
          internet_message_id: string
          is_demo?: boolean
          linked_at?: string | null
          linked_by?: string | null
          match_method?: string | null
          message_id?: string | null
          received_at?: string | null
          status?: string
          subject?: string | null
          web_link?: string | null
        }
        Update: {
          approval_id?: string | null
          attachments?: Json
          body_text?: string | null
          candidates?: Json
          conversation_id?: string | null
          created_at?: string
          from_address?: string | null
          from_name?: string | null
          has_attachments?: boolean
          id?: string
          internet_message_id?: string
          is_demo?: boolean
          linked_at?: string | null
          linked_by?: string | null
          match_method?: string | null
          message_id?: string | null
          received_at?: string | null
          status?: string
          subject?: string | null
          web_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_email_responses_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
        ]
      }
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
          is_demo: boolean
          kind: string
          onboarding_delivery_attempt: Json | null
          onboarding_delivery_history: Json
          owner_email_conversation_id: string | null
          owner_email_sent_at: string | null
          owner_email_to: string | null
          property_id: string | null
          recorded_by: string | null
          ref: number | null
          requested_by: string | null
          responded_at: string | null
          response_channel: string | null
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
          is_demo?: boolean
          kind: string
          onboarding_delivery_attempt?: Json | null
          onboarding_delivery_history?: Json
          owner_email_conversation_id?: string | null
          owner_email_sent_at?: string | null
          owner_email_to?: string | null
          property_id?: string | null
          recorded_by?: string | null
          ref?: number | null
          requested_by?: string | null
          responded_at?: string | null
          response_channel?: string | null
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
          is_demo?: boolean
          kind?: string
          onboarding_delivery_attempt?: Json | null
          onboarding_delivery_history?: Json
          owner_email_conversation_id?: string | null
          owner_email_sent_at?: string | null
          owner_email_to?: string | null
          property_id?: string | null
          recorded_by?: string | null
          ref?: number | null
          requested_by?: string | null
          responded_at?: string | null
          response_channel?: string | null
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
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
      assessment_findings: {
        Row: {
          category: string
          context: string
          correction_task_id: string | null
          created_at: string
          created_by: string | null
          detail: string | null
          finding_key: string | null
          id: string
          is_demo: boolean
          location: string | null
          photo_url: string | null
          project_id: string | null
          property_id: string
          severity: string
          source_task_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          context?: string
          correction_task_id?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          finding_key?: string | null
          id?: string
          is_demo?: boolean
          location?: string | null
          photo_url?: string | null
          project_id?: string | null
          property_id: string
          severity?: string
          source_task_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          context?: string
          correction_task_id?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          finding_key?: string | null
          id?: string
          is_demo?: boolean
          location?: string | null
          photo_url?: string | null
          project_id?: string | null
          property_id?: string
          severity?: string
          source_task_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_findings_correction_task_id_fkey"
            columns: ["correction_task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_findings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_findings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "assessment_findings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_findings_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
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
      breezeway_outbound_tasks: {
        Row: {
          assignee: string | null
          assignee_ids: number[]
          assignee_names: string[]
          attempts: number
          breezeway_home_id: string
          breezeway_task_id: number | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          error_message: string | null
          id: string
          last_synced_at: string | null
          last_webhook_at: string | null
          onboarding_task_id: string | null
          priority: string | null
          property_id: string | null
          request_key: string
          resolve_evidence_note: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          source_type: string
          status: string
          tags: string[] | null
          template_id: string | null
          template_name: string | null
          ticket_id: string | null
          title: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          assignee?: string | null
          assignee_ids?: number[]
          assignee_names?: string[]
          attempts?: number
          breezeway_home_id: string
          breezeway_task_id?: number | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          last_webhook_at?: string | null
          onboarding_task_id?: string | null
          priority?: string | null
          property_id?: string | null
          request_key: string
          resolve_evidence_note?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          source_type: string
          status?: string
          tags?: string[] | null
          template_id?: string | null
          template_name?: string | null
          ticket_id?: string | null
          title: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          assignee?: string | null
          assignee_ids?: number[]
          assignee_names?: string[]
          attempts?: number
          breezeway_home_id?: string
          breezeway_task_id?: number | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          last_webhook_at?: string | null
          onboarding_task_id?: string | null
          priority?: string | null
          property_id?: string | null
          request_key?: string
          resolve_evidence_note?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          source_type?: string
          status?: string
          tags?: string[] | null
          template_id?: string | null
          template_name?: string | null
          ticket_id?: string | null
          title?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "breezeway_outbound_tasks_onboarding_task_id_fkey"
            columns: ["onboarding_task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breezeway_outbound_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "breezeway_outbound_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breezeway_outbound_tasks_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "breezeway_outbound_tasks_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breezeway_outbound_tasks_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      breezeway_people: {
        Row: {
          active: boolean
          breezeway_person_id: number
          email: string | null
          first_name: string | null
          id: string
          is_integration_identity: boolean
          last_name: string | null
          mapping_state: string
          resolve_user_id: string | null
          synced_at: string
        }
        Insert: {
          active?: boolean
          breezeway_person_id: number
          email?: string | null
          first_name?: string | null
          id?: string
          is_integration_identity?: boolean
          last_name?: string | null
          mapping_state?: string
          resolve_user_id?: string | null
          synced_at?: string
        }
        Update: {
          active?: boolean
          breezeway_person_id?: number
          email?: string | null
          first_name?: string | null
          id?: string
          is_integration_identity?: boolean
          last_name?: string | null
          mapping_state?: string
          resolve_user_id?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      breezeway_webhook_events: {
        Row: {
          company_id: number | null
          home_id: number | null
          id: string
          is_fixture: boolean
          outcome: string
          reason: string | null
          received_at: string
          recovered_at: string | null
          retry_count: number
          retryable: boolean
          task_id: number | null
          task_updated_at: string | null
        }
        Insert: {
          company_id?: number | null
          home_id?: number | null
          id?: string
          is_fixture?: boolean
          outcome: string
          reason?: string | null
          received_at?: string
          recovered_at?: string | null
          retry_count?: number
          retryable?: boolean
          task_id?: number | null
          task_updated_at?: string | null
        }
        Update: {
          company_id?: number | null
          home_id?: number | null
          id?: string
          is_fixture?: boolean
          outcome?: string
          reason?: string | null
          received_at?: string
          recovered_at?: string | null
          retry_count?: number
          retryable?: boolean
          task_id?: number | null
          task_updated_at?: string | null
        }
        Relationships: []
      }
      breezeway_webhook_subscriptions: {
        Row: {
          active: boolean
          id: string
          last_verified_at: string | null
          note: string | null
          receiver_host: string
          registered_at: string
          subscription_id: string | null
          webhook_type: string
        }
        Insert: {
          active?: boolean
          id?: string
          last_verified_at?: string | null
          note?: string | null
          receiver_host: string
          registered_at?: string
          subscription_id?: string | null
          webhook_type: string
        }
        Update: {
          active?: boolean
          id?: string
          last_verified_at?: string | null
          note?: string | null
          receiver_host?: string
          registered_at?: string
          subscription_id?: string | null
          webhook_type?: string
        }
        Relationships: []
      }
      breezeway_work_order_comments: {
        Row: {
          author: string | null
          body: string
          breezeway_comment_id: number | null
          breezeway_person_id: number | null
          breezeway_task_id: number
          commented_at: string | null
          created_at: string
          delivery_error: string | null
          delivery_state: string
          direction: string
          id: string
          identity_mode: string | null
          posted_at: string | null
          resolve_author_id: string | null
          resolve_author_name: string | null
          source: string
          work_order_id: string
        }
        Insert: {
          author?: string | null
          body: string
          breezeway_comment_id?: number | null
          breezeway_person_id?: number | null
          breezeway_task_id: number
          commented_at?: string | null
          created_at?: string
          delivery_error?: string | null
          delivery_state?: string
          direction?: string
          id?: string
          identity_mode?: string | null
          posted_at?: string | null
          resolve_author_id?: string | null
          resolve_author_name?: string | null
          source?: string
          work_order_id: string
        }
        Update: {
          author?: string | null
          body?: string
          breezeway_comment_id?: number | null
          breezeway_person_id?: number | null
          breezeway_task_id?: number
          commented_at?: string | null
          created_at?: string
          delivery_error?: string | null
          delivery_state?: string
          direction?: string
          id?: string
          identity_mode?: string | null
          posted_at?: string | null
          resolve_author_id?: string | null
          resolve_author_name?: string | null
          source?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breezeway_work_order_comments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "breezeway_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      breezeway_work_order_photos: {
        Row: {
          breezeway_created_at: string | null
          breezeway_photo_id: number | null
          breezeway_task_id: number
          caption: string | null
          evidence_item_id: string | null
          first_seen_at: string
          id: string
          last_synced_at: string
          photo_type: string | null
          property_id: string | null
          source: string
          uploader: string | null
          url: string
          work_order_id: string
        }
        Insert: {
          breezeway_created_at?: string | null
          breezeway_photo_id?: number | null
          breezeway_task_id: number
          caption?: string | null
          evidence_item_id?: string | null
          first_seen_at?: string
          id?: string
          last_synced_at?: string
          photo_type?: string | null
          property_id?: string | null
          source?: string
          uploader?: string | null
          url: string
          work_order_id: string
        }
        Update: {
          breezeway_created_at?: string | null
          breezeway_photo_id?: number | null
          breezeway_task_id?: number
          caption?: string | null
          evidence_item_id?: string | null
          first_seen_at?: string
          id?: string
          last_synced_at?: string
          photo_type?: string | null
          property_id?: string | null
          source?: string
          uploader?: string | null
          url?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breezeway_work_order_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "breezeway_work_order_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breezeway_work_order_photos_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "breezeway_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      breezeway_work_orders: {
        Row: {
          assignees: Json
          breezeway_created_at: string | null
          breezeway_home_id: string
          breezeway_task_id: number
          breezeway_updated_at: string | null
          comment_count: number
          created_at: string
          department: string | null
          description: string | null
          finished_at: string | null
          id: string
          last_synced_at: string
          linked_ticket_id: string | null
          name: string | null
          needs_attention: boolean
          photo_count: number
          priority: string | null
          property_id: string | null
          reservation_snapshot: Json | null
          scheduled_date: string | null
          scheduled_time: string | null
          stage: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          assignees?: Json
          breezeway_created_at?: string | null
          breezeway_home_id: string
          breezeway_task_id: number
          breezeway_updated_at?: string | null
          comment_count?: number
          created_at?: string
          department?: string | null
          description?: string | null
          finished_at?: string | null
          id?: string
          last_synced_at?: string
          linked_ticket_id?: string | null
          name?: string | null
          needs_attention?: boolean
          photo_count?: number
          priority?: string | null
          property_id?: string | null
          reservation_snapshot?: Json | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          stage?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          assignees?: Json
          breezeway_created_at?: string | null
          breezeway_home_id?: string
          breezeway_task_id?: number
          breezeway_updated_at?: string | null
          comment_count?: number
          created_at?: string
          department?: string | null
          description?: string | null
          finished_at?: string | null
          id?: string
          last_synced_at?: string
          linked_ticket_id?: string | null
          name?: string | null
          needs_attention?: boolean
          photo_count?: number
          priority?: string | null
          property_id?: string | null
          reservation_snapshot?: Json | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          stage?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breezeway_work_orders_linked_ticket_id_fkey"
            columns: ["linked_ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "breezeway_work_orders_linked_ticket_id_fkey"
            columns: ["linked_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breezeway_work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "breezeway_work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_activity: {
        Row: {
          author_id: string | null
          body: string | null
          claim_id: string
          created_at: string
          detail: Json | null
          event_type: string
          id: string
          is_demo: boolean
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          claim_id: string
          created_at?: string
          detail?: Json | null
          event_type?: string
          id?: string
          is_demo?: boolean
        }
        Update: {
          author_id?: string | null
          body?: string | null
          claim_id?: string
          created_at?: string
          detail?: Json | null
          event_type?: string
          id?: string
          is_demo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "claim_activity_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_waivers: {
        Row: {
          claim_id: string
          context: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          id: string
          is_demo: boolean
          reason: string
          requested_by: string
          routed_to: string | null
          routing_basis: string | null
          routing_note: string | null
          status: string
        }
        Insert: {
          claim_id: string
          context?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          is_demo?: boolean
          reason: string
          requested_by?: string
          routed_to?: string | null
          routing_basis?: string | null
          routing_note?: string | null
          status?: string
        }
        Update: {
          claim_id?: string
          context?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          is_demo?: boolean
          reason?: string
          requested_by?: string
          routed_to?: string | null
          routing_basis?: string | null
          routing_note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_waivers_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          actual_cost: number | null
          approved_amount: number | null
          assigned_to: string | null
          booking_source: string | null
          category: string | null
          claim_type: string
          closed_at: string | null
          contracting_party: string | null
          cost_snapshot: Json | null
          created_at: string
          created_by: string | null
          currency: string
          damage_categories: string[] | null
          deadline_on: string | null
          deadline_source: string | null
          deadline_timezone: string
          deadline_verified: boolean
          decided_on: string | null
          decision_document_ids: string[]
          departure_review_id: string | null
          deposit_payer: string | null
          deposit_release_on: string | null
          deposit_release_source: string | null
          deposit_release_verified: boolean
          disposition: string | null
          disposition_reason: string | null
          estimated_amount: number | null
          evidence_document_ids: string[] | null
          external_reference: string | null
          finance_decision_pending: string | null
          finance_treated_at: string | null
          finance_treated_by: string | null
          finance_treatment: string | null
          finance_treatment_note: string | null
          follow_up_on: string | null
          guest_name: string | null
          id: string
          incident_description: string | null
          incident_on: string | null
          is_demo: boolean
          leadership_decided_at: string | null
          leadership_decided_by: string | null
          leadership_decision: string | null
          leadership_decision_required: boolean
          nonrecovery_reason: string | null
          ownerrez_booking_id: string | null
          property_id: string | null
          recovered_amount: number | null
          recovered_on: string | null
          reservation_channel: string | null
          reservation_confirmation: string | null
          stage: string
          stay_arrival: string | null
          stay_departure: string | null
          submission_document_ids: string[]
          submitted_amount: number | null
          submitted_on: string | null
          ticket_id: string | null
          title: string
          updated_at: string
          work_order_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          approved_amount?: number | null
          assigned_to?: string | null
          booking_source?: string | null
          category?: string | null
          claim_type: string
          closed_at?: string | null
          contracting_party?: string | null
          cost_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string
          damage_categories?: string[] | null
          deadline_on?: string | null
          deadline_source?: string | null
          deadline_timezone?: string
          deadline_verified?: boolean
          decided_on?: string | null
          decision_document_ids?: string[]
          departure_review_id?: string | null
          deposit_payer?: string | null
          deposit_release_on?: string | null
          deposit_release_source?: string | null
          deposit_release_verified?: boolean
          disposition?: string | null
          disposition_reason?: string | null
          estimated_amount?: number | null
          evidence_document_ids?: string[] | null
          external_reference?: string | null
          finance_decision_pending?: string | null
          finance_treated_at?: string | null
          finance_treated_by?: string | null
          finance_treatment?: string | null
          finance_treatment_note?: string | null
          follow_up_on?: string | null
          guest_name?: string | null
          id?: string
          incident_description?: string | null
          incident_on?: string | null
          is_demo?: boolean
          leadership_decided_at?: string | null
          leadership_decided_by?: string | null
          leadership_decision?: string | null
          leadership_decision_required?: boolean
          nonrecovery_reason?: string | null
          ownerrez_booking_id?: string | null
          property_id?: string | null
          recovered_amount?: number | null
          recovered_on?: string | null
          reservation_channel?: string | null
          reservation_confirmation?: string | null
          stage?: string
          stay_arrival?: string | null
          stay_departure?: string | null
          submission_document_ids?: string[]
          submitted_amount?: number | null
          submitted_on?: string | null
          ticket_id?: string | null
          title: string
          updated_at?: string
          work_order_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          approved_amount?: number | null
          assigned_to?: string | null
          booking_source?: string | null
          category?: string | null
          claim_type?: string
          closed_at?: string | null
          contracting_party?: string | null
          cost_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string
          damage_categories?: string[] | null
          deadline_on?: string | null
          deadline_source?: string | null
          deadline_timezone?: string
          deadline_verified?: boolean
          decided_on?: string | null
          decision_document_ids?: string[]
          departure_review_id?: string | null
          deposit_payer?: string | null
          deposit_release_on?: string | null
          deposit_release_source?: string | null
          deposit_release_verified?: boolean
          disposition?: string | null
          disposition_reason?: string | null
          estimated_amount?: number | null
          evidence_document_ids?: string[] | null
          external_reference?: string | null
          finance_decision_pending?: string | null
          finance_treated_at?: string | null
          finance_treated_by?: string | null
          finance_treatment?: string | null
          finance_treatment_note?: string | null
          follow_up_on?: string | null
          guest_name?: string | null
          id?: string
          incident_description?: string | null
          incident_on?: string | null
          is_demo?: boolean
          leadership_decided_at?: string | null
          leadership_decided_by?: string | null
          leadership_decision?: string | null
          leadership_decision_required?: boolean
          nonrecovery_reason?: string | null
          ownerrez_booking_id?: string | null
          property_id?: string | null
          recovered_amount?: number | null
          recovered_on?: string | null
          reservation_channel?: string | null
          reservation_confirmation?: string | null
          stage?: string
          stay_arrival?: string | null
          stay_departure?: string | null
          submission_document_ids?: string[]
          submitted_amount?: number | null
          submitted_on?: string | null
          ticket_id?: string | null
          title?: string
          updated_at?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_departure_review_id_fkey"
            columns: ["departure_review_id"]
            isOneToOne: false
            referencedRelation: "departure_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "claims_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "claims_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "breezeway_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_account_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          breezeway_person_id: number
          created_at: string
          from_classification: string | null
          from_worker_id: string | null
          id: string
          note: string | null
          to_classification: string
          to_worker_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          breezeway_person_id: number
          created_at?: string
          from_classification?: string | null
          from_worker_id?: string | null
          id?: string
          note?: string | null
          to_classification: string
          to_worker_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          breezeway_person_id?: number
          created_at?: string
          from_classification?: string | null
          from_worker_id?: string | null
          id?: string
          note?: string | null
          to_classification?: string
          to_worker_id?: string | null
        }
        Relationships: []
      }
      cleaner_breezeway_accounts: {
        Row: {
          breezeway_person_id: number
          classification: string
          classification_note: string | null
          classified_at: string | null
          classified_by: string | null
          created_at: string
          first_seen_at: string
          last_seen_at: string
          last_seen_name: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          breezeway_person_id: number
          classification?: string
          classification_note?: string | null
          classified_at?: string | null
          classified_by?: string | null
          created_at?: string
          first_seen_at?: string
          last_seen_at?: string
          last_seen_name?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          breezeway_person_id?: number
          classification?: string
          classification_note?: string | null
          classified_at?: string | null
          classified_by?: string | null
          created_at?: string
          first_seen_at?: string
          last_seen_at?: string
          last_seen_name?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_breezeway_accounts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cleaner_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_dispatch_decisions: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          breezeway_task_id: number | null
          company_worker_id: string | null
          created_at: string
          evaluation: Json
          id: string
          is_fixture: boolean
          note: string | null
          override_id: string | null
          property_id: string
          scheduled_date: string | null
          state: string
          task_ref: string
          worker_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          breezeway_task_id?: number | null
          company_worker_id?: string | null
          created_at?: string
          evaluation?: Json
          id?: string
          is_fixture?: boolean
          note?: string | null
          override_id?: string | null
          property_id: string
          scheduled_date?: string | null
          state: string
          task_ref: string
          worker_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          breezeway_task_id?: number | null
          company_worker_id?: string | null
          created_at?: string
          evaluation?: Json
          id?: string
          is_fixture?: boolean
          note?: string | null
          override_id?: string | null
          property_id?: string
          scheduled_date?: string | null
          state?: string
          task_ref?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_dispatch_decisions_company_worker_id_fkey"
            columns: ["company_worker_id"]
            isOneToOne: false
            referencedRelation: "cleaner_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_dispatch_decisions_override_id_fkey"
            columns: ["override_id"]
            isOneToOne: false
            referencedRelation: "cleaner_safeguard_overrides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_dispatch_decisions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "cleaner_dispatch_decisions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_dispatch_decisions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cleaner_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_exposure_ledger: {
        Row: {
          assignee_count: number | null
          attributed_minutes: number | null
          attribution_method: string
          author_id: string | null
          author_name: string | null
          breezeway_person_id: number | null
          breezeway_person_name: string | null
          breezeway_task_id: number | null
          completion_date: string
          confidence: string
          counted: boolean
          created_at: string
          entry_key: string
          id: string
          is_fixture: boolean
          original_minutes: number | null
          property_id: string | null
          raw_elapsed_seconds: number | null
          reason: string | null
          review_state: string
          snapshot_id: string | null
          source_revision: string | null
          superseded_at: string | null
          superseded_reason: string | null
          supersedes_id: string | null
          synced_at: string
          worker_id: string | null
        }
        Insert: {
          assignee_count?: number | null
          attributed_minutes?: number | null
          attribution_method: string
          author_id?: string | null
          author_name?: string | null
          breezeway_person_id?: number | null
          breezeway_person_name?: string | null
          breezeway_task_id?: number | null
          completion_date: string
          confidence: string
          counted: boolean
          created_at?: string
          entry_key: string
          id?: string
          is_fixture?: boolean
          original_minutes?: number | null
          property_id?: string | null
          raw_elapsed_seconds?: number | null
          reason?: string | null
          review_state: string
          snapshot_id?: string | null
          source_revision?: string | null
          superseded_at?: string | null
          superseded_reason?: string | null
          supersedes_id?: string | null
          synced_at?: string
          worker_id?: string | null
        }
        Update: {
          assignee_count?: number | null
          attributed_minutes?: number | null
          attribution_method?: string
          author_id?: string | null
          author_name?: string | null
          breezeway_person_id?: number | null
          breezeway_person_name?: string | null
          breezeway_task_id?: number | null
          completion_date?: string
          confidence?: string
          counted?: boolean
          created_at?: string
          entry_key?: string
          id?: string
          is_fixture?: boolean
          original_minutes?: number | null
          property_id?: string | null
          raw_elapsed_seconds?: number | null
          reason?: string | null
          review_state?: string
          snapshot_id?: string | null
          source_revision?: string | null
          superseded_at?: string | null
          superseded_reason?: string | null
          supersedes_id?: string | null
          synced_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_exposure_ledger_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "cleaner_exposure_ledger_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_exposure_ledger_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "cleaner_task_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_exposure_ledger_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "cleaner_exposure_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_exposure_ledger_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cleaner_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_hours_properties: {
        Row: {
          active: boolean
          designated_at: string
          designated_by: string | null
          ended_at: string | null
          is_fixture: boolean
          note: string | null
          property_id: string
          standard_clean_minutes: number | null
          tracking_from: string
        }
        Insert: {
          active?: boolean
          designated_at?: string
          designated_by?: string | null
          ended_at?: string | null
          is_fixture?: boolean
          note?: string | null
          property_id: string
          standard_clean_minutes?: number | null
          tracking_from: string
        }
        Update: {
          active?: boolean
          designated_at?: string
          designated_by?: string | null
          ended_at?: string | null
          is_fixture?: boolean
          note?: string | null
          property_id?: string
          standard_clean_minutes?: number | null
          tracking_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_hours_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "cleaner_hours_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_hours_property_events: {
        Row: {
          active: boolean
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: string
          note: string | null
          property_id: string
          tracking_from: string | null
        }
        Insert: {
          active: boolean
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          property_id: string
          tracking_from?: string | null
        }
        Update: {
          active?: boolean
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          property_id?: string
          tracking_from?: string | null
        }
        Relationships: []
      }
      cleaner_pending_activations: {
        Row: {
          activated_at: string | null
          activated_from: string | null
          activated_task_id: number | null
          breezeway_home_id: string
          created_at: string
          earliest_date: string
          note: string | null
          property_id: string
        }
        Insert: {
          activated_at?: string | null
          activated_from?: string | null
          activated_task_id?: number | null
          breezeway_home_id: string
          created_at?: string
          earliest_date: string
          note?: string | null
          property_id: string
        }
        Update: {
          activated_at?: string | null
          activated_from?: string | null
          activated_task_id?: number | null
          breezeway_home_id?: string
          created_at?: string
          earliest_date?: string
          note?: string | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_pending_activations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "cleaner_pending_activations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_review_items: {
        Row: {
          breezeway_home_id: number | null
          breezeway_person_id: number | null
          breezeway_task_id: number | null
          created_at: string
          dedupe_key: string
          detail: Json
          id: string
          is_fixture: boolean
          kind: string
          ledger_entry_id: string | null
          property_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_by_name: string | null
          source_revision: string | null
          status: string
        }
        Insert: {
          breezeway_home_id?: number | null
          breezeway_person_id?: number | null
          breezeway_task_id?: number | null
          created_at?: string
          dedupe_key: string
          detail?: Json
          id?: string
          is_fixture?: boolean
          kind: string
          ledger_entry_id?: string | null
          property_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_by_name?: string | null
          source_revision?: string | null
          status?: string
        }
        Update: {
          breezeway_home_id?: number | null
          breezeway_person_id?: number | null
          breezeway_task_id?: number | null
          created_at?: string
          dedupe_key?: string
          detail?: Json
          id?: string
          is_fixture?: boolean
          kind?: string
          ledger_entry_id?: string | null
          property_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_by_name?: string | null
          source_revision?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_review_items_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "cleaner_exposure_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_review_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "cleaner_review_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_safeguard_overrides: {
        Row: {
          approved_by: string
          approved_by_name: string
          breezeway_task_id: number | null
          buffer_hours: number | null
          created_at: string
          current_hours: number
          estimate_source: string | null
          id: string
          is_fixture: boolean
          justification: string
          kind: string
          owner_hours: number
          projected_clean_hours: number
          projected_total_hours: number
          property_id: string
          reason_category: string
          scheduled_date: string | null
          state_at_approval: string
          task_ref: string
          worker_id: string
          year: number
        }
        Insert: {
          approved_by: string
          approved_by_name: string
          breezeway_task_id?: number | null
          buffer_hours?: number | null
          created_at?: string
          current_hours: number
          estimate_source?: string | null
          id?: string
          is_fixture?: boolean
          justification: string
          kind: string
          owner_hours: number
          projected_clean_hours: number
          projected_total_hours: number
          property_id: string
          reason_category: string
          scheduled_date?: string | null
          state_at_approval: string
          task_ref: string
          worker_id: string
          year: number
        }
        Update: {
          approved_by?: string
          approved_by_name?: string
          breezeway_task_id?: number | null
          buffer_hours?: number | null
          created_at?: string
          current_hours?: number
          estimate_source?: string | null
          id?: string
          is_fixture?: boolean
          justification?: string
          kind?: string
          owner_hours?: number
          projected_clean_hours?: number
          projected_total_hours?: number
          property_id?: string
          reason_category?: string
          scheduled_date?: string | null
          state_at_approval?: string
          task_ref?: string
          worker_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_safeguard_overrides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "cleaner_safeguard_overrides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_safeguard_overrides_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cleaner_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_sync_runs: {
        Row: {
          completed_at: string | null
          cursor: number
          errors: Json
          home_queue: Json
          id: string
          kind: string
          last_error: string | null
          people_refreshed_at: string | null
          snapshots_created: number
          started_at: string
          status: string
          tasks_seen: number
          updated_at: string
          window_from: string
          window_to: string
        }
        Insert: {
          completed_at?: string | null
          cursor?: number
          errors?: Json
          home_queue?: Json
          id?: string
          kind: string
          last_error?: string | null
          people_refreshed_at?: string | null
          snapshots_created?: number
          started_at?: string
          status?: string
          tasks_seen?: number
          updated_at?: string
          window_from: string
          window_to: string
        }
        Update: {
          completed_at?: string | null
          cursor?: number
          errors?: Json
          home_queue?: Json
          id?: string
          kind?: string
          last_error?: string | null
          people_refreshed_at?: string | null
          snapshots_created?: number
          started_at?: string
          status?: string
          tasks_seen?: number
          updated_at?: string
          window_from?: string
          window_to?: string
        }
        Relationships: []
      }
      cleaner_task_snapshots: {
        Row: {
          assignees: Json
          breezeway_home_id: number | null
          breezeway_task_id: number
          department: string | null
          elapsed_seconds: number | null
          finished_at: string | null
          finished_by_id: number | null
          finished_by_name: string | null
          id: string
          is_fixture: boolean
          linked_reservation: Json | null
          payload: Json
          payload_hash: string
          property_id: string | null
          scheduled_date: string | null
          source: string
          source_updated_at: string | null
          started_at: string | null
          status_code: string | null
          status_stage: string | null
          synced_at: string
          task_name: string | null
          template_id: number | null
          total_time: string | null
        }
        Insert: {
          assignees?: Json
          breezeway_home_id?: number | null
          breezeway_task_id: number
          department?: string | null
          elapsed_seconds?: number | null
          finished_at?: string | null
          finished_by_id?: number | null
          finished_by_name?: string | null
          id?: string
          is_fixture?: boolean
          linked_reservation?: Json | null
          payload: Json
          payload_hash: string
          property_id?: string | null
          scheduled_date?: string | null
          source: string
          source_updated_at?: string | null
          started_at?: string | null
          status_code?: string | null
          status_stage?: string | null
          synced_at?: string
          task_name?: string | null
          template_id?: number | null
          total_time?: string | null
        }
        Update: {
          assignees?: Json
          breezeway_home_id?: number | null
          breezeway_task_id?: number
          department?: string | null
          elapsed_seconds?: number | null
          finished_at?: string | null
          finished_by_id?: number | null
          finished_by_name?: string | null
          id?: string
          is_fixture?: boolean
          linked_reservation?: Json | null
          payload?: Json
          payload_hash?: string
          property_id?: string | null
          scheduled_date?: string | null
          source?: string
          source_updated_at?: string | null
          started_at?: string | null
          status_code?: string | null
          status_stage?: string | null
          synced_at?: string
          task_name?: string | null
          template_id?: number | null
          total_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_task_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "cleaner_task_snapshots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_task_state: {
        Row: {
          breezeway_task_id: number
          is_fixture: boolean
          last_source: string | null
          last_synced_at: string
          latest_snapshot_id: string | null
          property_id: string | null
        }
        Insert: {
          breezeway_task_id: number
          is_fixture?: boolean
          last_source?: string | null
          last_synced_at?: string
          latest_snapshot_id?: string | null
          property_id?: string | null
        }
        Update: {
          breezeway_task_id?: number
          is_fixture?: boolean
          last_source?: string | null
          last_synced_at?: string
          latest_snapshot_id?: string | null
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_task_state_latest_snapshot_id_fkey"
            columns: ["latest_snapshot_id"]
            isOneToOne: false
            referencedRelation: "cleaner_task_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_task_state_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "cleaner_task_state_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_workers: {
        Row: {
          account_type: string
          active: boolean
          company_worker_id: string | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          notes: string | null
          person_kinds: string[]
          staff_user_id: string | null
          updated_at: string
          updated_by: string | null
          vendor_org_id: string | null
        }
        Insert: {
          account_type: string
          active?: boolean
          company_worker_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          notes?: string | null
          person_kinds?: string[]
          staff_user_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_org_id?: string | null
        }
        Update: {
          account_type?: string
          active?: boolean
          company_worker_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          notes?: string | null
          person_kinds?: string[]
          staff_user_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_workers_company_worker_id_fkey"
            columns: ["company_worker_id"]
            isOneToOne: false
            referencedRelation: "cleaner_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_workers_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_regions: {
        Row: {
          created_at: string
          manager_id: string | null
          manager_name: string | null
          market: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          manager_id?: string | null
          manager_name?: string | null
          market: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          manager_id?: string | null
          manager_name?: string | null
          market?: string
          updated_at?: string
        }
        Relationships: []
      }
      cleaning_reviews: {
        Row: {
          breezeway_task_id: number | null
          cleaner_name: string | null
          created_at: string
          damage_found: boolean | null
          departure_review_id: string
          id: string
          is_demo: boolean
          linked_claim_id: string | null
          linked_ticket_ids: string[]
          notes: string | null
          outcome: string | null
          ownerrez_booking_id: string | null
          photo_document_ids: string[]
          property_id: string
          property_issues_found: boolean | null
          reservation_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          breezeway_task_id?: number | null
          cleaner_name?: string | null
          created_at?: string
          damage_found?: boolean | null
          departure_review_id: string
          id?: string
          is_demo?: boolean
          linked_claim_id?: string | null
          linked_ticket_ids?: string[]
          notes?: string | null
          outcome?: string | null
          ownerrez_booking_id?: string | null
          photo_document_ids?: string[]
          property_id: string
          property_issues_found?: boolean | null
          reservation_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          breezeway_task_id?: number | null
          cleaner_name?: string | null
          created_at?: string
          damage_found?: boolean | null
          departure_review_id?: string
          id?: string
          is_demo?: boolean
          linked_claim_id?: string | null
          linked_ticket_ids?: string[]
          notes?: string | null
          outcome?: string | null
          ownerrez_booking_id?: string | null
          photo_document_ids?: string[]
          property_id?: string
          property_issues_found?: boolean | null
          reservation_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_reviews_departure_review_id_fkey"
            columns: ["departure_review_id"]
            isOneToOne: true
            referencedRelation: "departure_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_reviews_linked_claim_id_fkey"
            columns: ["linked_claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "cleaning_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
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
      coverage_config: {
        Row: {
          after_hours_end_minute: number | null
          after_hours_start_minute: number | null
          configured_at: string | null
          configured_by: string | null
          id: boolean
          note: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          after_hours_end_minute?: number | null
          after_hours_start_minute?: number | null
          configured_at?: string | null
          configured_by?: string | null
          id?: boolean
          note?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          after_hours_end_minute?: number | null
          after_hours_start_minute?: number | null
          configured_at?: string | null
          configured_by?: string | null
          id?: boolean
          note?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      coverage_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          kind: string
          note: string | null
          role_code: string
          starts_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          kind?: string
          note?: string | null
          role_code: string
          starts_at: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          kind?: string
          note?: string | null
          role_code?: string
          starts_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coverage_shifts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          end_minute: number
          id: string
          note: string | null
          role_code: string
          start_minute: number
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          end_minute: number
          id?: string
          note?: string | null
          role_code: string
          start_minute: number
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          end_minute?: number
          id?: string
          note?: string | null
          role_code?: string
          start_minute?: number
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "coverage_shifts_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "functional_roles"
            referencedColumns: ["code"]
          },
        ]
      }
      coverage_triage_windows: {
        Row: {
          active: boolean
          covers_team: string
          created_at: string
          created_by: string | null
          end_minute: number
          id: string
          note: string | null
          role_code: string
          start_minute: number
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          covers_team: string
          created_at?: string
          created_by?: string | null
          end_minute: number
          id?: string
          note?: string | null
          role_code: string
          start_minute: number
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          covers_team?: string
          created_at?: string
          created_by?: string | null
          end_minute?: number
          id?: string
          note?: string | null
          role_code?: string
          start_minute?: number
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      credential_access_log: {
        Row: {
          action: string
          credential_id: string | null
          id: string
          occurred_at: string
          property_id: string | null
          ticket_id: string | null
          user_agent_hash: string | null
          user_id: string
        }
        Insert: {
          action: string
          credential_id?: string | null
          id?: string
          occurred_at?: string
          property_id?: string | null
          ticket_id?: string | null
          user_agent_hash?: string | null
          user_id: string
        }
        Update: {
          action?: string
          credential_id?: string | null
          id?: string
          occurred_at?: string
          property_id?: string | null
          ticket_id?: string | null
          user_agent_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_access_log_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "property_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_access_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "credential_access_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_intake_queue: {
        Row: {
          created_at: string
          id: string
          property_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          secret_ciphertext: string
          secret_nonce: string
          source_field: string
          status: string
          suggested_category: Database["public"]["Enums"]["credential_category"]
          suggested_label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          secret_ciphertext: string
          secret_nonce: string
          source_field: string
          status?: string
          suggested_category?: Database["public"]["Enums"]["credential_category"]
          suggested_label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          secret_ciphertext?: string
          secret_nonce?: string
          source_field?: string
          status?: string
          suggested_category?: Database["public"]["Enums"]["credential_category"]
          suggested_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_intake_queue_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "credential_intake_queue_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_environment: {
        Row: {
          active: boolean
          id: string
          scenario_count: number
          seeded_at: string | null
        }
        Insert: {
          active?: boolean
          id: string
          scenario_count?: number
          seeded_at?: string | null
        }
        Update: {
          active?: boolean
          id?: string
          scenario_count?: number
          seeded_at?: string | null
        }
        Relationships: []
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
      departure_clean_match_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_state: string | null
          id: string
          match_id: string
          ownerrez_booking_id: string | null
          summary: string | null
          to_state: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_state?: string | null
          id?: string
          match_id: string
          ownerrez_booking_id?: string | null
          summary?: string | null
          to_state?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_state?: string | null
          id?: string
          match_id?: string
          ownerrez_booking_id?: string | null
          summary?: string | null
          to_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departure_clean_match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "departure_clean_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      departure_clean_matches: {
        Row: {
          breezeway_task_id: number | null
          breezeway_work_order_id: string
          candidates: Json
          checkout_date: string | null
          confidence: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          is_manual: boolean
          last_evaluated_at: string
          match_method: string | null
          ownerrez_booking_id: string | null
          property_id: string | null
          reason: string | null
          reservation: Json | null
          state: string
          updated_at: string
        }
        Insert: {
          breezeway_task_id?: number | null
          breezeway_work_order_id: string
          candidates?: Json
          checkout_date?: string | null
          confidence?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          is_manual?: boolean
          last_evaluated_at?: string
          match_method?: string | null
          ownerrez_booking_id?: string | null
          property_id?: string | null
          reason?: string | null
          reservation?: Json | null
          state: string
          updated_at?: string
        }
        Update: {
          breezeway_task_id?: number | null
          breezeway_work_order_id?: string
          candidates?: Json
          checkout_date?: string | null
          confidence?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          is_manual?: boolean
          last_evaluated_at?: string
          match_method?: string | null
          ownerrez_booking_id?: string | null
          property_id?: string | null
          reason?: string | null
          reservation?: Json | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departure_clean_matches_breezeway_work_order_id_fkey"
            columns: ["breezeway_work_order_id"]
            isOneToOne: true
            referencedRelation: "breezeway_work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departure_clean_matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "departure_clean_matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      departure_review_events: {
        Row: {
          actor_id: string | null
          created_at: string
          departure_review_id: string
          event_type: string
          id: string
          property_id: string
          summary: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          departure_review_id: string
          event_type: string
          id?: string
          property_id: string
          summary: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          departure_review_id?: string
          event_type?: string
          id?: string
          property_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "departure_review_events_departure_review_id_fkey"
            columns: ["departure_review_id"]
            isOneToOne: false
            referencedRelation: "departure_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      departure_reviews: {
        Row: {
          attachment_document_ids: string[]
          booking_source: string | null
          breezeway_task_id: number
          breezeway_work_order_id: string | null
          claim_id: string | null
          claimed_at: string | null
          claimed_by: string | null
          clean_completed_at: string | null
          clean_completed_exact: boolean
          clean_name: string | null
          clean_photo_count: number | null
          clean_reviewed_at: string | null
          clean_reviewed_by: string | null
          cleaner_name: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          damage_categories: string[]
          damage_description: string | null
          damage_estimate: number | null
          damage_notes: string | null
          damage_screen: string | null
          deposit_amount: number | null
          deposit_payer: string | null
          event_key: string
          guest_name: string | null
          host_review: string | null
          id: string
          is_demo: boolean
          notes: string | null
          outreach_decision: string | null
          outreach_reason: string | null
          outreach_status: string | null
          ownerrez_booking_id: string | null
          property_attention: string | null
          property_id: string
          property_notes: string | null
          reservation_code: string | null
          status: string
          stay_arrival: string | null
          stay_departure: string | null
          team: string
          updated_at: string
        }
        Insert: {
          attachment_document_ids?: string[]
          booking_source?: string | null
          breezeway_task_id: number
          breezeway_work_order_id?: string | null
          claim_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          clean_completed_at?: string | null
          clean_completed_exact?: boolean
          clean_name?: string | null
          clean_photo_count?: number | null
          clean_reviewed_at?: string | null
          clean_reviewed_by?: string | null
          cleaner_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          damage_categories?: string[]
          damage_description?: string | null
          damage_estimate?: number | null
          damage_notes?: string | null
          damage_screen?: string | null
          deposit_amount?: number | null
          deposit_payer?: string | null
          event_key: string
          guest_name?: string | null
          host_review?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          outreach_decision?: string | null
          outreach_reason?: string | null
          outreach_status?: string | null
          ownerrez_booking_id?: string | null
          property_attention?: string | null
          property_id: string
          property_notes?: string | null
          reservation_code?: string | null
          status?: string
          stay_arrival?: string | null
          stay_departure?: string | null
          team?: string
          updated_at?: string
        }
        Update: {
          attachment_document_ids?: string[]
          booking_source?: string | null
          breezeway_task_id?: number
          breezeway_work_order_id?: string | null
          claim_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          clean_completed_at?: string | null
          clean_completed_exact?: boolean
          clean_name?: string | null
          clean_photo_count?: number | null
          clean_reviewed_at?: string | null
          clean_reviewed_by?: string | null
          cleaner_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          damage_categories?: string[]
          damage_description?: string | null
          damage_estimate?: number | null
          damage_notes?: string | null
          damage_screen?: string | null
          deposit_amount?: number | null
          deposit_payer?: string | null
          event_key?: string
          guest_name?: string | null
          host_review?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          outreach_decision?: string | null
          outreach_reason?: string | null
          outreach_status?: string | null
          ownerrez_booking_id?: string | null
          property_attention?: string | null
          property_id?: string
          property_notes?: string | null
          reservation_code?: string | null
          status?: string
          stay_arrival?: string | null
          stay_departure?: string | null
          team?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departure_reviews_breezeway_work_order_id_fkey"
            columns: ["breezeway_work_order_id"]
            isOneToOne: false
            referencedRelation: "breezeway_work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departure_reviews_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departure_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "departure_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      document_recipient_events: {
        Row: {
          actor_id: string
          created_at: string
          document_id: string
          event: string
          id: string
          owner_id: string
          program_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          document_id: string
          event: string
          id?: string
          owner_id: string
          program_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          document_id?: string
          event?: string
          id?: string
          owner_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_recipient_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_recipient_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_recipient_events_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          department_id: string | null
          entity_id: string
          entity_type: string
          external_url: string | null
          fulfilled_by_document_id: string | null
          fulfils_request_id: string | null
          id: string
          is_demo: boolean
          kind: string
          mime_type: string | null
          note: string | null
          original_filename: string | null
          owner_category: string | null
          owner_recipient_id: string | null
          owner_recipient_program_id: string | null
          property_id: string | null
          requested_from: string | null
          required: boolean
          size_bytes: number | null
          storage_path: string | null
          title: string
          updated_at: string
          upload_key: string | null
          upload_status: string
          uploaded_at: string | null
          uploaded_by: string | null
          visibility: string
          work_item_id: string | null
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          entity_id: string
          entity_type: string
          external_url?: string | null
          fulfilled_by_document_id?: string | null
          fulfils_request_id?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          mime_type?: string | null
          note?: string | null
          original_filename?: string | null
          owner_category?: string | null
          owner_recipient_id?: string | null
          owner_recipient_program_id?: string | null
          property_id?: string | null
          requested_from?: string | null
          required?: boolean
          size_bytes?: number | null
          storage_path?: string | null
          title: string
          updated_at?: string
          upload_key?: string | null
          upload_status?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          visibility?: string
          work_item_id?: string | null
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          entity_id?: string
          entity_type?: string
          external_url?: string | null
          fulfilled_by_document_id?: string | null
          fulfils_request_id?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          mime_type?: string | null
          note?: string | null
          original_filename?: string | null
          owner_category?: string | null
          owner_recipient_id?: string | null
          owner_recipient_program_id?: string | null
          property_id?: string | null
          requested_from?: string | null
          required?: boolean
          size_bytes?: number | null
          storage_path?: string | null
          title?: string
          updated_at?: string
          upload_key?: string | null
          upload_status?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          visibility?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_fulfilled_by_document_id_fkey"
            columns: ["fulfilled_by_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_fulfils_request_id_fkey"
            columns: ["fulfils_request_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_owner_recipient_id_fkey"
            columns: ["owner_recipient_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_owner_recipient_program_id_fkey"
            columns: ["owner_recipient_program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          attachments: Json
          attempts: number
          bcc: string[]
          body: string | null
          cc: string[]
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          purpose: string
          recipient: string
          reply_to: string | null
          scheduled_for: string | null
          scheduled_time_zone: string | null
          sender: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          template_id: string | null
          ticket_id: string | null
          to_additional: string[]
        }
        Insert: {
          attachments?: Json
          attempts?: number
          bcc?: string[]
          body?: string | null
          cc?: string[]
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          purpose?: string
          recipient: string
          reply_to?: string | null
          scheduled_for?: string | null
          scheduled_time_zone?: string | null
          sender?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          template_id?: string | null
          ticket_id?: string | null
          to_additional?: string[]
        }
        Update: {
          attachments?: Json
          attempts?: number
          bcc?: string[]
          body?: string | null
          cc?: string[]
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          purpose?: string
          recipient?: string
          reply_to?: string | null
          scheduled_for?: string | null
          scheduled_time_zone?: string | null
          sender?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          template_id?: string | null
          ticket_id?: string | null
          to_additional?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "email_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          active: boolean
          audience: string
          body: string
          contexts: string[]
          created_at: string
          created_by: string | null
          id: string
          name: string
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          audience?: string
          body: string
          contexts?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          audience?: string
          body?: string
          contexts?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      escalations: {
        Row: {
          already_tried: string | null
          created_at: string
          escalated_by: string
          escalated_to: string | null
          escalated_to_role: string
          help_needed: string | null
          id: string
          is_demo: boolean
          outcome: string | null
          outcome_note: string | null
          property_id: string | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          ticket_id: string | null
          updated_at: string
          urgency: string
          work_order_id: string | null
        }
        Insert: {
          already_tried?: string | null
          created_at?: string
          escalated_by: string
          escalated_to?: string | null
          escalated_to_role: string
          help_needed?: string | null
          id?: string
          is_demo?: boolean
          outcome?: string | null
          outcome_note?: string | null
          property_id?: string | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
          urgency?: string
          work_order_id?: string | null
        }
        Update: {
          already_tried?: string | null
          created_at?: string
          escalated_by?: string
          escalated_to?: string | null
          escalated_to_role?: string
          help_needed?: string | null
          id?: string
          is_demo?: boolean
          outcome?: string | null
          outcome_note?: string | null
          property_id?: string | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
          urgency?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "escalations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "escalations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: Json
          event: string
          id: string
          item_id: string | null
          requirement_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: Json
          event: string
          id?: string
          item_id?: string | null
          requirement_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: Json
          event?: string
          id?: string
          item_id?: string | null
          requirement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "evidence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_events_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "evidence_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_items: {
        Row: {
          breezeway_photo_id: number | null
          breezeway_task_id: number | null
          created_at: string
          document_id: string | null
          evaluated_at: string | null
          evaluator: string | null
          exception_at: string | null
          exception_by: string | null
          exception_reason: string | null
          external_url: string | null
          guidance: string | null
          id: string
          original_rejection: string | null
          posted_to_breezeway_at: string | null
          property_id: string | null
          reason_codes: string[]
          requirement_id: string | null
          source: string
          stage_a: Json
          stage_b: Json
          status: string
          uploaded_by: string | null
        }
        Insert: {
          breezeway_photo_id?: number | null
          breezeway_task_id?: number | null
          created_at?: string
          document_id?: string | null
          evaluated_at?: string | null
          evaluator?: string | null
          exception_at?: string | null
          exception_by?: string | null
          exception_reason?: string | null
          external_url?: string | null
          guidance?: string | null
          id?: string
          original_rejection?: string | null
          posted_to_breezeway_at?: string | null
          property_id?: string | null
          reason_codes?: string[]
          requirement_id?: string | null
          source?: string
          stage_a?: Json
          stage_b?: Json
          status?: string
          uploaded_by?: string | null
        }
        Update: {
          breezeway_photo_id?: number | null
          breezeway_task_id?: number | null
          created_at?: string
          document_id?: string | null
          evaluated_at?: string | null
          evaluator?: string | null
          exception_at?: string | null
          exception_by?: string | null
          exception_reason?: string | null
          external_url?: string | null
          guidance?: string | null
          id?: string
          original_rejection?: string | null
          posted_to_breezeway_at?: string | null
          property_id?: string | null
          reason_codes?: string[]
          requirement_id?: string | null
          source?: string
          stage_a?: Json
          stage_b?: Json
          status?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "evidence_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_items_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "evidence_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_requirements: {
        Row: {
          accepted_item_id: string | null
          created_at: string
          created_by: string | null
          detail: string | null
          id: string
          instruction: string | null
          label: string
          property_id: string | null
          required: boolean
          requirement_kind: string
          slot_key: string
          status: string
          subject_id: string
          subject_type: string
          updated_at: string
        }
        Insert: {
          accepted_item_id?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          instruction?: string | null
          label: string
          property_id?: string | null
          required?: boolean
          requirement_kind?: string
          slot_key: string
          status?: string
          subject_id: string
          subject_type: string
          updated_at?: string
        }
        Update: {
          accepted_item_id?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          instruction?: string | null
          label?: string
          property_id?: string | null
          required?: boolean
          requirement_kind?: string
          slot_key?: string
          status?: string
          subject_id?: string
          subject_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_requirements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "evidence_requirements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_events: {
        Row: {
          actor_id: string | null
          after_value: Json | null
          before_value: Json | null
          created_at: string
          expense_id: string
          id: string
          kind: string
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          expense_id: string
          id?: string
          kind: string
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          expense_id?: string
          id?: string
          kind?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_events_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_links: {
        Row: {
          created_at: string
          created_by: string | null
          expense_id: string
          id: string
          link_type: string
          target_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expense_id: string
          id?: string
          link_type: string
          target_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expense_id?: string
          id?: string
          link_type?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_links_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_recoveries: {
        Row: {
          accounting_reference: string | null
          claim_id: string | null
          corrects_id: string | null
          created_at: string
          created_by: string | null
          expected_amount: number
          expense_id: string | null
          id: string
          is_demo: boolean
          note: string | null
          party: string
          received_amount: number
          received_on: string | null
          updated_at: string
        }
        Insert: {
          accounting_reference?: string | null
          claim_id?: string | null
          corrects_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_amount?: number
          expense_id?: string | null
          id?: string
          is_demo?: boolean
          note?: string | null
          party: string
          received_amount?: number
          received_on?: string | null
          updated_at?: string
        }
        Update: {
          accounting_reference?: string | null
          claim_id?: string | null
          corrects_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_amount?: number
          expense_id?: string | null
          id?: string
          is_demo?: boolean
          note?: string | null
          party?: string
          received_amount?: number
          received_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_recoveries_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_recoveries_corrects_id_fkey"
            columns: ["corrects_id"]
            isOneToOne: false
            referencedRelation: "expense_recoveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_recoveries_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number | null
          approval_id: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          authorization_note: string | null
          change_reason: string | null
          cost_responsibility: string
          created_at: string
          created_by: string | null
          dispatch_reason: string | null
          duplicate_flag: string | null
          duplicate_of: string | null
          expense_date: string | null
          expense_type: string
          finance_review: string
          finance_treatment_note: string | null
          financial_request_id: string | null
          id: string
          invoice_date: string | null
          invoice_document_ids: string[]
          is_demo: boolean
          is_estimate: boolean
          leadership_assignee: string | null
          leadership_decided_at: string | null
          leadership_decided_by: string | null
          leadership_decision: string | null
          leadership_reason: string | null
          leadership_required: boolean
          ops_completion: string
          ops_recommendation_note: string | null
          owner_notification_note: string | null
          owner_notified_at: string | null
          ownerrez_booking_id: string | null
          payee: string | null
          photo_document_ids: string[]
          photos_required: boolean
          property_id: string | null
          proposed_statement_period: string | null
          purchase_auth_evidence: string | null
          purchase_auth_status: string | null
          purchase_authorized_by: string | null
          purchase_purpose: string | null
          purchased_what: string | null
          qb_reference_manual: string | null
          reason: string | null
          received_on: string
          recommended_by: string | null
          recommended_responsibility: string | null
          reservation_link_state: string
          reviewed_at: string | null
          reviewed_by: string | null
          split_allocations: Json
          updated_at: string
          vendor_invoice_ref: string | null
          visit_outcome: string | null
          work_order_visit_id: string | null
        }
        Insert: {
          amount?: number | null
          approval_id?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          authorization_note?: string | null
          change_reason?: string | null
          cost_responsibility?: string
          created_at?: string
          created_by?: string | null
          dispatch_reason?: string | null
          duplicate_flag?: string | null
          duplicate_of?: string | null
          expense_date?: string | null
          expense_type?: string
          finance_review?: string
          finance_treatment_note?: string | null
          financial_request_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_document_ids?: string[]
          is_demo?: boolean
          is_estimate?: boolean
          leadership_assignee?: string | null
          leadership_decided_at?: string | null
          leadership_decided_by?: string | null
          leadership_decision?: string | null
          leadership_reason?: string | null
          leadership_required?: boolean
          ops_completion?: string
          ops_recommendation_note?: string | null
          owner_notification_note?: string | null
          owner_notified_at?: string | null
          ownerrez_booking_id?: string | null
          payee?: string | null
          photo_document_ids?: string[]
          photos_required?: boolean
          property_id?: string | null
          proposed_statement_period?: string | null
          purchase_auth_evidence?: string | null
          purchase_auth_status?: string | null
          purchase_authorized_by?: string | null
          purchase_purpose?: string | null
          purchased_what?: string | null
          qb_reference_manual?: string | null
          reason?: string | null
          received_on?: string
          recommended_by?: string | null
          recommended_responsibility?: string | null
          reservation_link_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          split_allocations?: Json
          updated_at?: string
          vendor_invoice_ref?: string | null
          visit_outcome?: string | null
          work_order_visit_id?: string | null
        }
        Update: {
          amount?: number | null
          approval_id?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          authorization_note?: string | null
          change_reason?: string | null
          cost_responsibility?: string
          created_at?: string
          created_by?: string | null
          dispatch_reason?: string | null
          duplicate_flag?: string | null
          duplicate_of?: string | null
          expense_date?: string | null
          expense_type?: string
          finance_review?: string
          finance_treatment_note?: string | null
          financial_request_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_document_ids?: string[]
          is_demo?: boolean
          is_estimate?: boolean
          leadership_assignee?: string | null
          leadership_decided_at?: string | null
          leadership_decided_by?: string | null
          leadership_decision?: string | null
          leadership_reason?: string | null
          leadership_required?: boolean
          ops_completion?: string
          ops_recommendation_note?: string | null
          owner_notification_note?: string | null
          owner_notified_at?: string | null
          ownerrez_booking_id?: string | null
          payee?: string | null
          photo_document_ids?: string[]
          photos_required?: boolean
          property_id?: string | null
          proposed_statement_period?: string | null
          purchase_auth_evidence?: string | null
          purchase_auth_status?: string | null
          purchase_authorized_by?: string | null
          purchase_purpose?: string | null
          purchased_what?: string | null
          qb_reference_manual?: string | null
          reason?: string | null
          received_on?: string
          recommended_by?: string | null
          recommended_responsibility?: string | null
          reservation_link_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          split_allocations?: Json
          updated_at?: string
          vendor_invoice_ref?: string | null
          visit_outcome?: string | null
          work_order_visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_financial_request_id_fkey"
            columns: ["financial_request_id"]
            isOneToOne: false
            referencedRelation: "financial_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_wo_visit_fk"
            columns: ["work_order_visit_id"]
            isOneToOne: false
            referencedRelation: "work_order_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      external_databases: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          external_database_id: string | null
          id: string
          key: string
          label: string
          read_only: boolean
          source: string
          sync_enabled: boolean
          updated_at: string
          verified: boolean
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          external_database_id?: string | null
          id?: string
          key: string
          label: string
          read_only?: boolean
          source?: string
          sync_enabled?: boolean
          updated_at?: string
          verified?: boolean
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          external_database_id?: string | null
          id?: string
          key?: string
          label?: string
          read_only?: boolean
          source?: string
          sync_enabled?: boolean
          updated_at?: string
          verified?: boolean
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
      external_records: {
        Row: {
          archived_at: string | null
          created_at: string
          database_key: string
          external_id: string
          id: string
          is_demo: boolean
          match_note: string | null
          match_status: string
          matched_at: string | null
          matched_by: string | null
          ownerrez_property_id: string | null
          payload: Json
          property_id: string | null
          source: string
          title: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          database_key: string
          external_id: string
          id?: string
          is_demo?: boolean
          match_note?: string | null
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          ownerrez_property_id?: string | null
          payload?: Json
          property_id?: string | null
          source?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          database_key?: string
          external_id?: string
          id?: string
          is_demo?: boolean
          match_note?: string | null
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          ownerrez_property_id?: string | null
          payload?: Json
          property_id?: string | null
          source?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_records_database_key_fkey"
            columns: ["database_key"]
            isOneToOne: false
            referencedRelation: "external_databases"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "external_records_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "external_records_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
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
      financial_requests: {
        Row: {
          accounting_recipient: string | null
          accounting_sent_at: string | null
          actual_amount: number | null
          actual_recorded_at: string | null
          actual_recorded_by: string | null
          approval_id: string | null
          approved_amount: number | null
          approved_at: string | null
          authority_policy: Json | null
          authority_tier: string
          created_at: string
          created_by: string | null
          description: string | null
          emergency: boolean
          emergency_reason: string | null
          estimate_amount: number
          id: string
          invoice_amount: number | null
          invoice_at: string | null
          invoice_ref: string | null
          is_demo: boolean
          kind: string
          onboarding_delivery_attempt: Json | null
          onboarding_delivery_history: Json
          project_id: string | null
          property_id: string
          settled_at: string | null
          settlement_note: string | null
          status: string
          task_id: string | null
          title: string
          updated_at: string
          variance_note: string | null
          vendor: string | null
        }
        Insert: {
          accounting_recipient?: string | null
          accounting_sent_at?: string | null
          actual_amount?: number | null
          actual_recorded_at?: string | null
          actual_recorded_by?: string | null
          approval_id?: string | null
          approved_amount?: number | null
          approved_at?: string | null
          authority_policy?: Json | null
          authority_tier?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          emergency?: boolean
          emergency_reason?: string | null
          estimate_amount?: number
          id?: string
          invoice_amount?: number | null
          invoice_at?: string | null
          invoice_ref?: string | null
          is_demo?: boolean
          kind?: string
          onboarding_delivery_attempt?: Json | null
          onboarding_delivery_history?: Json
          project_id?: string | null
          property_id: string
          settled_at?: string | null
          settlement_note?: string | null
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
          variance_note?: string | null
          vendor?: string | null
        }
        Update: {
          accounting_recipient?: string | null
          accounting_sent_at?: string | null
          actual_amount?: number | null
          actual_recorded_at?: string | null
          actual_recorded_by?: string | null
          approval_id?: string | null
          approved_amount?: number | null
          approved_at?: string | null
          authority_policy?: Json | null
          authority_tier?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          emergency?: boolean
          emergency_reason?: string | null
          estimate_amount?: number
          id?: string
          invoice_amount?: number | null
          invoice_at?: string | null
          invoice_ref?: string | null
          is_demo?: boolean
          kind?: string
          onboarding_delivery_attempt?: Json | null
          onboarding_delivery_history?: Json
          project_id?: string | null
          property_id?: string
          settled_at?: string | null
          settlement_note?: string | null
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          variance_note?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_requests_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "financial_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      functional_role_members: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          role_code: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          role_code: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          role_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "functional_role_members_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "functional_roles"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "functional_role_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      functional_roles: {
        Row: {
          active: boolean
          available: boolean
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
          unavailable_note: string | null
          unavailable_until: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          available?: boolean
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
          unavailable_note?: string | null
          unavailable_until?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          available?: boolean
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
          unavailable_note?: string | null
          unavailable_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gatekeeper_requirements: {
        Row: {
          active: boolean
          allows_equivalent: boolean
          allows_not_applicable: boolean
          applies_to_category: string | null
          applies_to_class: string
          applies_to_market: string | null
          approver_role: string
          code: string
          created_at: string
          detail: string | null
          evidence_required: boolean
          exception_rule: string | null
          expires_after_days: number | null
          expiry_required: boolean
          id: string
          label: string
          requirement_level: string
          sort_order: number
          updated_at: string
          verification_method: string | null
        }
        Insert: {
          active?: boolean
          allows_equivalent?: boolean
          allows_not_applicable?: boolean
          applies_to_category?: string | null
          applies_to_class?: string
          applies_to_market?: string | null
          approver_role?: string
          code: string
          created_at?: string
          detail?: string | null
          evidence_required?: boolean
          exception_rule?: string | null
          expires_after_days?: number | null
          expiry_required?: boolean
          id?: string
          label: string
          requirement_level?: string
          sort_order?: number
          updated_at?: string
          verification_method?: string | null
        }
        Update: {
          active?: boolean
          allows_equivalent?: boolean
          allows_not_applicable?: boolean
          applies_to_category?: string | null
          applies_to_class?: string
          applies_to_market?: string | null
          approver_role?: string
          code?: string
          created_at?: string
          detail?: string | null
          evidence_required?: boolean
          exception_rule?: string | null
          expires_after_days?: number | null
          expiry_required?: boolean
          id?: string
          label?: string
          requirement_level?: string
          sort_order?: number
          updated_at?: string
          verification_method?: string | null
        }
        Relationships: []
      }
      guest_feedback: {
        Row: {
          booking_platform: string | null
          contact_notes: string | null
          contact_outcome: string | null
          created_at: string
          feedback_type: string
          follow_up_required: boolean
          follow_up_status: string
          followup_completed_at: string | null
          followup_completed_by: string | null
          followup_outcome: string | null
          guest_id: string | null
          guest_name: string | null
          id: string
          is_demo: boolean
          issue_categories: string[]
          ownerrez_booking_id: string | null
          property_id: string | null
          rating: number | null
          reservation_confirmation: string | null
          reservation_enriched_at: string | null
          reservation_guest_first_name: string | null
          reservation_guest_last_name: string | null
          reservation_guest_name: string | null
          reservation_match: string
          response_text: string | null
          reviewer_display_name: string | null
          source: string
          source_review_id: string | null
          source_url: string | null
          stay_end: string | null
          stay_start: string | null
          submitted_at: string
          summary: string | null
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          booking_platform?: string | null
          contact_notes?: string | null
          contact_outcome?: string | null
          created_at?: string
          feedback_type: string
          follow_up_required?: boolean
          follow_up_status?: string
          followup_completed_at?: string | null
          followup_completed_by?: string | null
          followup_outcome?: string | null
          guest_id?: string | null
          guest_name?: string | null
          id?: string
          is_demo?: boolean
          issue_categories?: string[]
          ownerrez_booking_id?: string | null
          property_id?: string | null
          rating?: number | null
          reservation_confirmation?: string | null
          reservation_enriched_at?: string | null
          reservation_guest_first_name?: string | null
          reservation_guest_last_name?: string | null
          reservation_guest_name?: string | null
          reservation_match?: string
          response_text?: string | null
          reviewer_display_name?: string | null
          source: string
          source_review_id?: string | null
          source_url?: string | null
          stay_end?: string | null
          stay_start?: string | null
          submitted_at?: string
          summary?: string | null
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          booking_platform?: string | null
          contact_notes?: string | null
          contact_outcome?: string | null
          created_at?: string
          feedback_type?: string
          follow_up_required?: boolean
          follow_up_status?: string
          followup_completed_at?: string | null
          followup_completed_by?: string | null
          followup_outcome?: string | null
          guest_id?: string | null
          guest_name?: string | null
          id?: string
          is_demo?: boolean
          issue_categories?: string[]
          ownerrez_booking_id?: string | null
          property_id?: string | null
          rating?: number | null
          reservation_confirmation?: string | null
          reservation_enriched_at?: string | null
          reservation_guest_first_name?: string | null
          reservation_guest_last_name?: string | null
          reservation_guest_name?: string | null
          reservation_match?: string
          response_text?: string | null
          reviewer_display_name?: string | null
          source?: string
          source_review_id?: string | null
          source_url?: string | null
          stay_end?: string | null
          stay_start?: string | null
          submitted_at?: string
          summary?: string | null
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_feedback_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "guest_feedback_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_feedback_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "guest_feedback_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_feedback_events: {
        Row: {
          actor_id: string | null
          detail: string | null
          event_at: string
          feedback_id: string
          id: string
          kind: string
        }
        Insert: {
          actor_id?: string | null
          detail?: string | null
          event_at?: string
          feedback_id: string
          id?: string
          kind: string
        }
        Update: {
          actor_id?: string | null
          detail?: string | null
          event_at?: string
          feedback_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_feedback_events_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "guest_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_recovery: {
        Row: {
          approval_authority: string | null
          approval_id: string | null
          approval_status: string
          approved_amount: number | null
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          authority_level: string | null
          claim_id: string | null
          closed_at: string | null
          corrective_action: string | null
          created_at: string
          created_by: string | null
          currency: string
          decision_at: string | null
          decision_note: string | null
          decision_reason: string | null
          delivered_amount: number | null
          delivered_on: string | null
          delivery_method: string | null
          escalation_flags: string[]
          escalation_reason: string | null
          final_communication_at: string | null
          follow_up_on: string | null
          guest_name: string | null
          guest_notified_on: string | null
          guest_requested_amount: number | null
          guest_requested_supervisor: boolean
          handoff_accepted_at: string | null
          handoff_due: string | null
          handoff_next_action: string | null
          handoff_reason: string | null
          handoff_status: string | null
          handoff_to: string | null
          id: string
          impact_detail: string | null
          impacted_nights: number | null
          is_demo: boolean
          issue_summary: string | null
          issued_by: string | null
          issued_on: string | null
          last_guest_update_at: string | null
          mitigation_at: string | null
          nightly_rate: number | null
          outcome: string | null
          ownerrez_booking_id: string | null
          policy_version: string
          priority: string
          promised_update_at: string | null
          property_id: string | null
          proposed_amount: number | null
          recovery_action: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          requested_at: string | null
          requested_by: string | null
          reservation_channel: string | null
          reservation_confirmation: string | null
          resolution_attempts: number
          stage: string
          stay_arrival: string | null
          stay_departure: string | null
          supervisor_engaged_at: string | null
          supervisor_escalation_reason: string | null
          temporary_mitigation: string | null
          ticket_id: string
          title: string
          unresolved_concern: string | null
          updated_at: string
          within_airbnb_policy: boolean | null
        }
        Insert: {
          approval_authority?: string | null
          approval_id?: string | null
          approval_status?: string
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          authority_level?: string | null
          claim_id?: string | null
          closed_at?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          decision_at?: string | null
          decision_note?: string | null
          decision_reason?: string | null
          delivered_amount?: number | null
          delivered_on?: string | null
          delivery_method?: string | null
          escalation_flags?: string[]
          escalation_reason?: string | null
          final_communication_at?: string | null
          follow_up_on?: string | null
          guest_name?: string | null
          guest_notified_on?: string | null
          guest_requested_amount?: number | null
          guest_requested_supervisor?: boolean
          handoff_accepted_at?: string | null
          handoff_due?: string | null
          handoff_next_action?: string | null
          handoff_reason?: string | null
          handoff_status?: string | null
          handoff_to?: string | null
          id?: string
          impact_detail?: string | null
          impacted_nights?: number | null
          is_demo?: boolean
          issue_summary?: string | null
          issued_by?: string | null
          issued_on?: string | null
          last_guest_update_at?: string | null
          mitigation_at?: string | null
          nightly_rate?: number | null
          outcome?: string | null
          ownerrez_booking_id?: string | null
          policy_version?: string
          priority?: string
          promised_update_at?: string | null
          property_id?: string | null
          proposed_amount?: number | null
          recovery_action?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          requested_at?: string | null
          requested_by?: string | null
          reservation_channel?: string | null
          reservation_confirmation?: string | null
          resolution_attempts?: number
          stage?: string
          stay_arrival?: string | null
          stay_departure?: string | null
          supervisor_engaged_at?: string | null
          supervisor_escalation_reason?: string | null
          temporary_mitigation?: string | null
          ticket_id: string
          title: string
          unresolved_concern?: string | null
          updated_at?: string
          within_airbnb_policy?: boolean | null
        }
        Update: {
          approval_authority?: string | null
          approval_id?: string | null
          approval_status?: string
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          authority_level?: string | null
          claim_id?: string | null
          closed_at?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          decision_at?: string | null
          decision_note?: string | null
          decision_reason?: string | null
          delivered_amount?: number | null
          delivered_on?: string | null
          delivery_method?: string | null
          escalation_flags?: string[]
          escalation_reason?: string | null
          final_communication_at?: string | null
          follow_up_on?: string | null
          guest_name?: string | null
          guest_notified_on?: string | null
          guest_requested_amount?: number | null
          guest_requested_supervisor?: boolean
          handoff_accepted_at?: string | null
          handoff_due?: string | null
          handoff_next_action?: string | null
          handoff_reason?: string | null
          handoff_status?: string | null
          handoff_to?: string | null
          id?: string
          impact_detail?: string | null
          impacted_nights?: number | null
          is_demo?: boolean
          issue_summary?: string | null
          issued_by?: string | null
          issued_on?: string | null
          last_guest_update_at?: string | null
          mitigation_at?: string | null
          nightly_rate?: number | null
          outcome?: string | null
          ownerrez_booking_id?: string | null
          policy_version?: string
          priority?: string
          promised_update_at?: string | null
          property_id?: string | null
          proposed_amount?: number | null
          recovery_action?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          requested_at?: string | null
          requested_by?: string | null
          reservation_channel?: string | null
          reservation_confirmation?: string | null
          resolution_attempts?: number
          stage?: string
          stay_arrival?: string | null
          stay_departure?: string | null
          supervisor_engaged_at?: string | null
          supervisor_escalation_reason?: string | null
          temporary_mitigation?: string | null
          ticket_id?: string
          title?: string
          unresolved_concern?: string | null
          updated_at?: string
          within_airbnb_policy?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_recovery_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_recovery_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_recovery_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "guest_recovery_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_recovery_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "guest_recovery_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_recovery_activity: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          detail: Json
          event_type: string
          id: string
          is_demo: boolean
          recovery_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          detail?: Json
          event_type: string
          id?: string
          is_demo?: boolean
          recovery_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          detail?: Json
          event_type?: string
          id?: string
          is_demo?: boolean
          recovery_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_recovery_activity_recovery_id_fkey"
            columns: ["recovery_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_recovery_activity_recovery_id_fkey"
            columns: ["recovery_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["recovery_id"]
          },
        ]
      }
      guest_survey_responses: {
        Row: {
          answers: Json
          created_at: string
          feedback_id: string
          follow_up_permission: boolean | null
          had_issues: boolean | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          feedback_id: string
          follow_up_permission?: boolean | null
          had_issues?: boolean | null
        }
        Update: {
          answers?: Json
          created_at?: string
          feedback_id?: string
          follow_up_permission?: boolean | null
          had_issues?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_survey_responses_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: true
            referencedRelation: "guest_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      handoff_reviews: {
        Row: {
          created_at: string
          decision: string
          exception_reason: string | null
          handoff_id: string
          id: string
          is_demo: boolean
          note: string | null
          property_id: string
          reviewer_id: string | null
          step: string
        }
        Insert: {
          created_at?: string
          decision: string
          exception_reason?: string | null
          handoff_id: string
          id?: string
          is_demo?: boolean
          note?: string | null
          property_id: string
          reviewer_id?: string | null
          step: string
        }
        Update: {
          created_at?: string
          decision?: string
          exception_reason?: string | null
          handoff_id?: string
          id?: string
          is_demo?: boolean
          note?: string | null
          property_id?: string
          reviewer_id?: string | null
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "handoff_reviews_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "property_handoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "handoff_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      handoffs: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          actions_completed: string
          created_at: string
          current_status: string
          due_at: string | null
          from_user: string | null
          guest_comm_status: string
          handoff_type: string
          id: string
          is_demo: boolean
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
          accepted_at?: string | null
          accepted_by?: string | null
          actions_completed: string
          created_at?: string
          current_status: string
          due_at?: string | null
          from_user?: string | null
          guest_comm_status?: string
          handoff_type?: string
          id?: string
          is_demo?: boolean
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
          accepted_at?: string | null
          accepted_by?: string | null
          actions_completed?: string
          created_at?: string
          current_status?: string
          due_at?: string | null
          from_user?: string | null
          guest_comm_status?: string
          handoff_type?: string
          id?: string
          is_demo?: boolean
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "handoffs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      help_ticket_events: {
        Row: {
          author_id: string
          author_name: string | null
          body: string | null
          created_at: string
          email_recipient: string | null
          email_status: string | null
          from_status: string | null
          id: string
          kind: string
          ticket_id: string
          to_status: string | null
        }
        Insert: {
          author_id?: string
          author_name?: string | null
          body?: string | null
          created_at?: string
          email_recipient?: string | null
          email_status?: string | null
          from_status?: string | null
          id?: string
          kind: string
          ticket_id: string
          to_status?: string | null
        }
        Update: {
          author_id?: string
          author_name?: string | null
          body?: string | null
          created_at?: string
          email_recipient?: string | null
          email_status?: string | null
          from_status?: string | null
          id?: string
          kind?: string
          ticket_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "help_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      help_tickets: {
        Row: {
          attachments: Json
          description: string
          email_status: string | null
          id: string
          kind: string
          last_activity_at: string | null
          page_title: string | null
          portal: string | null
          property_id: string | null
          property_label: string | null
          route: string | null
          status: string
          submitted_at: string
          submitted_by: string
          submitter_email: string | null
          submitter_name: string | null
          ticket_number: number
          updated_at: string
          user_agent: string | null
          user_role: string | null
          work_item_id: string | null
        }
        Insert: {
          attachments?: Json
          description: string
          email_status?: string | null
          id?: string
          kind: string
          last_activity_at?: string | null
          page_title?: string | null
          portal?: string | null
          property_id?: string | null
          property_label?: string | null
          route?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          submitter_email?: string | null
          submitter_name?: string | null
          ticket_number?: never
          updated_at?: string
          user_agent?: string | null
          user_role?: string | null
          work_item_id?: string | null
        }
        Update: {
          attachments?: Json
          description?: string
          email_status?: string | null
          id?: string
          kind?: string
          last_activity_at?: string | null
          page_title?: string | null
          portal?: string | null
          property_id?: string | null
          property_label?: string | null
          route?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          submitter_email?: string | null
          submitter_name?: string | null
          ticket_number?: never
          updated_at?: string
          user_agent?: string | null
          user_role?: string | null
          work_item_id?: string | null
        }
        Relationships: []
      }
      inquiry_sources: {
        Row: {
          active: boolean
          application_fee: number | null
          booking_documents: string | null
          cleaning_fee: number | null
          corporate_housing_extra: number | null
          created_at: string
          created_by: string | null
          discount_percent: number | null
          id: string
          name: string
          payment_details: string | null
          pet_deposit_notes: string | null
          pet_fee_notes: string | null
          pet_fee_per_pet: number
          pricing_flags: string | null
          referral_fee: number | null
          referral_percent: number | null
          referral_rule: string | null
          security_deposit: number | null
          source_type: string | null
          updated_at: string
          updated_by: string | null
          utilities_included: boolean | null
        }
        Insert: {
          active?: boolean
          application_fee?: number | null
          booking_documents?: string | null
          cleaning_fee?: number | null
          corporate_housing_extra?: number | null
          created_at?: string
          created_by?: string | null
          discount_percent?: number | null
          id?: string
          name: string
          payment_details?: string | null
          pet_deposit_notes?: string | null
          pet_fee_notes?: string | null
          pet_fee_per_pet?: number
          pricing_flags?: string | null
          referral_fee?: number | null
          referral_percent?: number | null
          referral_rule?: string | null
          security_deposit?: number | null
          source_type?: string | null
          updated_at?: string
          updated_by?: string | null
          utilities_included?: boolean | null
        }
        Update: {
          active?: boolean
          application_fee?: number | null
          booking_documents?: string | null
          cleaning_fee?: number | null
          corporate_housing_extra?: number | null
          created_at?: string
          created_by?: string | null
          discount_percent?: number | null
          id?: string
          name?: string
          payment_details?: string | null
          pet_deposit_notes?: string | null
          pet_fee_notes?: string | null
          pet_fee_per_pet?: number
          pricing_flags?: string | null
          referral_fee?: number | null
          referral_percent?: number | null
          referral_rule?: string | null
          security_deposit?: number | null
          source_type?: string | null
          updated_at?: string
          updated_by?: string | null
          utilities_included?: boolean | null
        }
        Relationships: []
      }
      integration_events: {
        Row: {
          attempts: number
          conversation_id: string | null
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
          conversation_id?: string | null
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
          conversation_id?: string | null
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
      integration_tokens: {
        Row: {
          access_token_enc: string | null
          company_label: string | null
          expires_at: string | null
          last_auth_attempt_at: string | null
          last_check_at: string | null
          last_check_ok: boolean | null
          last_error: string | null
          obtained_at: string | null
          provider: string
          refresh_token_enc: string | null
          updated_at: string
        }
        Insert: {
          access_token_enc?: string | null
          company_label?: string | null
          expires_at?: string | null
          last_auth_attempt_at?: string | null
          last_check_at?: string | null
          last_check_ok?: boolean | null
          last_error?: string | null
          obtained_at?: string | null
          provider: string
          refresh_token_enc?: string | null
          updated_at?: string
        }
        Update: {
          access_token_enc?: string | null
          company_label?: string | null
          expires_at?: string | null
          last_auth_attempt_at?: string | null
          last_check_at?: string | null
          last_check_ok?: boolean | null
          last_error?: string | null
          obtained_at?: string | null
          provider?: string
          refresh_token_enc?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_activity: {
        Row: {
          actor_id: string | null
          channel: Database["public"]["Enums"]["lead_channel"]
          created_at: string
          from_stage: Database["public"]["Enums"]["lead_stage"] | null
          id: string
          lead_id: string
          note: string | null
          occurred_at: string
          outcome: string | null
          to_stage: Database["public"]["Enums"]["lead_stage"] | null
        }
        Insert: {
          actor_id?: string | null
          channel: Database["public"]["Enums"]["lead_channel"]
          created_at?: string
          from_stage?: Database["public"]["Enums"]["lead_stage"] | null
          id?: string
          lead_id: string
          note?: string | null
          occurred_at?: string
          outcome?: string | null
          to_stage?: Database["public"]["Enums"]["lead_stage"] | null
        }
        Update: {
          actor_id?: string | null
          channel?: Database["public"]["Enums"]["lead_channel"]
          created_at?: string
          from_stage?: Database["public"]["Enums"]["lead_stage"] | null
          id?: string
          lead_id?: string
          note?: string | null
          occurred_at?: string
          outcome?: string | null
          to_stage?: Database["public"]["Enums"]["lead_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activity_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_properties: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          lead_id: string
          note: string | null
          presented_at: string | null
          property_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          lead_id: string
          note?: string | null
          presented_at?: string | null
          property_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          note?: string | null
          presented_at?: string | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_properties_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "lead_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tickets: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          linked_by: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          linked_by?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          linked_by?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "lead_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          bedrooms: number | null
          budget_monthly: number | null
          company: string | null
          contact_name: string
          converted_at: string | null
          converted_by: string | null
          converted_property_id: string | null
          created_at: string
          created_by: string | null
          date_flexible: boolean | null
          desired_move_in: string | null
          email: string | null
          id: string
          is_demo: boolean
          keep_open_reason: string | null
          last_contact_at: string | null
          length_of_stay_days: number | null
          lost_at: string | null
          lost_note: string | null
          lost_reason: Database["public"]["Enums"]["lead_loss_reason"] | null
          market: string | null
          notes: string | null
          pets: boolean | null
          phone: string | null
          preferred_channel: Database["public"]["Enums"]["lead_channel"] | null
          quote_amount: number | null
          quote_note: string | null
          quote_sent_at: string | null
          requirements: string | null
          reservation_ref: string | null
          source: Database["public"]["Enums"]["lead_source"]
          source_detail: Json
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          bedrooms?: number | null
          budget_monthly?: number | null
          company?: string | null
          contact_name: string
          converted_at?: string | null
          converted_by?: string | null
          converted_property_id?: string | null
          created_at?: string
          created_by?: string | null
          date_flexible?: boolean | null
          desired_move_in?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          keep_open_reason?: string | null
          last_contact_at?: string | null
          length_of_stay_days?: number | null
          lost_at?: string | null
          lost_note?: string | null
          lost_reason?: Database["public"]["Enums"]["lead_loss_reason"] | null
          market?: string | null
          notes?: string | null
          pets?: boolean | null
          phone?: string | null
          preferred_channel?: Database["public"]["Enums"]["lead_channel"] | null
          quote_amount?: number | null
          quote_note?: string | null
          quote_sent_at?: string | null
          requirements?: string | null
          reservation_ref?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_detail?: Json
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          bedrooms?: number | null
          budget_monthly?: number | null
          company?: string | null
          contact_name?: string
          converted_at?: string | null
          converted_by?: string | null
          converted_property_id?: string | null
          created_at?: string
          created_by?: string | null
          date_flexible?: boolean | null
          desired_move_in?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          keep_open_reason?: string | null
          last_contact_at?: string | null
          length_of_stay_days?: number | null
          lost_at?: string | null
          lost_note?: string | null
          lost_reason?: Database["public"]["Enums"]["lead_loss_reason"] | null
          market?: string | null
          notes?: string | null
          pets?: boolean | null
          phone?: string | null
          preferred_channel?: Database["public"]["Enums"]["lead_channel"] | null
          quote_amount?: number | null
          quote_note?: string | null
          quote_sent_at?: string | null
          requirements?: string | null
          reservation_ref?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_detail?: Json
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_property_id_fkey"
            columns: ["converted_property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "leads_converted_property_id_fkey"
            columns: ["converted_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
      onboarding_budget_changes: {
        Row: {
          budget_id: string
          changed_at: string
          changed_by: string | null
          field: string
          id: string
          line_id: string | null
          new_value: string | null
          old_value: string | null
          reason: string
        }
        Insert: {
          budget_id: string
          changed_at?: string
          changed_by?: string | null
          field: string
          id?: string
          line_id?: string | null
          new_value?: string | null
          old_value?: string | null
          reason: string
        }
        Update: {
          budget_id?: string
          changed_at?: string
          changed_by?: string | null
          field?: string
          id?: string
          line_id?: string | null
          new_value?: string | null
          old_value?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_budget_changes_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "onboarding_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_budget_changes_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "onboarding_budget_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_budget_lines: {
        Row: {
          actual_amount: number | null
          budget_id: string
          category: string
          committed_amount: number | null
          created_at: string
          created_by: string | null
          estimated_amount: number
          financial_request_id: string | null
          id: string
          is_demo: boolean
          label: string
          note: string | null
          property_id: string
          status: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          actual_amount?: number | null
          budget_id: string
          category?: string
          committed_amount?: number | null
          created_at?: string
          created_by?: string | null
          estimated_amount?: number
          financial_request_id?: string | null
          id?: string
          is_demo?: boolean
          label: string
          note?: string | null
          property_id: string
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          actual_amount?: number | null
          budget_id?: string
          category?: string
          committed_amount?: number | null
          created_at?: string
          created_by?: string | null
          estimated_amount?: number
          financial_request_id?: string | null
          id?: string
          is_demo?: boolean
          label?: string
          note?: string | null
          property_id?: string
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "onboarding_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_budget_lines_financial_request_id_fkey"
            columns: ["financial_request_id"]
            isOneToOne: false
            referencedRelation: "financial_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_budget_lines_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "onboarding_budget_lines_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_budgets: {
        Row: {
          approved_amount: number | null
          approved_at: string | null
          approved_basis: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          notes: string | null
          project_id: string | null
          property_id: string
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          approved_at?: string | null
          approved_basis?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          project_id?: string | null
          property_id: string
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          approved_at?: string | null
          approved_basis?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          project_id?: string | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_budgets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "onboarding_budgets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_follows: {
        Row: {
          created_at: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          property_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_follows_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "onboarding_follows_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_notes: {
        Row: {
          archived_at: string | null
          author_id: string | null
          body: string
          created_at: string
          id: string
          internal: boolean
          is_demo: boolean
          mentions: string[]
          property_id: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          internal?: boolean
          is_demo?: boolean
          mentions?: string[]
          property_id: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          internal?: boolean
          is_demo?: boolean
          mentions?: string[]
          property_id?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "onboarding_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_project_events: {
        Row: {
          actor: string | null
          created_at: string
          detail: string | null
          id: string
          is_demo: boolean
          kind: string
          new_value: string | null
          prior_value: string | null
          project_id: string
          property_id: string
          summary: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          is_demo?: boolean
          kind: string
          new_value?: string | null
          prior_value?: string | null
          project_id: string
          property_id: string
          summary: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          new_value?: string | null
          prior_value?: string | null
          project_id?: string
          property_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_project_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_project_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "onboarding_project_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_projects: {
        Row: {
          branch: string | null
          completed_at: string | null
          created_at: string
          director: string | null
          external_refs: Json
          furnishing_scope: string
          handoff_state: string
          id: string
          is_demo: boolean
          modules: string[]
          notes: string | null
          ops_accepted_at: string | null
          ops_accepted_by: string | null
          planned_closing_on: string | null
          pool_location: string
          possession_on: string | null
          project_manager: string | null
          property_id: string
          ready_for_ops_at: string | null
          ready_for_ops_by: string | null
          role_assignments: Json
          staging_provider: string | null
          started_at: string
          started_by: string | null
          status: string
          target_handoff_on: string | null
          target_handoff_source: string
          template_version_id: string | null
          updated_at: string
          utility_manager: string | null
        }
        Insert: {
          branch?: string | null
          completed_at?: string | null
          created_at?: string
          director?: string | null
          external_refs?: Json
          furnishing_scope?: string
          handoff_state?: string
          id?: string
          is_demo?: boolean
          modules?: string[]
          notes?: string | null
          ops_accepted_at?: string | null
          ops_accepted_by?: string | null
          planned_closing_on?: string | null
          pool_location?: string
          possession_on?: string | null
          project_manager?: string | null
          property_id: string
          ready_for_ops_at?: string | null
          ready_for_ops_by?: string | null
          role_assignments?: Json
          staging_provider?: string | null
          started_at?: string
          started_by?: string | null
          status?: string
          target_handoff_on?: string | null
          target_handoff_source?: string
          template_version_id?: string | null
          updated_at?: string
          utility_manager?: string | null
        }
        Update: {
          branch?: string | null
          completed_at?: string | null
          created_at?: string
          director?: string | null
          external_refs?: Json
          furnishing_scope?: string
          handoff_state?: string
          id?: string
          is_demo?: boolean
          modules?: string[]
          notes?: string | null
          ops_accepted_at?: string | null
          ops_accepted_by?: string | null
          planned_closing_on?: string | null
          pool_location?: string
          possession_on?: string | null
          project_manager?: string | null
          property_id?: string
          ready_for_ops_at?: string | null
          ready_for_ops_by?: string | null
          role_assignments?: Json
          staging_provider?: string | null
          started_at?: string
          started_by?: string | null
          status?: string
          target_handoff_on?: string | null
          target_handoff_source?: string
          template_version_id?: string | null
          updated_at?: string
          utility_manager?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "onboarding_projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_projects_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "onboarding_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_task_stage_history: {
        Row: {
          assigned_seat: string | null
          assigned_to: string | null
          changed_by: string | null
          created_at: string
          from_stage: string | null
          id: string
          is_demo: boolean
          legacy_stage: string | null
          property_id: string | null
          reason: string | null
          task_id: string
          to_stage: string
        }
        Insert: {
          assigned_seat?: string | null
          assigned_to?: string | null
          changed_by?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          is_demo?: boolean
          legacy_stage?: string | null
          property_id?: string | null
          reason?: string | null
          task_id: string
          to_stage: string
        }
        Update: {
          assigned_seat?: string | null
          assigned_to?: string | null
          changed_by?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          is_demo?: boolean
          legacy_stage?: string | null
          property_id?: string | null
          reason?: string | null
          task_id?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_task_stage_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          assigned_seat: string | null
          assigned_to: string | null
          blocker: string | null
          blocks_handoff: boolean
          carryover_of: string | null
          carryover_reason: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          depends_on: string[]
          detail: string | null
          due_on: string | null
          due_on_overridden: boolean
          due_on_source: string | null
          evidence_note: string | null
          evidence_required: boolean
          exception_at: string | null
          exception_by: string | null
          exception_reason: string | null
          id: string
          is_demo: boolean
          is_required: boolean
          legacy_stage: string | null
          linked_ticket_id: string | null
          owner_approval_status: string
          owner_dependency: string | null
          parent_task_id: string | null
          property_id: string
          requires_owner_approval: boolean
          schedule_anchor: string | null
          schedule_offset_days: number | null
          sort_order: number
          stage: string
          status: string
          tags: string[]
          template_task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          assigned_seat?: string | null
          assigned_to?: string | null
          blocker?: string | null
          blocks_handoff?: boolean
          carryover_of?: string | null
          carryover_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          depends_on?: string[]
          detail?: string | null
          due_on?: string | null
          due_on_overridden?: boolean
          due_on_source?: string | null
          evidence_note?: string | null
          evidence_required?: boolean
          exception_at?: string | null
          exception_by?: string | null
          exception_reason?: string | null
          id?: string
          is_demo?: boolean
          is_required?: boolean
          legacy_stage?: string | null
          linked_ticket_id?: string | null
          owner_approval_status?: string
          owner_dependency?: string | null
          parent_task_id?: string | null
          property_id: string
          requires_owner_approval?: boolean
          schedule_anchor?: string | null
          schedule_offset_days?: number | null
          sort_order?: number
          stage?: string
          status?: string
          tags?: string[]
          template_task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          assigned_seat?: string | null
          assigned_to?: string | null
          blocker?: string | null
          blocks_handoff?: boolean
          carryover_of?: string | null
          carryover_reason?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          depends_on?: string[]
          detail?: string | null
          due_on?: string | null
          due_on_overridden?: boolean
          due_on_source?: string | null
          evidence_note?: string | null
          evidence_required?: boolean
          exception_at?: string | null
          exception_by?: string | null
          exception_reason?: string | null
          id?: string
          is_demo?: boolean
          is_required?: boolean
          legacy_stage?: string | null
          linked_ticket_id?: string | null
          owner_approval_status?: string
          owner_dependency?: string | null
          parent_task_id?: string | null
          property_id?: string
          requires_owner_approval?: boolean
          schedule_anchor?: string | null
          schedule_offset_days?: number | null
          sort_order?: number
          stage?: string
          status?: string
          tags?: string[]
          template_task_id?: string | null
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
            foreignKeyName: "onboarding_tasks_linked_ticket_id_fkey"
            columns: ["linked_ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "onboarding_tasks_linked_ticket_id_fkey"
            columns: ["linked_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
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
      onboarding_template_stages: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          template_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          template_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_template_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_template_tasks: {
        Row: {
          blocks_handoff: boolean
          breezeway_template_id: string | null
          condition: Json | null
          created_at: string
          detail: string | null
          evidence_required: boolean
          functional_role: string | null
          id: string
          is_active: boolean
          is_required: boolean
          module: string | null
          offset_days: number | null
          opportunity: Json | null
          owner_approval_when_active_owner: boolean
          owner_dependency: string | null
          requires_owner_approval: boolean
          role: string | null
          schedule_anchor: string | null
          sort_order: number
          stage: string
          subtasks: string[]
          tags: string[]
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          blocks_handoff?: boolean
          breezeway_template_id?: string | null
          condition?: Json | null
          created_at?: string
          detail?: string | null
          evidence_required?: boolean
          functional_role?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          module?: string | null
          offset_days?: number | null
          opportunity?: Json | null
          owner_approval_when_active_owner?: boolean
          owner_dependency?: string | null
          requires_owner_approval?: boolean
          role?: string | null
          schedule_anchor?: string | null
          sort_order?: number
          stage: string
          subtasks?: string[]
          tags?: string[]
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          blocks_handoff?: boolean
          breezeway_template_id?: string | null
          condition?: Json | null
          created_at?: string
          detail?: string | null
          evidence_required?: boolean
          functional_role?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          module?: string | null
          offset_days?: number | null
          opportunity?: Json | null
          owner_approval_when_active_owner?: boolean
          owner_dependency?: string | null
          requires_owner_approval?: boolean
          role?: string | null
          schedule_anchor?: string | null
          sort_order?: number
          stage?: string
          subtasks?: string[]
          tags?: string[]
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_template_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_template_versions: {
        Row: {
          id: string
          published_at: string
          published_by: string | null
          snapshot: Json
          template_id: string
          version: number
        }
        Insert: {
          id?: string
          published_at?: string
          published_by?: string | null
          snapshot: Json
          template_id: string
          version: number
        }
        Update: {
          id?: string
          published_at?: string
          published_by?: string | null
          snapshot?: Json
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean
          is_default: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_default?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_default?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      oncall_roster: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          label: string | null
          starts_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          label?: string | null
          starts_on: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          label?: string | null
          starts_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oncall_roster_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      owner_approval_publications: {
        Row: {
          amount: number | null
          approval_id: string
          approval_updated_at: string
          currency: string
          detail: string
          due_on: string | null
          entity_id: string
          entity_type: string
          id: string
          owner_record_id: string
          program_id: string
          property_id: string
          property_name: string | null
          recipient_id: string
          reviewed_at: string
          reviewed_by: string
          revision: number
          title: string
        }
        Insert: {
          amount?: number | null
          approval_id: string
          approval_updated_at: string
          currency: string
          detail: string
          due_on?: string | null
          entity_id: string
          entity_type: string
          id?: string
          owner_record_id: string
          program_id: string
          property_id: string
          property_name?: string | null
          recipient_id: string
          reviewed_at?: string
          reviewed_by: string
          revision: number
          title: string
        }
        Update: {
          amount?: number | null
          approval_id?: string
          approval_updated_at?: string
          currency?: string
          detail?: string
          due_on?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          owner_record_id?: string
          program_id?: string
          property_id?: string
          property_name?: string | null
          recipient_id?: string
          reviewed_at?: string
          reviewed_by?: string
          revision?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_approval_publications_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_approval_publications_owner_record_id_fkey"
            columns: ["owner_record_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_approval_publications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_approval_publications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "owner_approval_publications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_approval_receipts: {
        Row: {
          actor_id: string
          approval_id: string
          decided_at: string
          decision_note: string | null
          publication_id: string
          status: string
        }
        Insert: {
          actor_id: string
          approval_id: string
          decided_at: string
          decision_note?: string | null
          publication_id: string
          status: string
        }
        Update: {
          actor_id?: string
          approval_id?: string
          decided_at?: string
          decision_note?: string | null
          publication_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_approval_receipts_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: true
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_approval_receipts_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: true
            referencedRelation: "owner_approval_publications"
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
      owner_completion_reviews: {
        Row: {
          actor_id: string | null
          created_at: string
          follow_up_task_id: string | null
          id: string
          internal_note: string | null
          is_demo: boolean
          owner_feedback_message_id: string | null
          status: string
          work_item_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          follow_up_task_id?: string | null
          id?: string
          internal_note?: string | null
          is_demo?: boolean
          owner_feedback_message_id?: string | null
          status: string
          work_item_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          follow_up_task_id?: string | null
          id?: string
          internal_note?: string | null
          is_demo?: boolean
          owner_feedback_message_id?: string | null
          status?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_completion_reviews_follow_up_task_id_fkey"
            columns: ["follow_up_task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_completion_reviews_owner_feedback_message_id_fkey"
            columns: ["owner_feedback_message_id"]
            isOneToOne: false
            referencedRelation: "owner_request_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_completion_reviews_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
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
      owner_invite_redemptions: {
        Row: {
          email_verified_at: string
          invite_id: string
          owner_record_id: string
          program_id: string
          program_version: string
          property_ids: string[]
          recipient_email: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          email_verified_at: string
          invite_id: string
          owner_record_id: string
          program_id: string
          program_version: string
          property_ids: string[]
          recipient_email: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          email_verified_at?: string
          invite_id?: string
          owner_record_id?: string
          program_id?: string
          program_version?: string
          property_ids?: string[]
          recipient_email?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_invite_redemptions_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: true
            referencedRelation: "owner_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_invite_redemptions_owner_record_id_fkey"
            columns: ["owner_record_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_invite_redemptions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
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
          is_demo: boolean
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
          is_demo?: boolean
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
          is_demo?: boolean
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
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
      owner_opportunity_library: {
        Row: {
          active: boolean
          category: string
          created_at: string
          created_by: string | null
          how: string
          id: string
          image_key: string
          resource_label: string | null
          resource_url: string | null
          sort_order: number
          suggested_minutes: number | null
          summary: string
          tags: string[]
          title: string
          updated_at: string
          ways_to_document: string
          what: string
          why: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          how?: string
          id?: string
          image_key?: string
          resource_label?: string | null
          resource_url?: string | null
          sort_order?: number
          suggested_minutes?: number | null
          summary?: string
          tags?: string[]
          title: string
          updated_at?: string
          ways_to_document?: string
          what?: string
          why?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          how?: string
          id?: string
          image_key?: string
          resource_label?: string | null
          resource_url?: string | null
          sort_order?: number
          suggested_minutes?: number | null
          summary?: string
          tags?: string[]
          title?: string
          updated_at?: string
          ways_to_document?: string
          what?: string
          why?: string
        }
        Relationships: []
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
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
          archived_at: string | null
          closing_confirmed: boolean
          closing_date: string | null
          coverage_status: string
          created_at: string
          id: string
          inclusion_status: string
          is_demo: boolean
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
          archived_at?: string | null
          closing_confirmed?: boolean
          closing_date?: string | null
          coverage_status?: string
          created_at?: string
          id?: string
          inclusion_status?: string
          is_demo?: boolean
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
          archived_at?: string | null
          closing_confirmed?: boolean
          closing_date?: string | null
          coverage_status?: string
          created_at?: string
          id?: string
          inclusion_status?: string
          is_demo?: boolean
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
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
      owner_program_rules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      owner_programs: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          completed_at: string | null
          completed_by: string | null
          completion_report: Json | null
          created_at: string
          created_by: string | null
          dfy_confirmed: boolean
          dfy_confirmed_at: string | null
          ends_on: string | null
          id: string
          internal_notes: string | null
          is_demo: boolean
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
          owner_record_id: string | null
          owner_user_id: string | null
          property_id: string | null
          report_version: string
          started_on: string | null
          status: string
          target_hours: number
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_report?: Json | null
          created_at?: string
          created_by?: string | null
          dfy_confirmed?: boolean
          dfy_confirmed_at?: string | null
          ends_on?: string | null
          id?: string
          internal_notes?: string | null
          is_demo?: boolean
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
          owner_record_id?: string | null
          owner_user_id?: string | null
          property_id?: string | null
          report_version?: string
          started_on?: string | null
          status?: string
          target_hours?: number
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_report?: Json | null
          created_at?: string
          created_by?: string | null
          dfy_confirmed?: boolean
          dfy_confirmed_at?: string | null
          ends_on?: string | null
          id?: string
          internal_notes?: string | null
          is_demo?: boolean
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
          owner_record_id?: string | null
          owner_user_id?: string | null
          property_id?: string | null
          report_version?: string
          started_on?: string | null
          status?: string
          target_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_programs_owner_record_id_fkey"
            columns: ["owner_record_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_programs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "owner_programs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_request_messages: {
        Row: {
          author_id: string | null
          author_name: string
          author_type: string
          body: string
          created_at: string
          event: string | null
          id: string
          is_demo: boolean
          program_id: string | null
          property_id: string | null
          request_kind: string | null
          task_id: string | null
          work_item_id: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          author_type: string
          body: string
          created_at?: string
          event?: string | null
          id?: string
          is_demo?: boolean
          program_id?: string | null
          property_id?: string | null
          request_kind?: string | null
          task_id?: string | null
          work_item_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          author_type?: string
          body?: string
          created_at?: string
          event?: string | null
          id?: string
          is_demo?: boolean
          program_id?: string | null
          property_id?: string | null
          request_kind?: string | null
          task_id?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_request_messages_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
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
          archived_at: string | null
          attachment_path: string | null
          auto_ticket: boolean
          available_from: string | null
          business_question: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          decision_path: string
          evidence: string | null
          id: string
          impact: string | null
          is_demo: boolean
          notified_at: string | null
          onboarding_task_id: string | null
          outcome: string | null
          owner_action_type: string
          owner_decision: string | null
          owner_response: string | null
          phase: string
          photos: Json
          program_id: string
          property_id: string | null
          recommendation: string | null
          respond_by: string | null
          responded_at: string | null
          sort_order: number
          source_type: string
          staff_context: string | null
          stage: string
          status: string
          task_type: string
          template_id: string | null
          ticket_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          attachment_path?: string | null
          auto_ticket?: boolean
          available_from?: string | null
          business_question?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          decision_path?: string
          evidence?: string | null
          id?: string
          impact?: string | null
          is_demo?: boolean
          notified_at?: string | null
          onboarding_task_id?: string | null
          outcome?: string | null
          owner_action_type?: string
          owner_decision?: string | null
          owner_response?: string | null
          phase: string
          photos?: Json
          program_id: string
          property_id?: string | null
          recommendation?: string | null
          respond_by?: string | null
          responded_at?: string | null
          sort_order?: number
          source_type?: string
          staff_context?: string | null
          stage: string
          status?: string
          task_type?: string
          template_id?: string | null
          ticket_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          attachment_path?: string | null
          auto_ticket?: boolean
          available_from?: string | null
          business_question?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          decision_path?: string
          evidence?: string | null
          id?: string
          impact?: string | null
          is_demo?: boolean
          notified_at?: string | null
          onboarding_task_id?: string | null
          outcome?: string | null
          owner_action_type?: string
          owner_decision?: string | null
          owner_response?: string | null
          phase?: string
          photos?: Json
          program_id?: string
          property_id?: string | null
          recommendation?: string | null
          respond_by?: string | null
          responded_at?: string | null
          sort_order?: number
          source_type?: string
          staff_context?: string | null
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
            foreignKeyName: "owner_reviews_onboarding_task_id_fkey"
            columns: ["onboarding_task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
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
          owner_action_type: string
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
          owner_action_type?: string
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
          owner_action_type?: string
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
          attachment_paths: Json
          attested: boolean
          comments: string | null
          correction_reason: string | null
          created_at: string
          decision_outcome: string | null
          entry_date: string
          flagged: boolean
          id: string
          is_demo: boolean
          materials_reviewed: string | null
          minutes: number
          output: string | null
          owner_update_revision: number | null
          owner_update_snapshot: Json | null
          owner_user_id: string
          phase: string
          program_id: string
          review_id: string | null
          review_note: string | null
          review_status: string
          review_version: string
          reviewed_at: string | null
          reviewed_by: string | null
          ticket_id: string | null
        }
        Insert: {
          activity: string
          activity_category?: string | null
          amends_entry_id?: string | null
          attachment_path?: string | null
          attachment_paths?: Json
          attested?: boolean
          comments?: string | null
          correction_reason?: string | null
          created_at?: string
          decision_outcome?: string | null
          entry_date?: string
          flagged?: boolean
          id?: string
          is_demo?: boolean
          materials_reviewed?: string | null
          minutes: number
          output?: string | null
          owner_update_revision?: number | null
          owner_update_snapshot?: Json | null
          owner_user_id: string
          phase: string
          program_id: string
          review_id?: string | null
          review_note?: string | null
          review_status?: string
          review_version?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          ticket_id?: string | null
        }
        Update: {
          activity?: string
          activity_category?: string | null
          amends_entry_id?: string | null
          attachment_path?: string | null
          attachment_paths?: Json
          attested?: boolean
          comments?: string | null
          correction_reason?: string | null
          created_at?: string
          decision_outcome?: string | null
          entry_date?: string
          flagged?: boolean
          id?: string
          is_demo?: boolean
          materials_reviewed?: string | null
          minutes?: number
          output?: string | null
          owner_update_revision?: number | null
          owner_update_snapshot?: Json | null
          owner_user_id?: string
          phase?: string
          program_id?: string
          review_id?: string | null
          review_note?: string | null
          review_status?: string
          review_version?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "owner_time_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_time_reviewed_update_fk"
            columns: ["ticket_id", "owner_update_revision"]
            isOneToOne: false
            referencedRelation: "ticket_owner_updates"
            referencedColumns: ["ticket_id", "revision"]
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
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
      playbook_approvals: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          playbook_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          playbook_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          playbook_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_approvals_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
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
          applies_to: string[]
          approved_at: string | null
          approved_by: string | null
          category: string
          created_at: string
          effective_on: string | null
          escalate_if: string[]
          generated_at: string | null
          id: string
          immediate_actions: string[]
          matcher: Json
          playbook_key: string | null
          priority_reason: string | null
          required_evidence: string[]
          requires_director: boolean
          retired_at: string | null
          review_note: string | null
          risk_flags: Json
          source: string
          source_refs: string[]
          source_version: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          summary: string | null
          supersedes_id: string | null
          title: string
          updated_at: string
          vendor_brief: Json | null
          version: number
        }
        Insert: {
          active?: boolean
          applies_to?: string[]
          approved_at?: string | null
          approved_by?: string | null
          category: string
          created_at?: string
          effective_on?: string | null
          escalate_if?: string[]
          generated_at?: string | null
          id?: string
          immediate_actions?: string[]
          matcher?: Json
          playbook_key?: string | null
          priority_reason?: string | null
          required_evidence?: string[]
          requires_director?: boolean
          retired_at?: string | null
          review_note?: string | null
          risk_flags?: Json
          source?: string
          source_refs?: string[]
          source_version?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          summary?: string | null
          supersedes_id?: string | null
          title: string
          updated_at?: string
          vendor_brief?: Json | null
          version?: number
        }
        Update: {
          active?: boolean
          applies_to?: string[]
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string
          effective_on?: string | null
          escalate_if?: string[]
          generated_at?: string | null
          id?: string
          immediate_actions?: string[]
          matcher?: Json
          playbook_key?: string | null
          priority_reason?: string | null
          required_evidence?: string[]
          requires_director?: boolean
          retired_at?: string | null
          review_note?: string | null
          risk_flags?: Json
          source?: string
          source_refs?: string[]
          source_version?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          summary?: string | null
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          vendor_brief?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          email_signature: string | null
          first_name: string | null
          full_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          oncall_eligible: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_signature?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          last_name?: string | null
          oncall_eligible?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_signature?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          oncall_eligible?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          access: Json
          access_notes: string | null
          active: boolean
          actual_access_on: string | null
          actual_closing_on: string | null
          address_line1: string | null
          amenities: Json
          archive_reason: string | null
          archived_at: string | null
          bathrooms: number | null
          bedrooms: number | null
          breezeway_mapping_note: string | null
          breezeway_mapping_state: string
          breezeway_mapping_verified_at: string | null
          breezeway_property_id: string | null
          breezeway_synced_at: string | null
          check_in_time: string | null
          check_out_time: string | null
          city: string | null
          compliance: Json
          coords_overridden_at: string | null
          coords_overridden_by: string | null
          coords_override_reason: string | null
          created_at: string
          created_by: string | null
          external_refs: Json
          facts: Json
          fireplace: Json
          formatted_address: string | null
          furniture_package: string | null
          geocode_address_fingerprint: string | null
          geocode_source: string | null
          geocode_status: string | null
          geocoded_at: string | null
          grounds: Json
          handoff_accepted_at: string | null
          hoa: Json
          hvac: Json
          id: string
          instant_book: boolean | null
          is_demo: boolean
          last_quarterly_review_at: string | null
          latitude: number | null
          legacy_handoff_date: string | null
          lifecycle_status: string
          listing_alias: string | null
          listing_public_url: string | null
          living_area_sqft: number | null
          longitude: number | null
          market: string | null
          max_guests: number | null
          min_stay_months: number | null
          name: string
          neighborhood: string | null
          nickname: string | null
          notes: string | null
          onboarding_owner: string | null
          onboarding_stage: string | null
          onboarding_started_at: string | null
          operating_notes: string | null
          owner_record_id: string | null
          ownerrez_owner_id: string | null
          ownerrez_property_id: string | null
          ownerrez_synced_at: string | null
          parking: Json
          planned_closing_on: string | null
          pool_spa: Json
          postal_code: string | null
          primary_photo_medium_url: string | null
          primary_photo_source: string | null
          primary_photo_synced_at: string | null
          primary_photo_thumb_url: string | null
          primary_photo_url: string | null
          property_type: string | null
          quarterly_review_due_on: string
          security: Json
          sprinklers: Json
          state: string | null
          storm_shelter: Json
          systems: Json
          tier: string | null
          time_zone: string | null
          unit: string | null
          updated_at: string
          utilities: Json
          warranty: Json
          waste: Json
          wifi_notes: string | null
          year_built: number | null
        }
        Insert: {
          access?: Json
          access_notes?: string | null
          active?: boolean
          actual_access_on?: string | null
          actual_closing_on?: string | null
          address_line1?: string | null
          amenities?: Json
          archive_reason?: string | null
          archived_at?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          breezeway_mapping_note?: string | null
          breezeway_mapping_state?: string
          breezeway_mapping_verified_at?: string | null
          breezeway_property_id?: string | null
          breezeway_synced_at?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          compliance?: Json
          coords_overridden_at?: string | null
          coords_overridden_by?: string | null
          coords_override_reason?: string | null
          created_at?: string
          created_by?: string | null
          external_refs?: Json
          facts?: Json
          fireplace?: Json
          formatted_address?: string | null
          furniture_package?: string | null
          geocode_address_fingerprint?: string | null
          geocode_source?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          grounds?: Json
          handoff_accepted_at?: string | null
          hoa?: Json
          hvac?: Json
          id?: string
          instant_book?: boolean | null
          is_demo?: boolean
          last_quarterly_review_at?: string | null
          latitude?: number | null
          legacy_handoff_date?: string | null
          lifecycle_status?: string
          listing_alias?: string | null
          listing_public_url?: string | null
          living_area_sqft?: number | null
          longitude?: number | null
          market?: string | null
          max_guests?: number | null
          min_stay_months?: number | null
          name: string
          neighborhood?: string | null
          nickname?: string | null
          notes?: string | null
          onboarding_owner?: string | null
          onboarding_stage?: string | null
          onboarding_started_at?: string | null
          operating_notes?: string | null
          owner_record_id?: string | null
          ownerrez_owner_id?: string | null
          ownerrez_property_id?: string | null
          ownerrez_synced_at?: string | null
          parking?: Json
          planned_closing_on?: string | null
          pool_spa?: Json
          postal_code?: string | null
          primary_photo_medium_url?: string | null
          primary_photo_source?: string | null
          primary_photo_synced_at?: string | null
          primary_photo_thumb_url?: string | null
          primary_photo_url?: string | null
          property_type?: string | null
          quarterly_review_due_on?: string
          security?: Json
          sprinklers?: Json
          state?: string | null
          storm_shelter?: Json
          systems?: Json
          tier?: string | null
          time_zone?: string | null
          unit?: string | null
          updated_at?: string
          utilities?: Json
          warranty?: Json
          waste?: Json
          wifi_notes?: string | null
          year_built?: number | null
        }
        Update: {
          access?: Json
          access_notes?: string | null
          active?: boolean
          actual_access_on?: string | null
          actual_closing_on?: string | null
          address_line1?: string | null
          amenities?: Json
          archive_reason?: string | null
          archived_at?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          breezeway_mapping_note?: string | null
          breezeway_mapping_state?: string
          breezeway_mapping_verified_at?: string | null
          breezeway_property_id?: string | null
          breezeway_synced_at?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          city?: string | null
          compliance?: Json
          coords_overridden_at?: string | null
          coords_overridden_by?: string | null
          coords_override_reason?: string | null
          created_at?: string
          created_by?: string | null
          external_refs?: Json
          facts?: Json
          fireplace?: Json
          formatted_address?: string | null
          furniture_package?: string | null
          geocode_address_fingerprint?: string | null
          geocode_source?: string | null
          geocode_status?: string | null
          geocoded_at?: string | null
          grounds?: Json
          handoff_accepted_at?: string | null
          hoa?: Json
          hvac?: Json
          id?: string
          instant_book?: boolean | null
          is_demo?: boolean
          last_quarterly_review_at?: string | null
          latitude?: number | null
          legacy_handoff_date?: string | null
          lifecycle_status?: string
          listing_alias?: string | null
          listing_public_url?: string | null
          living_area_sqft?: number | null
          longitude?: number | null
          market?: string | null
          max_guests?: number | null
          min_stay_months?: number | null
          name?: string
          neighborhood?: string | null
          nickname?: string | null
          notes?: string | null
          onboarding_owner?: string | null
          onboarding_stage?: string | null
          onboarding_started_at?: string | null
          operating_notes?: string | null
          owner_record_id?: string | null
          ownerrez_owner_id?: string | null
          ownerrez_property_id?: string | null
          ownerrez_synced_at?: string | null
          parking?: Json
          planned_closing_on?: string | null
          pool_spa?: Json
          postal_code?: string | null
          primary_photo_medium_url?: string | null
          primary_photo_source?: string | null
          primary_photo_synced_at?: string | null
          primary_photo_thumb_url?: string | null
          primary_photo_url?: string | null
          property_type?: string | null
          quarterly_review_due_on?: string
          security?: Json
          sprinklers?: Json
          state?: string | null
          storm_shelter?: Json
          systems?: Json
          tier?: string | null
          time_zone?: string | null
          unit?: string | null
          updated_at?: string
          utilities?: Json
          warranty?: Json
          waste?: Json
          wifi_notes?: string | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_record_id_fkey"
            columns: ["owner_record_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      property_activity_log: {
        Row: {
          attachment_document_ids: string[]
          category: string
          created_at: string
          id: string
          involved: string | null
          is_demo: boolean
          logged_by: string
          occurred_at: string
          outcome: string
          property_id: string
          what_happened: string
        }
        Insert: {
          attachment_document_ids?: string[]
          category: string
          created_at?: string
          id?: string
          involved?: string | null
          is_demo?: boolean
          logged_by?: string
          occurred_at?: string
          outcome: string
          property_id: string
          what_happened: string
        }
        Update: {
          attachment_document_ids?: string[]
          category?: string
          created_at?: string
          id?: string
          involved?: string | null
          is_demo?: boolean
          logged_by?: string
          occurred_at?: string
          outcome?: string
          property_id?: string
          what_happened?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_activity_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_activity_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_assets: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          kind: string
          location: string | null
          manufacturer: string | null
          model: string | null
          name: string
          property_id: string
          serial_number: string | null
          updated_at: string
          warranty_notes: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          kind: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          property_id: string
          serial_number?: string | null
          updated_at?: string
          warranty_notes?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          property_id?: string
          serial_number?: string | null
          updated_at?: string
          warranty_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_credentials: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["credential_category"]
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          label: string
          last_verified_on: string | null
          property_id: string
          secret_ciphertext: string | null
          secret_nonce: string | null
          sort_order: number
          source: string
          updated_at: string
          username: string | null
          verified_by: string | null
        }
        Insert: {
          active?: boolean
          category?: Database["public"]["Enums"]["credential_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          label: string
          last_verified_on?: string | null
          property_id: string
          secret_ciphertext?: string | null
          secret_nonce?: string | null
          sort_order?: number
          source?: string
          updated_at?: string
          username?: string | null
          verified_by?: string | null
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["credential_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          label?: string
          last_verified_on?: string | null
          property_id?: string
          secret_ciphertext?: string | null
          secret_nonce?: string | null
          sort_order?: number
          source?: string
          updated_at?: string
          username?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_credentials_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_credentials_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_external_links: {
        Row: {
          as_of: string | null
          canonical: boolean
          context: string | null
          created_at: string
          id: string
          kind: string
          label: string | null
          needs_replacement: boolean
          note: string | null
          property_id: string
          source: string
          source_field: string | null
          staff_only: boolean
          updated_at: string
          url: string
        }
        Insert: {
          as_of?: string | null
          canonical?: boolean
          context?: string | null
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          needs_replacement?: boolean
          note?: string | null
          property_id: string
          source?: string
          source_field?: string | null
          staff_only?: boolean
          updated_at?: string
          url: string
        }
        Update: {
          as_of?: string | null
          canonical?: boolean
          context?: string | null
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          needs_replacement?: boolean
          note?: string | null
          property_id?: string
          source?: string
          source_field?: string | null
          staff_only?: boolean
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_external_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_external_links_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_fact_proposals: {
        Row: {
          asset_id: string | null
          created_at: string
          current_value: string | null
          decision_note: string | null
          field_key: string
          field_label: string
          id: string
          is_demo: boolean
          project_id: string | null
          property_id: string
          proposed_by: string | null
          proposed_value: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          source_detail: string | null
          status: string
          task_id: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          current_value?: string | null
          decision_note?: string | null
          field_key: string
          field_label: string
          id?: string
          is_demo?: boolean
          project_id?: string | null
          property_id: string
          proposed_by?: string | null
          proposed_value: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_detail?: string | null
          status?: string
          task_id?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          current_value?: string | null
          decision_note?: string | null
          field_key?: string
          field_label?: string
          id?: string
          is_demo?: boolean
          project_id?: string | null
          property_id?: string
          proposed_by?: string | null
          proposed_value?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          source_detail?: string | null
          status?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fact_proposal_asset_property_fk"
            columns: ["asset_id", "property_id"]
            isOneToOne: false
            referencedRelation: "property_assets"
            referencedColumns: ["id", "property_id"]
          },
          {
            foreignKeyName: "property_fact_proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_fact_proposals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_fact_proposals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_fact_proposals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      property_field_provenance: {
        Row: {
          as_of: string
          created_at: string
          field_key: string
          id: string
          note: string | null
          property_id: string
          source_record_id: string | null
          updated_at: string
          value_source: string
        }
        Insert: {
          as_of?: string
          created_at?: string
          field_key: string
          id?: string
          note?: string | null
          property_id: string
          source_record_id?: string | null
          updated_at?: string
          value_source: string
        }
        Update: {
          as_of?: string
          created_at?: string
          field_key?: string
          id?: string
          note?: string | null
          property_id?: string
          source_record_id?: string | null
          updated_at?: string
          value_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_field_provenance_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_field_provenance_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_handoffs: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          archived_at: string | null
          carryover_accepted: boolean
          checklist: Json
          corrections: string | null
          created_at: string
          exceptions: Json
          financial_note: string | null
          financial_reconciled_at: string | null
          financial_reconciled_by: string | null
          financial_status: string
          gate_step: string
          id: string
          is_demo: boolean
          kati_at: string | null
          kati_decision: string | null
          kati_note: string | null
          kati_reviewer: string | null
          live_confirmed_at: string | null
          live_confirmed_by: string | null
          micah_at: string | null
          micah_decision: string | null
          micah_note: string | null
          micah_reviewer: string | null
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
          accepted_at?: string | null
          accepted_by?: string | null
          archived_at?: string | null
          carryover_accepted?: boolean
          checklist?: Json
          corrections?: string | null
          created_at?: string
          exceptions?: Json
          financial_note?: string | null
          financial_reconciled_at?: string | null
          financial_reconciled_by?: string | null
          financial_status?: string
          gate_step?: string
          id?: string
          is_demo?: boolean
          kati_at?: string | null
          kati_decision?: string | null
          kati_note?: string | null
          kati_reviewer?: string | null
          live_confirmed_at?: string | null
          live_confirmed_by?: string | null
          micah_at?: string | null
          micah_decision?: string | null
          micah_note?: string | null
          micah_reviewer?: string | null
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
          accepted_at?: string | null
          accepted_by?: string | null
          archived_at?: string | null
          carryover_accepted?: boolean
          checklist?: Json
          corrections?: string | null
          created_at?: string
          exceptions?: Json
          financial_note?: string | null
          financial_reconciled_at?: string | null
          financial_reconciled_by?: string | null
          financial_status?: string
          gate_step?: string
          id?: string
          is_demo?: boolean
          kati_at?: string | null
          kati_decision?: string | null
          kati_note?: string | null
          kati_reviewer?: string | null
          live_confirmed_at?: string | null
          live_confirmed_by?: string | null
          micah_at?: string | null
          micah_decision?: string | null
          micah_note?: string | null
          micah_reviewer?: string | null
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_handoffs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owner_contacts: {
        Row: {
          candidate_count: number
          created_at: string
          detail: string | null
          id: string
          match_status: string
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          property_id: string
          source: string
          source_id: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          candidate_count?: number
          created_at?: string
          detail?: string | null
          id?: string
          match_status?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          property_id: string
          source: string
          source_id?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          candidate_count?: number
          created_at?: string
          detail?: string | null
          id?: string
          match_status?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          property_id?: string
          source?: string
          source_id?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owner_contacts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_owner_contacts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          active: boolean
          city: string | null
          co_owner_email: string | null
          co_owner_name: string | null
          co_owner_phone: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          source: string
          source_owner_id: string
          state: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          co_owner_email?: string | null
          co_owner_name?: string | null
          co_owner_phone?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          source?: string
          source_owner_id: string
          state?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          co_owner_email?: string | null
          co_owner_name?: string | null
          co_owner_phone?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          source?: string
          source_owner_id?: string
          state?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
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
      property_work_records: {
        Row: {
          confidence: string
          created_at: string
          created_by: string | null
          id: string
          is_fixture: boolean
          method: string
          minutes: number
          person_id: string
          property_id: string
          reason: string | null
          record_key: string
          review_state: string
          source_code: string
          source_ref: string | null
          superseded_at: string | null
          supersedes_id: string | null
          work_date: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_fixture?: boolean
          method: string
          minutes: number
          person_id: string
          property_id: string
          reason?: string | null
          record_key: string
          review_state?: string
          source_code: string
          source_ref?: string | null
          superseded_at?: string | null
          supersedes_id?: string | null
          work_date: string
        }
        Update: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_fixture?: boolean
          method?: string
          minutes?: number
          person_id?: string
          property_id?: string
          reason?: string | null
          record_key?: string
          review_state?: string
          source_code?: string
          source_ref?: string | null
          superseded_at?: string | null
          supersedes_id?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_work_records_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "cleaner_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_work_records_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_work_records_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_work_records_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "property_work_sources"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "property_work_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "property_work_records"
            referencedColumns: ["id"]
          },
        ]
      }
      property_work_sources: {
        Row: {
          active: boolean
          activity_category: string
          code: string
          counts_toward_cleaner_safeguard: boolean
          created_at: string
          label: string
        }
        Insert: {
          active?: boolean
          activity_category: string
          code: string
          counts_toward_cleaner_safeguard?: boolean
          created_at?: string
          label: string
        }
        Update: {
          active?: boolean
          activity_category?: string
          code?: string
          counts_toward_cleaner_safeguard?: boolean
          created_at?: string
          label?: string
        }
        Relationships: []
      }
      routine_controls: {
        Row: {
          assigned_role_code: string | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          contact_result: string | null
          created_at: string
          created_by: string | null
          due_at: string
          event_key: string
          evidence_urls: string[]
          findings: string | null
          follow_up_ticket_id: string | null
          guest_name: string | null
          id: string
          is_demo: boolean
          kind: string
          notes: string | null
          outcome: string | null
          property_id: string | null
          reservation_channel: string | null
          reservation_confirmation: string | null
          status: string
          stay_arrival: string | null
          stay_departure: string | null
          team: string | null
          ticket_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_role_code?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_result?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          event_key: string
          evidence_urls?: string[]
          findings?: string | null
          follow_up_ticket_id?: string | null
          guest_name?: string | null
          id?: string
          is_demo?: boolean
          kind: string
          notes?: string | null
          outcome?: string | null
          property_id?: string | null
          reservation_channel?: string | null
          reservation_confirmation?: string | null
          status?: string
          stay_arrival?: string | null
          stay_departure?: string | null
          team?: string | null
          ticket_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_role_code?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_result?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          event_key?: string
          evidence_urls?: string[]
          findings?: string | null
          follow_up_ticket_id?: string | null
          guest_name?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          notes?: string | null
          outcome?: string | null
          property_id?: string | null
          reservation_channel?: string | null
          reservation_confirmation?: string | null
          status?: string
          stay_arrival?: string | null
          stay_departure?: string | null
          team?: string | null
          ticket_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_controls_follow_up_ticket_id_fkey"
            columns: ["follow_up_ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "routine_controls_follow_up_ticket_id_fkey"
            columns: ["follow_up_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_controls_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "routine_controls_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_controls_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "routine_controls_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      special_handling: {
        Row: {
          active: boolean
          applies_to: string[]
          created_at: string
          created_by: string | null
          id: string
          instruction: string
          owner_notification_required: boolean
          property_id: string
          rule_type: string
          severity: string
          source: string | null
          threshold_amount: number | null
          title: string
          trade: string | null
          updated_at: string
          updated_by: string | null
          vendor_name: string | null
          vendor_org_id: string | null
        }
        Insert: {
          active?: boolean
          applies_to?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          instruction: string
          owner_notification_required?: boolean
          property_id: string
          rule_type: string
          severity?: string
          source?: string | null
          threshold_amount?: number | null
          title: string
          trade?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_name?: string | null
          vendor_org_id?: string | null
        }
        Update: {
          active?: boolean
          applies_to?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          instruction?: string
          owner_notification_required?: boolean
          property_id?: string
          rule_type?: string
          severity?: string
          source?: string | null
          threshold_amount?: number | null
          title?: string
          trade?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_name?: string | null
          vendor_org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "special_handling_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "special_handling_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_handling_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          delivered_at: string | null
          email_attempts: number
          email_error: string | null
          email_status: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_demo: boolean
          kind: string
          link_path: string | null
          priority: string
          read_at: string | null
          retracted_at: string | null
          retracted_by: string | null
          retracted_reason: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string
          created_at?: string
          delivered_at?: string | null
          email_attempts?: number
          email_error?: string | null
          email_status?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_demo?: boolean
          kind: string
          link_path?: string | null
          priority?: string
          read_at?: string | null
          retracted_at?: string | null
          retracted_by?: string | null
          retracted_reason?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          delivered_at?: string | null
          email_attempts?: number
          email_error?: string | null
          email_status?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          link_path?: string | null
          priority?: string
          read_at?: string | null
          retracted_at?: string | null
          retracted_by?: string | null
          retracted_reason?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      statement_dispositions: {
        Row: {
          decided_at: string
          decided_by: string
          defer_to_period: string | null
          disposition: string
          exclusion_treatment: string | null
          expense_id: string
          id: string
          internal_note: string | null
          is_demo: boolean
          owner_description: string | null
          period: string
          property_id: string
          recovery_treatment: string | null
          superseded_at: string | null
          superseded_by: string | null
        }
        Insert: {
          decided_at?: string
          decided_by: string
          defer_to_period?: string | null
          disposition: string
          exclusion_treatment?: string | null
          expense_id: string
          id?: string
          internal_note?: string | null
          is_demo?: boolean
          owner_description?: string | null
          period: string
          property_id: string
          recovery_treatment?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
        }
        Update: {
          decided_at?: string
          decided_by?: string
          defer_to_period?: string | null
          disposition?: string
          exclusion_treatment?: string | null
          expense_id?: string
          id?: string
          internal_note?: string | null
          is_demo?: boolean
          owner_description?: string | null
          period?: string
          property_id?: string
          recovery_treatment?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "statement_dispositions_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_dispositions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "statement_dispositions"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_reconciliations: {
        Row: {
          exception_resolution: string | null
          id: string
          invalidated_at: string | null
          invalidated_reason: string | null
          is_demo: boolean
          period: string
          property_id: string
          reviewed_at: string
          reviewed_by: string
          snapshot: Json
          source_reference: string
          status: string
        }
        Insert: {
          exception_resolution?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          is_demo?: boolean
          period: string
          property_id: string
          reviewed_at?: string
          reviewed_by: string
          snapshot: Json
          source_reference: string
          status?: string
        }
        Update: {
          exception_resolution?: string | null
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          is_demo?: boolean
          period?: string
          property_id?: string
          reviewed_at?: string
          reviewed_by?: string
          snapshot?: Json
          source_reference?: string
          status?: string
        }
        Relationships: []
      }
      str_participation_reports: {
        Row: {
          blockers: Json
          created_by: string | null
          exclusion_note: string | null
          generated_at: string
          id: string
          period_end: string
          period_start: string
          program_id: string
          property_id: string
          released_at: string | null
          released_by: string | null
          revision_reason: string | null
          snapshot: Json
          source_refs: Json
          status: string
          superseded_at: string | null
          supersedes_id: string | null
          version: number
        }
        Insert: {
          blockers?: Json
          created_by?: string | null
          exclusion_note?: string | null
          generated_at?: string
          id?: string
          period_end: string
          period_start: string
          program_id: string
          property_id: string
          released_at?: string | null
          released_by?: string | null
          revision_reason?: string | null
          snapshot: Json
          source_refs?: Json
          status: string
          superseded_at?: string | null
          supersedes_id?: string | null
          version: number
        }
        Update: {
          blockers?: Json
          created_by?: string | null
          exclusion_note?: string | null
          generated_at?: string
          id?: string
          period_end?: string
          period_start?: string
          program_id?: string
          property_id?: string
          released_at?: string | null
          released_by?: string | null
          revision_reason?: string | null
          snapshot?: Json
          source_refs?: Json
          status?: string
          superseded_at?: string | null
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "str_participation_reports_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "str_participation_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "str_participation_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "str_participation_reports_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "str_participation_reports"
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
          seat_role_code: string | null
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
          seat_role_code?: string | null
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
          seat_role_code?: string | null
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
          internal: boolean
          is_demo: boolean
          kind: string
          mentions: string[]
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
          internal?: boolean
          is_demo?: boolean
          kind?: string
          mentions?: string[]
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
          internal?: boolean
          is_demo?: boolean
          kind?: string
          mentions?: string[]
          ticket_id?: string
          to_owner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_activity_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "ticket_activity_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_owner_updates: {
        Row: {
          id: string
          is_demo: boolean
          issue: string
          outcome: string
          owner_record_id: string
          owner_request_type: string | null
          owner_request_why: string | null
          property_id: string
          reviewed_at: string
          reviewed_by: string
          revision: number
          source_updated_at: string
          ticket_id: string
          work_performed: string
        }
        Insert: {
          id?: string
          is_demo: boolean
          issue: string
          outcome: string
          owner_record_id: string
          owner_request_type?: string | null
          owner_request_why?: string | null
          property_id: string
          reviewed_at?: string
          reviewed_by: string
          revision: number
          source_updated_at: string
          ticket_id: string
          work_performed: string
        }
        Update: {
          id?: string
          is_demo?: boolean
          issue?: string
          outcome?: string
          owner_record_id?: string
          owner_request_type?: string | null
          owner_request_why?: string | null
          property_id?: string
          reviewed_at?: string
          reviewed_by?: string
          revision?: number
          source_updated_at?: string
          ticket_id?: string
          work_performed?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_owner_updates_owner_record_id_fkey"
            columns: ["owner_record_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_owner_updates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "ticket_owner_updates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_owner_updates_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "ticket_owner_updates_ticket_id_fkey"
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "ticket_steps_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_troubleshooting_answers: {
        Row: {
          answered_at: string
          answered_by: string
          id: string
          note: string | null
          outcome: string
          step_id: string
          ticket_id: string
        }
        Insert: {
          answered_at?: string
          answered_by?: string
          id?: string
          note?: string | null
          outcome: string
          step_id: string
          ticket_id: string
        }
        Update: {
          answered_at?: string
          answered_by?: string
          id?: string
          note?: string | null
          outcome?: string
          step_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_troubleshooting_answers_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "troubleshooting_guide_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_troubleshooting_answers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "ticket_troubleshooting_answers_ticket_id_fkey"
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
          is_demo: boolean
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
          is_demo?: boolean
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
          is_demo?: boolean
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
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
          active_stay_impact: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          assigned_to: string | null
          assignment_note: string | null
          assignment_source: string | null
          avoidable_reopen: boolean
          breezeway_synced_at: string | null
          breezeway_task_id: string | null
          breezeway_task_status: string | null
          breezeway_task_url: string | null
          bucket: string | null
          category: string
          closure_evidence: string | null
          closure_exception_at: string | null
          closure_exception_by: string | null
          closure_exception_reason: string | null
          closure_qa_result: string
          created_at: string
          created_by: string | null
          created_on_behalf_of: string | null
          cross_team: boolean
          current_action_owner: string | null
          department_code: string | null
          departure_review_id: string | null
          description: string | null
          due_at: string | null
          emergency_vendor_authorized_at: string | null
          emergency_vendor_authorized_by: string | null
          emergency_vendor_basis: string | null
          emergency_vendor_reason: string | null
          entry_kind: string | null
          escalated_at: string | null
          escalation_level: string
          estimated_cost: number | null
          external_id: string | null
          external_source: string | null
          external_status: string | null
          external_synced_at: string | null
          external_url: string | null
          final_communication_sent: boolean
          final_review_at: string | null
          final_review_by: string | null
          final_review_note: string | null
          functional_role_code: string | null
          guest_comm_owner: string | null
          guest_comm_required: string | null
          guest_confirmed: boolean
          guest_contact: string | null
          guest_feedback_id: string | null
          guest_impact: string
          guest_in_residence: boolean
          guest_name: string | null
          guest_recovery_flagged_at: string | null
          guest_recovery_flagged_by: string | null
          guest_recovery_needed: boolean
          guest_update_at: string | null
          guest_update_note: string | null
          handoff_note: string | null
          handoff_status: string
          handoff_type: string | null
          id: string
          initiator_type: string
          insurance_risk: string | null
          is_demo: boolean
          issue_reservation_relation: string | null
          last_reopened_at: string | null
          late_reason: string | null
          linked_feedback_id: string | null
          maintenance_category: string | null
          next_action: string | null
          next_action_due_at: string | null
          next_guest_update_at: string | null
          next_review_at: string | null
          occupancy_status: string
          outcome_type: string | null
          owner_participation_path: string | null
          owner_submitted: boolean
          owner_submitted_by: string | null
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
          repair_reported_incomplete_at: string | null
          reported_at: string
          reservation_arrival: string | null
          reservation_channel: string | null
          reservation_confirmation: string | null
          reservation_departure: string | null
          reservation_guest_count: number | null
          reservation_guest_name: string | null
          reservation_snapshot_at: string | null
          reservation_url: string | null
          resolution_notes: string | null
          resolution_path: string | null
          resolution_path_at: string | null
          resolution_path_by: string | null
          resolved_at: string | null
          response_due_at: string | null
          selected_vendor_org_id: string | null
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
          active_stay_impact?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_to?: string | null
          assignment_note?: string | null
          assignment_source?: string | null
          avoidable_reopen?: boolean
          breezeway_synced_at?: string | null
          breezeway_task_id?: string | null
          breezeway_task_status?: string | null
          breezeway_task_url?: string | null
          bucket?: string | null
          category?: string
          closure_evidence?: string | null
          closure_exception_at?: string | null
          closure_exception_by?: string | null
          closure_exception_reason?: string | null
          closure_qa_result?: string
          created_at?: string
          created_by?: string | null
          created_on_behalf_of?: string | null
          cross_team?: boolean
          current_action_owner?: string | null
          department_code?: string | null
          departure_review_id?: string | null
          description?: string | null
          due_at?: string | null
          emergency_vendor_authorized_at?: string | null
          emergency_vendor_authorized_by?: string | null
          emergency_vendor_basis?: string | null
          emergency_vendor_reason?: string | null
          entry_kind?: string | null
          escalated_at?: string | null
          escalation_level?: string
          estimated_cost?: number | null
          external_id?: string | null
          external_source?: string | null
          external_status?: string | null
          external_synced_at?: string | null
          external_url?: string | null
          final_communication_sent?: boolean
          final_review_at?: string | null
          final_review_by?: string | null
          final_review_note?: string | null
          functional_role_code?: string | null
          guest_comm_owner?: string | null
          guest_comm_required?: string | null
          guest_confirmed?: boolean
          guest_contact?: string | null
          guest_feedback_id?: string | null
          guest_impact?: string
          guest_in_residence?: boolean
          guest_name?: string | null
          guest_recovery_flagged_at?: string | null
          guest_recovery_flagged_by?: string | null
          guest_recovery_needed?: boolean
          guest_update_at?: string | null
          guest_update_note?: string | null
          handoff_note?: string | null
          handoff_status?: string
          handoff_type?: string | null
          id?: string
          initiator_type?: string
          insurance_risk?: string | null
          is_demo?: boolean
          issue_reservation_relation?: string | null
          last_reopened_at?: string | null
          late_reason?: string | null
          linked_feedback_id?: string | null
          maintenance_category?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          next_guest_update_at?: string | null
          next_review_at?: string | null
          occupancy_status?: string
          outcome_type?: string | null
          owner_participation_path?: string | null
          owner_submitted?: boolean
          owner_submitted_by?: string | null
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
          repair_reported_incomplete_at?: string | null
          reported_at?: string
          reservation_arrival?: string | null
          reservation_channel?: string | null
          reservation_confirmation?: string | null
          reservation_departure?: string | null
          reservation_guest_count?: number | null
          reservation_guest_name?: string | null
          reservation_snapshot_at?: string | null
          reservation_url?: string | null
          resolution_notes?: string | null
          resolution_path?: string | null
          resolution_path_at?: string | null
          resolution_path_by?: string | null
          resolved_at?: string | null
          response_due_at?: string | null
          selected_vendor_org_id?: string | null
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
          active_stay_impact?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_to?: string | null
          assignment_note?: string | null
          assignment_source?: string | null
          avoidable_reopen?: boolean
          breezeway_synced_at?: string | null
          breezeway_task_id?: string | null
          breezeway_task_status?: string | null
          breezeway_task_url?: string | null
          bucket?: string | null
          category?: string
          closure_evidence?: string | null
          closure_exception_at?: string | null
          closure_exception_by?: string | null
          closure_exception_reason?: string | null
          closure_qa_result?: string
          created_at?: string
          created_by?: string | null
          created_on_behalf_of?: string | null
          cross_team?: boolean
          current_action_owner?: string | null
          department_code?: string | null
          departure_review_id?: string | null
          description?: string | null
          due_at?: string | null
          emergency_vendor_authorized_at?: string | null
          emergency_vendor_authorized_by?: string | null
          emergency_vendor_basis?: string | null
          emergency_vendor_reason?: string | null
          entry_kind?: string | null
          escalated_at?: string | null
          escalation_level?: string
          estimated_cost?: number | null
          external_id?: string | null
          external_source?: string | null
          external_status?: string | null
          external_synced_at?: string | null
          external_url?: string | null
          final_communication_sent?: boolean
          final_review_at?: string | null
          final_review_by?: string | null
          final_review_note?: string | null
          functional_role_code?: string | null
          guest_comm_owner?: string | null
          guest_comm_required?: string | null
          guest_confirmed?: boolean
          guest_contact?: string | null
          guest_feedback_id?: string | null
          guest_impact?: string
          guest_in_residence?: boolean
          guest_name?: string | null
          guest_recovery_flagged_at?: string | null
          guest_recovery_flagged_by?: string | null
          guest_recovery_needed?: boolean
          guest_update_at?: string | null
          guest_update_note?: string | null
          handoff_note?: string | null
          handoff_status?: string
          handoff_type?: string | null
          id?: string
          initiator_type?: string
          insurance_risk?: string | null
          is_demo?: boolean
          issue_reservation_relation?: string | null
          last_reopened_at?: string | null
          late_reason?: string | null
          linked_feedback_id?: string | null
          maintenance_category?: string | null
          next_action?: string | null
          next_action_due_at?: string | null
          next_guest_update_at?: string | null
          next_review_at?: string | null
          occupancy_status?: string
          outcome_type?: string | null
          owner_participation_path?: string | null
          owner_submitted?: boolean
          owner_submitted_by?: string | null
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
          repair_reported_incomplete_at?: string | null
          reported_at?: string
          reservation_arrival?: string | null
          reservation_channel?: string | null
          reservation_confirmation?: string | null
          reservation_departure?: string | null
          reservation_guest_count?: number | null
          reservation_guest_name?: string | null
          reservation_snapshot_at?: string | null
          reservation_url?: string | null
          resolution_notes?: string | null
          resolution_path?: string | null
          resolution_path_at?: string | null
          resolution_path_by?: string | null
          resolved_at?: string | null
          response_due_at?: string | null
          selected_vendor_org_id?: string | null
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
            foreignKeyName: "tickets_departure_review_id_fkey"
            columns: ["departure_review_id"]
            isOneToOne: false
            referencedRelation: "departure_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_guest_feedback_id_fkey"
            columns: ["guest_feedback_id"]
            isOneToOne: false
            referencedRelation: "guest_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_linked_feedback_id_fkey"
            columns: ["linked_feedback_id"]
            isOneToOne: false
            referencedRelation: "guest_feedback"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "tickets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_selected_vendor_org_id_fkey"
            columns: ["selected_vendor_org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
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
      troubleshooting_guide_steps: {
        Row: {
          guide_id: string
          help: string | null
          id: string
          position: number
          prompt: string
        }
        Insert: {
          guide_id: string
          help?: string | null
          id?: string
          position: number
          prompt: string
        }
        Update: {
          guide_id?: string
          help?: string | null
          id?: string
          position?: number
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "troubleshooting_guide_steps_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "troubleshooting_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      troubleshooting_guides: {
        Row: {
          active: boolean
          category: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string
          email_approvals: boolean
          email_assignments: boolean
          email_enabled: boolean
          email_escalations: boolean
          email_handoffs: boolean
          email_work_orders: boolean
          inapp_approvals: boolean
          inapp_assignments: boolean
          inapp_escalations: boolean
          inapp_handoffs: boolean
          inapp_work_orders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_approvals?: boolean
          email_assignments?: boolean
          email_enabled?: boolean
          email_escalations?: boolean
          email_handoffs?: boolean
          email_work_orders?: boolean
          inapp_approvals?: boolean
          inapp_assignments?: boolean
          inapp_escalations?: boolean
          inapp_handoffs?: boolean
          inapp_work_orders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_approvals?: boolean
          email_assignments?: boolean
          email_enabled?: boolean
          email_escalations?: boolean
          email_handoffs?: boolean
          email_work_orders?: boolean
          inapp_approvals?: boolean
          inapp_assignments?: boolean
          inapp_escalations?: boolean
          inapp_handoffs?: boolean
          inapp_work_orders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      utility_accounts: {
        Row: {
          account_label: string
          created_at: string
          created_by: string | null
          credential_id: string | null
          id: string
          is_demo: boolean
          notes: string | null
          project_id: string | null
          property_id: string
          provider: string
          responsible: string
          service_end_on: string | null
          service_start_on: string | null
          status: string
          updated_at: string
          utility_type: string
        }
        Insert: {
          account_label?: string
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          project_id?: string | null
          property_id: string
          provider?: string
          responsible?: string
          service_end_on?: string | null
          service_start_on?: string | null
          status?: string
          updated_at?: string
          utility_type: string
        }
        Update: {
          account_label?: string
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          project_id?: string | null
          property_id?: string
          provider?: string
          responsible?: string
          service_end_on?: string | null
          service_start_on?: string | null
          status?: string
          updated_at?: string
          utility_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_accounts_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "property_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_accounts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_accounts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "utility_accounts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_costs: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_ref: string | null
          is_demo: boolean
          notes: string | null
          paid_on: string | null
          period_end: string | null
          period_start: string | null
          property_id: string
        }
        Insert: {
          account_id: string
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_ref?: string | null
          is_demo?: boolean
          notes?: string | null
          paid_on?: string | null
          period_end?: string | null
          period_start?: string | null
          property_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_ref?: string | null
          is_demo?: boolean
          notes?: string | null
          paid_on?: string | null
          period_end?: string | null
          period_start?: string | null
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_costs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "utility_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_costs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "utility_costs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
      vendor_compliance_reminders: {
        Row: {
          compliance_item: string
          expires_on: string
          id: string
          is_demo: boolean
          notified_at: string
          org_id: string
          recipients: string[]
          requirement_id: string
          resolution: string | null
          resolved_at: string | null
          threshold: string
        }
        Insert: {
          compliance_item: string
          expires_on: string
          id?: string
          is_demo?: boolean
          notified_at?: string
          org_id: string
          recipients?: string[]
          requirement_id: string
          resolution?: string | null
          resolved_at?: string | null
          threshold: string
        }
        Update: {
          compliance_item?: string
          expires_on?: string
          id?: string
          is_demo?: boolean
          notified_at?: string
          org_id?: string
          recipients?: string[]
          requirement_id?: string
          resolution?: string | null
          resolved_at?: string | null
          threshold?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_compliance_reminders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_compliance_reminders_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "gatekeeper_requirements"
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
      vendor_custom_fields: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          field_type: string
          id: string
          key: string
          label: string
          options: string[]
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          field_type: string
          id?: string
          key: string
          label: string
          options?: string[]
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          field_type?: string
          id?: string
          key?: string
          label?: string
          options?: string[]
          sort_order?: number
        }
        Relationships: []
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
      vendor_field_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          field: string
          id: string
          new_value: Json | null
          old_value: Json | null
          org_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          org_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_field_audit_org_id_fkey"
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
          document_id: string | null
          evidence_reference: string | null
          exception_reason: string | null
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
          document_id?: string | null
          evidence_reference?: string | null
          exception_reason?: string | null
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
          document_id?: string | null
          evidence_reference?: string | null
          exception_reason?: string | null
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
            foreignKeyName: "vendor_gatekeeper_results_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vendor_documents"
            referencedColumns: ["id"]
          },
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
          breezeway_hint: boolean | null
          breezeway_match_note: string | null
          breezeway_match_person_id: number | null
          breezeway_match_state: string | null
          comments: string | null
          company: string | null
          contact_person: string | null
          created_at: string
          created_contact_id: string | null
          created_org_id: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string
          decision_note: string | null
          departments: string[]
          display_name: string
          duplicate_candidates: string[]
          email: string | null
          groups: string[]
          id: string
          legacy_fields: Json
          legacy_notion_id: string | null
          legacy_status: string | null
          markets: string[]
          match_confidence: number | null
          match_org_id: string | null
          match_reasons: string[]
          payment_type: string | null
          phone: string | null
          preference: string | null
          pricing: string | null
          proposed_action: string
          raw: Json
          review_states: string[]
          source_role: string
          source_system: string
          specialties: string[]
          tags: string[]
          transitional_eligible: boolean
          updated_at: string
          website: string | null
        }
        Insert: {
          batch_id: string
          breezeway_hint?: boolean | null
          breezeway_match_note?: string | null
          breezeway_match_person_id?: number | null
          breezeway_match_state?: string | null
          comments?: string | null
          company?: string | null
          contact_person?: string | null
          created_at?: string
          created_contact_id?: string | null
          created_org_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_note?: string | null
          departments?: string[]
          display_name: string
          duplicate_candidates?: string[]
          email?: string | null
          groups?: string[]
          id?: string
          legacy_fields?: Json
          legacy_notion_id?: string | null
          legacy_status?: string | null
          markets?: string[]
          match_confidence?: number | null
          match_org_id?: string | null
          match_reasons?: string[]
          payment_type?: string | null
          phone?: string | null
          preference?: string | null
          pricing?: string | null
          proposed_action?: string
          raw?: Json
          review_states?: string[]
          source_role?: string
          source_system?: string
          specialties?: string[]
          tags?: string[]
          transitional_eligible?: boolean
          updated_at?: string
          website?: string | null
        }
        Update: {
          batch_id?: string
          breezeway_hint?: boolean | null
          breezeway_match_note?: string | null
          breezeway_match_person_id?: number | null
          breezeway_match_state?: string | null
          comments?: string | null
          company?: string | null
          contact_person?: string | null
          created_at?: string
          created_contact_id?: string | null
          created_org_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_note?: string | null
          departments?: string[]
          display_name?: string
          duplicate_candidates?: string[]
          email?: string | null
          groups?: string[]
          id?: string
          legacy_fields?: Json
          legacy_notion_id?: string | null
          legacy_status?: string | null
          markets?: string[]
          match_confidence?: number | null
          match_org_id?: string | null
          match_reasons?: string[]
          payment_type?: string | null
          phone?: string | null
          preference?: string | null
          pricing?: string | null
          proposed_action?: string
          raw?: Json
          review_states?: string[]
          source_role?: string
          source_system?: string
          specialties?: string[]
          tags?: string[]
          transitional_eligible?: boolean
          updated_at?: string
          website?: string | null
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "vendor_job_ratings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_market_coverage: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          market: string
          org_id: string
          preference: string
          service_category: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          market: string
          org_id: string
          preference?: string
          service_category: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          market?: string
          org_id?: string
          preference?: string
          service_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_market_coverage_market_fkey"
            columns: ["market"]
            isOneToOne: false
            referencedRelation: "vendor_markets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "vendor_market_coverage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_market_coverage_service_category_fkey"
            columns: ["service_category"]
            isOneToOne: false
            referencedRelation: "vendor_service_categories"
            referencedColumns: ["label"]
          },
        ]
      }
      vendor_markets: {
        Row: {
          active: boolean
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
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
          attachments: Json
          breezeway_person_id: string | null
          capacity_note: string | null
          compliance_status: string
          corrective_action_due: string | null
          created_at: string
          created_by: string | null
          critical_failure: boolean
          custom_fields: Json
          dispatch_method: string
          display_name: string
          emergency_available: boolean
          emergency_only: boolean
          google_place_id: string | null
          google_rating: number | null
          google_refreshed_at: string | null
          google_review_count: number | null
          id: string
          insurance_expires_on: string | null
          insurance_status: string
          is_active: boolean
          is_demo: boolean
          jobs_90d: number
          last_review_on: string | null
          last_verified_at: string | null
          legacy_all_groups: boolean
          legacy_fields: Json
          legacy_market_hints: string[]
          legacy_notion_id: string | null
          legal_name: string
          license_expires_on: string | null
          license_status: string
          markets: string[]
          migration_status: string | null
          next_review_on: string | null
          notes: string | null
          open_corrective_action: string | null
          payment_terms: string | null
          performance_score: number | null
          pricing_note: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          program_owner: string | null
          qualification_score: number | null
          response_time_note: string | null
          score_capacity: number | null
          score_communication: number | null
          score_hospitality: number | null
          score_pricing: number | null
          score_quality: number | null
          score_references: number | null
          score_responsiveness: number | null
          service_categories: string[]
          source_system: string
          status: string
          tags: string[]
          telegram_confirmed_at: string | null
          telegram_confirmed_by: string | null
          telegram_status: string
          tier: string | null
          transitional_deadline: string | null
          transitional_ended_at: string | null
          transitional_outcome: string | null
          transitional_review: boolean
          transitional_started_on: string | null
          trial_jobs_required: number
          trial_score: number | null
          updated_at: string
          uses_telegram: boolean
          vendor_class: string
          w9_status: string
          website: string | null
          work_order_email: string | null
        }
        Insert: {
          approval_limit?: number | null
          attachments?: Json
          breezeway_person_id?: string | null
          capacity_note?: string | null
          compliance_status?: string
          corrective_action_due?: string | null
          created_at?: string
          created_by?: string | null
          critical_failure?: boolean
          custom_fields?: Json
          dispatch_method?: string
          display_name: string
          emergency_available?: boolean
          emergency_only?: boolean
          google_place_id?: string | null
          google_rating?: number | null
          google_refreshed_at?: string | null
          google_review_count?: number | null
          id?: string
          insurance_expires_on?: string | null
          insurance_status?: string
          is_active?: boolean
          is_demo?: boolean
          jobs_90d?: number
          last_review_on?: string | null
          last_verified_at?: string | null
          legacy_all_groups?: boolean
          legacy_fields?: Json
          legacy_market_hints?: string[]
          legacy_notion_id?: string | null
          legal_name: string
          license_expires_on?: string | null
          license_status?: string
          markets?: string[]
          migration_status?: string | null
          next_review_on?: string | null
          notes?: string | null
          open_corrective_action?: string | null
          payment_terms?: string | null
          performance_score?: number | null
          pricing_note?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          program_owner?: string | null
          qualification_score?: number | null
          response_time_note?: string | null
          score_capacity?: number | null
          score_communication?: number | null
          score_hospitality?: number | null
          score_pricing?: number | null
          score_quality?: number | null
          score_references?: number | null
          score_responsiveness?: number | null
          service_categories?: string[]
          source_system?: string
          status?: string
          tags?: string[]
          telegram_confirmed_at?: string | null
          telegram_confirmed_by?: string | null
          telegram_status?: string
          tier?: string | null
          transitional_deadline?: string | null
          transitional_ended_at?: string | null
          transitional_outcome?: string | null
          transitional_review?: boolean
          transitional_started_on?: string | null
          trial_jobs_required?: number
          trial_score?: number | null
          updated_at?: string
          uses_telegram?: boolean
          vendor_class?: string
          w9_status?: string
          website?: string | null
          work_order_email?: string | null
        }
        Update: {
          approval_limit?: number | null
          attachments?: Json
          breezeway_person_id?: string | null
          capacity_note?: string | null
          compliance_status?: string
          corrective_action_due?: string | null
          created_at?: string
          created_by?: string | null
          critical_failure?: boolean
          custom_fields?: Json
          dispatch_method?: string
          display_name?: string
          emergency_available?: boolean
          emergency_only?: boolean
          google_place_id?: string | null
          google_rating?: number | null
          google_refreshed_at?: string | null
          google_review_count?: number | null
          id?: string
          insurance_expires_on?: string | null
          insurance_status?: string
          is_active?: boolean
          is_demo?: boolean
          jobs_90d?: number
          last_review_on?: string | null
          last_verified_at?: string | null
          legacy_all_groups?: boolean
          legacy_fields?: Json
          legacy_market_hints?: string[]
          legacy_notion_id?: string | null
          legal_name?: string
          license_expires_on?: string | null
          license_status?: string
          markets?: string[]
          migration_status?: string | null
          next_review_on?: string | null
          notes?: string | null
          open_corrective_action?: string | null
          payment_terms?: string | null
          performance_score?: number | null
          pricing_note?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          program_owner?: string | null
          qualification_score?: number | null
          response_time_note?: string | null
          score_capacity?: number | null
          score_communication?: number | null
          score_hospitality?: number | null
          score_pricing?: number | null
          score_quality?: number | null
          score_references?: number | null
          score_responsiveness?: number | null
          service_categories?: string[]
          source_system?: string
          status?: string
          tags?: string[]
          telegram_confirmed_at?: string | null
          telegram_confirmed_by?: string | null
          telegram_status?: string
          tier?: string | null
          transitional_deadline?: string | null
          transitional_ended_at?: string | null
          transitional_outcome?: string | null
          transitional_review?: boolean
          transitional_started_on?: string | null
          trial_jobs_required?: number
          trial_score?: number | null
          updated_at?: string
          uses_telegram?: boolean
          vendor_class?: string
          w9_status?: string
          website?: string | null
          work_order_email?: string | null
        }
        Relationships: []
      }
      vendor_saved_views: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          owner_id: string
          shared: boolean
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          shared?: boolean
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          shared?: boolean
          updated_at?: string
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
      vendor_service_categories: {
        Row: {
          active: boolean
          label: string
          sort_order: number
          tier: string
        }
        Insert: {
          active?: boolean
          label: string
          sort_order?: number
          tier: string
        }
        Update: {
          active?: boolean
          label?: string
          sort_order?: number
          tier?: string
        }
        Relationships: []
      }
      vendor_sourcing_requests: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          is_demo: boolean
          market: string
          note: string | null
          owner_id: string | null
          requested_by: string | null
          resolved_vendor_org_id: string | null
          service_category: string
          state: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          market: string
          note?: string | null
          owner_id?: string | null
          requested_by?: string | null
          resolved_vendor_org_id?: string | null
          service_category: string
          state?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          market?: string
          note?: string | null
          owner_id?: string | null
          requested_by?: string | null
          resolved_vendor_org_id?: string | null
          service_category?: string
          state?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_sourcing_requests_resolved_vendor_org_id_fkey"
            columns: ["resolved_vendor_org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_sourcing_requests_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "vendor_sourcing_requests_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
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
      vendor_transitional_reminders: {
        Row: {
          deadline: string
          id: string
          notified_at: string
          org_id: string
          recipients: string[]
          threshold: string
        }
        Insert: {
          deadline: string
          id?: string
          notified_at?: string
          org_id: string
          recipients?: string[]
          threshold: string
        }
        Update: {
          deadline?: string
          id?: string
          notified_at?: string
          org_id?: string
          recipients?: string[]
          threshold?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_transitional_reminders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_resources: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string | null
          id: string
          kind: string
          label: string | null
          note: string | null
          removed_at: string | null
          resource_type: string | null
          sort_order: number
          url: string | null
          work_item_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          kind: string
          label?: string | null
          note?: string | null
          removed_at?: string | null
          resource_type?: string | null
          sort_order?: number
          url?: string | null
          work_item_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          kind?: string
          label?: string | null
          note?: string | null
          removed_at?: string | null
          resource_type?: string | null
          sort_order?: number
          url?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_resources_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_resources_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          assigned_to: string | null
          blocks_handoff: boolean
          completed_at: string | null
          created_at: string
          department: string
          due_on: string | null
          functional_role: string | null
          id: string
          is_demo: boolean
          kind: string
          library_template_id: string | null
          linked_task_id: string | null
          needs_owner_attention: boolean
          owner_attention_set_at: string | null
          owner_attention_set_by: string | null
          owner_content: Json | null
          owner_priority: number | null
          owner_response: Json
          program_id: string | null
          property_id: string | null
          required: boolean
          responded_at: string | null
          response_types: string[]
          retired_at: string | null
          retired_reason: string | null
          sent_at: string | null
          source: string | null
          source_department: string | null
          source_id: string
          source_project_id: string | null
          source_table: string
          source_task_id: string | null
          status: string
          title: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          blocks_handoff?: boolean
          completed_at?: string | null
          created_at?: string
          department: string
          due_on?: string | null
          functional_role?: string | null
          id?: string
          is_demo?: boolean
          kind: string
          library_template_id?: string | null
          linked_task_id?: string | null
          needs_owner_attention?: boolean
          owner_attention_set_at?: string | null
          owner_attention_set_by?: string | null
          owner_content?: Json | null
          owner_priority?: number | null
          owner_response?: Json
          program_id?: string | null
          property_id?: string | null
          required?: boolean
          responded_at?: string | null
          response_types?: string[]
          retired_at?: string | null
          retired_reason?: string | null
          sent_at?: string | null
          source?: string | null
          source_department?: string | null
          source_id: string
          source_project_id?: string | null
          source_table: string
          source_task_id?: string | null
          status?: string
          title: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          blocks_handoff?: boolean
          completed_at?: string | null
          created_at?: string
          department?: string
          due_on?: string | null
          functional_role?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          library_template_id?: string | null
          linked_task_id?: string | null
          needs_owner_attention?: boolean
          owner_attention_set_at?: string | null
          owner_attention_set_by?: string | null
          owner_content?: Json | null
          owner_priority?: number | null
          owner_response?: Json
          program_id?: string | null
          property_id?: string | null
          required?: boolean
          responded_at?: string | null
          response_types?: string[]
          retired_at?: string | null
          retired_reason?: string | null
          sent_at?: string | null
          source?: string | null
          source_department?: string | null
          source_id?: string
          source_project_id?: string | null
          source_table?: string
          source_task_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_items_library_template_id_fkey"
            columns: ["library_template_id"]
            isOneToOne: false
            referencedRelation: "owner_opportunity_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "owner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "work_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_contact_attempts: {
        Row: {
          attempted_at: string
          candidate_id: string
          channel: string
          created_by: string | null
          id: string
          next_follow_up_on: string | null
          note: string | null
          response: string
        }
        Insert: {
          attempted_at?: string
          candidate_id: string
          channel: string
          created_by?: string | null
          id?: string
          next_follow_up_on?: string | null
          note?: string | null
          response: string
        }
        Update: {
          attempted_at?: string
          candidate_id?: string
          channel?: string
          created_by?: string | null
          id?: string
          next_follow_up_on?: string | null
          note?: string | null
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_contact_attempts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "work_order_vendor_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_events: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string
          detail: Json
          event_type: string
          id: string
          is_demo: boolean
          work_order_id: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          detail?: Json
          event_type: string
          id?: string
          is_demo?: boolean
          work_order_id: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          detail?: Json
          event_type?: string
          id?: string
          is_demo?: boolean
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_vendor_candidates: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          choice: string
          created_at: string
          created_by: string | null
          declined_reason: string | null
          id: string
          is_demo: boolean
          next_follow_up_on: string | null
          released_reason: string | null
          status: string
          vendor_name: string
          vendor_org_id: string | null
          work_order_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          choice?: string
          created_at?: string
          created_by?: string | null
          declined_reason?: string | null
          id?: string
          is_demo?: boolean
          next_follow_up_on?: string | null
          released_reason?: string | null
          status?: string
          vendor_name: string
          vendor_org_id?: string | null
          work_order_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          choice?: string
          created_at?: string
          created_by?: string | null
          declined_reason?: string | null
          id?: string
          is_demo?: boolean
          next_follow_up_on?: string | null
          released_reason?: string | null
          status?: string
          vendor_name?: string
          vendor_org_id?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_vendor_candidates_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "vendor_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_vendor_candidates_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_visits: {
        Row: {
          candidate_id: string | null
          created_at: string
          created_by: string | null
          evidence_document_ids: string[]
          findings: string | null
          follow_up_work_item_id: string | null
          id: string
          is_demo: boolean
          outcome: string
          vendor_name: string
          visit_date: string
          work_done: string | null
          work_order_id: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          evidence_document_ids?: string[]
          findings?: string | null
          follow_up_work_item_id?: string | null
          id?: string
          is_demo?: boolean
          outcome: string
          vendor_name: string
          visit_date?: string
          work_done?: string | null
          work_order_id: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          evidence_document_ids?: string[]
          findings?: string | null
          follow_up_work_item_id?: string | null
          id?: string
          is_demo?: boolean
          outcome?: string
          vendor_name?: string
          visit_date?: string
          work_done?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_visits_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "work_order_vendor_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_visits_follow_up_work_item_id_fkey"
            columns: ["follow_up_work_item_id"]
            isOneToOne: true
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_visits_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          approval_decided_at: string | null
          approval_id: string | null
          approval_note: string | null
          approval_requested_at: string | null
          approval_requested_by: string | null
          approval_status: string
          approved_amount: number | null
          assigned_to: string | null
          authority_level: string | null
          authorization_stale: boolean
          authorized_amount: number | null
          authorized_at: string | null
          authorized_scope: string | null
          authorized_vendor_org_id: string | null
          breezeway_handoff_at: string | null
          breezeway_handoff_error: string | null
          breezeway_handoff_status: string
          breezeway_request_key: string | null
          breezeway_task_ref: string | null
          category: string | null
          claim_id: string | null
          closed_at: string | null
          closed_by: string | null
          closure_note: string | null
          contractual_exception: boolean
          created_at: string
          created_by: string | null
          diagnosis_uncertain: boolean
          dispatch_reason: string | null
          dispatched_at: string | null
          dispatched_by: string | null
          emergency_reason: string | null
          evidence_complete: boolean
          final_cost: number | null
          follow_up_ticket_id: string | null
          guest_impact: string | null
          guest_notified_at: string | null
          id: string
          invoice_reference: string | null
          is_demo: boolean
          missed_commitments: number
          occupied_now: boolean
          owner_fyi_at: string | null
          owner_fyi_by: string | null
          owner_requested_comparison: boolean
          permanent_repair_needed: boolean
          phase: string
          policy_version: string
          priority: string
          property_id: string | null
          quote_amount: number | null
          quote_received_at: string | null
          quote_requested_at: string | null
          recovery_id: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          replacement_cost: number | null
          scheduled_for: string | null
          scope: string | null
          second_quote_amount: number | null
          service_category: string | null
          supervisor_approval_decided_at: string | null
          supervisor_approval_decided_by: string | null
          supervisor_approval_id: string | null
          supervisor_approval_note: string | null
          supervisor_approval_requested_at: string | null
          supervisor_approval_requested_by: string | null
          supervisor_approval_status: string
          temporary_mitigation: string | null
          ticket_id: string | null
          title: string
          updated_at: string
          vendor_acknowledged_at: string | null
          vendor_arrived_at: string | null
          vendor_completed_at: string | null
          vendor_contacted_at: string | null
          vendor_eta_at: string | null
          vendor_name: string | null
          vendor_org_id: string | null
          vendor_report: string | null
          warranty_contact: string | null
          warranty_contacted_at: string | null
          warranty_eta_at: string | null
          warranty_kind: string | null
          warranty_may_apply: boolean
          warranty_override_at: string | null
          warranty_override_by: string | null
          warranty_override_reason: string | null
        }
        Insert: {
          approval_decided_at?: string | null
          approval_id?: string | null
          approval_note?: string | null
          approval_requested_at?: string | null
          approval_requested_by?: string | null
          approval_status?: string
          approved_amount?: number | null
          assigned_to?: string | null
          authority_level?: string | null
          authorization_stale?: boolean
          authorized_amount?: number | null
          authorized_at?: string | null
          authorized_scope?: string | null
          authorized_vendor_org_id?: string | null
          breezeway_handoff_at?: string | null
          breezeway_handoff_error?: string | null
          breezeway_handoff_status?: string
          breezeway_request_key?: string | null
          breezeway_task_ref?: string | null
          category?: string | null
          claim_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_note?: string | null
          contractual_exception?: boolean
          created_at?: string
          created_by?: string | null
          diagnosis_uncertain?: boolean
          dispatch_reason?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          emergency_reason?: string | null
          evidence_complete?: boolean
          final_cost?: number | null
          follow_up_ticket_id?: string | null
          guest_impact?: string | null
          guest_notified_at?: string | null
          id?: string
          invoice_reference?: string | null
          is_demo?: boolean
          missed_commitments?: number
          occupied_now?: boolean
          owner_fyi_at?: string | null
          owner_fyi_by?: string | null
          owner_requested_comparison?: boolean
          permanent_repair_needed?: boolean
          phase?: string
          policy_version?: string
          priority?: string
          property_id?: string | null
          quote_amount?: number | null
          quote_received_at?: string | null
          quote_requested_at?: string | null
          recovery_id?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          replacement_cost?: number | null
          scheduled_for?: string | null
          scope?: string | null
          second_quote_amount?: number | null
          service_category?: string | null
          supervisor_approval_decided_at?: string | null
          supervisor_approval_decided_by?: string | null
          supervisor_approval_id?: string | null
          supervisor_approval_note?: string | null
          supervisor_approval_requested_at?: string | null
          supervisor_approval_requested_by?: string | null
          supervisor_approval_status?: string
          temporary_mitigation?: string | null
          ticket_id?: string | null
          title: string
          updated_at?: string
          vendor_acknowledged_at?: string | null
          vendor_arrived_at?: string | null
          vendor_completed_at?: string | null
          vendor_contacted_at?: string | null
          vendor_eta_at?: string | null
          vendor_name?: string | null
          vendor_org_id?: string | null
          vendor_report?: string | null
          warranty_contact?: string | null
          warranty_contacted_at?: string | null
          warranty_eta_at?: string | null
          warranty_kind?: string | null
          warranty_may_apply?: boolean
          warranty_override_at?: string | null
          warranty_override_by?: string | null
          warranty_override_reason?: string | null
        }
        Update: {
          approval_decided_at?: string | null
          approval_id?: string | null
          approval_note?: string | null
          approval_requested_at?: string | null
          approval_requested_by?: string | null
          approval_status?: string
          approved_amount?: number | null
          assigned_to?: string | null
          authority_level?: string | null
          authorization_stale?: boolean
          authorized_amount?: number | null
          authorized_at?: string | null
          authorized_scope?: string | null
          authorized_vendor_org_id?: string | null
          breezeway_handoff_at?: string | null
          breezeway_handoff_error?: string | null
          breezeway_handoff_status?: string
          breezeway_request_key?: string | null
          breezeway_task_ref?: string | null
          category?: string | null
          claim_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_note?: string | null
          contractual_exception?: boolean
          created_at?: string
          created_by?: string | null
          diagnosis_uncertain?: boolean
          dispatch_reason?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          emergency_reason?: string | null
          evidence_complete?: boolean
          final_cost?: number | null
          follow_up_ticket_id?: string | null
          guest_impact?: string | null
          guest_notified_at?: string | null
          id?: string
          invoice_reference?: string | null
          is_demo?: boolean
          missed_commitments?: number
          occupied_now?: boolean
          owner_fyi_at?: string | null
          owner_fyi_by?: string | null
          owner_requested_comparison?: boolean
          permanent_repair_needed?: boolean
          phase?: string
          policy_version?: string
          priority?: string
          property_id?: string | null
          quote_amount?: number | null
          quote_received_at?: string | null
          quote_requested_at?: string | null
          recovery_id?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          replacement_cost?: number | null
          scheduled_for?: string | null
          scope?: string | null
          second_quote_amount?: number | null
          service_category?: string | null
          supervisor_approval_decided_at?: string | null
          supervisor_approval_decided_by?: string | null
          supervisor_approval_id?: string | null
          supervisor_approval_note?: string | null
          supervisor_approval_requested_at?: string | null
          supervisor_approval_requested_by?: string | null
          supervisor_approval_status?: string
          temporary_mitigation?: string | null
          ticket_id?: string | null
          title?: string
          updated_at?: string
          vendor_acknowledged_at?: string | null
          vendor_arrived_at?: string | null
          vendor_completed_at?: string | null
          vendor_contacted_at?: string | null
          vendor_eta_at?: string | null
          vendor_name?: string | null
          vendor_org_id?: string | null
          vendor_report?: string | null
          warranty_contact?: string | null
          warranty_contacted_at?: string | null
          warranty_eta_at?: string | null
          warranty_kind?: string | null
          warranty_may_apply?: boolean
          warranty_override_at?: string | null
          warranty_override_by?: string | null
          warranty_override_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_follow_up_ticket_id_fkey"
            columns: ["follow_up_ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "work_orders_follow_up_ticket_id_fkey"
            columns: ["follow_up_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "work_orders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_recovery_id_fkey"
            columns: ["recovery_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_recovery_id_fkey"
            columns: ["recovery_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["recovery_id"]
          },
          {
            foreignKeyName: "work_orders_supervisor_approval_id_fkey"
            columns: ["supervisor_approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "work_orders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
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
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
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
      cleaner_exposure_summary: {
        Row: {
          attributed_minutes: number | null
          cleans: number | null
          last_clean: string | null
          lowest_confidence: string | null
          property_id: string | null
          reviewed_entries: number | null
          unknown_time_entries: number | null
          unlinked_person_id: number | null
          unreviewed_entries: number | null
          worker_id: string | null
          worker_name: string | null
          worker_type: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_exposure_ledger_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "cleaner_exposure_ledger_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_exposure_ledger_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "cleaner_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_owner_hours_by_property: {
        Row: {
          entries: number | null
          owner_minutes: number | null
          property_id: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_time_entry_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
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
      guest_recovery_ledger: {
        Row: {
          approval_status: string | null
          approved_amount: number | null
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          authority_level: string | null
          closed_at: string | null
          created_by: string | null
          currency: string | null
          delivered_amount: number | null
          delivered_on: string | null
          escalation_flags: string[] | null
          guest_name: string | null
          guest_recovery_needed: boolean | null
          guest_requested_amount: number | null
          is_demo: boolean | null
          issued_on: string | null
          last_updated_at: string | null
          logged_at: string | null
          outcome: string | null
          policy_version: string | null
          property_city: string | null
          property_id: string | null
          property_name: string | null
          property_state: string | null
          proposed_amount: number | null
          recovery_action: string | null
          recovery_id: string | null
          reservation_channel: string | null
          stage: string | null
          stay_arrival: string | null
          stay_departure: string | null
          ticket_category: string | null
          ticket_created_at: string | null
          ticket_id: string | null
          ticket_priority: string | null
          ticket_status: string | null
          ticket_title: string | null
          within_airbnb_policy: boolean | null
        }
        Relationships: []
      }
      onboarding_stage_captures: {
        Row: {
          new_value: string | null
          project_id: string | null
          property_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_project_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_project_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "guest_recovery_ledger"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "onboarding_project_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_person_activity: {
        Row: {
          activity_category: string | null
          is_fixture: boolean | null
          method: string | null
          minutes: number | null
          origin: string | null
          person_id: string | null
          property_id: string | null
          record_id: string | null
          review_state: string | null
          source_code: string | null
          source_ref: string | null
          work_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_into_operations: {
        Args: { _project_id: string }
        Returns: undefined
      }
      activate_owner_program: {
        Args: {
          _expected_version: string
          _program_id: string
          _started_on: string
        }
        Returns: string
      }
      add_manual_cleaner_clean: {
        Args: {
          _date: string
          _minutes: number
          _property_id: string
          _reason: string
          _worker_id: string
        }
        Returns: string
      }
      answer_expense_clarification: {
        Args: { _answer: string; _work_item: string }
        Returns: undefined
      }
      archive_attachment: {
        Args: { _actor_id: string; _document_id: string; _reason?: string }
        Returns: string
      }
      archive_demo_environment: {
        Args: { _actor?: string; _reason?: string }
        Returns: undefined
      }
      archive_demo_onboarding: { Args: { _actor: string }; Returns: undefined }
      archive_demo_owner_program: {
        Args: { _actor?: string }
        Returns: undefined
      }
      archive_demo_work_order: { Args: { _actor?: string }; Returns: undefined }
      archive_expense: {
        Args: { _expense: string; _reason: string }
        Returns: undefined
      }
      archive_qa_work_order_fixture: {
        Args: { _actor?: string }
        Returns: undefined
      }
      begin_attachment_upload: {
        Args: { _actor_id: string; _input: Json }
        Returns: Json
      }
      can_manage_credentials: { Args: { _user_id: string }; Returns: boolean }
      can_read_completed_onboarding_document: {
        Args: { _document_id: string }
        Returns: string
      }
      change_owner_program: {
        Args: {
          _action: string
          _closing_date?: string
          _expected_version: string
          _phase?: string
          _program_id: string
          _property_id?: string
          _reason?: string
          _settings?: Json
          _status?: string
        }
        Returns: Json
      }
      classify_cleaner_account: {
        Args: {
          _classification: string
          _new_worker_name?: string
          _note?: string
          _person: number
          _worker_id?: string
        }
        Returns: Json
      }
      cleaner_activate_pending: {
        Args: {
          _department: string
          _home_id: string
          _scheduled_date: string
          _task_id: number
        }
        Returns: Json
      }
      cleaner_dispatch_options: { Args: never; Returns: Json }
      cleaner_first_live_record_check: {
        Args: never
        Returns: {
          attributed_minutes: number
          attribution_method: string
          before_tracking_start: boolean
          breezeway_home_id: string
          breezeway_person_id: number
          breezeway_task_id: number
          calendar_year: number
          completion_date: string
          counted: boolean
          first_ledger_id: string
          mapping_state: string
          open_review_items: number
          original_minutes: number
          property_id: string
          property_name: string
          raw_elapsed_minutes: number
          review_state: string
          safeguard: Json
          tracking_from: string
          worker_classification: string
          worker_id: string
          worker_name: string
        }[]
      }
      cleaner_ingest_task: {
        Args: {
          _fixture?: boolean
          _payload: Json
          _property_id: string
          _source: string
        }
        Returns: Json
      }
      cleaner_recalculate_task: { Args: { _task: number }; Returns: Json }
      cleaner_record_dispatch: {
        Args: {
          _acknowledged?: boolean
          _breezeway_task_id?: number
          _individuals?: string[]
          _property: string
          _scheduled: string
          _task_ref: string
          _worker: string
        }
        Returns: Json
      }
      cleaner_record_dispatch_one: {
        Args: {
          _ack: boolean
          _bz: number
          _company: string
          _fx: boolean
          _on: string
          _property: string
          _ref: string
          _worker: string
        }
        Returns: Json
      }
      cleaner_rotation: {
        Args: { _on?: string; _property: string }
        Returns: Json
      }
      cleaner_safeguard_check: {
        Args: {
          _projected_minutes?: number
          _property: string
          _scheduled?: string
          _task_ref: string
          _worker: string
        }
        Returns: Json
      }
      cleaner_safeguard_override: {
        Args: {
          _breezeway_task_id?: number
          _category: string
          _justification: string
          _kind: string
          _property: string
          _scheduled: string
          _task_ref: string
          _worker: string
        }
        Returns: string
      }
      cleaner_safeguard_portfolio: {
        Args: { _include_fixture?: boolean; _year: number }
        Returns: Json
      }
      cleaner_safeguard_request_override: {
        Args: {
          _note: string
          _property: string
          _scheduled: string
          _task_ref: string
          _worker: string
        }
        Returns: undefined
      }
      cleaner_safeguard_weekly_digest: { Args: never; Returns: undefined }
      cleaner_set_standard_duration: {
        Args: { _minutes: number; _property: string }
        Returns: undefined
      }
      cleaner_verify_cron_token: { Args: { _token: string }; Returns: boolean }
      close_owner_opportunity: {
        Args: {
          _expected_updated_at: string
          _reason: string
          _review_id: string
        }
        Returns: string
      }
      complete_attachment_upload: {
        Args: {
          _actor_id: string
          _document_id: string
          _fulfils_request_id?: string
          _ok: boolean
        }
        Returns: boolean
      }
      complete_owner_opportunity: { Args: { _id: string }; Returns: undefined }
      complete_owner_program: {
        Args: {
          _actor_id: string
          _expected_version: string
          _program_id: string
          _report: Json
        }
        Returns: string
      }
      confirm_statement_reconciliation: {
        Args: {
          _exception_resolution?: string
          _period: string
          _property: string
          _source_reference: string
        }
        Returns: string
      }
      confirm_vendor_telegram: {
        Args: { _org: string; _status: string }
        Returns: undefined
      }
      correct_cleaner_exposure: {
        Args: {
          _entry: string
          _minutes: number
          _reason: string
          _worker_id: string
        }
        Returns: string
      }
      correct_owner_time_entry: {
        Args: {
          _actor_id: string
          _entry_id: string
          _minutes: number
          _reason: string
        }
        Returns: string
      }
      create_departure_review_from_clean: {
        Args: { _wo_id: string }
        Returns: string
      }
      create_onboarding_financial_request: {
        Args: { _actor_id: string; _property_id: string; _request: Json }
        Returns: Json
      }
      create_onboarding_handoff: {
        Args: {
          _actor_id: string
          _expected_lifecycle: string
          _property_id: string
          _request: Json
        }
        Returns: string
      }
      create_owner_matter: {
        Args: {
          _category: string
          _description: string
          _path: string
          _program_id: string
          _property_id: string
          _title: string
        }
        Returns: {
          ref: number
          ticket_id: string
        }[]
      }
      create_owner_opportunity: {
        Args: {
          _action_type: string
          _available_from: string
          _expected_owner_id: string
          _expected_source_updated_at: string
          _expected_version: string
          _instructions: string
          _program_id: string
          _respond_by: string
          _reviewed: boolean
          _source: string
          _source_id: string
          _staff_context: string
          _title: string
        }
        Returns: string
      }
      create_owner_program: { Args: { _property_id: string }; Returns: Json }
      decide_claim_waiver: {
        Args: { _approve: boolean; _notes: string; _waiver_id: string }
        Returns: undefined
      }
      decide_onboarding_financial_request: {
        Args: {
          _approved: boolean
          _approved_amount?: number
          _note: string
          _request_id: string
        }
        Returns: undefined
      }
      decide_onboarding_task_approval: {
        Args: {
          _approved: boolean
          _evidence_url?: string
          _note: string
          _task_id: string
        }
        Returns: string
      }
      expense_authorization_status: {
        Args: { _expense: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      instantiate_onboarding_v2: {
        Args: { _project_id: string; _version_id: string }
        Returns: number
      }
      is_accounting: { Args: { _user_id: string }; Returns: boolean }
      is_director: { Args: { _user_id: string }; Returns: boolean }
      is_finance_lead: { Args: { _user_id: string }; Returns: boolean }
      is_internal_staff: { Args: { _user_id: string }; Returns: boolean }
      is_onboarding_director: { Args: { _user_id: string }; Returns: boolean }
      is_onboarding_leader: { Args: { _user_id: string }; Returns: boolean }
      is_onboarding_staff: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_supervisor: { Args: { _user_id: string }; Returns: boolean }
      link_demo_owner_account: {
        Args: { _program_id: string; _reason: string; _user_id: string }
        Returns: string
      }
      log_handoff_deficiency: {
        Args: {
          _detail: string
          _project_id: string
          _role: string
          _title: string
        }
        Returns: string
      }
      log_owner_time_entry: {
        Args: { _entry: Json; _property_ids: string[] }
        Returns: string
      }
      mark_owner_alerts_read: { Args: { _ids: string[] }; Returns: number }
      mark_owner_opportunity_viewed: {
        Args: { _id: string }
        Returns: undefined
      }
      mark_ready_for_operations: {
        Args: { _project_id: string }
        Returns: undefined
      }
      my_demo_access: { Args: never; Returns: Json }
      notify_staff: {
        Args: {
          _actor_id: string
          _body: string
          _email: boolean
          _entity_id: string
          _entity_type: string
          _is_demo: boolean
          _kind: string
          _link_path: string
          _priority: string
          _title: string
          _user_id: string
        }
        Returns: string
      }
      notify_staff_isolated: {
        Args: {
          _actor_id: string
          _body: string
          _email: boolean
          _entity_id: string
          _entity_type: string
          _is_demo: boolean
          _kind: string
          _link_path: string
          _priority: string
          _title: string
          _user_id: string
        }
        Returns: string
      }
      open_handoff_blockers: { Args: { _property_id: string }; Returns: number }
      override_onboarding_task_date: {
        Args: {
          _actor_id: string
          _due_on: string
          _expected_updated_at: string
          _reason: string
          _task_id: string
        }
        Returns: string
      }
      owner_badge_refresh_version: {
        Args: { _actor_id: string; _program_id: string }
        Returns: string
      }
      owner_completions_for_review: {
        Args: { _demo: boolean; _property?: string }
        Returns: {
          assignment_exception: boolean
          completed_at: string
          evidence_count: number
          follow_up_task_id: string
          latest_feedback: string
          latest_feedback_at: string
          latest_internal_note: string
          new_owner_activity: boolean
          owner_name: string
          property_id: string
          property_name: string
          responsible_id: string
          responsible_name: string
          review_status: string
          reviewed_at: string
          reviewed_by_name: string
          source_task_id: string
          title: string
          work_item_id: string
        }[]
      }
      owner_document_access: {
        Args: { _actor_id?: string; _document_id: string }
        Returns: boolean
      }
      owner_owns_program: { Args: { _program_id: string }; Returns: boolean }
      owner_program_staff_choices: {
        Args: never
        Returns: {
          id: string
          label: string
        }[]
      }
      owner_property_access: {
        Args: { _actor_id?: string; _property_id: string }
        Returns: boolean
      }
      owner_str_reports: { Args: never; Returns: Json }
      post_owner_request_message: {
        Args: { _body: string; _id: string }
        Returns: string
      }
      prepare_onboarding_financial_approval: {
        Args: {
          _expected_amount: number
          _expected_tier: string
          _request_id: string
        }
        Returns: string
      }
      prepare_onboarding_task_approval: {
        Args: { _detail: string; _property_id: string; _task_id: string }
        Returns: string
      }
      prepare_work_order_owner_approval: {
        Args: {
          _expected_updated_at: string
          _owner_summary: string
          _work_order_id: string
        }
        Returns: string
      }
      project_role_assignee: {
        Args: { _project_id: string; _role: string }
        Returns: string
      }
      publish_onboarding_template: {
        Args: { _template_id: string }
        Returns: string
      }
      publish_owner_approval: {
        Args: {
          _approval_id: string
          _detail: string
          _expected_owner_id: string
          _expected_program_id: string
          _expected_recipient_id: string
          _expected_revision: number
          _expected_updated_at: string
          _reviewed: boolean
          _title: string
        }
        Returns: string
      }
      read_completed_onboarding_records: {
        Args: { _property_id: string }
        Returns: Json
      }
      read_onboarding_assignment_authority: {
        Args: never
        Returns: {
          can_assign: boolean
          director_id: string
        }[]
      }
      read_onboarding_handoff_snapshot: {
        Args: { _property_id: string }
        Returns: Json
      }
      read_onboarding_independent_readiness: {
        Args: { _property_ids: string[] }
        Returns: Json
      }
      read_onboarding_review_capabilities: {
        Args: never
        Returns: {
          can_review_stages: boolean
          is_admin: boolean
          kati_review: boolean
          live_confirmation: boolean
          micah_review: boolean
          operations_acceptance: boolean
        }[]
      }
      read_owner_approval_publication_context: {
        Args: { _approval_id: string }
        Returns: Json
      }
      read_owner_approvals: {
        Args: never
        Returns: {
          approval: Json
          id: string
        }[]
      }
      read_owner_participation: {
        Args: {
          _preview?: boolean
          _program_id?: string
          _record_id?: string
          _section: string
        }
        Returns: {
          id: string
          item: Json
        }[]
      }
      read_owner_program_properties: {
        Args: { _preview?: boolean; _program_id: string }
        Returns: {
          enrollment: Json
          id: string
        }[]
      }
      read_owner_programs: {
        Args: { _actor_id?: string; _preview?: boolean; _program_id?: string }
        Returns: {
          id: string
          program: Json
        }[]
      }
      read_owner_properties: {
        Args: {
          _actor_id?: string
          _preview?: boolean
          _program_id?: string
          _property_ids: string[]
        }
        Returns: {
          id: string
          program_id: string
          program_status: string
          property: Json
        }[]
      }
      read_owner_review_update: {
        Args: { _review_id: string; _revision: number }
        Returns: Json
      }
      read_owner_ticket_authority: {
        Args: {
          _preview?: boolean
          _program_id: string
          _property_ids: string[]
        }
        Returns: {
          approval_id: string
          approval_status: string
          approved_amount: number
          contractual_exception: boolean
          emergency_reason: string
          id: string
          phase: string
          property_id: string
          quote_amount: number
          receipt_amount: number
          receipt_decided_at: string
          receipt_id: string
          receipt_status: string
          ticket_id: string
        }[]
      }
      read_owner_ticket_financial_context: {
        Args: {
          _preview?: boolean
          _program_id: string
          _property_ids: string[]
        }
        Returns: {
          approval_id: string
          approval_status: string
          approved_amount: number
          contractual_exception: boolean
          emergency_reason: string
          final_cost: number
          id: string
          phase: string
          property_id: string
          quote_amount: number
          receipt_amount: number
          receipt_decided_at: string
          receipt_id: string
          receipt_status: string
          ticket_id: string
        }[]
      }
      read_owner_ticket_updates: {
        Args: {
          _preview?: boolean
          _program_id: string
          _property_ids: string[]
        }
        Returns: {
          issue: string
          outcome: string
          owner_request_type: string
          owner_request_why: string
          property_id: string
          reviewed_at: string
          revision: number
          ticket_id: string
          work_performed: string
        }[]
      }
      read_owner_tickets: {
        Args: {
          _preview?: boolean
          _program_id: string
          _property_ids: string[]
        }
        Returns: {
          category: string
          id: string
          owner_participation_path: string
          owner_submitted: boolean
          priority: string
          property_id: string
          ref: number
          reported_at: string
          resolved_at: string
          status: string
        }[]
      }
      reconcile_onboarding_delivery: {
        Args: {
          _attempt_id: string
          _delivered: boolean
          _kind: string
          _note: string
          _record_id: string
        }
        Returns: undefined
      }
      record_claim_finance_treatment: {
        Args: {
          _claim_id: string
          _needs_leadership?: boolean
          _note: string
          _treatment: string
        }
        Returns: undefined
      }
      record_claim_leadership_decision: {
        Args: { _claim_id: string; _decision: string }
        Returns: undefined
      }
      record_onboarding_stage_capture: {
        Args: {
          _actor: string
          _capture: Json
          _expected_revision: number
          _project_id: string
          _scope: Json
          _tasks: Json
        }
        Returns: undefined
      }
      record_owner_completion_review: {
        Args: {
          _follow_up_task_id?: string
          _id: string
          _internal_note?: string
          _owner_feedback?: string
          _status: string
        }
        Returns: string
      }
      record_owner_email_decision: {
        Args: {
          _approval_id: string
          _decision: string
          _expected_updated_at: string
          _note: string
          _response_id?: string
        }
        Returns: Json
      }
      record_owner_financial_response: {
        Args: {
          _approval_id: string
          _approved: boolean
          _note: string
          _owner_id: string
        }
        Returns: string
      }
      record_owner_task_response: {
        Args: {
          _approval_id: string
          _approved: boolean
          _note: string
          _owner_id: string
        }
        Returns: string
      }
      record_owner_work_order_response: {
        Args: {
          _approval_id: string
          _approved: boolean
          _note: string
          _owner_id: string
        }
        Returns: string
      }
      record_staff_work_order_owner_decision: {
        Args: {
          _approved_amount: number
          _expected_updated_at: string
          _note: string
          _outcome: string
          _work_order_id: string
        }
        Returns: string
      }
      record_statement_disposition: {
        Args: {
          _defer_to?: string
          _disposition: string
          _exclusion_treatment?: string
          _expense: string
          _internal_note?: string
          _owner_description?: string
          _period: string
          _recovery_treatment?: string
        }
        Returns: string
      }
      record_versioned_owner_response: {
        Args: {
          _approval_id: string
          _approved: boolean
          _expected_updated_at: string
          _note: string
          _owner_id: string
        }
        Returns: string
      }
      redeem_owner_invite: {
        Args: { _code: string; _user_id: string }
        Returns: string
      }
      refresh_owner_badges: {
        Args: {
          _actor_id: string
          _expected_version: string
          _program_id: string
        }
        Returns: Json
      }
      remove_vendor_custom_field: {
        Args: { _field_id: string }
        Returns: string
      }
      reopen_owner_request: { Args: { _id: string }; Returns: undefined }
      reorder_arha_opportunities: {
        Args: { _ids: string[]; _property_id: string }
        Returns: undefined
      }
      request_claim_waiver: {
        Args: { _claim_id: string; _context?: string; _reason: string }
        Returns: string
      }
      request_expense_clarification: {
        Args: {
          _assignee: string
          _due: string
          _expense: string
          _question: string
        }
        Returns: string
      }
      request_new_vendor: {
        Args: {
          _category: string
          _market: string
          _note?: string
          _ticket: string
        }
        Returns: string
      }
      request_owner_document: {
        Args: { _actor_id: string; _input: Json }
        Returns: string
      }
      request_owner_response: {
        Args: { _body: string; _id: string; _kind: string }
        Returns: string
      }
      rerun_departure_review_trigger: {
        Args: { _wo_id: string }
        Returns: string
      }
      reset_demo_environment:
        | { Args: never; Returns: undefined }
        | { Args: { _actor?: string }; Returns: undefined }
      resolve_cleaner_review: {
        Args: { _id: string; _note: string; _status: string }
        Returns: undefined
      }
      resolve_owner_request: { Args: { _id: string }; Returns: undefined }
      respond_owner_approval: {
        Args: {
          _approval_id: string
          _approved: boolean
          _expected_updated_at: string
          _note: string
          _publication_id: string
        }
        Returns: string
      }
      respond_owner_opportunity: {
        Args: { _decision: string; _id: string; _kind: string; _text: string }
        Returns: undefined
      }
      respond_owner_review: {
        Args: {
          _decision: string
          _expected_updated_at: string
          _owner_update_revision: number
          _response: string
          _review_id: string
        }
        Returns: string
      }
      resubmit_owner_time_entry: {
        Args: {
          _activity: string
          _entry_id: string
          _minutes: number
          _note: string
        }
        Returns: string
      }
      retract_demo_notifications: {
        Args: { _ids: string[]; _reason: string }
        Returns: number
      }
      review_onboarding_fact: {
        Args: { _accept: boolean; _note?: string; _proposal_id: string }
        Returns: Json
      }
      review_onboarding_handoff: {
        Args: {
          _decision: string
          _exception?: string
          _expected_step: string
          _handoff_id: string
          _note?: string
        }
        Returns: Json
      }
      review_owner_time_entry: {
        Args: {
          _decision: string
          _entry_id: string
          _expected_version: string
          _note: string
        }
        Returns: string
      }
      save_arha_opportunity: {
        Args: {
          _content: Json
          _id: string
          _property_id: string
          _resources: Json
          _response_types: string[]
          _send: boolean
          _source_task_id: string
          _title: string
        }
        Returns: string
      }
      save_owner_alert_preferences: {
        Args: {
          _email: boolean
          _phone: string
          _push: boolean
          _sms_p1: boolean
        }
        Returns: string
      }
      save_owner_opportunity: {
        Args: {
          _content: Json
          _id: string
          _linked_task_id: string
          _property_id: string
          _send: boolean
          _title: string
        }
        Returns: string
      }
      save_ticket_owner_update: {
        Args: {
          _actor_id: string
          _expected_owner_id: string
          _expected_revision: number
          _expected_ticket_updated_at: string
          _issue: string
          _outcome: string
          _owner_request_type: string
          _owner_request_why: string
          _reviewed: boolean
          _ticket_id: string
          _work_performed: string
        }
        Returns: string
      }
      save_work_order_costs: {
        Args: {
          _expected_updated_at: string
          _final_cost: number
          _quote: number
          _reason: string
          _scope: string
          _second_quote: number
          _work_order_id: string
        }
        Returns: string
      }
      seat_eligible_now: {
        Args: { _at?: string; _role_code: string }
        Returns: boolean
      }
      seat_holder: { Args: { _code: string }; Returns: string }
      seat_holder_at: {
        Args: { _at?: string; _role_code: string }
        Returns: string
      }
      seat_on_duty: {
        Args: { _at?: string; _role_code: string }
        Returns: boolean
      }
      seat_override_at: {
        Args: { _at?: string; _role_code: string }
        Returns: {
          kind: string
          user_id: string
        }[]
      }
      seed_demo_environment:
        | { Args: never; Returns: undefined }
        | { Args: { _actor?: string }; Returns: undefined }
      seed_demo_onboarding: { Args: { _actor: string }; Returns: undefined }
      seed_demo_owner_program: { Args: { _actor?: string }; Returns: string }
      seed_demo_work_order: { Args: { _actor?: string }; Returns: undefined }
      seed_qa_work_order_fixture: {
        Args: { _actor?: string }
        Returns: undefined
      }
      set_attachment_visibility: {
        Args: { _actor_id: string; _document_id: string; _visibility: string }
        Returns: string
      }
      set_cleaner_hours_participation: {
        Args: {
          _active: boolean
          _note: string
          _property: string
          _tracking_from: string
        }
        Returns: undefined
      }
      set_demo_finance_access: {
        Args: { _on: boolean; _reason: string; _user: string }
        Returns: undefined
      }
      set_owner_attention: {
        Args: { _id: string; _on: boolean }
        Returns: undefined
      }
      staff_assignable: { Args: { _user_id: string }; Returns: boolean }
      start_optional_opportunity: {
        Args: { _property_id: string; _template_id: string }
        Returns: string
      }
      str_report_context: { Args: { _property: string }; Returns: Json }
      str_report_preview: {
        Args: {
          _from: string
          _include_nonowner: boolean
          _include_owner: boolean
          _program: string
          _property: string
          _to: string
        }
        Returns: Json
      }
      str_report_release: {
        Args: { _exclusion_note?: string; _report: string }
        Returns: Json
      }
      str_report_revise: {
        Args: { _program: string; _property: string; _reason: string }
        Returns: Json
      }
      str_report_version: { Args: { _report: string }; Returns: Json }
      sync_ticket_opportunities: {
        Args: { _property_id: string; _ticket_id?: string }
        Returns: undefined
      }
      tag_owner_upload: {
        Args: {
          _document_id: string
          _owner_category: string
          _work_item_id: string
        }
        Returns: undefined
      }
      unlink_demo_owner_account: {
        Args: { _program_id: string; _reason: string }
        Returns: string
      }
      vendor_compliance_sweep: { Args: { _today?: string }; Returns: Json }
      vendor_compliance_threshold: {
        Args: { _expires: string; _today?: string }
        Returns: string
      }
      vendor_dispatch_eligible: { Args: { _org: string }; Returns: boolean }
      vendor_program_owner_choices: {
        Args: never
        Returns: {
          full_name: string
          id: string
        }[]
      }
      vendor_transitional_sweep: { Args: { _today?: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "manager" | "tech" | "vendor" | "owner" | "onboarding"
      credential_category:
        | "wifi"
        | "gate_community"
        | "property_access"
        | "garage"
        | "lockbox"
        | "streaming"
        | "supply_storage"
        | "alarm_security"
        | "other"
      lead_channel:
        | "call"
        | "email"
        | "text"
        | "other"
        | "note"
        | "stage_change"
        | "system"
      lead_loss_reason:
        | "unresponsive"
        | "other_option"
        | "budget_too_low"
        | "no_properties_available"
        | "outside_coverage"
        | "requirements_not_met"
        | "expired"
        | "dates_did_not_work"
        | "other"
      lead_source:
        | "insurance"
        | "relocation"
        | "corporate"
        | "direct"
        | "referral"
        | "realtor"
        | "website"
        | "phone"
        | "email"
        | "social"
        | "other"
      lead_stage:
        | "new"
        | "first_contact"
        | "follow_up_1"
        | "final_follow_up"
        | "engaged"
        | "booking_pending"
        | "converted"
        | "lost"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      credential_category: [
        "wifi",
        "gate_community",
        "property_access",
        "garage",
        "lockbox",
        "streaming",
        "supply_storage",
        "alarm_security",
        "other",
      ],
      lead_channel: [
        "call",
        "email",
        "text",
        "other",
        "note",
        "stage_change",
        "system",
      ],
      lead_loss_reason: [
        "unresponsive",
        "other_option",
        "budget_too_low",
        "no_properties_available",
        "outside_coverage",
        "requirements_not_met",
        "expired",
        "dates_did_not_work",
        "other",
      ],
      lead_source: [
        "insurance",
        "relocation",
        "corporate",
        "direct",
        "referral",
        "realtor",
        "website",
        "phone",
        "email",
        "social",
        "other",
      ],
      lead_stage: [
        "new",
        "first_contact",
        "follow_up_1",
        "final_follow_up",
        "engaged",
        "booking_pending",
        "converted",
        "lost",
      ],
    },
  },
} as const
