export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type HighlightColor = 'yellow' | 'red' | 'green' | 'lightBlue' | 'lightPurple';

export interface Database {
  public: {
    Tables: {
      highlights: {
        Row: {
          id: string
          user_id: string
          url: string
          text: string
          xpath: string
          start_offset: number
          end_offset: number
          before_context: string
          after_context: string
          comment: string | null
          tags: string[] | null
          color: HighlightColor | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id: string
          url: string
          text: string
          xpath: string
          start_offset: number
          end_offset: number
          before_context: string
          after_context: string
          comment?: string | null
          tags?: string[] | null
          color?: HighlightColor | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          url?: string
          text?: string
          xpath?: string
          start_offset?: number
          end_offset?: number
          before_context?: string
          after_context?: string
          comment?: string | null
          tags?: string[] | null
          color?: HighlightColor | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlights_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      sync_metadata: {
        Row: {
          id: string
          user_id: string
          device_id: string
          last_sync_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_id: string
          last_sync_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_id?: string
          last_sync_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_metadata_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      highlight_color: 'yellow' | 'red' | 'green' | 'lightBlue' | 'lightPurple'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
