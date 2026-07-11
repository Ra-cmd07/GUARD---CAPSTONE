import { useState, useEffect, useCallback } from 'react';
import { Box, Snackbar, Alert } from '@mui/material';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import type { AttendanceRecord, QRPayload } from '../types';
import Sidebar from '../components/layout/Sidebar';
import CounterCards from '../components/dashboard/CounterCards';
import AttendanceTable from '../components/dashboard/AttendanceTable';
import PrivacyNotice from '../components/shared/PrivacyNotice';
import PhotoCaptureModal from '../components/shared/PhotoCaptureModal';
import GuardianDrawer from '../components/guardian/GuardianDrawer';
import { useScanner } from '../hooks/useScanner';
import { enqueueRecord, syncQueue } from '../utils/offlineQueue';

type Snack = { open: boolean; msg: string; sev: 'success' | 'error' | 'warning' | 'info' };

export default function DashboardPage() {
  const { user: teacher, token } = useAuth();

  const [rows,           setRows]           = useState<AttendanceRecord[]>([]);
  const [mode,           setMode]           = useState<'Time-In' | 'Time-Out'>('Time-In');
  const [scannerOn,      setScannerOn]      = useState(false);
  const [isOnline,       setIsOnline]       = useState(navigator.onLine);
  const [loading,        setLoading]        = useState(true);
  const [classTime,      setClassTime]      = useState('07:30');
  const [photoModal,     setPhotoModal]     = useState(false);
  const [photoStudent,   setPhotoStudent]   = useState('');
  const [guardianDrawer, setGuardianDrawer] = useState(false);
  const [privacyShown,   setPrivacyShown]   = useState(false);
  const [snack,          setSnack]          = useState<Snack>({ open: false, msg: '', sev: 'info' });

  const showSnack = (msg: string, sev: Snack['sev'] = 'info') =>
    setSnack({ open: true, msg, sev });

  // ── Check if scan is late ────────────────────────────────────────────
  const isLate = useCallback(() => {
    const now  = new Date();
    const curr = now.getHours() * 60 + now.getMinutes();
    const [h, m] = classTime.split(':').map(Number);
    return curr - (h * 60 + m) >= 30;
  }, [classTime]);

  // ── Fetch today's attendance ─────────────────────────────────────────
  const fetchAttendance = useCallback(async () => {
    try {
      const date = format(new Date(), 'yyyy-MM-dd');
      const { data } = await api.get(`/attendance?date=${date}`);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      showSnack('Could not load attendance records', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
    const iv = setInterval(fetchAttendance, 30_000);
    return () => clearInterval(iv);
  }, [fetchAttendance]);

  // ── Online/offline detection + auto sync ────────────────────────────
  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true);
      const synced = await syncQueue(token || '');
      if (synced > 0) {
        showSnack(`✅ Synced ${synced} offline record(s)`, 'success');
        fetchAttendance();
      }
    };
    const goOffline = () => {
      setIsOnline(false);
      showSnack('📴 Offline — records will be saved locally', 'warning');
    };
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [fetchAttendance, token]);

  // ── QR Scan Handler ──────────────────────────────────────────────────
  const handleScan = useCallback(async (rawData: string) => {
    let payload: QRPayload;
    try {
      payload = JSON.parse(rawData);
    } catch {
      showSnack('❌ Invalid QR code — not valid JSON', 'error');
      return;
    }

    const status = mode === 'Time-In' && isLate() ? 'Late' : mode;
    const today  = format(new Date(), 'yyyy-MM-dd');
    const session = new Date().getHours() < 12 ? 'AM' : 'PM';

    const record = {
      student_name:  payload.student,
      lrn:           payload.lrn,
      gender:        payload.gender,
      guardian_name: payload.name,
      by_whom:       `${payload.role}: ${payload.name}`,
      status,
      session,
      date:          today,
      qr_data:       rawData,
    };

    if (!isOnline) {
      enqueueRecord(record);
      setRows(prev => [{ ...record, id: Date.now(), timestamp: new Date().toISOString() } as AttendanceRecord, ...prev]);
      showSnack(`📦 ${status} saved offline for ${payload.student}`, 'warning');
      return;
    }

    try {
      await api.post('/attendance', record);
      setPhotoStudent(payload.student);
      setPhotoModal(true);
      fetchAttendance();
    } catch (err: any) {
      if (err.response?.status === 409) {
        showSnack(`⚠️ ${status} already recorded for ${payload.student}`, 'warning');
      } else {
        showSnack(`❌ Failed to record attendance`, 'error');
      }
    }
  }, [mode, isLate, isOnline, fetchAttendance]);

  // ── Attach scanner hook ──────────────────────────────────────────────
  useScanner(scannerOn, handleScan);

  // ── Delete row ───────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/attendance/${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
      showSnack('🗑️ Record removed', 'warning');
    } catch {
      showSnack('❌ Failed to delete record', 'error');
    }
  };

  // ── Update status ────────────────────────────────────────────────────
  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await api.patch(`/attendance/${id}`, { status: newStatus });
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: newStatus as any } : r));
      showSnack(`✅ Status updated to ${newStatus}`, 'success');
    } catch {
      showSnack('❌ Failed to update status', 'error');
    }
  };

  return (
    <>
      {/* Privacy Notice overlay on first load */}
      {!privacyShown && (
        <PrivacyNotice onAccept={() => setPrivacyShown(true)} />
      )}

      <Box sx={{ display: 'flex', height: '100vh', background: '#f5f5f5' }}>
        {/* Sidebar */}
        <Sidebar
          mode={mode}
          onModeChange={setMode}
          scannerOn={scannerOn}
          onScannerToggle={setScannerOn}
          isOnline={isOnline}
          teacher={teacher}
          classTime={classTime}
          onClassTimeChange={setClassTime}
          onOpenGuardian={() => setGuardianDrawer(true)}
        />

        {/* Main */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Counter Cards */}
          <Box sx={{ p: 2 }}>
            <CounterCards rows={rows} />
          </Box>

          {/* Attendance Table */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
            <AttendanceTable
              rows={rows}
              loading={loading}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          </Box>
        </Box>
      </Box>

      {/* Photo Capture Modal */}
      <PhotoCaptureModal
        open={photoModal}
        studentName={photoStudent}
        onCaptureDone={async (base64) => {
          setPhotoModal(false);
          if (base64) {
            try {
              await api.post('/scan-photos', {
                student_name:  photoStudent,
                status:        mode,
                photo_base64:  base64,
              });
            } catch {
              showSnack('⚠️ Photo could not be saved', 'warning');
            }
          }
        }}
      />

      {/* Guardian Drawer */}
      <GuardianDrawer
        open={guardianDrawer}
        onClose={() => setGuardianDrawer(false)}
      />

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={3500}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled"
          onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}