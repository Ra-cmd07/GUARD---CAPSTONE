#!/usr/bin/env python3
"""
BLE Multi-Beacon Trilateration Server
High-accuracy indoor positioning for MULTIPLE students

Features:
- Tracks multiple BLE beacons simultaneously
- Separate Kalman filter per student
- WebSocket broadcasts all positions
- Different colors per student
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
import requests  # For backend API integration

app = Flask(__name__, static_folder='static')
sock = Sock(app)

# ==================== CONFIGURATION ====================

# Backend API configuration
BACKEND_API_URL = "http://localhost:5000/api/location/trilateration-update"
ENABLE_BACKEND_SYNC = True  # Set to False to disable database saving
DB_UPDATE_INTERVAL = 5.0  # Save to database every 5 seconds (instead of every 0.05s)
SAVE_ON_ZONE_CHANGE = True  # Save immediately when proximity zone changes

# Anchor positions (GPS coordinates: latitude, longitude)
ANCHOR_POSITIONS = {
    1: (8.47325810442503,  124.64987213026977),
    2: (8.473279327880148, 124.65011352907634),
    3: (8.473128110736846, 124.64999282967305),
}

# Anchor location names (match the dartboard labels on the map)
ANCHOR_LOCATIONS = {
    1: "Classroom",
    2: "Cafeteria",
    3: "Library",
}

# Student/Target definitions
# target_id: Used by Arduino sketch (1, 2, 3...)
# student_id: Actual database ID
# mac: BLE beacon MAC address
STUDENTS = {
    1: {"name": "Bernie", "mac": "F7:6C:A5:11:0A:F7", "color": "#4285f4", "student_id": 1, "uuid": "00005242-0000-1000-8000-00805f9b34fb"},
    2: {"name": "Kurtt", "mac": "51:00:24:06:00:C4", "color": "#ea4335", "student_id": 3, "uuid": "00001803-0000-1000-8000-00805f9b34fb"},
    3: {"name": "Rae", "mac": "58:54:FF:88:E2:36", "color": "#34a853", "student_id": 2, "uuid": "00001111-0000-1000-8000-00805f9b34fb"},
}

# Algorithm parameters
MIN_ANCHORS = 1  # CHANGED to 1: Allow single anchor for proximity mode testing
BROADCAST_INTERVAL = 0.05  # MAXIMUM SPEED: Update map every 0.05s (20x per second!)
MEASUREMENT_TIMEOUT = 10.0  # INCREASED from 5.0 to 10.0 seconds
COAST_TIMEOUT = 5.0         # INCREASED from 3.0 to 5.0 seconds
MEDIAN_WINDOW = 3
KALMAN_Q = 5.0   # MAXIMUM RESPONSIVENESS: Instant reaction to movement (was 2.0)
KALMAN_R = 0.5   # TRUST MEASUREMENTS MORE: Lower = trust sensors more (was 1.0)
POSITIONING_MODE = "proximity"  # CHANGED: "trilateration" or "proximity" - proximity places dot at nearest anchor

# ==================== DATA STRUCTURES ====================

@dataclass
class AnchorReading:
    anchor_id: int
    distance: float
    rssi: int
    timestamp: float
    raw_distance: float
    proximity_zone: str = "UNKNOWN"  # NEW: CLOSE, WITHIN_RANGE, OUT_OF_RANGE

@dataclass
class Position:
    target_id: int
    target_name: str
    target_color: str
    lat: float
    lng: float
    accuracy_m: float
    speed_mps: float
    heading_deg: Optional[float]
    raw_residual_m: float
    anchors_used: int
    anchors: List[Dict]
    warming_up: bool
    timestamp: float
    coasting: bool = False
    proximity_status: str = "UNKNOWN"  # NEW: Overall proximity status

# Global state - PER TARGET
anchor_readings: Dict[int, Dict[int, deque]] = defaultdict(lambda: defaultdict(lambda: deque(maxlen=MEDIAN_WINDOW)))
last_positions: Dict[int, Optional[Position]] = {}
last_db_save_time: Dict[int, float] = {}  # Track last database save time per student
last_saved_zone: Dict[int, str] = {}  # Track last saved proximity zone per student
kalman_states: Dict[int, Dict] = {}
websocket_clients = []
lock = threading.Lock()
db_write_queue = []  # Queue for async database writes
db_write_lock = threading.Lock()

# ==================== UTILITIES ====================

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def calculate_speed_and_heading(pos1: Position, pos2: Position) -> Tuple[float, Optional[float]]:
    dt = pos2.timestamp - pos1.timestamp
    if dt <= 0:
        return 0.0, None
    
    dist = haversine_distance(pos1.lat, pos1.lng, pos2.lat, pos2.lng)
    speed = dist / dt
    
    if dist > 0.5:
        dlng = math.radians(pos2.lng - pos1.lng)
        lat1, lat2 = math.radians(pos1.lat), math.radians(pos2.lat)
        
        x = math.sin(dlng) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlng)
        heading = (math.degrees(math.atan2(x, y)) + 360) % 360
        return speed, heading
    
    return speed, None

# ==================== TRILATERATION ====================

def trilaterate(anchors: List[AnchorReading]) -> Optional[Tuple[float, float, float]]:
    if len(anchors) < 2:
        return None
    
    # Special case: 2 anchors - use midpoint with weighted average
    if len(anchors) == 2:
        # Calculate midpoint between two anchors, weighted by distance
        anchor1_pos = ANCHOR_POSITIONS[anchors[0].anchor_id]
        anchor2_pos = ANCHOR_POSITIONS[anchors[1].anchor_id]
        
        # Weighted midpoint (closer to the anchor with shorter distance)
        total_dist = anchors[0].distance + anchors[1].distance
        if total_dist > 0:
            w1 = 1.0 - (anchors[0].distance / total_dist)  # Closer = higher weight
            w2 = 1.0 - (anchors[1].distance / total_dist)
        else:
            w1 = w2 = 0.5
        
        result_lat = anchor1_pos[0] * w1 + anchor2_pos[0] * w2
        result_lng = anchor1_pos[1] * w1 + anchor2_pos[1] * w2
        
        # Estimate accuracy based on distance between anchors
        dist_between = haversine_distance(anchor1_pos[0], anchor1_pos[1], anchor2_pos[0], anchor2_pos[1])
        residual = dist_between / 4.0  # Rough accuracy estimate
        
        print(f"[TRILATERATE] 2-anchor mode: weighted midpoint (residual: {residual:.2f}m)")
        return result_lat, result_lng, residual
    
    # Normal case: 3+ anchors - use trilateration
    if len(anchors) < MIN_ANCHORS:
        return None
    
    ref_lat = ANCHOR_POSITIONS[1][0]
    ref_lng = ANCHOR_POSITIONS[1][1]
    
    positions = []
    distances = []
    
    for reading in anchors:
        anchor_lat, anchor_lng = ANCHOR_POSITIONS[reading.anchor_id]
        
        x = haversine_distance(ref_lat, ref_lng, ref_lat, anchor_lng)
        if anchor_lng < ref_lng:
            x = -x
        
        y = haversine_distance(ref_lat, ref_lng, anchor_lat, ref_lng)
        if anchor_lat < ref_lat:
            y = -y
        
        positions.append((x, y))
        distances.append(reading.distance)
    
    try:
        A = []
        b = []
        
        for i in range(1, len(positions)):
            x1, y1 = positions[0]
            x2, y2 = positions[i]
            d1, d2 = distances[0], distances[i]
            
            A.append([2*(x2 - x1), 2*(y2 - y1)])
            b.append([d1**2 - d2**2 - x1**2 + x2**2 - y1**2 + y2**2])
        
        if len(A) >= 2:
            a11, a12 = A[0]
            a21, a22 = A[1]
            b1, b2 = b[0][0], b[1][0]
            
            det = a11*a22 - a12*a21
            if abs(det) < 1e-10:
                return None
            
            x = (a22*b1 - a12*b2) / det
            y = (a11*b2 - a21*b1) / det
            
            residual = 0
            for (px, py), d in zip(positions, distances):
                calculated_dist = math.sqrt((x - px)**2 + (y - py)**2)
                residual += abs(calculated_dist - d)
            residual /= len(positions)
            
            result_lat = ref_lat + (y / 111320.0)
            result_lng = ref_lng + (x / (111320.0 * math.cos(math.radians(ref_lat))))
            
            return result_lat, result_lng, residual
    
    except Exception as e:
        print(f"[ERROR] Trilateration failed: {e}")
    
    return None

# ==================== FILTERING ====================

def apply_median_filter(readings: deque) -> float:
    if not readings:
        return 0.0
    sorted_readings = sorted([r.distance for r in readings])
    mid = len(sorted_readings) // 2
    return sorted_readings[mid] if len(sorted_readings) % 2 == 1 else \
           (sorted_readings[mid-1] + sorted_readings[mid]) / 2

def apply_kalman_filter(measurement_lat: float, measurement_lng: float, target_id: int) -> Tuple[float, float]:
    global kalman_states
    
    if target_id not in kalman_states:
        kalman_states[target_id] = {
            'lat': None, 'lng': None,
            'lat_var': 1.0, 'lng_var': 1.0,
            'last_update': None
        }
    
    kalman_state = kalman_states[target_id]
    now = time.time()
    
    if kalman_state['lat'] is None:
        kalman_state['lat'] = measurement_lat
        kalman_state['lng'] = measurement_lng
        kalman_state['last_update'] = now
        return measurement_lat, measurement_lng
    
    dt = now - kalman_state['last_update']
    kalman_state['last_update'] = now
    
    kalman_state['lat_var'] += KALMAN_Q * dt
    kalman_state['lng_var'] += KALMAN_Q * dt
    
    K_lat = kalman_state['lat_var'] / (kalman_state['lat_var'] + KALMAN_R)
    K_lng = kalman_state['lng_var'] / (kalman_state['lng_var'] + KALMAN_R)
    
    kalman_state['lat'] = kalman_state['lat'] + K_lat * (measurement_lat - kalman_state['lat'])
    kalman_state['lng'] = kalman_state['lng'] + K_lng * (measurement_lng - kalman_state['lng'])
    
    kalman_state['lat_var'] = (1 - K_lat) * kalman_state['lat_var']
    kalman_state['lng_var'] = (1 - K_lng) * kalman_state['lng_var']
    
    return kalman_state['lat'], kalman_state['lng']

# ==================== POSITION CALCULATION ====================

def determine_proximity_status(anchors: List[AnchorReading]) -> str:
    """
    Determine overall proximity status based on anchor readings
    - CLOSE: At least one anchor reports CLOSE (within 3m)
    - WITHIN_RANGE: At least one anchor reports WITHIN_RANGE (3-10m), but none report CLOSE
    - OUT_OF_RANGE: All anchors report OUT_OF_RANGE (beyond 10m or not detected)
    """
    if not anchors:
        return "OUT_OF_RANGE"
    
    # Check if any anchor reports CLOSE
    for anchor in anchors:
        if anchor.proximity_zone == "CLOSE":
            return "CLOSE"  # Highest priority: at least one anchor sees student very close
    
    # Check if any anchor reports WITHIN_RANGE
    for anchor in anchors:
        if anchor.proximity_zone == "WITHIN_RANGE":
            return "WITHIN_RANGE"  # Medium priority: student is within detectable range
    
    return "OUT_OF_RANGE"  # All anchors report OUT_OF_RANGE or no data

def calculate_position_for_target(target_id: int) -> Optional[Position]:
    """Calculate position for ONE specific target"""
    if target_id not in STUDENTS:
        return None
    
    student_info = STUDENTS[target_id]
    now = time.time()
    
    # Get fresh readings for THIS target
    fresh_anchors = []
    target_readings = anchor_readings[target_id]
    
    for anchor_id, readings in target_readings.items():
        if readings and (now - readings[-1].timestamp) < MEASUREMENT_TIMEOUT:
            filtered_distance = apply_median_filter(readings)
            fresh_anchors.append(AnchorReading(
                anchor_id=anchor_id,
                distance=filtered_distance,
                rssi=readings[-1].rssi,
                timestamp=readings[-1].timestamp,
                raw_distance=readings[-1].raw_distance,
                proximity_zone=readings[-1].proximity_zone  # FIXED: Copy proximity_zone
            ))
    
    # Check if we have enough anchors
    if len(fresh_anchors) < MIN_ANCHORS:
        # Coasting mode
        if target_id in last_positions and last_positions[target_id]:
            last_pos = last_positions[target_id]
            if (now - last_pos.timestamp) < COAST_TIMEOUT:
                proximity_status = determine_proximity_status(fresh_anchors) if fresh_anchors else "OUT_OF_RANGE"
                return Position(
                    target_id=target_id,
                    target_name=student_info['name'],
                    target_color=student_info['color'],
                    lat=last_pos.lat,
                    lng=last_pos.lng,
                    accuracy_m=last_pos.accuracy_m * 1.5,
                    speed_mps=0.0,
                    heading_deg=None,
                    raw_residual_m=last_pos.raw_residual_m,
                    anchors_used=len(fresh_anchors),
                    anchors=[{
                        'id': a.anchor_id,
                        'lat': ANCHOR_POSITIONS[a.anchor_id][0],
                        'lng': ANCHOR_POSITIONS[a.anchor_id][1],
                        'distance': round(a.distance, 2),
                        'raw_distance': round(a.raw_distance, 2),
                        'rssi': a.rssi,
                        'proximity_zone': a.proximity_zone
                    } for a in fresh_anchors],
                    warming_up=False,
                    timestamp=now,
                    coasting=True,
                    proximity_status=proximity_status
                )
        return None
    
    # Check positioning mode
    if POSITIONING_MODE == "proximity":
        # PROXIMITY MODE: Place dot at actual measured distance from nearest anchor
        # This creates realistic movement: close = near anchor, far = away from anchor
        nearest_anchor = min(fresh_anchors, key=lambda a: a.distance)
        anchor_lat, anchor_lng = ANCHOR_POSITIONS[nearest_anchor.anchor_id]
        distance = nearest_anchor.distance
        
        # Use ACTUAL measured distance (not multiplied)
        # This makes the dot position reflect real physical distance
        offset_meters = distance
        
        # Each target gets a different direction angle for visual separation
        # Target 1: 45° (northeast), Target 2: 135° (southeast), etc.
        import math
        angle_degrees = 45 + (target_id - 1) * 90  # 45°, 135°, 225°, 315° for targets 1,2,3,4
        angle_radians = math.radians(angle_degrees)
        
        # Convert distance and angle to lat/lng offset
        # 1 degree latitude ≈ 111,320 meters
        # 1 degree longitude ≈ 111,320 * cos(latitude) meters
        lat_offset = (offset_meters * math.cos(angle_radians)) / 111320.0
        lng_offset = (offset_meters * math.sin(angle_radians)) / (111320.0 * math.cos(math.radians(anchor_lat)))
        
        raw_lat = anchor_lat + lat_offset
        raw_lng = anchor_lng + lng_offset
        residual = distance  # Use actual distance for accuracy circle
        
        print(f"[PROXIMITY] Target {target_id}: Nearest=Anchor{nearest_anchor.anchor_id}, distance={distance:.2f}m, zone={nearest_anchor.proximity_zone}, angle={angle_degrees}°")
    else:
        # TRILATERATION MODE: Calculate position using all anchors
        result = trilaterate(fresh_anchors)
        if not result:
            return None
        
        raw_lat, raw_lng, residual = result
    
    # Apply Kalman filter
    filtered_lat, filtered_lng = apply_kalman_filter(raw_lat, raw_lng, target_id)
    
    # Calculate speed and heading
    speed, heading = 0.0, None
    if target_id in last_positions and last_positions[target_id]:
        speed, heading = calculate_speed_and_heading(
            last_positions[target_id],
            Position(
                target_id=target_id,
                target_name=student_info['name'],
                target_color=student_info['color'],
                lat=filtered_lat,
                lng=filtered_lng,
                accuracy_m=0,
                speed_mps=0,
                heading_deg=None,
                raw_residual_m=residual,
                anchors_used=len(fresh_anchors),
                anchors=[],
                warming_up=False,
                timestamp=now
            )
        )
    
    accuracy = max(1.0, residual) * (4.0 / len(fresh_anchors))
    warming_up = target_id not in last_positions or last_positions[target_id] is None
    proximity_status = determine_proximity_status(fresh_anchors)  # NEW
    
    position = Position(
        target_id=target_id,
        target_name=student_info['name'],
        target_color=student_info['color'],
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
            'rssi': a.rssi,
            'proximity_zone': a.proximity_zone  # NEW
        } for a in fresh_anchors],
        warming_up=warming_up,
        timestamp=now,
        coasting=False,
        proximity_status=proximity_status  # NEW
    )
    
    return position

# ==================== BROADCASTING ====================

def send_to_backend_api_async(position: Position):
    """
    NON-BLOCKING: Add position to queue for background database save
    This function returns immediately without waiting for HTTP response
    """
    if not ENABLE_BACKEND_SYNC:
        return
    
    with db_write_lock:
        db_write_queue.append(position)

def database_writer_thread():
    """
    Background thread that processes database write queue
    Runs independently and doesn't block real-time tracking
    """
    while True:
        try:
            time.sleep(0.1)  # Check queue every 100ms
            
            with db_write_lock:
                if not db_write_queue:
                    continue
                
                # Pop position from queue
                position = db_write_queue.pop(0)
            
            # Perform actual HTTP POST (this is slow, but in background thread)
            try:
                student_data = STUDENTS.get(position.target_id)
                if not student_data:
                    continue
                
                db_student_id = student_data.get("student_id", position.target_id)
                
                location_name = position.proximity_status
                if position.anchors and len(position.anchors) > 0:
                    nearest_anchor = min(position.anchors, key=lambda a: a["distance"])
                    nearest_anchor_id = nearest_anchor["id"]
                    anchor_location = ANCHOR_LOCATIONS.get(nearest_anchor_id, f"Anchor {nearest_anchor_id}")
                    location_name = f"{anchor_location} - {position.proximity_status}"
                
                payload = {
                    "studentId": db_student_id,
                    "studentName": position.target_name,
                    "mac": student_data["mac"],
                    "latitude": position.lat,
                    "longitude": position.lng,
                    "accuracy": position.accuracy_m,
                    "locationName": location_name,
                    "locationType": "ble_tracking",
                    "distance": position.anchors[0]["distance"] if position.anchors else 0,
                    "zone": position.proximity_status
                }
                
                response = requests.post(BACKEND_API_URL, json=payload, timeout=2)
                if response.status_code == 200:
                    print(f"[DB] ✓ Saved {position.target_name} to database: {location_name}")
                else:
                    print(f"[DB] ✗ Failed to save {position.target_name}: HTTP {response.status_code}")
                    
            except requests.exceptions.Timeout:
                print(f"[DB] ✗ Timeout saving {position.target_name} to database")
            except Exception as e:
                print(f"[DB] ✗ Error saving to database: {e}")
                
        except Exception as e:
            print(f"[DB Writer] Error: {e}")
            time.sleep(1)

def should_save_to_database(position: Position) -> bool:
    """
    Determine if this position should be saved to database
    Only save on:
    1. Zone change (CLOSE → WITHIN_RANGE → OUT_OF_RANGE)
    2. Time interval (every DB_UPDATE_INTERVAL seconds)
    3. Anchor change (moved between locations)
    """
    target_id = position.target_id
    now = time.time()
    
    # First position always saves
    if target_id not in last_db_save_time:
        last_db_save_time[target_id] = now
        last_saved_zone[target_id] = position.proximity_status
        return True
    
    # Check if zone changed
    if SAVE_ON_ZONE_CHANGE:
        if position.proximity_status != last_saved_zone.get(target_id):
            print(f"[DB] Zone changed for {position.target_name}: {last_saved_zone.get(target_id)} → {position.proximity_status}")
            last_db_save_time[target_id] = now
            last_saved_zone[target_id] = position.proximity_status
            return True
    
    # Check if enough time has passed
    time_since_last_save = now - last_db_save_time[target_id]
    if time_since_last_save >= DB_UPDATE_INTERVAL:
        print(f"[DB] Time interval reached for {position.target_name} ({time_since_last_save:.1f}s)")
        last_db_save_time[target_id] = now
        last_saved_zone[target_id] = position.proximity_status
        return True
    
    return False

def send_to_backend_api(position: Position):
    """Send position data to backend API for database storage"""
    if not ENABLE_BACKEND_SYNC:
        return
    
    try:
        # Find student by target_id
        student_data = STUDENTS.get(position.target_id)
        if not student_data:
            return
        
        # Get actual database student_id (not target_id)
        db_student_id = student_data.get("student_id", position.target_id)
        
        # Determine location name based on nearest anchor
        location_name = position.proximity_status  # Default to proximity status
        if position.anchors and len(position.anchors) > 0:
            # Find nearest anchor
            nearest_anchor = min(position.anchors, key=lambda a: a["distance"])
            nearest_anchor_id = nearest_anchor["id"]
            
            # Get location name for this anchor
            anchor_location = ANCHOR_LOCATIONS.get(nearest_anchor_id, f"Anchor {nearest_anchor_id}")
            
            # Format: "Cafeteria - CLOSE" or "Library - WITHIN_RANGE"
            location_name = f"{anchor_location} - {position.proximity_status}"
        
        # Prepare payload for backend
        payload = {
            "studentId": db_student_id,  # Use database student_id, not target_id
            "studentName": position.target_name,
            "mac": student_data["mac"],
            "latitude": position.lat,
            "longitude": position.lng,
            "accuracy": position.accuracy_m,
            "locationName": location_name,  # e.g., "Cafeteria - CLOSE"
            "locationType": "ble_tracking",
            "distance": position.anchors[0]["distance"] if position.anchors else 0,
            "zone": position.proximity_status
        }
        
        # Send to backend (non-blocking, fire and forget)
        requests.post(BACKEND_API_URL, json=payload, timeout=1)
        
    except Exception as e:
        # Silently fail - don't disrupt tracking if backend is down
        pass

def broadcast_positions():
    """Calculate and broadcast ALL student positions"""
    while True:
        time.sleep(BROADCAST_INTERVAL)
        
        with lock:
            positions = []
            
            # Calculate position for each student
            for target_id in STUDENTS.keys():
                position = calculate_position_for_target(target_id)
                if position:
                    last_positions[target_id] = position
                    positions.append(asdict(position))
                    
                    # Check if we should save to database (smart logic)
                    if should_save_to_database(position):
                        # Queue for async database write (non-blocking)
                        send_to_backend_api_async(position)
            
            # Broadcast to all WebSocket clients (FAST - no blocking!)
            if positions:
                message = json.dumps({
                    'type': 'positions',  # Note: plural!
                    'students': positions
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
        target_id = int(data.get('target_id', 1))
        found = data['found']
        distance = float(data.get('distance', 0))
        rssi = int(data.get('rssi', -100))
        proximity_zone = data.get('proximity_zone', 'UNKNOWN')  # NEW
        
        if anchor_id not in ANCHOR_POSITIONS:
            return jsonify({'error': f'Unknown anchor ID: {anchor_id}'}), 400
        
        if target_id not in STUDENTS:
            return jsonify({'error': f'Unknown target ID: {target_id}'}), 400
        
        student_name = STUDENTS[target_id]['name']
        print(f"[UPDATE] anchor={anchor_id} target={target_id} ({student_name}) found={found} distance={distance:.2f}m rssi={rssi} zone={proximity_zone}")
        
        if found and distance > 0:
            with lock:
                anchor_readings[target_id][anchor_id].append(AnchorReading(
                    anchor_id=anchor_id,
                    distance=distance,
                    rssi=rssi,
                    timestamp=time.time(),
                    raw_distance=distance,
                    proximity_zone=proximity_zone  # NEW
                ))
        
        return jsonify({'status': 'ok'})
    
    except Exception as e:
        print(f"[ERROR] Failed to process update: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/')
def index():
    return send_from_directory('static', 'map_multi.html')

@app.route('/status')
def status():
    with lock:
        now = time.time()
        students_status = {}
        
        for target_id, student_info in STUDENTS.items():
            active_anchors = {}
            target_readings = anchor_readings[target_id]
            
            for anchor_id, readings in target_readings.items():
                if readings and (now - readings[-1].timestamp) < MEASUREMENT_TIMEOUT:
                    active_anchors[anchor_id] = {
                        'distance': readings[-1].distance,
                        'rssi': readings[-1].rssi,
                        'age': now - readings[-1].timestamp
                    }
            
            students_status[target_id] = {
                'name': student_info['name'],
                'color': student_info['color'],
                'active_anchors': len(active_anchors),
                'anchors': active_anchors,
                'has_fix': target_id in last_positions and last_positions[target_id] is not None,
                'last_position': asdict(last_positions[target_id]) if target_id in last_positions and last_positions[target_id] else None
            }
        
        return jsonify({
            'students': students_status,
            'connected_clients': len(websocket_clients)
        })

# ==================== WEBSOCKET ====================

@sock.route('/ws')
def websocket(ws):
    print(f"[WS] Client connected from {request.remote_addr}")
    websocket_clients.append(ws)
    
    try:
        # Send initial positions if available
        with lock:
            positions = []
            for target_id in STUDENTS.keys():
                if target_id in last_positions and last_positions[target_id]:
                    positions.append(asdict(last_positions[target_id]))
            
            if positions:
                ws.send(json.dumps({
                    'type': 'positions',
                    'students': positions
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
    print("=" * 60)
    print("  BLE Multi-Beacon Trilateration Server")
    print(f"  Tracking {len(STUDENTS)} students:")
    for target_id, info in STUDENTS.items():
        print(f"    • {info['name']} (ID {target_id}) - {info['color']}")
    print("=" * 60)
    print(f"  POST /update  ← ESP32 anchors")
    print(f"  WS   /ws      ← Real-time position updates")
    print(f"  GET  /status  ← System status")
    print(f"  Listening on  http://0.0.0.0:8080")
    print("=" * 60)
    print(f"  ⚡ PERFORMANCE MODE:")
    print(f"    • WebSocket broadcast: Every {BROADCAST_INTERVAL}s (FAST)")
    print(f"    • Database writes: Every {DB_UPDATE_INTERVAL}s or on zone change")
    print(f"    • Non-blocking: Database writes happen in background")
    print("=" * 60)
    
    # Start background database writer thread
    db_writer = threading.Thread(target=database_writer_thread, daemon=True)
    db_writer.start()
    print("[DB Writer] ✓ Background database writer started")
    
    # Start background broadcaster
    broadcaster = threading.Thread(target=broadcast_positions, daemon=True)
    broadcaster.start()
    print("[Broadcaster] ✓ Position broadcaster started")
    
    # Start Flask server
    app.run(host='0.0.0.0', port=8080, debug=False)
