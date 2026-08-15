import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Grid, Paper, Typography, Chip, Avatar, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Snackbar, Switch, FormControlLabel, FormGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip,
  Drawer, AppBar, Toolbar, useMediaQuery, useTheme as useMuiTheme, InputAdornment,
} from '@mui/material';
import {
  People, School, Router, Sms, Dashboard, Logout, Add, Edit,
  ToggleOn, ToggleOff, LockReset, Menu, Close, PersonAdd,
  CheckCircle, Cancel, AccessTime, Assessment, PhotoCamera, Delete,
  QrCode2, Bluetooth, CreditCard, Download, LocationOn, Campaign,
  Class as ClassIcon, Settings, Search,
} from '@mui/icons-material';
import { QRCodeCanvas } from 'qrcode.react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import type { AdminStats, AttendanceRecord, Kiosk } from '../types';
import AttendancePhotoDialog from '../components/AttendancePhotoDialog';
import BLEPositioningMap from '../components/BLEPositioningMap';
import theme from '../theme/professionalTheme';
import NotificationBell from '../components/NotificationBell';
import ReportsPage from './ReportsPage';
import KiosksPage from './KiosksPage';
import AssignmentsPage from './AssignmentsPage';

const NAV = [
  { id: 'dashboard',      label: 'Dashboard',       icon: <Dashboard /> },
  { id: 'users',          label: 'Users',            icon: <People /> },
  { id: 'students',       label: 'Students',         icon: <School /> },
  { id: 'assignments',    label: 'Assignments',      icon: <ClassIcon /> },
  { id: 'kiosks',         label: 'Kiosks',           icon: <Router /> },
  { id: 'sms',            label: 'SMS Logs',         icon: <Sms /> },
  { id: 'reports',        label: 'Reports',          icon: <Assessment /> },
  { id: 'location',       label: 'Live Map',         icon: <LocationOn /> },
  { id: 'announcements',  label: 'Announcements',    icon: <Campaign /> },
  { id: 'school-settings', label: 'School Settings', icon: <Settings /> },
];

type Tab = 'dashboard' | 'users' | 'students' | 'assignments' | 'kiosks' | 'sms' | 'reports' | 'location' | 'announcements' | 'school-settings';

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

// ─── EditStudentDialog ────────────────────────────────────────────────
// Allows admin to edit all student fields including SF2 name fields
function EditStudentDialog({
  open, user, onClose, onSaved,
}: {
  open: boolean; user: any; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: '', last_name: '', first_name: '', middle_name: '',
    lrn: '', gender: '', grade: '', section: '',
    mac_address: '', rfid_uid: '', contact: '',
    // SF1 fields
    birthdate: '', birth_place: '', mother_tongue: '',
    ip_ethnic: '', religion: '',
    address_street: '', barangay: '', municipality: '', province: '',
    sf1_remarks: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Load user data into form when dialog opens
  useEffect(() => {
    if (!open || !user) return;
    // Fetch full profile to get student fields
    api.get(`/admin/users/${user.id}`)
      .then(r => {
        const p = r.data?.profile || {};
        setForm({
          name:         p.name         || user.username || '',
          last_name:    p.last_name    || '',
          first_name:   p.first_name   || '',
          middle_name:  p.middle_name  || '',
          lrn:          p.lrn          || '',
          gender:       p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : '',
          grade:        p.grade        || '',
          section:      p.section      || '',
          mac_address:  p.mac_address  || '',
          rfid_uid:     p.rfid_uid     || '',
          contact:      p.contact      || '',
          // SF1 fields
          birthdate:      p.birthdate      ? String(p.birthdate).split('T')[0] : '',
          birth_place:    p.birth_place    || '',
          mother_tongue:  p.mother_tongue  || '',
          ip_ethnic:      p.ip_ethnic      || '',
          religion:       p.religion       || '',
          address_street: p.address_street || '',
          barangay:       p.barangay       || '',
          municipality:   p.municipality   || '',
          province:       p.province       || '',
          sf1_remarks:    p.sf1_remarks    || '',
        });
      })
      .catch(() => {});
  }, [open, user]);

  const handleSave = async () => {
    setError('');
    setLoading(true);
    try {
      await api.put(`/admin/users/${user.id}`, {
        role: 'student',
        name:         form.name,
        last_name:    form.last_name    || null,
        first_name:   form.first_name   || null,
        middle_name:  form.middle_name  || null,
        lrn:          form.lrn,
        gender:       form.gender,
        grade:        form.grade,
        section:      form.section,
        mac_address:  form.mac_address  || null,
        rfid_uid:     form.rfid_uid     || null,
        contact:      form.contact      || null,
        // SF1 fields
        birthdate:      form.birthdate      || null,
        birth_place:    form.birth_place    || null,
        mother_tongue:  form.mother_tongue  || null,
        ip_ethnic:      form.ip_ethnic      || null,
        religion:       form.religion       || null,
        address_street: form.address_street || null,
        barangay:       form.barangay       || null,
        municipality:   form.municipality   || null,
        province:       form.province       || null,
        sf1_remarks:    form.sf1_remarks     || null,
      });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: '#1565c0', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
        <span>✏️ Edit Student — {user.username}</span>
        <IconButton onClick={onClose} sx={{ color: '#fff' }}><Close /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* SF2 Name Fields */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1565c0', mb: 1.5 }}>
          🎓 Name for SF2 (Last Name, First Name, Middle Name)
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Last Name" fullWidth value={form.last_name}
              onChange={e => set('last_name', e.target.value)}
              helperText="e.g. Dela Cruz" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="First Name" fullWidth value={form.first_name}
              onChange={e => set('first_name', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Middle Name" fullWidth value={form.middle_name}
              onChange={e => set('middle_name', e.target.value)}
              helperText="Optional" />
          </Grid>
        </Grid>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#555', mb: 1.5 }}>
          Student Information
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Full Name (system)" fullWidth value={form.name}
              onChange={e => set('name', e.target.value)}
              helperText="Auto-updated from Last/First/Middle when saved" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="LRN *" fullWidth value={form.lrn}
              onChange={e => set('lrn', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select value={form.gender} label="Gender" onChange={e => set('gender', e.target.value)}>
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Grade Level" fullWidth value={form.grade}
              onChange={e => set('grade', e.target.value)} placeholder="e.g. Grade 9" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Section" fullWidth value={form.section}
              onChange={e => set('section', e.target.value)} placeholder="e.g. IT3R4" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="RFID UID" fullWidth value={form.rfid_uid}
              onChange={e => set('rfid_uid', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="MAC Address (BLE)" fullWidth value={form.mac_address}
              onChange={e => set('mac_address', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Contact" fullWidth value={form.contact}
              onChange={e => set('contact', e.target.value)} />
          </Grid>
        </Grid>

        {/* SF1 Fields */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2e7d32', mb: 1.5, mt: 2.5 }}>
          📄 SF1 Fields (School Register)
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Birthdate" type="date" fullWidth value={form.birthdate}
              onChange={e => set('birthdate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="mm/dd/yyyy format in SF1" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Birth Place (Province)" fullWidth value={form.birth_place}
              onChange={e => set('birth_place', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Mother Tongue" fullWidth value={form.mother_tongue}
              onChange={e => set('mother_tongue', e.target.value)}
              placeholder="e.g. Cebuano" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="IP / Ethnic Group" fullWidth value={form.ip_ethnic}
              onChange={e => set('ip_ethnic', e.target.value)}
              placeholder="Leave blank if not applicable" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Religion" fullWidth value={form.religion}
              onChange={e => set('religion', e.target.value)}
              placeholder="e.g. Roman Catholic" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="SF1 Remarks" fullWidth value={form.sf1_remarks}
              onChange={e => set('sf1_remarks', e.target.value)}
              placeholder="e.g. T/O, DRP, CCT" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField label="House # / Street / Sitio / Purok" fullWidth value={form.address_street}
              onChange={e => set('address_street', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Barangay" fullWidth value={form.barangay}
              onChange={e => set('barangay', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Municipality / City" fullWidth value={form.municipality}
              onChange={e => set('municipality', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="Province" fullWidth value={form.province}
              onChange={e => set('province', e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}
          sx={{ bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' } }}>
          {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : '💾 Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── SchoolSettingsPanel ─────────────────────────────────────────────
function SchoolSettingsPanel() {
  const [form, setForm] = useState({
    school_id: '', region: '', division: '', district: '',
    school_name: '', school_year: '', school_head_name: '',
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [snack,    setSnack]    = useState({ open: false, msg: '', sev: 'success' as any });

  useEffect(() => {
    api.get('/admin/school-settings')
      .then(r => {
        const d = r.data || {};
        setForm({
          school_id:        d.school_id        || '',
          region:           d.region           || '',
          division:         d.division         || '',
          district:         d.district         || '',
          school_name:      d.school_name      || '',
          school_year:      d.school_year      || '',
          school_head_name: d.school_head_name || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/school-settings', form);
      setSnack({ open: true, msg: 'School settings saved', sev: 'success' });
    } catch {
      setSnack({ open: true, msg: 'Failed to save settings', sev: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;

  return (
    <Box maxWidth={600}>
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 2.5, background: '#1565c0', color: '#fff' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>🏫 School Settings</Typography>
          <Typography variant="caption" sx={{ opacity: 0.85 }}>
            Used to populate SF1 &amp; SF2 report headers and system identification
          </Typography>
        </Box>
        <Box sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="School ID" fullWidth value={form.school_id}
                onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))}
                helperText="DepEd-assigned school ID number" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="School Year" fullWidth value={form.school_year}
                onChange={e => setForm(f => ({ ...f, school_year: e.target.value }))}
                placeholder="e.g. 2025-2026" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Name of School" fullWidth value={form.school_name}
                onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))}
                placeholder="e.g. Iponan National High School" />
            </Grid>
            {/* SF1 fields */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Region" fullWidth value={form.region}
                onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                placeholder="e.g. Region X" helperText="For SF1 header" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Division" fullWidth value={form.division}
                onChange={e => setForm(f => ({ ...f, division: e.target.value }))}
                placeholder="e.g. Cagayan de Oro City" helperText="For SF1 header" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="District" fullWidth value={form.district}
                onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                placeholder="e.g. District III" helperText="For SF1 header" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="School Head Name" fullWidth value={form.school_head_name}
                onChange={e => setForm(f => ({ ...f, school_head_name: e.target.value }))}
                helperText="Appears on SF1 &amp; SF2 signature line" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button variant="contained" onClick={handleSave} disabled={saving}
                sx={{ bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' } }}>
                {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : '💾 Save Settings'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

function CreateUserDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    username: '', password: '', role: 'teacher', name: '',
    gender: '', contact: '', address: '', lrn: '',
    subject: '', room: '', schedule: '', employee_id: '',
    grade: '', section: '',
    // SF2 name fields
    last_name: '', first_name: '', middle_name: '',
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
      const payload = form.role === 'student'
        ? { ...form, parents: parents.filter(p => p.username && p.name) }
        : form;
      await api.post('/admin/users', payload);
      onCreated();
      onClose();
      setForm({
        username:'', password:'', role:'teacher', name:'', gender:'', section:'',
        contact:'', address:'', lrn:'', grade:'', subject:'', room:'', schedule:'',
        employee_id:'', last_name:'', first_name:'', middle_name:'',
      });
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
            <TextField label="Full Name *" fullWidth value={form.name} onChange={e => set('name', e.target.value)}
              helperText={form.role === 'student' ? 'Auto-filled from Last/First/Middle below' : ''} />
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
          {form.role === 'teacher' && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Employee ID" fullWidth value={form.employee_id} onChange={e => set('employee_id', e.target.value)} />
            </Grid>
          )}
          {form.role === 'student' && (<>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1565c0', mt: 1, mb: 0.5 }}>
                🎓 Student Information (required for SF2)
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Last Name *" fullWidth value={form.last_name}
                onChange={e => { set('last_name', e.target.value); }}
                helperText="e.g. Dela Cruz" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="First Name *" fullWidth value={form.first_name}
                onChange={e => { set('first_name', e.target.value); }}
                helperText="e.g. Juan" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Middle Name" fullWidth value={form.middle_name}
                onChange={e => set('middle_name', e.target.value)}
                helperText="Optional" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="LRN *" fullWidth value={form.lrn} onChange={e => set('lrn', e.target.value)}
                helperText="12-digit Learner Reference Number" />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField label="Grade Level" fullWidth value={form.grade} onChange={e => set('grade', e.target.value)}
                placeholder="e.g. Grade 9" />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField label="Section" fullWidth value={form.section} onChange={e => set('section', e.target.value)}
                placeholder="e.g. IT3R4" />
            </Grid>

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
                      <TextField label="Username" size="small" fullWidth value={parent.username}
                        onChange={e => setParent(index, 'username', e.target.value)}
                        placeholder={index === 2 ? 'Optional' : ''} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField label="Password" size="small" type="password" fullWidth value={parent.password}
                        onChange={e => setParent(index, 'password', e.target.value)}
                        placeholder={index === 2 ? 'Optional' : ''} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField label="Full Name" size="small" fullWidth value={parent.name}
                        onChange={e => setParent(index, 'name', e.target.value)}
                        placeholder={index === 2 ? 'Optional' : ''} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Relationship</InputLabel>
                        <Select value={parent.relationship} label="Relationship"
                          onChange={e => setParent(index, 'relationship', e.target.value)}>
                          {['Father','Mother','Guardian','Grandfather','Grandmother','Uncle','Aunt'].map(r => (
                            <MenuItem key={r} value={r}>{r}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TextField label="Contact" size="small" fullWidth value={parent.contact}
                        onChange={e => setParent(index, 'contact', e.target.value)} placeholder="09xxxxxxxxx" />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            ))}
          </>)}
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
  const muiTheme         = useMuiTheme();
  const isMobile         = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [tab,        setTab]        = useState<Tab>('dashboard');
  const [sideOpen,   setSideOpen]   = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stats,      setStats]      = useState<AdminStats | null>(null);
  const [logs,       setLogs]       = useState<AttendanceRecord[]>([]);
  const [kiosks,     setKiosks]     = useState<Kiosk[]>([]);
  const [users,      setUsers]      = useState<any[]>([]);
  const [smsLogs,    setSmsLogs]    = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [snack,      setSnack]      = useState({ open: false, msg: '', sev: 'success' as any });
  const [addParentOpen, setAddParentOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [editOpen,    setEditOpen]    = useState(false);
  const [editUser,    setEditUser]    = useState<any>(null);

  // Attendance alerts state
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertCount, setAlertCount] = useState(0);

  // Fingerprint room prediction state
  const [roomPrediction, setRoomPrediction] = useState<{
    predicted_location: string;
    confidence_distance: number;
    live_anchors: { anchor_id: string; rssi: number }[];
  } | null>(null);
  const [roomPredictionError, setRoomPredictionError] = useState<string | null>(null);

  // Room Enter/Exit state
  const [studentStatus, setStudentStatus] = useState<Record<string, {
    room_name: string; status: 'inside' | 'outside';
    last_distance: number; last_rssi: number; since: string;
  }>>({});
  const [roomEvents, setRoomEvents] = useState<any[]>([]);

  // Announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annForm, setAnnForm] = useState({
    title: '', body: '',
    targetTeachers: true, targetParents: true, targetStudents: false,
    sendSms: false, loading: false, error: '', success: '',
  });

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

  // Load attendance alerts
  const loadAlerts = useCallback(async () => {
    try {
      const { data } = await api.get('/alerts/admin');
      setAlerts(data.alerts || []);
      setAlertCount(data.count || 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const loadAnnouncements = useCallback(async () => {
    try {
      const { data } = await api.get('/announcements');
      setAnnouncements(data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (tab === 'announcements') loadAnnouncements();
  }, [tab, loadAnnouncements]);

  // Auto-refresh dashboard every 5 seconds when on dashboard tab
  useEffect(() => {
    if (tab === 'dashboard') {
      const interval = setInterval(() => {
        loadDashboard();
      }, 5000); // Refresh every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [tab, loadDashboard]);

  // Poll fingerprint room prediction every 5 seconds when on the Live Map tab
  useEffect(() => {
    if (tab !== 'location') return;
    const fetchPrediction = async () => {
      try {
        const { data } = await api.get('/fingerprint/predict?seconds=10');
        setRoomPrediction(data);
        setRoomPredictionError(null);
      } catch (err: any) {
        const msg = err.response?.data?.error;
        if (msg?.includes('No fingerprint') || msg?.includes('No live')) {
          setRoomPrediction(null);
        }
        setRoomPredictionError(null);
      }
    };
    const fetchStatus = async () => {
      try {
        const { data } = await api.get('/fingerprint/student-status');
        setStudentStatus(data);
      } catch { /* silent */ }
    };
    const fetchEvents = async () => {
      try {
        const { data } = await api.get('/fingerprint/room-events?limit=10');
        setRoomEvents(data);
      } catch { /* silent */ }
    };
    fetchPrediction(); fetchStatus(); fetchEvents();
    const interval = setInterval(() => {
      fetchPrediction(); fetchStatus(); fetchEvents();
    }, 5000);
    return () => clearInterval(interval);
  }, [tab]);

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

  // Search state for students/users tab
  const [userSearch, setUserSearch] = useState('');
  useEffect(() => { setUserSearch(''); }, [tab]); // clear on tab change

  const filteredUsers = useMemo(() => {
    const base = tab === 'students'
      ? users.filter(u => u.role === 'student')
      : users;
    if (!userSearch.trim()) return base;
    const q = userSearch.trim().toLowerCase();
    return base.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.name     || '').toLowerCase().includes(q) ||
      (u.lrn      || '').toLowerCase().includes(q) ||
      (u.section  || '').toLowerCase().includes(q) ||
      (u.role     || '').toLowerCase().includes(q)
    );
  }, [users, tab, userSearch]);

  const STATUS_COLOR: Record<string, any> = {
    'Time-In': 'success', 'Time-Out': 'info', Late: 'warning', Absent: 'error', Excused: 'default',
  };

  const sidebarContent = (
    <>
      <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <Typography variant="h6" fontWeight={800}>ATTENDBOX</Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>Administrator</Typography>
      </Box>
      <Box sx={{ flex: 1, py: 1 }}>
        {NAV.map(n => (
          <Box key={n.id}
            onClick={() => { setTab(n.id as Tab); setMobileOpen(false); }}
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
    </>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: '#2563eb', overflow: 'hidden' }}>

      {/* ── Mobile: Temporary Drawer (CSS hidden on desktop) ── */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: 240,
            background: '#3b82f6',
            color: '#fff',
            boxSizing: 'border-box',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* ── Desktop: Permanent Sidebar (CSS hidden on mobile) ── */}
      <Box sx={{
        width: sideOpen ? 240 : 0,
        transition: 'width .25s',
        overflow: 'hidden',
        background: '#3b82f6',
        color: '#fff',
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {sidebarContent}
      </Box>

      {/* ── Main Content Area ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <Box sx={{
          bgcolor: '#fff',
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
          borderBottom: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', gap: 1.5,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          position: 'sticky', top: 0, zIndex: 1100,
        }}>
          {/* Mobile: opens drawer; Desktop: toggles sidebar width */}
          <IconButton
            onClick={() => setMobileOpen(o => !o)}
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
          >
            <Menu />
          </IconButton>
          <IconButton
            onClick={() => setSideOpen(o => !o)}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            <Menu />
          </IconButton>
          <Typography variant="h6" fontWeight={700} flex={1} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            {NAV.find(n => n.id === tab)?.label}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            📅 {format(new Date(), 'MMMM d, yyyy')}
          </Typography>
          <NotificationBell iconColor={theme.colors.neutral[700]} />
        </Box>

        {/* Content Area */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto', 
          p: { xs: 2, sm: 3 },
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

              {/* ── Attendance Alerts ── */}
              {alertCount > 0 && (
                <Paper elevation={2} sx={{ borderRadius: 2, mb: 3, border: '2px solid #e65100', overflow: 'hidden' }}>
                  <Box sx={{
                    p: 2, bgcolor: '#fff3e0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography sx={{ fontSize: '1.5rem' }}>⚠️</Typography>
                      <Box>
                        <Typography fontWeight={700} color="#e65100">
                          {alertCount} Student{alertCount > 1 ? 's' : ''} At Risk — Low Attendance This Month
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Attendance rate below 80% threshold
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      size="small" variant="outlined"
                      onClick={loadAlerts}
                      sx={{ borderColor: '#e65100', color: '#e65100', textTransform: 'none' }}
                    >
                      Refresh
                    </Button>
                  </Box>
                  <TableContainer sx={{ maxHeight: 260 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {['Student', 'LRN', 'Grade/Section', 'Rate', 'Notified', ''].map(h => (
                            <TableCell key={h} sx={{ bgcolor: '#fff8f0', fontWeight: 700, color: '#e65100' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {alerts.map(a => (
                          <TableRow key={a.id} hover sx={{ bgcolor: '#fffdf0' }}>
                            <TableCell sx={{ fontWeight: 700 }}>{a.student_name}</TableCell>
                            <TableCell>{a.lrn}</TableCell>
                            <TableCell>{a.grade} — {a.section}</TableCell>
                            <TableCell>
                              <Chip
                                label={`${a.attendance_rate}%`}
                                size="small"
                                sx={{
                                  bgcolor: a.attendance_rate < 60 ? '#ffebee' : '#fff3e0',
                                  color:   a.attendance_rate < 60 ? '#c62828' : '#e65100',
                                  fontWeight: 700,
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Box display="flex" gap={0.5} flexWrap="wrap">
                                {a.notified_teacher && <Chip label="Teacher" size="small" color="info" sx={{ fontSize: '0.65rem', height: 18 }} />}
                                {a.notified_parent  && <Chip label="Parent"  size="small" color="success" sx={{ fontSize: '0.65rem', height: 18 }} />}
                                {a.notified_admin   && <Chip label="Admin"   size="small" color="warning" sx={{ fontSize: '0.65rem', height: 18 }} />}
                              </Box>
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Dismiss this alert">
                                <IconButton
                                  size="small"
                                  onClick={async () => {
                                    try {
                                      await api.patch(`/alerts/${a.id}/dismiss`);
                                      setAlerts(prev => prev.filter(x => x.id !== a.id));
                                      setAlertCount(prev => Math.max(0, prev - 1));
                                    } catch { /* silent */ }
                                  }}
                                  sx={{ color: '#999', '&:hover': { color: '#c62828', bgcolor: '#ffebee' } }}
                                >
                                  <Close fontSize="small" />
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

          {/* ── Assignments Tab ── */}
          {tab === 'assignments' && (
            <AssignmentsPage />
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
              {/* Search bar */}
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eee', bgcolor: '#fafafa' }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder={tab === 'students' ? 'Search by name, LRN, username, section…' : 'Search by username or role…'}
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: '#aaa', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: userSearch ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setUserSearch('')}>
                          <Close sx={{ fontSize: 16 }} />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                  sx={{ bgcolor: '#fff', borderRadius: 1 }}
                />
                {userSearch && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {filteredUsers.length} result{filteredUsers.length !== 1 ? 's' : ''} found
                  </Typography>
                )}
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      {tab === 'students' && <TableCell>Full Name</TableCell>}
                      <TableCell>Role</TableCell>
                      {tab === 'students' && <TableCell>Preferred Method</TableCell>}
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.length === 0 && (
                      <TableRow><TableCell colSpan={tab === 'students' ? 7 : 5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No users found</TableCell></TableRow>
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
                        {/* Full Name — students tab only */}
                        {tab === 'students' && (
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: u.name ? 500 : 400, color: u.name ? '#1a1a1a' : '#999', fontStyle: u.name ? 'normal' : 'italic' }}>
                              {u.name || '—'}
                            </Typography>
                          </TableCell>
                        )}
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
                            <>
                              <Tooltip title="Edit Student Info (SF2 fields)">
                                <IconButton size="small" color="primary"
                                  onClick={() => {
                                    setEditUser(u);
                                    setEditOpen(true);
                                  }}>
                                  <Edit />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Download QR Code">
                                <IconButton size="small" color="primary" onClick={() => handleDownloadQR(u)}>
                                  <Download />
                                </IconButton>
                              </Tooltip>
                            </>
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

          {/* ── Location Tracking Tab ── */}
          {tab === 'location' && (
            <Box>
              {/* Header */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    🎯 Real-Time Location Tracking
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    BLE Trilateration: GPS-like accuracy using multiple ESP32 anchor boards
                  </Typography>
                </Box>
              </Box>

              {/* BLE Positioning Map */}
              <Paper elevation={2} sx={{ overflow: 'hidden', borderRadius: 2, border: '1px solid #e0e0e0', height: 'calc(100vh - 200px)', bgcolor: 'transparent' }}>
                <BLEPositioningMap
                  trilaterationServerUrl={import.meta.env.VITE_TRILATERATION_SERVER_URL || 'http://localhost:8080'}
                  showDiagnostics={true}
                />
              </Paper>

              {/* Fingerprint Room Prediction Panel */}
              {roomPrediction && (
                <Paper elevation={2} sx={{ mt: 2, p: 2.5, borderRadius: 2, border: '2px solid #4f46e5', bgcolor: '#eef2ff' }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                    <Typography sx={{ fontSize: '1.3rem' }}>📍</Typography>
                    <Box>
                      <Typography fontWeight={700} color="#4338ca" fontSize="0.95rem">
                        Fingerprint Room Prediction
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Based on current BLE anchor RSSI readings — updates every 5 seconds
                      </Typography>
                    </Box>
                  </Box>
                  <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                    <Chip
                      label={roomPrediction.predicted_location}
                      sx={{
                        bgcolor: '#4f46e5', color: '#fff', fontWeight: 700,
                        fontSize: '1rem', px: 1, height: 36,
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Confidence distance: <strong>{roomPrediction.confidence_distance}</strong> dBm units
                      {roomPrediction.confidence_distance < 15 && (
                        <Chip label="High confidence" size="small" color="success" sx={{ ml: 1, fontSize: '0.65rem', height: 18 }} />
                      )}
                      {roomPrediction.confidence_distance >= 15 && roomPrediction.confidence_distance < 30 && (
                        <Chip label="Medium confidence" size="small" color="warning" sx={{ ml: 1, fontSize: '0.65rem', height: 18 }} />
                      )}
                      {roomPrediction.confidence_distance >= 30 && (
                        <Chip label="Low confidence" size="small" color="error" sx={{ ml: 1, fontSize: '0.65rem', height: 18 }} />
                      )}
                    </Typography>
                  </Box>
                  <Box mt={1.5} display="flex" gap={1} flexWrap="wrap">
                    {roomPrediction.live_anchors.map((a: any) => (
                      <Chip
                        key={a.anchor_id}
                        label={`${a.anchor_id}: ${Math.round(a.rssi)} dBm`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', color: '#4338ca', borderColor: '#a5b4fc' }}
                      />
                    ))}
                  </Box>
                </Paper>
              )}

              {/* No fingerprint data notice */}
              {!roomPrediction && tab === 'location' && (
                <Paper elevation={1} sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    🔍 No fingerprint prediction available.{' '}
                    <strong>Calibrate the system</strong> using the Attendbox Mobile app (admin login)
                    to enable room-level detection.
                  </Typography>
                </Paper>
              )}

              {/* ── Room Status Panel ── */}
              {Object.keys(studentStatus).length > 0 && (
                <Paper elevation={2} sx={{ mt: 2, borderRadius: 2, overflow: 'hidden', border: '2px solid #0891b2' }}>
                  <Box sx={{ p: 2, bgcolor: '#ecfeff', borderBottom: '1px solid #a5f3fc',
                    display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: '1.1rem' }}>🚪</Typography>
                    <Box>
                      <Typography fontWeight={700} color="#0e7490" fontSize="0.95rem">
                        Student Room Status
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Inside / Outside detection — updates every 5 seconds
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(studentStatus).map(([sid, s]) => (
                      <Box key={sid} sx={{
                        display: 'flex', alignItems: 'center', gap: 1,
                        px: 1.5, py: 1, borderRadius: 2,
                        bgcolor: s.status === 'inside' ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${s.status === 'inside' ? '#86efac' : '#fca5a5'}`,
                        minWidth: 180,
                      }}>
                        <Box sx={{
                          width: 10, height: 10, borderRadius: '50%',
                          bgcolor: s.status === 'inside' ? '#22c55e' : '#ef4444',
                          flexShrink: 0,
                        }} />
                        <Box>
                          <Typography fontSize="0.82rem" fontWeight={700} color="#1e293b">
                            {/* student name not in status — show id for now */}
                            Student {sid}
                          </Typography>
                          <Typography fontSize="0.72rem" color="text.secondary">
                            {s.status === 'inside'
                              ? `Inside ${s.room_name} · ${s.last_distance.toFixed(1)}m`
                              : `Outside ${s.room_name}`}
                          </Typography>
                        </Box>
                        <Chip
                          label={s.status === 'inside' ? 'Inside' : 'Outside'}
                          size="small"
                          color={s.status === 'inside' ? 'success' : 'error'}
                          sx={{ ml: 'auto', fontSize: '0.65rem', height: 18 }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}

              {/* ── Room Events Feed ── */}
              {roomEvents.length > 0 && (
                <Paper elevation={2} sx={{ mt: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <Typography fontWeight={700} fontSize="0.9rem">📋 Recent Enter/Exit Events</Typography>
                    <Typography variant="caption" color="text.secondary">Last 10 events</Typography>
                  </Box>
                  <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
                    {roomEvents.map((ev: any, i: number) => (
                      <Box key={ev.id || i} sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        px: 2, py: 1, borderBottom: '1px solid #f1f5f9',
                        bgcolor: i % 2 === 0 ? '#fff' : '#fafafa',
                      }}>
                        <Typography sx={{ fontSize: '1rem' }}>
                          {ev.event_type === 'enter' ? '🚶' : '🚪'}
                        </Typography>
                        <Box flex={1}>
                          <Typography fontSize="0.82rem" fontWeight={600}>{ev.student_name}</Typography>
                          <Typography fontSize="0.72rem" color="text.secondary">
                            {ev.event_type === 'enter' ? 'Entered' : 'Exited'} {ev.room_name}
                            {ev.distance_m != null ? ` · ${ev.distance_m.toFixed(1)}m` : ''}
                          </Typography>
                        </Box>
                        <Chip
                          label={ev.event_type === 'enter' ? 'Enter' : 'Exit'}
                          size="small"
                          color={ev.event_type === 'enter' ? 'success' : 'default'}
                          sx={{ fontSize: '0.65rem', height: 18 }}
                        />
                        <Typography fontSize="0.7rem" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {ev.occurred_at
                            ? format(new Date(ev.occurred_at), 'hh:mm a')
                            : '—'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}

              {/* Info Box */}
              <Paper elevation={1} sx={{ mt: 2, p: 2, bgcolor: theme.colors.primary[50], borderRadius: 2 }}>
                <Typography variant="body2" color={theme.colors.neutral[700]} sx={{ fontFamily: theme.typography.fontFamily.primary }}>
                  <strong>📡 BLE Trilateration Technology:</strong> This map uses advanced positioning with multiple ESP32 anchor boards 
                  to calculate student locations with GPS-like accuracy (typically 1-3 meters). The system features:
                </Typography>
                <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                  <Typography component="li" variant="caption" color={theme.colors.neutral[600]}>
                    Weighted multilateration using all active anchors (not just 3)
                  </Typography>
                  <Typography component="li" variant="caption" color={theme.colors.neutral[600]}>
                    Kalman filtering for smooth tracking and velocity estimation
                  </Typography>
                  <Typography component="li" variant="caption" color={theme.colors.neutral[600]}>
                    Zone-based snapping for improved indoor accuracy
                  </Typography>
                  <Typography component="li" variant="caption" color={theme.colors.neutral[600]}>
                    Real-time updates every second via WebSocket connection
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}

          {/* ── Announcements Tab ── */}
          {tab === 'announcements' && (
            <Box>
              <Grid container spacing={3}>
                {/* Compose Form */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ p: 2.5, background: theme.colors.primary.gradient, color: '#fff' }}>
                      <Typography sx={{ fontFamily: theme.typography.fontFamily.display, fontWeight: 700, fontSize: 18 }}>
                        📢 New Announcement
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>
                        Notify teachers, parents, and students
                      </Typography>
                    </Box>
                    <Box sx={{ p: 2.5 }}>
                      {annForm.error   && <Alert severity="error"   sx={{ mb: 2 }}>{annForm.error}</Alert>}
                      {annForm.success && <Alert severity="success" sx={{ mb: 2 }}>{annForm.success}</Alert>}

                      <TextField
                        label="Title *" fullWidth
                        value={annForm.title}
                        onChange={e => setAnnForm(f => ({ ...f, title: e.target.value, success: '' }))}
                        placeholder="E.g., School holiday on Friday"
                        sx={{ mb: 2 }}
                      />
                      <TextField
                        label="Message *" fullWidth multiline rows={5}
                        value={annForm.body}
                        onChange={e => setAnnForm(f => ({ ...f, body: e.target.value, success: '' }))}
                        placeholder="Write the full announcement here..."
                        sx={{ mb: 2.5 }}
                      />

                      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: '#333' }}>
                        Send to:
                      </Typography>
                      <FormGroup row sx={{ mb: 2 }}>
                        <FormControlLabel
                          control={<Switch checked={annForm.targetTeachers} onChange={e => setAnnForm(f => ({ ...f, targetTeachers: e.target.checked }))} color="primary" />}
                          label="Teachers"
                        />
                        <FormControlLabel
                          control={<Switch checked={annForm.targetParents} onChange={e => setAnnForm(f => ({ ...f, targetParents: e.target.checked }))} color="primary" />}
                          label="Parents"
                        />
                        <FormControlLabel
                          control={<Switch checked={annForm.targetStudents} onChange={e => setAnnForm(f => ({ ...f, targetStudents: e.target.checked }))} color="primary" />}
                          label="Students"
                        />
                      </FormGroup>

                      <FormControlLabel
                        control={
                          <Switch checked={annForm.sendSms} onChange={e => setAnnForm(f => ({ ...f, sendSms: e.target.checked }))} color="warning" />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={700}>Also send SMS to Parents</Typography>
                            <Typography variant="caption" color="text.secondary">Only when Parents is checked</Typography>
                          </Box>
                        }
                        sx={{ mb: 2.5, alignItems: 'flex-start', mt: 0.5 }}
                      />

                      <Button
                        fullWidth variant="contained" size="large"
                        disabled={
                          annForm.loading ||
                          !annForm.title.trim() || !annForm.body.trim() ||
                          (!annForm.targetTeachers && !annForm.targetParents && !annForm.targetStudents)
                        }
                        onClick={async () => {
                          const roles: string[] = [];
                          if (annForm.targetTeachers) roles.push('teacher');
                          if (annForm.targetParents)  roles.push('parent');
                          if (annForm.targetStudents) roles.push('student');
                          setAnnForm(f => ({ ...f, loading: true, error: '', success: '' }));
                          try {
                            const { data } = await api.post('/announcements', {
                              title: annForm.title.trim(), body: annForm.body.trim(),
                              target_roles: roles, send_sms: annForm.sendSms,
                            });
                            setAnnForm(f => ({ ...f, loading: false, title: '', body: '', success: `✅ ${data.message}` }));
                            loadAnnouncements();
                          } catch (err: any) {
                            setAnnForm(f => ({ ...f, loading: false, error: err.response?.data?.error || 'Failed to publish' }));
                          }
                        }}
                        sx={{ ...theme.components.button.primary, '&:hover': theme.components.button.primary.hover, py: 1.5 }}
                      >
                        {annForm.loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : '📢 Publish Announcement'}
                      </Button>
                    </Box>
                  </Paper>
                </Grid>

                {/* Past Announcements */}
                <Grid size={{ xs: 12, md: 7 }}>
                  <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{
                      p: 2.5, bgcolor: '#f8faff', borderBottom: '1px solid #e0e0e0',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Past Announcements</Typography>
                      <Button size="small" onClick={loadAnnouncements} sx={{ textTransform: 'none' }}>Refresh</Button>
                    </Box>
                    {announcements.length === 0 ? (
                      <Box textAlign="center" py={6}>
                        <Typography sx={{ fontSize: '3rem', mb: 1 }}>📭</Typography>
                        <Typography color="#888">No announcements yet</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ maxHeight: 600, overflowY: 'auto' }}>
                        {announcements.map((a, i) => (
                          <Box key={a.id} sx={{
                            p: 2.5,
                            borderBottom: i < announcements.length - 1 ? '1px solid #f0f0f0' : 'none',
                            '&:hover': { bgcolor: '#f9fafc' },
                          }}>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
                              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{a.title}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', ml: 1 }}>
                                {a.created_at ? format(new Date(a.created_at), 'MMM d, yyyy') : '—'}
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{
                              mb: 1, overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            }}>
                              {a.body}
                            </Typography>
                            <Box display="flex" gap={0.5} flexWrap="wrap">
                              {(a.target_roles || []).map((role: string) => (
                                <Chip key={role} label={role} size="small" sx={{
                                  fontSize: '0.65rem', height: 18,
                                  bgcolor: role === 'teacher' ? '#e3f2fd' : role === 'parent' ? '#e8f5e9' : '#fce4ec',
                                  color:   role === 'teacher' ? '#1565c0' : role === 'parent' ? '#2e7d32' : '#c62828',
                                }} />
                              ))}
                              {a.send_sms && (
                                <Chip label="SMS" size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#fff3e0', color: '#e65100' }} />
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* ── School Settings Tab ── */}
          {tab === 'school-settings' && (
            <SchoolSettingsPanel />
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

      {/* Edit Student Dialog */}
      <EditStudentDialog
        open={editOpen}
        user={editUser}
        onClose={() => { setEditOpen(false); setEditUser(null); }}
        onSaved={() => {
          showSnack('Student updated successfully');
          loadUsers();
          setEditOpen(false);
          setEditUser(null);
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
