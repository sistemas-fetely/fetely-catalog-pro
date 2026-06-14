import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "master" | "admin" | "vendedor" | "cliente";

export type TipoVendedor = "interno" | "representante";

export interface Profile {
  id: string;
  email: string;
  nome_completo: string | null;
  telefone: string | null;
  codigo_vendedor: string | null;
  ativo: boolean;
  tipo_vendedor: TipoVendedor | null;
  regiao: string | null;
  comissao_percent: number | null;
  cargo: string | null;
  supervisor: string | null;
  cnpj_cpf: string | null;
  empresa: string | null;
  observacoes: string | null;
  login_amigavel: string | null;
  cliente_id: string | null;
  first_login_at: string | null;
  last_login_at: string | null;
  login_count: number | null;
}

interface AuthState {
  initialized: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  init: () => void;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isMaster: () => boolean;
  isAdmin: () => boolean;
  isAdminOrMaster: () => boolean;
  isCliente: () => boolean;
}

async function loadProfileAndRoles(userId: string): Promise<{ profile: Profile | null; roles: AppRole[] }> {
  const [{ data: profile }, { data: rolesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  return {
    profile: (profile as Profile | null) ?? null,
    roles: (rolesData ?? []).map((r) => r.role as AppRole),
  };
}

export const useAuth = create<AuthState>((set, get) => ({
  initialized: false,
  loading: true,
  session: null,
  user: null,
  profile: null,
  roles: [],

  init: () => {
    if (get().initialized) return;
    set({ initialized: true });

    // Listener único: onAuthStateChange emite INITIAL_SESSION no registro,
    // então um getSession() separado é redundante (mata o fetch duplicado).
    supabase.auth.onAuthStateChange((event, session) => {
      // Logout REAL só no SIGNED_OUT. Blip de rede transiente não emite esse
      // evento — o autoRefreshToken renova sozinho e segura a sessão.
      if (event === "SIGNED_OUT") {
        set({ session: null, user: null, profile: null, roles: [], loading: false });
        return;
      }

      // Renovação de token / update de usuário: atualiza a sessão em SILÊNCIO.
      // Não pisca loading e não refaz perfil (perfil/roles não mudam aqui).
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (session?.user) set({ session, user: session.user });
        return;
      }

      // INITIAL_SESSION / SIGNED_IN: resolvem o estado de login.
      if (session?.user) {
        const jaTemPerfil = get().profile?.id === session.user.id;
        // loading só quando ainda NÃO temos o perfil (login frio). Re-disparo
        // do listener com perfil já carregado não pisca a tela.
        set({ session, user: session.user, loading: !jaTemPerfil });
        // Defer pra evitar deadlock com o próprio listener.
        setTimeout(async () => {
          const { profile, roles } = await loadProfileAndRoles(session.user.id);
          set({ profile, roles, loading: false });
        }, 0);
      } else {
        // INITIAL_SESSION sem sessão persistida = visitante.
        set({ session: null, user: null, profile: null, roles: [], loading: false });
      }
    });
  },



  refreshProfile: async () => {
    const u = get().user;
    if (!u) return;
    const { profile, roles } = await loadProfileAndRoles(u.id);
    set({ profile, roles });
  },

  signIn: async (email, password) => {
    set({ loading: true, profile: null, roles: [] });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) set({ loading: false });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, roles: [] });
    // limpa permissões hidratadas
    const { usePermissoesStore } = await import("@/store/permissoesStore");
    usePermissoesStore.getState().reset();
  },

  isMaster: () => get().roles.includes("master"),
  isAdmin: () => get().roles.includes("admin"),
  isAdminOrMaster: () => {
    const r = get().roles;
    return r.includes("master") || r.includes("admin");
  },
  isCliente: () => get().roles.includes("cliente"),
}));
