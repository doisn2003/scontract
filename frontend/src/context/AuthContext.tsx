import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import type { User, AuthState, LoginPayload, RegisterPayload, ApiResponse } from '../types';

interface AuthContextType extends AuthState {
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<{ walletAddress?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('scontract_token');
    const userStr = localStorage.getItem('scontract_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        setState({ user, token, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem('scontract_token');
        localStorage.removeItem('scontract_user');
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const { data } = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', payload);

    if (data.success && data.data) {
      const { user, token } = data.data;
      localStorage.setItem('scontract_token', token);
      localStorage.setItem('scontract_user', JSON.stringify(user));
      setState({ user, token, isAuthenticated: true, isLoading: false });
    } else {
      throw new Error(data.message || 'Login failed');
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { data } = await api.post<ApiResponse<{
      user: User;
      token: string;
      wallet: { address: string };
    }>>('/auth/register', payload);

    if (data.success && data.data) {
      const { user, token, wallet } = data.data;
      localStorage.setItem('scontract_token', token);
      localStorage.setItem('scontract_user', JSON.stringify(user));
      setState({ user, token, isAuthenticated: true, isLoading: false });
      return { walletAddress: wallet.address };
    } else {
      throw new Error(data.message || 'Registration failed');
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('scontract_token');
    localStorage.removeItem('scontract_user');
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<ApiResponse<User>>('/auth/me');
      if (data.success && data.data) {
        const user = data.data;
        localStorage.setItem('scontract_user', JSON.stringify(user));
        setState(prev => ({ ...prev, user }));
      }
    } catch {
      // Token may have expired
      logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
