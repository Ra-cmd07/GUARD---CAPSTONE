import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  role: UserRole | null;
  login: (token: string, user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
  isAuthed: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load auth state on app start
  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    try {
      const [savedToken, savedUser] = await AsyncStorage.multiGet(['authToken', 'user']);
      
      if (savedToken[1]) setToken(savedToken[1]);
      if (savedUser[1]) setUser(JSON.parse(savedUser[1]));
    } catch (error) {
      console.error('Failed to load auth state:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (newToken: string, newUser: UserProfile) => {
    setToken(newToken);
    setUser(newUser);
    await AsyncStorage.multiSet([
      ['authToken', newToken],
      ['user', JSON.stringify(newUser)],
    ]);
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove(['authToken', 'user']);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role ?? null,
        login,
        logout,
        isAuthed: !!token,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
