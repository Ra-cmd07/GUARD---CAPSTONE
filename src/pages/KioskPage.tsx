import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Button, CircularProgress, Alert, Fade, Slide, Divider,
  useMediaQuery, useTheme as useMuiTheme,
} from '@mui/material';
import {
  QrCodeScanner, CreditCard, Bluetooth, CheckCircle,
  ErrorOutline, Wifi, SignalCellularAlt, CameraAlt,
} from '@mui/icons-material';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { format } from 'date-fns';
import api from '../api/client';
import theme from '../theme/professionalTheme';

type ScanMethod = 'RFID' | 'QR' | 'BLE';
type ScanState  = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

interface ScanResult {
  identifier:   string;
  student_name: string;
  status?:      string;
  session?:     string;
  photo_path?:  string;
  attendanceId?: number;
}

const KIOSK_ID = Number(import.meta.env.VITE_KIOSK_ID || 1);
const SCHOOL_NAME = import.meta.env.VITE_SCHOOL_NAME || 'Iponan National High School';

// ─── Live Clock Component ────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Box textAlign="center" sx={{ mb: 4 }}>
      <Typography
        sx={{
          fontSize: { xs: '4rem', md: '6rem' },
          fontFamily: theme.typography.fontFamily.display,
          fontWeight: theme.typography.fontWeight.light,
          color: '#fff',
          letterSpacing: '0.05em',
          lineHeight: 1,
          mb: 1,
        }}
      >
        {format(time, 'h:mm a').toUpperCase()}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: '1rem', md: '1.25rem' },
          color: 'rgba(255,255,255,0.8)',
          fontFamily: theme.typography.fontFamily.primary,
          fontWeight: theme.typography.fontWeight.normal,
        }}
      >
        {format(time, 'EEEE, MMMM d, yyyy')}
      </Typography>
    </Box>
  );
}

// ─── Main Kiosk Page ─────────────────────────────────────────────────
export default function KioskPage() {
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md')); // Below 900px = mobile
  
  const webcamRef       = useRef<Webcam>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rfidPollingRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const rfidBufferRef   = useRef('');
  const rfidTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProcessedAttendanceRef = useRef<number | null>(null);

  const [method,      setMethod]      = useState<ScanMethod>('RFID');
  const [scanState,   setScanState]   = useState<ScanState>('idle');
  const [identifier,  setIdentifier]  = useState('');
  const [capturedB64, setCapturedB64] = useState<string | null>(null);
  const [result,      setResult]      = useState<ScanResult | null>(null);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [countdown,   setCountdown]   = useState(0);
  const [kioskInfo,   setKioskInfo]   = useState({ name: 'Main Entrance', gate: 'Gate 1' });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Handle camera errors
  const handleCameraError = (error: any) => {
    console.error('📷 Camera error:', error);
    if (error.name === 'NotAllowedError') {
      setCameraError('Camera permission denied. Please allow camera access in browser settings.');
    } else if (error.name === 'NotFoundError') {
      setCameraError('No camera found on this device.');
    } else if (error.name === 'NotReadableError') {
      setCameraError('Camera is being used by another application.');
    } else {
      setCameraError('Failed to access camera: ' + error.message);
    }
  };

  // Handle camera ready
  const handleCameraReady = () => {
    console.log('✅ Camera is ready!');
    setCameraReady(true);
    setCameraError(null);
  };

  // Fetch kiosk info on mount
  useEffect(() => {
    api.get('/kiosk/list').then(r => {
      const k = r.data.find((k: any) => k.id === KIOSK_ID);
      if (k) setKioskInfo({ name: k.name || 'Main Entrance', gate: k.gate || 'Gate 1' });
    }).catch(() => {});
  }, []);

  // Auto-reset after success/error
  useEffect(() => {
    if (scanState === 'success' || scanState === 'error') {
      setCountdown(1);
      const interval = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(interval); resetAll(); return 0; }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [scanState]);

  const resetAll = () => {
    console.log('🔄 RESET CALLED - Returning to idle state');
    setScanState('idle');
    setIdentifier('');
    setCapturedB64(null);
    setResult(null);
    setErrorMsg('');
    setCountdown(0);
    stopBLEPolling();
    stopRFIDPolling();
  };

  // ── Stop RFID Polling ─────────────────────────────────────────────────
  const stopRFIDPolling = () => {
    if (rfidPollingRef.current) {
      clearInterval(rfidPollingRef.current);
      rfidPollingRef.current = null;
      console.log('⏹️  RFID polling stopped');
    }
  };

  // ── Start RFID Polling (WiFi-based ESP32) - AUTO-APPROVE ─────────────
  // Polls backend for pending RFID detections and auto-approves them
  const startRFIDPolling = () => {
    console.log('💳 Starting RFID auto-approval polling...');
    console.log('   Checking for pending RFID scans every 2 seconds');
    console.log('   Mode: AUTOMATIC APPROVAL (like QR)');
    
    const pollInterval = setInterval(async () => {
      try {
        console.log('📡 Polling /rfid/pending...');
        
        const { data } = await api.get('/rfid/pending', {
          params: { seconds: 60, kiosk_id: KIOSK_ID }
        });
        
        if (data && data.length > 0) {
          const pending = data[0];
          
          // Skip if we already processed this detection
          if (lastProcessedAttendanceRef.current === pending.id) {
            console.log('   Already displayed this detection, skipping');
            return;
          }
          
          console.log('🎯 New RFID detection found:', pending);
          console.log('⚡ AUTO-APPROVING...');
          lastProcessedAttendanceRef.current = pending.id;
          
          // Stop polling
          stopRFIDPolling();
          
          // Show processing
          setScanState('processing');
          
          // Capture photo
          const screenshot = webcamRef.current?.getScreenshot();
          const b64 = screenshot ? screenshot.split(',')[1] : null;
          setCapturedB64(b64);
          
          try {
            // Auto-approve the RFID detection
            console.log(`📤 Sending RFID auto-approval for detection ID: ${pending.id}`);
            const approvalResponse = await api.post(`/rfid/approve/${pending.id}`, {
              photo_base64: b64,
              approved_by: 'kiosk_auto',
            });
            
            console.log('✅ RFID detection AUTO-APPROVED - Attendance recorded!');
            
            // Show success screen
            setResult({
              identifier: pending.rfid_uid,
              student_name: pending.student_name,
              status: approvalResponse.data.status,
              session: approvalResponse.data.session,
              attendanceId: approvalResponse.data.attendance_id,
            });
            
            setScanState('success');
            console.log('✅ RFID auto-approved - Success screen displayed!');
          } catch (approveErr: any) {
            console.error('❌ RFID auto-approval failed');
            setErrorMsg(approveErr.response?.data?.error || 'Failed to approve attendance');
            setScanState('error');
          }
        }
      } catch (err) {
        console.error('❌ RFID polling error');
      }
    }, 2000); // Poll every 2 seconds
    
    rfidPollingRef.current = pollInterval;
  };

  // ── Start BLE Polling (WiFi-based, no USB needed) ────────────────────
  const startBLEPolling = () => {
    console.log('🔵 Starting BLE polling (WiFi mode - AUTO APPROVE)...');
    console.log('   API endpoint: /ble/pending?seconds=60');
    console.log('   Polling every 3 seconds...');
    console.log('   Mode: AUTOMATIC APPROVAL (No guard interaction needed)');
    
    // Notify backend that this kiosk started BLE scanning
    // This tells ESP32 to start scanning
    api.post('/ble/scan-status', {
      kiosk_id: KIOSK_ID,
      scanning: true
    }).then(() => {
      console.log('✅ Notified backend: BLE scanning STARTED');
      console.log('   ESP32 will now start scanning for tokens');
    }).catch(err => {
      console.error('❌ Failed to notify backend');
    });
    
    // Poll backend for PENDING BLE detections every 3 seconds
    const pollInterval = setInterval(async () => {
      try {
        console.log('📡 Polling for pending BLE detections...');
        
        // Get pending detections (last 60 seconds)
        const { data } = await api.get('/ble/pending?seconds=60');
        
        console.log('   Response:', data);
        
        if (data && data.length > 0) {
          // Found pending detection - auto-approve it!
          const pending = data[0];
          console.log('🟡 Pending BLE detection found:', pending);
          console.log('⚡ AUTO-APPROVING (no manual approval needed)...');
          
          // Stop polling
          stopBLEPolling();
          
          // Show processing state
          setScanState('processing');
          
          // Capture photo
          const screenshot = webcamRef.current?.getScreenshot();
          const b64 = screenshot ? screenshot.split(',')[1] : null;
          setCapturedB64(b64);
          
          try {
            // Automatically approve the detection
            console.log(`📤 Sending auto-approval for detection ID: ${pending.id}`);
            const approvalResponse = await api.post(`/ble/approve/${pending.id}`, {
              photo_base64: b64,
              approved_by: 'kiosk_auto',
            });
            
            console.log('✅ BLE detection AUTO-APPROVED - Attendance recorded!');
            
            // Show success screen
            setResult({
              identifier: pending.student_id,
              student_name: pending.student_name,
              status: approvalResponse.data.status,
              session: approvalResponse.data.time,
              attendanceId: approvalResponse.data.attendance_id,
            });
            setScanState('success');
            
            console.log('✅ Success state set - Success screen should show');
          } catch (approveErr: any) {
            console.error('❌ Auto-approval failed');
            setErrorMsg(approveErr.response?.data?.error || 'Failed to record attendance');
            setScanState('error');
          }
        } else {
          console.log('   No pending detections found');
        }
      } catch (err) {
        console.error('❌ Polling error');
      }
    }, 3000); // Poll every 3 seconds
    
    scanIntervalRef.current = pollInterval;
  };

  // ── Stop BLE Polling ──────────────────────────────────────────────────
  const stopBLEPolling = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Notify backend that this kiosk stopped BLE scanning
    // This tells ESP32 to stop scanning
    api.post('/ble/scan-status', {
      kiosk_id: KIOSK_ID,
      scanning: false
    }).then(() => {
      console.log('✅ Notified backend: BLE scanning STOPPED');
      console.log('   ESP32 will now stop scanning');
    }).catch(err => {
      console.error('❌ Failed to notify backend');
    });
  };

  // ── Approve BLE Detection ─────────────────────────────────────────────
  const handleApproveBLE = useCallback(async () => {
    console.log('👆 APPROVE button clicked (BLE)');
    if (!result || !result.attendanceId) {
      console.log('❌ Cannot approve - no result or attendanceId');
      return;
    }
    
    console.log('📸 Capturing photo...');
    setScanState('processing');
    
    // Capture photo
    const screenshot = webcamRef.current?.getScreenshot();
    const b64 = screenshot ? screenshot.split(',')[1] : null;
    setCapturedB64(b64);

    try {
      console.log(`📤 Sending BLE approval request for detection ID: ${result.attendanceId}`);
      const { data } = await api.post(`/ble/approve/${result.attendanceId}`, {
        photo_base64: b64,
        approved_by: 'kiosk_guard',
      });
      
      console.log('✅ BLE detection APPROVED - Attendance recorded!');
      console.log('   Setting scanState to: success');
      
      setResult({
        ...result,
        status: data.status,
        session: data.time,
        attendanceId: data.attendance_id,
      });
      setScanState('success');
      
      console.log('✅ Success state set - Success screen should show');
    } catch (err: any) {
      console.error('❌ Approval failed');
      setErrorMsg(err.response?.data?.error || 'Failed to approve attendance');
      setScanState('error');
    }
  }, [result]);

  // ── Reject BLE Detection ──────────────────────────────────────────────
  const handleRejectBLE = useCallback(async () => {
    if (!result || !result.attendanceId) return;
    
    try {
      await api.post(`/ble/reject/${result.attendanceId}`, {
        reason: 'Rejected by guard',
        rejected_by: 'kiosk_guard',
      });
      
      console.log('❌ BLE detection REJECTED');
      resetAll();  // Go back to idle state
    } catch (err) {
      console.error('Reject error');
      resetAll();
    }
  }, [result]);

  // ── Approve RFID Detection ────────────────────────────────────────────
  const handleApproveRFID = useCallback(async () => {
    console.log('👆 APPROVE button clicked (RFID)');
    if (!result || !result.attendanceId) {
      console.log('❌ Cannot approve - no result or attendanceId');
      return;
    }
    
    console.log('📸 Capturing photo...');
    setScanState('processing');
    
    // Capture photo
    const screenshot = webcamRef.current?.getScreenshot();
    const b64 = screenshot ? screenshot.split(',')[1] : null;
    setCapturedB64(b64);

    try {
      console.log(`📤 Sending RFID approval request for detection ID: ${result.attendanceId}`);
      const { data } = await api.post(`/rfid/approve/${result.attendanceId}`, {
        photo_base64: b64,
        approved_by: 'kiosk_guard',
      });
      
      console.log('✅ RFID detection APPROVED:', data);
      
      setResult({
        ...result,
        status: data.status,
        session: data.session,
        attendanceId: data.attendance_id,
      });
      setScanState('success');
      
      console.log('✅ Success state set - Success screen should show');
    } catch (err: any) {
      console.error('❌ RFID approval failed');
      setErrorMsg(err.response?.data?.error || 'Failed to approve attendance');
      setScanState('error');
    }
  }, [result]);

  // ── Reject RFID Detection ─────────────────────────────────────────────
  const handleRejectRFID = useCallback(async () => {
    if (!result || !result.attendanceId) return;
    
    try {
      await api.post(`/rfid/reject/${result.attendanceId}`, {
        reason: 'Rejected by guard',
        rejected_by: 'kiosk_guard',
      });
      
      console.log('❌ RFID detection REJECTED');
      resetAll();  // Go back to idle state
    } catch (err) {
      console.error('Reject error');
      resetAll();
    }
  }, [result]);

  // ── Confirm and submit attendance ─────────────────────────────────────
  const handleConfirm = useCallback(async (scanData: string) => {
    if (!scanData && !identifier) return;
    const dataToUse = scanData || identifier;
    
    setScanState('processing');

    // Capture photo
    const screenshot = webcamRef.current?.getScreenshot();
    const b64 = screenshot ? screenshot.split(',')[1] : null;
    setCapturedB64(b64);

    try {
      const { data } = await api.post('/kiosk/scan', {
        scan_method:  method,
        identifier:   dataToUse,
        kiosk_id:     KIOSK_ID,
        photo_base64: b64,
      });
      setResult(data);
      setScanState('success');
    } catch (err: any) {
      if (err.response?.status === 409) {
        setResult({
          identifier: dataToUse,
          student_name: err.response.data.student_name || '',
          status: err.response.data.status
        });
        setErrorMsg(`Already recorded: ${err.response.data.student_name} — ${err.response.data.status}`);
      } else {
        setErrorMsg(err.response?.data?.error || 'Failed to record attendance');
      }
      setScanState('error');
    }
  }, [identifier, method]);

  // ── Start scanning based on method ──────────────────────────────────
  const startScanning = useCallback((scanMethod: ScanMethod) => {
    if (scanState !== 'idle') return;
    
    console.log(`🎯 Starting scan for method: ${scanMethod}`);
    
    if (scanMethod === 'QR') {
      setScanState('scanning');
      scanIntervalRef.current = setInterval(() => {
        if (!webcamRef.current) return;
        const video = webcamRef.current.video;
        if (!video || video.readyState !== 4) return;

        const canvas = document.createElement('canvas');
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code?.data) {
          clearInterval(scanIntervalRef.current!);
          // Extract LRN from QR JSON payload
          let lrnToSubmit = code.data;
          try {
            const payload = JSON.parse(code.data);
            lrnToSubmit = payload.lrn || code.data;
            setIdentifier(lrnToSubmit);
          } catch {
            setIdentifier(code.data);
          }
          // AUTOMATIC SUBMISSION - No confirm needed!
          handleConfirm(lrnToSubmit);
        }
      }, 250);
    } else if (scanMethod === 'RFID') {
      console.log('💳 RFID mode - AUTO-APPROVE (like QR)');
      setScanState('scanning');
      // Start polling for PENDING RFID detections and auto-approve
      startRFIDPolling();
      // Keyboard RFID will also auto-approve (see keyboard listener)
    } else if (scanMethod === 'BLE') {
      console.log('🔵 BLE mode - AUTO-APPROVE (like QR)');
      setScanState('scanning');
      // Start polling for PENDING BLE detections and auto-approve
      startBLEPolling();
    }
  }, [scanState, handleConfirm]);

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (rfidPollingRef.current) clearInterval(rfidPollingRef.current);
    };
  }, []);

  // ── RFID/QR Scanner keyboard emulation ───────────────────────────────
  // Both RFID readers and USB QR scanners work the same way (keyboard emulation)
  useEffect(() => {
    if ((method !== 'RFID' && method !== 'QR') || scanState !== 'scanning') return;

    console.log(`⌨️  Keyboard listener activated for ${method} mode`);

    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        const scannedData = rfidBufferRef.current.trim();
        rfidBufferRef.current = '';
        if (rfidTimerRef.current) clearTimeout(rfidTimerRef.current);
        
        if (scannedData) {
          console.log(`✅ ${method} scanned via keyboard:`, scannedData);
          
          // Stop WiFi polling if active (keyboard input takes priority)
          stopRFIDPolling();
          
          // Check if it's JSON (QR code) or plain string (RFID)
          let identifierToSubmit = scannedData;
          try {
            const parsed = JSON.parse(scannedData);
            // If it's QR code JSON, extract LRN
            identifierToSubmit = parsed.lrn || scannedData;
            console.log('   Extracted LRN from QR:', identifierToSubmit);
          } catch {
            // Plain string (RFID UID or simple QR)
            identifierToSubmit = scannedData.toUpperCase();
            console.log('   RFID UID:', identifierToSubmit);
          }
          
          console.log(`📤 Submitting ${method} attendance (keyboard mode)`);
          setIdentifier(identifierToSubmit);
          handleConfirm(identifierToSubmit);
        }
        return;
      }
      if (e.key.length === 1) {
        rfidBufferRef.current += e.key;
        if (rfidTimerRef.current) clearTimeout(rfidTimerRef.current);
        rfidTimerRef.current = setTimeout(() => { rfidBufferRef.current = ''; }, 200);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      console.log(`⌨️  Keyboard listener deactivated`);
      window.removeEventListener('keydown', handleKey);
      if (rfidTimerRef.current) clearTimeout(rfidTimerRef.current);
    };
  }, [method, scanState, handleConfirm]);

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: theme.colors.neutral[800],
      overflow: 'hidden',
    }}>
      {/* Top Header Bar - Professional Blue theme */}
      <Box sx={{
        background: theme.colors.primary.gradient,
        color: '#fff',
        px: { xs: 1.5, sm: 2, md: 3 },
        py: { xs: 1, sm: 1.5 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: theme.shadows.elevation3,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}>
        {/* Left: Time */}
        <Typography sx={{ 
          fontSize: { xs: '0.85rem', sm: '0.95rem', md: '1rem' },
          fontWeight: theme.typography.fontWeight.semibold, 
          fontFamily: theme.typography.fontFamily.mono,
          minWidth: { xs: '70px', sm: '80px' },
        }}>
          {format(new Date(), 'h:mm a').toUpperCase()}
        </Typography>

        {/* Center: Branding */}
        <Box textAlign="center" sx={{ flex: isMobile ? '1 1 100%' : '0 0 auto', order: isMobile ? 3 : 2 }}>
          <Typography sx={{ 
            fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
            fontWeight: theme.typography.fontWeight.extrabold, 
            fontFamily: theme.typography.fontFamily.display,
            letterSpacing: '0.05em',
          }}>
            AttendBox
          </Typography>
        </Box>

        {/* Right: Location & Status Icons */}
        <Box display="flex" alignItems="center" gap={{ xs: 1, sm: 1.5, md: 2 }} sx={{ order: isMobile ? 2 : 3 }}>
          <Typography sx={{ 
            fontSize: { xs: '0.7rem', sm: '0.85rem', md: '0.95rem' },
            fontWeight: theme.typography.fontWeight.medium,
            fontFamily: theme.typography.fontFamily.primary,
            display: { xs: 'none', sm: 'block' },
          }}>
            {SCHOOL_NAME} — {kioskInfo.gate}
          </Typography>
          {/* Mobile: Only show gate name */}
          <Typography sx={{ 
            fontSize: '0.75rem',
            fontWeight: theme.typography.fontWeight.medium,
            fontFamily: theme.typography.fontFamily.primary,
            display: { xs: 'block', sm: 'none' },
          }}>
            {kioskInfo.gate}
          </Typography>
          <Box display="flex" gap={0.5}>
            <Wifi sx={{ fontSize: { xs: 16, sm: 18, md: 20 }, opacity: 0.9 }} />
            <SignalCellularAlt sx={{ fontSize: { xs: 16, sm: 18, md: 20 }, opacity: 0.9 }} />
          </Box>
        </Box>
      </Box>

      {/* Main Content - Split Screen on Desktop, Stacked on Mobile */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' }, // Stack on mobile, side-by-side on desktop
        overflow: 'hidden',
      }}>
        
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* LEFT PANEL (TOP on mobile) - Clock & Camera */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Box sx={{
          width: { xs: '100%', md: '50%' },
          height: { xs: '50%', md: '100%' }, // Half height on mobile, full on desktop
          bgcolor: theme.colors.neutral[800],
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          p: { xs: 2, sm: 3, md: 4 },
          borderRight: { xs: 'none', md: `2px solid ${theme.colors.neutral[700]}` },
          borderBottom: { xs: `2px solid ${theme.colors.neutral[700]}`, md: 'none' },
        }}>
          {/* Live Clock */}
          {scanState === 'idle' && <LiveClock />}

          {/* Camera Preview Box */}
          <Box sx={{
            width: '100%',
            height: '100%',  // Fill entire height
            maxWidth: 'none',  // Remove width limit - fill entire space!
            bgcolor: theme.colors.neutral[900],
            border: `3px dashed ${theme.colors.neutral[600]}`,
            borderRadius: theme.borderRadius.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: theme.shadows.elevation2,
          }}>
            {/* Webcam for scanning and photo capture - ALWAYS VISIBLE */}
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ 
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }}
              onUserMedia={handleCameraReady}
              onUserMediaError={handleCameraError}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                // Hide webcam when showing captured photo
                display: (scanState === 'success' && capturedB64) ? 'none' : 'block',
              }}
            />

            {/* Camera Loading Overlay */}
            {!cameraReady && !cameraError && (
              <Box sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.8)',
                color: '#fff',
              }}>
                <CircularProgress size={60} sx={{ color: theme.colors.primary.light, mb: 2 }} />
                <Typography sx={{ 
                  fontSize: '1.1rem', 
                  fontWeight: theme.typography.fontWeight.semibold,
                  fontFamily: theme.typography.fontFamily.primary,
                }}>
                  Starting camera...
                </Typography>
                <Typography sx={{ 
                  fontSize: '0.9rem', 
                  color: theme.colors.neutral[400],
                  mt: 1,
                  fontFamily: theme.typography.fontFamily.primary,
                }}>
                  Please allow camera access if prompted
                </Typography>
              </Box>
            )}

            {/* Camera Error Overlay */}
            {cameraError && (
              <Box sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.9)',
                color: '#fff',
                p: 3,
              }}>
                <ErrorOutline sx={{ fontSize: 80, color: theme.colors.status.error.main, mb: 2 }} />
                <Typography sx={{ 
                  fontSize: '1.2rem', 
                  fontWeight: theme.typography.fontWeight.bold,
                  fontFamily: theme.typography.fontFamily.primary,
                  color: theme.colors.status.error.main,
                  mb: 2,
                  textAlign: 'center',
                }}>
                  Camera Access Error
                </Typography>
                <Typography sx={{ 
                  fontSize: '0.95rem', 
                  fontFamily: theme.typography.fontFamily.primary,
                  textAlign: 'center',
                  maxWidth: '400px',
                  mb: 3,
                }}>
                  {cameraError}
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => window.location.reload()}
                  sx={{
                    bgcolor: theme.colors.primary.main,
                    '&:hover': { bgcolor: theme.colors.primary.dark },
                  }}
                >
                  Reload Page
                </Button>
              </Box>
            )}

            {/* Success Photo Display */}
            {scanState === 'success' && capturedB64 && (
              <Fade in timeout={500}>
                <img
                  src={`data:image/jpeg;base64,${capturedB64}`}
                  alt="captured"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Fade>
            )}
          </Box>
        </Box>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* RIGHT PANEL (BOTTOM on mobile) - Controls */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Box sx={{
          width: { xs: '100%', md: '50%' },
          height: { xs: '50%', md: '100%' }, // Half height on mobile, full on desktop
          bgcolor: theme.colors.neutral[700],
          display: 'flex',
          flexDirection: 'column',
          p: { xs: 2, sm: 3, md: 4 },
          overflowY: 'auto', // Allow scrolling on mobile if content is too long
        }}>
          
          {/* ─────────────────────────────────────────────────────── */}
          {/* IDLE STATE - Method Selection */}
          {/* ─────────────────────────────────────────────────────── */}
          {scanState === 'idle' && (
            <Fade in timeout={300}>
              <Box>
                <Typography sx={{
                  fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
                  fontFamily: theme.typography.fontFamily.display,
                  fontWeight: theme.typography.fontWeight.semibold,
                  color: '#fff',
                  mb: { xs: 2, md: 3 },
                  textAlign: 'center',
                }}>
                  Select your attendance method
                </Typography>

                {/* Method Buttons */}
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' }, // Stack on mobile, row on tablet+
                  gap: 2, 
                  mb: { xs: 2, md: 4 },
                }}>
                  {/* RFID Card Button - FIRST */}
                  <Button
                    onClick={() => { 
                      console.log('🔘 RFID button clicked');
                      setMethod('RFID'); 
                      startScanning('RFID'); 
                    }}
                    sx={{
                      flex: 1,
                      py: { xs: 2, sm: 2.5, md: 3 },
                      bgcolor: method === 'RFID' ? theme.colors.primary.light : theme.colors.neutral[600],
                      color: method === 'RFID' ? '#fff' : theme.colors.neutral[200],
                      border: method === 'RFID' ? `3px solid ${theme.colors.primary.main}` : `2px solid ${theme.colors.neutral[500]}`,
                      borderRadius: theme.borderRadius.md,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      fontFamily: theme.typography.fontFamily.primary,
                      boxShadow: method === 'RFID' ? theme.shadows.elevation3 : theme.shadows.elevation1,
                      '&:hover': {
                        bgcolor: method === 'RFID' ? theme.colors.primary[400] : theme.colors.neutral[500],
                        transform: 'translateY(-4px)',
                        boxShadow: theme.shadows.hoverLift,
                      },
                      transition: theme.transitions.button,
                    }}
                  >
                    <CreditCard sx={{ fontSize: { xs: 36, sm: 42, md: 48 } }} />
                    <Typography sx={{ 
                      fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
                      fontWeight: theme.typography.fontWeight.bold,
                      fontFamily: theme.typography.fontFamily.primary,
                    }}>
                      RFID card
                    </Typography>
                  </Button>

                  {/* QR Code Button - MIDDLE */}
                  <Button
                    onClick={() => { 
                      console.log('🔘 QR button clicked');
                      setMethod('QR'); 
                      startScanning('QR'); 
                    }}
                    sx={{
                      flex: 1,
                      py: { xs: 2, sm: 2.5, md: 3 },
                      bgcolor: method === 'QR' ? theme.colors.primary.light : theme.colors.neutral[600],
                      color: method === 'QR' ? '#fff' : theme.colors.neutral[200],
                      border: method === 'QR' ? `3px solid ${theme.colors.primary.main}` : `2px solid ${theme.colors.neutral[500]}`,
                      borderRadius: theme.borderRadius.md,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      fontFamily: theme.typography.fontFamily.primary,
                      boxShadow: method === 'QR' ? theme.shadows.elevation3 : theme.shadows.elevation1,
                      '&:hover': {
                        bgcolor: method === 'QR' ? theme.colors.primary[400] : theme.colors.neutral[500],
                        transform: 'translateY(-4px)',
                        boxShadow: theme.shadows.hoverLift,
                      },
                      transition: theme.transitions.button,
                    }}
                  >
                    <QrCodeScanner sx={{ fontSize: { xs: 36, sm: 42, md: 48 } }} />
                    <Typography sx={{ 
                      fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
                      fontWeight: theme.typography.fontWeight.bold,
                      fontFamily: theme.typography.fontFamily.primary,
                    }}>
                      QR code
                    </Typography>
                  </Button>

                  {/* BLE Token Button - LAST */}
                  <Button
                    onClick={() => { 
                      console.log('🔘 BLE button clicked');
                      setMethod('BLE'); 
                      startScanning('BLE'); 
                    }}
                    sx={{
                      flex: 1,
                      py: { xs: 2, sm: 2.5, md: 3 },
                      bgcolor: method === 'BLE' ? theme.colors.primary.light : theme.colors.neutral[600],
                      color: method === 'BLE' ? '#fff' : theme.colors.neutral[200],
                      border: method === 'BLE' ? `3px solid ${theme.colors.primary.main}` : `2px solid ${theme.colors.neutral[500]}`,
                      borderRadius: theme.borderRadius.md,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      fontFamily: theme.typography.fontFamily.primary,
                      boxShadow: method === 'BLE' ? theme.shadows.elevation3 : theme.shadows.elevation1,
                      '&:hover': {
                        bgcolor: method === 'BLE' ? theme.colors.primary[400] : theme.colors.neutral[500],
                        transform: 'translateY(-4px)',
                        boxShadow: theme.shadows.hoverLift,
                      },
                      transition: theme.transitions.button,
                    }}
                  >
                    <Bluetooth sx={{ fontSize: { xs: 36, sm: 42, md: 48 } }} />
                    <Typography sx={{ 
                      fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
                      fontWeight: theme.typography.fontWeight.bold,
                      fontFamily: theme.typography.fontFamily.primary,
                    }}>
                      BLE token
                    </Typography>
                  </Button>
                </Box>
              </Box>
            </Fade>
          )}

          {/* ─────────────────────────────────────────────────────── */}
          {/* SCANNING STATE */}
          {/* ─────────────────────────────────────────────────────── */}
          {scanState === 'scanning' && (
            <Slide direction="up" in timeout={300}>
              <Box sx={{ textAlign: 'center', mt: { xs: 3, md: 8 } }}>
                <Box sx={{
                  width: '100%',
                  p: { xs: 3, sm: 4, md: 6 },
                  bgcolor: theme.colors.neutral[800],
                  border: `3px dashed ${theme.colors.primary.main}`,
                  borderRadius: theme.borderRadius.lg,
                  mb: { xs: 2, md: 4 },
                  boxShadow: theme.shadows.elevation2,
                }}>
                  {method === 'RFID' && <CreditCard sx={{ fontSize: { xs: 60, sm: 70, md: 80 }, color: theme.colors.primary.light, mb: 2 }} />}
                  {method === 'QR' && <QrCodeScanner sx={{ fontSize: { xs: 60, sm: 70, md: 80 }, color: theme.colors.primary.light, mb: 2 }} />}
                  {method === 'BLE' && <Bluetooth sx={{ fontSize: { xs: 60, sm: 70, md: 80 }, color: theme.colors.primary.light, mb: 2 }} />}
                  
                  <Typography sx={{ 
                    fontSize: { xs: '1rem', sm: '1.2rem', md: '1.3rem' },
                    fontFamily: theme.typography.fontFamily.primary,
                    fontWeight: theme.typography.fontWeight.semibold, 
                    color: '#fff', 
                    mb: 1 
                  }}>
                    {method === 'RFID' && '💳 Tap RFID card'}
                    {method === 'QR' && '📱 Scan QR code with scanner or show to camera'}
                    {method === 'BLE' && '📡 Searching for BLE token...'}
                  </Typography>
                  
                  {(method === 'RFID' || method === 'QR' || method === 'BLE') && (
                    <Typography sx={{ 
                      fontSize: { xs: '0.85rem', sm: '0.95rem', md: '1rem' },
                      color: theme.colors.secondary.light, 
                      mt: 2, 
                      fontFamily: theme.typography.fontFamily.primary,
                      fontWeight: theme.typography.fontWeight.bold 
                    }}>
                      ⚡ Attendance will be recorded automatically
                    </Typography>
                  )}
                </Box>

                <Button
                  variant="contained"
                  size={isMobile ? 'medium' : 'large'}
                  onClick={resetAll}
                  sx={{
                    bgcolor: theme.colors.status.error.main,
                    color: '#fff',
                    px: { xs: 4, md: 6 },
                    py: { xs: 1.2, md: 1.5 },
                    fontSize: { xs: '0.95rem', md: '1.1rem' },
                    fontWeight: theme.typography.fontWeight.bold,
                    fontFamily: theme.typography.fontFamily.primary,
                    borderRadius: theme.borderRadius.base,
                    boxShadow: theme.shadows.elevation2,
                    textTransform: 'none',
                    '&:hover': { 
                      bgcolor: theme.colors.status.error.dark,
                      boxShadow: theme.shadows.elevation3,
                      transform: 'translateY(-2px)',
                    },
                    transition: theme.transitions.button,
                  }}
                >
                  ✕ Cancel
                </Button>
              </Box>
            </Slide>
          )}

          {/* ─────────────────────────────────────────────────────── */}
          {/* PROCESSING STATE - Approval Screen for BLE & RFID */}
          {/* ─────────────────────────────────────────────────────── */}
          {scanState === 'processing' && result && result.status === 'PENDING_APPROVAL' && (
            <Box sx={{ textAlign: 'center', mt: 6 }}>
              <Box sx={{
                width: '100%',
                p: 4,
                bgcolor: theme.colors.neutral[800],
                border: `3px solid ${theme.colors.status.warning.main}`,
                borderRadius: theme.borderRadius.lg,
                mb: 4,
                boxShadow: theme.shadows.elevation3,
              }}>
                {method === 'BLE' && <Bluetooth sx={{ fontSize: 80, color: theme.colors.status.warning.main, mb: 2 }} />}
                {method === 'RFID' && <CreditCard sx={{ fontSize: 80, color: theme.colors.status.warning.main, mb: 2 }} />}
                
                <Typography sx={{ 
                  fontSize: '2rem', 
                  fontFamily: theme.typography.fontFamily.display,
                  fontWeight: theme.typography.fontWeight.bold, 
                  color: '#fff', 
                  mb: 1 
                }}>
                  {method === 'BLE' && 'BLE Detection'}
                  {method === 'RFID' && 'RFID Detection'}
                </Typography>
                
                <Typography sx={{ 
                  fontSize: '2.5rem', 
                  fontFamily: theme.typography.fontFamily.display,
                  fontWeight: theme.typography.fontWeight.extrabold, 
                  color: theme.colors.status.warning.main, 
                  mb: 2 
                }}>
                  {result.student_name}
                </Typography>
                
                <Typography sx={{ 
                  fontSize: '1.2rem', 
                  fontFamily: theme.typography.fontFamily.primary,
                  color: theme.colors.neutral[400], 
                  mb: 3 
                }}>
                  {result.session}
                </Typography>

                <Divider sx={{ my: 3, borderColor: theme.colors.neutral[600] }} />

                <Typography sx={{ 
                  fontSize: '1.3rem', 
                  fontFamily: theme.typography.fontFamily.primary,
                  fontWeight: theme.typography.fontWeight.semibold, 
                  color: '#fff', 
                  mb: 4 
                }}>
                  Approve attendance?
                </Typography>

                {/* Approve/Reject Buttons */}
                <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={method === 'BLE' ? handleApproveBLE : handleApproveRFID}
                    sx={{
                      background: theme.colors.status.success.main,
                      px: 6,
                      py: 2,
                      fontSize: '1.3rem',
                      fontFamily: theme.typography.fontFamily.primary,
                      fontWeight: theme.typography.fontWeight.bold,
                      minWidth: 200,
                      borderRadius: theme.borderRadius.button,
                      boxShadow: theme.shadows.elevation2,
                      '&:hover': { 
                        bgcolor: theme.colors.status.success.dark,
                        transform: 'translateY(-2px)',
                        boxShadow: theme.shadows.elevation3,
                      },
                      transition: theme.transitions.button,
                    }}
                  >
                    ✓ APPROVE
                  </Button>

                  <Button
                    variant="outlined"
                    size="large"
                    onClick={method === 'BLE' ? handleRejectBLE : handleRejectRFID}
                    sx={{
                      color: theme.colors.status.error.main,
                      borderColor: theme.colors.status.error.main,
                      borderWidth: 2,
                      px: 6,
                      py: 2,
                      fontSize: '1.3rem',
                      fontFamily: theme.typography.fontFamily.primary,
                      fontWeight: theme.typography.fontWeight.bold,
                      minWidth: 200,
                      borderRadius: theme.borderRadius.button,
                      '&:hover': { 
                        borderColor: theme.colors.status.error.dark, 
                        bgcolor: `${theme.colors.status.error.main}15`,
                        borderWidth: 2,
                      },
                      transition: theme.transitions.button,
                    }}
                  >
                    ✗ REJECT
                  </Button>
                </Box>
              </Box>
            </Box>
          )}

          {/* ─────────────────────────────────────────────────────── */}
          {/* PROCESSING STATE - Loading (Non-BLE or after approval) */}
          {/* ─────────────────────────────────────────────────────── */}
          {scanState === 'processing' && (!result || result.status !== 'PENDING_APPROVAL') && (
            <Box sx={{ textAlign: 'center', mt: 10 }}>
              <CircularProgress size={80} thickness={3} sx={{ color: theme.colors.primary.light, mb: 3 }} />
              <Typography sx={{ 
                fontSize: '1.5rem', 
                fontFamily: theme.typography.fontFamily.primary,
                fontWeight: theme.typography.fontWeight.semibold, 
                color: '#fff' 
              }}>
                Processing attendance...
              </Typography>
              <Typography sx={{ 
                fontSize: '1rem', 
                fontFamily: theme.typography.fontFamily.primary,
                color: theme.colors.neutral[400], 
                mt: 1 
              }}>
                Please wait while we verify your information
              </Typography>
            </Box>
          )}

          {/* ─────────────────────────────────────────────────────── */}
          {/* SUCCESS STATE */}
          {/* ─────────────────────────────────────────────────────── */}
          {scanState === 'success' && result && (
            <Fade in timeout={500}>
              <Box sx={{ textAlign: 'center', mt: 6 }}>
                <CheckCircle sx={{ fontSize: 120, color: theme.colors.status.success.main, mb: 2 }} />
                <Typography sx={{ 
                  fontSize: '2.5rem', 
                  fontFamily: theme.typography.fontFamily.display,
                  fontWeight: theme.typography.fontWeight.extrabold, 
                  color: theme.colors.status.success.main, 
                  mb: 1 
                }}>
                  Attendance Recorded!
                </Typography>
                <Typography sx={{ 
                  fontSize: '2rem', 
                  fontFamily: theme.typography.fontFamily.display,
                  fontWeight: theme.typography.fontWeight.bold, 
                  color: '#fff', 
                  mb: 3 
                }}>
                  {result.student_name}
                </Typography>
                <Box sx={{
                  ...theme.components.badge.success,
                  display: 'inline-block',
                  px: 4,
                  py: 1.5,
                  fontSize: '1.3rem',
                  mb: 3,
                }}>
                  {result.status || 'Time-In'}
                </Box>
                <Typography sx={{ 
                  fontSize: '1.1rem', 
                  fontFamily: theme.typography.fontFamily.primary,
                  color: theme.colors.neutral[400], 
                  mb: 4 
                }}>
                  📱 SMS notification sent to parent
                </Typography>
                <Typography sx={{ 
                  fontSize: '1.3rem', 
                  fontFamily: theme.typography.fontFamily.primary,
                  fontWeight: theme.typography.fontWeight.semibold, 
                  color: '#fff' 
                }}>
                  Resetting in {countdown}s...
                </Typography>
              </Box>
            </Fade>
          )}

          {/* ─────────────────────────────────────────────────────── */}
          {/* ERROR STATE */}
          {/* ─────────────────────────────────────────────────────── */}
          {scanState === 'error' && (
            <Fade in timeout={500}>
              <Box sx={{ textAlign: 'center', mt: 6 }}>
                <ErrorOutline sx={{ fontSize: 100, color: theme.colors.status.error.main, mb: 2 }} />
                <Typography sx={{ 
                  fontSize: '2rem', 
                  fontFamily: theme.typography.fontFamily.display,
                  fontWeight: theme.typography.fontWeight.bold, 
                  color: theme.colors.status.error.main, 
                  mb: 2 
                }}>
                  {errorMsg.includes('Already') ? 'Already Recorded' : 'Scan Failed'}
                </Typography>
                <Alert
                  severity="error"
                  sx={{
                    mb: 3,
                    fontSize: '1.1rem',
                    fontFamily: theme.typography.fontFamily.primary,
                    bgcolor: theme.colors.status.error.light,
                    color: theme.colors.status.error.dark,
                    border: `2px solid ${theme.colors.status.error.main}`,
                    borderRadius: theme.borderRadius.base,
                  }}
                >
                  {errorMsg}
                </Alert>
                <Typography sx={{ fontSize: '1.2rem', color: '#aaa', mb: 3 }}>
                  Resetting in {countdown}s...
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={resetAll}
                  sx={{
                    bgcolor: '#3b82f6',
                    px: 6,
                    py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    '&:hover': { bgcolor: '#094066' },
                  }}
                >
                  Try Again
                </Button>
              </Box>
            </Fade>
          )}

        </Box>
      </Box>
    </Box>
  );
}
