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
      bins: {
        Row: {
          created_at: string
          fill_percent: number
          id: string
          label: string
          last_seen: string | null
          lat: number
          lng: number
          status: Database["public"]["Enums"]["bin_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          fill_percent?: number
          id: string
          label: string
          last_seen?: string | null
          lat: number
          lng: number
          status?: Database["public"]["Enums"]["bin_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          fill_percent?: number
          id?: string
          label?: string
          last_seen?: string | null
          lat?: number
          lng?: number
          status?: Database["public"]["Enums"]["bin_status"]
          updated_at?: string
        }
        Relationships: []
      }
      commands: {
        Row: {
          acked_at: string | null
          created_at: string
          id: string
          issued_by: string | null
          payload: Json | null
          priority: number
          sent_at: string | null
          status: Database["public"]["Enums"]["command_status"]
          type: Database["public"]["Enums"]["command_type"]
        }
        Insert: {
          acked_at?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          payload?: Json | null
          priority?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["command_status"]
          type: Database["public"]["Enums"]["command_type"]
        }
        Update: {
          acked_at?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          payload?: Json | null
          priority?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["command_status"]
          type?: Database["public"]["Enums"]["command_type"]
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name: string
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          token?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          bin_id: string | null
          created_at: string
          id: string
          message: string
          metadata: Json | null
          type: string
        }
        Insert: {
          bin_id?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          type: string
        }
        Update: {
          bin_id?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      truck_state: {
        Row: {
          fill_percent: number
          heading: number | null
          id: number
          last_seen: string | null
          lat: number | null
          lng: number | null
          mode: Database["public"]["Enums"]["truck_mode"]
          state: Database["public"]["Enums"]["truck_run_state"]
          target_bin_id: string | null
          updated_at: string
        }
        Insert: {
          fill_percent?: number
          heading?: number | null
          id?: number
          last_seen?: string | null
          lat?: number | null
          lng?: number | null
          mode?: Database["public"]["Enums"]["truck_mode"]
          state?: Database["public"]["Enums"]["truck_run_state"]
          target_bin_id?: string | null
          updated_at?: string
        }
        Update: {
          fill_percent?: number
          heading?: number | null
          id?: number
          last_seen?: string | null
          lat?: number | null
          lng?: number | null
          mode?: Database["public"]["Enums"]["truck_mode"]
          state?: Database["public"]["Enums"]["truck_run_state"]
          target_bin_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_state_target_bin_id_fkey"
            columns: ["target_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
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
      app_role: "operator" | "admin"
      bin_status: "ok" | "nearly_full" | "full" | "emptied"
      command_status: "pending" | "sent" | "done" | "failed"
      command_type: "F" | "B" | "S" | "DUMP" | "GOTO" | "RETURN"
      truck_mode: "auto" | "manual"
      truck_run_state: "idle" | "moving" | "dumping" | "returning" | "full"
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
      app_role: ["operator", "admin"],
      bin_status: ["ok", "nearly_full", "full", "emptied"],
      command_status: ["pending", "sent", "done", "failed"],
      command_type: ["F", "B", "S", "DUMP", "GOTO", "RETURN"],
      truck_mode: ["auto", "manual"],
      truck_run_state: ["idle", "moving", "dumping", "returning", "full"],
    },
  },
} as const
