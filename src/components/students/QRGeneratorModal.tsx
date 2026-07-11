import { useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, Grid, Paper, Chip,
} from '@mui/material';
import { Download, Close } from '@mui/icons-material';
import { QRCodeCanvas } from 'qrcode.react';
import type { StudentForm, GuardianForm as TeacherForm } from '../../types';

interface Props {
  open:      boolean;
  onClose:   () => void;
  student:   StudentForm;
  teachers:  TeacherForm[];
}

export default function QRGeneratorModal({ open, onClose, student, teachers }: Props) {
  const qrRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const makePayload = (g: TeacherForm) => JSON.stringify({
    lrn:      student.lrn,
    student:  student.name,
    gender:   student.gender === 'Male' ? 'M' : 'F',
    role:     g.role,
    name:     g.name,
    contacts: teachers.map(gd => gd.contact_number).filter(Boolean),
  });

  const downloadQR = (role: string) => {
    const container = qrRefs.current[role];
    if (!container) return;
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const link       = document.createElement('a');
    link.download    = `QR_${student.name.replace(/\s+/g, '_')}_${role}.png`;
    link.href        = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ background: '#3b82f6', color: '#fff', fontWeight: 700 }}>
        🪪 Generated QR Codes — {student.name}
        <Button onClick={onClose} sx={{ color: '#fff', ml: 'auto', float: 'right' }}>
          <Close />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
          Each parent/teacher has a unique QR code linked to <b>{student.name}</b> (LRN: {student.lrn})
        </Typography>

        <Grid container spacing={3} justifyContent="center">
          {teachers.filter(g => g.name).map(g => (
            <Grid size={{ xs: 12, sm: 4 }} key={g.role}>
              <Paper elevation={2} sx={{
                p: 2.5, textAlign: 'center', borderRadius: 2,
                border: '2px solid #3b82f6',
              }}>
                <Chip label={g.role} color="primary" size="small" sx={{ mb: 2 }} />

                <Box
                  ref={(el: HTMLDivElement | null) => { qrRefs.current[g.role] = el; }}
                  sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}
                >
                  <QRCodeCanvas
                    value={makePayload(g)}
                    size={180}
                    level="H"
                    includeMargin
                  />
                </Box>

                <Typography fontWeight={700} gutterBottom>{g.name}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  📞 {g.contact_number || 'No contact'}
                </Typography>

                <Button variant="contained" color="primary" fullWidth
                  startIcon={<Download />}
                  onClick={() => downloadQR(g.role)}
                  size="small">
                  Download QR
                </Button>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">Close</Button>
        <Button variant="contained" color="primary"
          onClick={() => teachers.filter(g => g.name).forEach(g => {
            setTimeout(() => downloadQR(g.role), 300);
          })}>
          📥 Download All QR Codes
        </Button>
      </DialogActions>
    </Dialog>
  );
}