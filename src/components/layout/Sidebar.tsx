import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Switch, FormControlLabel, Button,
  Divider, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert,
} from '@mui/material';
import {
  QrCodeScanner, PersonAdd, Logout, CloudOff, CloudDone,
  Settings, Groups, Description, School,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';

interface Props {
  mode:             'Time-In' | 'Time-Out';
  onModeChange:     (m: 'Time-In' | 'Time-Out') => void;
  scannerOn:        boolean;
  onScannerToggle:  (v: boolean) => void;
  isOnline:         boolean;
  teacher:          any;
  classTime:        string;
  onClassTimeChange:(t: string) => void;
  onOpenGuardian:   () => void;
  isAdmin?:         boolean;
}

export default function Sidebar({
  mode, onModeChange, scannerOn, onScannerToggle,
  isOnline, teacher, classTime, onClassTimeChange, onOpenGuardian, isAdmin = false,
}: Props) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [timeDialog, setTimeDialog] = useState(false);
  const [tempTime,   setTempTime]   = useState(classTime);
  const [sectionDialog, setSectionDialog] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState<any>(null);
  const [sectionDetails, setSectionDetails] = useState<any>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionError, setSectionError] = useState('');

  useEffect(() => {
    if (isAdmin && sectionDialog) {
      fetchSections();
    }
  }, [isAdmin, sectionDialog]);

  const fetchSections = async () => {
    try {
      setSectionError('');
      const res = await api.get('/admin/sections');
      setSections(res.data || []);
    } catch (err: any) {
      setSectionError(err.response?.data?.error || 'Failed to load sections');
    }
  };

  const handleSectionSelect = async (sectionId: number) => {
    try {
      setSectionLoading(true);
      setSectionError('');
      const res = await api.get(`/admin/sections/${sectionId}`);
      setSelectedSection(res.data.section);
      setSectionDetails(res.data);
    } catch (err: any) {
      setSectionError(err.response?.data?.error || 'Failed to load section details');
    } finally {
      setSectionLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  };

  const SideBtn = ({ icon, label, onClick, color = '#fff', bg = 'rgba(255,255,255,0.15)' }: any) => (
    <Button
      fullWidth startIcon={icon}
      onClick={onClick}
      sx={{
        mb: 1, justifyContent: 'flex-start', px: 2,
        background: bg, color, fontWeight: 600,
        '&:hover': { background: 'rgba(255,255,255,0.25)' },
        minHeight: 44,
      }}
    >
      {label}
    </Button>
  );

  return (
    <Box sx={{
      width: 280, background: '#3b82f6', color: '#fff',
      display: 'flex', flexDirection: 'column', p: 2.5,
      overflowY: 'auto', boxShadow: '3px 0 8px rgba(0,0,0,0.3)',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <Box textAlign="center" mb={2.5} pb={2} sx={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <Typography fontSize="2.5rem">🪪</Typography>
        <Typography variant="h6" fontWeight={800}>AttendBox</Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>Attendance System</Typography>
      </Box>

      {/* Teacher info */}
      <Box mb={2} textAlign="center">
        <Chip label={`👤 ${teacher?.name || 'Teacher'}`}
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }} />
        <Typography variant="caption" display="block" sx={{ opacity: 0.7, mt: 0.5 }}>
          📅 {format(new Date(), 'MMM d, yyyy')}
        </Typography>
      </Box>

      {/* Mode Toggle */}
      <Box sx={{ background: 'rgba(255,255,255,0.15)', p: 1.5, borderRadius: 2, mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={mode === 'Time-In'}
              onChange={e => onModeChange(e.target.checked ? 'Time-In' : 'Time-Out')}
              sx={{ '& .MuiSwitch-thumb': { bgcolor: '#fff' } }}
            />
          }
          label={<Typography color="white" fontWeight={700}>{mode}</Typography>}
        />
      </Box>

      {/* Scanner */}
      <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.7, mb: 1, textTransform: 'uppercase' }}>
        📱 Scanner
      </Typography>
      <Button fullWidth variant="contained"
        sx={{
          mb: 1.5, fontWeight: 700,
          background: scannerOn ? '#dc3545' : '#ffffff',
          color: scannerOn ? '#fff' : '#3b82f6',
          '&:hover': { background: scannerOn ? '#b02a37' : '#e8f5e9' },
        }}
        startIcon={<QrCodeScanner />}
        onClick={() => onScannerToggle(!scannerOn)}>
        {scannerOn ? '⏹ Disable Scanner' : '🔍 Enable Scanner'}
      </Button>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 1.5 }} />

      {/* Registration */}
      <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.7, mb: 1, textTransform: 'uppercase' }}>
        👥 Registration
      </Typography>
      <SideBtn icon={<PersonAdd />} label="Register Student"
        onClick={() => navigate('/students')} />
      <SideBtn icon={<Groups />} label="Register Teacher"
        onClick={onOpenGuardian} />

      {/* Sections & Enrollment (Admin only) */}
      {isAdmin && (
        <>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 1.5 }} />
          <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.7, mb: 1, textTransform: 'uppercase' }}>
            🏫 Sections
          </Typography>
          <SideBtn icon={<School />} label="View Sections"
            onClick={() => setSectionDialog(true)} />
        </>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 1.5 }} />

      {/* Reports */}
      <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.7, mb: 1, textTransform: 'uppercase' }}>
        📊 Reports
      </Typography>
      <SideBtn icon={<Description />} label="SF2 Report"
        onClick={() => navigate('/sf2-report')} />

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 1.5 }} />

      {/* Settings */}
      <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.7, mb: 1, textTransform: 'uppercase' }}>
        ⚙️ Settings
      </Typography>
      <SideBtn icon={<Settings />} label={`Class Time: ${classTime}`}
        onClick={() => setTimeDialog(true)} />

      {/* Spacer */}
      <Box flex={1} />

      {/* Online indicator */}
      <Box display="flex" alignItems="center" gap={1} mb={1.5}>
        {isOnline
          ? <><CloudDone sx={{ color: '#4caf50', fontSize: 20 }} /><Typography variant="body2" color="#4caf50">Online</Typography></>
          : <><CloudOff  sx={{ color: '#ff9800', fontSize: 20 }} /><Typography variant="body2" color="#ff9800">Offline — records queued</Typography></>}
      </Box>

      {/* Logout */}
      <Button variant="contained" startIcon={<Logout />} onClick={handleLogout} fullWidth
        sx={{ background: '#dc3545', fontWeight: 700, '&:hover': { background: '#b02a37' } }}>
        Logout
      </Button>

      {/* Class Time Dialog */}
      <Dialog open={timeDialog} onClose={() => setTimeDialog(false)}>
        <DialogTitle>⏰ Set Class Start Time</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Students scanned 30+ minutes after this time are marked as Late.
          </Typography>
          <TextField type="time" fullWidth value={tempTime}
            onChange={e => setTempTime(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimeDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => {
            onClassTimeChange(tempTime);
            setTimeDialog(false);
          }}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Section Details Dialog */}
      <Dialog open={sectionDialog} onClose={() => setSectionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ background: '#3b82f6', color: '#fff', fontWeight: 700 }}>
          🏫 Sections & Enrollment
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {sectionError && <Alert severity="error" sx={{ mb: 2 }}>{sectionError}</Alert>}
          
          <FormControl fullWidth size="small" sx={{ mb: 3 }}>
            <InputLabel>Select Section</InputLabel>
            <Select
              value={selectedSection?.id || ''}
              onChange={(e) => handleSectionSelect(e.target.value as any)}
              label="Select Section"
            >
              {sections.map((section: any) => (
                <MenuItem key={section.id} value={section.id}>
                  {section.name} - Grade {section.grade}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {sectionLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : sectionDetails && selectedSection ? (
            <>
              {/* Section Info */}
              <Box sx={{ mb: 3, p: 2, background: '#f0f9ff', borderRadius: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  📋 Section Info
                </Typography>
                <Typography variant="body2"><strong>Name:</strong> {selectedSection.name}</Typography>
                <Typography variant="body2"><strong>Grade:</strong> {selectedSection.grade}</Typography>
                <Typography variant="body2"><strong>Code:</strong> {selectedSection.section_code}</Typography>
              </Box>

              {/* Teachers */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  👨‍🏫 Teachers ({sectionDetails.teachers?.length || 0})
                </Typography>
                {sectionDetails.teachers && sectionDetails.teachers.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {sectionDetails.teachers.map((teacher: any) => (
                      <Chip key={teacher.id} label={teacher.name} size="small" sx={{ justifyContent: 'flex-start' }} />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="textSecondary">No teachers assigned</Typography>
                )}
              </Box>

              {/* Enrolled Students */}
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  👥 Enrolled Students ({sectionDetails.students?.length || 0})
                </Typography>
                {sectionDetails.students && sectionDetails.students.length > 0 ? (
                  <TableContainer sx={{ maxHeight: 250 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#e8f4f8' }}>
                          <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Name</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>LRN</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sectionDetails.students.map((student: any) => (
                          <TableRow key={student.id} sx={{ '&:hover': { bgcolor: '#f5f5f5' } }}>
                            <TableCell sx={{ fontSize: '0.75rem' }}>{student.name}</TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>{student.lrn || 'N/A'}</TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>
                              <Chip 
                                label={student.is_active ? 'Active' : 'Inactive'} 
                                size="small"
                                color={student.is_active ? 'success' : 'default'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="textSecondary">No students enrolled</Typography>
                )}
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="textSecondary">Select a section to view details</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSectionDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}