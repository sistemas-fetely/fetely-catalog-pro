
-- Enum de ações
DO $$ BEGIN
  CREATE TYPE public.permissao_acao AS ENUM ('ver','criar','editar','excluir','exportar','aprovar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) Overrides por perfil base
CREATE TABLE public.permissoes_perfis_override (
  perfil public.app_role NOT NULL,
  tela_id TEXT NOT NULL,
  acao public.permissao_acao NOT NULL,
  permitido BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  PRIMARY KEY (perfil, tela_id, acao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_perfis_override TO authenticated;
GRANT ALL ON public.permissoes_perfis_override TO service_role;
ALTER TABLE public.permissoes_perfis_override ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm_perfis_select_auth" ON public.permissoes_perfis_override
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "perm_perfis_admin_write" ON public.permissoes_perfis_override
  FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- 2) Grupos customizados
CREATE TABLE public.permissoes_grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  baseado_em public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_grupos TO authenticated;
GRANT ALL ON public.permissoes_grupos TO service_role;
ALTER TABLE public.permissoes_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm_grupos_select_auth" ON public.permissoes_grupos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "perm_grupos_admin_write" ON public.permissoes_grupos
  FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));
CREATE TRIGGER trg_perm_grupos_updated_at
  BEFORE UPDATE ON public.permissoes_grupos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Overrides do grupo
CREATE TABLE public.permissoes_grupo_overrides (
  grupo_id UUID NOT NULL REFERENCES public.permissoes_grupos(id) ON DELETE CASCADE,
  tela_id TEXT NOT NULL,
  acao public.permissao_acao NOT NULL,
  permitido BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (grupo_id, tela_id, acao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_grupo_overrides TO authenticated;
GRANT ALL ON public.permissoes_grupo_overrides TO service_role;
ALTER TABLE public.permissoes_grupo_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm_grupo_ov_select_auth" ON public.permissoes_grupo_overrides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "perm_grupo_ov_admin_write" ON public.permissoes_grupo_overrides
  FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- 4) Exceções individuais
CREATE TABLE public.permissoes_usuario_excecoes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tela_id TEXT NOT NULL,
  acao public.permissao_acao NOT NULL,
  permitido BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  PRIMARY KEY (user_id, tela_id, acao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_usuario_excecoes TO authenticated;
GRANT ALL ON public.permissoes_usuario_excecoes TO service_role;
ALTER TABLE public.permissoes_usuario_excecoes ENABLE ROW LEVEL SECURITY;
-- Usuário pode ler as próprias exceções; admin/master leem todas
CREATE POLICY "perm_excecoes_select_self_or_admin" ON public.permissoes_usuario_excecoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_master(auth.uid()));
CREATE POLICY "perm_excecoes_admin_write" ON public.permissoes_usuario_excecoes
  FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- 5) Auditoria
CREATE TABLE public.permissoes_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_id UUID,
  admin_nome TEXT,
  alvo_tipo TEXT NOT NULL CHECK (alvo_tipo IN ('perfil_base','grupo','usuario')),
  alvo_id TEXT NOT NULL,
  alvo_nome TEXT,
  tela_id TEXT NOT NULL,
  tela_nome TEXT,
  acao public.permissao_acao NOT NULL,
  mudanca TEXT NOT NULL CHECK (mudanca IN ('grant','revoke','reset')),
  valor_anterior BOOLEAN,
  valor_novo BOOLEAN
);
GRANT SELECT, INSERT ON public.permissoes_audit TO authenticated;
GRANT ALL ON public.permissoes_audit TO service_role;
ALTER TABLE public.permissoes_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm_audit_admin_read" ON public.permissoes_audit
  FOR SELECT TO authenticated USING (public.is_admin_or_master(auth.uid()));
CREATE POLICY "perm_audit_admin_insert" ON public.permissoes_audit
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_master(auth.uid()));
CREATE INDEX idx_perm_audit_ts ON public.permissoes_audit (ts DESC);

-- 6) Ligação usuário → grupo
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grupo_permissao_id UUID REFERENCES public.permissoes_grupos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_grupo_permissao ON public.profiles (grupo_permissao_id);
