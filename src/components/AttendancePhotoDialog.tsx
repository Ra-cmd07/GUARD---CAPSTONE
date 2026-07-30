import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, IconButton } from '@mui/material';
import { Close, Download, ZoomIn, ZoomOut } from '@mui/icons-material';
import { useState, useEffect } from 'react';
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
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset error state when photoUrl changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [photoUrl]);

  // Debug logging
  console.log('🎭 AttendancePhotoDialog props:', {
    open,
    photoUrl,
    studentName,
    status,
    timestamp,
    method
  });

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

  // Trim any whitespace from photoUrl
  const cleanPhotoUrl = photoUrl.trim();

  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', '');
  
  console.log('🔧 DEBUG baseUrl calculation:');
  console.log('   VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('   baseUrl after replace:', baseUrl);
  console.log('   photoUrl (raw):', JSON.stringify(photoUrl));
  console.log('   photoUrl (clean):', JSON.stringify(cleanPhotoUrl));
  
  // Check if photoUrl is Cloudinary URL or local path
  let fullPhotoUrl = (cleanPhotoUrl && cleanPhotoUrl.startsWith('http')) 
    ? cleanPhotoUrl  // Use Cloudinary CDN URL directly
    : `${baseUrl}${cleanPhotoUrl}`; // Local storage URL
  
  // NO cache-busting - it causes CORS issues
  // fullPhotoUrl = `${fullPhotoUrl}?t=${Date.now()}`;

  console.log('🔗 Final photo URL:', fullPhotoUrl);
  console.log('🔗 Source:', cleanPhotoUrl?.startsWith('http') ? 'Cloudinary CDN ☁️' : 'Local Storage 💾');

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
                  status === 'Time-Out' ? 'info' :
                  status === 'Excused' ? 'default' : 'error'
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
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
            onError={(e) => {
              console.error('❌ Photo failed to load!');
              console.error('   Failed URL:', (e.target as HTMLImageElement).src);
              console.error('   Original photoUrl prop:', photoUrl);
              console.error('   baseUrl:', baseUrl);
              console.error('   Error event:', e);
            }}
            onLoad={() => {
              console.log('✅ Photo loaded successfully:', fullPhotoUrl);
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
