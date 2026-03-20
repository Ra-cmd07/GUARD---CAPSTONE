import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, Paper, TextField, Button, Typography, Alert,
  CircularProgress, Grid, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import api from '../api/client';

const GENDERS = ['Male', 'Female'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', username: '', password: '', age: '',
    gender: '', section: '', contact: '', address: '',
  });
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      await api.post('/auth/register', { ...form, age: parseInt(form.age) || undefined });
      setFeedback({ type: 'success', text: '✅ Registered! Redirecting to login…' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Registration failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2d5016 0%, #3d6b1f 60%, #1a2e0d 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      <Box sx={{ px: 5, py: 2, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <Typography variant="h6" color="white" fontWeight={800}>
          🌿 ChildTrack — Teacher Registration
        </Typography>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Paper elevation={10} sx={{ p: 5, width: '100%', maxWidth: 700, borderRadius: 3 }}>
          <Typography variant="h5" color="primary" fontWeight={800} textAlign="center" gutterBottom>
            Create Your Account
          </Typography>

          {feedback && <Alert severity={feedback.type} sx={{ mb: 2 }}>{feedback.text}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField label="Full Name" fullWidth required
                  value={form.name} onChange={e => set('name', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Username" fullWidth required
                  value={form.username} onChange={e => set('username', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Password" type="password" fullWidth required
                  value={form.password} onChange={e => set('password', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Age" type="number" fullWidth required
                  inputProps={{ min: 18, max: 100 }}
                  value={form.age} onChange={e => set('age', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Gender</InputLabel>
                  <Select value={form.gender} label="Gender"
                    onChange={e => set('gender', e.target.value)}>
                    {GENDERS.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField label="Section / Grade Handling" fullWidth required
                  placeholder="e.g. Grade 6-A"
                  value={form.section} onChange={e => set('section', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Contact Number" fullWidth required
                  value={form.contact} onChange={e => set('contact', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Address" fullWidth required
                  value={form.address} onChange={e => set('address', e.target.value)} />
              </Grid>
            </Grid>

            <Button type="submit" variant="contained" color="primary"
              fullWidth size="large" disabled={loading}
              sx={{ mt: 3, py: 1.5, fontWeight: 700 }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Register'}
            </Button>

            <Typography variant="body2" textAlign="center" sx={{ mt: 2, color: 'text.secondary' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#2d5016', fontWeight: 700 }}>Login</Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}