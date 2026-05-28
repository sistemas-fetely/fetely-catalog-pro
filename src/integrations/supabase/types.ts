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
      photos: {
        Row: {
          colecao: string
          cor: string | null
          created_at: string
          id: string
          kind: string
          path: string
          updated_at: string
          url: string
        }
        Insert: {
          colecao: string
          cor?: string | null
          created_at?: string
          id?: string
          kind: string
          path: string
          updated_at?: string
          url: string
        }
        Update: {
          colecao?: string
          cor?: string | null
          created_at?: string
          id?: string
          kind?: string
          path?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          altura_cm: number
          categoria: string
          cest: string | null
          cod_cadastro: string | null
          colecao: string
          cor: string | null
          cor_nome: string | null
          created_at: string
          departamento: string | null
          descricao_colecao: string | null
          descricao_produto: string | null
          ean: string | null
          estampa: string | null
          familia: string | null
          grupo: string
          id: string
          is_vela_numerica: boolean
          largura_cm: number
          linha: string | null
          marca: string
          material: string | null
          material_descritivo: string | null
          meta_descricao: string | null
          multiplos: number
          ncm: string | null
          nome_comercial: string
          nome_completo: string | null
          numero_vela: number | null
          origem_fisc: string | null
          origem_prod: string | null
          peso_g: number
          preco_atacado: number
          preco_varejo: number
          profundidade_cm: number | null
          qtd_kit: number
          sku: string
          status_estoque: string
          sub_colecao: string | null
          sub_colecao2: string | null
          tamanho_numero: string | null
          tamanho_ref: string | null
          tipo: string | null
          tipo_embalagem: string | null
          updated_at: string
        }
        Insert: {
          altura_cm?: number
          categoria: string
          cest?: string | null
          cod_cadastro?: string | null
          colecao: string
          cor?: string | null
          cor_nome?: string | null
          created_at?: string
          departamento?: string | null
          descricao_colecao?: string | null
          descricao_produto?: string | null
          ean?: string | null
          estampa?: string | null
          familia?: string | null
          grupo: string
          id?: string
          is_vela_numerica?: boolean
          largura_cm?: number
          linha?: string | null
          marca?: string
          material?: string | null
          material_descritivo?: string | null
          meta_descricao?: string | null
          multiplos?: number
          ncm?: string | null
          nome_comercial: string
          nome_completo?: string | null
          numero_vela?: number | null
          origem_fisc?: string | null
          origem_prod?: string | null
          peso_g?: number
          preco_atacado?: number
          preco_varejo?: number
          profundidade_cm?: number | null
          qtd_kit?: number
          sku: string
          status_estoque?: string
          sub_colecao?: string | null
          sub_colecao2?: string | null
          tamanho_numero?: string | null
          tamanho_ref?: string | null
          tipo?: string | null
          tipo_embalagem?: string | null
          updated_at?: string
        }
        Update: {
          altura_cm?: number
          categoria?: string
          cest?: string | null
          cod_cadastro?: string | null
          colecao?: string
          cor?: string | null
          cor_nome?: string | null
          created_at?: string
          departamento?: string | null
          descricao_colecao?: string | null
          descricao_produto?: string | null
          ean?: string | null
          estampa?: string | null
          familia?: string | null
          grupo?: string
          id?: string
          is_vela_numerica?: boolean
          largura_cm?: number
          linha?: string | null
          marca?: string
          material?: string | null
          material_descritivo?: string | null
          meta_descricao?: string | null
          multiplos?: number
          ncm?: string | null
          nome_comercial?: string
          nome_completo?: string | null
          numero_vela?: number | null
          origem_fisc?: string | null
          origem_prod?: string | null
          peso_g?: number
          preco_atacado?: number
          preco_varejo?: number
          profundidade_cm?: number | null
          qtd_kit?: number
          sku?: string
          status_estoque?: string
          sub_colecao?: string | null
          sub_colecao2?: string | null
          tamanho_numero?: string | null
          tamanho_ref?: string | null
          tipo?: string | null
          tipo_embalagem?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          cargo: string | null
          cnpj_cpf: string | null
          codigo_vendedor: string | null
          comissao_percent: number | null
          created_at: string
          email: string
          empresa: string | null
          id: string
          login_amigavel: string | null
          nome_completo: string | null
          observacoes: string | null
          regiao: string | null
          supervisor: string | null
          telefone: string | null
          tipo_vendedor: Database["public"]["Enums"]["tipo_vendedor"] | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          cnpj_cpf?: string | null
          codigo_vendedor?: string | null
          comissao_percent?: number | null
          created_at?: string
          email: string
          empresa?: string | null
          id: string
          login_amigavel?: string | null
          nome_completo?: string | null
          observacoes?: string | null
          regiao?: string | null
          supervisor?: string | null
          telefone?: string | null
          tipo_vendedor?: Database["public"]["Enums"]["tipo_vendedor"] | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          cnpj_cpf?: string | null
          codigo_vendedor?: string | null
          comissao_percent?: number | null
          created_at?: string
          email?: string
          empresa?: string | null
          id?: string
          login_amigavel?: string | null
          nome_completo?: string | null
          observacoes?: string | null
          regiao?: string | null
          supervisor?: string | null
          telefone?: string | null
          tipo_vendedor?: Database["public"]["Enums"]["tipo_vendedor"] | null
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
      is_admin_or_master: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "master" | "admin" | "vendedor"
      tipo_vendedor: "interno" | "representante"
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
      app_role: ["master", "admin", "vendedor"],
      tipo_vendedor: ["interno", "representante"],
    },
  },
} as const
