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
      clientes: {
        Row: {
          ativo: boolean
          atualizado_em: string
          bairro: string | null
          cadastrado_por_vendedor_id: string
          cadastrado_por_vendedor_nome: string
          canal: string
          cep: string | null
          cidade: string | null
          cnpj: string
          cnpj_formatado: string
          complemento: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          contato_whatsapp: string | null
          criado_em: string
          endereco_entrega_igual: boolean
          entrega_bairro: string | null
          entrega_cep: string | null
          entrega_cidade: string | null
          entrega_complemento: string | null
          entrega_estado: string | null
          entrega_logradouro: string | null
          entrega_numero: string | null
          estado: string | null
          financeiro_email: string | null
          financeiro_nome: string | null
          financeiro_telefone: string | null
          id: string
          inscricao_estadual: string | null
          isento_ie: boolean
          logradouro: string | null
          nome_fantasia: string
          numero: string | null
          observacoes: string | null
          premissas_ativas: boolean
          premissas_comerciais: Json | null
          premissas_vigencia_fim: string | null
          premissas_vigencia_inicio: string | null
          razao_social: string
          regiao_atuacao: string | null
          segmento: string
          situacao_cadastral: string
          sncf_bandeira: string | null
          sncf_cooldown_ate: string | null
          sncf_limite_credito: number | null
          sncf_limite_disponivel: number | null
          sncf_parceiro_id: string | null
          sncf_perfil_credito: string | null
          sncf_ultima_sync_em: string | null
          tags: string[]
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          bairro?: string | null
          cadastrado_por_vendedor_id: string
          cadastrado_por_vendedor_nome: string
          canal?: string
          cep?: string | null
          cidade?: string | null
          cnpj: string
          cnpj_formatado: string
          complemento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          contato_whatsapp?: string | null
          criado_em?: string
          endereco_entrega_igual?: boolean
          entrega_bairro?: string | null
          entrega_cep?: string | null
          entrega_cidade?: string | null
          entrega_complemento?: string | null
          entrega_estado?: string | null
          entrega_logradouro?: string | null
          entrega_numero?: string | null
          estado?: string | null
          financeiro_email?: string | null
          financeiro_nome?: string | null
          financeiro_telefone?: string | null
          id?: string
          inscricao_estadual?: string | null
          isento_ie?: boolean
          logradouro?: string | null
          nome_fantasia: string
          numero?: string | null
          observacoes?: string | null
          premissas_ativas?: boolean
          premissas_comerciais?: Json | null
          premissas_vigencia_fim?: string | null
          premissas_vigencia_inicio?: string | null
          razao_social: string
          regiao_atuacao?: string | null
          segmento?: string
          situacao_cadastral?: string
          sncf_bandeira?: string | null
          sncf_cooldown_ate?: string | null
          sncf_limite_credito?: number | null
          sncf_limite_disponivel?: number | null
          sncf_parceiro_id?: string | null
          sncf_perfil_credito?: string | null
          sncf_ultima_sync_em?: string | null
          tags?: string[]
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          bairro?: string | null
          cadastrado_por_vendedor_id?: string
          cadastrado_por_vendedor_nome?: string
          canal?: string
          cep?: string | null
          cidade?: string | null
          cnpj?: string
          cnpj_formatado?: string
          complemento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          contato_whatsapp?: string | null
          criado_em?: string
          endereco_entrega_igual?: boolean
          entrega_bairro?: string | null
          entrega_cep?: string | null
          entrega_cidade?: string | null
          entrega_complemento?: string | null
          entrega_estado?: string | null
          entrega_logradouro?: string | null
          entrega_numero?: string | null
          estado?: string | null
          financeiro_email?: string | null
          financeiro_nome?: string | null
          financeiro_telefone?: string | null
          id?: string
          inscricao_estadual?: string | null
          isento_ie?: boolean
          logradouro?: string | null
          nome_fantasia?: string
          numero?: string | null
          observacoes?: string | null
          premissas_ativas?: boolean
          premissas_comerciais?: Json | null
          premissas_vigencia_fim?: string | null
          premissas_vigencia_inicio?: string | null
          razao_social?: string
          regiao_atuacao?: string | null
          segmento?: string
          situacao_cadastral?: string
          sncf_bandeira?: string | null
          sncf_cooldown_ate?: string | null
          sncf_limite_credito?: number | null
          sncf_limite_disponivel?: number | null
          sncf_parceiro_id?: string | null
          sncf_perfil_credito?: string | null
          sncf_ultima_sync_em?: string | null
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "clientes_cadastrado_por_vendedor_id_fkey"
            columns: ["cadastrado_por_vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          base_calculo: Json | null
          created_at: string
          id: string
          order_id: string
          pago_em: string | null
          percentual_aplicado: number
          sncf_calculado_em: string
          status: string
          valor_comissao: number
          valor_pedido: number
          vendedor_id: string
        }
        Insert: {
          base_calculo?: Json | null
          created_at?: string
          id?: string
          order_id: string
          pago_em?: string | null
          percentual_aplicado: number
          sncf_calculado_em: string
          status?: string
          valor_comissao: number
          valor_pedido: number
          vendedor_id: string
        }
        Update: {
          base_calculo?: Json | null
          created_at?: string
          id?: string
          order_id?: string
          pago_em?: string | null
          percentual_aplicado?: number
          sncf_calculado_em?: string
          status?: string
          valor_comissao?: number
          valor_pedido?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          posicao: number
          preco_unit_atacado: number
          product_snapshot: Json
          quantity: number
          sku: string
          subtotal_bruto: number
        }
        Insert: {
          id?: string
          order_id: string
          posicao: number
          preco_unit_atacado: number
          product_snapshot: Json
          quantity: number
          sku: string
          subtotal_bruto: number
        }
        Update: {
          id?: string
          order_id?: string
          posicao?: number
          preco_unit_atacado?: number
          product_snapshot?: Json
          quantity?: number
          sku?: string
          subtotal_bruto?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cliente_id: string | null
          cliente_snapshot: Json | null
          commercial: Json | null
          created_at: string
          id: string
          meta: Json
          provisao_origem_id: string | null
          sncf_enviado_em: string | null
          sncf_estagio: string | null
          sncf_pedido_id: string | null
          sncf_status_sync: string
          sncf_tentativas: number
          sncf_ultimo_erro: string | null
          sncf_ultimo_sync_em: string | null
          total: number
          total_skus: number
          total_unidades: number
          vendedor_id: string
          vendedor_login: string | null
          vendedor_nome: string
          vendedor_tipo: string | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          commercial?: Json | null
          created_at?: string
          id: string
          meta: Json
          provisao_origem_id?: string | null
          sncf_enviado_em?: string | null
          sncf_estagio?: string | null
          sncf_pedido_id?: string | null
          sncf_status_sync?: string
          sncf_tentativas?: number
          sncf_ultimo_erro?: string | null
          sncf_ultimo_sync_em?: string | null
          total: number
          total_skus?: number
          total_unidades?: number
          vendedor_id: string
          vendedor_login?: string | null
          vendedor_nome: string
          vendedor_tipo?: string | null
        }
        Update: {
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          commercial?: Json | null
          created_at?: string
          id?: string
          meta?: Json
          provisao_origem_id?: string | null
          sncf_enviado_em?: string | null
          sncf_estagio?: string | null
          sncf_pedido_id?: string | null
          sncf_status_sync?: string
          sncf_tentativas?: number
          sncf_ultimo_erro?: string | null
          sncf_ultimo_sync_em?: string | null
          total?: number
          total_skus?: number
          total_unidades?: number
          vendedor_id?: string
          vendedor_login?: string | null
          vendedor_nome?: string
          vendedor_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_provisao_origem"
            columns: ["provisao_origem_id"]
            isOneToOne: false
            referencedRelation: "provisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          cliente_id: string | null
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
          cliente_id?: string | null
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
          cliente_id?: string | null
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
      provisao_itens: {
        Row: {
          colecao: string | null
          cor_nome: string | null
          id: string
          nome_comercial: string
          preco_atacado_referencia: number
          previsao_data: string | null
          provisao_id: string
          quantidade: number
          sku: string
          status_estoque: string | null
          tamanho_numero: string | null
        }
        Insert: {
          colecao?: string | null
          cor_nome?: string | null
          id?: string
          nome_comercial: string
          preco_atacado_referencia: number
          previsao_data?: string | null
          provisao_id: string
          quantidade: number
          sku: string
          status_estoque?: string | null
          tamanho_numero?: string | null
        }
        Update: {
          colecao?: string | null
          cor_nome?: string | null
          id?: string
          nome_comercial?: string
          preco_atacado_referencia?: number
          previsao_data?: string | null
          provisao_id?: string
          quantidade?: number
          sku?: string
          status_estoque?: string | null
          tamanho_numero?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provisao_itens_provisao_id_fkey"
            columns: ["provisao_id"]
            isOneToOne: false
            referencedRelation: "provisoes"
            referencedColumns: ["id"]
          },
        ]
      }
      provisoes: {
        Row: {
          atualizado_em: string
          cliente_id: string
          cliente_snapshot: Json
          criado_em: string
          datas_previsao: Json
          id: string
          observacoes: string | null
          pedido_convertido_id: string | null
          pedido_firme_id: string | null
          proxima_previsao: string
          status: string
          total_referencia: number
          vendedor_id: string
          vendedor_nome: string
        }
        Insert: {
          atualizado_em?: string
          cliente_id: string
          cliente_snapshot: Json
          criado_em?: string
          datas_previsao?: Json
          id: string
          observacoes?: string | null
          pedido_convertido_id?: string | null
          pedido_firme_id?: string | null
          proxima_previsao: string
          status?: string
          total_referencia?: number
          vendedor_id: string
          vendedor_nome: string
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string
          cliente_snapshot?: Json
          criado_em?: string
          datas_previsao?: Json
          id?: string
          observacoes?: string | null
          pedido_convertido_id?: string | null
          pedido_firme_id?: string | null
          proxima_previsao?: string
          status?: string
          total_referencia?: number
          vendedor_id?: string
          vendedor_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "provisoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisoes_pedido_convertido_id_fkey"
            columns: ["pedido_convertido_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisoes_pedido_firme_id_fkey"
            columns: ["pedido_firme_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      is_admin_or_master: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "master" | "admin" | "vendedor" | "cliente"
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
      app_role: ["master", "admin", "vendedor", "cliente"],
      tipo_vendedor: ["interno", "representante"],
    },
  },
} as const
