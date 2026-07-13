import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Chip, Avatar, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, CircularProgress, Snackbar, Alert, Divider, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Logout, School, CheckCircle, Cancel, Dashboard as DashboardIcon,
  CalendarToday, LocationOn, Sms as SmsIcon, PhotoCamera, Delete,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import type { AttendanceRecord, ParentProfile, Student } from '../types';
import BLEPositioningMap from '../components/BLEPositioningMap';
import AttendancePhotoDialog from '../components/AttendancePhotoDialog';
import theme from '../theme/professionalTheme';

type Tab = 'overview' | 'attendance' | 'location' | 'sms';

export default function ParentDashboardPage() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const profile          = user?.profile as ParentProfile | null;

  const [tab,        setTab]        = useState<Tab>('overview');
  const [children,   setChildren]   = useState<Student[]>([]);
  const [selected,   setSelected]   = useState<Student | null>(null);
  const [records,    setRecords]    = useState<AttendanceRecord[]>([]);
  const [smsLogs,    setSmsLogs]    = useState<any[]>([]);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [snack,      setSnack]      = useState({ open: false, msg: '', sev: 'info' as any });
  
  // Photo viewer state
  const [photoDialog, setPhotoDialog] = useState({
    open: false,
    photoUrl: null as string | null,
    studentName: '',
    status: '',
    timestamp: undefined as Date | string | undefined,
    method: '',
  });

  const showSnack = (msg: string, sev: any = 'info') => setSnack({ open: true, msg, sev });

  const handleViewPhoto = (record: AttendanceRecord) => {
    console.log('🖼️ Parent viewing photo for:', record.student_name);
    console.log('📸 Photo path:', record.photo_path);
    console.log('📋 Full record:', record);
    
    setPhotoDialog({
      open: true,
      photoUrl: record.photo_path || null,
      studentName: record.student_name,
      status: record.status,
      timestamp: record.timestamp || record.date,
      method: record.scan_method || 'N/A',
    });
  };

  // Load children
  useEffect(() => {
    api.get('/students')
      .then(r => {
        const kids = r.data as Student[];
        setChildren(kids);
        if (kids.length > 0) setSelected(kids[0]);
      })
      .catch(() => showSnack('Failed to load children', 'error'));
  }, []);

  // Load attendance for selected child (today + next 6 days)
  const fetchRecords = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const from = format(new Date(), 'yyyy-MM-dd'); // Today
      const to   = format(new Date(new Date().setDate(new Date().getDate() + 6)), 'yyyy-MM-dd'); // +6 days
      const { data } = await api.get(`/students/${selected.id}/attendance?from=${from}&to=${to}`);
      console.log('📊 Fetched attendance records for parent:', data);
      console.log(`📸 Records with photos: ${(data || []).filter((r: any) => r.photo_path).length} of ${(data || []).length}`);
      setRecords(data || []);
    } catch (err) {
      console.error('Failed to load attendance:', err);
      showSnack('Failed to load attendance', 'error');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Auto-refresh every 10 seconds to show new attendance without manual reload
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRecords();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [fetchRecords]);

  // Load recent SMS logs for overview
  useEffect(() => {
    if (selected) {
      api.get(`/students/${selected.id}/sms-logs`)
        .then(r => {
          const recent = (r.data || []).slice(0, 5); // Get 5 most recent
          setSmsLogs(recent);
        })
        .catch(() => setSmsLogs([]));
    }
  }, [selected]);

  // Load SMS logs from database
  useEffect(() => {
    if (tab === 'sms' && selected) {
      api.get(`/students/${selected.id}/sms-logs`)
        .then(r => setSmsLogs(r.data || []))
        .catch(() => {
          console.error('Failed to load SMS logs');
          setSmsLogs([]);
        });
    }
  }, [tab, selected]);

  // Load location history for location tab
  useEffect(() => {
    if (tab === 'location' && selected) {
      // Get location history (last 24 hours)
      api.get(`/location/student/${selected.id}?history=true`)
        .then(r => setLocationHistory(r.data || []))
        .catch(() => setLocationHistory([]));
    }
  }, [tab, selected]);

  const STATUS_COLOR: Record<string, any> = {
    'Time-In': 'success', 'Time-Out': 'info', Late: 'warning', Absent: 'error',
  };

  // Campus status: is Time-In today without Time-Out?
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayRecords = records.filter(r => r.date === today);
  const hasTimeIn  = todayRecords.some(r => r.status === 'Time-In' || r.status === 'Late');
  const hasTimeOut = todayRecords.some(r => r.status === 'Time-Out');
  const onCampus   = hasTimeIn && !hasTimeOut;

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  // Weekly table: next 7 days starting from today
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(new Date(new Date().setDate(new Date().getDate() + i)), 'yyyy-MM-dd')
  );

  const NAV = [
    { id: 'overview',    label: 'Overview',       icon: <DashboardIcon /> },
    { id: 'attendance',  label: 'Attendance log', icon: <CalendarToday /> },
    { id: 'location',    label: 'Location',       icon: <LocationOn /> },
    { id: 'sms',         label: 'SMS history',    icon: <SmsIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: '#2563eb' }}>
      {/* Sidebar */}
      <Box sx={{
        width: 240, 
        background: '#3b82f6',
        color: '#fff',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        boxShadow: theme.shadows.elevation3,
      }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <School sx={{ color: theme.colors.secondary.main }} />
            <Typography 
              variant="h6" 
              sx={{
                fontFamily: theme.typography.fontFamily.display,
                fontWeight: theme.typography.fontWeight.extrabold,
                color: '#fff',
              }}
            >
              AttendBox
            </Typography>
          </Box>
          <Typography 
            variant="caption" 
            sx={{ 
              opacity: 0.9, 
              color: '#fff',
              fontFamily: theme.typography.fontFamily.primary,
            }}
          >
            Parent Portal
          </Typography>
        </Box>

        <Box sx={{ flex: 1, py: 2 }}>
          <Box sx={{ px: 2, mb: 2 }}>
            <Typography 
              variant="caption" 
              sx={{ 
                opacity: 0.7, 
                textTransform: 'uppercase', 
                fontSize: 10, 
                color: '#fff',
                fontFamily: theme.typography.fontFamily.primary,
                fontWeight: theme.typography.fontWeight.semibold,
              }}
            >
              Logged in as
            </Typography>
            <Typography 
              sx={{
                fontWeight: theme.typography.fontWeight.bold,
                fontSize: '0.9rem',
                color: '#fff',
                fontFamily: theme.typography.fontFamily.primary,
              }}
            >
              {profile?.name || user?.username}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                opacity: 0.8, 
                color: '#fff',
                fontFamily: theme.typography.fontFamily.primary,
              }}
            >
              {user?.username}
            </Typography>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 1 }} />

          {NAV.map(n => (
            <Box
              key={n.id}
              onClick={() => setTab(n.id as Tab)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 2.5, py: 1.5, cursor: 'pointer', mx: 1, 
                borderRadius: theme.borderRadius.base,
                bgcolor: tab === n.id ? 'rgba(255,255,255,0.2)' : 'transparent',
                borderLeft: tab === n.id ? '3px solid #fff' : '3px solid transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                transition: theme.transitions.button,
                color: '#fff',
              }}>
              <Box sx={{ color: '#fff' }}>{n.icon}</Box>
              <Typography 
                variant="body2" 
                sx={{
                  fontWeight: tab === n.id ? theme.typography.fontWeight.bold : theme.typography.fontWeight.normal,
                  color: '#fff',
                  fontFamily: theme.typography.fontFamily.primary,
                }}
              >
                {n.label}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <Button 
            fullWidth 
            variant="contained" 
            startIcon={<Logout />} 
            onClick={handleLogout}
            sx={{ 
              ...theme.components.button.secondary,
              bgcolor: theme.colors.status.error.main,
              color: '#fff',
              '&:hover': { bgcolor: theme.colors.status.error.dark },
            }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Top Bar */}
        <Box sx={{
          bgcolor: '#fff', px: 3, py: 2,
          borderBottom: `1px solid ${theme.colors.neutral[200]}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: theme.shadows.elevation1,
        }}>
          <Typography 
            variant="h6" 
            sx={{
              fontFamily: theme.typography.fontFamily.display,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.neutral[900],
            }}
          >
            {selected ? `My child's attendance` : 'Parent Dashboard'}
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              opacity: 0.7, 
              color: theme.colors.neutral[600],
              fontFamily: theme.typography.fontFamily.primary,
            }}
          >
            👤 {user?.username}
          </Typography>
        </Box>

        <Box sx={{ p: 3 }}>
          {selected ? (
            <>
              {/* Child Selector - Show if parent has multiple children */}
              {children.length > 1 && (
                <Paper sx={{
                  ...theme.components.card.default,
                  p: 2, mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}>
                  <School sx={{ color: theme.colors.primary.main, fontSize: 28 }} />
                  <Box flex={1}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: theme.colors.neutral[600],
                        fontFamily: theme.typography.fontFamily.primary,
                        mb: 0.5,
                      }}
                    >
                      Select Child ({children.length} children)
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {children.map((child) => (
                        <Button
                          key={child.id}
                          variant={selected.id === child.id ? 'contained' : 'outlined'}
                          onClick={() => setSelected(child)}
                          sx={{
                            textTransform: 'none',
                            fontFamily: theme.typography.fontFamily.primary,
                            fontWeight: selected.id === child.id ? theme.typography.fontWeight.bold : theme.typography.fontWeight.normal,
                          }}
                        >
                          {child.name}
                        </Button>
                      ))}
                    </Box>
                  </Box>
                </Paper>
              )}

              {/* Overview Tab */}
              {tab === 'overview' && (
                <>
                  {/* Child Profile Card */}
                  <Paper sx={{
                    ...theme.components.card.default,
                    p: 3, mb: 3,
                    '&:hover': theme.components.card.default.hover,
                  }}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar sx={{
                        width: 64, height: 64,
                        bgcolor: theme.colors.primary.main, 
                        fontSize: 28, 
                        fontWeight: theme.typography.fontWeight.extrabold,
                        fontFamily: theme.typography.fontFamily.display,
                      }}>
                        {selected.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </Avatar>
                      <Box flex={1}>
                        <Typography 
                          variant="h5" 
                          sx={{
                            fontFamily: theme.typography.fontFamily.display,
                            fontWeight: theme.typography.fontWeight.extrabold,
                            color: theme.colors.neutral[900],
                          }}
                          gutterBottom
                        >
                          {selected.name}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: theme.colors.neutral[600],
                            fontFamily: theme.typography.fontFamily.primary,
                          }}
                        >
                          {selected.grade} — Section {selected.section} · Iponan National High School
                        </Typography>
                      </Box>
                      <Chip
                        icon={onCampus ? <CheckCircle /> : <Cancel />}
                        label={onCampus ? 'On campus' : 'Off campus'}
                        sx={{
                          ...theme.components.badge[onCampus ? 'success' : 'error'],
                          fontSize: '0.95rem', 
                          px: 2, 
                          py: 2.5,
                        }}
                      />
                    </Box>
                  </Paper>

                  {/* Weekly Attendance Table */}
                  <Paper sx={{
                    ...theme.components.card.default,
                    overflow: 'hidden',
                    mb: 3,
                  }}>
                    <Box sx={{ 
                      p: 2.5, 
                      borderBottom: `1px solid ${theme.colors.neutral[200]}`,
                    }}>
                      <Typography 
                        sx={{
                          fontFamily: theme.typography.fontFamily.primary,
                          fontWeight: theme.typography.fontWeight.bold,
                          color: theme.colors.neutral[900],
                        }}
                      >
                        Attendance this week
                      </Typography>
                    </Box>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ 
                            background: theme.colors.primary.gradient,
                          }}>
                            <TableCell sx={{ 
                              color: '#fff', 
                              fontFamily: theme.typography.fontFamily.primary,
                              fontWeight: theme.typography.fontWeight.bold,
                            }}>
                              Date
                            </TableCell>
                            <TableCell sx={{ 
                              color: '#fff', 
                              fontFamily: theme.typography.fontFamily.primary,
                              fontWeight: theme.typography.fontWeight.bold,
                            }}>
                              Time in
                            </TableCell>
                            <TableCell sx={{ 
                              color: '#fff', 
                              fontFamily: theme.typography.fontFamily.primary,
                              fontWeight: theme.typography.fontWeight.bold,
                            }}>
                              Time out
                            </TableCell>
                            <TableCell sx={{ 
                              color: '#fff', 
                              fontFamily: theme.typography.fontFamily.primary,
                              fontWeight: theme.typography.fontWeight.bold,
                            }}>
                              Status
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                                <CircularProgress size={24} sx={{ color: theme.colors.primary.main }} />
                              </TableCell>
                            </TableRow>
                          ) : weekDays.map(d => {
                            // Normalize dates for comparison (handle ISO format from database)
                            const normalizeDate = (date: any) => {
                              if (!date) return '';
                              const dateStr = typeof date === 'string' ? date : date.toString();
                              return dateStr.split('T')[0]; // Extract just YYYY-MM-DD part
                            };
                            const rec = records.find(r => normalizeDate(r.date) === d && (r.status === 'Time-In' || r.status === 'Late'));
                            const tout = records.find(r => normalizeDate(r.date) === d && r.status === 'Time-Out');
                            const isToday = d === today;
                            return (
                              <TableRow 
                                key={d} 
                                sx={{ 
                                  bgcolor: isToday ? theme.colors.primary[50] : '#fff', 
                                  '&:hover': { bgcolor: theme.colors.neutral[50] },
                                }}
                              >
                                <TableCell sx={{ 
                                  color: theme.colors.neutral[900], 
                                  fontFamily: theme.typography.fontFamily.primary,
                                  fontWeight: isToday ? theme.typography.fontWeight.bold : theme.typography.fontWeight.normal,
                                }}>
                                  {format(new Date(d + 'T00:00:00'), 'MMM d, yyyy')}
                                  {isToday && (
                                    <Chip 
                                      label="Today" 
                                      size="small" 
                                      sx={{ 
                                        ml: 1, 
                                        ...theme.components.badge.info,
                                      }} 
                                    />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Typography
                                      sx={{
                                        color: theme.colors.neutral[600],
                                        fontFamily: theme.typography.fontFamily.primary,
                                        fontSize: '0.9rem',
                                      }}
                                    >
                                      {rec?.time_in || (rec?.timestamp ? format(new Date(rec.timestamp), 'h:mm aa') : '—')}
                                    </Typography>
                                    {rec?.photo_path && (
                                      <IconButton
                                        size="small"
                                        onClick={() => handleViewPhoto(rec)}
                                        sx={{
                                          color: theme.colors.primary.main,
                                          '&:hover': {
                                            bgcolor: theme.colors.primary[50],
                                          },
                                          p: 0.5,
                                        }}
                                      >
                                        <PhotoCamera fontSize="small" />
                                      </IconButton>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Typography
                                      sx={{
                                        color: theme.colors.neutral[600],
                                        fontFamily: theme.typography.fontFamily.primary,
                                        fontSize: '0.9rem',
                                      }}
                                    >
                                      {tout?.time_out || (tout?.timestamp ? format(new Date(tout.timestamp), 'h:mm aa') : '—')}
                                    </Typography>
                                    {tout?.photo_path && (
                                      <IconButton
                                        size="small"
                                        onClick={() => handleViewPhoto(tout)}
                                        sx={{
                                          color: theme.colors.secondary.main,
                                          '&:hover': {
                                            bgcolor: theme.colors.secondary[50],
                                          },
                                          p: 0.5,
                                        }}
                                      >
                                        <PhotoCamera fontSize="small" />
                                      </IconButton>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  {rec ? (
                                    <Chip
                                      label={rec.status}
                                      size="small"
                                      sx={{
                                        ...theme.components.badge[
                                          rec.status === 'Time-In' ? 'success' :
                                          rec.status === 'Late' ? 'warning' : 'error'
                                        ]
                                      }}
                                    />
                                  ) : (
                                    <Chip 
                                      label="Absent" 
                                      size="small" 
                                      sx={{ ...theme.components.badge.error }} 
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>

                  {/* Recent SMS Notifications */}
                  <Paper elevation={2} sx={{ borderRadius: 2, bgcolor: '#fff', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
                    <Box sx={{ 
                      p: 2.5, 
                      background: theme.colors.primary.gradient,
                      color: '#fff',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1 
                    }}>
                      <SmsIcon />
                      <Typography 
                        fontWeight={theme.typography.fontWeight.bold}
                        sx={{ fontFamily: theme.typography.fontFamily.display }}
                      >
                        Recent SMS notifications
                      </Typography>
                    </Box>
                    <List sx={{ p: 0 }}>
                      {smsLogs.length === 0 ? (
                        <ListItem sx={{ py: 4, textAlign: 'center', justifyContent: 'center' }}>
                          <Typography color="#999" fontSize="0.9rem">No SMS notifications yet</Typography>
                        </ListItem>
                      ) : (
                        smsLogs.map((log: any, i: number) => (
                          <ListItem 
                            key={i}
                            sx={{ 
                              borderBottom: i < smsLogs.length - 1 ? '1px solid #e0e0e0' : 'none',
                              py: 2 
                            }}
                          >
                            <ListItemIcon>
                              <SmsIcon sx={{ color: log.status === 'sent' ? '#2e7d32' : '#999' }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={log.message}
                              secondary={`${log.parent_name} • ${log.phone_number} • ${format(new Date(log.created_at), 'MMM d, h:mm aa')}`}
                            />
                          </ListItem>
                        ))
                      )}
                    </List>
                  </Paper>
                </>
              )}

              {/* Attendance Log Tab */}
              {tab === 'attendance' && (
                <Paper elevation={2} sx={{ borderRadius: 2, bgcolor: '#fff', border: '1px solid #e0e0e0' }}>
                  <Box sx={{ 
                    p: 2.5, 
                    background: theme.colors.primary.gradient,
                    color: '#fff',
                  }}>
                    <Typography 
                      fontWeight={theme.typography.fontWeight.bold}
                      sx={{ fontFamily: theme.typography.fontFamily.display }}
                    >
                      Full Attendance History
                    </Typography>
                  </Box>
                  <TableContainer sx={{ maxHeight: 500 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: '#3b82f6', color: '#fff', fontWeight: 700 }}>Date</TableCell>
                          <TableCell sx={{ bgcolor: '#3b82f6', color: '#fff', fontWeight: 700 }}>Status</TableCell>
                          <TableCell sx={{ bgcolor: '#3b82f6', color: '#fff', fontWeight: 700 }}>Time</TableCell>
                          <TableCell sx={{ bgcolor: '#3b82f6', color: '#fff', fontWeight: 700 }}>Method</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {loading && (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                              <CircularProgress size={24} sx={{ color: '#3b82f6' }} />
                            </TableCell>
                          </TableRow>
                        )}
                        {!loading && records.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 4, color: '#666' }}>
                              No attendance records found
                            </TableCell>
                          </TableRow>
                        )}
                        {!loading && records.map((r) => {
                          try {
                            const dateStr = r.date ? format(new Date(r.date + 'T00:00:00'), 'MMM d, yyyy') : '—';
                            const timeStr = r.time_in || (r.timestamp ? format(new Date(r.timestamp), 'hh:mm a') : '—');
                            return (
                              <TableRow key={r.id} hover sx={{ '&:hover': { bgcolor: '#f5f7fa' } }}>
                                <TableCell sx={{ color: '#1a1a1a' }}>{dateStr}</TableCell>
                                <TableCell>
                                  <Chip 
                                    label={r.status || 'Unknown'} 
                                    size="small" 
                                    color={STATUS_COLOR[r.status] || 'default'} 
                                  />
                                </TableCell>
                                <TableCell sx={{ color: '#666', fontSize: '0.85rem' }}>
                                  {timeStr}
                                </TableCell>
                                <TableCell>
                                  <Chip 
                                    label={r.scan_method || 'QR'} 
                                    size="small" 
                                    variant="outlined" 
                                    sx={{ color: '#666', borderColor: '#e0e0e0' }} 
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          } catch (err) {
                            console.error('Error rendering record:', r, err);
                            return null;
                          }
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {/* Location Tab */}
              {tab === 'location' && (
                <>
                  {/* Header */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="h6" fontWeight={700} color="#1a1a1a">
                        🎯 Real-Time Location Tracking
                      </Typography>
                      <Typography variant="caption" color="#666" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
                        BLE Location Tracking: Student location is detected via Bluetooth (BLE) beacons with trilateration technology for precise positioning
                      </Typography>
                    </Box>
                  </Box>

                  {/* BLE Trilateration Map */}
                  <Paper elevation={2} sx={{ mb: 3, overflow: 'hidden', borderRadius: 2, border: '1px solid #e0e0e0', height: '70vh', minHeight: 500 }}>
                    <BLEPositioningMap
                      trilaterationServerUrl={import.meta.env.VITE_TRILATERATION_SERVER_URL || 'http://localhost:8080'}
                      studentName={selected?.name}
                      showDiagnostics={false}
                    />
                  </Paper>

                  {/* Location History */}
                  {(() => {
                    // Only show location history if student is currently on campus
                    const today = format(new Date(), 'yyyy-MM-dd');
                    const todayAttendance = records.find(r => r.date === today);
                    const isOnCampus = todayAttendance && 
                      (todayAttendance.status === 'Time-In' || todayAttendance.status === 'Late') &&
                      !todayAttendance.time_out;
                    
                    // Filter: Only show history if student is on campus
                    return isOnCampus && locationHistory.length > 0;
                  })() && (
                    <Paper elevation={2} sx={{ borderRadius: 2, bgcolor: '#fff', border: '1px solid #e0e0e0', mb: 3 }}>
                      <Box sx={{ 
                        p: 2.5, 
                        background: theme.colors.primary.gradient,
                        color: '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <Typography 
                          fontWeight={theme.typography.fontWeight.bold}
                          sx={{ fontFamily: theme.typography.fontFamily.display }}
                        >
                          Location History (Last 24 Hours)
                        </Typography>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<Delete />}
                          sx={{
                            textTransform: 'none',
                            fontFamily: theme.typography.fontFamily.primary
                          }}
                          onClick={() => {
                            if (window.confirm(`⚠️ Clear location history for ${selected?.name}?\n\nThis will delete ${locationHistory.length} location records.\nThis action cannot be undone.\n\nNew location data will be tracked when your child's device is detected near a campus beacon.`)) {
                              api.delete(`/location/student/${selected?.id}/clear`)
                                .then(() => {
                                  setLocationHistory([]);
                                  showSnack('Location history cleared successfully', 'success');
                                })
                                .catch(() => showSnack('Failed to clear location history', 'error'));
                            }
                          }}
                          disabled={locationHistory.length === 0}
                        >
                          Clear History ({locationHistory.length})
                        </Button>
                      </Box>
                      <TableContainer sx={{ maxHeight: 400 }}>
                        <Table stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ bgcolor: '#3b82f6', color: '#fff', fontWeight: 700 }}>Time</TableCell>
                              <TableCell sx={{ bgcolor: '#3b82f6', color: '#fff', fontWeight: 700 }}>Location</TableCell>
                              <TableCell sx={{ bgcolor: '#3b82f6', color: '#fff', fontWeight: 700 }}>Building</TableCell>
                              <TableCell sx={{ bgcolor: '#3b82f6', color: '#fff', fontWeight: 700 }}>Distance</TableCell>
                              <TableCell sx={{ bgcolor: '#3b82f6', color: '#fff', fontWeight: 700 }}>Type</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {locationHistory.map((loc, idx) => (
                              <TableRow key={idx} hover sx={{ '&:hover': { bgcolor: '#f5f7fa' } }}>
                                <TableCell sx={{ color: '#1a1a1a' }}>
                                  {format(new Date(loc.timestamp), 'h:mm a')}
                                </TableCell>
                                <TableCell sx={{ color: '#1a1a1a', fontWeight: 600 }}>
                                  {loc.location_name}
                                </TableCell>
                                <TableCell sx={{ color: '#666' }}>
                                  {loc.building || '—'}
                                </TableCell>
                                <TableCell sx={{ color: '#1a1a1a', fontWeight: 600 }}>
                                  {loc.distance ? `${Number(loc.distance).toFixed(2)}m` : '—'}
                                </TableCell>
                                <TableCell>
                                  <Chip 
                                    label={loc.location_type || 'other'} 
                                    size="small" 
                                    sx={{ 
                                      bgcolor: loc.location_type === 'gate' ? '#e3f2fd' : '#f5f5f5',
                                      color: loc.location_type === 'gate' ? '#3b82f6' : '#666',
                                      textTransform: 'capitalize'
                                    }} 
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  )}

                  {/* Info Box */}
                  <Paper elevation={1} sx={{ p: 2, bgcolor: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 2 }}>
                    <Typography variant="body2" color="#3b82f6">
                      <strong>📡 BLE Location Tracking:</strong> Student location is detected via Bluetooth Low Energy (BLE) beacons placed throughout campus. Location updates occur when the student's device is near a beacon. The map shows real-time position based on the last detected beacon.
                    </Typography>
                  </Paper>
                </>
              )}

              {/* SMS History Tab */}
              {tab === 'sms' && (
                <Paper elevation={2} sx={{ borderRadius: 2, bgcolor: '#fff', border: '1px solid #e0e0e0' }}>
                  <Box sx={{ 
                    p: 2.5, 
                    background: theme.colors.primary.gradient,
                    color: '#fff',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                  }}>
                    <Typography 
                      fontWeight={theme.typography.fontWeight.bold}
                      sx={{ fontFamily: theme.typography.fontFamily.display }}
                    >
                      SMS Notification History
                    </Typography>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<Delete />}
                      sx={{
                        textTransform: 'none',
                        fontFamily: theme.typography.fontFamily.primary
                      }}
                      onClick={() => {
                        if (window.confirm(`⚠️ Clear SMS history for ${selected?.name}?\n\nThis will delete ${smsLogs.length} SMS notifications.\nThis action cannot be undone.\n\nNew SMS notifications will be created when your child scans at school.`)) {
                          api.delete(`/students/${selected?.id}/sms-logs/clear`)
                            .then(() => {
                              setSmsLogs([]);
                              showSnack('SMS history cleared successfully', 'success');
                            })
                            .catch(() => showSnack('Failed to clear SMS history', 'error'));
                        }
                      }}
                      disabled={smsLogs.length === 0}
                    >
                      Clear History ({smsLogs.length})
                    </Button>
                  </Box>
                  <List>
                    {smsLogs.length === 0 ? (
                      <ListItem sx={{ py: 4, justifyContent: 'center' }}>
                        <Typography color="#999" fontSize="0.9rem">No SMS history available</Typography>
                      </ListItem>
                    ) : (
                      smsLogs.map((log, i) => (
                        <ListItem key={i} sx={{ borderBottom: i < smsLogs.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
                          <ListItemIcon><SmsIcon sx={{ color: '#3b82f6' }} /></ListItemIcon>
                          <ListItemText
                            primary={log.message}
                            secondary={`${log.date} at ${log.time}`}
                            primaryTypographyProps={{ color: '#1a1a1a' }}
                            secondaryTypographyProps={{ color: '#666' }}
                          />
                        </ListItem>
                      ))
                    )}
                  </List>
                </Paper>
              )}
            </>
          ) : (
            <Box textAlign="center" py={8}>
              <School sx={{ fontSize: 72, color: '#bbb', mb: 2 }} />
              <Typography color="#666" fontSize="1.1rem" fontWeight={600}>No children linked to your account.</Typography>
              <Typography variant="body2" sx={{ color: '#999', mt: 1 }}>Contact your school administrator.</Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Snackbar open={snack.open} autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled"
          onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>

      {/* Photo Viewer Dialog */}
      <AttendancePhotoDialog
        open={photoDialog.open}
        onClose={() => setPhotoDialog({ ...photoDialog, open: false })}
        photoUrl={photoDialog.photoUrl}
        studentName={photoDialog.studentName}
        status={photoDialog.status}
        timestamp={photoDialog.timestamp}
        method={photoDialog.method}
      />
    </Box>
  );
}
