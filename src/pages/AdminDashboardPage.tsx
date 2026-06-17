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
  CheckCircle, Cancel, AccessTime, Assessment,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import type { AdminStats, AttendanceRecord, Kiosk } from '../types';

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

function CreateUserDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    username: '', password: '', role: 'teacher', name: '',
    gender: '', section: '', contact: '', address: '', lrn: '', grade: '',
    subject: '', room: '', schedule: '', relationship: '', employee_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('/admin/users', form);
      onCreated();
      onClose();
      setForm({ username:'', password:'', role:'teacher', name:'', gender:'', section:'', contact:'', address:'', lrn:'', grade:'', subject:'', room:'', schedule:'', relationship:'', employee_id:'' });
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#0b4d79', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
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

  const showSnack = (msg: string, sev: any = 'success') => setSnack({ open: true, msg, sev });

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

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const filteredUsers = tab === 'students'
    ? users.filter(u => u.role === 'student')
    : users;

  const STATUS_COLOR: Record<string, any> = {
    'Time-In': 'success', 'Time-Out': 'info', Late: 'warning', Absent: 'error',
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#f5f7fa' }}>
      {/* ── Sidebar ── */}
      <Box sx={{
        width: sideOpen ? 240 : 0,
        transition: 'width .25s',
        overflow: 'hidden',
        bgcolor: '#0b4d79', color: '#fff',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
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

      {/* ── Main ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <Box sx={{ bgcolor: '#fff', px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => setSideOpen(o => !o)}><Menu /></IconButton>
          <Typography variant="h6" fontWeight={700} flex={1}>{NAV.find(n => n.id === tab)?.label}</Typography>
          <Typography variant="body2" color="text.secondary">
            📅 {format(new Date(), 'MMMM d, yyyy')}
          </Typography>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>

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
                <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography fontWeight={700}>Recent Attendance Logs</Typography>
                  <Button size="small" variant="outlined" onClick={loadDashboard}>Refresh</Button>
                </Box>
                <TableContainer sx={{ maxHeight: 380 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Student</TableCell>
                        <TableCell>Grade/Section</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {logs.length === 0 && (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No records today</TableCell></TableRow>
                      )}
                      {logs.map(r => (
                        <TableRow key={r.id} hover>
                          <TableCell><b>{r.student_name}</b></TableCell>
                          <TableCell>{r.grade} {r.section}</TableCell>
                          <TableCell>{r.timestamp ? format(new Date(r.timestamp), 'hh:mm a') : '—'}</TableCell>
                          <TableCell><Chip label={r.scan_method || 'QR'} size="small" /></TableCell>
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
                <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setCreateOpen(true)}>
                  Add User
                </Button>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.length === 0 && (
                      <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No users found</TableCell></TableRow>
                    )}
                    {filteredUsers.map(u => (
                      <TableRow key={u.id} hover>
                        <TableCell><b>{u.username}</b></TableCell>
                        <TableCell>
                          <Chip label={u.role} size="small"
                            color={u.role === 'admin' ? 'error' : u.role === 'teacher' ? 'primary' : u.role === 'parent' ? 'warning' : 'default'} />
                        </TableCell>
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
            <Grid container spacing={2}>
              {kiosks.length === 0 && (
                <Grid size={{ xs: 12 }}>
                  <Typography color="text.secondary" textAlign="center" p={4}>No active kiosks</Typography>
                </Grid>
              )}
              {kiosks.map(k => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={k.id}>
                  <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2, borderTop: `4px solid ${k.is_active ? '#2e7d32' : '#bdbdbd'}` }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography fontWeight={700}>{k.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{k.location}</Typography>
                        <Typography variant="caption" color="text.secondary">{k.gate}</Typography>
                      </Box>
                      <Chip label={k.is_active ? 'Online' : 'Offline'} size="small" color={k.is_active ? 'success' : 'default'} />
                    </Box>
                    {k.last_ping && (
                      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                        Last ping: {format(new Date(k.last_ping), 'MM/dd hh:mm a')}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

          {/* ── SMS Logs Tab ── */}
          {tab === 'sms' && (
            <Paper elevation={2} sx={{ borderRadius: 2 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
                <Typography fontWeight={700}>SMS Notification Logs</Typography>
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
            <Paper elevation={2} sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
              <Assessment sx={{ fontSize: 64, color: '#0b4d79', mb: 2 }} />
              <Typography variant="h6" fontWeight={700} gutterBottom>Attendance Reports</Typography>
              <Typography color="text.secondary" mb={3}>
                Generate attendance summaries and analytics for any date range.
              </Typography>
              <Button variant="contained" onClick={() => navigate('/attendance')}>
                View Attendance Records
              </Button>
            </Paper>
          )}

        </Box>
      </Box>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { showSnack('User created successfully'); loadUsers(); }}
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
