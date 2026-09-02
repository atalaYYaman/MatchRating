"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, ApiError } from "@/lib/client-api";

// Sekmeli yapinin takim kapsami. Varsayilan "tum takimlar": kullanici birden
// fazla takimda maca cikiyorsa hepsini tek yerde gorur. Belirli bir takim
// secilirse ana sayfa, maclar ve istatistikler o takima daralir.
// Mobildeki mobile/lib/active-group.tsx ile ayni davranis.

const SCOPE_KEY = "matchrating_group_scope";
const ALL = "all";

export type GroupSummary = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  member_count: number;
};

type ActiveGroupContextValue = {
  groups: GroupSummary[];
  /** Belirli bir takim seciliyse o takim, "tumu" seciliyse null. */
  activeGroup: GroupSummary | null;
  /** Kapsam "tum takimlar" mi? */
  isAll: boolean;
  /** API'ye gonderilecek groupId (tumu icin null). */
  scopeId: string | null;
  loading: boolean;
  error: string | null;
  setScope: (groupId: string | null) => void;
  refresh: () => Promise<void>;
};

const ActiveGroupContext = createContext<ActiveGroupContextValue | null>(null);

function readStoredScope(): string | null {
  try {
    const raw = window.localStorage.getItem(SCOPE_KEY);
    return raw && raw !== ALL ? raw : null;
  } catch {
    return null;
  }
}

export function ActiveGroupProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ groups: GroupSummary[] }>("/api/groups");
      setGroups(data.groups);
      setError(null);

      // Kayitli takim artik yoksa (cikarilmis olabilir) "tumu"ne dus.
      const stored = readStoredScope();
      setScopeId(stored && data.groups.some((g) => g.id === stored) ? stored : null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takımlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setScope = useCallback((groupId: string | null) => {
    setScopeId(groupId);
    try {
      window.localStorage.setItem(SCOPE_KEY, groupId ?? ALL);
    } catch {
      // Gizli sekmede localStorage kapali olabilir; secim oturum boyunca
      // yine de gecerli kalir.
    }
  }, []);

  const activeGroup = scopeId ? (groups.find((g) => g.id === scopeId) ?? null) : null;

  return (
    <ActiveGroupContext.Provider
      value={{
        groups,
        activeGroup,
        isAll: scopeId === null,
        scopeId,
        loading,
        error,
        setScope,
        refresh,
      }}
    >
      {children}
    </ActiveGroupContext.Provider>
  );
}

export function useActiveGroup() {
  const ctx = useContext(ActiveGroupContext);
  if (!ctx) throw new Error("useActiveGroup, ActiveGroupProvider icinde kullanilmali.");
  return ctx;
}
