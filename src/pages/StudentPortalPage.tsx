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

  const STATUS_COLOR: Record<string, any> = {
    'Time-In': 'success', 'Time-Out': 'info', Late: 'warning', Absent: 'error',
  };

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
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#f5f7fa' }}>
      {/* Sidebar */}
      <Box sx={{
        width: 220, bgcolor: '#0b4d79', color: '#fff',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <Typography variant="h6" fontWeight={800}>ATTENDBOX</Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>Student Portal</Typography>
        </Box>
        <Box sx={{ p: 2, flex: 1 }}>
          <Box textAlign="center" mb={2}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(255,255,255,0.2)', mx: 'auto', mb: 1, fontSize: 28 }}>
              {profile?.name?.charAt(0) || '?'}
            </Avatar>
            <Typography fontWeight={700}>{profile?.name || user?.username}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {profile?.grade} — {profile?.section}
            </Typography>
            <br />
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              LRN: {profile?.lrn}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <Button fullWidth variant="contained" startIcon={<Logout />} onClick={handleLogout}
            sx={{ bgcolor: '#dc3545', '&:hover': { bgcolor: '#b02a37' } }}>
            Logout
          </Button>
        </Box>
      </Box>

      {/* Main */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Grid container spacing={3}>
          {/* QR Code Panel */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>📱 My QR Code</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Present this QR code at the kiosk for attendance
              </Typography>
              <Box ref={qrRef} sx={{ display: 'inline-block', p: 1.5, border: '2px solid #0b4d79', borderRadius: 2, mb: 2 }}>
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
              <Button variant="outlined" startIcon={<Download />} onClick={downloadQR} size="small">
                Download QR
              </Button>
            </Paper>

            {/* Stats Summary */}
            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2, mt: 2.5 }}>
              <Typography fontWeight={700} gutterBottom>📊 Attendance Summary (30 days)</Typography>
              {[
                { label: 'Present', count: stats.present, color: '#2e7d32' },
                { label: 'Late',    count: stats.late,    color: '#e65100' },
                { label: 'Absent',  count: stats.absent,  color: '#c62828' },
              ].map(s => (
                <Box key={s.label} display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                  <Chip label={s.count} size="small" sx={{ bgcolor: s.color, color: '#fff', fontWeight: 700 }} />
                </Box>
              ))}
              <Box mt={1.5}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2" fontWeight={700}>Attendance Rate</Typography>
                  <Typography variant="body2" fontWeight={700} color={rate >= 80 ? '#2e7d32' : '#c62828'}>
                    {rate}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate" value={rate}
                  sx={{
                    height: 8, borderRadius: 4,
                    bgcolor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: rate >= 80 ? '#2e7d32' : rate >= 60 ? '#e65100' : '#c62828',
                    },
                  }}
                />
              </Box>
            </Paper>
          </Grid>

          {/* Attendance Records */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper elevation={2} sx={{ borderRadius: 2 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontWeight={700}>Recent Attendance Records</Typography>
                <Chip label="Last 30 days" size="small" variant="outlined" />
              </Box>
              <TableContainer sx={{ maxHeight: 520 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Time In</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading && (
                      <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
                    )}
                    {!loading && records.length === 0 && (
                      <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: 'text.secondary' }}>No attendance records found</TableCell></TableRow>
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

                      return (
                      <TableRow key={r.id} hover>
                        <TableCell>{dateStr}</TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>{timeStr}</TableCell>
                        <TableCell>
                          <Chip label={r.scan_method || 'QR'} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip label={r.status} size="small" color={STATUS_COLOR[r.status] || 'default'} sx={{ fontWeight: 700 }} />
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
