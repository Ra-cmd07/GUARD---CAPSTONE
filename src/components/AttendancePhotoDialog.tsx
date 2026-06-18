import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, IconButton } from '@mui/material';
import { Close, Download, ZoomIn, ZoomOut } from '@mui/icons-material';
import { useState } from 'react';
import { format } from 'date-fns';
import theme from '../theme/professionalTheme';

interface AttendancePhotoDialogProps {
  open: boolean;
  onClose: () => void;
  photoUrl: string | null;
  studentName?: string;
  status?: string;
  timestamp?: Date | string;
  method?: string;
}

export default function AttendancePhotoDialog({
  open,
  onClose,
  photoUrl,
  studentName,
  status,
  timestamp,
  method,
}: AttendancePhotoDialogProps) {
  const [zoom, setZoom] = useState(100);

  const handleDownload = () => {
    if (!photoUrl) return;
    const link = document.createElement('a');
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');
    link.href = `${baseUrl}${photoUrl}`;
    link.download = `attendance_${studentName}_${Date.now()}.jpg`;
    link.click();
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));

  if (!photoUrl) return null;

  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');
  
  // Check if photoUrl is already a full Cloudinary URL
  const fullPhotoUrl = (photoUrl && photoUrl.startsWith('http')) 
    ? photoUrl  // Use Cloudinary URL as-is
    : `${baseUrl}${photoUrl}`; // Legacy local URL

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.elevation4,
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.colors.neutral[200]}`,
        pb: 2,
      }}>
        <Box>
          <Typography 
            variant="h6" 
            sx={{
              fontFamily: theme.typography.fontFamily.display,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.neutral[900],
            }}
          >
            Attendance Photo
          </Typography>
          {studentName && (
            <Typography 
              variant="body2" 
              sx={{
                color: theme.colors.neutral[600],
                fontFamily: theme.typography.fontFamily.primary,
              }}
            >
              {studentName}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* Photo Info */}
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {status && (
            <Chip 
              label={status} 
              size="small"
              sx={{
                ...theme.components.badge[
                  status === 'Time-In' ? 'success' :
                  status === 'Late' ? 'warning' :
                  status === 'Time-Out' ? 'info' : 'error'
                ]
              }}
            />
          )}
          {method && (
            <Chip 
              label={method} 
              size="small"
              sx={{
                bgcolor: theme.colors.neutral[100],
                color: theme.colors.neutral[700],
                border: `1px solid ${theme.colors.neutral[300]}`,
                fontFamily: theme.typography.fontFamily.primary,
                fontWeight: theme.typography.fontWeight.semibold,
              }}
            />
          )}
          {timestamp && (
            <Typography 
              variant="caption" 
              sx={{
                color: theme.colors.neutral[600],
                fontFamily: theme.typography.fontFamily.primary,
              }}
            >
              📅 {format(new Date(timestamp), 'MMM d, yyyy · h:mm aa')}
            </Typography>
          )}
        </Box>

        {/* Photo Display */}
        <Box sx={{
          position: 'relative',
          width: '100%',
          height: 400,
          bgcolor: theme.colors.neutral[900],
          borderRadius: theme.borderRadius.base,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src={fullPhotoUrl}
            alt="Attendance photo"
            style={{
              width: `${zoom}%`,
              height: 'auto',
              objectFit: 'contain',
              transition: 'width 0.2s ease',
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="50%" y="50%" text-anchor="middle" fill="gray">Photo not available</text></svg>';
            }}
          />
        </Box>

        {/* Zoom Controls */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
          <IconButton onClick={handleZoomOut} disabled={zoom <= 50} size="small">
            <ZoomOut />
          </IconButton>
          <Typography 
            variant="body2" 
            sx={{
              minWidth: 60,
              textAlign: 'center',
              fontFamily: theme.typography.fontFamily.primary,
              color: theme.colors.neutral[700],
            }}
          >
            {zoom}%
          </Typography>
          <IconButton onClick={handleZoomIn} disabled={zoom >= 200} size="small">
            <ZoomIn />
          </IconButton>
        </Box>
      </DialogContent>

      <DialogActions sx={{
        borderTop: `1px solid ${theme.colors.neutral[200]}`,
        p: 2,
      }}>
        <Button 
          onClick={handleDownload} 
          startIcon={<Download />}
          sx={{
            ...theme.components.button.secondary,
          }}
        >
          Download
        </Button>
        <Button 
          onClick={onClose}
          sx={{
            ...theme.components.button.primary,
            '&:hover': theme.components.button.primary.hover,
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
