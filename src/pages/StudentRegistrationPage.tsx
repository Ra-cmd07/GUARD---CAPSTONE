import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button,
  Alert, Snackbar, CircularProgress, Divider, Chip,
  Card, CardContent,
  Tooltip, IconButton, Checkbox, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField,
} from '@mui/material';
import {
  ArrowBack, QrCode2, Bluetooth, CreditCard, CheckCircle,
  Info, Save, Search,
} from '@mui/icons-material';
import api from '../api/client';

type PreferredMethod = 'QR' | 'BLE' | 'RFID';

interface Student {
  id: number;
  lrn: string;
  name: string;
  gender?: string;  // Added gender field
  grade?: string;
  section?: string;
  preferred_method?: PreferredMethod;
  uuid?: string;  // Service UUID (for phone beacons)
  mac_address?: string;  // MAC address (for hardware beacons)
  rfid_uid?: string;
}

export default function StudentRegistrationPage() {
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PreferredMethod>('QR');
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [methodData, setMethodData] = useState<{ 
    [studentId: number]: { 
      uuid?: string; 
      mac_address?: string;
      rfid_uid?: string;
    } 
  }>({});
  const [bleType, setBleType] = useState<{ [studentId: number]: 'MAC' | 'UUID' }>({});  // Track BLE identifier type
  const [searchQuery, setSearchQuery] = useState('');
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
        // Clean up BLE type when deselecting
        setBleType(prevBleType => {
          const newBleType = { ...prevBleType };
          delete newBleType[studentId];
          return newBleType;
        });
      } else {
        newSet.add(studentId);
        // Set default BLE type to UUID when selecting
        if (selectedMethod === 'BLE') {
          setBleType(prev => ({ ...prev, [studentId]: 'UUID' }));
        }
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

  const handleMethodDataChange = (studentId: number, field: 'uuid' | 'mac_address' | 'rfid_uid', value: string) => {
    setMethodData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      }
    }));
  };

  const handleBleTypeChange = (studentId: number, type: 'MAC' | 'UUID') => {
    setBleType(prev => ({ ...prev, [studentId]: type }));
  };

  // Filter students based on search query
  const filteredStudents = students.filter(student => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const lrn = student.lrn?.toLowerCase() || '';
    const name = student.name?.toLowerCase() || '';
    const gradeSection = `${student.grade || ''} ${student.section || ''}`.toLowerCase();
    const method = (student.preferred_method || 'QR').toLowerCase();
    
    return lrn.includes(query) || 
           name.includes(query) || 
           gradeSection.includes(query) || 
           method.includes(query);
  });

  const handleSave = async () => {
    if (selectedStudents.size === 0) {
      setSnack({ open: true, msg: 'Please select at least one student', sev: 'error' });
      return;
    }

    // Validate method-specific data
    if (selectedMethod === 'BLE') {
      for (const studentId of selectedStudents) {
        const data = methodData[studentId];
        const type = bleType[studentId];
        
        // Require BLE type selection
        if (!type) {
          const student = students.find(s => s.id === studentId);
          setSnack({ 
            open: true, 
            msg: `Please select BLE identifier type (MAC or UUID) for ${student?.name}`, 
            sev: 'error' 
          });
          return;
        }
        
        // Validate MAC address if Hardware Beacon selected
        if (type === 'MAC' && !data?.mac_address) {
          const student = students.find(s => s.id === studentId);
          setSnack({ 
            open: true, 
            msg: `MAC Address required for ${student?.name} (Hardware Beacon)`, 
            sev: 'error' 
          });
          return;
        }
        
        // Validate UUID if Phone Beacon selected
        if (type === 'UUID' && !data?.uuid) {
          const student = students.find(s => s.id === studentId);
          setSnack({ 
            open: true, 
            msg: `Service UUID required for ${student?.name} (Phone Beacon)`, 
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
          const type = bleType[studentId];
          if (type === 'UUID') {
            updateData.uuid = methodData[studentId]?.uuid;
          } else if (type === 'MAC') {
            updateData.mac_address = methodData[studentId]?.mac_address;
          }
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

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Method Selection */}
          <Box>
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

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                {(['QR', 'BLE', 'RFID'] as PreferredMethod[]).map((method) => {
                  const info = methodInfo[method];
                  const isSelected = selectedMethod === method;

                  return (
                    <Box key={method}>
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
                    </Box>
                  );
                })}
              </Box>

              {/* Method Requirements */}
              <Box mt={3}>
                {selectedMethod === 'BLE' && (
                  <Alert severity="info">
                    <Typography variant="body2" fontWeight={600}>BLE Setup Required</Typography>
                    <Typography variant="caption">
                      Choose identifier type (MAC for hardware beacons, UUID for phone beacons) and enter the value for each selected student
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
          </Box>

          {/* Student Selection Table */}
          <Box>
            <Paper elevation={3} sx={{ borderRadius: 2 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontWeight={700}>
                  Select Students ({selectedStudents.size} selected)
                </Typography>
                <Button size="small" onClick={handleSelectAll}>
                  {selectedStudents.size === students.length ? 'Deselect All' : 'Select All'}
                </Button>
              </Box>

              {/* Search Bar */}
              <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search by LRN, Name, Grade/Section, or Current Method..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} />,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#f9f9f9',
                    },
                  }}
                />
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
                        {selectedMethod === 'BLE' && <TableCell>BLE Type *</TableCell>}
                        {selectedMethod === 'BLE' && <TableCell>Identifier *</TableCell>}
                        {selectedMethod === 'RFID' && <TableCell>RFID UID *</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">
                              {searchQuery ? 'No students found matching your search' : 'No students available'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStudents.map((student) => {
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
                                <>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                      <Chip 
                                        label="Hardware (MAC)" 
                                        size="small"
                                        onClick={() => handleBleTypeChange(student.id, 'MAC')}
                                        color={bleType[student.id] === 'MAC' ? 'primary' : 'default'}
                                        variant={bleType[student.id] === 'MAC' ? 'filled' : 'outlined'}
                                        sx={{ cursor: 'pointer' }}
                                      />
                                      <Chip 
                                        label="Phone (UUID)" 
                                        size="small"
                                        onClick={() => handleBleTypeChange(student.id, 'UUID')}
                                        color={bleType[student.id] === 'UUID' ? 'primary' : 'default'}
                                        variant={bleType[student.id] === 'UUID' ? 'filled' : 'outlined'}
                                        sx={{ cursor: 'pointer' }}
                                      />
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    {bleType[student.id] === 'MAC' ? (
                                      <TextField
                                        size="small"
                                        placeholder="AA:BB:CC:DD:EE:FF"
                                        value={methodData[student.id]?.mac_address || ''}
                                        onChange={(e) => handleMethodDataChange(student.id, 'mac_address', e.target.value)}
                                        fullWidth
                                      />
                                    ) : bleType[student.id] === 'UUID' ? (
                                      <TextField
                                        size="small"
                                        placeholder="00001111-0000-1000-8000-00805f9b34fb"
                                        value={methodData[student.id]?.uuid || ''}
                                        onChange={(e) => handleMethodDataChange(student.id, 'uuid', e.target.value)}
                                        fullWidth
                                      />
                                    ) : (
                                      <Typography variant="caption" color="text.secondary">
                                        Select BLE type first
                                      </Typography>
                                    )}
                                  </TableCell>
                                </>
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
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Box>

          {/* Save Button */}
          <Box>
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
          </Box>
        </Box>
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
