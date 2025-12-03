/**
 * App Context - Provides global state for the application
 *
 * This includes:
 * - Current user (from NextAuth session)
 * - Current organization
 * - Loading states
 *
 * Integrates with NextAuth for authentication and database API for orgs
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useSession, signIn, signOut } from "next-auth/react";

// Simplified user type based on NextAuth session
interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

// Organization from API
interface OrgWithRole {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount?: number;
  boardCount?: number;
}

interface AppContextValue {
  // Auth state
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Organization state
  currentOrg: OrgWithRole | null;
  userOrgs: OrgWithRole[];

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => void;
  createOrg: (name: string, slug: string) => Promise<OrgWithRole>;
  deleteOrg: (orgId: string) => Promise<void>;
  refreshOrgs: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const CURRENT_ORG_KEY = "excalidraw_current_org_id";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [currentOrg, setCurrentOrg] = useState<OrgWithRole | null>(null);
  const [userOrgs, setUserOrgs] = useState<OrgWithRole[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  const isLoading = status === "loading" || orgsLoading;
  const user = session?.user as SessionUser | null;
  const isAuthenticated = !!session?.user;

  // Persist current org to localStorage
  useEffect(() => {
    if (currentOrg?.id) {
      localStorage.setItem(CURRENT_ORG_KEY, currentOrg.id);
    }
  }, [currentOrg?.id]);

  // Fetch user's organizations from API
  const fetchOrgs = useCallback(async () => {
    if (!isAuthenticated) {
      setUserOrgs([]);
      setCurrentOrg(null);
      return;
    }

    setOrgsLoading(true);
    try {
      const response = await fetch("/api/orgs");
      if (response.ok) {
        const data = await response.json();
        const orgs = data.organizations || [];
        setUserOrgs(orgs);

        // Restore last selected org from localStorage, or default to first
        if (orgs.length > 0) {
          setCurrentOrg((prev) => {
            if (prev) return prev; // Already have one selected

            const savedOrgId = localStorage.getItem(CURRENT_ORG_KEY);
            const savedOrg = savedOrgId
              ? orgs.find((o: OrgWithRole) => o.id === savedOrgId)
              : null;
            return savedOrg || orgs[0];
          });
        }
      } else {
        console.error("[AppContext] Failed to fetch orgs:", response.status);
      }
    } catch (error) {
      console.error("[AppContext] Error fetching organizations:", error);
    } finally {
      setOrgsLoading(false);
    }
  }, [isAuthenticated]);

  // Load orgs when auth state changes
  useEffect(() => {
    if (status !== "loading") {
      fetchOrgs();
    }
  }, [status, fetchOrgs]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      throw new Error(result.error);
    }

    // Force a page reload to refresh the session
    // This is needed because signIn with redirect:false doesn't update useSession automatically
    window.location.reload();
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(CURRENT_ORG_KEY);
    setCurrentOrg(null);
    setUserOrgs([]);
    await signOut({ redirect: false });
  }, []);

  const switchOrg = useCallback(
    (orgId: string) => {
      const org = userOrgs.find((o) => o.id === orgId);
      if (org) {
        setCurrentOrg(org);
      }
    },
    [userOrgs]
  );

  const createOrg = useCallback(
    async (name: string, slug: string): Promise<OrgWithRole> => {
      if (!isAuthenticated) {
        throw new Error("Must be logged in to create an organization");
      }

      const response = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create organization");
      }

      const newOrg = await response.json();

      // Refresh orgs list and switch to new org
      await fetchOrgs();
      setCurrentOrg(newOrg);

      return newOrg;
    },
    [isAuthenticated, fetchOrgs]
  );

  const deleteOrg = useCallback(
    async (orgId: string): Promise<void> => {
      if (!isAuthenticated) {
        throw new Error("Must be logged in to delete an organization");
      }

      const wasCurrentOrg = currentOrg?.id === orgId;

      const response = await fetch(`/api/orgs/${orgId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete organization");
      }

      // If we deleted the current org, clear it so fetchOrgs picks a new one
      if (wasCurrentOrg) {
        setCurrentOrg(null);
      }

      // Refresh orgs list - this will auto-select first org if currentOrg is null
      await fetchOrgs();
    },
    [isAuthenticated, fetchOrgs, currentOrg?.id]
  );

  const value: AppContextValue = {
    user,
    isLoading,
    isAuthenticated,
    currentOrg,
    userOrgs,
    login,
    logout,
    switchOrg,
    createOrg,
    deleteOrg,
    refreshOrgs: fetchOrgs,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

// Convenience hooks
export function useUser() {
  const { user, isLoading, isAuthenticated } = useApp();
  return { user, isLoading, isAuthenticated };
}

export function useOrg() {
  const { currentOrg, userOrgs, switchOrg, createOrg, deleteOrg } = useApp();
  return { currentOrg, userOrgs, switchOrg, createOrg, deleteOrg };
}
