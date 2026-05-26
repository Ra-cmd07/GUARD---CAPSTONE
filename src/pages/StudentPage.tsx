import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button, Grid,
  MenuItem, Select, FormControl, InputLabel,
  Alert, Snackbar, CircularProgress, Divider, Chip,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import api from '../api/client';
import QRGeneratorModal from '../components/students/QRGeneratorModal';
import type { GuardianForm as TeacherForm, StudentForm } from '../types/index.tsx';

const DEFAULT_TEACHERS: TeacherForm[] = [
  { role: 'Parent 1', name: '', contact_number: '' },
  { role: 'Parent 2', name: '', contact_number: '' },
  { role: 'Teacher', name: '', contact_number: '' },
];

export default function StudentsPage() {
  const navigate = useNavigate();

  const [student,    setStudent]    = useState<StudentForm>({ lrn: '', name: '', gender: '' });
  const [teachers,   setTeachers]   = useState<TeacherForm[]>(DEFAULT_TEACHERS);
  const [loading,    setLoading]    = useState(false);
  const [qrOpen,     setQrOpen]     = useState(false);
  const [registered, setRegistered] = useState<{ student: StudentForm; teachers: TeacherForm[] } | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success'|'error' }>
                              ({ open: false, msg: '', sev: 'success' });

  const updateTeacher = (idx: number, field: keyof TeacherForm, val: string) =>
    setTeachers(g => g.map((item, i) => i === idx ? { ...item, [field]: val } : item));

  const handleRegister = async () => {
    if (!student.lrn || !student.name || !student.gender) {
      setSnack({ open: true, msg: 'LRN, Name, and Gender are required', sev: 'error' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/students', { ...student, parents_guardians: teachers });
      setRegistered({ student, teachers });
      setQrOpen(true);
      setSnack({ open: true, msg: `✅ ${student.name} registered successfully!`, sev: 'success' });
    } catch (err: any) {
      setSnack({ open: true, msg: err.response?.data?.error || 'Registration failed', sev: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', background: '#f5f5f5', p: 3 }}>
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/dashboard')} variant="outlined">
            Back
          </Button>
          <Typography variant="h5" fontWeight={800} color="primary">
            Student QR Code Registration
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Student Info */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" color="primary" fontWeight={700} gutterBottom>
                📚 Student Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TextField label="LRN (Learner Reference Number)" fullWidth margin="normal"
                value={student.lrn} onChange={e => setStudent(s => ({ ...s, lrn: e.target.value }))} required />
              <TextField label="Full Name" fullWidth margin="normal"
                value={student.name} onChange={e => setStudent(s => ({ ...s, name: e.target.value }))} required />
              <FormControl fullWidth margin="normal" required>
                <InputLabel>Gender</InputLabel>
                <Select value={student.gender} label="Gender"
                  onChange={e => setStudent(s => ({ ...s, gender: e.target.value }))}>
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                </Select>
              </FormControl>
            </Paper>
          </Grid>

          {/* Teachers */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" color="primary" fontWeight={700} gutterBottom>
                👨‍👩‍👧 Parent & Teacher Info
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {teachers.map((g, idx) => (
                <Box key={idx} mb={2}>
                  <Chip label={g.role} color="primary" size="small" sx={{ mb: 1 }} />
                  <TextField label={`${g.role} Name`} fullWidth margin="dense"
                    value={g.name} onChange={e => updateTeacher(idx, 'name', e.target.value)} />
                  <TextField label="Contact Number" fullWidth margin="dense"
                    value={g.contact_number}
                    onChange={e => updateTeacher(idx, 'contact_number', e.target.value)} />
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* Action Buttons */}
          <Grid size={{ xs: 12 }}>
            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Button variant="contained" color="primary" fullWidth size="large"
                    onClick={handleRegister} disabled={loading} sx={{ py: 1.5, fontWeight: 700 }}>
                    {loading
                      ? <CircularProgress size={24} color="inherit" />
                      : '🪪 Register & Generate QR Codes'}
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Button variant="outlined" color="primary" fullWidth size="large"
                    disabled={!registered} onClick={() => setQrOpen(true)}
                    sx={{ py: 1.5, fontWeight: 700 }}>
                    📤 View / Download QR Codes
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* QR Generator Modal */}
      {registered && (
        <QRGeneratorModal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          student={registered.student}
          teachers={registered.teachers}
        />
      )}

      <Snackbar open={snack.open} autoHideDuration={4000}
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