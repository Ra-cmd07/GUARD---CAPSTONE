# BLE Trilateration Server

High-accuracy indoor positioning server using Bluetooth Low Energy (BLE) beacons and trilateration.

## Quick Start

### 1. Install Dependencies

```bash
pip install flask flask-sock
```

### 2. Configure Anchor Positions

Open `trilateration_server.py` and update line ~25 with your actual anchor GPS coordinates:

```python
ANCHOR_POSITIONS = {
    1: (8.47325810442503,  124.64987213026977),   # Replace with your coords
    2: (8.473279327880148, 124.65011352907634),   # Replace with your coords
    3: (8.473128110736846, 124.64999282967305),   # Replace with your coords
}
```

**How to get GPS coordinates:**
1. Open Google Maps on your phone
2. Go to where you'll place each ESP32 anchor
3. Long-press the location
4. Copy the coordinates (e.g., `8.473258, 124.649872`)

### 3. Start the Server

```bash
python trilateration_server.py
```

Expected output:
```
=======================================================
  BLE Trilateration Server  —  high-accuracy edition
  Listening on  http://0.0.0.0:8080
=======================================================
```

### 4. Test the Map

Open your browser: `http://localhost:8080`

You should see an interactive map with Leaflet/OpenStreetMap.

## Endpoints

### POST /update
Receives distance measurements from ESP32 anchors.

**Request body:**
```json
{
  "anchor_id": 1,
  "found": true,
  "distance": 8.23,
  "rssi": -65
}
```

### WebSocket /ws
Real-time position updates via WebSocket.

**Message format:**
```json
{
  "type": "position",
  "lat": 8.473258,
  "lng": 124.649872,
  "accuracy_m": 2.3,
  "anchors_used": 3,
  "anchors": [...]
}
```

### GET /status
System status and diagnostics.

## Features

✅ **Multilateration algorithm** - GPS-like positioning using 3+ beacons  
✅ **Kalman filtering** - Smooth, accurate tracking  
✅ **Median + EMA filtering** - Noise reduction  
✅ **Zone snapping** - Room-level accuracy (optional)  
✅ **Coasting mode** - Maintains last position when signal lost temporarily  
✅ **WebSocket broadcasting** - Real-time updates to frontend  
✅ **Embedded map** - Leaflet visualization included  

## Configuration

Edit `trilateration_server.py` to adjust:

```python
MIN_ANCHORS = 3                 # Minimum anchors for position fix
BROADCAST_INTERVAL = 1.0        # Update frequency (seconds)
MEASUREMENT_TIMEOUT = 5.0       # How long to keep readings (seconds)
EMA_ALPHA = 0.3                 # Smoothing factor (0-1)
KALMAN_Q = 0.1                  # Process noise
KALMAN_R = 2.0                  # Measurement noise
```

## Files

```
trilateration_server/
├── trilateration_server.py    # Main server
├── static/
│   └── map.html               # Embedded map visualization
└── README.md                   # This file
```

## Troubleshooting

### Server won't start
- Check Python version: `python --version` (need 3.7+)
- Install dependencies: `pip install flask flask-sock`

### No position showing
- Check that 3+ ESP32 anchors are posting data
- Verify `ANCHOR_POSITIONS` are correct GPS coordinates
- Look for `[UPDATE]` messages in server console

### Poor accuracy
- Spread anchors 10-20m apart in triangle formation
- Avoid metal walls and obstacles
- Add 4th anchor for redundancy

## Integration with AttendBox

The AttendBox frontend connects to this server via WebSocket:

1. Frontend loads `BLEPositioningMap` component
2. Component opens WebSocket to `ws://localhost:8080/ws`
3. Server broadcasts position updates every 1 second
4. Map displays real-time student location

See `STEP_BY_STEP_SETUP_GUIDE.md` in the parent directory for complete setup instructions.
