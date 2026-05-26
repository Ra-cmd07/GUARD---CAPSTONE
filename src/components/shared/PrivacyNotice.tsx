import {
  Box, Typography, Button, Paper,
} from '@mui/material';
import { QrCodeScanner, CameraAlt, Storage, VerifiedUser } from '@mui/icons-material';

interface Props { onAccept: () => void; }

export default function PrivacyNotice({ onAccept }: Props) {
  return (
    <Box sx={{
      position: 'fixed', inset: 0,
      background: '#0b4d79',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      p: 3,
    }}>
      <Paper elevation={0} sx={{
        width: '100%', maxWidth: 700,
        p: { xs: 3, md: 5 }, borderRadius: 3,
        textAlign: 'center',
      }}>
        <QrCodeScanner sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" fontWeight={800} color="primary" gutterBottom>
          Privacy & Camera Access Notice
        </Typography>

        <Box sx={{ textAlign: 'left', my: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { icon: <CameraAlt color="info" />, title: 'Camera Usage',
              text: 'This system uses your device camera to capture photos during attendance scanning for security and verification purposes.',
              bg: '#e3f2fd' },
            { icon: <Storage color="warning" />, title: 'Data Storage',
              text: 'Photos and attendance records are securely stored and only accessible by authorized school personnel.',
              bg: '#fff3e0' },
            { icon: <VerifiedUser color="success" />, title: 'Your Rights',
              text: 'All data is handled in compliance with data privacy regulations. Contact your school administrator for concerns.',
              bg: '#e8f5e9' },
          ].map(item => (
            <Box key={item.title} sx={{ background: item.bg, p: 2, borderRadius: 2, display: 'flex', gap: 2 }}>
              {item.icon}
              <Box>
                <Typography fontWeight={700}>{item.title}</Typography>
                <Typography variant="body2" color="text.secondary">{item.text}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Box sx={{ background: '#fff9c4', p: 2, borderRadius: 2, mb: 3, border: '2px solid #fbc02d' }}>
          <Typography variant="body2" color="#f57f17" fontWeight={600}>
            ⚠️ By continuing, you acknowledge that you have read and understood this privacy notice.
          </Typography>
        </Box>

        <Button variant="contained" color="primary" size="large" onClick={onAccept}
          sx={{ px: 5, py: 1.5, borderRadius: 50, fontWeight: 800, fontSize: '1rem' }}>
          ✅ I Understand — Continue to Dashboard
        </Button>
      </Paper>
    </Box>
  );
}