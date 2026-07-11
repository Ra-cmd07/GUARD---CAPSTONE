import { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, CircularProgress, Alert,
  Chip, FormControlLabel, Switch,
} from '@mui/material';
import { LocationOn, Refresh, PlayArrow, Stop } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CampusMap from '../components/CampusMap';
import api from '../api/client';

interface Beacon {
  beacon_id: string;
  name: string;
  location_name: string;
  location_type: string;
  coordinates: string;
  building?: string;
}

export default function LocationTrackingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enableRealTime, setEnableRealTime] = useState(true);
  const [simulationRunning, setSimulationRunning] = useState(false);

  // Fetch beacons
  useEffect(() => {
    fetchBeacons();
  }, []);

  const fetchBeacons = async () => {
    try {
      setLoading(true);
      const res = await api.get('/location/beacons');
      setBeacons(res.data.beacons || []);
      setError('');
    } catch (err: any) {
      console.error('Error fetching beacons:', err);
      setError(err.response?.data?.error || 'Failed to load beacons');
    } finally {
      setLoading(false);
    }
  };

  // Simulate BLE updates for testing
  const startSimulation = async () => {
    setSimulationRunning(true);
    setError('');

    try {
      // Simulate location updates for a few students
      const studentIds = [1, 2, 3, 4, 5]; // Test with first 5 students
      const beaconIds = beacons.slice(0, 3).map(b => b.beacon_id); // Use first 3 beacons

      if (beaconIds.length === 0) {
        setError('No beacons available for simulation');
        setSimulationRunning(false);
        return;
      }

      // Send location updates every 3 seconds
      const interval = setInterval(async () => {
        try {
          const readings = studentIds.map(studentId => ({
            studentId,
            beaconId: beaconIds[Math.floor(Math.random() * beaconIds.length)],
            rssi: -45 - Math.random() * 30, // RSSI between -45 and -75
            macAddress: `AA:BB:CC:DD:EE:0${studentId}`,
          }));

          await api.post('/location/ble-batch', { readings });
          console.log('📍 Sent batch location update for', readings.length, 'students');
        } catch (err) {
          console.error('Simulation update failed:', err);
        }
      }, 3000);

      // Store interval ID to clear later
      (window as any).__locationSimInterval = interval;

    } catch (err: any) {
      console.error('Failed to start simulation:', err);
      setError(err.response?.data?.error || 'Failed to start simulation');
      setSimulationRunning(false);
    }
  };

  const stopSimulation = () => {
    const interval = (window as any).__locationSimInterval;
    if (interval) {
      clearInterval(interval);
      (window as any).__locationSimInterval = null;
    }
    setSimulationRunning(false);
  };

  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    navigate('/login');
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', p: 3 }}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <LocationOn sx={{ fontSize: 40, color: '#2563eb' }} />
            <Box>
              <Typography variant="h4" fontWeight={700} color="#1a1a1a">
                🗺️ Live Student Location Tracking
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time BLE-based positioning with moving dots
              </Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            onClick={() => navigate(user.role === 'admin' ? '/admin' : '/teacher')}
            color="inherit"
          >
            ← Back to Dashboard
          </Button>
        </Box>

        {/* Controls */}
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <FormControlLabel
            control={
              <Switch
                checked={enableRealTime}
                onChange={(e) => setEnableRealTime(e.target.checked)}
                color="primary"
              />
            }
            label="Enable Real-Time Tracking"
          />

          <Button
            variant="contained"
            color={simulationRunning ? 'error' : 'success'}
            startIcon={simulationRunning ? <Stop /> : <PlayArrow />}
            onClick={simulationRunning ? stopSimulation : startSimulation}
            disabled={beacons.length === 0}
          >
            {simulationRunning ? 'Stop Simulation' : 'Start Test Simulation'}
          </Button>

          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchBeacons}
          >
            Refresh Beacons
          </Button>

          <Chip
            label={`${beacons.length} Beacons Active`}
            color={beacons.length > 0 ? 'success' : 'default'}
            icon={<LocationOn />}
          />
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Info Alert */}
      {simulationRunning && (
        <Alert severity="info" sx={{ mb: 3 }}>
          📡 Simulation active: Sending location updates every 3 seconds for students 1-5
        </Alert>
      )}

      {/* Map */}
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height={500}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ height: 600 }}>
            <CampusMap
              beacons={beacons}
              enableRealTime={enableRealTime}
            />
          </Box>
        )}
      </Paper>

      {/* Instructions */}
      <Paper elevation={1} sx={{ p: 3, mt: 3, borderRadius: 2, bgcolor: '#f8fafc' }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          📖 How It Works
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          1. <strong>Enable Real-Time Tracking</strong>: Toggle the switch to activate WebSocket connection
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          2. <strong>Start Test Simulation</strong>: Click to simulate BLE location updates for 5 students
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          3. <strong>Watch the Dots Move</strong>: Student markers will update every 3 seconds based on simulated RSSI
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          4. <strong>Color Coding</strong>: Different grades have different colors. Blue circles = beacon coverage
        </Typography>
        <Typography variant="body2" color="text.secondary">
          5. <strong>Production Use</strong>: Replace simulation with actual BLE hardware sending RSSI to <code>/api/location/ble-update</code>
        </Typography>
      </Paper>
    </Box>
  );
}
