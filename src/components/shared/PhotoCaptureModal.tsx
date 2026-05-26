import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog, DialogContent, Box, Typography, LinearProgress,
} from '@mui/material';
import Webcam from 'react-webcam';

interface Props {
  open:           boolean;
  studentName:    string;
  onCaptureDone:  (base64?: string) => void;
}

export default function PhotoCaptureModal({ open, studentName, onCaptureDone }: Props) {
  const webcamRef        = useRef<Webcam>(null);
  const [countdown, setCountdown] = useState(7);

  const capture = useCallback(() => {
    const screenshot = webcamRef.current?.getScreenshot();
    const base64     = screenshot?.split(',')[1];
    onCaptureDone(base64);
  }, [onCaptureDone]);

  useEffect(() => {
    if (!open) return;
    setCountdown(7);

    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          capture();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, capture]);

  return (
    <Dialog open={open} fullScreen
      PaperProps={{ sx: { bgcolor: '#0b4d79' } }}>
      <DialogContent sx={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 2,
      }}>
        <Typography fontSize="5rem">📸</Typography>

        <Typography variant="h4" color="#28a745" fontWeight={800}>
          Attendance Recorded!
        </Typography>

        <Typography variant="h5" color="#fbc02d" fontWeight={700}>
          {studentName}
        </Typography>

        {/* Camera preview */}
        <Box sx={{ width: '100%', maxWidth: 500, borderRadius: 2, overflow: 'hidden' }}>
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width="100%"
            mirrored
            style={{ borderRadius: 8 }}
          />
        </Box>

        <Typography color="white" variant="h6">
          Please smile for the photo! 😊
        </Typography>

        <Typography variant="h3" color="#fbc02d" fontWeight={800}>
          {countdown > 0 ? countdown : '📸'}
        </Typography>

        <LinearProgress
          variant="determinate"
          value={((7 - countdown) / 7) * 100}
          sx={{
            width: '60%', height: 10, borderRadius: 5,
            bgcolor: 'rgba(255,255,255,0.2)',
            '& .MuiLinearProgress-bar': { bgcolor: '#28a745' },
          }}
        />
      </DialogContent>
    </Dialog>
  );
}