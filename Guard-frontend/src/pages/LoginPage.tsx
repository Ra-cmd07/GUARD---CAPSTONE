import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, Paper, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { username, password });
      login(data.token, data.teacher);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2d5016 0%, #3d6b1f 60%, #1a2e0d 100%)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top bar */}
      <Box sx={{ px: 5, py: 2, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <Typography variant="h6" color="white" fontWeight={800}>
          🌿 ChildTrack — Attendance System
        </Typography>
      </Box>

      {/* Card */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Paper elevation={10} sx={{ p: 5, width: '100%', maxWidth: 420, borderRadius: 3 }}>
          <Typography variant="h5" color="primary" fontWeight={800} textAlign="center" gutterBottom>
            Teacher Login
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
            Sign in to manage attendance
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Username" fullWidth margin="normal" required autoFocus
              value={username} onChange={e => setUsername(e.target.value)}
            />
            <TextField
              label="Password" fullWidth margin="normal" required
              type={showPw ? 'text' : 'password'}
              value={password} onChange={e => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPw(p => !p)} edge="end">
                      {showPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button type="submit" variant="contained" color="primary"
              fullWidth size="large" disabled={loading}
              sx={{ mt: 3, py: 1.5, fontSize: '1rem', fontWeight: 700 }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
            </Button>

            <Typography variant="body2" textAlign="center" sx={{ mt: 3, color: 'text.secondary' }}>
              No account?{' '}
              <Link to="/register" style={{ color: '#2d5016', fontWeight: 700 }}>
                Register here
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}