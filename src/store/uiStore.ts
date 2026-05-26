import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};
const safeStorage = (): Storage =>
  typeof window !== "undefined" ? window.localStorage : noopStorage;

interface UIState {
  sidebarCollapsed: boolean;
  expandedGroups: Record<string, boolean>;
  mobileSidebarOpen: boolean;
  theme: "dark" | "light";
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleGroup: (key: string) => void;
  setGroupExpanded: (key: string, v: boolean) => void;
  setMobileSidebarOpen: (v: boolean) => void;
  toggleTheme: () => void;
  setTheme: (t: "dark" | "light") => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      expandedGroups: {},
      mobileSidebarOpen: false,
      theme: "light",
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleGroup: (key) =>
        set((s) => ({
          expandedGroups: { ...s.expandedGroups, [key]: !s.expandedGroups[key] },
        })),
      setGroupExpanded: (key, v) =>
        set((s) => ({ expandedGroups: { ...s.expandedGroups, [key]: v } })),
      setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setTheme: (t) => set({ theme: t }),
    }),
    {
      name: "fetely-ui",
      storage: createJSONStorage(safeStorage),
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        expandedGroups: s.expandedGroups,
        theme: s.theme,
      }),
    },
  ),
);
