import { Box } from '@mui/material';
import Sidebar from '../components/layout/Sidebar';
import SF2ReportForm from '../components/dashboard/SF2ReportForm';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function SF2ReportPage() {
  const { user: teacher } = useAuth();
  const [mode, setMode] = useState<'Time-In' | 'Time-Out'>('Time-In');
  const [scannerOn, setScannerOn] = useState(false);
  const [isOnline] = useState(navigator.onLine);
  const [classTime, setClassTime] = useState('07:30');

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: '#f5f5f5' }}>
      <Sidebar
        mode={mode}
        onModeChange={setMode}
        scannerOn={scannerOn}
        onScannerToggle={setScannerOn}
        isOnline={isOnline}
        teacher={teacher}
        classTime={classTime}
        onClassTimeChange={setClassTime}
        onOpenGuardian={() => {}}
        isAdmin={teacher?.role === 'admin'}
      />

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <Box sx={{ p: 3 }}>
          <SF2ReportForm />
        </Box>
      </Box>
    </Box>
  );
}
