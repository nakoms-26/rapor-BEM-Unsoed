export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          nim: string;
          nama_lengkap: string;
          jurusan: string | null;
          tahun_angkatan: number | null;
          unit_id: string;
          role: "admin" | "menko" | "user" | "pres_wapres" | "menteri" | "staff";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          nim: string;
          nama_lengkap: string;
          jurusan?: string | null;
          tahun_angkatan?: number | null;
          unit_id: string;
          role?: "admin" | "menko" | "user" | "pres_wapres" | "menteri" | "staff";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      app_accounts: {
        Row: {
          nim: string;
          password_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          nim: string;
          password_hash: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_accounts"]["Insert"]>;
      };
      app_sessions: {
        Row: {
          id: string;
          session_token: string;
          nim: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_token: string;
          nim: string;
          expires_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_sessions"]["Insert"]>;
      };
      ref_units: {
        Row: {
          id: string;
          nama_unit: string;
          kategori: "kemenko" | "kementerian" | "biro";
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nama_unit: string;
          kategori: "kemenko" | "kementerian" | "biro";
          parent_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ref_units"]["Insert"]>;
      };
      rapor_periods: {
        Row: {
          id: string;
          bulan: number;
          tahun: number;
          status: "draft" | "published";
          created_at: string;
        };
        Insert: {
          id?: string;
          bulan: number;
          tahun: number;
          status?: "draft" | "published";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rapor_periods"]["Insert"]>;
      };
      rapor_scores: {
        Row: {
          id: string;
          user_nim: string;
          periode_id: string;
          penilai_nim: string;
          report_type: "staf_unit" | "menteri_kepala_biro";
          total_avg: number;
          catatan: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_nim: string;
          periode_id: string;
          penilai_nim: string;
          report_type?: "staf_unit" | "menteri_kepala_biro";
          total_avg?: number;
          catatan?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rapor_scores"]["Insert"]>;
      };
      evaluator_unit_assignments: {
        Row: {
          id: string;
          evaluator_nim: string;
          target_unit_id: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          evaluator_nim: string;
          target_unit_id: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["evaluator_unit_assignments"]["Insert"]>;
      };
      rapor_details: {
        Row: {
          id: string;
          rapor_id: string;
          main_indicator_name: string;
          sub_indicator_name: string;
          score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          rapor_id: string;
          main_indicator_name: string;
          sub_indicator_name: string;
          score: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rapor_details"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: "admin" | "menko" | "user" | "pres_wapres" | "menteri" | "staff";
      unit_kategori: "kemenko" | "kementerian" | "biro";
      period_status: "draft" | "published";
      rapor_type: "staf_unit" | "menteri_kepala_biro";
    };
    CompositeTypes: Record<string, never>;
  };
};
