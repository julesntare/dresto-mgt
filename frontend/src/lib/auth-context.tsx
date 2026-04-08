import React, { createContext, useEffect, useState } from "react";
import axios from "axios";
import { authApi } from "./api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("accessToken");
      if (token) {
        try {
          const { user } = await authApi.getProfile();
          setUser(user);
        } catch {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
        }
      }
      setLoading(false);
    };

    initAuth();

    // Listen for token removal from the Axios interceptor (session expiry)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "accessToken" && !e.newValue) {
        setUser(null);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const login = async (identifier: string, password: string) => {
    try {
      const response = await authApi.login(identifier, password);
      const { user, accessToken, refreshToken } = response;

      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      setUser(user as User);
    } catch (error) {
      // Check Axios errors first — AxiosError also extends Error so order matters
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const serverMsg = error.response?.data?.message;
        if (status === 401) throw new Error("Incorrect email/phone or password.");
        if (status === 403) throw new Error("Your account is inactive. Contact an administrator.");
        if (status === 429) throw new Error("Too many attempts. Please wait and try again.");
        if (!error.response) throw new Error("Cannot reach the server. Check your connection.");
        throw new Error(serverMsg || "Login failed. Please try again.");
      }
      throw new Error("An unexpected error occurred. Please try again.");
    }
  };

  const logout = async () => {    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
