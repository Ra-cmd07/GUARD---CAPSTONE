import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Paper, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar, Button,
  Select, MenuItem, TextField, CircularProgress, Snackbar, Alert,
  Tooltip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider,
} from '@mui/material';
import {
  CheckCircle, Cancel, AccessTime, People, Menu,
  Edit, Logout, Refresh, FileDownload, Dashboard,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import type { AttendanceRecord, AttendanceStats, TeacherProfile } from '../types';

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <Paper elevation={2} sx={{ p: 2, borderRadius: 2, borderTop: `4px solid ${color}`, textAlign: 'center' }}>
      <Typography variant="h4" fontWeight={800} color={color}>{value}</Typography>
      <Box display="flex" alignItems="center" justifyContent="center" gap={0.5} mt={0.5}>
        {icon}
        <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">{label}</Typography>
      </Box>
    </Paper>
  );
}

// ─── Override Dialog ──────────────────────────────────────────────────
function OverrideDialog({
  open, record, onClose, onSaved,
}: { open: boolean; record: AttendanceRecord | null; onClose: () => void; onSaved: () => void }) {
  const [status,  setStatus]  = useState('');
  const [session, setSession] = useState('');
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (record) { setStatus(record.status); setSession(record.session); setReason(''); setError(''); }
  }, [record]);

  const handleSave = async () => {
    if (!record) return;
    setLoading(true); setError('');
    try {
      await api.patch(`/attendance/${record.id}`, { status, session, reason });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ bgcolor: '#0b4d79', color: '#fff' }}>
        Override Attendance — {record?.student_name}
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="body2" color="text.secondary" mb={2}>
          ⚠️ This override will be recorded in the audit log.
        </Typography>
        <FormControl_ label="Status">
          <Select value={status} onChange={e => setStatus(e.target.value)} size="small" fullWidth>
            {['Time-In','Time-Out','Late','Absent'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl_>
        <FormControl_ label="Session">
          <Select value={session} onChange={e => setSession(e.target.value)} size="small" fullWidth>
            <MenuItem value="AM">AM</MenuItem>
            <MenuItem value="PM">PM</MenuItem>
          </Select>
        </FormControl_>
        <TextField
          label="Reason for override"
          fullWidth multiline rows={2} size="small"
          value={reason} onChange={e => setReason(e.target.value)}
          sx={{ mt: 1.5 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={18} /> : 'Save Override'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function FormControl_({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box mb={1.5}>
      <Typography variant="caption" fontWeight={700} color="text.secondary">{label}</Typography>
      {children}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function TeacherDashboardPage() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const profile          = user?.profile as TeacherProfile | null;

  const [rows,        setRows]        = useState<AttendanceRecord[]>([]);
  const [stats,       setStats]       = useState<AttendanceStats | null>(null);
  const [date,        setDate]        = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading,     setLoading]     = useState(false);
  const [overrideRec, setOverrideRec] = useState<AttendanceRecord | null>(null);
  const [snack,       setSnack]       = useState({ open: false, msg: '', sev: 'success' as any });

  const showSnack = (msg: string, sev: any = 'success') => setSnack({ open: true, msg, sev });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [attRes, statsRes] = await Promise.all([
        api.get(`/attendance?date=${date}`),
        api.get(`/attendance/stats?date=${date}`),
      ]);
      setRows(attRes.data);
      setStats(statsRes.data);
    } catch {
      showSnack('Failed to load attendance', 'error');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const STATUS_COLOR: Record<string, any> = {
    'Time-In': 'success', 'Time-Out': 'info', Late: 'warning', Absent: 'error',
  };

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#f5f7fa' }}>
      {/* Sidebar */}
      <Box sx={{
        width: 220, bgcolor: '#0b4d79', color: '#fff',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
      }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <Typography variant="h6" fontWeight={800}>ATTENDBOX</Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>Teacher Portal</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 1.5, borderRadius: 2, mb: 2 }}>
            <Typography fontWeight={700}>{profile?.name || user?.username}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>{profile?.section || '—'}</Typography>
          </Box>
          {profile?.subject && (
            <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
              📚 {profile.subject}
            </Typography>
          )}
          {profile?.room && (
            <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
              🏫 Room: {profile.room}
            </Typography>
          )}
          {profile?.schedule && (
            <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
              ⏰ {profile.schedule}
            </Typography>
          )}
        </Box>
        
        {/* Navigation Menu */}
        <Box sx={{ px: 2, pb: 2 }}>
          <Button
            fullWidth
            startIcon={<Dashboard />}
            onClick={() => navigate('/teacher')}
            sx={{
              color: '#fff',
              justifyContent: 'flex-start',
              mb: 1,
              bgcolor: 'rgba(255,255,255,0.15)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
            }}
          >
            Dashboard
          </Button>
        </Box>
        <Box flex={1} />
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <Button fullWidth variant="contained" startIcon={<Logout />} onClick={handleLogout}
            sx={{ bgcolor: '#dc3545', '&:hover': { bgcolor: '#b02a37' } }}>
            Logout
          </Button>
        </Box>
      </Box>

      {/* Main */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <Box sx={{ bgcolor: '#fff', px: 3, py: 1.5, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" fontWeight={700} flex={1}>
            Daily Attendance — {profile?.section || 'My Class'}
          </Typography>
          <TextField
            type="date" size="small" value={date}
            onChange={e => setDate(e.target.value)}
            sx={{ width: 160 }}
          />
          <Button startIcon={<Refresh />} variant="outlined" size="small" onClick={fetchData}>
            Refresh
          </Button>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {/* Stats */}
          <Grid container spacing={2} mb={3}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Present" value={(stats?.present || 0)} color="#2e7d32" icon={<CheckCircle sx={{ fontSize: 14, color: '#2e7d32' }} />} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Absent" value={(stats?.Absent || 0)} color="#c62828" icon={<Cancel sx={{ fontSize: 14, color: '#c62828' }} />} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Late" value={(stats?.Late || 0)} color="#e65100" icon={<AccessTime sx={{ fontSize: 14, color: '#e65100' }} />} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Total" value={rows.length} color="#1565c0" icon={<People sx={{ fontSize: 14, color: '#1565c0' }} />} />
            </Grid>
          </Grid>

          {/* Table */}
          <Paper elevation={2} sx={{ borderRadius: 2 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography fontWeight={700}>Student Attendance List</Typography>
              <Chip label={`${rows.length} records`} size="small" variant="outlined" />
            </Box>
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Student Name</TableCell>
                    <TableCell>Time In</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Photo</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Override</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                        No attendance records for this date
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map(r => (
                    <TableRow key={r.id} hover sx={{ bgcolor: r.is_overridden ? '#fff9c4' : 'inherit' }}>
                      <TableCell>
                        <b>{r.student_name}</b>
                        {r.is_overridden ? <Chip label="overridden" size="small" sx={{ ml: 1, fontSize: 10 }} color="warning" variant="outlined" /> : null}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.78rem' }}>
                        {r.time_in || (r.timestamp ? format(new Date(r.timestamp), 'hh:mm a') : '—')}
                      </TableCell>
                      <TableCell>
                        <Chip label={r.scan_method || 'QR'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {r.photo_path
                          ? <Avatar
                              src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${r.photo_path}`}
                              variant="rounded"
                              sx={{ width: 36, height: 36 }}
                            />
                          : <Avatar variant="rounded" sx={{ width: 36, height: 36, bgcolor: '#e0e0e0', fontSize: 11, color: '#666' }}>N/A</Avatar>
                        }
                      </TableCell>
                      <TableCell>
                        <Chip label={r.status} size="small" color={STATUS_COLOR[r.status] || 'default'} sx={{ fontWeight: 700 }} />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Override attendance">
                          <IconButton size="small" color="warning" onClick={() => setOverrideRec(r)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Box>

      {/* Override Dialog */}
      <OverrideDialog
        open={!!overrideRec}
        record={overrideRec}
        onClose={() => setOverrideRec(null)}
        onSaved={() => { showSnack('Attendance updated'); fetchData(); }}
      />

      {/* Snackbar */}
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
