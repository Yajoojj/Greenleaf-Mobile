// Gerado pelo plugin do Supabase (generate_typescript_types) a partir do projeto greenleaf-app.
// Não edite à mão: rode a geração de novo depois de cada migração.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          class_probabilities: Json | null
          created_at: string
          hsv_probability: number
          id: string
          image_path: string
          model_probability: number | null
          model_version: string | null
          other_disease: string | null
          overlay_path: string
          probability: number
          processing_time_ms: number
          ratio: number
          severity: string | null
          source: string
          state: string
          user_id: string
        }
        Insert: {
          class_probabilities?: Json | null
          created_at?: string
          hsv_probability: number
          id: string
          image_path: string
          model_probability?: number | null
          model_version?: string | null
          other_disease?: string | null
          overlay_path: string
          probability: number
          processing_time_ms: number
          ratio: number
          severity?: string | null
          source: string
          state: string
          user_id: string
        }
        Update: {
          class_probabilities?: Json | null
          created_at?: string
          hsv_probability?: number
          id?: string
          image_path?: string
          model_probability?: number | null
          model_version?: string | null
          other_disease?: string | null
          overlay_path?: string
          probability?: number
          processing_time_ms?: number
          ratio?: number
          severity?: string | null
          source?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          app_version: string | null
          contact_email: string | null
          created_at: string
          id: string
          message: string
          rating: number | null
          topic: string
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          message: string
          rating?: number | null
          topic: string
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          message?: string
          rating?: number | null
          topic?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          analysis_id: string
          consent: boolean
          created_at: string
          latitude: number
          longitude: number
        }
        Insert: {
          analysis_id: string
          consent: boolean
          created_at?: string
          latitude: number
          longitude: number
        }
        Update: {
          analysis_id?: string
          consent?: boolean
          created_at?: string
          latitude?: number
          longitude?: number
        }
        Relationships: [
          {
            foreignKeyName: "locations_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      heatmap_cells: {
        Args: never
        Returns: {
          infected: number
          latitude: number
          longitude: number
          total: number
        }[]
      }
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
