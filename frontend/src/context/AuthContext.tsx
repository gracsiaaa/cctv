import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "@/api/client";

interface UserInfo {
  username: string;
  role: string;
  expires_at?: string;
}

interface AuthContextType {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserInfo) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("cctv_admin_token"));
  const [user, setUser] = useState<UserInfo | null>(() => {
    const saved = localStorage.getItem("cctv_admin_user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (token) {
      apiClient.get("/auth/me")
        .then((res) => {
          setUser(res.data.user);
          localStorage.setItem("cctv_admin_user", JSON.stringify(res.data.user));
        })
        .catch(() => {
          logout();
        });
    }
  }, [token]);

  const login = (newToken: string, newUser: UserInfo) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("cctv_admin_token", newToken);
    localStorage.setItem("cctv_admin_user", JSON.stringify(newUser));
  };

  const logout = () => {
    if (token) {
      apiClient.post("/auth/logout").catch(() => {});
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem("cctv_admin_token");
    localStorage.removeItem("cctv_admin_user");
  };

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: Boolean(token), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
