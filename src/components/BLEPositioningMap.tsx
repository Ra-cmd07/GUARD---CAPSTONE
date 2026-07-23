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
  target_id: number;  // NEW: Student identifier
  target_name: string;  // NEW: Student name
  target_color: string;  // NEW: Display color
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
  filterStudentName?: string;  // NEW: Filter to show only specific student
}

export default function BLEPositioningMap({
  trilaterationServerUrl = 'http://localhost:8080',
  studentName,
  showDiagnostics = false,
  filterStudentName,  // NEW: If provided, only show this student
}: BLEPositioningMapProps) {
  const [connected, setConnected] = useState(false);
  const [positions, setPositions] = useState<BLEPosition[]>([]);  // Changed to array
  const [waiting, setWaiting] = useState<{ active_anchors: number; needed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticsMinimized, setDiagnosticsMinimized] = useState(false);  // NEW: State for collapsible panel
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

          if (data.type === 'positions') {
            // Multi-beacon mode: array of positions
            let students = data.students || [];
            
            // Filter to show only specific student if filterStudentName is provided
            if (filterStudentName) {
              students = students.filter((s: BLEPosition) => s.target_name === filterStudentName);
            }
            
            setPositions(students);
            setWaiting(null);
            
            // Update iframe map if available - send filtered students
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                { type: 'update-positions', students: students },  // Send filtered list
                trilaterationServerUrl
              );
            }
          } else if (data.type === 'position') {
            // Single beacon mode (backward compatibility)
            setPositions([data]);
            setWaiting(null);
            
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
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 500, bgcolor: 'transparent' }}>
      {/* Embedded map from trilateration server */}
      <iframe
        ref={iframeRef}
        src={`${trilaterationServerUrl}${filterStudentName ? `?filter=${encodeURIComponent(filterStudentName)}` : ''}`}
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
      {showDiagnostics && positions.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            p: diagnosticsMinimized ? 1.5 : 2,
            bgcolor: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            minWidth: diagnosticsMinimized ? 'auto' : 250,
            maxWidth: diagnosticsMinimized ? 'auto' : 400,
            borderRadius: theme.borderRadius.base,
            transition: 'all 0.3s ease',
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={diagnosticsMinimized ? 0 : 1}>
            <Typography 
              variant="subtitle2" 
              fontWeight={theme.typography.fontWeight.bold}
              sx={{ fontFamily: theme.typography.fontFamily.display }}
            >
              📍 Position Diagnostics
            </Typography>
            <Box
              component="button"
              onClick={() => setDiagnosticsMinimized(!diagnosticsMinimized)}
              sx={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: theme.borderRadius.sm,
                fontSize: '18px',
                color: theme.colors.neutral[600],
                transition: 'background 0.2s',
                '&:hover': {
                  bgcolor: theme.colors.neutral[100],
                },
              }}
              title={diagnosticsMinimized ? 'Expand' : 'Minimize'}
            >
              {diagnosticsMinimized ? '+' : '−'}
            </Box>
          </Box>

          {!diagnosticsMinimized && positions.map((position) => (
            <Box key={position.target_id} mb={2} pb={2} borderBottom={`1px solid ${theme.colors.neutral[200]}`}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Box 
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: position.target_color,
                  }}
                />
                <Typography variant="caption" fontWeight={theme.typography.fontWeight.bold}>
                  {position.target_name}
                </Typography>
              </Box>

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
                {position.coasting && (
                  <Chip
                    label="Coasting (no fresh fix)"
                    size="small"
                    color="warning"
                    sx={{ mt: 0.5, fontSize: '0.65rem' }}
                  />
                )}
              </Box>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}
