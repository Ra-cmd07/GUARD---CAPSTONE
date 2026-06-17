import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Chip, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, CircularProgress, Snackbar, Alert, Divider, List, ListItem, ListItemIcon, ListItemText,
  Tabs, Tab,
} from '@mui/material';
import {
  Logout, School, CheckCircle, Cancel, AccessTime, Dashboard as DashboardIcon,
  CalendarToday, LocationOn, Sms as SmsIcon, Map as MapIcon,
} from '@mui/icons-material';
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import type { AttendanceRecord, ParentProfile, Student } from '../types';
import CampusMap from '../components/CampusMap';

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
  const [location,   setLocation]   = useState<any>(null);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [beacons,    setBeacons]    = useState<any[]>([]);
  const [locationView, setLocationView] = useState<'map' | 'list'>('map');
  const [loading,    setLoading]    = useState(false);
  const [snack,      setSnack]      = useState({ open: false, msg: '', sev: 'info' as any });

  const showSnack = (msg: string, sev: any = 'info') => setSnack({ open: true, msg, sev });

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

  // Load SMS logs (mock for now)
  useEffect(() => {
    if (tab === 'sms' && selected) {
      // In production: api.get(`/sms-logs?student_id=${selected.id}`)
      setSmsLogs([
        // SMS logs cleared - will show "No SMS notifications yet"
      ]);
    }
  }, [tab, selected]);

  // Load location data
  useEffect(() => {
    if (tab === 'location' && selected) {
      // Get current location
      api.get(`/location/student/${selected.id}`)
        .then(r => setLocation(r.data))
        .catch(() => setLocation(null));
      
      // Get location history (last 24 hours)
      api.get(`/location/student/${selected.id}?history=true`)
        .then(r => setLocationHistory(r.data || []))
        .catch(() => setLocationHistory([]));
      
      // Get all beacons for map display
      api.get('/location/beacons')
        .then(r => setBeacons(r.data || []))
        .catch(() => setBeacons([]));
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
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#f5f7fa' }}>
      {/* Sidebar */}
      <Box sx={{
        width: 240, 
        background: 'linear-gradient(180deg, #0d4d7d 0%, #1a7a9e 100%)',
        color: '#fff',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <School sx={{ color: '#fff' }} />
            <Typography variant="h6" fontWeight={800} sx={{ color: '#fff' }}>AttendBox</Typography>
          </Box>
          <Typography variant="caption" sx={{ opacity: 0.9, color: '#fff' }}>Parent Portal</Typography>
        </Box>

        <Box sx={{ flex: 1, py: 2 }}>
          <Box sx={{ px: 2, mb: 2 }}>
            <Typography variant="caption" sx={{ opacity: 0.7, textTransform: 'uppercase', fontSize: 10, color: '#fff' }}>
              Logged in as
            </Typography>
            <Typography fontWeight={700} fontSize="0.9rem" sx={{ color: '#fff' }}>{profile?.name || user?.username}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, color: '#fff' }}>{user?.username}</Typography>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 1 }} />

          {NAV.map(n => (
            <Box
              key={n.id}
              onClick={() => setTab(n.id as Tab)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 2.5, py: 1.5, cursor: 'pointer', mx: 1, borderRadius: 1,
                bgcolor: tab === n.id ? 'rgba(255,255,255,0.2)' : 'transparent',
                borderLeft: tab === n.id ? '3px solid #fff' : '3px solid transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                transition: 'all 0.2s',
                color: '#fff',
              }}>
              <Box sx={{ color: '#fff' }}>{n.icon}</Box>
              <Typography variant="body2" fontWeight={tab === n.id ? 700 : 400} sx={{ color: '#fff' }}>{n.label}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button fullWidth variant="contained" startIcon={<Logout />} onClick={handleLogout}
            sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}>
            Logout
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#f5f7fa' }}>
        {/* Top Bar */}
        <Box sx={{
          bgcolor: '#fff', px: 3, py: 2,
          borderBottom: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <Typography variant="h6" fontWeight={700} color="#1a1a1a">
            {selected ? `My child's attendance` : 'Parent Dashboard'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7, color: '#666' }}>
            👤 {user?.username}
          </Typography>
        </Box>

        <Box sx={{ p: 3 }}>
          {selected ? (
            <>
              {/* Overview Tab */}
              {tab === 'overview' && (
                <>
                  {/* Child Profile Card */}
                  <Paper elevation={2} sx={{
                    p: 3, borderRadius: 2, mb: 3,
                    bgcolor: '#fff', border: '1px solid #e0e0e0',
                  }}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar sx={{
                        width: 64, height: 64,
                        bgcolor: '#1a7a9e', fontSize: 28, fontWeight: 800,
                      }}>
                        {selected.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="h5" fontWeight={800} color="#1a1a1a" gutterBottom>
                          {selected.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#666' }}>
                          {selected.grade} — Section {selected.section} · Iponan National High School
                        </Typography>
                      </Box>
                      <Chip
                        icon={onCampus ? <CheckCircle /> : <Cancel />}
                        label={onCampus ? 'On campus' : 'Off campus'}
                        sx={{
                          bgcolor: onCampus ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.2)',
                          color: onCampus ? '#22c55e' : '#94a3b8',
                          fontWeight: 700, fontSize: '0.95rem', px: 2, py: 2.5,
                          border: `1px solid ${onCampus ? '#22c55e' : '#475569'}`,
                        }}
                      />
                    </Box>
                  </Paper>

                  {/* Weekly Attendance Table */}
                  <Paper elevation={2} sx={{ borderRadius: 2, mb: 3, bgcolor: '#fff', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
                    <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0' }}>
                      <Typography fontWeight={700} color="#1a1a1a">Attendance this week</Typography>
                    </Box>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#0d5a8f' }}>
                            <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Date</TableCell>
                            <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Time in</TableCell>
                            <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Time out</TableCell>
                            <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ py: 3, color: '#64748b' }}>
                                <CircularProgress size={24} sx={{ color: '#7c3aed' }} />
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
                              <TableRow key={d} sx={{ bgcolor: isToday ? '#e3f2fd' : '#fff', '&:hover': { bgcolor: '#f5f7fa' } }}>
                                <TableCell sx={{ color: '#1a1a1a', fontWeight: isToday ? 700 : 400 }}>
                                  {format(new Date(d + 'T00:00:00'), 'MMM d, yyyy')}
                                  {isToday && <Chip label="Today" size="small" sx={{ ml: 1, bgcolor: '#1a7a9e', color: 'white' }} />}
                                </TableCell>
                                <TableCell sx={{ color: '#666', fontSize: '0.9rem' }}>
                                  {rec?.time_in || (rec?.timestamp ? format(new Date(rec.timestamp), 'h:mm aa') : '—')}
                                </TableCell>
                                <TableCell sx={{ color: '#666', fontSize: '0.9rem' }}>
                                  {tout?.time_out || (tout?.timestamp ? format(new Date(tout.timestamp), 'h:mm aa') : '—')}
                                </TableCell>
                                <TableCell>
                                  {rec ? (
                                    <Chip
                                      label={rec.status}
                                      size="small"
                                      sx={{
                                        bgcolor: rec.status === 'Time-In' ? 'rgba(34,197,94,0.2)'
                                          : rec.status === 'Late' ? 'rgba(251,146,60,0.2)' : 'rgba(239,68,68,0.2)',
                                        color: rec.status === 'Time-In' ? '#22c55e' : rec.status === 'Late' ? '#fb923c' : '#ef4444',
                                        fontWeight: 700,
                                        border: `1px solid ${rec.status === 'Time-In' ? '#22c55e' : rec.status === 'Late' ? '#fb923c' : '#ef4444'}`,
                                      }}
                                    />
                                  ) : (
                                    <Chip label="Absent" size="small" sx={{ bgcolor: 'rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 700 }} />
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
                    <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SmsIcon sx={{ color: '#1a7a9e' }} />
                      <Typography fontWeight={700} color="#1a1a1a">Recent SMS notifications</Typography>
                    </Box>
                    <List sx={{ p: 0 }}>
                      {/* SMS notifications cleared */}
                      {[].length === 0 && (
                        <ListItem sx={{ py: 4, textAlign: 'center', justifyContent: 'center' }}>
                          <Typography color="#999" fontSize="0.9rem">No SMS notifications yet</Typography>
                        </ListItem>
                      )}
                    </List>
                  </Paper>
                </>
              )}

              {/* Attendance Log Tab */}
              {tab === 'attendance' && (
                <Paper elevation={2} sx={{ borderRadius: 2, bgcolor: '#fff', border: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                    <Typography fontWeight={700} color="#1a1a1a">Full Attendance History</Typography>
                  </Box>
                  <TableContainer sx={{ maxHeight: 500 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: '#0d5a8f', color: '#fff', fontWeight: 700 }}>Date</TableCell>
                          <TableCell sx={{ bgcolor: '#0d5a8f', color: '#fff', fontWeight: 700 }}>Status</TableCell>
                          <TableCell sx={{ bgcolor: '#0d5a8f', color: '#fff', fontWeight: 700 }}>Time</TableCell>
                          <TableCell sx={{ bgcolor: '#0d5a8f', color: '#fff', fontWeight: 700 }}>Method</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {loading && (
                          <TableRow>
                            <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                              <CircularProgress size={24} sx={{ color: '#1a7a9e' }} />
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
                  {/* View Toggle */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight={700} color="#1a1a1a">
                      Campus Location
                    </Typography>
                    <Tabs 
                      value={locationView} 
                      onChange={(_, v) => setLocationView(v)}
                      sx={{
                        minHeight: 36,
                        '& .MuiTab-root': { minHeight: 36, py: 0.5, px: 2 }
                      }}
                    >
                      <Tab icon={<MapIcon />} iconPosition="start" label="Map View" value="map" />
                      <Tab icon={<LocationOn />} iconPosition="start" label="List View" value="list" />
                    </Tabs>
                  </Box>

                  {/* Map View */}
                  {locationView === 'map' && (
                    <>
                      {location && location.location_name !== 'Unknown' ? (
                        <Paper elevation={2} sx={{ mb: 3, overflow: 'hidden', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                          <Box sx={{ height: 500 }}>
                            <CampusMap
                              studentLocation={location}
                              beacons={beacons}
                              studentName={selected?.name}
                            />
                          </Box>
                        </Paper>
                      ) : (
                        <Paper elevation={2} sx={{ p: 4, borderRadius: 2, textAlign: 'center', bgcolor: '#fff', border: '1px solid #e0e0e0', mb: 3 }}>
                          <MapIcon sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
                          <Typography variant="h6" fontWeight={700} gutterBottom color="#666">
                            No Location Data Available
                          </Typography>
                          <Typography variant="body2" color="#999" mb={2}>
                            BLE tracking is not active for this student. Location will appear here once the student's device is detected near a campus beacon.
                          </Typography>
                          <Chip 
                            label="📡 Waiting for BLE signal..." 
                            sx={{ bgcolor: '#f5f5f5', color: '#666' }} 
                          />
                        </Paper>
                      )}

                      {/* Current Location Info Card */}
                      {location && location.location_name !== 'Unknown' && (
                        <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3, bgcolor: '#fff', border: '1px solid #e0e0e0' }}>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Box
                              sx={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                bgcolor: '#e3f2fd',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <LocationOn sx={{ fontSize: 28, color: '#1a7a9e' }} />
                            </Box>
                            <Box flex={1}>
                              <Typography variant="body2" color="#666" gutterBottom>
                                Current Location
                              </Typography>
                              <Typography variant="h6" fontWeight={700} color="#1a1a1a">
                                {location.location_name}
                              </Typography>
                            </Box>
                            <Box textAlign="right">
                              <Chip 
                                label={location.location_status === 'active' ? 'Live' : 'Recent'} 
                                size="small"
                                icon={location.location_status === 'active' ? <CheckCircle /> : <AccessTime />}
                                sx={{
                                  bgcolor: location.location_status === 'active' ? '#e8f5e9' : '#fff3e0',
                                  color: location.location_status === 'active' ? '#2e7d32' : '#e65100',
                                  fontWeight: 700,
                                  mb: 0.5,
                                }}
                              />
                              <Typography variant="caption" color="#666" display="block">
                                {location.minutes_ago || 0} minutes ago
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Box display="flex" gap={1} mt={2} flexWrap="wrap">
                            {location.building && (
                              <Chip 
                                label={`🏢 ${location.building}`} 
                                size="small" 
                                variant="outlined"
                                sx={{ borderColor: '#1a7a9e', color: '#1a7a9e' }} 
                              />
                            )}
                            {location.floor && (
                              <Chip 
                                label={location.floor} 
                                size="small" 
                                variant="outlined"
                                sx={{ borderColor: '#1a7a9e', color: '#1a7a9e' }} 
                              />
                            )}
                            {location.coordinates && (
                              <Chip 
                                label={`📍 ${location.coordinates}`} 
                                size="small" 
                                sx={{ bgcolor: '#f5f5f5', color: '#666' }} 
                              />
                            )}
                          </Box>
                        </Paper>
                      )}
                    </>
                  )}

                  {/* List View */}
                  {locationView === 'list' && (
                    <>
                      {/* Current Location Card */}
                      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3, bgcolor: '#fff', border: '1px solid #e0e0e0' }}>
                        <Box display="flex" alignItems="center" gap={2} mb={3}>
                          <LocationOn sx={{ fontSize: 48, color: '#1a7a9e' }} />
                          <Box flex={1}>
                            <Typography variant="h6" fontWeight={700} color="#1a1a1a" gutterBottom>
                              Current Location
                            </Typography>
                            {location && location.location_name !== 'Unknown' ? (
                              <>
                                <Typography variant="h5" fontWeight={800} color="#1a7a9e" gutterBottom>
                                  {location.location_name}
                                </Typography>
                                <Box display="flex" gap={2} flexWrap="wrap">
                                  <Chip 
                                    label={location.building || 'Main Building'} 
                                    size="small" 
                                    sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }} 
                                  />
                                  {location.floor && (
                                    <Chip 
                                      label={location.floor} 
                                      size="small" 
                                      variant="outlined"
                                      sx={{ borderColor: '#1a7a9e', color: '#1a7a9e' }} 
                                    />
                                  )}
                                  <Chip 
                                    label={`Last seen: ${location.minutes_ago || 0} min ago`} 
                                    size="small" 
                                    icon={<AccessTime />}
                                    sx={{ bgcolor: '#f5f5f5', color: '#666' }} 
                                  />
                                </Box>
                              </>
                            ) : (
                              <Typography variant="body1" color="#666">
                                Location data not available. BLE tracking may be disabled.
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {location && location.coordinates && (
                          <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f7fa', borderRadius: 1 }}>
                            <Typography variant="caption" color="#666" display="block" gutterBottom>
                              📍 GPS Coordinates
                            </Typography>
                            <Typography variant="body2" color="#1a1a1a" fontWeight={600}>
                              {location.coordinates}
                            </Typography>
                          </Box>
                        )}
                      </Paper>
                    </>
                  )}

                  {/* Location History */}
                  {locationHistory.length > 0 && (
                    <Paper elevation={2} sx={{ borderRadius: 2, bgcolor: '#fff', border: '1px solid #e0e0e0', mb: 3 }}>
                      <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0' }}>
                        <Typography fontWeight={700} color="#1a1a1a">Location History (Last 24 Hours)</Typography>
                      </Box>
                      <TableContainer sx={{ maxHeight: 400 }}>
                        <Table stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ bgcolor: '#0d5a8f', color: '#fff', fontWeight: 700 }}>Time</TableCell>
                              <TableCell sx={{ bgcolor: '#0d5a8f', color: '#fff', fontWeight: 700 }}>Location</TableCell>
                              <TableCell sx={{ bgcolor: '#0d5a8f', color: '#fff', fontWeight: 700 }}>Building</TableCell>
                              <TableCell sx={{ bgcolor: '#0d5a8f', color: '#fff', fontWeight: 700 }}>Type</TableCell>
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
                                <TableCell>
                                  <Chip 
                                    label={loc.location_type || 'other'} 
                                    size="small" 
                                    sx={{ 
                                      bgcolor: loc.location_type === 'gate' ? '#e3f2fd' : '#f5f5f5',
                                      color: loc.location_type === 'gate' ? '#1976d2' : '#666',
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
                    <Typography variant="body2" color="#1976d2">
                      <strong>📡 BLE Location Tracking:</strong> Student location is detected via Bluetooth Low Energy (BLE) beacons placed throughout campus. Location updates occur when the student's device is near a beacon. The map shows real-time position based on the last detected beacon.
                    </Typography>
                  </Paper>
                </>
              )}

              {/* SMS History Tab */}
              {tab === 'sms' && (
                <Paper elevation={2} sx={{ borderRadius: 2, bgcolor: '#fff', border: '1px solid #e0e0e0' }}>
                  <Box sx={{ p: 2.5, borderBottom: '1px solid #e0e0e0' }}>
                    <Typography fontWeight={700} color="#1a1a1a">SMS Notification History</Typography>
                  </Box>
                  <List>
                    {smsLogs.length === 0 ? (
                      <ListItem sx={{ py: 4, justifyContent: 'center' }}>
                        <Typography color="#999" fontSize="0.9rem">No SMS history available</Typography>
                      </ListItem>
                    ) : (
                      smsLogs.map((log, i) => (
                        <ListItem key={i} sx={{ borderBottom: i < smsLogs.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
                          <ListItemIcon><SmsIcon sx={{ color: '#1a7a9e' }} /></ListItemIcon>
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
    </Box>
  );
}
