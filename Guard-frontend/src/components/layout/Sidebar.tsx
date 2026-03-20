import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Switch, FormControlLabel, Button,
  Divider, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField,
} from '@mui/material';
import {
  QrCodeScanner, PersonAdd, Logout, CloudOff, CloudDone,
  Settings, Groups,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

interface Props {
  mode:             'Drop-off' | 'Pick-up';
  onModeChange:     (m: 'Drop-off' | 'Pick-up') => void;
  scannerOn:        boolean;
  onScannerToggle:  (v: boolean) => void;
  isOnline:         boolean;
  teacher:          any;
  classTime:        string;
  onClassTimeChange:(t: string) => void;
  onOpenGuardian:   () => void;
}

export default function Sidebar({
  mode, onModeChange, scannerOn, onScannerToggle,
  isOnline, teacher, classTime, onClassTimeChange, onOpenGuardian,
}: Props) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [timeDialog, setTimeDialog] = useState(false);
  const [tempTime,   setTempTime]   = useState(classTime);

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
      width: 280, background: '#2d5016', color: '#fff',
      display: 'flex', flexDirection: 'column', p: 2.5,
      overflowY: 'auto', boxShadow: '3px 0 8px rgba(0,0,0,0.3)',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <Box textAlign="center" mb={2.5} pb={2} sx={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <Typography fontSize="2.5rem">🌿</Typography>
        <Typography variant="h6" fontWeight={800}>ChildTrack</Typography>
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
              checked={mode === 'Drop-off'}
              onChange={e => onModeChange(e.target.checked ? 'Drop-off' : 'Pick-up')}
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
          color: scannerOn ? '#fff' : '#2d5016',
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
      <SideBtn icon={<Groups />} label="Register Guardian"
        onClick={onOpenGuardian} />

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
    </Box>
  );
}