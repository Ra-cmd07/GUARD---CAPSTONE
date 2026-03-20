import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage  from './pages/StudentPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthed } = useAuth();
  return isAuthed ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={
        <PrivateRoute><DashboardPage /></PrivateRoute>
      } />
      <Route path="/students" element={
        <PrivateRoute><StudentsPage /></PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}