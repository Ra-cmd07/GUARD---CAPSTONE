import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Paper, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Avatar, Button,
  Select, MenuItem, TextField, CircularProgress, Snackbar, Alert,
  Tooltip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, Card, CardContent, FormControl, InputLabel,
  List, ListItem, ListItemText, ListItemButton,
  Drawer, AppBar, Toolbar, useMediaQuery, useTheme as useMuiTheme,
} from '@mui/material';
import {
  CheckCircle, Cancel, AccessTime, People, School,
  Edit, Logout, Refresh, Dashboard, Add, Note, EventAvailable,
  TrendingUp, Class as ClassIcon, Menu as MenuIcon, PhotoCamera,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import theme from '../theme/professionalTheme';
import AttendancePhotoDialog from '../components/AttendancePhotoDialog';

interface TeacherProfile {
  name: string;
  section: string;
  subject?: string;
  room?: string;
  schedule?: string;
}

interface Student {
  id: number;
  lrn: string;
  name: string;
  grade: string;
  section: string;
  preferred_method: string;
  days_present: number;
  attendance_30d: number;
}

interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
  total: number;
  attendanceRate: number;
}

interface AttendanceRecord {
  id: number;
  student_id: number;
  student_name: string;
  lrn: string;
  status: string;
  timestamp: string;
  scan_method: string;
  photo_path?: string;
  is_overridden: boolean;
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <Paper sx={{ 
      p: 2.5, 
      borderTop: `4px solid ${color}`, 
      textAlign: 'center',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: theme.shadows.elevation4,
        transition: 'all 0.3s ease',
      },
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

// Manual Attendance Dialog
function ManualAttendanceDialog({
  open,
  students,
  onClose,
  onSaved,
}: {
  open: boolean;
  students: Student[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [status, setStatus] = useState('Time-In');
  const [session, setSession] = useState('AM');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!selectedStudent) {
      setError('Please select a student');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/teacher/attendance/manual', {
        student_id: selectedStudent,
        status,
        session,
        reason,
      });
      onSaved();
      onClose();
      setSelectedStudent('');
      setReason('');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ 
        background: theme.colors.primary.gradient,
        color: '#fff',
        fontFamily: theme.typography.fontFamily.display,
        fontWeight: theme.typography.fontWeight.bold,
      }}>
        Mark Manual Attendance
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Student</InputLabel>
          <Select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            label="Student"
          >
            {students.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name} ({s.lrn})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
            <MenuItem value="Time-In">Time-In</MenuItem>
            <MenuItem value="Late">Late</MenuItem>
            <MenuItem value="Absent">Absent</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Session</InputLabel>
          <Select value={session} onChange={(e) => setSession(e.target.value)} label="Session">
            <MenuItem value="AM">AM</MenuItem>
            <MenuItem value="PM">PM</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Reason (optional)"
          fullWidth
          multiline
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="E.g., Manually marked after system error"
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ ...theme.components.button.secondary }}>
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
          {loading ? <CircularProgress size={18} /> : 'Mark Attendance'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Excuse Absence Dialog
function ExcuseAbsenceDialog({
  open,
  students,
  onClose,
  onSaved,
}: {
  open: boolean;
  students: Student[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!selectedStudent) {
      setError('Please select a student');
      return;
    }
    if (!reason) {
      setError('Please provide a reason');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/teacher/attendance/excuse', {
        student_id: selectedStudent,
        date,
        reason,
      });
      onSaved();
      onClose();
      setSelectedStudent('');
      setReason('');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to excuse absence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ 
        background: theme.colors.status.warning.main,
        color: '#fff',
        fontFamily: theme.typography.fontFamily.display,
        fontWeight: theme.typography.fontWeight.bold,
      }}>
        Excuse Absence
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Student</InputLabel>
          <Select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            label="Student"
          >
            {students.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name} ({s.lrn})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Date"
          type="date"
          fullWidth
          value={date}
          onChange={(e) => setDate(e.target.value)}
          sx={{ mb: 2 }}
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label="Reason *"
          fullWidth
          multiline
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="E.g., Medical appointment, Family emergency"
          required
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ ...theme.components.button.secondary }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading}
          sx={{
            bgcolor: theme.colors.status.warning.main,
            color: '#fff',
            '&:hover': { bgcolor: theme.colors.status.warning.dark },
          }}
        >
          {loading ? <CircularProgress size={18} /> : 'Excuse Absence'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Add Note Dialog
function AddNoteDialog({
  open,
  record,
  onClose,
  onSaved,
}: {
  open: boolean;
  record: AttendanceRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!note.trim()) {
      setError('Please enter a note');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/teacher/attendance/note', {
        attendance_id: record?.id,
        student_id: record?.student_id,
        note,
      });
      onSaved();
      onClose();
      setNote('');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to add note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ 
        background: theme.colors.secondary.main,
        color: '#fff',
        fontFamily: theme.typography.fontFamily.display,
        fontWeight: theme.typography.fontWeight.bold,
      }}>
        Add Note — {record?.student_name}
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Typography variant="body2" color="text.secondary" mb={2}>
          Add a note to this attendance record
        </Typography>

        <TextField
          label="Note"
          fullWidth
          multiline
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="E.g., Left early due to illness"
          autoFocus
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ ...theme.components.button.secondary }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading}
          sx={{
            bgcolor: theme.colors.secondary.main,
            color: '#fff',
            '&:hover': { bgcolor: theme.colors.secondary.dark },
          }}
        >
          {loading ? <CircularProgress size={18} /> : 'Save Note'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Main Component
export default function TeacherDashboardPageNew() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const profile = user?.profile as TeacherProfile | null;
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const [teacherData, setTeacherData] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  
  const [manualAttendanceOpen, setManualAttendanceOpen] = useState(false);
  const [excuseAbsenceOpen, setExcuseAbsenceOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  
  // Photo dialog state
  const [photoDialog, setPhotoDialog] = useState<{
    open: boolean;
    photoUrl: string | null;
    studentName: string;
    status: string;
    timestamp: string;
    method: string;
  }>({ open: false, photoUrl: null, studentName: '', status: '', timestamp: '', method: '' });
  
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });

  const showSnack = (msg: string, sev: any = 'success') => setSnack({ open: true, msg, sev });

  // Fetch teacher's classes
  const fetchClasses = useCallback(async () => {
    try {
      const { data } = await api.get('/teacher/classes');
      setTeacherData(data.teacher);
      setStudents(data.students);
    } catch (error) {
      showSnack('Failed to load class data', 'error');
    }
  }, []);

  // Fetch today's attendance
  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/teacher/attendance/today?date=${date}`);
      setStats(data.stats);
      setAttendanceRecords(data.attendance);
    } catch (error) {
      showSnack('Failed to load attendance', 'error');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAttendance, 30000);
    return () => clearInterval(interval);
  }, [fetchAttendance]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleDialogSuccess = () => {
    showSnack('Action completed successfully');
    fetchAttendance();
  };

  const handleAddNote = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setAddNoteOpen(true);
  };

  const sidebarContent = (
    <>
      <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <School sx={{ color: '#fff' }} />
          <Typography variant="h6" sx={{ fontFamily: theme.typography.fontFamily.display, fontWeight: 800 }}>
            AttendBox
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.9 }}>Teacher Portal</Typography>
      </Box>

      {/* Teacher Info */}
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ opacity: 0.7, textTransform: 'uppercase', fontSize: 10, display: 'block', mb: 0.5 }}>
          Logged in as
        </Typography>
        <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', p: 1.5, borderRadius: 1, mb: 2, borderLeft: '3px solid rgba(255,255,255,0.5)' }}>
          <Typography sx={{ fontWeight: 700 }}>{teacherData?.name || user?.username}</Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>{teacherData?.section || '—'}</Typography>
        </Box>
        {teacherData?.subject && <Typography variant="caption" display="block" sx={{ opacity: 0.9, mb: 0.5 }}>📚 {teacherData.subject}</Typography>}
        {teacherData?.room && <Typography variant="caption" display="block" sx={{ opacity: 0.9, mb: 0.5 }}>🏫 Room: {teacherData.room}</Typography>}
        {teacherData?.schedule && <Typography variant="caption" display="block" sx={{ opacity: 0.9 }}>⏰ {teacherData.schedule}</Typography>}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 1 }} />

      {/* Navigation */}
      <Box sx={{ px: 2, pb: 2 }}>
        <Box
          onClick={() => { navigate('/teacher'); setMobileOpen(false); }}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.5, cursor: 'pointer', borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.2)', borderLeft: '3px solid #fff',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
          }}
        >
          <Dashboard />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>Dashboard</Typography>
        </Box>
      </Box>

      <Box flex={1} />

      <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
        <Button fullWidth variant="contained" startIcon={<Logout />} onClick={handleLogout}
          sx={{ bgcolor: '#c62828', '&:hover': { bgcolor: '#b71c1c' } }}>
          Logout
        </Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: '#f5f5f5' }}>

      {/* ── Mobile: Temporary Drawer (hidden on desktop via CSS) ── */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: 260,
            background: theme.colors.primary.gradient,
            color: '#fff',
            boxSizing: 'border-box',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* ── Desktop: Permanent Sidebar (hidden on mobile via CSS) ── */}
      <Box sx={{
        width: 260,
        background: theme.colors.primary.gradient,
        color: '#fff',
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        flexShrink: 0,
        boxShadow: theme.shadows.elevation3,
      }}>
        {sidebarContent}
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{
          bgcolor: '#fff',
          px: { xs: 1.5, sm: 3 },
          py: 2,
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, sm: 2 },
          boxShadow: theme.shadows.elevation1,
          flexWrap: 'wrap',
        }}>
          <IconButton
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 0.5, display: { xs: 'inline-flex', md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" flex={1} sx={{ fontFamily: theme.typography.fontFamily.display, fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1.25rem' } }}>
            My Class — {teacherData?.section || 'Loading...'}
          </Typography>
          <TextField
            type="date"
            size="small"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            sx={{ width: { xs: 140, sm: 160 } }}
          />
          <Button startIcon={<Refresh />} size="small" onClick={fetchAttendance} variant="outlined">
            Refresh
          </Button>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, sm: 3 } }}>
          {/* Quick Stats */}
          <Grid container spacing={2} mb={3}>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                label="Present"
                value={stats?.present || 0}
                color="#2e7d32"
                icon={<CheckCircle sx={{ fontSize: 14, color: '#2e7d32' }} />}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                label="Late"
                value={stats?.late || 0}
                color="#e65100"
                icon={<AccessTime sx={{ fontSize: 14, color: '#e65100' }} />}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                label="Absent"
                value={stats?.absent || 0}
                color="#c62828"
                icon={<Cancel sx={{ fontSize: 14, color: '#c62828' }} />}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                label="Total Students"
                value={stats?.total || 0}
                color="#1565c0"
                icon={<People sx={{ fontSize: 14, color: '#1565c0' }} />}
              />
            </Grid>
          </Grid>

          {/* Quick Actions */}
          <Paper sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ClassIcon sx={{ color: theme.colors.primary.main }} />
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setManualAttendanceOpen(true)}
                  sx={{
                    py: 1.5,
                    ...theme.components.button.primary,
                    '&:hover': theme.components.button.primary.hover,
                  }}
                >
                  Mark Manual Attendance
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<EventAvailable />}
                  onClick={() => setExcuseAbsenceOpen(true)}
                  sx={{
                    py: 1.5,
                    bgcolor: theme.colors.status.warning.main,
                    '&:hover': { bgcolor: theme.colors.status.warning.dark },
                  }}
                >
                  Excuse Absence
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<TrendingUp />}
                  onClick={() => navigate('/teacher/reports')}
                  sx={{ py: 1.5 }}
                >
                  View Reports
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Today's Attendance Table */}
          <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{
              p: 2.5,
              background: theme.colors.primary.gradient,
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Typography sx={{ fontFamily: theme.typography.fontFamily.display, fontWeight: 700, fontSize: 18 }}>
                Today's Attendance — {format(new Date(date), 'MMM dd, yyyy')}
              </Typography>
              <Chip
                label={`${attendanceRecords.length} records`}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontWeight: 600,
                  border: '1px solid rgba(255,255,255,0.3)',
                }}
              />
            </Box>
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Student Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>LRN</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Photo</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && attendanceRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 5, color: '#666' }}>
                        No attendance records for this date
                      </TableCell>
                    </TableRow>
                  )}
                  {attendanceRecords.map((r) => (
                    <TableRow
                      key={r.id}
                      hover
                      sx={{
                        bgcolor: r.is_overridden ? '#fff3e0' : '#fff',
                        '&:hover': { bgcolor: '#f5f5f5' },
                      }}
                    >
                      <TableCell>
                        <Typography sx={{ fontWeight: 700 }}>{r.student_name}</Typography>
                      </TableCell>
                      <TableCell>{r.lrn}</TableCell>
                      <TableCell>{format(new Date(r.timestamp), 'hh:mm a')}</TableCell>
                      <TableCell>
                        <Chip label={r.scan_method} size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={r.photo_path ? 'View Photo' : 'No photo'}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!r.photo_path}
                              onClick={() => r.photo_path && setPhotoDialog({
                                open: true,
                                photoUrl: r.photo_path!,
                                studentName: r.student_name,
                                status: r.status,
                                timestamp: r.timestamp,
                                method: r.scan_method,
                              })}
                              sx={{
                                color: r.photo_path ? theme.colors.primary.main : '#ccc',
                                '&:hover': { bgcolor: r.photo_path ? 'rgba(59,130,246,0.1)' : 'transparent' },
                              }}
                            >
                              <PhotoCamera fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={r.status}
                          size="small"
                          color={
                            r.status === 'Time-In' ? 'success' :
                            r.status === 'Late' ? 'warning' :
                            r.status === 'Time-Out' ? 'info' : 'error'
                          }
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Add Note">
                          <IconButton size="small" onClick={() => handleAddNote(r)} sx={{ color: theme.colors.secondary.main }}>
                            <Note fontSize="small" />
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

      {/* Dialogs */}
      <ManualAttendanceDialog
        open={manualAttendanceOpen}
        students={students}
        onClose={() => setManualAttendanceOpen(false)}
        onSaved={handleDialogSuccess}
      />
      <ExcuseAbsenceDialog
        open={excuseAbsenceOpen}
        students={students}
        onClose={() => setExcuseAbsenceOpen(false)}
        onSaved={handleDialogSuccess}
      />
      <AddNoteDialog
        open={addNoteOpen}
        record={selectedRecord}
        onClose={() => {
          setAddNoteOpen(false);
          setSelectedRecord(null);
        }}
        onSaved={handleDialogSuccess}
      />

      {/* Attendance Photo Dialog */}
      <AttendancePhotoDialog
        open={photoDialog.open}
        onClose={() => setPhotoDialog(p => ({ ...p, open: false }))}
        photoUrl={photoDialog.photoUrl}
        studentName={photoDialog.studentName}
        status={photoDialog.status}
        timestamp={photoDialog.timestamp}
        method={photoDialog.method}
      />

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
