import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Paper, Typography, Chip, Avatar, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Snackbar, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip,
} from '@mui/material';
import {
  People, School, Router, Sms, Dashboard, Logout, Add, Edit,
  ToggleOn, ToggleOff, LockReset, Menu, Close, PersonAdd,
  CheckCircle, Cancel, AccessTime, Assessment, PhotoCamera, Delete,
  QrCode2, Bluetooth, CreditCard, Download,
} from '@mui/icons-material';
import { QRCodeCanvas } from 'qrcode.react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import type { AdminStats, AttendanceRecord, Kiosk } from '../types';
import AttendancePhotoDialog from '../components/AttendancePhotoDialog';
import theme from '../theme/professionalTheme';
import ReportsPage from './ReportsPage';
import KiosksPage from './KiosksPage';

const NAV = [
  { id: 'dashboard', label: 'Dashboard',  icon: <Dashboard /> },
  { id: 'users',     label: 'Users',      icon: <People /> },
  { id: 'students',  label: 'Students',   icon: <School /> },
  { id: 'kiosks',    label: 'Kiosks',     icon: <Router /> },
  { id: 'sms',       label: 'SMS Logs',   icon: <Sms /> },
  { id: 'reports',   label: 'Reports',    icon: <Assessment /> },
];

type Tab = 'dashboard' | 'users' | 'students' | 'kiosks' | 'sms' | 'reports';

function StatCard({ label, value, icon, color }: { label: string; value: any; icon: React.ReactNode; color: string }) {
  return (
    <Paper elevation={3} sx={{ p: 2.5, borderRadius: 2, borderLeft: `5px solid ${color}` }}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight={800} color={color}>{value ?? '—'}</Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>{label}</Typography>
        </Box>
        <Avatar sx={{ bgcolor: color, width: 48, height: 48 }}>{icon}</Avatar>
      </Box>
    </Paper>
  );
}

function AddParentDialog({ open, onClose, student, onCreated }: { 
  open: boolean; 
  onClose: () => void; 
  student: any;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    relationship: 'Father',
    contact: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.username || !form.password || !form.name) {
      setError('Username, password, and name are required');
      return;
    }

    if (!student?.profileId) {
      setError('Student profile ID not found');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.post(`/admin/students/${student.profileId}/add-parent`, form);
      onCreated();
      onClose();
      setForm({
        username: '',
        password: '',
        name: '',
        relationship: 'Father',
        contact: '',
        address: '',
      });
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create parent account');
    } finally {
      setLoading(false);
    }
  };

  if (!student) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#3b82f6', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6">Add Parent/Guardian</Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            For student: {student.username} {student.name && `(${student.name})`}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff' }}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Username *"
              fullWidth
              value={form.username}
              onChange={e => set('username', e.target.value)}
              placeholder="parent_username"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Password *"
              type="password"
              fullWidth
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="Password"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Full Name *"
              fullWidth
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="John Doe"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Relationship *</InputLabel>
              <Select
                value={form.relationship}
                label="Relationship *"
                onChange={e => set('relationship', e.target.value)}
              >
                <MenuItem value="Father">Father</MenuItem>
                <MenuItem value="Mother">Mother</MenuItem>
                <MenuItem value="Guardian">Guardian</MenuItem>
                <MenuItem value="Grandfather">Grandfather</MenuItem>
                <MenuItem value="Grandmother">Grandmother</MenuItem>
                <MenuItem value="Uncle">Uncle</MenuItem>
                <MenuItem value="Aunt">Aunt</MenuItem>
                <MenuItem value="Sibling">Sibling</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Contact"
              fullWidth
              value={form.contact}
              onChange={e => set('contact', e.target.value)}
              placeholder="09XXXXXXXXX"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Address"
              fullWidth
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="City, Province"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Create Parent Account'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CreateUserDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    username: '', password: '', role: 'teacher', name: '',
    gender: '', section: '', contact: '', address: '', lrn: '', grade: '',
    subject: '', room: '', schedule: '', relationship: '', employee_id: '',
  });
  const [parents, setParents] = useState([
    { username: '', password: '', name: '', relationship: 'Father', contact: '' },
    { username: '', password: '', name: '', relationship: 'Mother', contact: '' },
    { username: '', password: '', name: '', relationship: 'Guardian', contact: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setParent = (index: number, k: string, v: string) => {
    setParents(p => p.map((parent, i) => i === index ? { ...parent, [k]: v } : parent));
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      // If student role, include parent accounts
      const payload = form.role === 'student' 
        ? { ...form, parents: parents.filter(p => p.username && p.name) }
        : form;
      
      await api.post('/admin/users', payload);
      onCreated();
      onClose();
      setForm({ username:'', password:'', role:'teacher', name:'', gender:'', section:'', contact:'', address:'', lrn:'', grade:'', subject:'', room:'', schedule:'', relationship:'', employee_id:'' });
      setParents([
        { username: '', password: '', name: '', relationship: 'Father', contact: '' },
        { username: '', password: '', name: '', relationship: 'Mother', contact: '' },
        { username: '', password: '', name: '', relationship: 'Guardian', contact: '' },
      ]);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: '#3b82f6', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
        <span>Create New User</span>
        <IconButton onClick={onClose} sx={{ color: '#fff' }}><Close /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Username *" fullWidth value={form.username} onChange={e => set('username', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Password *" type="password" fullWidth value={form.password} onChange={e => set('password', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Role *</InputLabel>
              <Select value={form.role} label="Role *" onChange={e => set('role', e.target.value)}>
                {['admin','teacher','parent','student'].map(r => <MenuItem key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Full Name *" fullWidth value={form.name} onChange={e => set('name', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select value={form.gender} label="Gender" onChange={e => set('gender', e.target.value)}>
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Contact" fullWidth value={form.contact} onChange={e => set('contact', e.target.value)} />
          </Grid>
          {form.role === 'teacher' && <>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Employee ID" fullWidth value={form.employee_id} onChange={e => set('employee_id', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Section/Grade" fullWidth value={form.section} onChange={e => set('section', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Subject" fullWidth value={form.subject} onChange={e => set('subject', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Room" fullWidth value={form.room} onChange={e => set('room', e.target.value)} /></Grid>
          </>}
          {form.role === 'student' && <>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="LRN *" fullWidth value={form.lrn} onChange={e => set('lrn', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Grade" fullWidth value={form.grade} onChange={e => set('grade', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Section" fullWidth value={form.section} onChange={e => set('section', e.target.value)} /></Grid>
            
            {/* Parent Accounts Section */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2, mb: 1, color: '#3b82f6' }}>
                👨‍👩‍👦 Parent/Guardian Accounts (Optional)
              </Typography>
              <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 2 }}>
                Add up to 3 parent/guardian accounts. At least one parent account is recommended.
              </Typography>
            </Grid>

            {parents.map((parent, index) => (
              <Grid size={{ xs: 12 }} key={index}>
                <Paper sx={{ p: 2, bgcolor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 2, mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5, color: '#374151' }}>
                    {index === 0 ? '👨 Parent 1' : index === 1 ? '👩 Parent 2' : '👤 Guardian (Optional)'}
                  </Typography>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField 
                        label="Username" 
                        size="small"
                        fullWidth 
                        value={parent.username} 
                        onChange={e => setParent(index, 'username', e.target.value)}
                        placeholder={index === 2 ? 'Optional' : ''}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField 
                        label="Password" 
                        size="small"
                        type="password"
                        fullWidth 
                        value={parent.password} 
                        onChange={e => setParent(index, 'password', e.target.value)}
                        placeholder={index === 2 ? 'Optional' : ''}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField 
                        label="Full Name" 
                        size="small"
                        fullWidth 
                        value={parent.name} 
                        onChange={e => setParent(index, 'name', e.target.value)}
                        placeholder={index === 2 ? 'Optional' : ''}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Relationship</InputLabel>
                        <Select 
                          value={parent.relationship} 
                          label="Relationship"
                          onChange={e => setParent(index, 'relationship', e.target.value)}
                        >
                          <MenuItem value="Father">Father</MenuItem>
                          <MenuItem value="Mother">Mother</MenuItem>
                          <MenuItem value="Guardian">Guardian</MenuItem>
                          <MenuItem value="Grandfather">Grandfather</MenuItem>
                          <MenuItem value="Grandmother">Grandmother</MenuItem>
                          <MenuItem value="Uncle">Uncle</MenuItem>
                          <MenuItem value="Aunt">Aunt</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TextField 
                        label="Contact" 
                        size="small"
                        fullWidth 
                        value={parent.contact} 
                        onChange={e => setParent(index, 'contact', e.target.value)}
                        placeholder="09xxxxxxxxx"
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            ))}
          </>}
          {form.role === 'parent' && <>
            <Grid size={{ xs: 12, sm: 6 }}><TextField label="Relationship" fullWidth value={form.relationship} onChange={e => set('relationship', e.target.value)} /></Grid>
          </>}
          <Grid size={{ xs: 12 }}><TextField label="Address" fullWidth value={form.address} onChange={e => set('address', e.target.value)} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Create User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [tab,        setTab]        = useState<Tab>('dashboard');
  const [sideOpen,   setSideOpen]   = useState(true);
  const [stats,      setStats]      = useState<AdminStats | null>(null);
  const [logs,       setLogs]       = useState<AttendanceRecord[]>([]);
  const [kiosks,     setKiosks]     = useState<Kiosk[]>([]);
  const [users,      setUsers]      = useState<any[]>([]);
  const [smsLogs,    setSmsLogs]    = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [snack,      setSnack]      = useState({ open: false, msg: '', sev: 'success' as any });
  const [addParentOpen, setAddParentOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Photo viewer state
  const [photoDialog, setPhotoDialog] = useState({
    open: false,
    photoUrl: null as string | null,
    studentName: '',
    status: '',
    timestamp: null as Date | string | null,
    method: '',
  });

  const showSnack = (msg: string, sev: any = 'success') => setSnack({ open: true, msg, sev });

  const handleViewPhoto = (record: AttendanceRecord) => {
    setPhotoDialog({
      open: true,
      photoUrl: record.photo_path,
      studentName: record.student_name,
      status: record.status,
      timestamp: record.timestamp || record.date,
      method: record.scan_method || 'N/A',
    });
  };

  const loadDashboard = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/dashboard');
      setStats(data.stats);
      setLogs(data.recentLogs);
      setKiosks(data.activeKiosks);
    } catch { /* silent */ }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
    } catch { /* silent */ }
  }, []);

  const loadSmsLogs = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/sms-logs');
      setSmsLogs(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Auto-refresh dashboard every 5 seconds when on dashboard tab
  useEffect(() => {
    if (tab === 'dashboard') {
      const interval = setInterval(() => {
        loadDashboard();
      }, 5000); // Refresh every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [tab, loadDashboard]);

  useEffect(() => {
    if (tab === 'users' || tab === 'students') loadUsers();
    if (tab === 'sms') loadSmsLogs();
  }, [tab, loadUsers, loadSmsLogs]);

  const handleToggleStatus = async (userId: number) => {
    try {
      await api.patch(`/admin/users/${userId}/toggle-status`);
      showSnack('User status updated');
      loadUsers();
    } catch { showSnack('Failed to update status', 'error'); }
  };

  const handleResetPassword = async (userId: number) => {
    const pw = window.prompt('Enter new password:');
    if (!pw) return;
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { newPassword: pw });
      showSnack('Password reset successfully');
    } catch { showSnack('Failed to reset password', 'error'); }
  };

  // QR Code Download Handler
  const handleDownloadQR = async (student: any) => {
    try {
      // Fetch full student details if needed
      if (!student.lrn) {
        const { data } = await api.get(`/admin/users/${student.id}`);
        student = { ...student, ...data.profile };
      }

      // Create QR payload (same format as student portal)
      const qrPayload = JSON.stringify({
        lrn: student.lrn,
        name: student.name,
        grade: student.grade,
        section: student.section,
      });

      // Create a temporary container for the QR canvas
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      // Create canvas element
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);

      // Generate QR code using qrcode library
      const QRCode = await import('qrcode');
      await QRCode.toCanvas(canvas, qrPayload, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      // Download the QR code
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `QR_${student.username || student.lrn}_${student.name.replace(/\s+/g, '_')}.png`;
      link.href = url;
      link.click();

      // Cleanup
      document.body.removeChild(container);
      showSnack(`✅ QR code downloaded for ${student.name}`, 'success');
    } catch (error) {
      console.error('QR generation error:', error);
      showSnack('Failed to generate QR code', 'error');
    }
  };

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const filteredUsers = tab === 'students'
    ? users.filter(u => u.role === 'student')
    : users;

  const STATUS_COLOR: Record<string, any> = {
    'Time-In': 'success', 'Time-Out': 'info', Late: 'warning', Absent: 'error',
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: '#2563eb', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <Box sx={{
        width: sideOpen ? 240 : 0,
        transition: 'width .25s',
        overflow: 'hidden',
        background: '#3b82f6',
        color: '#fff',
        display: 'flex', 
        flexDirection: 'column',
        flexShrink: 0,
        borderRight: 'none',  // Remove any border
      }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <Typography variant="h6" fontWeight={800}>ATTENDBOX</Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>Administrator</Typography>
        </Box>
        <Box sx={{ flex: 1, py: 1 }}>
          {NAV.map(n => (
            <Box key={n.id}
              onClick={() => setTab(n.id as Tab)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 2.5, py: 1.5, cursor: 'pointer',
                bgcolor: tab === n.id ? 'rgba(255,255,255,0.2)' : 'transparent',
                borderLeft: tab === n.id ? '4px solid #fbc02d' : '4px solid transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}>
              {n.icon}
              <Typography variant="body2" fontWeight={tab === n.id ? 700 : 400}>{n.label}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <Typography variant="caption" sx={{ opacity: 0.7 }} display="block" mb={1}>
            👤 {(user?.profile as any)?.name || user?.username}
          </Typography>
          <Button fullWidth variant="contained" startIcon={<Logout />} onClick={handleLogout}
            sx={{ bgcolor: '#dc3545', '&:hover': { bgcolor: '#b02a37' } }}>
            Logout
          </Button>
        </Box>
      </Box>

      {/* ── Main Content Area ── */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
      }}>
        {/* Topbar */}
        <Box sx={{ 
          bgcolor: '#fff', 
          px: 2, 
          py: 1.5, 
          borderBottom: '1px solid #e0e0e0', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <IconButton onClick={() => setSideOpen(o => !o)}><Menu /></IconButton>
          <Typography variant="h6" fontWeight={700} flex={1}>{NAV.find(n => n.id === tab)?.label}</Typography>
          <Typography variant="body2" color="text.secondary">
            📅 {format(new Date(), 'MMMM d, yyyy')}
          </Typography>
        </Box>

        {/* Content Area */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto', 
          p: 3,
        }}>

          {/* ── Dashboard Tab ── */}
          {tab === 'dashboard' && (
            <>
              <Grid container spacing={2.5} mb={3}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard label="Total Students" value={stats?.total_students} icon={<School />} color="#1565c0" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard label="Attendance Rate" value={stats?.attendance_rate_today != null ? `${stats.attendance_rate_today}%` : '—'} icon={<CheckCircle />} color="#2e7d32" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard label="Active Kiosks" value={stats?.active_kiosks} icon={<Router />} color="#e65100" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard label="SMS Sent Today" value={stats?.sms_today} icon={<Sms />} color="#6a1b9a" />
                </Grid>
              </Grid>

              <Paper elevation={2} sx={{ borderRadius: 2 }}>
                <Box sx={{ 
                  p: 2.5, 
                  background: theme.colors.primary.gradient,
                  color: '#fff',
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography 
                      fontWeight={theme.typography.fontWeight.bold}
                      sx={{ fontFamily: theme.typography.fontFamily.display }}
                    >
                      Recent Attendance Logs
                    </Typography>
                    <Chip 
                      label="Live" 
                      size="small" 
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.3)',
                        fontWeight: theme.typography.fontWeight.semibold,
                        fontSize: '0.7rem',
                        height: 20,
                        animation: 'pulse 2s ease-in-out infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.5 },
                        }
                      }}
                    />
                  </Box>
                  <Button size="small" variant="outlined" onClick={loadDashboard}>Refresh Now</Button>
                </Box>
                <TableContainer sx={{ maxHeight: 380 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Student</TableCell>
                        <TableCell>Grade/Section</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Photo</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {logs.length === 0 && (
                        <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No records today</TableCell></TableRow>
                      )}
                      {logs.map(r => (
                        <TableRow key={r.id} hover>
                          <TableCell><b>{r.student_name}</b></TableCell>
                          <TableCell>{r.grade} {r.section}</TableCell>
                          <TableCell>{r.timestamp ? format(new Date(r.timestamp), 'hh:mm a') : '—'}</TableCell>
                          <TableCell><Chip label={r.scan_method || 'QR'} size="small" /></TableCell>
                          <TableCell>
                            {r.photo_path ? (
                              <Tooltip title="View Photo">
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewPhoto(r)}
                                  sx={{ p: 0.5 }}
                                >
                                  <PhotoCamera fontSize="small" color="primary" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip label={r.status} size="small" color={STATUS_COLOR[r.status] || 'default'} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}

          {/* ── Users / Students Tab ── */}
          {(tab === 'users' || tab === 'students') && (
            <Paper elevation={2} sx={{ borderRadius: 2 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontWeight={700}>{tab === 'students' ? 'Students' : 'All Users'}</Typography>
                <Box display="flex" gap={2}>
                  {tab === 'students' && (
                    <Button 
                      variant="contained" 
                      startIcon={<School />} 
                      onClick={() => navigate('/admin/students/register')}
                      sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
                    >
                      Register Student
                    </Button>
                  )}
                  <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setCreateOpen(true)}>
                    Add User
                  </Button>
                </Box>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell>Role</TableCell>
                      {tab === 'students' && <TableCell>Preferred Method</TableCell>}
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.length === 0 && (
                      <TableRow><TableCell colSpan={tab === 'students' ? 6 : 5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No users found</TableCell></TableRow>
                    )}
                    {filteredUsers.map(u => (
                      <TableRow key={u.id} hover>
                        <TableCell>
                          {tab === 'students' && u.role === 'student' ? (
                            <Tooltip title="Click to add parent/guardian">
                              <Box
                                component="span"
                                onClick={async () => {
                                  try {
                                    // Fetch full user details including profile ID
                                    const { data } = await api.get(`/admin/users/${u.id}`);
                                    setSelectedStudent({
                                      ...u,
                                      profileId: data.profile?.id,
                                      name: data.profile?.name,
                                      lrn: data.profile?.lrn,
                                    });
                                    setAddParentOpen(true);
                                  } catch (err) {
                                    showSnack('Failed to load student details', 'error');
                                  }
                                }}
                                sx={{
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  color: '#3b82f6',
                                  '&:hover': {
                                    textDecoration: 'underline',
                                  },
                                }}
                              >
                                {u.username}
                              </Box>
                            </Tooltip>
                          ) : (
                            <b>{u.username}</b>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={u.role} size="small"
                            color={u.role === 'admin' ? 'error' : u.role === 'teacher' ? 'primary' : u.role === 'parent' ? 'warning' : 'default'} />
                        </TableCell>
                        {tab === 'students' && (
                          <TableCell>
                            <Chip 
                              label={u.preferred_method || 'QR'} 
                              size="small"
                              icon={
                                u.preferred_method === 'BLE' ? <Bluetooth sx={{ fontSize: 14 }} /> :
                                u.preferred_method === 'RFID' ? <CreditCard sx={{ fontSize: 14 }} /> :
                                <QrCode2 sx={{ fontSize: 14 }} />
                              }
                              sx={{ 
                                bgcolor: u.preferred_method === 'BLE' ? '#e3f2fd' : 
                                        u.preferred_method === 'RFID' ? '#fff3e0' : '#e8f5e9',
                                color: u.preferred_method === 'BLE' ? '#1976d2' : 
                                       u.preferred_method === 'RFID' ? '#f57c00' : '#2e7d32',
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Chip
                            label={u.is_active ? 'Active' : 'Inactive'}
                            size="small"
                            color={u.is_active ? 'success' : 'default'}
                            icon={u.is_active ? <CheckCircle sx={{ fontSize: 14 }} /> : <Cancel sx={{ fontSize: 14 }} />}
                          />
                        </TableCell>
                        <TableCell>{u.created_at ? format(new Date(u.created_at), 'MM/dd/yyyy') : '—'}</TableCell>
                        <TableCell align="center">
                          {tab === 'students' && (
                            <Tooltip title="Download QR Code">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => handleDownloadQR(u)}
                              >
                                <Download />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title={u.is_active ? 'Deactivate' : 'Activate'}>
                            <IconButton size="small" color={u.is_active ? 'error' : 'success'}
                              onClick={() => handleToggleStatus(u.id)}>
                              {u.is_active ? <ToggleOff /> : <ToggleOn />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reset Password">
                            <IconButton size="small" color="warning" onClick={() => handleResetPassword(u.id)}>
                              <LockReset />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* ── Kiosks Tab ── */}
          {tab === 'kiosks' && (
            <KiosksPage />
          )}

          {/* ── SMS Logs Tab ── */}
          {tab === 'sms' && (
            <Paper elevation={2} sx={{ borderRadius: 2 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontWeight={700}>SMS Notification Logs</Typography>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<Delete />}
                  onClick={() => {
                    if (window.confirm(`⚠️ Clear all SMS history?\n\nThis will delete ${smsLogs.length} SMS log records.\nThis action cannot be undone.\n\nThe SMS feature will continue to work - new logs will be created when students scan.`)) {
                      api.delete('/admin/sms-logs/clear')
                        .then(() => {
                          setSmsLogs([]);
                          showSnack('SMS history cleared successfully', 'success');
                        })
                        .catch(() => showSnack('Failed to clear SMS history', 'error'));
                    }
                  }}
                  disabled={smsLogs.length === 0}
                  sx={{ textTransform: 'none' }}
                >
                  Clear History ({smsLogs.length})
                </Button>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell>Parent</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Sent At</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {smsLogs.length === 0 && (
                      <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No SMS logs</TableCell></TableRow>
                    )}
                    {smsLogs.map((s: any) => (
                      <TableRow key={s.id} hover>
                        <TableCell>{s.student_name}</TableCell>
                        <TableCell>{s.parent_name || '—'}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{s.phone_number}</TableCell>
                        <TableCell>
                          <Chip label={s.status} size="small"
                            color={s.status === 'sent' ? 'success' : s.status === 'failed' ? 'error' : 'warning'} />
                        </TableCell>
                        <TableCell>{s.created_at ? format(new Date(s.created_at), 'MM/dd hh:mm a') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* ── Reports Tab ── */}
          {tab === 'reports' && (
            <ReportsPage />
          )}

        </Box>
      </Box>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { showSnack('User created successfully'); loadUsers(); }}
      />

      <AddParentDialog
        open={addParentOpen}
        onClose={() => {
          setAddParentOpen(false);
          setSelectedStudent(null);
        }}
        student={selectedStudent}
        onCreated={() => {
          showSnack('Parent account created and linked successfully');
          setAddParentOpen(false);
          setSelectedStudent(null);
        }}
      />

      {/* Photo Dialog */}
      <AttendancePhotoDialog
        open={photoDialog.open}
        onClose={() => setPhotoDialog({ ...photoDialog, open: false })}
        photoUrl={photoDialog.photoUrl}
        studentName={photoDialog.studentName}
        status={photoDialog.status}
        timestamp={photoDialog.timestamp}
        method={photoDialog.method}
      />

      <Snackbar open={snack.open} autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled"
          onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
