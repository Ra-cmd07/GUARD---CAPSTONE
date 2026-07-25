import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Paper, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar, Button,
  Select, MenuItem, TextField, CircularProgress, Snackbar, Alert,
  Tooltip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider,
} from '@mui/material';
import {
  CheckCircle, Cancel, AccessTime, People, Menu, School,
  Edit, Logout, Refresh, FileDownload, Dashboard, PhotoCamera, Description,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import type { AttendanceRecord, AttendanceStats, TeacherProfile } from '../types';
import AttendancePhotoDialog from '../components/AttendancePhotoDialog';
import theme from '../theme/professionalTheme';

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <Paper sx={{ 
      ...theme.components.card.default,
      p: 2.5, 
      borderTop: `4px solid ${color}`, 
      textAlign: 'center',
      '&:hover': theme.components.card.default.hover,
    }}>
      <Typography 
        variant="h4" 
        sx={{
          fontFamily: theme.typography.fontFamily.display,
          fontWeight: theme.typography.fontWeight.extrabold,
          color: color,
        }}
      >
        {value}
      </Typography>
      <Box display="flex" alignItems="center" justifyContent="center" gap={0.5} mt={0.5}>
        {icon}
        <Typography 
          variant="caption" 
          sx={{
            fontFamily: theme.typography.fontFamily.primary,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.neutral[600],
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Typography>
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
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xs" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.elevation4,
        }
      }}
    >
      <DialogTitle sx={{ 
        background: theme.colors.primary.gradient,
        color: '#fff',
        fontFamily: theme.typography.fontFamily.display,
        fontWeight: theme.typography.fontWeight.bold,
      }}>
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
        <Button 
          onClick={onClose} 
          sx={{ ...theme.components.button.secondary }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={loading}
          sx={{
            ...theme.components.button.primary,
            '&:hover': theme.components.button.primary.hover,
          }}
        >
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

  // Auto-refresh every 10 seconds to show new attendance without manual reload
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [fetchData]);

  const STATUS_COLOR: Record<string, any> = {
    'Time-In': 'success', 'Time-Out': 'info', Late: 'warning', Absent: 'error',
  };

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: '#2563eb' }}>
      {/* Sidebar */}
      <Box sx={{
        width: 240, 
        background: '#3b82f6',
        color: '#fff',
        display: 'flex', 
        flexDirection: 'column',
        flexShrink: 0,
        boxShadow: theme.shadows.elevation3,
      }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <School sx={{ color: theme.colors.secondary.main }} />
            <Typography 
              variant="h6" 
              sx={{
                fontFamily: theme.typography.fontFamily.display,
                fontWeight: theme.typography.fontWeight.extrabold,
                color: '#fff',
              }}
            >
              AttendBox
            </Typography>
          </Box>
          <Typography 
            variant="caption" 
            sx={{ 
              opacity: 0.9, 
              color: '#fff',
              fontFamily: theme.typography.fontFamily.primary,
            }}
          >
            Teacher Portal
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Typography 
            variant="caption" 
            sx={{ 
              opacity: 0.7, 
              textTransform: 'uppercase', 
              fontSize: 10, 
              color: '#fff',
              fontFamily: theme.typography.fontFamily.primary,
              fontWeight: theme.typography.fontWeight.semibold,
              display: 'block',
              mb: 0.5,
            }}
          >
            Logged in as
          </Typography>
          <Box sx={{ 
            bgcolor: 'rgba(255,255,255,0.15)', 
            p: 1.5, 
            borderRadius: theme.borderRadius.base, 
            mb: 2,
            borderLeft: '3px solid rgba(255,255,255,0.5)',
          }}>
            <Typography 
              sx={{
                fontWeight: theme.typography.fontWeight.bold,
                color: '#fff',
                fontFamily: theme.typography.fontFamily.primary,
              }}
            >
              {profile?.name || user?.username}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                opacity: 0.9, 
                color: '#fff',
                fontFamily: theme.typography.fontFamily.primary,
              }}
            >
              {profile?.section || '—'}
            </Typography>
          </Box>
          {profile?.subject && (
            <Typography 
              variant="caption" 
              display="block" 
              sx={{ 
                opacity: 0.9, 
                color: '#fff',
                fontFamily: theme.typography.fontFamily.primary,
                mb: 0.5,
              }}
            >
              📚 {profile.subject}
            </Typography>
          )}
          {profile?.room && (
            <Typography 
              variant="caption" 
              display="block" 
              sx={{ 
                opacity: 0.9, 
                color: '#fff',
                fontFamily: theme.typography.fontFamily.primary,
                mb: 0.5,
              }}
            >
              🏫 Room: {profile.room}
            </Typography>
          )}
          {profile?.schedule && (
            <Typography 
              variant="caption" 
              display="block" 
              sx={{ 
                opacity: 0.9, 
                color: '#fff',
                fontFamily: theme.typography.fontFamily.primary,
              }}
            >
              ⏰ {profile.schedule}
            </Typography>
          )}
        </Box>
        
        {/* Navigation Menu */}
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 1 }} />
        
        <Box sx={{ px: 2, pb: 2 }}>
          <Box
            onClick={() => navigate('/teacher')}
            sx={{
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5,
              px: 2, 
              py: 1.5, 
              cursor: 'pointer',
              borderRadius: theme.borderRadius.base,
              bgcolor: 'rgba(255,255,255,0.2)',
              borderLeft: '3px solid #fff',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
              transition: theme.transitions.button,
              color: '#fff',
            }}
          >
            <Dashboard sx={{ color: '#fff' }} />
            <Typography 
              variant="body2" 
              sx={{
                fontWeight: theme.typography.fontWeight.bold,
                color: '#fff',
                fontFamily: theme.typography.fontFamily.primary,
              }}
            >
              Dashboard
            </Typography>
          </Box>
        </Box>
        <Box flex={1} />
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <Button 
            fullWidth 
            variant="contained" 
            startIcon={<Logout />} 
            onClick={handleLogout}
            sx={{ 
              ...theme.components.button.secondary,
              bgcolor: theme.colors.status.error.main,
              color: '#fff',
              '&:hover': { bgcolor: theme.colors.status.error.dark },
            }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* Main */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <Box sx={{ 
          bgcolor: '#fff', 
          px: 3, 
          py: 2, 
          borderBottom: `1px solid ${theme.colors.neutral[200]}`, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          boxShadow: theme.shadows.elevation1,
        }}>
          <Typography 
            variant="h6" 
            flex={1}
            sx={{
              fontFamily: theme.typography.fontFamily.display,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.neutral[900],
            }}
          >
            Daily Attendance — {profile?.section || 'My Class'}
          </Typography>
          <TextField
            type="date" size="small" value={date}
            onChange={e => setDate(e.target.value)}
            sx={{ width: 160 }}
          />
          <Button 
            startIcon={<Refresh />} 
            size="small" 
            onClick={fetchData}
            sx={{
              ...theme.components.button.secondary,
            }}
          >
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
          <Paper sx={{
            ...theme.components.card.default,
            overflow: 'hidden',
          }}>
            <Box sx={{ 
              p: 2.5, 
              background: theme.colors.primary.gradient,
              color: '#fff',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <Typography 
                sx={{
                  fontFamily: theme.typography.fontFamily.display,
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.h5,
                  color: '#fff',
                }}
              >
                Student Attendance List
              </Typography>
              <Chip 
                label={`${rows.length} records`} 
                size="small" 
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontWeight: theme.typography.fontWeight.semibold,
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              />
            </Box>
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ 
                    background: theme.colors.primary.gradient,
                  }}>
                    <TableCell sx={{ 
                      color: '#fff', 
                      fontFamily: theme.typography.fontFamily.primary,
                      fontWeight: theme.typography.fontWeight.bold,
                    }}>
                      Student Name
                    </TableCell>
                    <TableCell sx={{ 
                      color: '#fff', 
                      fontFamily: theme.typography.fontFamily.primary,
                      fontWeight: theme.typography.fontWeight.bold,
                    }}>
                      Time In
                    </TableCell>
                    <TableCell sx={{ 
                      color: '#fff', 
                      fontFamily: theme.typography.fontFamily.primary,
                      fontWeight: theme.typography.fontWeight.bold,
                    }}>
                      Method
                    </TableCell>
                    <TableCell sx={{ 
                      color: '#fff', 
                      fontFamily: theme.typography.fontFamily.primary,
                      fontWeight: theme.typography.fontWeight.bold,
                    }}>
                      Photo
                    </TableCell>
                    <TableCell sx={{ 
                      color: '#fff', 
                      fontFamily: theme.typography.fontFamily.primary,
                      fontWeight: theme.typography.fontWeight.bold,
                    }}>
                      Status
                    </TableCell>
                    <TableCell 
                      align="center"
                      sx={{ 
                        color: '#fff', 
                        fontFamily: theme.typography.fontFamily.primary,
                        fontWeight: theme.typography.fontWeight.bold,
                      }}
                    >
                      Override
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={28} sx={{ color: theme.colors.primary.main }} />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ 
                        py: 5, 
                        color: theme.colors.neutral[500],
                        fontFamily: theme.typography.fontFamily.primary,
                      }}>
                        No attendance records for this date
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map(r => (
                    <TableRow 
                      key={r.id} 
                      hover 
                      sx={{ 
                        bgcolor: r.is_overridden ? theme.colors.status.warning[50] : '#fff',
                        '&:hover': { bgcolor: theme.colors.neutral[50] },
                      }}
                    >
                      <TableCell>
                        <Typography 
                          sx={{
                            fontFamily: theme.typography.fontFamily.primary,
                            fontWeight: theme.typography.fontWeight.bold,
                            color: theme.colors.neutral[900],
                          }}
                        >
                          {r.student_name}
                        </Typography>
                        {r.is_overridden ? (
                          <Chip 
                            label="overridden" 
                            size="small" 
                            sx={{ 
                              ml: 1, 
                              fontSize: 10,
                              ...theme.components.badge.warning,
                            }} 
                          />
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ 
                        fontSize: '0.9rem',
                        color: theme.colors.neutral[600],
                        fontFamily: theme.typography.fontFamily.primary,
                      }}>
                        {r.time_in || (r.timestamp ? format(new Date(r.timestamp), 'hh:mm a') : '—')}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={r.scan_method || 'QR'} 
                          size="small" 
                          sx={{
                            bgcolor: theme.colors.neutral[100],
                            color: theme.colors.neutral[700],
                            border: `1px solid ${theme.colors.neutral[300]}`,
                            fontFamily: theme.typography.fontFamily.primary,
                            fontWeight: theme.typography.fontWeight.semibold,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {r.photo_path ? (
                          <Tooltip title="View Photo">
                            <IconButton
                              size="small"
                              onClick={() => handleViewPhoto(r)}
                              sx={{ p: 0.5 }}
                            >
                              <Avatar
                                src={r.photo_path.startsWith('http') ? r.photo_path : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${r.photo_path}`}
                                variant="rounded"
                                sx={{ width: 36, height: 36, cursor: 'pointer' }}
                              />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Avatar variant="rounded" sx={{ width: 36, height: 36, bgcolor: '#e0e0e0', fontSize: 11, color: '#666' }}>N/A</Avatar>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={r.status} 
                          size="small" 
                          sx={{
                            ...theme.components.badge[
                              r.status === 'Time-In' ? 'success' :
                              r.status === 'Late' ? 'warning' :
                              r.status === 'Time-Out' ? 'info' : 'error'
                            ]
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Override attendance">
                          <IconButton 
                            size="small" 
                            onClick={() => setOverrideRec(r)}
                            sx={{
                              color: theme.colors.status.warning.main,
                              '&:hover': {
                                bgcolor: theme.colors.status.warning[50],
                              }
                            }}
                          >
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
