#!/usr/bin/env python3
"""
BLE Trilateration Server
High-accuracy indoor positioning using Bluetooth Low Energy (BLE) beacons

Features:
- Multilateration algorithm for position calculation
- Kalman filter for smooth tracking
- Exponential moving average (EMA) for noise reduction
- WebSocket broadcasting for real-time updates
- Zone-based room snapping
- Coasting mode when signals are temporarily lost
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_sock import Sock
import json
import time
import math
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple
import threading

app = Flask(__name__, static_folder='static')
sock = Sock(app)

# ==================== CONFIGURATION ====================

# Anchor positions (GPS coordinates: latitude, longitude)
# IMPORTANT: Update these with your actual ESP32 anchor locations!
ANCHOR_POSITIONS = {
    1: (8.47325810442503,  124.64987213026977),   # Anchor 1 GPS position
    2: (8.473279327880148, 124.65011352907634),   # Anchor 2 GPS position
    3: (8.473128110736846, 124.64999282967305),   # Anchor 3 GPS position
}

# Zone definitions (optional - for room-level snapping)
# Format: {zone_id: {"name": "Room Name", "center": (lat, lng), "radius_m": radius}}
ZONES = {}

# Algorithm parameters
MIN_ANCHORS = 3                 # Minimum anchors needed for position fix
BROADCAST_INTERVAL = 1.0        # How often to broadcast position (seconds)
MEASUREMENT_TIMEOUT = 5.0       # How long to keep anchor measurements (seconds)
COAST_TIMEOUT = 3.0             # How long to coast without fresh measurements
EMA_ALPHA = 0.3                 # Exponential moving average smoothing (0-1, lower = smoother)
MEDIAN_WINDOW = 3               # Number of readings to use for median filter
KALMAN_Q = 0.1                  # Process noise (lower = trust model more)
KALMAN_R = 2.0                  # Measurement noise (lower = trust measurements more)

# Positioning mode: "trilateration" or "proximity"
# - trilateration: Uses 3+ anchors to calculate exact position (GPS-like, 1-3m accuracy)
# - proximity: Shows position at nearest anchor (simpler, shows which beacon is closest)
POSITIONING_MODE = "trilateration"  # GPS-like positioning with 3+ anchors

# Student/Target definitions (map target_id to student info)
STUDENTS = {
    1: {"name": "Bernie", "mac": "F7:6C:A5:11:0A:F7", "color": "#4285f4"},  # Blue
    2: {"name": "Student 2", "mac": "51:00:24:06:00:C4", "color": "#ea4335"},  # Red
    # Add more students here as needed
}

# ==================== DATA STRUCTURES ====================

@dataclass
class AnchorReading:
    """Single distance reading from an anchor"""
    anchor_id: int
    distance: float
    rssi: int
    timestamp: float
    raw_distance: float  # Before filtering

@dataclass
class Position:
    """Calculated position with metadata"""
    target_id: int  # NEW: Student/target identifier
    target_name: str  # NEW: Student name
    target_color: str  # NEW: Display color
    lat: float
    lng: float
    accuracy_m: float
    speed_mps: float
    heading_deg: Optional[float]
    raw_residual_m: float
    anchors_used: int
    anchors: List[Dict]
    zone_id: Optional[str]
    zone_name: Optional[str]
    in_zone: bool
    snapped: bool
    snap_distance_m: Optional[float]
    warming_up: bool
    timestamp: float
    coasting: bool = False

# Global state - NOW STORES DATA PER TARGET
anchor_readings: Dict[int, Dict[int, deque]] = defaultdict(lambda: defaultdict(lambda: deque(maxlen=MEDIAN_WINDOW)))
# Structure: anchor_readings[target_id][anchor_id] = deque of readings

last_positions: Dict[int, Optional[Position]] = {}  # Per target
kalman_states: Dict[int, Dict] = {}  # Per target
# Structure: kalman_states[target_id] = {lat, lng, lat_var, lng_var, last_update}

websocket_clients = []
lock = threading.Lock()

# ==================== UTILITIES ====================

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in meters between two GPS coordinates"""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def meters_to_degrees(meters: float, lat: float) -> Tuple[float, float]:
    """Convert meters to degrees (approximate)"""
    lat_deg = meters / 111320.0
    lng_deg = meters / (111320.0 * math.cos(math.radians(lat)))
    return lat_deg, lng_deg

def calculate_speed_and_heading(pos1: Position, pos2: Position) -> Tuple[float, Optional[float]]:
    """Calculate speed (m/s) and heading (degrees) between two positions"""
    dt = pos2.timestamp - pos1.timestamp
    if dt <= 0:
        return 0.0, None
    
    dist = haversine_distance(pos1.lat, pos1.lng, pos2.lat, pos2.lng)
    speed = dist / dt
    
    # Calculate heading (bearing)
    if dist > 0.5:  # Only calculate heading if moved significantly
        dlng = math.radians(pos2.lng - pos1.lng)
        lat1, lat2 = math.radians(pos1.lat), math.radians(pos2.lat)
        
        x = math.sin(dlng) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlng)
        heading = (math.degrees(math.atan2(x, y)) + 360) % 360
        return speed, heading
    
    return speed, None

def find_zone(lat: float, lng: float) -> Optional[Dict]:
    """Find which zone (if any) the position is in"""
    for zone_id, zone_info in ZONES.items():
        center_lat, center_lng = zone_info['center']
        distance = haversine_distance(lat, lng, center_lat, center_lng)
        if distance <= zone_info['radius_m']:
            return {
                'id': zone_id,
                'name': zone_info['name'],
                'distance': distance,
                'in_zone': True
            }
    return None

def snap_to_zone_edge(lat: float, lng: float, zone: Dict) -> Tuple[float, float, float]:
    """Snap position to zone edge if detected outside but close"""
    center_lat, center_lng = ZONES[zone['id']]['center']
    radius = ZONES[zone['id']]['radius_m']
    
    distance = haversine_distance(lat, lng, center_lat, center_lng)
    if distance > radius:
        # Position is outside zone, snap to edge
        bearing = math.atan2(lng - center_lng, lat - center_lat)
        
        lat_offset, lng_offset = meters_to_degrees(radius, center_lat)
        snapped_lat = center_lat + lat_offset * math.sin(bearing)
        snapped_lng = center_lng + lng_offset * math.cos(bearing)
        
        snap_distance = distance - radius
        return snapped_lat, snapped_lng, snap_distance
    
    return lat, lng, 0.0

# ==================== TRILATERATION ALGORITHM ====================

def proximity_positioning(anchors: List[AnchorReading]) -> Optional[Tuple[float, float, float]]:
    """
    Simple proximity-based positioning: place marker at nearest anchor
    Returns: (latitude, longitude, distance_to_nearest) or None
    """
    if not anchors:
        return None
    
    # Find anchor with smallest distance (strongest signal)
    nearest_anchor = min(anchors, key=lambda a: a.distance)
    
    # Get GPS position of nearest anchor
    anchor_lat, anchor_lng = ANCHOR_POSITIONS[nearest_anchor.anchor_id]
    
    # Return anchor position with distance as "accuracy"
    return anchor_lat, anchor_lng, nearest_anchor.distance

def trilaterate(anchors: List[AnchorReading]) -> Optional[Tuple[float, float, float]]:
    """
    Calculate position using multilateration
    Returns: (latitude, longitude, residual_error) or None if unable to solve
    """
    if len(anchors) < MIN_ANCHORS:
        return None
    
    # Convert GPS to local XY coordinates (approximate flat earth)
    ref_lat = ANCHOR_POSITIONS[1][0]
    ref_lng = ANCHOR_POSITIONS[1][1]
    
    positions = []
    distances = []
    
    for reading in anchors:
        anchor_lat, anchor_lng = ANCHOR_POSITIONS[reading.anchor_id]
        
        # Convert to meters from reference point
        x = haversine_distance(ref_lat, ref_lng, ref_lat, anchor_lng)
        if anchor_lng < ref_lng:
            x = -x
        
        y = haversine_distance(ref_lat, ref_lng, anchor_lat, ref_lng)
        if anchor_lat < ref_lat:
            y = -y
        
        positions.append((x, y))
        distances.append(reading.distance)
    
    # Solve using least squares
    try:
        # Set up matrices for least squares solution
        A = []
        b = []
        
        for i in range(1, len(positions)):
            x1, y1 = positions[0]
            x2, y2 = positions[i]
            d1, d2 = distances[0], distances[i]
            
            A.append([2*(x2 - x1), 2*(y2 - y1)])
            b.append([d1**2 - d2**2 - x1**2 + x2**2 - y1**2 + y2**2])
        
        # Solve Ax = b using numpy-like approach (manual matrix operations)
        # For simplicity, use first 2 equations if available (works for 3 anchors)
        if len(A) >= 2:
            # Simple 2x2 matrix solve
            a11, a12 = A[0]
            a21, a22 = A[1]
            b1, b2 = b[0][0], b[1][0]
            
            det = a11*a22 - a12*a21
            if abs(det) < 1e-10:
                return None
            
            x = (a22*b1 - a12*b2) / det
            y = (a11*b2 - a21*b1) / det
            
            # Calculate residual (how well solution fits all anchors)
            residual = 0
            for (px, py), d in zip(positions, distances):
                calculated_dist = math.sqrt((x - px)**2 + (y - py)**2)
                residual += abs(calculated_dist - d)
            residual /= len(positions)
            
            # Convert back to GPS coordinates
            result_lat = ref_lat + (y / 111320.0)
            result_lng = ref_lng + (x / (111320.0 * math.cos(math.radians(ref_lat))))
            
            return result_lat, result_lng, residual
    
    except Exception as e:
        print(f"[ERROR] Trilateration failed: {e}")
    
    return None

# ==================== FILTERING ====================

def apply_median_filter(readings: deque) -> float:
    """Apply median filter to distance readings"""
    if not readings:
        return 0.0
    sorted_readings = sorted([r.distance for r in readings])
    mid = len(sorted_readings) // 2
    return sorted_readings[mid] if len(sorted_readings) % 2 == 1 else \
           (sorted_readings[mid-1] + sorted_readings[mid]) / 2

def apply_ema(new_value: float, old_value: Optional[float], alpha: float) -> float:
    """Apply exponential moving average"""
    if old_value is None:
        return new_value
    return alpha * new_value + (1 - alpha) * old_value

def apply_kalman_filter(measurement_lat: float, measurement_lng: float, target_id: int) -> Tuple[float, float]:
    """Apply Kalman filter for smooth tracking (per target)"""
    global kalman_states
    
    # Initialize state for this target if needed
    if target_id not in kalman_states:
        kalman_states[target_id] = {
            'lat': None, 'lng': None,
            'lat_var': 1.0, 'lng_var': 1.0,
            'last_update': None
        }
    
    kalman_state = kalman_states[target_id]
    now = time.time()
    
    # Initialize on first measurement
    if kalman_state['lat'] is None:
        kalman_state['lat'] = measurement_lat
        kalman_state['lng'] = measurement_lng
        kalman_state['last_update'] = now
        return measurement_lat, measurement_lng
    
    # Time delta
    dt = now - kalman_state['last_update']
    kalman_state['last_update'] = now
    
    # Predict (assume no movement in prediction step)
    # Just increase uncertainty based on time passed
    kalman_state['lat_var'] += KALMAN_Q * dt
    kalman_state['lng_var'] += KALMAN_Q * dt
    
    # Update with measurement
    # Kalman gain
    K_lat = kalman_state['lat_var'] / (kalman_state['lat_var'] + KALMAN_R)
    K_lng = kalman_state['lng_var'] / (kalman_state['lng_var'] + KALMAN_R)
    
    # Update estimate
    kalman_state['lat'] = kalman_state['lat'] + K_lat * (measurement_lat - kalman_state['lat'])
    kalman_state['lng'] = kalman_state['lng'] + K_lng * (measurement_lng - kalman_state['lng'])
    
    # Update uncertainty
    kalman_state['lat_var'] = (1 - K_lat) * kalman_state['lat_var']
    kalman_state['lng_var'] = (1 - K_lng) * kalman_state['lng_var']
    
    return kalman_state['lat'], kalman_state['lng']

# ==================== POSITION CALCULATION ====================

def calculate_position() -> Optional[Position]:
    """Calculate current position from all anchor readings"""
    global last_position
    
    now = time.time()
    
    # Get fresh readings (within timeout)
    fresh_anchors = []
    for anchor_id, readings in anchor_readings.items():
        if readings and (now - readings[-1].timestamp) < MEASUREMENT_TIMEOUT:
            # Use median-filtered distance
            filtered_distance = apply_median_filter(readings)
            fresh_anchors.append(AnchorReading(
                anchor_id=anchor_id,
                distance=filtered_distance,
                rssi=readings[-1].rssi,
                timestamp=readings[-1].timestamp,
                raw_distance=readings[-1].raw_distance
            ))
    
    # Check if we have enough anchors
    if POSITIONING_MODE == "proximity":
        # Proximity mode: only need 1 anchor
        if len(fresh_anchors) < 1:
            # Coasting mode
            if last_position and (now - last_position.timestamp) < COAST_TIMEOUT:
                coasting_position = Position(
                    lat=last_position.lat,
                    lng=last_position.lng,
                    accuracy_m=last_position.accuracy_m * 1.5,
                    speed_mps=0.0,
                    heading_deg=None,
                    raw_residual_m=last_position.raw_residual_m,
                    anchors_used=len(fresh_anchors),
                    anchors=[asdict(a) for a in fresh_anchors],
                    zone_id=last_position.zone_id,
                    zone_name=last_position.zone_name,
                    in_zone=last_position.in_zone,
                    snapped=False,
                    snap_distance_m=None,
                    warming_up=False,
                    timestamp=now,
                    coasting=True
                )
                return coasting_position
            return None
    else:
        # Trilateration mode: need 3+ anchors
        if len(fresh_anchors) < MIN_ANCHORS:
            # Coasting mode
            if last_position and (now - last_position.timestamp) < COAST_TIMEOUT:
                coasting_position = Position(
                    lat=last_position.lat,
                    lng=last_position.lng,
                    accuracy_m=last_position.accuracy_m * 1.5,
                    speed_mps=0.0,
                    heading_deg=None,
                    raw_residual_m=last_position.raw_residual_m,
                    anchors_used=len(fresh_anchors),
                    anchors=[asdict(a) for a in fresh_anchors],
                    zone_id=last_position.zone_id,
                    zone_name=last_position.zone_name,
                    in_zone=last_position.in_zone,
                    snapped=False,
                    snap_distance_m=None,
                    warming_up=False,
                    timestamp=now,
                    coasting=True
                )
                return coasting_position
            return None
    
    # Run positioning algorithm based on mode
    if POSITIONING_MODE == "proximity":
        result = proximity_positioning(fresh_anchors)
    else:
        result = trilaterate(fresh_anchors)
    if not result:
        return None
    
    raw_lat, raw_lng, residual = result
    
    # Apply Kalman filter for smooth tracking
    filtered_lat, filtered_lng = apply_kalman_filter(raw_lat, raw_lng)
    
    # Calculate speed and heading
    speed, heading = 0.0, None
    if last_position:
        speed, heading = calculate_speed_and_heading(last_position, Position(
            lat=filtered_lat, lng=filtered_lng, accuracy_m=0, speed_mps=0,
            heading_deg=None, raw_residual_m=residual, anchors_used=len(fresh_anchors),
            anchors=[], zone_id=None, zone_name=None, in_zone=False,
            snapped=False, snap_distance_m=None, warming_up=False, timestamp=now
        ))
    
    # Check for zone
    zone_info = find_zone(filtered_lat, filtered_lng)
    snapped = False
    snap_distance = None
    
    if zone_info and not zone_info['in_zone']:
        # Snap to zone edge if close
        filtered_lat, filtered_lng, snap_distance = snap_to_zone_edge(
            filtered_lat, filtered_lng, zone_info
        )
        snapped = True
        zone_info['in_zone'] = True
    
    # Calculate accuracy estimate (based on residual and anchor geometry)
    accuracy = max(1.0, residual) * (4.0 / len(fresh_anchors))  # More anchors = better
    
    # Warming up flag (first few positions may be less accurate)
    warming_up = last_position is None or (now - last_position.timestamp) > 10.0
    
    position = Position(
        lat=filtered_lat,
        lng=filtered_lng,
        accuracy_m=round(accuracy, 1),
        speed_mps=round(speed, 2),
        heading_deg=round(heading, 1) if heading is not None else None,
        raw_residual_m=round(residual, 2),
        anchors_used=len(fresh_anchors),
        anchors=[{
            'id': a.anchor_id,
            'lat': ANCHOR_POSITIONS[a.anchor_id][0],
            'lng': ANCHOR_POSITIONS[a.anchor_id][1],
            'distance': round(a.distance, 2),
            'raw_distance': round(a.raw_distance, 2),
            'rssi': a.rssi
        } for a in fresh_anchors],
        zone_id=zone_info['id'] if zone_info else None,
        zone_name=zone_info['name'] if zone_info else None,
        in_zone=zone_info['in_zone'] if zone_info else False,
        snapped=snapped,
        snap_distance_m=round(snap_distance, 1) if snap_distance else None,
        warming_up=warming_up,
        timestamp=now,
        coasting=False
    )
    
    return position

# ==================== BROADCASTING ====================

def broadcast_position():
    """Broadcast position updates to all connected WebSocket clients"""
    global last_position
    
    while True:
        time.sleep(BROADCAST_INTERVAL)
        
        with lock:
            position = calculate_position()
            
            if position:
                last_position = position
                
                # Broadcast to all WebSocket clients
                message = json.dumps({
                    'type': 'position',
                    **asdict(position)
                })
                
                # Uncomment the line below to see debug position info
                # print(f"[DEBUG] Fix: lat={position.lat:.7f} lng={position.lng:.7f} "
                #       f"accuracy={position.accuracy_m}m anchors={position.anchors_used} "
                #       f"speed={position.speed_mps}m/s{' (coasting)' if position.coasting else ''}")
                
                for client in websocket_clients[:]:
                    try:
                        client.send(message)
                    except:
                        websocket_clients.remove(client)
            else:
                # Send "waiting" message
                active_anchors = sum(
                    1 for readings in anchor_readings.values()
                    if readings and (time.time() - readings[-1].timestamp) < MEASUREMENT_TIMEOUT
                )
                
                message = json.dumps({
                    'type': 'waiting',
                    'active_anchors': active_anchors,
                    'needed': MIN_ANCHORS
                })
                
                for client in websocket_clients[:]:
                    try:
                        client.send(message)
                    except:
                        websocket_clients.remove(client)

# ==================== HTTP ENDPOINTS ====================

@app.route('/update', methods=['POST'])
def update_anchor():
    """Receive distance reading from ESP32 anchor"""
    data = request.json
    
    try:
        anchor_id = int(data['anchor_id'])
        found = data['found']
        distance = float(data.get('distance', 0))
        rssi = int(data.get('rssi', -100))
        
        if anchor_id not in ANCHOR_POSITIONS:
            return jsonify({'error': f'Unknown anchor ID: {anchor_id}'}), 400
        
        print(f"[UPDATE] anchor={anchor_id} found={found} distance={distance:.2f} rssi={rssi}")
        
        if found and distance > 0:
            with lock:
                anchor_readings[anchor_id].append(AnchorReading(
                    anchor_id=anchor_id,
                    distance=distance,
                    rssi=rssi,
                    timestamp=time.time(),
                    raw_distance=distance
                ))
        
        return jsonify({'status': 'ok'})
    
    except Exception as e:
        print(f"[ERROR] Failed to process update: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/')
def index():
    """Serve embedded map visualization"""
    return send_from_directory('static', 'map.html')

@app.route('/status')
def status():
    """Get current system status"""
    with lock:
        now = time.time()
        active_anchors = {}
        for anchor_id, readings in anchor_readings.items():
            if readings and (now - readings[-1].timestamp) < MEASUREMENT_TIMEOUT:
                active_anchors[anchor_id] = {
                    'distance': readings[-1].distance,
                    'rssi': readings[-1].rssi,
                    'age': now - readings[-1].timestamp
                }
        
        return jsonify({
            'active_anchors': len(active_anchors),
            'anchors': active_anchors,
            'has_fix': last_position is not None,
            'last_position': asdict(last_position) if last_position else None,
            'connected_clients': len(websocket_clients)
        })

# ==================== WEBSOCKET ====================

@sock.route('/ws')
def websocket(ws):
    """WebSocket endpoint for real-time position updates"""
    print(f"[WS] Client connected from {request.remote_addr}")
    websocket_clients.append(ws)
    
    try:
        # Send initial position if available
        if last_position:
            ws.send(json.dumps({
                'type': 'position',
                **asdict(last_position)
            }))
        
        # Keep connection alive
        while True:
            data = ws.receive()
            if data is None:
                break
    except:
        pass
    finally:
        if ws in websocket_clients:
            websocket_clients.remove(ws)
        print(f"[WS] Client disconnected")

# ==================== MAIN ====================

if __name__ == '__main__':
    print("=" * 55)
    print("  BLE Trilateration Server  —  high-accuracy edition")
    print("  POST /update  <- ESP32 anchors (just deposits readings)")
    print("  WS   /ws      <- map.html")
    print(f"  Broadcasting position every {BROADCAST_INTERVAL}s")
    print(f"  Zones defined: {len(ZONES)}")
    print(f"  Listening on  http://0.0.0.0:8080")
    print(f"  Open browser: http://localhost:8080/")
    print("=" * 55)
    
    # Start background broadcaster
    broadcaster = threading.Thread(target=broadcast_position, daemon=True)
    broadcaster.start()
    
    # Start Flask server
    app.run(host='0.0.0.0', port=8080, debug=False)
