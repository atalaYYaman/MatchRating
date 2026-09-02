import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { api, ApiError } from "./api";

// Tasarimdaki alt sekme yapisi tek bir "aktif takim" uzerinden calisiyor:
// ana sayfa ve maclar sekmesi bu takimi gosterir, Takimlarim sekmesi degistirir.

const ACTIVE_GROUP_KEY = "matchrating_active_group";

export type GroupSummary = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  member_count: number;
};

type ActiveGroupContextValue = {
  groups: GroupSummary[];
  activeGroup: GroupSummary | null;
  loading: boolean;
  error: string | null;
  setActiveGroup: (groupId: string) => void;
  refresh: () => Promise<void>;
};

const ActiveGroupContext = createContext<ActiveGroupContextValue | null>(null);

export function ActiveGroupProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ groups: GroupSummary[] }>("/api/groups");
      setGroups(data.groups);
      setError(null);

      // Kayitli takim artik yoksa (cikarilmis olabilir) ilkine dus.
      const stored = await SecureStore.getItemAsync(ACTIVE_GROUP_KEY);
      const valid = data.groups.some((g) => g.id === stored);
      setActiveId(valid ? stored : (data.groups[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Takımlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActiveGroup = useCallback((groupId: string) => {
    setActiveId(groupId);
    SecureStore.setItemAsync(ACTIVE_GROUP_KEY, groupId).catch(() => {});
  }, []);

  const activeGroup = groups.find((g) => g.id === activeId) ?? null;

  return (
    <ActiveGroupContext.Provider
      value={{ groups, activeGroup, loading, error, setActiveGroup, refresh }}
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
