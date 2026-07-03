import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { Icon, type LatLngExpression } from 'leaflet';
import { Box, Typography, Chip, Paper } from '@mui/material';
import 'leaflet/dist/leaflet.css';
import { LocationOn, Person } from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = new Icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface LiveStudent {
  studentId: number;
  name: string;
  section: string;
  grade: string;
  position: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  beaconName: string;
  distance: number;
  timestamp: Date;
}

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
  enableRealTime?: boolean; // Enable real-time tracking
}

// Component to handle map recenter when position updates
function MapRecenter({ position }: { position: LatLngExpression | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom(), { duration: 1 });
    }
  }, [position, map]);
  
  return null;
}

export default function CampusMap({ 
  studentLocation, 
  beacons = [], 
  studentName,
  enableRealTime = false 
}: CampusMapProps) {
  const [center, setCenter] = useState<LatLngExpression>([8.4857, 124.6565]); // Default: School center
  const [zoom] = useState(17);
  const [liveStudents, setLiveStudents] = useState<Map<number, LiveStudent>>(new Map());
  const socketRef = useRef<Socket | null>(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!enableRealTime) return;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Connected to real-time location updates');
      socket.emit('identify', { role: 'admin' });
    });

    // Single student location update
    socket.on('location:update', (data: any) => {
      const studentData: LiveStudent = {
        studentId: data.student.id,
        name: data.student.name,
        section: data.student.section,
        grade: data.student.grade,
        position: data.location.position,
        beaconName: data.location.beacon.name,
        distance: data.location.distance,
        timestamp: new Date(data.location.timestamp),
      };

      setLiveStudents(prev => {
        const updated = new Map(prev);
        updated.set(studentData.studentId, studentData);
        return updated;
      });
    });

    // Batch location update
    socket.on('location:batch', (data: any) => {
      setLiveStudents(prev => {
        const updated = new Map(prev);
        data.students.forEach((s: any) => {
          updated.set(s.studentId, {
            studentId: s.studentId,
            name: s.studentName,
            section: s.section,
            grade: s.grade,
            position: s.position,
            beaconName: s.beaconName,
            distance: s.distance,
            timestamp: new Date(s.timestamp),
          });
        });
        return updated;
      });
    });

    // Student left/removed
    socket.on('location:removed', (data: any) => {
      setLiveStudents(prev => {
        const updated = new Map(prev);
        updated.delete(data.studentId);
        return updated;
      });
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from real-time location updates');
    });

    return () => {
      socket.disconnect();
    };
  }, [enableRealTime]);

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

  // Get color by grade
  const getGradeColor = (grade: string) => {
    const gradeNum = parseInt(grade.replace(/\D/g, ''));
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    return colors[gradeNum % colors.length] || '#6b7280';
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

        <MapRecenter position={studentCoords} />

        {/* Beacon Locations (Fixed with accuracy circles) */}
        {beacons.map((beacon) => {
          const coords = parseCoords(beacon.coordinates);
          if (!coords) return null;

          return (
            <div key={beacon.beacon_id}>
              {/* Beacon accuracy radius (translucent blue circle) */}
              <Circle
                center={coords}
                radius={30} // 30 meter radius
                pathOptions={{
                  color: getLocationColor(beacon.location_type),
                  fillColor: getLocationColor(beacon.location_type),
                  fillOpacity: 0.15,
                  weight: 2,
                }}
              />
              
              {/* Beacon marker */}
              <Marker
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
            </div>
          );
        })}

        {/* Real-time Live Student Dots (Moving based on distance) */}
        {enableRealTime && Array.from(liveStudents.values()).map((student) => {
          const coords: LatLngExpression = [student.position.lat, student.position.lng];
          const color = getGradeColor(student.grade);

          return (
            <div key={`live-${student.studentId}`}>
              {/* Accuracy circle around moving dot */}
              <Circle
                center={coords}
                radius={student.position.accuracy || 10}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.1,
                  weight: 1,
                  dashArray: '5, 5',
                }}
              />
              
              {/* Moving student dot */}
              <Marker
                position={coords}
                icon={new Icon({
                  iconUrl: `data:image/svg+xml;base64,${btoa(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" fill="${color}" opacity="0.9"/>
                      <circle cx="12" cy="12" r="7" fill="white" opacity="0.8"/>
                      <circle cx="12" cy="12" r="4" fill="${color}"/>
                      <circle cx="12" cy="12" r="11" fill="none" stroke="${color}" stroke-width="2" opacity="0.4">
                        <animate attributeName="r" from="11" to="15" dur="2s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite"/>
                      </circle>
                    </svg>
                  `)}`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12],
                })}
              >
                <Popup>
                  <Paper elevation={0} sx={{ p: 1.5, minWidth: 200 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Person sx={{ color, fontSize: 20 }} />
                      <Typography fontWeight={700} fontSize="0.9rem" color="#1a1a1a">
                        {student.name}
                      </Typography>
                    </Box>
                    
                    <Typography variant="caption" color="#666" display="block">
                      📚 {student.grade} - {student.section}
                    </Typography>
                    
                    <Typography variant="caption" color="#666" display="block" mt={0.5}>
                      📍 Near: {student.beaconName}
                    </Typography>
                    
                    <Typography variant="caption" color="#999" display="block">
                      📏 ~{student.distance}m away
                    </Typography>
                    
                    <Chip
                      label={`Updated ${Math.floor((Date.now() - student.timestamp.getTime()) / 1000)}s ago`}
                      size="small"
                      sx={{
                        mt: 1,
                        bgcolor: '#e3f2fd',
                        color: color,
                        fontSize: '0.7rem',
                      }}
                    />
                  </Paper>
                </Popup>
              </Marker>
            </div>
          );
        })}

        {/* Single Student Current Location (for parent/student view) */}
        {studentCoords && !enableRealTime && (
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
                    📍 {studentLocation?.location_name}
                  </Typography>
                  
                  {studentLocation?.building && (
                    <Typography variant="caption" color="#999" display="block">
                      🏢 {studentLocation.building}
                      {studentLocation.floor && ` - ${studentLocation.floor}`}
                    </Typography>
                  )}
                  
                  <Chip
                    label={`${studentLocation?.minutes_ago || 0} min ago`}
                    size="small"
                    sx={{
                      mt: 1,
                      bgcolor: studentLocation?.location_status === 'active' ? '#e3f2fd' : '#f5f5f5',
                      color: studentLocation?.location_status === 'active' ? '#3b82f6' : '#666',
                      fontSize: '0.7rem',
                    }}
                  />
                </Paper>
              </Popup>
            </Marker>
          </>
        )}
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
          
          {enableRealTime && (
            <Box display="flex" alignItems="center" gap={1} mt={0.5} pt={0.5} borderTop="1px solid #e0e0e0">
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: '#3b82f6',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              />
              <Typography variant="caption" color="#666" fontSize="0.7rem">
                Live Students ({liveStudents.size})
              </Typography>
            </Box>
          )}
          
          {!enableRealTime && (
            <Box display="flex" alignItems="center" gap={1} mt={0.5} pt={0.5} borderTop="1px solid #e0e0e0">
              <Person sx={{ fontSize: 14, color: '#3b82f6' }} />
              <Typography variant="caption" color="#666" fontSize="0.7rem">
                Student Location
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Live Status Indicator */}
      {(studentLocation || enableRealTime) && (
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
              bgcolor: enableRealTime ? '#22c55e' : (studentLocation?.location_status === 'active' ? '#22c55e' : '#f59e0b'),
              animation: enableRealTime ? 'pulse 2s infinite' : (studentLocation?.location_status === 'active' ? 'pulse 2s infinite' : 'none'),
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
          <Typography variant="caption" fontWeight={600} color="#1a1a1a">
            {enableRealTime 
              ? `🟢 Live Tracking (${liveStudents.size} students)` 
              : (studentLocation?.location_status === 'active' ? '🟢 Live' : '🟡 Recent')
            }
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
