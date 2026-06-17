"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBleLocation = updateBleLocation;
exports.getStudentLocation = getStudentLocation;
exports.getBeacons = getBeacons;
exports.getCampusMap = getCampusMap;
const db_1 = __importDefault(require("../lib/db"));
// ─── POST /api/location/ble-update ───────────────────────────────────
// Receives BLE beacon detection from student's device or BLE gateway
// Auto-marks attendance at gate beacons (Hybrid mode with photo support)
async function updateBleLocation(req, res) {
    try {
        const { mac_address, // Student's device MAC
        beacon_id, // Detected beacon ID
        signal_strength, // RSSI value (optional)
        photo_base64, // Optional photo for attendance (base64 string)
         } = req.body;
        if (!mac_address || !beacon_id) {
            res.status(400).json({ error: 'mac_address and beacon_id are required' });
            return;
        }
        // Find student by MAC address
        const [studentRows] = await db_1.default.execute('SELECT id, name FROM students WHERE REPLACE(REPLACE(LOWER(mac_address), ":", ""), "-", "") = ? AND is_active = 1', [mac_address.toLowerCase().replace(/[:\-]/g, '')]);
        const student = studentRows[0];
        if (!student) {
            res.status(404).json({ error: 'Student not found with this MAC address' });
            return;
        }
        // Get beacon information
        const [beaconRows] = await db_1.default.execute('SELECT * FROM ble_beacons WHERE beacon_id = ? AND is_active = 1', [beacon_id]);
        const beacon = beaconRows[0];
        if (!beacon) {
            res.status(404).json({ error: 'Beacon not found or inactive' });
            return;
        }
        // Mark previous locations as inactive
        await db_1.default.execute('UPDATE student_locations SET is_active = 0 WHERE student_id = ? AND is_active = 1', [student.id]);
        // Insert new location record
        const [result] = await db_1.default.execute(`INSERT INTO student_locations 
       (student_id, student_name, mac_address, beacon_id, location_name, location_type, coordinates, signal_strength)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            student.id,
            student.name,
            mac_address,
            beacon_id,
            beacon.location_name,
            beacon.location_type,
            beacon.coordinates,
            signal_strength || null,
        ]);
        // Update beacon last_ping
        await db_1.default.execute('UPDATE ble_beacons SET last_ping = NOW() WHERE beacon_id = ?', [beacon_id]);
        // ═══════════════════════════════════════════════════════════════════
        // PENDING APPROVAL MODE: Store detection, don't record attendance yet
        // Kiosk will show pending detection and guard must approve
        // ═══════════════════════════════════════════════════════════════════
        let detectionId = null;
        let detectionStored = false;
        if (beacon.location_type === 'gate') {
            try {
                // Store as pending detection (not attendance yet!)
                const [insertResult] = await db_1.default.execute(`INSERT INTO ble_detections 
           (student_id, student_name, mac_address, beacon_id, location_name, rssi, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`, [student.id, student.name, mac_address, beacon_id, beacon.location_name, signal_strength || null]);
                detectionId = insertResult.insertId;
                detectionStored = true;
                console.log(`📡 BLE Detection stored (PENDING): ${student.name} at ${beacon.location_name}`);
                console.log(`   Detection ID: ${detectionId} - Waiting for kiosk approval...`);
            }
            catch (detectionErr) {
                console.error('Error storing BLE detection:', detectionErr);
            }
        }
        res.status(201).json({
            message: 'BLE detection stored - awaiting approval',
            locationId: result.insertId,
            student_name: student.name,
            location: beacon.location_name,
            building: beacon.building,
            floor: beacon.floor,
            detection_stored: detectionStored,
            detection_id: detectionId,
            status: 'pending_approval',
        });
    }
    catch (err) {
        console.error('updateBleLocation error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/location/student/:studentId ────────────────────────────
// Get current and historical location for a specific student
async function getStudentLocation(req, res) {
    try {
        const { studentId } = req.params;
        const { history } = req.query; // ?history=true to get full history
        // Check permission: parents can only view their own children
        if (req.user?.role === 'parent' && req.user?.profileId) {
            const [linkCheck] = await db_1.default.execute('SELECT 1 FROM parent_student WHERE parent_id = ? AND student_id = ?', [req.user.profileId, studentId]);
            if (linkCheck.length === 0) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
        }
        if (history === 'true') {
            // Get location history (last 24 hours)
            const [rows] = await db_1.default.execute(`SELECT 
          sl.id, sl.location_name, sl.location_type, sl.coordinates,
          sl.timestamp, sl.signal_strength,
          bb.building, bb.floor
         FROM student_locations sl
         LEFT JOIN ble_beacons bb ON sl.beacon_id = bb.beacon_id
         WHERE sl.student_id = ? AND sl.timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         ORDER BY sl.timestamp DESC
         LIMIT 100`, [studentId]);
            res.json(rows);
        }
        else {
            // Get current location only
            const [rows] = await db_1.default.execute('SELECT * FROM v_student_current_location WHERE student_id = ?', [studentId]);
            if (rows.length === 0) {
                res.json({
                    student_id: studentId,
                    location_name: 'Unknown',
                    location_status: 'offline',
                    message: 'No recent location data',
                });
            }
            else {
                res.json(rows[0]);
            }
        }
    }
    catch (err) {
        console.error('getStudentLocation error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/location/beacons ───────────────────────────────────────
// Get all active BLE beacons (for admin/map display)
async function getBeacons(req, res) {
    try {
        const [rows] = await db_1.default.execute('SELECT * FROM ble_beacons WHERE is_active = 1 ORDER BY building, floor, name');
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/location/campus-map ────────────────────────────────────
// Get all students' current locations (for admin dashboard)
async function getCampusMap(req, res) {
    try {
        // Only admin and teachers can view campus map
        if (req.user?.role !== 'admin' && req.user?.role !== 'teacher') {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const [students] = await db_1.default.execute(`SELECT * FROM v_student_current_location 
       WHERE location_status IN ('active', 'recent')
       ORDER BY last_seen DESC`);
        const [beacons] = await db_1.default.execute('SELECT * FROM ble_beacons WHERE is_active = 1');
        res.json({
            students,
            beacons,
            timestamp: new Date(),
        });
    }
    catch (err) {
        console.error('getCampusMap error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
