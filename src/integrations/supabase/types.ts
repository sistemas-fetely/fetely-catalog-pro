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
      access_logs: {
        Row: {
          ator_email: string | null
          ator_id: string | null
          cliente_id: string | null
          created_at: string
          descricao: string | null
          email: string | null
          evento: string
          id: string
          metadata: Json | null
          nome: string | null
          tipo_usuario: string | null
          user_id: string | null
        }
        Insert: {
          ator_email?: string | null
          ator_id?: string | null
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          email?: string | null
          evento: string
          id?: string
          metadata?: Json | null
          nome?: string | null
          tipo_usuario?: string | null
          user_id?: string | null
        }
        Update: {
          ator_email?: string | null
          ator_id?: string | null
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          email?: string | null
          evento?: string
          id?: string
          metadata?: Json | null
          nome?: string | null
          tipo_usuario?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cartilhas_audit: {
        Row: {
          acao: Database["public"]["Enums"]["cartilha_acao"]
          campos_alterados: Json | null
          criado_em: string
          entidade: Database["public"]["Enums"]["cartilha_entidade"]
          entidade_id: string
          entidade_nome: string
          id: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          acao: Database["public"]["Enums"]["cartilha_acao"]
          campos_alterados?: Json | null
          criado_em?: string
          entidade: Database["public"]["Enums"]["cartilha_entidade"]
          entidade_id: string
          entidade_nome: string
          id?: string
          usuario_id?: string | null
          usuario_nome: string
        }
        Update: {
          acao?: Database["public"]["Enums"]["cartilha_acao"]
          campos_alterados?: Json | null
          criado_em?: string
          entidade?: Database["public"]["Enums"]["cartilha_entidade"]
          entidade_id?: string
          entidade_nome?: string
          id?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartilhas_audit_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_audit: {
        Row: {
          acao: Database["public"]["Enums"]["catalog_acao"]
          campos_alterados: Json | null
          criado_em: string
          id: string
          produto_nome: string
          produto_sku: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          acao: Database["public"]["Enums"]["catalog_acao"]
          campos_alterados?: Json | null
          criado_em?: string
          id?: string
          produto_nome: string
          produto_sku: string
          usuario_id?: string | null
          usuario_nome: string
        }
        Update: {
          acao?: Database["public"]["Enums"]["catalog_acao"]
          campos_alterados?: Json | null
          criado_em?: string
          id?: string
          produto_nome?: string
          produto_sku?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_audit_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_migracao_solicitacoes: {
        Row: {
          cliente_id: string | null
          cnpj: string
          criado_em: string
          id: string
          justificativa: string | null
          owner_anterior_id: string | null
          owner_anterior_nome: string | null
          razao_social: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          resposta: string | null
          solicitante_id: string
          solicitante_nome: string | null
          status: string
        }
        Insert: {
          cliente_id?: string | null
          cnpj: string
          criado_em?: string
          id?: string
          justificativa?: string | null
          owner_anterior_id?: string | null
          owner_anterior_nome?: string | null
          razao_social?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          resposta?: string | null
          solicitante_id: string
          solicitante_nome?: string | null
          status?: string
        }
        Update: {
          cliente_id?: string | null
          cnpj?: string
          criado_em?: string
          id?: string
          justificativa?: string | null
          owner_anterior_id?: string | null
          owner_anterior_nome?: string | null
          razao_social?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          resposta?: string | null
          solicitante_id?: string
          solicitante_nome?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_migracao_solicitacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
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
          documento_numero: string | null
          documento_tipo: string | null
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
          is_internacional: boolean
          isento_ie: boolean
          logradouro: string | null
          nome_fantasia: string
          numero: string | null
          observacoes: string | null
          pais: string | null
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
          telefones_internacionais: boolean
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
          documento_numero?: string | null
          documento_tipo?: string | null
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
          is_internacional?: boolean
          isento_ie?: boolean
          logradouro?: string | null
          nome_fantasia: string
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
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
          telefones_internacionais?: boolean
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
          documento_numero?: string | null
          documento_tipo?: string | null
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
          is_internacional?: boolean
          isento_ie?: boolean
          logradouro?: string | null
          nome_fantasia?: string
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
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
          telefones_internacionais?: boolean
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
      condicoes_pagamento: {
        Row: {
          ativa: boolean
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          descricao: string
          destaque: boolean
          dias_parcelas: number[] | null
          exibir_para_vendedor: boolean
          id: number
          numero_parcelas: number | null
          ordem: number
          sem_juros: boolean
          tem_bonus_pix: boolean
          tipo: Database["public"]["Enums"]["tipo_condicao_pagamento"]
          valor_minimo: number
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          descricao: string
          destaque?: boolean
          dias_parcelas?: number[] | null
          exibir_para_vendedor?: boolean
          id: number
          numero_parcelas?: number | null
          ordem?: number
          sem_juros?: boolean
          tem_bonus_pix?: boolean
          tipo: Database["public"]["Enums"]["tipo_condicao_pagamento"]
          valor_minimo?: number
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          destaque?: boolean
          dias_parcelas?: number[] | null
          exibir_para_vendedor?: boolean
          id?: number
          numero_parcelas?: number | null
          ordem?: number
          sem_juros?: boolean
          tem_bonus_pix?: boolean
          tipo?: Database["public"]["Enums"]["tipo_condicao_pagamento"]
          valor_minimo?: number
        }
        Relationships: []
      }
      cotacoes: {
        Row: {
          atualizado_em: string
          cliente_id: string | null
          commercial: Json | null
          criado_em: string
          id: string
          items: Json
          meta: Json
          motivo_perda: string | null
          motivo_perda_obs: string | null
          pedido_convertido_id: string | null
          status: string
          total: number
          valido_ate: string
          vendedor_id: string
          vendedor_login: string | null
          vendedor_nome: string
        }
        Insert: {
          atualizado_em?: string
          cliente_id?: string | null
          commercial?: Json | null
          criado_em?: string
          id: string
          items?: Json
          meta?: Json
          motivo_perda?: string | null
          motivo_perda_obs?: string | null
          pedido_convertido_id?: string | null
          status?: string
          total?: number
          valido_ate: string
          vendedor_id: string
          vendedor_login?: string | null
          vendedor_nome: string
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string | null
          commercial?: Json | null
          criado_em?: string
          id?: string
          items?: Json
          meta?: Json
          motivo_perda?: string | null
          motivo_perda_obs?: string | null
          pedido_convertido_id?: string | null
          status?: string
          total?: number
          valido_ate?: string
          vendedor_id?: string
          vendedor_login?: string | null
          vendedor_nome?: string
        }
        Relationships: []
      }
      evento_catalogo: {
        Row: {
          campos_preenchidos: Json | null
          criado_em: string
          id: string
          itens_parcial: number | null
          sessao_id: string
          tipo: string
          valor_parcial: number | null
        }
        Insert: {
          campos_preenchidos?: Json | null
          criado_em?: string
          id?: string
          itens_parcial?: number | null
          sessao_id: string
          tipo: string
          valor_parcial?: number | null
        }
        Update: {
          campos_preenchidos?: Json | null
          criado_em?: string
          id?: string
          itens_parcial?: number | null
          sessao_id?: string
          tipo?: string
          valor_parcial?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_catalogo_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessao_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_catalogo_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessao_catalogo_estado"
            referencedColumns: ["id"]
          },
        ]
      }
      faixas: {
        Row: {
          ativa: boolean
          atualizado_em: string
          atualizado_por: string | null
          boleto_ate: string
          bonus_pix: number
          bonus_pix_aplicavel: boolean
          cartao_ate: string
          condicoes_disponiveis: number[]
          cor: string | null
          criado_em: string
          criado_por: string | null
          desconto_celebra: number
          descricao: string | null
          frete: Database["public"]["Enums"]["tipo_frete"]
          frete_observacao: string | null
          icone: string | null
          id: number
          nome: string
          ordem: number
          prazo_medio_boleto: number
          requer_senha_master: boolean
          total_com_pix: number
          valor_max: number | null
          valor_min: number
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          boleto_ate?: string
          bonus_pix?: number
          bonus_pix_aplicavel?: boolean
          cartao_ate?: string
          condicoes_disponiveis?: number[]
          cor?: string | null
          criado_em?: string
          criado_por?: string | null
          desconto_celebra: number
          descricao?: string | null
          frete: Database["public"]["Enums"]["tipo_frete"]
          frete_observacao?: string | null
          icone?: string | null
          id: number
          nome: string
          ordem?: number
          prazo_medio_boleto?: number
          requer_senha_master?: boolean
          total_com_pix: number
          valor_max?: number | null
          valor_min: number
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          boleto_ate?: string
          bonus_pix?: number
          bonus_pix_aplicavel?: boolean
          cartao_ate?: string
          condicoes_disponiveis?: number[]
          cor?: string | null
          criado_em?: string
          criado_por?: string | null
          desconto_celebra?: number
          descricao?: string | null
          frete?: Database["public"]["Enums"]["tipo_frete"]
          frete_observacao?: string | null
          icone?: string | null
          id?: number
          nome?: string
          ordem?: number
          prazo_medio_boleto?: number
          requer_senha_master?: boolean
          total_com_pix?: number
          valor_max?: number | null
          valor_min?: number
        }
        Relationships: []
      }
      faq_conhecimento: {
        Row: {
          ativo: boolean
          atualizado_em: string
          conteudo: string
          criado_em: string
          id: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          conteudo: string
          criado_em?: string
          id?: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          conteudo?: string
          criado_em?: string
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      faq_pergunta: {
        Row: {
          criado_em: string
          encontrou_resposta: boolean
          fontes: Json
          id: string
          pergunta: string
          resposta: string | null
          user_id: string | null
        }
        Insert: {
          criado_em?: string
          encontrou_resposta?: boolean
          fontes?: Json
          id?: string
          pergunta: string
          resposta?: string | null
          user_id?: string | null
        }
        Update: {
          criado_em?: string
          encontrou_resposta?: boolean
          fontes?: Json
          id?: string
          pergunta?: string
          resposta?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          descricao: string | null
          enabled: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          descricao?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          descricao?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      frete_uf: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          percentual: number
          uf: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          percentual?: number
          uf: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          percentual?: number
          uf?: string
        }
        Relationships: []
      }
      grupos_clientes: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cliente_ids: string[]
          cor: string
          criado_em: string
          criado_por_vendedor_id: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cliente_ids?: string[]
          cor?: string
          criado_em?: string
          criado_por_vendedor_id: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cliente_ids?: string[]
          cor?: string
          criado_em?: string
          criado_por_vendedor_id?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      kb_chunk: {
        Row: {
          atualizado_em: string
          aula_id: string | null
          bloco_id: string | null
          embedding: string | null
          id: string
          modulo_id: string | null
          origem_tipo: string
          texto: string
          timestamp_video: string | null
        }
        Insert: {
          atualizado_em?: string
          aula_id?: string | null
          bloco_id?: string | null
          embedding?: string | null
          id?: string
          modulo_id?: string | null
          origem_tipo: string
          texto: string
          timestamp_video?: string | null
        }
        Update: {
          atualizado_em?: string
          aula_id?: string | null
          bloco_id?: string | null
          embedding?: string | null
          id?: string
          modulo_id?: string | null
          origem_tipo?: string
          texto?: string
          timestamp_video?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunk_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "treinamento_aula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_chunk_bloco_id_fkey"
            columns: ["bloco_id"]
            isOneToOne: false
            referencedRelation: "treinamento_bloco"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_chunk_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "treinamento_modulo"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_form_rascunho: {
        Row: {
          atualizado_em: string
          campos_preenchidos: number
          criado_em: string
          dados: Json
          enviado: boolean
          id: string
          lead_id: string | null
          sessao_id: string
          user_agent: string | null
        }
        Insert: {
          atualizado_em?: string
          campos_preenchidos?: number
          criado_em?: string
          dados?: Json
          enviado?: boolean
          id?: string
          lead_id?: string | null
          sessao_id: string
          user_agent?: string | null
        }
        Update: {
          atualizado_em?: string
          campos_preenchidos?: number
          criado_em?: string
          dados?: Json
          enviado?: boolean
          id?: string
          lead_id?: string | null
          sessao_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_form_rascunho_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_qualificados"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_grupos_campanha: {
        Row: {
          criado_em: string
          criado_por_id: string | null
          criado_por_nome: string | null
          filtros: Json
          id: string
          nome: string
        }
        Insert: {
          criado_em?: string
          criado_por_id?: string | null
          criado_por_nome?: string | null
          filtros?: Json
          id?: string
          nome: string
        }
        Update: {
          criado_em?: string
          criado_por_id?: string | null
          criado_por_nome?: string | null
          filtros?: Json
          id?: string
          nome?: string
        }
        Relationships: []
      }
      lead_historico: {
        Row: {
          criado_em: string
          descricao: string
          id: string
          lead_id: string
          usuario_id: string | null
          usuario_nome: string
        }
        Insert: {
          criado_em?: string
          descricao: string
          id?: string
          lead_id: string
          usuario_id?: string | null
          usuario_nome: string
        }
        Update: {
          criado_em?: string
          descricao?: string
          id?: string
          lead_id?: string
          usuario_id?: string | null
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_qualificados"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_mensagens_wpp: {
        Row: {
          atualizado_em: string
          segmento: Database["public"]["Enums"]["lead_segmento"]
          template: string
        }
        Insert: {
          atualizado_em?: string
          segmento: Database["public"]["Enums"]["lead_segmento"]
          template?: string
        }
        Update: {
          atualizado_em?: string
          segmento?: Database["public"]["Enums"]["lead_segmento"]
          template?: string
        }
        Relationships: []
      }
      lead_webhooks: {
        Row: {
          ativo: boolean
          criado_em: string
          evento: string
          id: string
          nome: string
          url: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          evento: string
          id?: string
          nome: string
          url: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          evento?: string
          id?: string
          nome?: string
          url?: string
        }
        Relationships: []
      }
      leads_qualificados: {
        Row: {
          aceite_condicoes: string | null
          atualizado_em: string
          catalogo_liberado: boolean
          cidade: string | null
          cliente_b2b_id: string | null
          cotacao_origem_id: string | null
          criado_em: string
          destaque: string | null
          email: string | null
          frequencia: Database["public"]["Enums"]["lead_frequencia"] | null
          id: string
          instagram: string | null
          intencao_sequencia: string | null
          ip_origem: string | null
          nome: string
          notas_internas: string | null
          observacoes: string | null
          origem: Database["public"]["Enums"]["lead_origem"]
          potencial: Database["public"]["Enums"]["lead_potencial"]
          produtos_interesse: string[]
          responsavel_id: string | null
          responsavel_nome: string | null
          score: number
          segmento: Database["public"]["Enums"]["lead_segmento"]
          status_crm: Database["public"]["Enums"]["lead_status_crm"]
          tags: string[]
          uf: string | null
          urgencia: number | null
          user_agent: string | null
          volume_estimado:
            | Database["public"]["Enums"]["lead_volume_estimado"]
            | null
          whatsapp: string
        }
        Insert: {
          aceite_condicoes?: string | null
          atualizado_em?: string
          catalogo_liberado?: boolean
          cidade?: string | null
          cliente_b2b_id?: string | null
          cotacao_origem_id?: string | null
          criado_em?: string
          destaque?: string | null
          email?: string | null
          frequencia?: Database["public"]["Enums"]["lead_frequencia"] | null
          id?: string
          instagram?: string | null
          intencao_sequencia?: string | null
          ip_origem?: string | null
          nome: string
          notas_internas?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["lead_origem"]
          potencial?: Database["public"]["Enums"]["lead_potencial"]
          produtos_interesse?: string[]
          responsavel_id?: string | null
          responsavel_nome?: string | null
          score?: number
          segmento?: Database["public"]["Enums"]["lead_segmento"]
          status_crm?: Database["public"]["Enums"]["lead_status_crm"]
          tags?: string[]
          uf?: string | null
          urgencia?: number | null
          user_agent?: string | null
          volume_estimado?:
            | Database["public"]["Enums"]["lead_volume_estimado"]
            | null
          whatsapp: string
        }
        Update: {
          aceite_condicoes?: string | null
          atualizado_em?: string
          catalogo_liberado?: boolean
          cidade?: string | null
          cliente_b2b_id?: string | null
          cotacao_origem_id?: string | null
          criado_em?: string
          destaque?: string | null
          email?: string | null
          frequencia?: Database["public"]["Enums"]["lead_frequencia"] | null
          id?: string
          instagram?: string | null
          intencao_sequencia?: string | null
          ip_origem?: string | null
          nome?: string
          notas_internas?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["lead_origem"]
          potencial?: Database["public"]["Enums"]["lead_potencial"]
          produtos_interesse?: string[]
          responsavel_id?: string | null
          responsavel_nome?: string | null
          score?: number
          segmento?: Database["public"]["Enums"]["lead_segmento"]
          status_crm?: Database["public"]["Enums"]["lead_status_crm"]
          tags?: string[]
          uf?: string | null
          urgencia?: number | null
          user_agent?: string | null
          volume_estimado?:
            | Database["public"]["Enums"]["lead_volume_estimado"]
            | null
          whatsapp?: string
        }
        Relationships: []
      }
      link_instance: {
        Row: {
          criado_em: string
          id: string
          lead_contato_id: string | null
          origem_id: string | null
          origem_login: string | null
          origem_tipo: string
          token: string
        }
        Insert: {
          criado_em?: string
          id?: string
          lead_contato_id?: string | null
          origem_id?: string | null
          origem_login?: string | null
          origem_tipo?: string
          token: string
        }
        Update: {
          criado_em?: string
          id?: string
          lead_contato_id?: string | null
          origem_id?: string | null
          origem_login?: string | null
          origem_tipo?: string
          token?: string
        }
        Relationships: []
      }
      meta_mensal: {
        Row: {
          ano: number
          atualizado_em: string
          atualizado_por: string | null
          created_at: string
          id: string
          mes: number
          meta_global: number
        }
        Insert: {
          ano: number
          atualizado_em?: string
          atualizado_por?: string | null
          created_at?: string
          id?: string
          mes: number
          meta_global?: number
        }
        Update: {
          ano?: number
          atualizado_em?: string
          atualizado_por?: string | null
          created_at?: string
          id?: string
          mes?: number
          meta_global?: number
        }
        Relationships: []
      }
      meta_vendedor: {
        Row: {
          ano: number
          atualizado_em: string
          atualizado_por: string | null
          created_at: string
          id: string
          mes: number
          meta: number
          vendedor_id: string
        }
        Insert: {
          ano: number
          atualizado_em?: string
          atualizado_por?: string | null
          created_at?: string
          id?: string
          mes: number
          meta?: number
          vendedor_id: string
        }
        Update: {
          ano?: number
          atualizado_em?: string
          atualizado_por?: string | null
          created_at?: string
          id?: string
          mes?: number
          meta?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_vendedor_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_pedido: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por_vendedor_id: string
          descricao: string | null
          id: string
          itens: Json
          nome: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por_vendedor_id: string
          descricao?: string | null
          id?: string
          itens?: Json
          nome: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por_vendedor_id?: string
          descricao?: string | null
          id?: string
          itens?: Json
          nome?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          desconto_item_pct: number | null
          id: string
          justificativa_negociacao: string | null
          order_id: string
          posicao: number
          preco_unit_atacado: number
          preco_unit_override: number | null
          product_id: string
          product_snapshot: Json
          quantity: number
          sku: string
          subtotal_bruto: number
        }
        Insert: {
          desconto_item_pct?: number | null
          id?: string
          justificativa_negociacao?: string | null
          order_id: string
          posicao: number
          preco_unit_atacado: number
          preco_unit_override?: number | null
          product_id: string
          product_snapshot: Json
          quantity: number
          sku: string
          subtotal_bruto: number
        }
        Update: {
          desconto_item_pct?: number | null
          id?: string
          justificativa_negociacao?: string | null
          order_id?: string
          posicao?: number
          preco_unit_atacado?: number
          preco_unit_override?: number | null
          product_id?: string
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
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          ajuste_mensagem: string | null
          aprovacao_obs: string | null
          aprovado_em: string | null
          aprovado_por_id: string | null
          aprovado_por_nome: string | null
          bonificado: boolean
          cliente_id: string | null
          cliente_snapshot: Json | null
          commercial: Json | null
          created_at: string
          duplicado_de: string | null
          estado_liberacao: string
          forma_pagamento: string | null
          frete: string | null
          grupo_origem_id: string | null
          historico: Json
          id: string
          liberado_em: string | null
          liberado_por: string | null
          meta: Json
          modelo_origem_id: string | null
          motivo_bonificacao: string | null
          origem_perfil: string
          provisao_origem_id: string | null
          recusado_em: string | null
          recusado_motivo: string | null
          recusado_obs: string | null
          recusado_por_id: string | null
          recusado_por_nome: string | null
          reprovado: boolean
          reprovado_em: string | null
          reprovado_motivo: string | null
          reprovado_por_id: string | null
          reprovado_por_nome: string | null
          sncf_enviado_em: string | null
          sncf_estagio: string | null
          sncf_pedido_id: string | null
          sncf_status_sync: string
          sncf_tentativas: number
          sncf_ultimo_erro: string | null
          sncf_ultimo_sync_em: string | null
          status_pedido: string
          tem_negociacao: boolean
          tem_premissa_aplicada: boolean
          tem_solicitacao_ajuste: boolean
          total: number
          total_skus: number
          total_unidades: number
          valor_bruto: number | null
          valor_liquido: number | null
          vendedor_id: string
          vendedor_login: string | null
          vendedor_nome: string
          vendedor_tipo: string | null
        }
        Insert: {
          ajuste_mensagem?: string | null
          aprovacao_obs?: string | null
          aprovado_em?: string | null
          aprovado_por_id?: string | null
          aprovado_por_nome?: string | null
          bonificado?: boolean
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          commercial?: Json | null
          created_at?: string
          duplicado_de?: string | null
          estado_liberacao?: string
          forma_pagamento?: string | null
          frete?: string | null
          grupo_origem_id?: string | null
          historico?: Json
          id: string
          liberado_em?: string | null
          liberado_por?: string | null
          meta: Json
          modelo_origem_id?: string | null
          motivo_bonificacao?: string | null
          origem_perfil?: string
          provisao_origem_id?: string | null
          recusado_em?: string | null
          recusado_motivo?: string | null
          recusado_obs?: string | null
          recusado_por_id?: string | null
          recusado_por_nome?: string | null
          reprovado?: boolean
          reprovado_em?: string | null
          reprovado_motivo?: string | null
          reprovado_por_id?: string | null
          reprovado_por_nome?: string | null
          sncf_enviado_em?: string | null
          sncf_estagio?: string | null
          sncf_pedido_id?: string | null
          sncf_status_sync?: string
          sncf_tentativas?: number
          sncf_ultimo_erro?: string | null
          sncf_ultimo_sync_em?: string | null
          status_pedido?: string
          tem_negociacao?: boolean
          tem_premissa_aplicada?: boolean
          tem_solicitacao_ajuste?: boolean
          total: number
          total_skus?: number
          total_unidades?: number
          valor_bruto?: number | null
          valor_liquido?: number | null
          vendedor_id: string
          vendedor_login?: string | null
          vendedor_nome: string
          vendedor_tipo?: string | null
        }
        Update: {
          ajuste_mensagem?: string | null
          aprovacao_obs?: string | null
          aprovado_em?: string | null
          aprovado_por_id?: string | null
          aprovado_por_nome?: string | null
          bonificado?: boolean
          cliente_id?: string | null
          cliente_snapshot?: Json | null
          commercial?: Json | null
          created_at?: string
          duplicado_de?: string | null
          estado_liberacao?: string
          forma_pagamento?: string | null
          frete?: string | null
          grupo_origem_id?: string | null
          historico?: Json
          id?: string
          liberado_em?: string | null
          liberado_por?: string | null
          meta?: Json
          modelo_origem_id?: string | null
          motivo_bonificacao?: string | null
          origem_perfil?: string
          provisao_origem_id?: string | null
          recusado_em?: string | null
          recusado_motivo?: string | null
          recusado_obs?: string | null
          recusado_por_id?: string | null
          recusado_por_nome?: string | null
          reprovado?: boolean
          reprovado_em?: string | null
          reprovado_motivo?: string | null
          reprovado_por_id?: string | null
          reprovado_por_nome?: string | null
          sncf_enviado_em?: string | null
          sncf_estagio?: string | null
          sncf_pedido_id?: string | null
          sncf_status_sync?: string
          sncf_tentativas?: number
          sncf_ultimo_erro?: string | null
          sncf_ultimo_sync_em?: string | null
          status_pedido?: string
          tem_negociacao?: boolean
          tem_premissa_aplicada?: boolean
          tem_solicitacao_ajuste?: boolean
          total?: number
          total_skus?: number
          total_unidades?: number
          valor_bruto?: number | null
          valor_liquido?: number | null
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
      permissoes_audit: {
        Row: {
          acao: Database["public"]["Enums"]["permissao_acao"]
          admin_id: string | null
          admin_nome: string | null
          alvo_id: string
          alvo_nome: string | null
          alvo_tipo: string
          id: string
          mudanca: string
          tela_id: string
          tela_nome: string | null
          ts: string
          valor_anterior: boolean | null
          valor_novo: boolean | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["permissao_acao"]
          admin_id?: string | null
          admin_nome?: string | null
          alvo_id: string
          alvo_nome?: string | null
          alvo_tipo: string
          id?: string
          mudanca: string
          tela_id: string
          tela_nome?: string | null
          ts?: string
          valor_anterior?: boolean | null
          valor_novo?: boolean | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["permissao_acao"]
          admin_id?: string | null
          admin_nome?: string | null
          alvo_id?: string
          alvo_nome?: string | null
          alvo_tipo?: string
          id?: string
          mudanca?: string
          tela_id?: string
          tela_nome?: string | null
          ts?: string
          valor_anterior?: boolean | null
          valor_novo?: boolean | null
        }
        Relationships: []
      }
      permissoes_grupo_overrides: {
        Row: {
          acao: Database["public"]["Enums"]["permissao_acao"]
          grupo_id: string
          permitido: boolean
          tela_id: string
          updated_at: string
        }
        Insert: {
          acao: Database["public"]["Enums"]["permissao_acao"]
          grupo_id: string
          permitido: boolean
          tela_id: string
          updated_at?: string
        }
        Update: {
          acao?: Database["public"]["Enums"]["permissao_acao"]
          grupo_id?: string
          permitido?: boolean
          tela_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_grupo_overrides_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "permissoes_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_grupos: {
        Row: {
          baseado_em: Database["public"]["Enums"]["app_role"]
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          baseado_em: Database["public"]["Enums"]["app_role"]
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          baseado_em?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissoes_perfis_override: {
        Row: {
          acao: Database["public"]["Enums"]["permissao_acao"]
          perfil: Database["public"]["Enums"]["app_role"]
          permitido: boolean
          tela_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["permissao_acao"]
          perfil: Database["public"]["Enums"]["app_role"]
          permitido: boolean
          tela_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["permissao_acao"]
          perfil?: Database["public"]["Enums"]["app_role"]
          permitido?: boolean
          tela_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      permissoes_usuario_excecoes: {
        Row: {
          acao: Database["public"]["Enums"]["permissao_acao"]
          permitido: boolean
          tela_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          acao: Database["public"]["Enums"]["permissao_acao"]
          permitido: boolean
          tela_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          acao?: Database["public"]["Enums"]["permissao_acao"]
          permitido?: boolean
          tela_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          categoria: string | null
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
          categoria?: string | null
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
          categoria?: string | null
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
      pre_selecoes: {
        Row: {
          aceita_newsletter: boolean
          atribuido_para_vendedor_id: string | null
          cidade_estado: string
          cliente_b2b_id: string | null
          cnpj: string
          contato_cargo: string | null
          contato_email: string
          contato_nome: string
          contato_whatsapp: string
          cotacao_gerada_id: string | null
          criado_em: string
          expira_em: string
          id: string
          itens: Json
          nome_fantasia: string
          observacao: string | null
          pedido_gerado_id: string | null
          razao_social: string
          segmento: string
          sessao_id: string | null
          status: string
          total_itens: number
          total_unidades: number
          total_varejo_ref: number
          updated_at: string
          vendedor_login: string | null
          vendedor_nome: string | null
          visualizado_em: string | null
        }
        Insert: {
          aceita_newsletter?: boolean
          atribuido_para_vendedor_id?: string | null
          cidade_estado: string
          cliente_b2b_id?: string | null
          cnpj: string
          contato_cargo?: string | null
          contato_email: string
          contato_nome: string
          contato_whatsapp: string
          cotacao_gerada_id?: string | null
          criado_em?: string
          expira_em: string
          id: string
          itens?: Json
          nome_fantasia: string
          observacao?: string | null
          pedido_gerado_id?: string | null
          razao_social: string
          segmento: string
          sessao_id?: string | null
          status?: string
          total_itens?: number
          total_unidades?: number
          total_varejo_ref?: number
          updated_at?: string
          vendedor_login?: string | null
          vendedor_nome?: string | null
          visualizado_em?: string | null
        }
        Update: {
          aceita_newsletter?: boolean
          atribuido_para_vendedor_id?: string | null
          cidade_estado?: string
          cliente_b2b_id?: string | null
          cnpj?: string
          contato_cargo?: string | null
          contato_email?: string
          contato_nome?: string
          contato_whatsapp?: string
          cotacao_gerada_id?: string | null
          criado_em?: string
          expira_em?: string
          id?: string
          itens?: Json
          nome_fantasia?: string
          observacao?: string | null
          pedido_gerado_id?: string | null
          razao_social?: string
          segmento?: string
          sessao_id?: string | null
          status?: string
          total_itens?: number
          total_unidades?: number
          total_varejo_ref?: number
          updated_at?: string
          vendedor_login?: string | null
          vendedor_nome?: string | null
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_selecoes_atribuido_para_vendedor_id_fkey"
            columns: ["atribuido_para_vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_selecoes_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessao_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_selecoes_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessao_catalogo_estado"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          acao: string
          alterado_por_id: string | null
          alterado_por_nome: string | null
          criado_em: string
          id: string
          nome_comercial: string | null
          observacao: string | null
          preco_atacado_anterior: number | null
          preco_atacado_novo: number | null
          preco_varejo_anterior: number | null
          preco_varejo_novo: number | null
          product_id: string
          sku: string | null
          variacao_atacado_percent: number | null
          variacao_varejo_percent: number | null
        }
        Insert: {
          acao?: string
          alterado_por_id?: string | null
          alterado_por_nome?: string | null
          criado_em?: string
          id?: string
          nome_comercial?: string | null
          observacao?: string | null
          preco_atacado_anterior?: number | null
          preco_atacado_novo?: number | null
          preco_varejo_anterior?: number | null
          preco_varejo_novo?: number | null
          product_id: string
          sku?: string | null
          variacao_atacado_percent?: number | null
          variacao_varejo_percent?: number | null
        }
        Update: {
          acao?: string
          alterado_por_id?: string | null
          alterado_por_nome?: string | null
          criado_em?: string
          id?: string
          nome_comercial?: string | null
          observacao?: string | null
          preco_atacado_anterior?: number | null
          preco_atacado_novo?: number | null
          preco_varejo_anterior?: number | null
          preco_varejo_novo?: number | null
          product_id?: string
          sku?: string | null
          variacao_atacado_percent?: number | null
          variacao_varejo_percent?: number | null
        }
        Relationships: []
      }
      product_prices: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por_id: string | null
          criado_por_nome: string | null
          id: string
          observacao: string | null
          preco_atacado: number
          preco_varejo: number
          product_id: string
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome?: string | null
          id?: string
          observacao?: string | null
          preco_atacado?: number
          preco_varejo?: number
          product_id: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por_id?: string | null
          criado_por_nome?: string | null
          id?: string
          observacao?: string | null
          preco_atacado?: number
          preco_varejo?: number
          product_id?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          altura_cm: number
          ativo: boolean
          categoria: string
          cest: string | null
          cod_cadastro: string | null
          colecao: string
          colecao_id: string
          cor: string | null
          cor_id: string
          cor_nome: string | null
          created_at: string
          departamento: string | null
          descricao_colecao: string | null
          descricao_produto: string | null
          ean: string | null
          estampa: string | null
          estoque_disponivel: number
          familia: string | null
          fase: string | null
          grupo: string
          grupo_id: string
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
          pronta_entrega: boolean
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
          ativo?: boolean
          categoria: string
          cest?: string | null
          cod_cadastro?: string | null
          colecao: string
          colecao_id: string
          cor?: string | null
          cor_id: string
          cor_nome?: string | null
          created_at?: string
          departamento?: string | null
          descricao_colecao?: string | null
          descricao_produto?: string | null
          ean?: string | null
          estampa?: string | null
          estoque_disponivel?: number
          familia?: string | null
          fase?: string | null
          grupo: string
          grupo_id: string
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
          pronta_entrega?: boolean
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
          ativo?: boolean
          categoria?: string
          cest?: string | null
          cod_cadastro?: string | null
          colecao?: string
          colecao_id?: string
          cor?: string | null
          cor_id?: string
          cor_nome?: string | null
          created_at?: string
          departamento?: string | null
          descricao_colecao?: string | null
          descricao_produto?: string | null
          ean?: string | null
          estampa?: string | null
          estoque_disponivel?: number
          familia?: string | null
          fase?: string | null
          grupo?: string
          grupo_id?: string
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
          pronta_entrega?: boolean
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
        Relationships: [
          {
            foreignKeyName: "products_colecao_id_fkey"
            columns: ["colecao_id"]
            isOneToOne: false
            referencedRelation: "produto_colecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_cor_id_fkey"
            columns: ["cor_id"]
            isOneToOne: false
            referencedRelation: "produto_cores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_fase_fkey"
            columns: ["fase"]
            isOneToOne: false
            referencedRelation: "produto_fase_dim"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "products_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "produto_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_categorias: {
        Row: {
          ativo: boolean
          created_at: string
          departamento_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          departamento_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          departamento_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_categorias_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "produto_departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_colecoes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      produto_cores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      produto_departamentos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      produto_fase_dim: {
        Row: {
          ativo: boolean
          criado_em: string
          descricao: string | null
          nome: string
          ordem: number
          slug: string
          visivel_catalogo: boolean
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          nome: string
          ordem: number
          slug: string
          visivel_catalogo: boolean
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          nome?: string
          ordem?: number
          slug?: string
          visivel_catalogo?: boolean
        }
        Relationships: []
      }
      produto_fase_ficha: {
        Row: {
          atualizado_em: string
          bloco: string
          campo: string
          descricao: string | null
          dono: string
          fase_exigida: string | null
          obrigatorio: boolean
          ordem: number
        }
        Insert: {
          atualizado_em?: string
          bloco: string
          campo: string
          descricao?: string | null
          dono: string
          fase_exigida?: string | null
          obrigatorio?: boolean
          ordem: number
        }
        Update: {
          atualizado_em?: string
          bloco?: string
          campo?: string
          descricao?: string | null
          dono?: string
          fase_exigida?: string | null
          obrigatorio?: boolean
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "produto_fase_ficha_fase_exigida_fkey"
            columns: ["fase_exigida"]
            isOneToOne: false
            referencedRelation: "produto_fase_dim"
            referencedColumns: ["slug"]
          },
        ]
      }
      produto_grupos: {
        Row: {
          ativo: boolean
          categoria_id: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_grupos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "produto_categorias"
            referencedColumns: ["id"]
          },
        ]
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
          first_login_at: string | null
          grupo_permissao_id: string | null
          id: string
          last_login_at: string | null
          login_amigavel: string | null
          login_count: number
          nome_completo: string | null
          observacoes: string | null
          regiao: string | null
          regiao_id: string | null
          supervisor: string | null
          supervisor_id: string | null
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
          first_login_at?: string | null
          grupo_permissao_id?: string | null
          id: string
          last_login_at?: string | null
          login_amigavel?: string | null
          login_count?: number
          nome_completo?: string | null
          observacoes?: string | null
          regiao?: string | null
          regiao_id?: string | null
          supervisor?: string | null
          supervisor_id?: string | null
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
          first_login_at?: string | null
          grupo_permissao_id?: string | null
          id?: string
          last_login_at?: string | null
          login_amigavel?: string | null
          login_count?: number
          nome_completo?: string | null
          observacoes?: string | null
          regiao?: string | null
          regiao_id?: string | null
          supervisor?: string | null
          supervisor_id?: string | null
          telefone?: string | null
          tipo_vendedor?: Database["public"]["Enums"]["tipo_vendedor"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_profiles_supervisor"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_grupo_permissao_id_fkey"
            columns: ["grupo_permissao_id"]
            isOneToOne: false
            referencedRelation: "permissoes_grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_regiao_id_fkey"
            columns: ["regiao_id"]
            isOneToOne: false
            referencedRelation: "regioes"
            referencedColumns: ["id"]
          },
        ]
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
          cotacao_origem_id: string | null
          criado_em: string
          datas_previsao: Json
          id: string
          observacoes: string | null
          pedido_convertido_id: string | null
          pedido_firme_id: string | null
          proxima_previsao: string
          reprovado: boolean
          reprovado_em: string | null
          reprovado_motivo: string | null
          reprovado_por_id: string | null
          reprovado_por_nome: string | null
          status: string
          total_referencia: number
          vendedor_id: string
          vendedor_nome: string
        }
        Insert: {
          atualizado_em?: string
          cliente_id: string
          cliente_snapshot: Json
          cotacao_origem_id?: string | null
          criado_em?: string
          datas_previsao?: Json
          id: string
          observacoes?: string | null
          pedido_convertido_id?: string | null
          pedido_firme_id?: string | null
          proxima_previsao: string
          reprovado?: boolean
          reprovado_em?: string | null
          reprovado_motivo?: string | null
          reprovado_por_id?: string | null
          reprovado_por_nome?: string | null
          status?: string
          total_referencia?: number
          vendedor_id: string
          vendedor_nome: string
        }
        Update: {
          atualizado_em?: string
          cliente_id?: string
          cliente_snapshot?: Json
          cotacao_origem_id?: string | null
          criado_em?: string
          datas_previsao?: Json
          id?: string
          observacoes?: string | null
          pedido_convertido_id?: string | null
          pedido_firme_id?: string | null
          proxima_previsao?: string
          reprovado?: boolean
          reprovado_em?: string | null
          reprovado_motivo?: string | null
          reprovado_por_id?: string | null
          reprovado_por_nome?: string | null
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
            foreignKeyName: "provisoes_cotacao_origem_id_fkey"
            columns: ["cotacao_origem_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
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
      regioes: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      regras_gerais: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          bloqueio_senha_master_minutos: number
          bonus_pix_padrao: number
          desconto_master_max: number
          faixa_reservada_nome: string
          frete_fallback_percent: number
          id: number
          pedido_minimo: number
          provisao_expirar_dias: number
          tentativas_senha_master: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          bloqueio_senha_master_minutos?: number
          bonus_pix_padrao?: number
          desconto_master_max?: number
          faixa_reservada_nome?: string
          frete_fallback_percent?: number
          id?: number
          pedido_minimo?: number
          provisao_expirar_dias?: number
          tentativas_senha_master?: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          bloqueio_senha_master_minutos?: number
          bonus_pix_padrao?: number
          desconto_master_max?: number
          faixa_reservada_nome?: string
          frete_fallback_percent?: number
          id?: number
          pedido_minimo?: number
          provisao_expirar_dias?: number
          tentativas_senha_master?: number
        }
        Relationships: []
      }
      representantes: {
        Row: {
          cnpj_cpf: string
          contrato_fim: string | null
          contrato_inicio: string | null
          created_at: string
          empresa: string
          observacoes: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          cnpj_cpf: string
          contrato_fim?: string | null
          contrato_inicio?: string | null
          created_at?: string
          empresa: string
          observacoes?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          cnpj_cpf?: string
          contrato_fim?: string | null
          contrato_inicio?: string | null
          created_at?: string
          empresa?: string
          observacoes?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representantes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao_catalogo: {
        Row: {
          campos_preenchidos: Json | null
          cnpj: string | null
          created_at: string
          device_id: string | null
          estado_atual: string
          id: string
          identificado_gate: boolean
          link_instance_id: string | null
          nome: string | null
          origem_id_snapshot: string | null
          origem_tipo_snapshot: string | null
          primeiro_acesso: string
          qtd_itens: number
          razao_social: string | null
          segmento: string | null
          ultimo_evento: string
          ultimo_form_open: string | null
          updated_at: string
          user_agent: string | null
          valor_wishlist: number
          vendedor_responsavel: string | null
          whatsapp: string | null
        }
        Insert: {
          campos_preenchidos?: Json | null
          cnpj?: string | null
          created_at?: string
          device_id?: string | null
          estado_atual?: string
          id: string
          identificado_gate?: boolean
          link_instance_id?: string | null
          nome?: string | null
          origem_id_snapshot?: string | null
          origem_tipo_snapshot?: string | null
          primeiro_acesso?: string
          qtd_itens?: number
          razao_social?: string | null
          segmento?: string | null
          ultimo_evento?: string
          ultimo_form_open?: string | null
          updated_at?: string
          user_agent?: string | null
          valor_wishlist?: number
          vendedor_responsavel?: string | null
          whatsapp?: string | null
        }
        Update: {
          campos_preenchidos?: Json | null
          cnpj?: string | null
          created_at?: string
          device_id?: string | null
          estado_atual?: string
          id?: string
          identificado_gate?: boolean
          link_instance_id?: string | null
          nome?: string | null
          origem_id_snapshot?: string | null
          origem_tipo_snapshot?: string | null
          primeiro_acesso?: string
          qtd_itens?: number
          razao_social?: string | null
          segmento?: string | null
          ultimo_evento?: string
          ultimo_form_open?: string | null
          updated_at?: string
          user_agent?: string | null
          valor_wishlist?: number
          vendedor_responsavel?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessao_catalogo_link_instance_id_fkey"
            columns: ["link_instance_id"]
            isOneToOne: false
            referencedRelation: "link_instance"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_aula: {
        Row: {
          id: string
          modulo_id: string
          ordem: number
          secao: string | null
          titulo: string
        }
        Insert: {
          id?: string
          modulo_id: string
          ordem?: number
          secao?: string | null
          titulo: string
        }
        Update: {
          id?: string
          modulo_id?: string
          ordem?: number
          secao?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamento_aula_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "treinamento_modulo"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_bloco: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          aula_id: string
          conteudo_texto: string | null
          descritivo: Json
          faq_conhecimento: string | null
          id: string
          ordem: number
          tipo: string
          youtube_id: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          aula_id: string
          conteudo_texto?: string | null
          descritivo?: Json
          faq_conhecimento?: string | null
          id?: string
          ordem?: number
          tipo: string
          youtube_id?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          aula_id?: string
          conteudo_texto?: string | null
          descritivo?: Json
          faq_conhecimento?: string | null
          id?: string
          ordem?: number
          tipo?: string
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treinamento_bloco_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "treinamento_aula"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_modulo: {
        Row: {
          capa_url: string | null
          categoria: string | null
          criado_em: string
          criado_por: string | null
          descricao: string | null
          id: string
          ordem: number
          status: string
          titulo: string
          visibilidade: string
        }
        Insert: {
          capa_url?: string | null
          categoria?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          ordem?: number
          status?: string
          titulo: string
          visibilidade?: string
        }
        Update: {
          capa_url?: string | null
          categoria?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          ordem?: number
          status?: string
          titulo?: string
          visibilidade?: string
        }
        Relationships: []
      }
      treinamento_progresso: {
        Row: {
          aula_id: string
          concluida: boolean
          concluida_em: string | null
          id: string
          user_id: string
        }
        Insert: {
          aula_id: string
          concluida?: boolean
          concluida_em?: string | null
          id?: string
          user_id: string
        }
        Update: {
          aula_id?: string
          concluida?: boolean
          concluida_em?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamento_progresso_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "treinamento_aula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamento_progresso_user_id_fkey"
            columns: ["user_id"]
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
      wishlist_carrinho: {
        Row: {
          atualizado_em: string
          chave: string
          device_id: string | null
          itens: Json
          nome: string | null
          whatsapp: string | null
        }
        Insert: {
          atualizado_em?: string
          chave: string
          device_id?: string | null
          itens?: Json
          nome?: string | null
          whatsapp?: string | null
        }
        Update: {
          atualizado_em?: string
          chave?: string
          device_id?: string | null
          itens?: Json
          nome?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      gate_ab_metrics: {
        Row: {
          conv_total: number | null
          enviaram: number | null
          montaram: number | null
          sessoes: number | null
          taxa_envio: number | null
          taxa_montagem: number | null
          valor_enviado: number | null
          variante: string | null
        }
        Relationships: []
      }
      sessao_catalogo_estado: {
        Row: {
          campos_preenchidos: Json | null
          cnpj: string | null
          created_at: string | null
          device_id: string | null
          estado_atual: string | null
          estado_derivado: string | null
          id: string | null
          identificado_gate: boolean | null
          link_instance_id: string | null
          nome: string | null
          origem_id_snapshot: string | null
          origem_tipo_snapshot: string | null
          primeiro_acesso: string | null
          qtd_itens: number | null
          razao_social: string | null
          segmento: string | null
          ultimo_evento: string | null
          ultimo_form_open: string | null
          updated_at: string | null
          user_agent: string | null
          valor_wishlist: number | null
          vendedor_responsavel: string | null
          whatsapp: string | null
        }
        Insert: {
          campos_preenchidos?: Json | null
          cnpj?: string | null
          created_at?: string | null
          device_id?: string | null
          estado_atual?: string | null
          estado_derivado?: never
          id?: string | null
          identificado_gate?: boolean | null
          link_instance_id?: string | null
          nome?: string | null
          origem_id_snapshot?: string | null
          origem_tipo_snapshot?: string | null
          primeiro_acesso?: string | null
          qtd_itens?: number | null
          razao_social?: string | null
          segmento?: string | null
          ultimo_evento?: string | null
          ultimo_form_open?: string | null
          updated_at?: string | null
          user_agent?: string | null
          valor_wishlist?: number | null
          vendedor_responsavel?: string | null
          whatsapp?: string | null
        }
        Update: {
          campos_preenchidos?: Json | null
          cnpj?: string | null
          created_at?: string | null
          device_id?: string | null
          estado_atual?: string | null
          estado_derivado?: never
          id?: string | null
          identificado_gate?: boolean | null
          link_instance_id?: string | null
          nome?: string | null
          origem_id_snapshot?: string | null
          origem_tipo_snapshot?: string | null
          primeiro_acesso?: string | null
          qtd_itens?: number | null
          razao_social?: string | null
          segmento?: string | null
          ultimo_evento?: string | null
          ultimo_form_open?: string | null
          updated_at?: string | null
          user_agent?: string | null
          valor_wishlist?: number | null
          vendedor_responsavel?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessao_catalogo_link_instance_id_fkey"
            columns: ["link_instance_id"]
            isOneToOne: false
            referencedRelation: "link_instance"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claim_pre_selecao: {
        Args: { p_id: string }
        Returns: {
          atribuido: boolean
          atribuido_para_vendedor_id: string
          id: string
        }[]
      }
      cliente_cnpj_status: {
        Args: { p_cnpj: string }
        Returns: {
          cliente_id: string
          existe: boolean
          is_mine: boolean
          owner_id: string
          owner_nome: string
          razao_social: string
        }[]
      }
      ensure_link_instance_for_login: {
        Args: { p_login: string }
        Returns: {
          id: string
          origem_id: string
          origem_tipo: string
          token: string
        }[]
      }
      fn_produto_fase_pendencias: {
        Args: {
          p: Database["public"]["Tables"]["products"]["Row"]
          p_fase: string
        }
        Returns: string[]
      }
      get_order_by_sncf_id: {
        Args: { p_sncf_pedido_id: string }
        Returns: Json
      }
      get_vault_secret: { Args: { p_name: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_master: { Args: { _user_id: string }; Returns: boolean }
      is_representante: { Args: { _user_id: string }; Returns: boolean }
      is_vendedor_interno: { Args: { _user_id: string }; Returns: boolean }
      log_access_event: {
        Args: {
          p_descricao?: string
          p_evento: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: string
      }
      match_kb_chunks: {
        Args: { p_embedding: string; p_limit?: number; p_ver_interno?: boolean }
        Returns: {
          aula_id: string
          bloco_id: string
          id: string
          modulo_id: string
          origem_tipo: string
          similaridade: number
          texto: string
          timestamp_video: string
        }[]
      }
      next_cotacao_id: { Args: never; Returns: string }
      next_order_id: { Args: never; Returns: string }
      next_pre_selecao_id: { Args: never; Returns: string }
      public_emit_evento_catalogo: {
        Args: {
          p_campos_preenchidos?: Json
          p_itens_parcial?: number
          p_sessao_id: string
          p_tipo: string
          p_valor_parcial?: number
        }
        Returns: undefined
      }
      public_get_wishlist: { Args: { p_chave: string }; Returns: Json }
      public_save_wishlist: {
        Args: {
          p_chave: string
          p_device_id?: string
          p_itens: Json
          p_nome?: string
          p_whatsapp?: string
        }
        Returns: undefined
      }
      public_upsert_lead_rascunho: {
        Args: {
          p_campos?: number
          p_dados?: Json
          p_enviado?: boolean
          p_sessao_id: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      public_upsert_sessao_catalogo: {
        Args: { p_id: string; p_patch?: Json }
        Returns: undefined
      }
      record_login: { Args: never; Returns: undefined }
      resolver_migracao_cliente: {
        Args: { p_aprovar: boolean; p_id: string; p_resposta?: string }
        Returns: undefined
      }
      solicitar_migracao_cliente: {
        Args: { p_cnpj: string; p_justificativa?: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "master" | "admin" | "vendedor" | "cliente"
      cartilha_acao:
        | "criado"
        | "editado"
        | "desativado"
        | "reativado"
        | "reordenado"
      cartilha_entidade: "faixa" | "condicao" | "regras_gerais"
      catalog_acao:
        | "criado"
        | "editado"
        | "desativado"
        | "reativado"
        | "duplicado"
        | "importado"
      lead_frequencia:
        | "pontual"
        | "mensal"
        | "trimestral"
        | "semestral"
        | "anual"
      lead_origem:
        | "instagram"
        | "whatsapp"
        | "feira"
        | "indicacao"
        | "site"
        | "google"
        | "outro"
      lead_potencial: "alto" | "medio" | "em_desenvolvimento"
      lead_segmento:
        | "lojista"
        | "decoradora"
        | "cerimonialista"
        | "atacadista"
        | "buffet"
        | "influencer"
        | "consumidor"
        | "outro"
        | "representacao"
      lead_status_crm:
        | "novo"
        | "em_contato"
        | "qualificado"
        | "proposta_enviada"
        | "convertido"
        | "descartado"
        | "agendado"
        | "agendamento_enviado"
        | "reuniao_realizada"
        | "pedido_fechado"
        | "sac"
      lead_volume_estimado:
        | "ate_2500"
        | "2500_10k"
        | "10k_50k"
        | "acima_50k"
        | "nao_sei"
        | "ate_500"
        | "500_1500"
        | "1500_3000"
      permissao_acao:
        | "ver"
        | "criar"
        | "editar"
        | "excluir"
        | "exportar"
        | "aprovar"
      tipo_condicao_pagamento: "pix" | "boleto" | "cartao"
      tipo_frete: "CIF" | "FOB"
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
      app_role: ["master", "admin", "vendedor", "cliente"],
      cartilha_acao: [
        "criado",
        "editado",
        "desativado",
        "reativado",
        "reordenado",
      ],
      cartilha_entidade: ["faixa", "condicao", "regras_gerais"],
      catalog_acao: [
        "criado",
        "editado",
        "desativado",
        "reativado",
        "duplicado",
        "importado",
      ],
      lead_frequencia: [
        "pontual",
        "mensal",
        "trimestral",
        "semestral",
        "anual",
      ],
      lead_origem: [
        "instagram",
        "whatsapp",
        "feira",
        "indicacao",
        "site",
        "google",
        "outro",
      ],
      lead_potencial: ["alto", "medio", "em_desenvolvimento"],
      lead_segmento: [
        "lojista",
        "decoradora",
        "cerimonialista",
        "atacadista",
        "buffet",
        "influencer",
        "consumidor",
        "outro",
        "representacao",
      ],
      lead_status_crm: [
        "novo",
        "em_contato",
        "qualificado",
        "proposta_enviada",
        "convertido",
        "descartado",
        "agendado",
        "agendamento_enviado",
        "reuniao_realizada",
        "pedido_fechado",
        "sac",
      ],
      lead_volume_estimado: [
        "ate_2500",
        "2500_10k",
        "10k_50k",
        "acima_50k",
        "nao_sei",
        "ate_500",
        "500_1500",
        "1500_3000",
      ],
      permissao_acao: [
        "ver",
        "criar",
        "editar",
        "excluir",
        "exportar",
        "aprovar",
      ],
      tipo_condicao_pagamento: ["pix", "boleto", "cartao"],
      tipo_frete: ["CIF", "FOB"],
      tipo_vendedor: ["interno", "representante"],
    },
  },
} as const
