import { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent,
  Button, CircularProgress, Chip, Alert,
} from '@mui/material';
import {
  Router, CheckCircle, Warning, Error as ErrorIcon,
  Wifi, WifiOff,
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../api/client';

interface Kiosk {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'stale' | 'offline' | 'unknown';
  last_heartbeat: string | null;
  ip_address?: string;
}

export default function KiosksPage() {
  const [loading, setLoading] = useState(true);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [pinging, setPinging] = useState<{ [key: string]: boolean }>({});

  const loadKiosks = async () => {
    try {
      const { data } = await api.get('/kiosks');
      setKiosks(data || []);
    } catch (err) {
      console.error('Failed to load kiosks:', err);
      // Show sample data if backend not ready
      setKiosks([
        {
          id: 'kiosk-1',
          name: 'Main Entrance',
          location: 'Building A',
          status: 'stale',
          last_heartbeat: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
          ip_address: '192.168.1.100',
        },
        {
          id: 'kiosk-2',
          name: 'Back Entrance',
          location: 'Building B',
          status: 'unknown',
          last_heartbeat: null,
          ip_address: '192.168.1.101',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKiosks();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadKiosks, 30000);
    return () => clearInterval(interval);
  }, []);

  const handlePing = async (kioskId: string) => {
    setPinging(prev => ({ ...prev, [kioskId]: true }));
    
    try {
      await api.post(`/kiosks/${kioskId}/ping`);
      // Reload kiosks after ping
      await loadKiosks();
    } catch (err) {
      console.error('Failed to ping kiosk:', err);
    } finally {
      setPinging(prev => ({ ...prev, [kioskId]: false }));
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'online':
        return {
          color: '#10b981',
          bgcolor: '#d1fae5',
          icon: <CheckCircle />,
          label: 'Online',
        };
      case 'stale':
        return {
          color: '#f59e0b',
          bgcolor: '#fef3c7',
          icon: <Warning />,
          label: 'Stale',
        };
      case 'offline':
        return {
          color: '#ef4444',
          bgcolor: '#fee2e2',
          icon: <ErrorIcon />,
          label: 'Offline',
        };
      default:
        return {
          color: '#6b7280',
          bgcolor: '#f3f4f6',
          icon: <WifiOff />,
          label: 'Unknown',
        };
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Kiosk Grid */}
      <Grid container spacing={3}>
        {kiosks.map((kiosk) => {
          const statusConfig = getStatusConfig(kiosk.status);
          
          return (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={kiosk.id}>
              <Card sx={{
                p: 2,
                height: '100%',
                borderRadius: 2,
                border: '1px solid #e5e7eb',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                },
                transition: 'all 0.3s ease',
              }}>
                <CardContent>
                  {/* Header */}
                  <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Router sx={{ 
                        color: '#3b82f6',
                        fontSize: 32,
                      }} />
                      <Box>
                        <Typography 
                          variant="h6"
                          sx={{
                            fontWeight: 700,
                            color: '#111827',
                          }}
                        >
                          {kiosk.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#6b7280',
                          }}
                        >
                          {kiosk.location}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Chip
                      icon={statusConfig.icon}
                      label={statusConfig.label}
                      size="small"
                      sx={{
                        bgcolor: statusConfig.bgcolor,
                        color: statusConfig.color,
                        fontWeight: 700,
                        border: `1px solid ${statusConfig.color}`,
                      }}
                    />
                  </Box>

                  {/* Details */}
                  <Box mb={2}>
                    {kiosk.ip_address && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#374151',
                          fontFamily: 'monospace',
                          mb: 1,
                        }}
                      >
                        IP: {kiosk.ip_address}
                      </Typography>
                    )}
                    
                    {kiosk.last_heartbeat ? (
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#6b7280',
                        }}
                      >
                        Last seen: {format(new Date(kiosk.last_heartbeat), 'MMM dd, h:mm aa')}
                      </Typography>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#9ca3af',
                          fontStyle: 'italic',
                        }}
                      >
                        Never connected
                      </Typography>
                    )}
                  </Box>

                  {/* Actions */}
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => handlePing(kiosk.id)}
                    disabled={pinging[kiosk.id]}
                    startIcon={pinging[kiosk.id] ? <CircularProgress size={16} /> : <Wifi />}
                    sx={{
                      bgcolor: '#3b82f6',
                      color: '#fff',
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: '#2563eb',
                      },
                      '&:disabled': {
                        bgcolor: '#e5e7eb',
                      }
                    }}
                  >
                    {pinging[kiosk.id] ? 'Pinging...' : 'Ping Kiosk'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Empty State */}
      {kiosks.length === 0 && (
        <Grid size={{ xs: 12 }}>
          <Alert 
          icon={<Router />}
          severity="info" 
          sx={{ 
            mt: 3,
            borderRadius: 2,
            border: '1px solid #bfdbfe',
          }}
        >
          No kiosks found. Register kiosks from the admin panel.
        </Alert>
        </Grid>
      )}

      {/* Status Legend */}
      <Paper sx={{
        p: 2,
        mt: 3,
        borderRadius: 2,
        border: '1px solid #e5e7eb',
      }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: '#111827',
            mb: 1,
          }}
        >
          Status Legend:
        </Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <Box display="flex" alignItems="center" gap={1}>
            <CheckCircle sx={{ color: '#10b981', fontSize: 18 }} />
            <Typography variant="caption" sx={{ color: '#374151' }}>
              Online (active within 5 min)
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Warning sx={{ color: '#f59e0b', fontSize: 18 }} />
            <Typography variant="caption" sx={{ color: '#374151' }}>
              Stale (5-30 min inactive)
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <ErrorIcon sx={{ color: '#ef4444', fontSize: 18 }} />
            <Typography variant="caption" sx={{ color: '#374151' }}>
              Offline (&gt;30 min inactive)
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <WifiOff sx={{ color: '#6b7280', fontSize: 18 }} />
            <Typography variant="caption" sx={{ color: '#374151' }}>
              Unknown (never connected)
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
