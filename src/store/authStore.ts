import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "master" | "admin" | "vendedor";

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

    // Listener FIRST (sync state changes), then check current session
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({ session, user: session.user, loading: true });
        // Defer Supabase calls to avoid deadlock with listener
        setTimeout(async () => {
          const { profile, roles } = await loadProfileAndRoles(session.user.id);
          set({ profile, roles, loading: false });
        }, 0);
      } else {
        set({ session: null, user: null, profile: null, roles: [], loading: false });
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        const { profile, roles } = await loadProfileAndRoles(session.user.id);
        set({ profile, roles, loading: false });
      } else {
        set({ loading: false });
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
  },

  isMaster: () => get().roles.includes("master"),
  isAdmin: () => get().roles.includes("admin"),
  isAdminOrMaster: () => {
    const r = get().roles;
    return r.includes("master") || r.includes("admin");
  },
}));
