import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user:     UserProfile | null;
  token:    string | null;
  role:     UserRole | null;
  login:    (token: string, user: UserProfile) => void;
  logout:   () => void;
  isAuthed: boolean;
  // Legacy aliases
  teacher:  UserProfile | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try { return JSON.parse(localStorage.getItem('attUser') || 'null'); }
    catch { return null; }
  });
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('authToken')
  );

  const login = (newToken: string, newUser: UserProfile) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('attUser',   JSON.stringify(newUser));
    // legacy keys
    localStorage.setItem('teacherId',   String(newUser.id));
    localStorage.setItem('teacherName', (newUser.profile as any)?.name || newUser.username);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('attUser');
    localStorage.removeItem('teacherId');
    localStorage.removeItem('teacherName');
    localStorage.removeItem('teacher');
  };

  return (
    <AuthContext.Provider value={{
      user, token,
      role:     user?.role ?? null,
      login, logout,
      isAuthed: !!token,
      teacher:  user,   // legacy compat
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
