import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, Grid,
  Alert, Snackbar, CircularProgress, Divider, Chip,
  Card, CardContent,
  Tooltip, IconButton, Checkbox, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField,
} from '@mui/material';
import {
  ArrowBack, QrCode2, Bluetooth, CreditCard, CheckCircle,
  Info, Save,
} from '@mui/icons-material';
import api from '../api/client';
import theme from '../theme/professionalTheme';

type PreferredMethod = 'QR' | 'BLE' | 'RFID';

interface Student {
  id: number;
  lrn: string;
  name: string;
  grade?: string;
  section?: string;
  preferred_method?: PreferredMethod;
  mac_address?: string;
  rfid_uid?: string;
}

export default function StudentRegistrationPage() {
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PreferredMethod>('QR');
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [methodData, setMethodData] = useState<{ [studentId: number]: { mac_address?: string; rfid_uid?: string } }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>
    ({ open: false, msg: '', sev: 'success' });

  // Load all students
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/students');
      setStudents(data);
    } catch (err) {
      setSnack({ open: true, msg: 'Failed to load students', sev: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStudent = (studentId: number) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map(s => s.id)));
    }
  };

  const handleMethodDataChange = (studentId: number, field: 'mac_address' | 'rfid_uid', value: string) => {
    setMethodData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      }
    }));
  };

  const handleSave = async () => {
    if (selectedStudents.size === 0) {
      setSnack({ open: true, msg: 'Please select at least one student', sev: 'error' });
      return;
    }

    // Validate method-specific data
    if (selectedMethod === 'BLE') {
      for (const studentId of selectedStudents) {
        if (!methodData[studentId]?.mac_address) {
          const student = students.find(s => s.id === studentId);
          setSnack({ 
            open: true, 
            msg: `MAC Address required for ${student?.name} (BLE method)`, 
            sev: 'error' 
          });
          return;
        }
      }
    }

    if (selectedMethod === 'RFID') {
      for (const studentId of selectedStudents) {
        if (!methodData[studentId]?.rfid_uid) {
          const student = students.find(s => s.id === studentId);
          setSnack({ 
            open: true, 
            msg: `RFID UID required for ${student?.name} (RFID method)`, 
            sev: 'error' 
          });
          return;
        }
      }
    }

    setSaving(true);
    try {
      // Update each selected student
      const promises = Array.from(selectedStudents).map(studentId => {
        const student = students.find(s => s.id === studentId);
        const updateData: any = {
          name: student?.name,
          gender: student?.gender || 'M',
          grade: student?.grade,
          section: student?.section,
          preferred_method: selectedMethod,
        };

        if (selectedMethod === 'BLE') {
          updateData.mac_address = methodData[studentId]?.mac_address;
        }

        if (selectedMethod === 'RFID') {
          updateData.rfid_uid = methodData[studentId]?.rfid_uid;
        }

        return api.put(`/students/${studentId}`, updateData);
      });

      await Promise.all(promises);

      setSnack({ 
        open: true, 
        msg: `✅ ${selectedStudents.size} student(s) updated to ${selectedMethod} method!`, 
        sev: 'success' 
      });

      // Reload students and reset
      await loadStudents();
      setSelectedStudents(new Set());
      setMethodData({});
    } catch (err: any) {
      setSnack({ 
        open: true, 
        msg: err.response?.data?.error || 'Update failed', 
        sev: 'error' 
      });
    } finally {
      setSaving(false);
    }
  };

  const methodInfo = {
    QR: {
      icon: <QrCode2 sx={{ fontSize: 40 }} />,
      title: 'QR Code',
      description: 'Student scans a QR code at the kiosk',
      color: '#2e7d32',
      benefits: ['Fast scanning', 'Works on any device', 'Most common method'],
    },
    BLE: {
      icon: <Bluetooth sx={{ fontSize: 40 }} />,
      title: 'Bluetooth Low Energy',
      description: 'Automatic detection when student approaches',
      color: '#2196f3',
      benefits: ['Hands-free', 'Auto-detection', 'Real-time location tracking'],
    },
    RFID: {
      icon: <CreditCard sx={{ fontSize: 40 }} />,
      title: 'RFID Card',
      description: 'Student taps an RFID card at the kiosk',
      color: '#f57c00',
      benefits: ['Physical card', 'Quick tap', 'No phone needed'],
    },
  };

  return (
    <Box sx={{ minHeight: '100vh', background: '#f5f5f5', p: 3 }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Button 
            startIcon={<ArrowBack />} 
            onClick={() => navigate('/admin')} 
            variant="outlined"
          >
            Back to Dashboard
          </Button>
          <Box flex={1}>
            <Typography variant="h4" fontWeight={800} color="#3b82f6">
              Set Student Access Methods
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select students and assign their preferred kiosk access method
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Method Selection */}
          <Grid size={{ xs: 12 }}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <CheckCircle sx={{ color: '#3b82f6', fontSize: 28 }} />
                <Typography variant="h6" fontWeight={700}>
                  Preferred Kiosk Access Method
                </Typography>
                <Tooltip title="Choose the access method for selected students">
                  <IconButton size="small">
                    <Info sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={2}>
                {(['QR', 'BLE', 'RFID'] as PreferredMethod[]).map((method) => {
                  const info = methodInfo[method];
                  const isSelected = selectedMethod === method;

                  return (
                    <Grid size={{ xs: 12, md: 4 }} key={method}>
                      <Card
                        onClick={() => setSelectedMethod(method)}
                        sx={{
                          cursor: 'pointer',
                          border: isSelected ? `3px solid ${info.color}` : '2px solid #e0e0e0',
                          bgcolor: isSelected ? `${info.color}10` : '#fff',
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: info.color,
                            transform: 'translateY(-2px)',
                            boxShadow: `0 4px 12px ${info.color}40`,
                          },
                        }}
                      >
                        <CardContent>
                          <Box display="flex" flexDirection="column" alignItems="center" textAlign="center">
                            <Box sx={{ color: info.color, mb: 2, p: 2, borderRadius: '50%', bgcolor: `${info.color}20` }}>
                              {info.icon}
                            </Box>
                            <Typography variant="h6" fontWeight={700} mb={1}>
                              {info.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                              {info.description}
                            </Typography>
                            <Divider sx={{ width: '100%', mb: 2 }} />
                            {info.benefits.map((benefit, idx) => (
                              <Typography key={idx} variant="caption" display="block" mb={0.5}>
                                ✓ {benefit}
                              </Typography>
                            ))}
                            {isSelected && (
                              <Chip label="SELECTED" size="small" sx={{ mt: 2, bgcolor: info.color, color: '#fff', fontWeight: 700 }} />
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>

              {/* Method Requirements */}
              <Box mt={3}>
                {selectedMethod === 'BLE' && (
                  <Alert severity="info">
                    <Typography variant="body2" fontWeight={600}>BLE Setup Required</Typography>
                    <Typography variant="caption">
                      Enter MAC address for each selected student in the table below
                    </Typography>
                  </Alert>
                )}
                {selectedMethod === 'RFID' && (
                  <Alert severity="info">
                    <Typography variant="body2" fontWeight={600}>RFID Setup Required</Typography>
                    <Typography variant="caption">
                      Enter RFID UID for each selected student in the table below
                    </Typography>
                  </Alert>
                )}
                {selectedMethod === 'QR' && (
                  <Alert severity="success">
                    <Typography variant="body2" fontWeight={600}>QR Code Method</Typography>
                    <Typography variant="caption">
                      No additional setup required. QR codes are generated automatically.
                    </Typography>
                  </Alert>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Student Selection Table */}
          <Grid size={{ xs: 12 }}>
            <Paper elevation={3} sx={{ borderRadius: 2 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontWeight={700}>
                  Select Students ({selectedStudents.size} selected)
                </Typography>
                <Button size="small" onClick={handleSelectAll}>
                  {selectedStudents.size === students.length ? 'Deselect All' : 'Select All'}
                </Button>
              </Box>

              {loading ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer sx={{ maxHeight: 500 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox checked={selectedStudents.size === students.length} onChange={handleSelectAll} />
                        </TableCell>
                        <TableCell>LRN</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Grade/Section</TableCell>
                        <TableCell>Current Method</TableCell>
                        {selectedMethod === 'BLE' && <TableCell>MAC Address *</TableCell>}
                        {selectedMethod === 'RFID' && <TableCell>RFID UID *</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {students.map((student) => {
                        const isSelected = selectedStudents.has(student.id);
                        return (
                          <TableRow key={student.id} hover selected={isSelected}>
                            <TableCell padding="checkbox">
                              <Checkbox checked={isSelected} onChange={() => handleToggleStudent(student.id)} />
                            </TableCell>
                            <TableCell>{student.lrn}</TableCell>
                            <TableCell><strong>{student.name}</strong></TableCell>
                            <TableCell>{student.grade} {student.section}</TableCell>
                            <TableCell>
                              <Chip label={student.preferred_method || 'QR'} size="small" />
                            </TableCell>
                            {selectedMethod === 'BLE' && isSelected && (
                              <TableCell>
                                <TextField
                                  size="small"
                                  placeholder="AA:BB:CC:DD:EE:FF"
                                  value={methodData[student.id]?.mac_address || ''}
                                  onChange={(e) => handleMethodDataChange(student.id, 'mac_address', e.target.value)}
                                  fullWidth
                                />
                              </TableCell>
                            )}
                            {selectedMethod === 'RFID' && isSelected && (
                              <TableCell>
                                <TextField
                                  size="small"
                                  placeholder="04A3B2C1"
                                  value={methodData[student.id]?.rfid_uid || ''}
                                  onChange={(e) => handleMethodDataChange(student.id, 'rfid_uid', e.target.value)}
                                  fullWidth
                                />
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>

          {/* Save Button */}
          <Grid size={{ xs: 12 }}>
            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <Button
                variant="contained"
                fullWidth
                size="large"
                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <Save />}
                onClick={handleSave}
                disabled={saving || selectedStudents.size === 0}
                sx={{
                  py: 1.5,
                  fontWeight: 700,
                  bgcolor: '#fff',
                  color: '#667eea',
                  '&:hover': { bgcolor: '#f5f5f5' },
                }}
              >
                {saving ? 'Saving...' : `Save ${selectedMethod} Method for ${selectedStudents.size} Student(s)`}
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
