import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Locale } from '../model/types'
import { getPreferredLocale } from '../i18n'

interface ShellState {
  locale: Locale
  sidebarOpen: boolean
  expandedFolders: Record<string, boolean>
  setLocale: (locale: Locale) => void
  setSidebarOpen: (open: boolean) => void
  toggleFolder: (id: string) => void
  setFolderExpanded: (id: string, expanded: boolean) => void
}

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      locale: getPreferredLocale(),
      sidebarOpen: false,
      expandedFolders: {},
      setLocale: (locale) => set({ locale }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleFolder: (id) =>
        set((state) => ({
          expandedFolders: {
            ...state.expandedFolders,
            [id]: !(state.expandedFolders[id] ?? true),
          },
        })),
      setFolderExpanded: (id, expanded) =>
        set((state) => ({
          expandedFolders: { ...state.expandedFolders, [id]: expanded },
        })),
    }),
    {
      name: 'lorestra-shell-preferences',
      partialize: (state) => ({
        locale: state.locale,
        expandedFolders: state.expandedFolders,
      }),
    },
  ),
)
