import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface Teacher {
  id:       number;
  name:     string;
  username: string;
  section?: string;
}

interface AuthContextType {
  teacher:  Teacher | null;
  token:    string | null;
  login:    (token: string, teacher: Teacher) => void;
  logout:   () => void;
  isAuthed: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(() => {
    const stored = localStorage.getItem('teacher');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('authToken')
  );

  const login = (newToken: string, newTeacher: Teacher) => {
    setToken(newToken);
    setTeacher(newTeacher);
    localStorage.setItem('authToken',  newToken);
    localStorage.setItem('teacher',    JSON.stringify(newTeacher));
    localStorage.setItem('teacherId',  String(newTeacher.id));
    localStorage.setItem('teacherName', newTeacher.name);
  };

  const logout = () => {
    setToken(null);
    setTeacher(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('teacher');
    localStorage.removeItem('teacherId');
    localStorage.removeItem('teacherName');
  };

  return (
    <AuthContext.Provider value={{ teacher, token, login, logout, isAuthed: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}