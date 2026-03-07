import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { queryClient } from "./queryClient";

interface AuthUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: string;
  organizationId: number | null;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  canManageUsers: boolean;
  canManageOrgs: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "ideacompiler_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  const fetchUser = useCallback(async (t: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        return true;
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        return false;
      }
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchUser(token).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (loginId: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: loginId, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Login failed");
    }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    queryClient.clear();
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    queryClient.clear();
    setLocation("/");
  };

  const refreshUser = async () => {
    if (token) await fetchUser(token);
  };

  const canManageUsers = !!user && ["system_admin", "org_admin", "pm"].includes(user.role);
  const canManageOrgs = !!user && ["system_admin", "org_admin"].includes(user.role);
  const isAdmin = !!user && user.role === "system_admin";

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, refreshUser, canManageUsers, canManageOrgs, isAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
