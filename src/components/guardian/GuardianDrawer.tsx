import { useState } from 'react';
import {
  Drawer, Box, Typography, TextField, Button, IconButton,
  FormControl, InputLabel, Select, MenuItem, Alert, CircularProgress,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import api from '../../api/client';

interface Props { open: boolean; onClose: () => void; }

export default function GuardianDrawer({ open, onClose }: Props) {
  const [form, setForm] = useState({
    name: '', role: 'Parent 1', contact_number: '', student_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [alert,   setAlert]   = useState<{ type: 'success'|'error'; text: string } | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.student_name) {
      setAlert({ type: 'error', text: 'Guardian name and student name are required' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/guardians', form);
      setAlert({ type: 'success', text: `✅ ${form.name} registered as guardian successfully!` });
      setForm({ name: '', role: 'Parent 1', contact_number: '', student_name: '' });
    } catch (err: any) {
      setAlert({ type: 'error', text: err.response?.data?.error || 'Failed to register' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100vw', sm: 420 } } }}>
      {/* Header */}
      <Box sx={{
        background: '#3b82f6', color: '#fff', p: 2.5,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Typography variant="h6" fontWeight={700}>👥 Register Guardian</Typography>
        <IconButton onClick={onClose} sx={{ color: '#fff' }}><Close /></IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
        {alert && <Alert severity={alert.type} sx={{ mb: 2 }}>{alert.text}</Alert>}

        <TextField label="Guardian / Parent Name *" fullWidth margin="normal"
          value={form.name} onChange={e => set('name', e.target.value)} />

        <FormControl fullWidth margin="normal">
          <InputLabel>Role</InputLabel>
          <Select value={form.role} label="Role" onChange={e => set('role', e.target.value)}>
            {['Parent 1','Parent 2','Teacher','Grandparent','Sibling','Guardian','Other'].map(r => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField label="Contact Number" fullWidth margin="normal"
          value={form.contact_number} onChange={e => set('contact_number', e.target.value)} />

        <TextField label="Student Name *" fullWidth margin="normal"
          placeholder="Full name of the student"
          value={form.student_name} onChange={e => set('student_name', e.target.value)} />
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2.5, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 2 }}>
        <Button variant="outlined" onClick={onClose} fullWidth>Cancel</Button>
        <Button variant="contained" color="primary" fullWidth
          onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={22} color="inherit" /> : '✅ Save Guardian'}
        </Button>
      </Box>
    </Drawer>
  );
}
