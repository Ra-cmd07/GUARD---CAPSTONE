import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import { Box, Typography, Chip, Paper } from '@mui/material';
import 'leaflet/dist/leaflet.css';
import { LocationOn, School, Person } from '@mui/icons-material';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = new Icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface CampusMapProps {
  studentLocation?: {
    location_name: string;
    coordinates: string;
    location_type: string;
    building?: string;
    floor?: string;
    minutes_ago?: number;
    location_status?: string;
  };
  beacons?: Array<{
    beacon_id: string;
    name: string;
    location_name: string;
    location_type: string;
    coordinates: string;
    building?: string;
  }>;
  studentName?: string;
}

export default function CampusMap({ studentLocation, beacons = [], studentName }: CampusMapProps) {
  const [center, setCenter] = useState<LatLngExpression>([8.4857, 124.6565]); // Default: School center
  const [zoom] = useState(17);

  useEffect(() => {
    if (studentLocation?.coordinates) {
      const [lat, lng] = studentLocation.coordinates.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        setCenter([lat, lng]);
      }
    }
  }, [studentLocation]);

  // Parse coordinates helper
  const parseCoords = (coords: string): [number, number] | null => {
    const [lat, lng] = coords.split(',').map(Number);
    return !isNaN(lat) && !isNaN(lng) ? [lat, lng] : null;
  };

  // Get marker color based on location type
  const getLocationColor = (type: string) => {
    switch (type) {
      case 'gate': return '#ef4444'; // Red
      case 'classroom': return '#3b82f6'; // Blue
      case 'cafeteria': return '#f59e0b'; // Orange
      case 'library': return '#8b5cf6'; // Purple
      case 'gym': return '#10b981'; // Green
      default: return '#6b7280'; // Gray
    }
  };

  // Student location coordinates
  const studentCoords = studentLocation?.coordinates 
    ? parseCoords(studentLocation.coordinates) 
    : null;

  return (
    <Box sx={{ position: 'relative', height: '100%', minHeight: 500 }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', borderRadius: '8px' }}
        scrollWheelZoom={true}
      >
        {/* Base map layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Student Current Location */}
        {studentCoords && (
          <>
            {/* Pulsing circle around student */}
            <Circle
              center={studentCoords}
              radius={30}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.2,
              }}
            />
            
            {/* Student marker */}
            <Marker position={studentCoords} icon={DefaultIcon}>
              <Popup>
                <Paper elevation={0} sx={{ p: 1.5, minWidth: 200 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Person sx={{ color: '#3b82f6' }} />
                    <Typography fontWeight={700} color="#1a1a1a">
                      {studentName || 'Student'}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="#666" gutterBottom>
                    📍 {studentLocation.location_name}
                  </Typography>
                  
                  {studentLocation.building && (
                    <Typography variant="caption" color="#999" display="block">
                      🏢 {studentLocation.building}
                      {studentLocation.floor && ` - ${studentLocation.floor}`}
                    </Typography>
                  )}
                  
                  <Chip
                    label={`${studentLocation.minutes_ago || 0} min ago`}
                    size="small"
                    sx={{
                      mt: 1,
                      bgcolor: studentLocation.location_status === 'active' ? '#e3f2fd' : '#f5f5f5',
                      color: studentLocation.location_status === 'active' ? '#3b82f6' : '#666',
                      fontSize: '0.7rem',
                    }}
                  />
                </Paper>
              </Popup>
            </Marker>
          </>
        )}

        {/* Beacon Locations */}
        {beacons.map((beacon) => {
          const coords = parseCoords(beacon.coordinates);
          if (!coords) return null;

          return (
            <Marker
              key={beacon.beacon_id}
              position={coords}
              icon={new Icon({
                iconUrl: `data:image/svg+xml;base64,${btoa(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="${getLocationColor(beacon.location_type)}" opacity="0.8"/>
                    <circle cx="12" cy="12" r="6" fill="white"/>
                    <circle cx="12" cy="12" r="3" fill="${getLocationColor(beacon.location_type)}"/>
                  </svg>
                `)}`,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              })}
            >
              <Popup>
                <Paper elevation={0} sx={{ p: 1.5, minWidth: 180 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <LocationOn sx={{ color: getLocationColor(beacon.location_type), fontSize: 20 }} />
                    <Typography fontWeight={700} fontSize="0.9rem" color="#1a1a1a">
                      {beacon.name}
                    </Typography>
                  </Box>
                  
                  <Typography variant="caption" color="#666" display="block" gutterBottom>
                    {beacon.location_name}
                  </Typography>
                  
                  {beacon.building && (
                    <Typography variant="caption" color="#999" display="block">
                      🏢 {beacon.building}
                    </Typography>
                  )}
                  
                  <Chip
                    label={beacon.location_type}
                    size="small"
                    sx={{
                      mt: 1,
                      bgcolor: getLocationColor(beacon.location_type),
                      color: 'white',
                      fontSize: '0.65rem',
                      textTransform: 'capitalize',
                    }}
                  />
                </Paper>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          p: 2,
          bgcolor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          minWidth: 180,
        }}
      >
        <Typography variant="caption" fontWeight={700} color="#1a1a1a" display="block" mb={1}>
          🗺️ Map Legend
        </Typography>
        
        <Box display="flex" flexDirection="column" gap={0.5}>
          {[
            { type: 'gate', label: 'Gate', color: '#ef4444' },
            { type: 'classroom', label: 'Classroom', color: '#3b82f6' },
            { type: 'cafeteria', label: 'Cafeteria', color: '#f59e0b' },
            { type: 'library', label: 'Library', color: '#8b5cf6' },
            { type: 'gym', label: 'Gymnasium', color: '#10b981' },
          ].map((item) => (
            <Box key={item.type} display="flex" alignItems="center" gap={1}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: item.color,
                }}
              />
              <Typography variant="caption" color="#666" fontSize="0.7rem">
                {item.label}
              </Typography>
            </Box>
          ))}
          
          <Box display="flex" alignItems="center" gap={1} mt={0.5} pt={0.5} borderTop="1px solid #e0e0e0">
            <Person sx={{ fontSize: 14, color: '#3b82f6' }} />
            <Typography variant="caption" color="#666" fontSize="0.7rem">
              Student Location
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Live Status Indicator */}
      {studentLocation && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            p: 1.5,
            bgcolor: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: studentLocation.location_status === 'active' ? '#22c55e' : '#f59e0b',
              animation: studentLocation.location_status === 'active' ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
          <Typography variant="caption" fontWeight={600} color="#1a1a1a">
            {studentLocation.location_status === 'active' ? '🟢 Live' : '🟡 Recent'}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
