import { useState, useEffect, useCallback, useRef } from 'react';
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
  TrendingUp, Class as ClassIcon, Menu as MenuIcon, PhotoCamera, Email, Description,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import theme from '../theme/professionalTheme';
import AttendancePhotoDialog from '../components/AttendancePhotoDialog';
import NotificationBell from '../components/NotificationBell';

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

// Safely format a date value that may arrive as a JS Date object or a string from MySQL.
// MySQL DATE columns arrive as Date objects set to midnight UTC of the stored date.
// We extract the UTC date parts directly to avoid local-timezone off-by-one errors.
function formatAttendanceDate(raw: any, fmt = 'MMM d, yyyy'): string {
  if (!raw) return '—';
  try {
    let dateStr: string;
    if (raw instanceof Date) {
      // Use UTC parts — the Date object is midnight UTC of the stored date
      const y = raw.getUTCFullYear();
      const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
      const d = String(raw.getUTCDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${d}`;
    } else {
      // Strip any time portion from string
      dateStr = String(raw).replace(/T.*$/, '').trim();
    }
    // Parse as local noon to avoid DST edge cases
    return format(new Date(`${dateStr}T12:00:00`), fmt);
  } catch {
    return String(raw);
  }
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

// ─── SF1GeneratorPanel ───────────────────────────────────────────────
function SF1GeneratorPanel({ section, onClose }: { section: string; onClose: () => void }) {
  const [generating,     setGenerating]     = useState(false);
  const [previewData,    setPreviewData]    = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error,          setError]          = useState('');
  const [templateFile,   setTemplateFile]   = useState<File | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/sf1/preview?section=${encodeURIComponent(section)}`);
      setPreviewData(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleUploadTemplate = async () => {
    if (!templateFile) {
      setError('Please select a template file');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('template', templateFile);

      await api.post('/sf1/upload-template', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setTemplateFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert('✅ Template uploaded successfully! Future SF1 generations will use this template.');
    } catch (e: any) {
      setError('Failed to upload template. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/sf1/download-template', {
        responseType: 'blob',
      });

      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', 'School_Form_1_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError('Failed to download template');
    }
  };

  const handleResetTemplate = async () => {
    if (!confirm('Reset to default SF1 template? Your custom template will be deleted.')) return;
    try {
      await api.delete('/sf1/reset-template');
      alert('✅ Template reset to default');
    } catch (e: any) {
      setError('Failed to reset template');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('section', section);

      const response = await api.post('/sf1/generate', formData, {
        responseType: 'blob',
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      const filename = response.headers['content-disposition']
        ?.split('filename=')[1]?.replace(/"/g, '')
        || `SF1_${section}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError('Failed to generate SF1. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Box>
      <Paper sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        {/* Header */}
        <Box sx={{
          p: 2.5, background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', color: '#fff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 18 }}>📄 SF1 Generator</Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              School Form 1 — School Register · Section: {section}
            </Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={onClose}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>
            ← Back
          </Button>
        </Box>

        <Box sx={{ p: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

          {/* Step 1: Preview */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#2e7d32' }}>
            Step 1 — Preview Student Data
          </Typography>
          <Button size="small" variant="outlined" startIcon={previewLoading ? <CircularProgress size={14} /> : undefined}
            onClick={handlePreview} disabled={previewLoading}
            sx={{ mb: 2, textTransform: 'none', borderColor: '#2e7d32', color: '#2e7d32' }}>
            {previewLoading ? 'Loading...' : '👁 Preview Data'}
          </Button>

          {previewData && (
            <Box sx={{ mb: 3, p: 2, bgcolor: '#f1f8e9', borderRadius: 1, border: '1px solid #c8e6c9' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#2e7d32', mb: 0.5 }}>
                Section: {previewData.section} — {previewData.count} students ({previewData.page_count} page{previewData.page_count !== 1 ? 's' : ''})
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {previewData.students?.filter((s: any) => !s.birthdate).length > 0 && (
                  `⚠️ ${previewData.students.filter((s: any) => !s.birthdate).length} students have no birthdate set — update in Admin → Students`
                )}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Step 2: Template Management */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#2e7d32' }}>
            Step 2 — Template Management (Optional)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Upload a custom SF1 template if the format changes. The system uses the official DepEd template by default.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            <Button size="small" variant="outlined" onClick={handleDownloadTemplate}
              sx={{ textTransform: 'none', borderColor: '#2e7d32', color: '#2e7d32' }}>
              ⬇ Download Current Template
            </Button>
            <Button size="small" variant="outlined" onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: 'none', borderColor: '#2e7d32', color: '#2e7d32' }}>
              📤 Choose Template File
            </Button>
            {templateFile && (
              <Button size="small" variant="contained" onClick={handleUploadTemplate} disabled={uploading}
                sx={{ textTransform: 'none', bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}>
                {uploading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : '✓ Upload Template'}
              </Button>
            )}
            <Button size="small" variant="outlined" onClick={handleResetTemplate}
              sx={{ textTransform: 'none', borderColor: '#f44336', color: '#f44336' }}>
              ↺ Reset to Default
            </Button>
          </Box>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setTemplateFile(file);
                setError('');
              }
            }}
          />

          {templateFile && (
            <Box sx={{ p: 1.5, bgcolor: '#f1f8e9', borderRadius: 1, mb: 2, border: '1px solid #c8e6c9' }}>
              <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                📎 Selected: {templateFile.name}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Step 3: Generate */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#2e7d32' }}>
            Step 3 — Generate &amp; Download
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Downloads a filled SF1 using the official DepEd School Register format.
          </Typography>
          <Button variant="contained" size="large" onClick={handleGenerate}
            disabled={generating}
            sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' }, textTransform: 'none', fontWeight: 700 }}>
            {generating
              ? <><CircularProgress size={18} sx={{ color: '#fff', mr: 1 }} /> Generating SF1...</>
              : '⬇ Generate & Download SF1'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

// ─── SF2GeneratorPanel ───────────────────────────────────────────────
function SF2GeneratorPanel({ section, onClose }: { section: string; onClose: () => void }) {
  const [month,       setMonth]       = useState(new Date().getMonth() + 1);
  const [year,        setYear]        = useState(new Date().getFullYear());
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [generating,  setGenerating]  = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error,       setError]       = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError('');
    try {
      const { data } = await api.get(
        `/sf2/preview?month=${month}&year=${year}&section=${encodeURIComponent(section)}`
      );
      setPreviewData(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!templateFile) { setError('Please upload a blank SF2 template (.xlsx)'); return; }
    setGenerating(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('template', templateFile);
      formData.append('month',   String(month));
      formData.append('year',    String(year));
      formData.append('section', section);

      const response = await api.post('/sf2/generate', formData, {
        responseType: 'blob',
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Trigger download
      const url      = window.URL.createObjectURL(new Blob([response.data]));
      const link     = document.createElement('a');
      link.href      = url;
      const filename = response.headers['content-disposition']
        ?.split('filename=')[1]?.replace(/"/g, '')
        || `SF2_${section}_${months[month-1]}_${year}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError('Failed to generate SF2. Please check the template and try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Box>
      <Paper sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        {/* Header */}
        <Box sx={{
          p: 2.5, background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)', color: '#fff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 18 }}>📋 SF2 Generator</Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              School Form 2 — Daily Attendance Report of Learners · Section: {section}
            </Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={onClose}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>
            ← Back
          </Button>
        </Box>

        <Box sx={{ p: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

          {/* Step 1: Pick month/year */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1565c0' }}>
            Step 1 — Select Month &amp; Year
          </Typography>
          <Box display="flex" gap={2} mb={3} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Month</InputLabel>
              <Select value={month} label="Month" onChange={e => setMonth(Number(e.target.value))}>
                {months.map((m, i) => (
                  <MenuItem key={i+1} value={i+1}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField size="small" label="Year" type="number" value={year}
              onChange={e => setYear(Number(e.target.value))}
              inputProps={{ min: 2020, max: 2100 }} sx={{ width: 100 }} />
            <Button variant="outlined" size="small" onClick={handlePreview} disabled={previewLoading}
              sx={{ textTransform: 'none' }}>
              {previewLoading ? <CircularProgress size={16} /> : '👁 Preview Data'}
            </Button>
          </Box>

          {/* Preview result */}
          {previewData && (
            <Box sx={{ mb: 3, p: 2, bgcolor: '#f0f7ff', borderRadius: 2, border: '1px solid #bbdefb' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: '#1565c0' }}>
                Preview — {months[month-1]} {year} · {previewData.section}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {previewData.school_days} school days &nbsp;·&nbsp;
                {previewData.students?.filter((s: any) => s.gender === 'M').length || 0} boys &nbsp;·&nbsp;
                {previewData.students?.filter((s: any) => s.gender === 'F').length || 0} girls &nbsp;·&nbsp;
                {previewData.students?.filter((s: any) => !s.gender).length || 0} gender unknown
              </Typography>
              {previewData.students?.filter((s: any) => !s.gender).length > 0 && (
                <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                  Some students have no gender set — they will be appended to the boys section on SF2.
                </Alert>
              )}
            </Box>
          )}

          {/* Step 2: Upload template */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1565c0' }}>
            Step 2 — Upload Blank SF2 Template
          </Typography>
          <Box sx={{ mb: 3 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={e => setTemplateFile(e.target.files?.[0] || null)}
            />
            <Button variant="outlined" size="small"
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: 'none', mr: 2 }}>
              📂 Choose Template File
            </Button>
            {templateFile ? (
              <Chip label={templateFile.name} size="small" color="success" onDelete={() => setTemplateFile(null)} />
            ) : (
              <Typography variant="caption" color="text.secondary">No file selected (.xlsx only)</Typography>
            )}
            <Typography variant="caption" display="block" sx={{ mt: 1, color: '#888' }}>
              Upload your school's blank official SF2 template. The system will fill in the attendance grid.
            </Typography>
          </Box>

          {/* Step 3: Generate */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1565c0' }}>
            Step 3 — Generate &amp; Download
          </Typography>
          <Button variant="contained" size="large" onClick={handleGenerate}
            disabled={generating || !templateFile}
            sx={{ bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' }, textTransform: 'none', fontWeight: 700 }}>
            {generating
              ? <><CircularProgress size={18} sx={{ color: '#fff', mr: 1 }} /> Generating SF2...</>
              : '⬇ Generate & Download SF2'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

// ─── RosterRow ───────────────────────────────────────────────────────
function RosterRow({
  row,
  session,
  onConfirm,
  confirmingId,
  onMessage,
}: {
  row: any;
  session: 'AM' | 'PM';
  onConfirm: (studentId: number, session: string, status: string, timeIn: string) => Promise<void>;
  confirmingId: number | null;
  onMessage: (studentId: number, studentName: string) => void;
}) {
  const [selectedStatus, setSelectedStatus] = useState(row.scan_status || 'Time-In');
  // Pre-fill with kiosk scan time if available; blank otherwise for manual entry
  const [manualTime, setManualTime] = useState<string>(row.scan_time || '');
  const isBusy     = confirmingId === row.student_id;
  const canConfirm = !row.already_confirmed && (
    session === 'PM'
      ? (row.has_scan || row.has_am_confirmed)
      : row.has_scan
  );
  const statusOptions = ['Time-In', 'Late', 'Absent'];

  const lockReason = row.already_confirmed
    ? ''
    : session === 'PM' && !row.has_scan && !row.has_am_confirmed
      ? 'Student has not scanned the kiosk and has no confirmed AM attendance'
      : !row.has_scan
        ? 'Student has not scanned the kiosk'
        : '';

  return (
    <TableRow hover sx={{
      bgcolor: row.already_confirmed ? '#f0fdf4' : canConfirm ? '#fffde7' : '#fafafa',
      opacity: !canConfirm && !row.already_confirmed ? 0.65 : 1,
    }}>
      <TableCell sx={{ fontWeight: 700 }}>{row.student_name}</TableCell>
      <TableCell sx={{ fontSize: '0.8rem', color: '#555' }}>{row.lrn}</TableCell>
      {/* Subject column */}
      <TableCell>
        {row.subject ? (
          <Chip label={row.subject} size="small"
            sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontSize: '0.68rem', fontWeight: 600 }} />
        ) : (
          <Chip label="General" size="small"
            sx={{ bgcolor: '#f3e5f5', color: '#6a1b9a', fontSize: '0.68rem', fontWeight: 600 }} />
        )}
      </TableCell>
      {/* Kiosk scan status */}
      <TableCell>
        {row.has_scan ? (
          <Chip label={`${session} scan`} size="small"
            sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700, fontSize: '0.7rem' }} />
        ) : session === 'PM' && row.has_am_confirmed ? (
          <Chip label="AM confirmed" size="small"
            sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 700, fontSize: '0.7rem' }} />
        ) : (
          <Chip label="No scan" size="small"
            sx={{ bgcolor: '#f5f5f5', color: '#999', fontSize: '0.7rem' }} />
        )}
      </TableCell>
      {/* Editable time input — pre-filled from kiosk scan, always editable */}
      <TableCell>
        {row.already_confirmed ? (
          <Typography sx={{ fontSize: '0.8rem', color: '#555' }}>
            {row.scan_time || '—'}
          </Typography>
        ) : (
          <TextField
            size="small"
            value={manualTime}
            onChange={e => setManualTime(e.target.value)}
            placeholder="e.g. 1:15 PM"
            disabled={!canConfirm}
            sx={{ width: 110, fontSize: '0.78rem',
              '& .MuiInputBase-input': { fontSize: '0.78rem', py: 0.6, px: 1 } }}
            inputProps={{ maxLength: 12 }}
          />
        )}
      </TableCell>
      {/* Status selector */}
      <TableCell>
        {row.already_confirmed ? (
          <Chip label={row[`final_${session.toLowerCase()}`]?.status || 'Confirmed'}
            size="small" color="success" />
        ) : (
          <Select size="small" value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            disabled={!canConfirm} sx={{ fontSize: '0.78rem', minWidth: 100 }}>
            {statusOptions.map(s => (
              <MenuItem key={s} value={s} sx={{ fontSize: '0.78rem' }}>{s}</MenuItem>
            ))}
          </Select>
        )}
      </TableCell>
      {/* Action */}
      <TableCell>
        <Box display="flex" gap={0.5} alignItems="center">
          {row.already_confirmed ? (
            <Chip label="✓ Done" size="small" color="success" variant="outlined" />
          ) : (
            <Tooltip title={lockReason || `Confirm ${session} attendance`}>
              <span>
                <Button size="small" variant="contained"
                  disabled={!canConfirm || isBusy}
                  onClick={() => onConfirm(row.student_id, session, selectedStatus, manualTime)}
                  sx={{
                    bgcolor: canConfirm ? '#2e7d32' : '#bdbdbd',
                    '&:hover': { bgcolor: '#1b5e20' },
                    fontSize: '0.7rem', px: 1.5, py: 0.5, textTransform: 'none', fontWeight: 700,
                  }}>
                  {isBusy ? <CircularProgress size={14} sx={{ color: '#fff' }} />
                    : canConfirm ? '✓ Confirm' : '🔒 No scan'}
                </Button>
              </span>
            </Tooltip>
          )}
          <Tooltip title={`Message parent of ${row.student_name}`}>
            <IconButton size="small" onClick={() => onMessage(row.student_id, row.student_name)}
              sx={{ color: '#1565c0', '&:hover': { bgcolor: '#e3f2fd' } }}>
              <Email fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </TableRow>
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
  
  // Excuse requests from parents
  const [excuseRequests, setExcuseRequests] = useState<any[]>([]);
  const [pendingExcuseCount, setPendingExcuseCount] = useState(0);
  const [excuseTab, setExcuseTab] = useState<'dashboard' | 'excuses' | 'subject-excuses'>('dashboard');
  const [subjectExcuseAsgId, setSubjectExcuseAsgId] = useState<number | null>(null);
  const [subjectExcuseRequests, setSubjectExcuseRequests] = useState<any[]>([]);
  const [subjectExcuseLoading, setSubjectExcuseLoading] = useState(false);
  const [subjectPendingCounts, setSubjectPendingCounts] = useState<Record<number, number>>({});
  const [resolveDialog, setResolveDialog] = useState<{
    open: boolean; request: any | null; action: 'approve' | 'reject'; note: string; loading: boolean; error: string;
  }>({ open: false, request: null, action: 'approve', note: '', loading: false, error: '' });

  // Message-parent dialog state (from Final Attendance List)
  const [msgDialog, setMsgDialog] = useState<{
    open: boolean; studentName: string; studentId: number | null;
    subject: string; body: string; loading: boolean; error: string; success: boolean;
  }>({ open: false, studentName: '', studentId: null, subject: '', body: '', loading: false, error: '', success: false });

  // Message-parent dialog from roster (same dialog, reused)
  const handleRosterMessage = useCallback((studentId: number, studentName: string) => {
    setMsgDialog({ open: true, studentName, studentId, subject: '', body: '', loading: false, error: '', success: false });
  }, []);

  // At-risk students (below threshold)
  const [atRiskIds, setAtRiskIds] = useState<Set<number>>(new Set());
  
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

  // Subject assignments (from Image 1 config) — determines sidebar nav
  const [subjectAssignments, setSubjectAssignments] = useState<any[]>([]);
  const [advisoryAssignments, setAdvisoryAssignments] = useState<any[]>([]);
  // Active view: 'dashboard' (main class), 'excuses', 'sf2', 'sf1', or assignment id (subject class)
  const [activeView, setActiveView] = useState<'dashboard' | 'excuses' | 'sf2' | 'sf1' | number>('dashboard');
  // Subject attendance (partial + final)
  const [subjectDate, setSubjectDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [partialAttendance, setPartialAttendance] = useState<any[]>([]);
  const [finalAttendance,   setFinalAttendance]   = useState<any[]>([]);
  const [subjectStudents,   setSubjectStudents]   = useState<any[]>([]);
  const [subjectLoading,    setSubjectLoading]    = useState(false);
  const [verifyingId,       setVerifyingId]       = useState<number | null>(null);

  // Advisory partial attendance (unverified kiosk scans for the main class)
  const [advisoryPartial,   setAdvisoryPartial]   = useState<any[]>([]);
  const [advisoryVerifyId,  setAdvisoryVerifyId]  = useState<number | null>(null);

  // ── NEW: Full roster for AM / PM sessions ────────────────────────────
  const [activeSession,      setActiveSession]      = useState<'AM' | 'PM'>('AM');
  const [authorizedSession,  setAuthorizedSession]  = useState<'AM' | 'PM' | 'BOTH'>('BOTH');
  const [roster,             setRoster]             = useState<any[]>([]);
  const [rosterLoading,      setRosterLoading]      = useState(false);
  const [confirmingId,       setConfirmingId]       = useState<number | null>(null);
  const [autoAbsentBusy,     setAutoAbsentBusy]     = useState(false);

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

  // ── NEW: Fetch full class roster with kiosk scan status ──────────────
  // targetSection: pass when a subject teacher is viewing a section different from their advisory
  const fetchRoster = useCallback(async (session: 'AM' | 'PM', targetDate?: string, targetSection?: string) => {
    setRosterLoading(true);
    const d = targetDate || date;
    const sectionParam = targetSection ? `&section=${encodeURIComponent(targetSection)}` : '';
    try {
      const { data } = await api.get(`/teacher/attendance/roster?date=${d}&session=${session}${sectionParam}`);
      setRoster(data.roster || []);
      if (data.authorized_session && data.authorized_session !== 'BOTH') {
        setAuthorizedSession(data.authorized_session);
        setActiveSession(data.authorized_session as 'AM' | 'PM');
      } else {
        setAuthorizedSession('BOTH');
      }
      setRosterLoading(false);
    } catch (e: any) {
      if (e.response?.status === 403 && e.response?.data?.authorized_session) {
        const correct = e.response.data.authorized_session as 'AM' | 'PM';
        setAuthorizedSession(correct);
        setActiveSession(correct);
        if (correct !== session) {
          try {
            const { data: retryData } = await api.get(`/teacher/attendance/roster?date=${d}&session=${correct}${sectionParam}`);
            setRoster(retryData.roster || []);
          } catch {
            showSnack('Failed to load attendance roster', 'error');
          }
        }
      } else {
        showSnack('Failed to load attendance roster', 'error');
      }
      setRosterLoading(false);
    }
  }, [date]);

  // Fetch today's attendance  ← moved above handleConfirmAttendance / handleAutoAbsent
  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/teacher/attendance/today?date=${date}`);
      setStats(data.stats);
      // Final attendance = is_verified = 1 (verified records from attendance table)
      setAttendanceRecords((data.attendance || []).filter((r: any) => r.is_verified === 1));
      // Partial attendance = is_verified = 0 (kiosk scans in partial_attendance table)
      setAdvisoryPartial((data.attendance || []).filter((r: any) => r.is_verified === 0));
    } catch (error) {
      showSnack('Failed to load attendance', 'error');
    } finally {
      setLoading(false);
    }
  }, [date]);

  // ── NEW: Confirm a student's attendance for a session ────────────────
  const handleConfirmAttendance = useCallback(async (
    studentId: number, session: string, status: string, timeIn: string
  ) => {
    setConfirmingId(studentId);
    const asg = typeof activeView === 'number'
      ? subjectAssignments.find((a: any) => a.id === activeView)
      : null;
    const currentSection = asg?.section || undefined;
    const currentSubject = asg?.subject || null;
    try {
      await api.post('/teacher/attendance/confirm', {
        student_id: studentId,
        session,
        status,
        date,
        subject: currentSubject,
        time_in: timeIn || null,
      });
      showSnack(`${session} attendance confirmed`);
      fetchRoster(activeSession, date, currentSection);
      fetchAttendance();
    } catch (e: any) {
      showSnack(e.response?.data?.error || 'Failed to confirm attendance', 'error');
    } finally {
      setConfirmingId(null);
    }
  }, [date, activeSession, activeView, subjectAssignments, fetchAttendance, fetchRoster]);

  // ── NEW: Auto-mark absent for end of session ─────────────────────────
  const handleAutoAbsent = useCallback(async (session: 'AM' | 'PM') => {
    if (!window.confirm(
      `This will mark all students with no confirmed ${session} attendance as Absent for ${session}.\n\nProceed?`
    )) return;
    const asg = typeof activeView === 'number'
      ? subjectAssignments.find((a: any) => a.id === activeView)
      : null;
    const currentSection = asg?.section || undefined;
    setAutoAbsentBusy(true);
    try {
      const { data } = await api.post('/teacher/attendance/auto-absent', { session, date });
      showSnack(`${data.marked} student(s) marked Absent for ${session}`);
      fetchRoster(activeSession, date, currentSection);
      fetchAttendance();
    } catch (e: any) {
      showSnack(e.response?.data?.error || 'Failed to auto-mark absent', 'error');
    } finally {
      setAutoAbsentBusy(false);
    }
  }, [date, activeSession, activeView, subjectAssignments, fetchAttendance, fetchRoster]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Fetch roster whenever date or active session changes
  useEffect(() => {
    if (activeView === 'dashboard' || typeof activeView === 'number') {
      // For subject views, pass the section of that assignment
      const asg = typeof activeView === 'number'
        ? subjectAssignments.find((a: any) => a.id === activeView)
        : null;
      const targetSection = asg?.section || undefined;
      fetchRoster(activeSession, date, targetSection);
    }
  }, [date, activeSession, activeView, fetchRoster, subjectAssignments]);

  // Fetch subject assignments for sidebar nav
  const fetchSubjectAssignments = useCallback(async () => {
    try {
      const { data } = await api.get('/teacher/subject-assignments');
      setSubjectAssignments(data.subjects || []);
      setAdvisoryAssignments(data.advisory || []);
      // If teacher is NOT an adviser but has subject assignments,
      // auto-navigate to first subject so they don't see empty advisory
      if (data.subjects?.length > 0 && !teacherData?.is_adviser && teacherData?.is_adviser !== undefined) {
        setActiveView(data.subjects[0].id);
      }
    } catch { /* silent */ }
  }, [teacherData?.is_adviser]);

  useEffect(() => { fetchSubjectAssignments(); }, [fetchSubjectAssignments]);

  // Fetch partial + final attendance for a subject assignment
  const fetchSubjectAttendance = useCallback(async (assignmentId: number, date: string) => {
    setSubjectLoading(true);
    try {
      const { data } = await api.get(`/teacher/subject-attendance?assignment_id=${assignmentId}&date=${date}`);
      setPartialAttendance(data.partial || []);
      setFinalAttendance(data.final   || []);
      setSubjectStudents(data.students || []);
    } catch { /* silent */ }
    finally { setSubjectLoading(false); }
  }, []);

  useEffect(() => {
    if (typeof activeView === 'number') {
      fetchSubjectAttendance(activeView, subjectDate);
    }
  }, [activeView, subjectDate, fetchSubjectAttendance]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAttendance, 30000);
    return () => clearInterval(interval);
  }, [fetchAttendance]);

  // Fetch excuse requests (adviser)
  const fetchExcuseRequests = useCallback(async () => {
    try {
      const { data } = await api.get('/excuse/teacher?status=all');
      setExcuseRequests(data.requests || []);
      setPendingExcuseCount(data.pendingCount || 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchExcuseRequests(); }, [fetchExcuseRequests]);
  useEffect(() => {
    const id = setInterval(fetchExcuseRequests, 60_000);
    return () => clearInterval(id);
  }, [fetchExcuseRequests]);

  // Fetch excuse requests for a specific subject assignment
  const fetchSubjectExcuseRequests = useCallback(async (assignmentId: number) => {
    setSubjectExcuseLoading(true);
    try {
      const { data } = await api.get(`/excuse/teacher?status=all&assignment_id=${assignmentId}`);
      setSubjectExcuseRequests(data.requests || []);
      // Update overall pending count badge to include subject pending requests
      setPendingExcuseCount(prev => {
        const subjectPending = (data.requests || []).filter((r: any) => r.status === 'pending').length;
        // Merge: keep adviser count + current subject pending
        return Math.max(prev, subjectPending);
      });
    } catch {
      setSubjectExcuseRequests([]);
    } finally {
      setSubjectExcuseLoading(false);
    }
  }, []);

  // On load: also fetch pending count across ALL subject assignments so badge shows for subject teachers
  const fetchSubjectPendingCount = useCallback(async () => {
    if (!subjectAssignments.length) return;
    try {
      let totalPending = 0;
      const counts: Record<number, number> = {};
      for (const asg of subjectAssignments) {
        const { data } = await api.get(`/excuse/teacher?status=pending&assignment_id=${asg.id}`);
        const count = data.pendingCount || 0;
        counts[asg.id] = count;
        totalPending += count;
      }
      setSubjectPendingCounts(counts);
      if (totalPending > 0) {
        setPendingExcuseCount(prev => Math.max(prev, totalPending));
      }
    } catch {
      // silent
    }
  }, [subjectAssignments]);

  // Trigger fetchSubjectPendingCount whenever subjectAssignments changes (on load and refresh)
  useEffect(() => {
    if (subjectAssignments.length > 0) {
      fetchSubjectPendingCount();
    }
  }, [subjectAssignments, fetchSubjectPendingCount]);

  // Auto-fetch when switching to subject excuse view
  useEffect(() => {
    if (excuseTab === 'subject-excuses' && subjectExcuseAsgId !== null) {
      fetchSubjectExcuseRequests(subjectExcuseAsgId);
    }
  }, [excuseTab, subjectExcuseAsgId, fetchSubjectExcuseRequests]);

  // Fetch at-risk students
  const fetchAtRisk = useCallback(async () => {
    try {
      const { data } = await api.get('/alerts/teacher');
      const ids = new Set<number>((data.alerts || []).map((a: any) => a.student_id));
      setAtRiskIds(ids);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchAtRisk(); }, [fetchAtRisk]);

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

  const handleResolveExcuse = async () => {
    const { request, action, note } = resolveDialog;
    if (!request) return;
    setResolveDialog(d => ({ ...d, loading: true, error: '' }));
    try {
      await api.patch(`/excuse/teacher/${request.id}`, { action, teacher_note: note });
      showSnack(`Excuse request ${action === 'approve' ? 'approved' : 'rejected'} successfully`, 'success');
      setResolveDialog({ open: false, request: null, action: 'approve', note: '', loading: false, error: '' });
      // Refresh whichever list is currently active
      if (excuseTab === 'subject-excuses' && subjectExcuseAsgId !== null) {
        fetchSubjectExcuseRequests(subjectExcuseAsgId);
      } else {
        fetchExcuseRequests();
      }
    } catch (err: any) {
      setResolveDialog(d => ({ ...d, loading: false, error: err.response?.data?.error || 'Failed to resolve request' }));
    }
  };

  const handleSendMessage = async () => {
    const { studentId, subject, body } = msgDialog;
    if (!studentId || !subject.trim() || !body.trim()) return;
    setMsgDialog(d => ({ ...d, loading: true, error: '' }));
    try {
      await api.post('/messages/teacher', { student_id: studentId, subject: subject.trim(), body: body.trim() });
      setMsgDialog(d => ({ ...d, loading: false, success: true }));
      showSnack('Message sent to parent successfully', 'success');
      setTimeout(() => setMsgDialog({ open: false, studentName: '', studentId: null, subject: '', body: '', loading: false, error: '', success: false }), 1800);
    } catch (err: any) {
      setMsgDialog(d => ({ ...d, loading: false, error: err.response?.data?.error || 'Failed to send message' }));
    }
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
        {/* Teacher Info — show advisory details ONLY for advisers */}
        <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', p: 1.5, borderRadius: 1, mb: 2, borderLeft: '3px solid rgba(255,255,255,0.5)' }}>
          <Typography sx={{ fontWeight: 700 }}>{teacherData?.name || user?.username}</Typography>
          {teacherData?.is_adviser !== false && teacherData?.section && (
            <Typography variant="caption" sx={{ opacity: 0.9 }}>{teacherData.section}</Typography>
          )}
        </Box>
        {/* Year Level / Strand / Track — adviser only, from assignment */}
        {teacherData?.is_adviser !== false && teacherData?.year_level && (
          <Typography variant="caption" display="block" sx={{ opacity: 0.9, mb: 0.5 }}>
            🎓 {[
              teacherData.year_level,
              teacherData.strand || null,
              teacherData.track  || null,
            ].filter(Boolean).join(' • ')}
          </Typography>
        )}
        {teacherData?.is_adviser !== false && teacherData?.section && (
          <Typography variant="caption" display="block" sx={{ opacity: 0.9, mb: 0.5 }}>🧑‍🏫 Section: {teacherData.section}</Typography>
        )}
        {/* Subject only shown to advisers (their main advisory subject) */}
        {/* Subject label removed per design — subjects are shown in Subject Classes nav */}
        {/* Room / Schedule — adviser only */}
        {teacherData?.is_adviser !== false && teacherData?.room && (
          <Typography variant="caption" display="block" sx={{ opacity: 0.9, mb: 0.5 }}>🏫 Room: {teacherData.room}</Typography>
        )}
        {teacherData?.is_adviser !== false && teacherData?.schedule && (
          <Typography variant="caption" display="block" sx={{ opacity: 0.9 }}>⏰ {teacherData.schedule}</Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 1 }} />

      {/* Navigation */}
      <Box sx={{ px: 2, pb: 1, flex: 1, overflowY: 'auto' }}>

        {/* ── Main Class (Dashboard) — only show if teacher is an adviser ── */}
        {teacherData?.is_adviser !== false && (
          <>
            <Typography variant="caption" sx={{ opacity: 0.6, textTransform: 'uppercase', fontSize: 10, display: 'block', px: 1, mb: 0.5 }}>
              Main Class
            </Typography>
            <Box
              onClick={() => { setActiveView('dashboard'); setExcuseTab('dashboard'); setMobileOpen(false); }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 2, py: 1.2, cursor: 'pointer', borderRadius: 1, mb: 0.5,
                bgcolor: activeView === 'dashboard' && excuseTab === 'dashboard' ? 'rgba(255,255,255,0.2)' : 'transparent',
                borderLeft: activeView === 'dashboard' && excuseTab === 'dashboard' ? '3px solid #fff' : '3px solid transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
              }}
            >
              <Dashboard sx={{ fontSize: 18 }} />
              <Box flex={1}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Classroom Advisory</Typography>
                {teacherData?.section && (
                  <Typography variant="caption" sx={{ opacity: 0.8, fontSize: 10 }}>
                    {teacherData.section}
                  </Typography>
                )}
              </Box>
            </Box>
          </>
        )}

        {/* ── Excuse Requests ── */}
        {/* ── Excuse Requests — only for advisers ── */}
        {teacherData?.is_adviser !== false && (
          <Box
            onClick={() => { setActiveView('dashboard'); setExcuseTab('excuses'); setMobileOpen(false); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 2, py: 1.2, cursor: 'pointer', borderRadius: 1, mb: 1,
              bgcolor: excuseTab === 'excuses' ? 'rgba(255,255,255,0.2)' : 'transparent',
              borderLeft: excuseTab === 'excuses' ? '3px solid #fff' : '3px solid transparent',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
            }}
          >
            <EventAvailable sx={{ fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: excuseTab === 'excuses' ? 700 : 400, flex: 1 }}>
              Excuse Requests
            </Typography>
            {pendingExcuseCount > 0 && (
              <Box sx={{
                bgcolor: '#ef4444', color: '#fff', borderRadius: '10px',
                px: 1, py: 0.25, fontSize: '0.65rem', fontWeight: 700, minWidth: 18, textAlign: 'center',
              }}>
                {pendingExcuseCount}
              </Box>
            )}
          </Box>
        )}

        {/* ── SF2 Generator — only for advisers ── */}
        {teacherData?.is_adviser !== false && (
          <Box
            onClick={() => { setActiveView('sf2'); setExcuseTab('dashboard'); setMobileOpen(false); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 2, py: 1.2, cursor: 'pointer', borderRadius: 1, mb: 1,
              bgcolor: activeView === 'sf2' ? 'rgba(255,255,255,0.2)' : 'transparent',
              borderLeft: activeView === 'sf2' ? '3px solid #fbc02d' : '3px solid transparent',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
            }}
          >
            <Description sx={{ fontSize: 18, color: '#fbc02d' }} />
            <Typography variant="body2" sx={{ fontWeight: activeView === 'sf2' ? 700 : 400 }}>
              📋 SF2 Generator
            </Typography>
          </Box>
        )}

        {/* ── SF1 Generator — only for advisers ── */}
        {teacherData?.is_adviser !== false && (
          <Box
            onClick={() => { setActiveView('sf1'); setExcuseTab('dashboard'); setMobileOpen(false); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 2, py: 1.2, cursor: 'pointer', borderRadius: 1, mb: 1,
              bgcolor: activeView === 'sf1' ? 'rgba(255,255,255,0.2)' : 'transparent',
              borderLeft: activeView === 'sf1' ? '3px solid #66bb6a' : '3px solid transparent',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
            }}
          >
            <Description sx={{ fontSize: 18, color: '#66bb6a' }} />
            <Typography variant="body2" sx={{ fontWeight: activeView === 'sf1' ? 700 : 400 }}>
              📄 SF1 Generator
            </Typography>
          </Box>
        )}

        {/* ── Subject Classes (dynamic from assignments) ── */}
        {subjectAssignments.length > 0 && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', mb: 0.5 }} />
            <Typography variant="caption" sx={{ opacity: 0.6, textTransform: 'uppercase', fontSize: 10, display: 'block', px: 1, mb: 0.5 }}>
              Subject Classes
            </Typography>
            {subjectAssignments.map((asg: any) => (
              <Box key={asg.id}>
                {/* Subject class nav item */}
                <Box
                  onClick={() => { setActiveView(asg.id); setExcuseTab('dashboard'); setMobileOpen(false); }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 2, py: 1, cursor: 'pointer', borderRadius: 1, mb: 0,
                    bgcolor: activeView === asg.id && excuseTab !== 'subject-excuses' ? 'rgba(255,255,255,0.2)' : 'transparent',
                    borderLeft: activeView === asg.id && excuseTab !== 'subject-excuses' ? '3px solid #fbc02d' : '3px solid transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                  }}
                >
                  <TrendingUp sx={{ fontSize: 16, opacity: 0.8 }} />
                  <Box flex={1}>
                    <Typography variant="body2" sx={{ fontWeight: activeView === asg.id && excuseTab !== 'subject-excuses' ? 700 : 400, fontSize: '0.82rem', lineHeight: 1.2 }}>
                      {asg.subject}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.75, fontSize: '0.7rem' }}>
                      {asg.section}
                    </Typography>
                  </Box>
                </Box>
                {/* Excuse Requests sub-item under this subject */}
                <Box
                  onClick={() => {
                    setActiveView(asg.id);
                    setSubjectExcuseAsgId(asg.id);
                    setExcuseTab('subject-excuses');
                    setMobileOpen(false);
                  }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    pl: 4, pr: 2, py: 0.8, cursor: 'pointer', borderRadius: 1, mb: 0.5,
                    bgcolor: excuseTab === 'subject-excuses' && subjectExcuseAsgId === asg.id
                      ? 'rgba(255,255,255,0.2)' : 'transparent',
                    borderLeft: excuseTab === 'subject-excuses' && subjectExcuseAsgId === asg.id
                      ? '3px solid #fbc02d' : '3px solid transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                  }}
                >
                  <EventAvailable sx={{ fontSize: 15, opacity: 0.8 }} />
                  <Typography variant="caption" sx={{
                    fontWeight: excuseTab === 'subject-excuses' && subjectExcuseAsgId === asg.id ? 700 : 400,
                    fontSize: '0.75rem', flex: 1,
                  }}>
                    Excuse Requests
                  </Typography>
                  {(subjectPendingCounts[asg.id] ?? 0) > 0 && (
                    <Box sx={{
                      bgcolor: '#ef4444', color: '#fff', borderRadius: '10px',
                      px: 1, py: 0.25, fontSize: '0.65rem', fontWeight: 700, minWidth: 18, textAlign: 'center',
                    }}>
                      {subjectPendingCounts[asg.id]}
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </>
        )}
      </Box>

      <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
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
          <NotificationBell iconColor={theme.colors.neutral[700]} />
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, sm: 3 } }}>

          {/* ── SF2 GENERATOR VIEW ── */}
          {activeView === 'sf2' && excuseTab === 'dashboard' && (
            <SF2GeneratorPanel
              section={teacherData?.section || ''}
              onClose={() => setActiveView('dashboard')}
            />
          )}

          {/* ── SF1 GENERATOR VIEW ── */}
          {activeView === 'sf1' && excuseTab === 'dashboard' && (
            <SF1GeneratorPanel
              section={teacherData?.section || ''}
              onClose={() => setActiveView('dashboard')}
            />
          )}

          {/* ── EXCUSE REQUESTS TAB ── */}
          {excuseTab === 'excuses' && (
            <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{
                p: 2.5, background: theme.colors.status.warning.main, color: '#fff',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <Typography sx={{ fontFamily: theme.typography.fontFamily.display, fontWeight: 700, fontSize: 18 }}>
                  📋 Excuse Requests from Parents
                </Typography>
                <Box display="flex" gap={1} alignItems="center">
                  {pendingExcuseCount > 0 && (
                    <Chip label={`${pendingExcuseCount} pending`} size="small"
                      sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700 }} />
                  )}
                  <Button size="small" variant="outlined" onClick={fetchExcuseRequests}
                    sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                    Refresh
                  </Button>
                </Box>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Student', 'Date', 'Parent', 'Reason', 'Status', 'Actions'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#fff8e1' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {excuseRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#888' }}>
                          No excuse requests found
                        </TableCell>
                      </TableRow>
                    )}
                    {excuseRequests.map(req => (
                      <TableRow key={req.id} hover sx={{
                        bgcolor: req.status === 'pending' ? '#fffde7' : '#fff',
                        '&:hover': { bgcolor: '#f9f9f9' },
                      }}>
                        <TableCell><Typography sx={{ fontWeight: 700 }}>{req.student_name}</Typography></TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatAttendanceDate(req.date)}
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: '0.82rem' }}>{req.parent_name}</Typography>
                          {req.parent_contact && (
                            <Typography variant="caption" color="text.secondary">{req.parent_contact}</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 220 }}>
                          <Typography sx={{ fontSize: '0.82rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {req.reason}
                          </Typography>
                          {req.teacher_note && (
                            <Typography variant="caption" sx={{ color: '#e65100', display: 'block', mt: 0.5 }}>
                              Note: {req.teacher_note}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={req.status}
                            size="small"
                            color={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'error' : 'warning'}
                          />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={0.5} flexWrap="wrap">
                            {req.status === 'pending' && (
                              <>
                                <Button size="small" variant="contained"
                                  onClick={() => setResolveDialog({ open: true, request: req, action: 'approve', note: '', loading: false, error: '' })}
                                  sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' }, fontSize: '0.72rem', px: 1, py: 0.5, minWidth: 'unset', textTransform: 'none' }}>
                                  ✓ Approve
                                </Button>
                                <Button size="small" variant="outlined"
                                  onClick={() => setResolveDialog({ open: true, request: req, action: 'reject', note: '', loading: false, error: '' })}
                                  sx={{ color: '#c62828', borderColor: '#c62828', '&:hover': { bgcolor: '#ffebee' }, fontSize: '0.72rem', px: 1, py: 0.5, minWidth: 'unset', textTransform: 'none' }}>
                                  ✗ Reject
                                </Button>
                              </>
                            )}
                            <Tooltip title="Delete this request">
                              <IconButton
                                size="small"
                                onClick={async () => {
                                  if (!window.confirm('Delete this excuse request?')) return;
                                  try {
                                    await api.delete(`/excuse/teacher/${req.id}`);
                                    showSnack('Excuse request deleted', 'success');
                                    fetchExcuseRequests();
                                  } catch (err: any) {
                                    showSnack(err.response?.data?.error || 'Failed to delete', 'error');
                                  }
                                }}
                                sx={{ color: '#c62828', '&:hover': { bgcolor: '#ffebee' } }}
                              >
                                <Cancel fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* ── DASHBOARD TAB (only when Classroom Advisory is selected) ── */}
          {excuseTab === 'dashboard' && activeView === 'dashboard' && (<>

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

          {/* ── ADVISORY: Automated Partial Attendance List (Full Roster) ── */}
          <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{
              p: 2, bgcolor: '#fff8e1', borderBottom: '1px solid #ffe082',
            }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#e65100' }}>
                    ⏳ Automated Partial Attendance List
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    All assigned students — Confirm is enabled only for students who have scanned the kiosk
                  </Typography>
                </Box>
                <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                  {/* Session toggle — locked if teacher is AM-only or PM-only */}
                  <Box sx={{ display: 'flex', bgcolor: '#f5f5f5', borderRadius: 1, p: 0.5, gap: 0.5 }}>
                    {(['AM', 'PM'] as const).map(s => {
                      const isLocked = authorizedSession !== 'BOTH' && authorizedSession !== s;
                      return (
                        <Tooltip
                          key={s}
                          title={isLocked ? `You are only authorized to manage ${authorizedSession} attendance` : `Switch to ${s} session`}
                        >
                          <span>
                            <Button
                              size="small"
                              variant={activeSession === s ? 'contained' : 'text'}
                              disabled={isLocked}
                              onClick={() => !isLocked && setActiveSession(s)}
                              sx={{
                                minWidth: 48, py: 0.3, fontWeight: 700,
                                bgcolor: activeSession === s ? (s === 'AM' ? '#1565c0' : '#6a1b9a') : 'transparent',
                                color: activeSession === s ? '#fff' : isLocked ? '#ccc' : '#555',
                                '&:hover': { bgcolor: activeSession === s ? undefined : '#e0e0e0' },
                                '&.Mui-disabled': { color: '#ccc' },
                              }}
                            >
                              {s}
                              {isLocked && ' 🔒'}
                            </Button>
                          </span>
                        </Tooltip>
                      );
                    })}
                  </Box>
                  <Chip
                    label={`${roster.filter(r => r.has_scan && !r.already_confirmed).length} pending`}
                    size="small"
                    sx={{
                      bgcolor: roster.some(r => r.has_scan && !r.already_confirmed) ? '#ffa000' : '#e0e0e0',
                      color:   roster.some(r => r.has_scan && !r.already_confirmed) ? '#fff' : '#666',
                      fontWeight: 700,
                    }}
                  />
                  <Tooltip title={`Auto-mark all unconfirmed students as Absent for ${activeSession}`}>
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={autoAbsentBusy}
                        onClick={() => handleAutoAbsent(activeSession)}
                        sx={{ fontSize: '0.72rem', py: 0.5, px: 1.5, textTransform: 'none', fontWeight: 700 }}
                      >
                        {autoAbsentBusy
                          ? <CircularProgress size={14} />
                          : `Mark ${activeSession} Absent`}
                      </Button>
                    </span>
                  </Tooltip>
                  <IconButton size="small" onClick={() => fetchRoster(activeSession, date)}>
                    <Refresh fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </Box>

            {/* Roster table */}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Student', 'LRN', 'Subject', 'Kiosk Scan', 'Time', 'Record As', 'Action'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#fffde7' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rosterLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : roster.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#aaa', fontStyle: 'italic' }}>
                        No students assigned to this section
                      </TableCell>
                    </TableRow>
                  ) : roster.map(row => (
                    <RosterRow
                      key={row.student_id}
                      row={row}
                      session={activeSession}
                      onConfirm={handleConfirmAttendance}
                      confirmingId={confirmingId}
                      onMessage={handleRosterMessage}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Summary bar */}
            {roster.length > 0 && (
              <Box sx={{ px: 2, py: 1.5, bgcolor: '#fffde7', borderTop: '1px solid #ffe082', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: '#555' }}>
                  <strong>{roster.filter(r => r.already_confirmed).length}</strong> confirmed
                </Typography>
                <Typography variant="caption" sx={{ color: '#e65100' }}>
                  <strong>{roster.filter(r => r.has_scan && !r.already_confirmed).length}</strong> scanned, awaiting confirmation
                </Typography>
                <Typography variant="caption" sx={{ color: '#999' }}>
                  <strong>{roster.filter(r => !r.has_scan && !r.already_confirmed).length}</strong> not yet scanned
                </Typography>
                <Typography variant="caption" sx={{ color: '#555', ml: 'auto' }}>
                  Total: <strong>{roster.length}</strong> students
                </Typography>
              </Box>
            )}
          </Paper>

          {/* ── ADVISORY: Final Attendance List ── */}
          <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{
              p: 2, background: theme.colors.primary.gradient, color: '#fff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  ✅ Final Attendance List — {teacherData?.section || 'Classroom Advisory'}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>
                  Verified records • synced to Parent Portal
                </Typography>
              </Box>
              <Chip label={`${attendanceRecords.length} records`} size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700 }} />
            </Box>
            <TableContainer sx={{ maxHeight: 380 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {['Student', 'Date', 'LRN', 'Time', 'Subject', 'Method', 'Photo', 'Status', 'Actions'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, bgcolor: theme.colors.primary.light, color: '#fff' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && (
                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
                  )}
                  {!loading && attendanceRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4, color: '#aaa', fontStyle: 'italic' }}>
                        No verified attendance for this date
                      </TableCell>
                    </TableRow>
                  )}
                  {attendanceRecords.map((r) => (
                    <TableRow key={r.id} hover sx={{ bgcolor: r.is_overridden ? '#fff3e0' : '#fff', '&:hover': { bgcolor: '#f5f5f5' } }}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Typography sx={{ fontWeight: 700 }}>{r.student_name}</Typography>
                          {atRiskIds.has(r.student_id!) && (
                            <Tooltip title="⚠️ Low attendance this month (below 80%)">
                              <span style={{ fontSize: '1rem', cursor: 'default' }}>⚠️</span>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatAttendanceDate(r.date)}
                      </TableCell>
                      <TableCell>{r.lrn}</TableCell>
                      <TableCell>
                        {/* Show kiosk scan time (time_in), not confirmation time (timestamp) */}
                        {r.time_in || (r.timestamp ? (() => { try { return format(new Date(r.timestamp), 'hh:mm a'); } catch { return '—'; } })() : '—')}
                      </TableCell>
                      <TableCell>
                        {r.subject ? (
                          <Chip label={r.subject} size="small"
                            sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontSize: '0.68rem', fontWeight: 600 }} />
                        ) : (
                          <Chip label="General" size="small"
                            sx={{ bgcolor: '#f3e5f5', color: '#6a1b9a', fontSize: '0.68rem', fontWeight: 600 }} />
                        )}
                      </TableCell>
                      <TableCell><Chip label={r.scan_method} size="small" /></TableCell>
                      <TableCell align="center">
                        <Tooltip title={r.photo_path ? 'View Photo' : 'No photo'}>
                          <span>
                            <IconButton size="small" disabled={!r.photo_path}
                              onClick={() => r.photo_path && setPhotoDialog({
                                open: true, photoUrl: r.photo_path!,
                                studentName: r.student_name, status: r.status,
                                timestamp: r.timestamp, method: r.scan_method || '',
                              })}
                              sx={{ color: r.photo_path ? theme.colors.primary.main : '#ccc' }}>
                              <PhotoCamera fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip label={r.status} size="small"
                          color={r.status === 'Time-In' ? 'success' : r.status === 'Late' ? 'warning' : r.status === 'Time-Out' ? 'info' : r.status === 'Excused' ? 'default' : 'error'} />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Add Note">
                          <IconButton size="small" onClick={() => handleAddNote(r)} sx={{ color: theme.colors.secondary.main }}>
                            <Note fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Message Parent">
                          <IconButton size="small"
                            onClick={() => setMsgDialog({ open: true, studentName: r.student_name, studentId: r.student_id!, subject: '', body: '', loading: false, error: '', success: false })}
                            sx={{ color: theme.colors.primary.main }}>
                            <Email fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Students in this class */}
            {students.length > 0 && (
              <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', bgcolor: '#f9f9f9' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#555' }}>
                  Students in this class ({students.length}):
                </Typography>
                <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
                  {students.map((s: any) => (
                    <Chip key={s.id} label={s.name} size="small"
                      sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontSize: '0.7rem' }} />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>

          </>)}  {/* end dashboard tab */}

          {/* ── SUBJECT EXCUSE REQUESTS VIEW ── */}
          {excuseTab === 'subject-excuses' && subjectExcuseAsgId !== null && (() => {
            const asg = subjectAssignments.find((a: any) => a.id === subjectExcuseAsgId);
            return (
              <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                {/* Header */}
                <Box sx={{
                  p: 2.5, background: theme.colors.status.warning.main, color: '#fff',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1,
                }}>
                  <Box>
                    <Typography sx={{ fontFamily: theme.typography.fontFamily.display, fontWeight: 700, fontSize: 18 }}>
                      📋 Excuse Requests from Parents
                    </Typography>
                    {asg && (
                      <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
                        {asg.subject} — {asg.section}
                      </Typography>
                    )}
                  </Box>
                  <Button size="small" variant="outlined"
                    onClick={() => fetchSubjectExcuseRequests(subjectExcuseAsgId)}
                    sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                    Refresh
                  </Button>
                </Box>

                {/* Table */}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['Student', 'Date', 'Parent', 'Reason', 'Status', 'Actions'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#fff8e1' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {subjectExcuseLoading && (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                            <CircularProgress size={24} />
                          </TableCell>
                        </TableRow>
                      )}
                      {!subjectExcuseLoading && subjectExcuseRequests.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#888' }}>
                            No excuse requests found
                          </TableCell>
                        </TableRow>
                      )}
                      {!subjectExcuseLoading && subjectExcuseRequests.map((req: any) => (
                        <TableRow key={req.id} hover sx={{
                          bgcolor: req.status === 'pending' ? '#fffde7' : '#fff',
                          '&:hover': { bgcolor: '#f9f9f9' },
                        }}>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700 }}>{req.student_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{req.section}</Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {formatAttendanceDate(req.date)}
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: '0.82rem' }}>{req.parent_name}</Typography>
                            {req.parent_contact && (
                              <Typography variant="caption" color="text.secondary">{req.parent_contact}</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 220 }}>
                            <Typography sx={{ fontSize: '0.82rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {req.reason}
                            </Typography>
                            {req.teacher_note && (
                              <Typography variant="caption" sx={{ color: '#e65100', display: 'block', mt: 0.5 }}>
                                Note: {req.teacher_note}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={req.status}
                              size="small"
                              color={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'error' : 'warning'}
                            />
                          </TableCell>
                          <TableCell>
                            <Box display="flex" gap={0.5} flexWrap="wrap">
                              {req.status === 'pending' && (
                                <>
                                  <Button size="small" variant="contained"
                                    onClick={() => setResolveDialog({ open: true, request: req, action: 'approve', note: '', loading: false, error: '' })}
                                    sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' }, fontSize: '0.72rem', px: 1, py: 0.5, minWidth: 'unset', textTransform: 'none' }}>
                                    ✓ Approve
                                  </Button>
                                  <Button size="small" variant="outlined"
                                    onClick={() => setResolveDialog({ open: true, request: req, action: 'reject', note: '', loading: false, error: '' })}
                                    sx={{ color: '#c62828', borderColor: '#c62828', '&:hover': { bgcolor: '#ffebee' }, fontSize: '0.72rem', px: 1, py: 0.5, minWidth: 'unset', textTransform: 'none' }}>
                                    ✗ Reject
                                  </Button>
                                </>
                              )}
                              <Tooltip title="Delete this request">
                                <IconButton size="small"
                                  onClick={async () => {
                                    if (!window.confirm('Delete this excuse request?')) return;
                                    try {
                                      await api.delete(`/excuse/teacher/${req.id}`);
                                      showSnack('Excuse request deleted', 'success');
                                      fetchSubjectExcuseRequests(subjectExcuseAsgId!);
                                    } catch (err: any) {
                                      showSnack(err.response?.data?.error || 'Failed to delete', 'error');
                                    }
                                  }}
                                  sx={{ color: '#c62828', '&:hover': { bgcolor: '#ffebee' } }}>
                                  <Cancel fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            );
          })()}

          {/* ── SUBJECT CLASS VIEW ── */}
          {typeof activeView === 'number' && excuseTab !== 'subject-excuses' && (() => {
            const asg = subjectAssignments.find((a: any) => a.id === activeView);
            if (!asg) return null;
            return (
              <Box>
                {/* Subject header */}
                <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ p: 2.5, background: theme.colors.primary.gradient, color: '#fff',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography sx={{ fontFamily: theme.typography.fontFamily.display, fontWeight: 700, fontSize: 18 }}>
                        📚 {asg.subject}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
                        {asg.section} {asg.year_level && `• ${asg.year_level}`}
                        {asg.strand && ` • ${asg.strand}`}
                        {asg.track && ` • ${asg.track}`}
                        {asg.adviser_name && ` • Adviser: ${asg.adviser_name}`}
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <TextField type="date" size="small" value={subjectDate}
                        onChange={e => {
                          setSubjectDate(e.target.value);
                          fetchRoster(activeSession, e.target.value, asg.section);
                        }}
                        sx={{ width: 150, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 1,
                          '& input': { color: '#fff' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' } }}
                      />
                      <Button size="small" variant="outlined"
                        onClick={() => fetchSubjectAttendance(activeView, subjectDate)}
                        sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: '#fff' } }}>
                        Refresh
                      </Button>
                    </Box>
                  </Box>
                </Paper>

                {subjectLoading ? (
                  <Box textAlign="center" py={4}><CircularProgress /></Box>
                ) : (
                  <>
                    {/* ── 1. Automated Partial Attendance List (Full Roster) ── */}
                    <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{ p: 2, bgcolor: '#fff8e1', borderBottom: '1px solid #ffe082' }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#e65100' }}>
                              ⏳ Automated Partial Attendance List
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              All assigned students — Confirm is enabled only for students who have scanned the kiosk
                            </Typography>
                          </Box>
                          <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                            {/* Session toggle — locked to authorized session */}
                            <Box sx={{ display: 'flex', bgcolor: '#f5f5f5', borderRadius: 1, p: 0.5, gap: 0.5 }}>
                              {(['AM', 'PM'] as const).map(s => {
                                const isLocked = authorizedSession !== 'BOTH' && authorizedSession !== s;
                                return (
                                  <Tooltip key={s} title={isLocked ? `You are only authorized to manage ${authorizedSession} attendance` : `Switch to ${s}`}>
                                    <span>
                                      <Button size="small"
                                        variant={activeSession === s ? 'contained' : 'text'}
                                        disabled={isLocked}
                                        onClick={() => !isLocked && setActiveSession(s)}
                                        sx={{
                                          minWidth: 48, py: 0.3, fontWeight: 700,
                                          bgcolor: activeSession === s ? (s === 'AM' ? '#1565c0' : '#6a1b9a') : 'transparent',
                                          color: activeSession === s ? '#fff' : isLocked ? '#ccc' : '#555',
                                        }}
                                      >
                                        {s}{isLocked && ' 🔒'}
                                      </Button>
                                    </span>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                            <Chip
                              label={`${roster.filter(r => r.has_scan && !r.already_confirmed).length} pending`}
                              size="small"
                              sx={{
                                bgcolor: roster.some(r => r.has_scan && !r.already_confirmed) ? '#ffa000' : '#e0e0e0',
                                color:   roster.some(r => r.has_scan && !r.already_confirmed) ? '#fff' : '#666',
                                fontWeight: 700,
                              }}
                            />
                            <Tooltip title={`Auto-mark all unconfirmed students as Absent for ${activeSession}`}>
                              <span>
                                <Button size="small" variant="outlined" color="error"
                                  disabled={autoAbsentBusy}
                                  onClick={() => handleAutoAbsent(activeSession)}
                                  sx={{ fontSize: '0.72rem', py: 0.5, px: 1.5, textTransform: 'none', fontWeight: 700 }}>
                                  {autoAbsentBusy ? <CircularProgress size={14} /> : `Mark ${activeSession} Absent`}
                                </Button>
                              </span>
                            </Tooltip>
                            <IconButton size="small" onClick={() => fetchRoster(activeSession, subjectDate, asg.section)}>
                              <Refresh fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              {['Student', 'LRN', 'Subject', 'Kiosk Scan', 'Time', 'Record As', 'Action'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#fffde7' }}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {rosterLoading ? (
                              <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                  <CircularProgress size={24} />
                                </TableCell>
                              </TableRow>
                            ) : roster.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#aaa', fontStyle: 'italic' }}>
                                  No students assigned to this class
                                </TableCell>
                              </TableRow>
                            ) : roster.map(row => (
                              <RosterRow
                                key={row.student_id}
                                row={row}
                                session={activeSession}
                                onConfirm={handleConfirmAttendance}
                                confirmingId={confirmingId}
                                onMessage={handleRosterMessage}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      {roster.length > 0 && (
                        <Box sx={{ px: 2, py: 1.5, bgcolor: '#fffde7', borderTop: '1px solid #ffe082', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <Typography variant="caption" sx={{ color: '#555' }}>
                            <strong>{roster.filter(r => r.already_confirmed).length}</strong> confirmed
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#e65100' }}>
                            <strong>{roster.filter(r => r.has_scan && !r.already_confirmed).length}</strong> scanned, awaiting confirmation
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#999' }}>
                            <strong>{roster.filter(r => !r.has_scan && !r.already_confirmed).length}</strong> not yet scanned
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#555', ml: 'auto' }}>
                            Total: <strong>{roster.length}</strong> students
                          </Typography>
                        </Box>
                      )}
                    </Paper>

                    {/* ── 2. Final Attendance List ── */}
                    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{ p: 2, background: theme.colors.primary.gradient, color: '#fff',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            ✅ Final Attendance List — {asg.subject}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.85 }}>
                            Verified records • synced to Parent Portal
                          </Typography>
                        </Box>
                        <Chip label={`${finalAttendance.length} records`} size="small"
                          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700 }} />
                      </Box>
                      <TableContainer sx={{ maxHeight: 400 }}>
                        <Table stickyHeader size="small">
                          <TableHead>
                            <TableRow>
                              {['Student', 'Date', 'LRN', 'Time', 'Subject', 'Method', 'Status', 'Photo'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 700, bgcolor: theme.colors.primary.light, color: '#fff' }}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {finalAttendance.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#aaa', fontStyle: 'italic' }}>
                                  No verified attendance for this date
                                </TableCell>
                              </TableRow>
                            ) : finalAttendance.map(r => (
                              <TableRow key={r.id} hover>
                                <TableCell sx={{ fontWeight: 700 }}>{r.student_name}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                  {formatAttendanceDate(r.date)}
                                </TableCell>
                                <TableCell>{r.lrn}</TableCell>
                                <TableCell>
                                  {r.time_in || (r.timestamp ? format(new Date(r.timestamp), 'hh:mm a') : '—')}
                                </TableCell>
                                <TableCell>
                                  {r.subject ? (
                                    <Chip label={r.subject} size="small"
                                      sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontSize: '0.68rem', fontWeight: 600 }} />
                                  ) : (
                                    <Chip label="General" size="small"
                                      sx={{ bgcolor: '#f3e5f5', color: '#6a1b9a', fontSize: '0.68rem', fontWeight: 600 }} />
                                  )}
                                </TableCell>
                                <TableCell><Chip label={r.scan_method} size="small" /></TableCell>
                                <TableCell>
                                  <Chip label={r.status} size="small"
                                    color={r.status === 'Time-In' ? 'success' : r.status === 'Late' ? 'warning' : r.status === 'Time-Out' ? 'info' : r.status === 'Excused' ? 'default' : 'error'} />
                                </TableCell>
                                <TableCell align="center">
                                  {r.photo_path ? (
                                    <Tooltip title="View photo">
                                      <IconButton size="small" onClick={() => setPhotoDialog({
                                        open: true, photoUrl: r.photo_path!,
                                        studentName: r.student_name, status: r.status,
                                        timestamp: r.timestamp, method: r.scan_method,
                                      })} sx={{ color: theme.colors.primary.main }}>
                                        <PhotoCamera fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  ) : (
                                    <PhotoCamera fontSize="small" sx={{ color: '#ccc' }} />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      {/* Student roster for this subject */}
                      {subjectStudents.length > 0 && (
                        <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', bgcolor: '#f9f9f9' }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#555' }}>
                            Students in this class ({subjectStudents.length}):
                          </Typography>
                          <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
                            {subjectStudents.map((s: any) => (
                              <Chip key={s.id} label={s.name} size="small"
                                sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontSize: '0.7rem' }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Paper>
                  </>
                )}
              </Box>
            );
          })()}

        </Box>
      </Box>

      {/* ── Resolve Excuse Dialog (Teacher Approve/Reject) ── */}
      <Dialog
        open={resolveDialog.open}
        onClose={() => !resolveDialog.loading && setResolveDialog(d => ({ ...d, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          bgcolor: resolveDialog.action === 'approve' ? '#2e7d32' : '#c62828',
          color: '#fff',
          fontFamily: theme.typography.fontFamily.display,
          fontWeight: theme.typography.fontWeight.bold,
        }}>
          {resolveDialog.action === 'approve' ? '✅ Approve Excuse Request' : '❌ Reject Excuse Request'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {resolveDialog.error && (
            <Alert severity="error" sx={{ mb: 2 }}>{resolveDialog.error}</Alert>
          )}
          {resolveDialog.request && (
            <Box sx={{ p: 2, mb: 2.5, bgcolor: '#f5f5f5', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                {resolveDialog.request.student_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Date:{' '}
                {formatAttendanceDate(resolveDialog.request.date, 'MMMM d, yyyy')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Reason: {resolveDialog.request.reason}
              </Typography>
            </Box>
          )}
          <TextField
            label="Note to parent (optional)"
            fullWidth
            multiline
            rows={3}
            value={resolveDialog.note}
            onChange={e => setResolveDialog(d => ({ ...d, note: e.target.value }))}
            placeholder={
              resolveDialog.action === 'approve'
                ? 'E.g., Approved. Please bring a medical certificate next time.'
                : 'E.g., Please provide a valid excuse letter from a doctor.'
            }
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setResolveDialog(d => ({ ...d, open: false }))}
            disabled={resolveDialog.loading}
            sx={{ textTransform: 'none', color: '#666' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleResolveExcuse}
            disabled={resolveDialog.loading}
            sx={{
              bgcolor: resolveDialog.action === 'approve' ? '#2e7d32' : '#c62828',
              '&:hover': { bgcolor: resolveDialog.action === 'approve' ? '#1b5e20' : '#b71c1c' },
              textTransform: 'none',
              fontWeight: 700,
              minWidth: 130,
            }}
          >
            {resolveDialog.loading
              ? <CircularProgress size={18} sx={{ color: '#fff' }} />
              : resolveDialog.action === 'approve' ? '✅ Confirm Approve' : '❌ Confirm Reject'
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Message Parent Dialog ── */}
      <Dialog
        open={msgDialog.open}
        onClose={() => !msgDialog.loading && setMsgDialog(d => ({ ...d, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          background: theme.colors.primary.gradient,
          color: '#fff',
          fontFamily: theme.typography.fontFamily.display,
          fontWeight: theme.typography.fontWeight.bold,
        }}>
          📩 Message Parent — {msgDialog.studentName}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {msgDialog.error && <Alert severity="error" sx={{ mb: 2 }}>{msgDialog.error}</Alert>}
          {msgDialog.success ? (
            <Box textAlign="center" py={2}>
              <Typography sx={{ fontSize: '3rem', mb: 1 }}>✅</Typography>
              <Typography fontWeight={700} color="success.main">Message sent successfully!</Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                The parent will receive an SMS and an in-app notification.
              </Typography>
            </Box>
          ) : (
            <>
              <TextField
                label="Subject *"
                fullWidth
                value={msgDialog.subject}
                onChange={e => setMsgDialog(d => ({ ...d, subject: e.target.value }))}
                placeholder="E.g., Attendance concern for this week"
                sx={{ mb: 2 }}
                autoFocus
              />
              <TextField
                label="Message *"
                fullWidth
                multiline
                rows={5}
                value={msgDialog.body}
                onChange={e => setMsgDialog(d => ({ ...d, body: e.target.value }))}
                placeholder="Write your message to the parent here..."
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                The parent will receive this message in their portal and via SMS.
              </Typography>
            </>
          )}
        </DialogContent>
        {!msgDialog.success && (
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              onClick={() => setMsgDialog(d => ({ ...d, open: false }))}
              disabled={msgDialog.loading}
              sx={{ textTransform: 'none', color: '#666' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={msgDialog.loading || !msgDialog.subject.trim() || !msgDialog.body.trim()}
              sx={{
                ...theme.components.button.primary,
                '&:hover': theme.components.button.primary.hover,
                minWidth: 120,
              }}
            >
              {msgDialog.loading
                ? <CircularProgress size={18} sx={{ color: '#fff' }} />
                : '📩 Send Message'
              }
            </Button>
          </DialogActions>
        )}
      </Dialog>

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
