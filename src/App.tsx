import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import type { UserRole } from './types';
import LoginPage           from './pages/LoginPage';
import AdminDashboardPage  from './pages/AdminDashboardPage';
import TeacherDashboardPage from './pages/TeacherDashboardPageOld';
import ParentDashboardPage  from './pages/ParentDashboardPage';
import StudentPortalPage   from './pages/StudentPortalPage';
import DashboardPage       from './pages/DashboardPage';   // legacy teacher QR dashboard
import StudentsPage        from './pages/StudentPage';
import StudentRegistrationPage from './pages/StudentRegistrationPage';
import LocationTrackingPage from './pages/LocationTrackingPage';
import KioskPage           from './pages/KioskPage';

// ─── Route guard — redirects to login if not authed ───────────────────
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthed } = useAuth();
  return isAuthed ? <>{children}</> : <Navigate to="/login" replace />;
}

// ─── Role guard — redirects to appropriate dashboard if wrong role ────
function RoleRoute({ role, children }: { role: UserRole | UserRole[]; children: React.ReactNode }) {
  const { isAuthed, role: userRole } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  const allowed = Array.isArray(role) ? role : [role];
  if (!userRole || !allowed.includes(userRole)) {
    return <Navigate to={roleHome(userRole)} replace />;
  }
  return <>{children}</>;
}

function roleHome(role: UserRole | null): string {
  switch (role) {
    case 'admin':   return '/admin';
    case 'teacher': return '/teacher';
    case 'parent':  return '/parent';
    case 'student': return '/student-portal';
    default:        return '/login';
  }
}

// ─── Root redirect — sends logged-in user to their dashboard ─────────
function RootRedirect() {
  const { isAuthed, role } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(role)} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"   element={<LoginPage />} />
      <Route path="/kiosk"   element={<KioskPage />} />

      {/* Role-based dashboards */}
      <Route path="/admin" element={
        <RoleRoute role="admin"><AdminDashboardPage /></RoleRoute>
      } />
      <Route path="/teacher" element={
        <RoleRoute role="teacher"><TeacherDashboardPage /></RoleRoute>
      } />
      <Route path="/parent" element={
        <RoleRoute role="parent"><ParentDashboardPage /></RoleRoute>
      } />
      <Route path="/student-portal" element={
        <RoleRoute role="student"><StudentPortalPage /></RoleRoute>
      } />

      {/* Legacy teacher routes (backwards compat) */}
      <Route path="/dashboard" element={
        <PrivateRoute><DashboardPage /></PrivateRoute>
      } />
      <Route path="/students" element={
        <PrivateRoute><StudentsPage /></PrivateRoute>
      } />
      
      {/* Admin student registration */}
      <Route path="/admin/students/register" element={
        <RoleRoute role="admin"><StudentRegistrationPage /></RoleRoute>
      } />

      {/* Location Tracking (Admin & Teacher) */}
      <Route path="/location-tracking" element={
        <RoleRoute role={['admin', 'teacher']}><LocationTrackingPage /></RoleRoute>
      } />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
