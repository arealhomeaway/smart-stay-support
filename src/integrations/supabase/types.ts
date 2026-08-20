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
          breezeway_property_id: string | null
          breezeway_synced_at: string | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          nickname: string | null
          notes: string | null
          ownerrez_property_id: string | null
          ownerrez_synced_at: string | null
          postal_code: string | null
          state: string | null
          unit: string | null
          updated_at: string
          wifi_notes: string | null
        }
        Insert: {
          access_notes?: string | null
          active?: boolean
          address_line1?: string | null
          breezeway_property_id?: string | null
          breezeway_synced_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          nickname?: string | null
          notes?: string | null
          ownerrez_property_id?: string | null
          ownerrez_synced_at?: string | null
          postal_code?: string | null
          state?: string | null
          unit?: string | null
          updated_at?: string
          wifi_notes?: string | null
        }
        Update: {
          access_notes?: string | null
          active?: boolean
          address_line1?: string | null
          breezeway_property_id?: string | null
          breezeway_synced_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          nickname?: string | null
          notes?: string | null
          ownerrez_property_id?: string | null
          ownerrez_synced_at?: string | null
          postal_code?: string | null
          state?: string | null
          unit?: string | null
          updated_at?: string
          wifi_notes?: string | null
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
          vendor_name: string | null
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
          vendor_name?: string | null
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
          vendor_name?: string | null
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
    }
    Enums: {
      app_role: "admin" | "manager" | "tech"
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
      app_role: ["admin", "manager", "tech"],
    },
  },
} as const
