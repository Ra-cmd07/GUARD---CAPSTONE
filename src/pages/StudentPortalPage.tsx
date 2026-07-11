import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Chip, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, CircularProgress, Snackbar, Alert, LinearProgress,
} from '@mui/material';
import { QRCodeCanvas } from 'qrcode.react';
import { Logout, Download } from '@mui/icons-material';
import { format, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import type { AttendanceRecord, StudentProfile } from '../types';
import theme from '../theme/professionalTheme';

export default function StudentPortalPage() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const profile          = user?.profile as StudentProfile | null;
  const qrRef            = useRef<HTMLDivElement>(null);

  const [records,  setRecords]  = useState<AttendanceRecord[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [snack,    setSnack]    = useState({ open: false, msg: '', sev: 'info' as any });

  const showSnack = (msg: string, sev: any = 'info') => setSnack({ open: true, msg, sev });

  const fetchRecords = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const from = format(subDays(new Date(), 29), 'yyyy-MM-dd');
      const to   = format(new Date(), 'yyyy-MM-dd');
      const { data } = await api.get(`/students/${profile.id}/attendance?from=${from}&to=${to}`);
      setRecords(data);
    } catch {
      showSnack('Failed to load records', 'error');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Auto-refresh every 10 seconds to show new attendance without manual reload
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecords();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [fetchRecords]);

  const stats = {
    present: records.filter(r => r.status === 'Time-In' || r.status === 'Late').length,
    late:    records.filter(r => r.status === 'Late').length,
    absent:  records.filter(r => r.status === 'Absent').length,
    total:   records.length,
  };
  const rate = stats.total > 0
    ? Math.round((stats.present / (stats.present + stats.absent)) * 100)
    : 0;

  // QR payload for this student
  const qrPayload = profile ? JSON.stringify({
    lrn:     profile.lrn,
    student: profile.name,
    gender:  profile.gender,
  }) : '';

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const link    = document.createElement('a');
    link.download = `QR_${profile?.name?.replace(/\s+/g, '_')}.png`;
    link.href     = canvas.toDataURL();
    link.click();
  };

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: '#2563eb' }}>
      {/* Sidebar with Solid Blue Gradient */}
      <Box sx={{
        width: 240, 
        background: '#3b82f6',
        color: '#fff',
        display: 'flex', 
        flexDirection: 'column', 
        flexShrink: 0,
        boxShadow: theme.shadows.elevation3,
      }}>
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <Typography 
            variant="h5" 
            sx={{
              fontFamily: theme.typography.fontFamily.display,
              fontWeight: theme.typography.fontWeight.extrabold,
              letterSpacing: '0.5px',
            }}
          >
            ATTENDBOX
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              opacity: 0.85,
              fontFamily: theme.typography.fontFamily.primary,
              fontWeight: theme.typography.fontWeight.medium,
            }}
          >
            Student Portal
          </Typography>
        </Box>
        <Box sx={{ p: 2.5, flex: 1 }}>
          <Box textAlign="center" mb={3}>
            <Avatar sx={{ 
              width: 72, 
              height: 72, 
              bgcolor: 'rgba(255,255,255,0.25)', 
              mx: 'auto', 
              mb: 1.5, 
              fontSize: 32,
              fontWeight: theme.typography.fontWeight.bold,
              border: '3px solid rgba(255,255,255,0.3)',
            }}>
              {profile?.name?.charAt(0) || '?'}
            </Avatar>
            <Typography 
              sx={{
                fontFamily: theme.typography.fontFamily.primary,
                fontWeight: theme.typography.fontWeight.bold,
                fontSize: theme.typography.fontSize.base,
              }}
            >
              {profile?.name || user?.username}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                opacity: 0.85,
                display: 'block',
                mt: 0.5,
                fontWeight: theme.typography.fontWeight.medium,
              }}
            >
              {profile?.grade} — {profile?.section}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                opacity: 0.75,
                display: 'block',
                mt: 0.5,
              }}
            >
              LRN: {profile?.lrn}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ p: 2.5, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <Button 
            fullWidth 
            variant="contained" 
            startIcon={<Logout />} 
            onClick={handleLogout}
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontWeight: theme.typography.fontWeight.semibold,
              '&:hover': { 
                bgcolor: 'rgba(255,255,255,0.25)',
                transform: 'translateY(-2px)',
              },
              transition: theme.transitions.button,
            }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 4 }}>
        <Grid container spacing={3}>
          {/* QR Code Panel */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ 
              ...theme.components.card.default,
              p: 3, 
              textAlign: 'center',
              '&:hover': {
                boxShadow: theme.shadows.elevation3,
              },
            }}>
              <Typography 
                variant="h6" 
                sx={{
                  fontFamily: theme.typography.fontFamily.display,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.primary.dark,
                  mb: 1,
                }}
              >
                📱 My QR Code
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                mb={2.5}
                sx={{ fontFamily: theme.typography.fontFamily.primary }}
              >
                Present this QR code at the kiosk for attendance
              </Typography>
              <Box 
                ref={qrRef} 
                sx={{ 
                  display: 'inline-block', 
                  p: 2, 
                  border: `3px solid ${theme.colors.primary.main}`, 
                  borderRadius: theme.borderRadius.md, 
                  mb: 2.5,
                  background: '#fff',
                  boxShadow: theme.shadows.md,
                }}
              >
                {qrPayload && (
                  <QRCodeCanvas
                    value={qrPayload}
                    size={180}
                    level="H"
                    includeMargin
                  />
                )}
              </Box>
              <br />
              <Button 
                variant="contained" 
                startIcon={<Download />} 
                onClick={downloadQR}
                sx={{
                  background: theme.colors.primary.gradient,
                  color: '#fff',
                  fontWeight: theme.typography.fontWeight.semibold,
                  px: 3,
                  py: 1,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows.hoverLift,
                  },
                  transition: theme.transitions.button,
                }}
              >
                Download QR
              </Button>
            </Paper>

            {/* Stats Summary */}
            <Paper sx={{ 
              ...theme.components.card.default,
              p: 3, 
              mt: 3,
              '&:hover': {
                boxShadow: theme.shadows.elevation3,
              },
            }}>
              <Typography 
                sx={{
                  fontFamily: theme.typography.fontFamily.display,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.primary.dark,
                  mb: 2,
                }}
              >
                📊 Attendance Summary (30 days)
              </Typography>
              {[
                { label: 'Present', count: stats.present, color: theme.colors.status.success.main },
                { label: 'Late',    count: stats.late,    color: theme.colors.status.warning.main },
                { label: 'Absent',  count: stats.absent,  color: theme.colors.status.error.main },
              ].map(s => (
                <Box key={s.label} display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                  <Typography 
                    variant="body2" 
                    sx={{
                      fontFamily: theme.typography.fontFamily.primary,
                      fontWeight: theme.typography.fontWeight.medium,
                      color: theme.colors.neutral[600],
                    }}
                  >
                    {s.label}
                  </Typography>
                  <Chip 
                    label={s.count} 
                    size="small" 
                    sx={{ 
                      bgcolor: s.color, 
                      color: '#fff', 
                      fontWeight: theme.typography.fontWeight.bold,
                      minWidth: 42,
                    }} 
                  />
                </Box>
              ))}
              <Box mt={2.5}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography 
                    variant="body2" 
                    sx={{
                      fontFamily: theme.typography.fontFamily.primary,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: theme.colors.neutral[700],
                    }}
                  >
                    Attendance Rate
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{
                      fontFamily: theme.typography.fontFamily.display,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: rate >= 80 ? theme.colors.status.success.main : theme.colors.status.error.main,
                    }}
                  >
                    {rate}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate" 
                  value={rate}
                  sx={{
                    height: 10, 
                    borderRadius: theme.borderRadius.full,
                    bgcolor: theme.colors.neutral[200],
                    '& .MuiLinearProgress-bar': {
                      bgcolor: rate >= 80 
                        ? theme.colors.status.success.main 
                        : rate >= 60 
                        ? theme.colors.status.warning.main 
                        : theme.colors.status.error.main,
                      borderRadius: theme.borderRadius.full,
                    },
                  }}
                />
              </Box>
            </Paper>
          </Grid>

          {/* Attendance Records */}
          <Grid size={{ xs: 12, md: 8 }}>
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
                  }}
                >
                  Recent Attendance Records
                </Typography>
                <Chip 
                  label="Last 30 days" 
                  size="small" 
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontWeight: theme.typography.fontWeight.semibold,
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}
                />
              </Box>
              <TableContainer sx={{ maxHeight: 520 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{
                        bgcolor: theme.colors.neutral[100],
                        fontFamily: theme.typography.fontFamily.primary,
                        fontWeight: theme.typography.fontWeight.bold,
                        color: theme.colors.neutral[700],
                        borderBottom: `2px solid ${theme.colors.primary.main}`,
                      }}>
                        Date
                      </TableCell>
                      <TableCell sx={{
                        bgcolor: theme.colors.neutral[100],
                        fontFamily: theme.typography.fontFamily.primary,
                        fontWeight: theme.typography.fontWeight.bold,
                        color: theme.colors.neutral[700],
                        borderBottom: `2px solid ${theme.colors.primary.main}`,
                      }}>
                        Time In
                      </TableCell>
                      <TableCell sx={{
                        bgcolor: theme.colors.neutral[100],
                        fontFamily: theme.typography.fontFamily.primary,
                        fontWeight: theme.typography.fontWeight.bold,
                        color: theme.colors.neutral[700],
                        borderBottom: `2px solid ${theme.colors.primary.main}`,
                      }}>
                        Method
                      </TableCell>
                      <TableCell sx={{
                        bgcolor: theme.colors.neutral[100],
                        fontFamily: theme.typography.fontFamily.primary,
                        fontWeight: theme.typography.fontWeight.bold,
                        color: theme.colors.neutral[700],
                        borderBottom: `2px solid ${theme.colors.primary.main}`,
                      }}>
                        Status
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                          <CircularProgress size={32} sx={{ color: theme.colors.primary.main }} />
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && records.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ 
                          py: 6, 
                          color: theme.colors.neutral[500],
                          fontFamily: theme.typography.fontFamily.primary,
                        }}>
                          No attendance records found
                        </TableCell>
                      </TableRow>
                    )}
                    {records.map(r => {
                      // Safe date formatting with error handling
                      let dateStr = '—';
                      try {
                        if (r.date) {
                          dateStr = format(new Date(r.date + 'T00:00:00'), 'EEE, MMM d yyyy');
                        }
                      } catch {
                        dateStr = r.date || '—';
                      }

                      let timeStr = '—';
                      try {
                        if (r.time_in) {
                          timeStr = r.time_in;
                        } else if (r.timestamp) {
                          timeStr = format(new Date(r.timestamp), 'hh:mm a');
                        }
                      } catch {
                        timeStr = r.time_in || '—';
                      }

                      // Get status badge style
                      const getStatusBadge = (status: string) => {
                        const statusKey = status === 'Time-In' ? 'success' 
                                        : status === 'Late' ? 'warning'
                                        : status === 'Time-Out' ? 'info'
                                        : 'error';
                        return theme.components.badge[statusKey] || {};
                      };

                      return (
                      <TableRow key={r.id} hover sx={{
                        '&:hover': {
                          bgcolor: theme.colors.neutral[50],
                        },
                      }}>
                        <TableCell sx={{ 
                          fontFamily: theme.typography.fontFamily.primary,
                          color: theme.colors.neutral[700],
                        }}>
                          {dateStr}
                        </TableCell>
                        <TableCell sx={{ 
                          fontFamily: theme.typography.fontFamily.mono,
                          fontSize: theme.typography.fontSize.sm,
                          color: theme.colors.neutral[600],
                        }}>
                          {timeStr}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={r.scan_method || 'QR'} 
                            size="small" 
                            sx={{
                              bgcolor: theme.colors.primary[100],
                              color: theme.colors.primary.dark,
                              fontWeight: theme.typography.fontWeight.semibold,
                              fontSize: theme.typography.fontSize.xs,
                              border: `1px solid ${theme.colors.primary[200]}`,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={r.status} 
                            size="small" 
                            sx={{
                              ...getStatusBadge(r.status),
                            }}
                          />
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>

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
