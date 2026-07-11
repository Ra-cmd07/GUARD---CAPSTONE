import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, School } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import type { UserRole } from '../types';
import theme from '../theme/professionalTheme';

const ROLE_REDIRECT: Record<UserRole, string> = {
  admin:   '/admin',
  teacher: '/teacher',
  parent:  '/parent',
  student: '/student-portal',
};

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
      // data.user contains { id, username, role, profileId, profile }
      login(data.token, data.user);
      // Auto-redirect based on role
      const dest = ROLE_REDIRECT[data.user.role as UserRole] || '/dashboard';
      navigate(dest, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: theme.colors.primary.gradient,
      display:   'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <Box sx={{ 
        px: 4, 
        py: 2, 
        borderBottom: '1px solid rgba(255,255,255,0.15)', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5 
      }}>
        <School sx={{ color: theme.colors.secondary.main, fontSize: 32 }} />
        <Box>
          <Typography 
            variant="h6" 
            color="white" 
            sx={{
              fontFamily: theme.typography.fontFamily.display,
              fontWeight: theme.typography.fontWeight.extrabold,
              lineHeight: 1.1,
            }}
          >
            ATTENDBOX
          </Typography>
          <Typography 
            variant="caption" 
            sx={{
              color: 'rgba(255,255,255,0.8)',
              fontFamily: theme.typography.fontFamily.primary,
            }}
          >
            Unified Student Attendance Tracking System
          </Typography>
        </Box>
      </Box>

      {/* Login Card */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Paper 
          sx={{ 
            p: 5, 
            width: '100%', 
            maxWidth: 420, 
            borderRadius: theme.borderRadius.card,
            boxShadow: theme.shadows.elevation4,
            border: `1px solid ${theme.colors.neutral[200]}`,
          }}
        >

          <Box textAlign="center" mb={3}>
            <Typography 
              variant="h5" 
              sx={{
                color: theme.colors.primary.main,
                fontFamily: theme.typography.fontFamily.display,
                fontWeight: theme.typography.fontWeight.bold,
              }}
              gutterBottom
            >
              Welcome Back
            </Typography>
            <Typography 
              variant="body2" 
              sx={{
                color: theme.colors.neutral[600],
                fontFamily: theme.typography.fontFamily.primary,
              }}
            >
              Sign in to your account — your role is detected automatically
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Username" 
              fullWidth 
              margin="normal" 
              required 
              autoFocus
              value={username} 
              onChange={e => setUsername(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: theme.borderRadius.input,
                  fontFamily: theme.typography.fontFamily.primary,
                }
              }}
            />
            <TextField
              label="Password" 
              fullWidth 
              margin="normal" 
              required
              type={showPw ? 'text' : 'password'}
              value={password} 
              onChange={e => setPassword(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: theme.borderRadius.input,
                  fontFamily: theme.typography.fontFamily.primary,
                }
              }}
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

            <Button
              type="submit" 
              variant="contained"
              fullWidth 
              size="large" 
              disabled={loading}
              sx={{
                ...theme.components.button.primary,
                mt: 3, 
                py: 1.5,
                '&:hover': theme.components.button.primary.hover,
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>

          {/* Role hints */}
          <Box sx={{ 
            mt: 3, 
            p: 2, 
            bgcolor: theme.colors.neutral[50], 
            borderRadius: theme.borderRadius.base,
            border: `1px solid ${theme.colors.neutral[200]}`,
          }}>
            <Typography 
              variant="caption" 
              sx={{
                color: theme.colors.neutral[700],
                fontFamily: theme.typography.fontFamily.primary,
                fontWeight: theme.typography.fontWeight.semibold,
              }}
              display="block" 
              mb={0.5}
            >
              Access is granted based on your role:
            </Typography>
            {[
              { role: 'Admin', desc: 'Full system management' },
              { role: 'Teacher', desc: 'Class attendance management' },
              { role: 'Parent', desc: 'View child attendance' },
              { role: 'Student', desc: 'View personal records' },
            ].map(r => (
              <Typography 
                key={r.role} 
                variant="caption" 
                sx={{
                  color: theme.colors.neutral[600],
                  fontFamily: theme.typography.fontFamily.primary,
                }}
                display="block"
              >
                • <b>{r.role}</b> — {r.desc}
              </Typography>
            ))}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
