export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      card_progress: {
        Row: {
          card_id: number | null
          created_at: string | null
          due_date: string | null
          ease_factor: number
          fsrs_state: Json | null
          id: number
          interval: number
          last_reviewed: string | null
          repetitions: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          card_id?: number | null
          created_at?: string | null
          due_date?: string | null
          ease_factor?: number
          fsrs_state?: Json | null
          id?: number
          interval?: number
          last_reviewed?: string | null
          repetitions?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          card_id?: number | null
          created_at?: string | null
          due_date?: string | null
          ease_factor?: number
          fsrs_state?: Json | null
          id?: number
          interval?: number
          last_reviewed?: string | null
          repetitions?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_progress_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          back: string
          created_at: string | null
          deck_id: number | null
          front: string
          id: number
          front_img_url: string | null
          back_img_url: string | null
          updated_at: string | null
          user_id: string | null
          exclude_from_srs: boolean
          tag: string | null
        }
        Insert: {
          back: string
          created_at?: string | null
          deck_id?: number | null
          front: string
          id?: number
          front_img_url?: string | null
          back_img_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          exclude_from_srs?: boolean
          tag?: string | null
        }
        Update: {
          back?: string
          created_at?: string | null
          deck_id?: number | null
          front?: string
          id?: number
          front_img_url?: string | null
          back_img_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          exclude_from_srs?: boolean
          tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          card_count: number | null
          created_at: string | null
          description: string | null
          id: number
          last_studied: string | null
          name: string
          tag: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          card_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          last_studied?: string | null
          name: string
          tag?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          card_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          last_studied?: string | null
          name?: string
          tag?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      folders: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          user_id: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          user_id: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          user_id?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      notes: {
        Row: {
          id: string
          title: string | null
          content: string | null
          user_id: string
          created_at: string
          updated_at: string | null
          category: string | null
          project: string | null
          folder_id: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          enable_animations: boolean
          enable_sounds: boolean
          id: string
          study_settings: Json
          theme: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enable_animations?: boolean
          enable_sounds?: boolean
          id?: string
          study_settings?: Json
          theme?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enable_animations?: boolean
          enable_sounds?: boolean
          id?: string
          study_settings?: Json
          theme?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      agent_conversations: {
        Row: {
          id: string;
          session_id: string;
          user_id: string | null;
          title: string | null;
          messages: {
            role: "user" | "assistant";
            content: string;
            created_at: string;
          }[];
          agent_type: string | null;
          status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id?: string;
          user_id?: string | null;
          title?: string | null;
          messages?: {
            role: "user" | "assistant";
            content: string;
            created_at: string;
          }[];
          agent_type?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string | null;
          title?: string | null;
          messages?: {
            role: "user" | "assistant";
            content: string;
            created_at: string;
          }[];
          agent_type?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      },
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
  | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
  | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
  | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
