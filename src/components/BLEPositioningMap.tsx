import { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Paper, Typography, Chip, CircularProgress } from '@mui/material';
import { LocationOn, RadioButtonChecked, SignalWifi4Bar } from '@mui/icons-material';
import theme from '../theme/professionalTheme';

interface AnchorInfo {
  id: number;
  lat: number;
  lng: number;
  distance: number;
  raw_distance: number;
  rssi: number;
}

interface BLEPosition {
  lat: number;
  lng: number;
  accuracy_m: number;
  speed_mps: number;
  heading_deg: number | null;
  raw_residual_m: number;
  anchors_used: number;
  anchors: AnchorInfo[];
  zone_id: string | null;
  zone_name: string | null;
  in_zone: boolean;
  snapped: boolean;
  snap_distance_m: number | null;
  warming_up: boolean;
  timestamp: number;
  coasting?: boolean;
}

interface BLEPositioningMapProps {
  trilaterationServerUrl?: string;
  studentName?: string;
  showDiagnostics?: boolean;
}

export default function BLEPositioningMap({
  trilaterationServerUrl = 'http://localhost:8080',
  studentName,
  showDiagnostics = false,
}: BLEPositioningMapProps) {
  const [connected, setConnected] = useState(false);
  const [position, setPosition] = useState<BLEPosition | null>(null);
  const [waiting, setWaiting] = useState<{ active_anchors: number; needed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[BLE Map] Already connected');
      return;
    }

    try {
      const wsUrl = trilaterationServerUrl.replace(/^http/, 'ws') + '/ws';
      console.log('[BLE Map] Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[BLE Map] ✅ Connected to trilateration server');
        setConnected(true);
        setError(null);
        
        // Clear any pending reconnect
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[BLE Map] 📍 Received:', data.type, data);

          if (data.type === 'position') {
            setPosition(data);
            setWaiting(null);
            
            // Update iframe map if available
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                { type: 'update-position', position: data },
                trilaterationServerUrl
              );
            }
          } else if (data.type === 'waiting') {
            setWaiting({
              active_anchors: data.active_anchors,
              needed: data.needed,
            });
          }
        } catch (err) {
          console.error('[BLE Map] Failed to parse message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[BLE Map] ❌ WebSocket error:', err);
        setError('Connection error');
      };

      ws.onclose = () => {
        console.log('[BLE Map] 🔌 Disconnected from trilateration server');
        setConnected(false);
        wsRef.current = null;

        // Attempt to reconnect after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[BLE Map] 🔄 Attempting to reconnect...');
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.error('[BLE Map] Failed to connect:', err);
      setError('Failed to connect to trilateration server');
    }
  }, [trilaterationServerUrl]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return (
    <Box sx={{ position: 'relative', height: '100%', minHeight: 600 }}>
      {/* Embedded map from trilateration server */}
      <iframe
        ref={iframeRef}
        src={trilaterationServerUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: theme.borderRadius.base,
        }}
        title="BLE Positioning Map"
      />

      {/* Connection Status Overlay */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          p: 1.5,
          bgcolor: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderRadius: theme.borderRadius.base,
        }}
      >
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: connected ? theme.colors.status.success.main : theme.colors.status.error.main,
            animation: connected ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
          }}
        />
        <Typography 
          variant="caption" 
          fontWeight={theme.typography.fontWeight.semibold}
          sx={{ fontFamily: theme.typography.fontFamily.primary }}
        >
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </Typography>
        {error && (
          <Chip
            label={error}
            size="small"
            color="error"
            sx={{ fontSize: '0.65rem' }}
          />
        )}
      </Paper>

      {/* Student Name Badge */}
      {studentName && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            p: 1.5,
            bgcolor: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            borderRadius: theme.borderRadius.base,
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <LocationOn sx={{ color: theme.colors.primary.main, fontSize: 18 }} />
            <Typography 
              variant="caption" 
              fontWeight={theme.typography.fontWeight.bold}
              sx={{ fontFamily: theme.typography.fontFamily.primary }}
            >
              {studentName}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Waiting for Signal Overlay */}
      {waiting && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            p: 4,
            bgcolor: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(10px)',
            zIndex: 999,
            textAlign: 'center',
            minWidth: 300,
            borderRadius: theme.borderRadius.lg,
          }}
        >
          <CircularProgress sx={{ mb: 2, color: theme.colors.primary.main }} />
          <Typography 
            variant="h6" 
            fontWeight={theme.typography.fontWeight.bold}
            gutterBottom
            sx={{ fontFamily: theme.typography.fontFamily.display }}
          >
            Waiting for BLE Signal
          </Typography>
          <Typography 
            variant="body2" 
            color={theme.colors.neutral[600]}
            sx={{ fontFamily: theme.typography.fontFamily.primary }}
          >
            Active anchors: {waiting.active_anchors} / {waiting.needed} required
          </Typography>
          <Typography 
            variant="caption" 
            color={theme.colors.neutral[500]}
            sx={{ fontFamily: theme.typography.fontFamily.primary, display: 'block', mt: 1 }}
          >
            Position will appear when student's device is detected by at least {waiting.needed} beacons
          </Typography>
        </Paper>
      )}

      {/* Position Info Panel (Diagnostic Mode) */}
      {showDiagnostics && position && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            p: 2,
            bgcolor: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            minWidth: 250,
            maxWidth: 400,
            borderRadius: theme.borderRadius.base,
          }}
        >
          <Typography 
            variant="subtitle2" 
            fontWeight={theme.typography.fontWeight.bold}
            gutterBottom
            sx={{ fontFamily: theme.typography.fontFamily.display }}
          >
            📍 Position Diagnostics
          </Typography>

          <Box display="flex" flexDirection="column" gap={0.5}>
            <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
              <strong>Latitude:</strong> {position.lat.toFixed(7)}
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
              <strong>Longitude:</strong> {position.lng.toFixed(7)}
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
              <strong>Accuracy:</strong> ±{position.accuracy_m}m
              {position.warming_up && ' (warming up...)'}
            </Typography>
            {position.speed_mps > 0.05 && (
              <>
                <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
                  <strong>Speed:</strong> {position.speed_mps.toFixed(2)} m/s
                </Typography>
                {position.heading_deg !== null && (
                  <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
                    <strong>Heading:</strong> {position.heading_deg.toFixed(1)}°
                  </Typography>
                )}
              </>
            )}
            <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
              <strong>Anchors:</strong> {position.anchors_used} active
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
              <strong>Residual:</strong> {position.raw_residual_m.toFixed(2)}m
            </Typography>
            {position.zone_name && (
              <Box mt={0.5}>
                <Chip
                  label={position.zone_name}
                  size="small"
                  icon={<RadioButtonChecked />}
                  sx={{
                    bgcolor: position.in_zone 
                      ? theme.colors.status.success.light 
                      : theme.colors.status.warning.light,
                    color: position.in_zone 
                      ? theme.colors.status.success.dark 
                      : theme.colors.status.warning.dark,
                    fontSize: '0.7rem',
                    mt: 0.5,
                  }}
                />
                {position.snapped && position.snap_distance_m !== null && (
                  <Typography variant="caption" color={theme.colors.neutral[500]} display="block" mt={0.5}>
                    Snapped {position.snap_distance_m.toFixed(1)}m to zone edge
                  </Typography>
                )}
              </Box>
            )}
            {position.coasting && (
              <Chip
                label="Coasting (no fresh fix)"
                size="small"
                color="warning"
                sx={{ mt: 0.5, fontSize: '0.65rem' }}
              />
            )}
          </Box>

          {/* Anchor List */}
          <Box mt={1.5} pt={1.5} borderTop={`1px solid ${theme.colors.neutral[200]}`}>
            <Typography 
              variant="caption" 
              fontWeight={theme.typography.fontWeight.semibold}
              display="block" 
              mb={0.5}
              sx={{ fontFamily: theme.typography.fontFamily.primary }}
            >
              📡 Active Anchors:
            </Typography>
            {position.anchors.map((anchor) => (
              <Box 
                key={anchor.id} 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center"
                sx={{ py: 0.5 }}
              >
                <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
                  Anchor {anchor.id}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    icon={<SignalWifi4Bar />}
                    label={`${anchor.rssi} dBm`}
                    size="small"
                    sx={{
                      fontSize: '0.6rem',
                      height: 18,
                      '& .MuiChip-icon': { fontSize: 12 },
                    }}
                  />
                  <Typography variant="caption" color={theme.colors.neutral[600]}>
                    {anchor.distance.toFixed(1)}m
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
