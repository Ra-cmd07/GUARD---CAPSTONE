"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingDetections = getPendingDetections;
exports.approveDetection = approveDetection;
exports.rejectDetection = rejectDetection;
const db_1 = __importDefault(require("../lib/db"));
const cloudinary_1 = require("../config/cloudinary");
// Lightweight SMS helper
async function sendSms(phone, message) {
    try {
        console.log(`📱 SMS → ${phone}: ${message}`);
        return true;
    }
    catch {
        return false;
    }
}
// ─── GET /api/ble/pending ─────────────────────────────────────────────
// Get pending BLE detections for kiosk approval
async function getPendingDetections(req, res) {
    try {
        const seconds = Number(req.query.seconds) || 60; // Last 60 seconds by default
        const [rows] = await db_1.default.execute(`SELECT 
        id,
        student_id,
        student_name,
        mac_address,
        beacon_id,
        location_name,
        rssi,
        status,
        detected_at,
        TIMESTAMPDIFF(SECOND, detected_at, NOW()) as seconds_ago
       FROM ble_detections
       WHERE status = 'pending'
       AND detected_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
       ORDER BY detected_at DESC`, [seconds]);
        res.json(rows);
    }
    catch (err) {
        console.error('getPendingDetections error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── POST /api/ble/approve/:id ────────────────────────────────────────
// Approve a pending BLE detection and record attendance
async function approveDetection(req, res) {
    try {
        const { id } = req.params;
        const { photo_base64, approved_by } = req.body;
        // Get detection details
        const [detections] = await db_1.default.execute('SELECT * FROM ble_detections WHERE id = ? AND status = \"pending\"', [id]);
        if (detections.length === 0) {
            res.status(404).json({ error: 'Detection not found or already processed' });
            return;
        }
        const detection = detections[0];
        // Get full student details (including lrn, gender, grade, section)
        const [students] = await db_1.default.execute('SELECT * FROM students WHERE id = ?', [detection.student_id]);
        if (students.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        const student = students[0];
        console.log('🔍 DEBUG: Student data from DB:', {
            id: student.id,
            name: student.name,
            lrn: student.lrn,
            gender: student.gender,
            grade: student.grade,
            section: student.section
        });
        // Handle photo upload to Cloudinary if provided
        let photoPath = null;
        if (photo_base64) {
            try {
                const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
                const filename = `ble_approved_${Date.now()}_${student.name.replace(/\s+/g, '_')}`;
                // Upload to Cloudinary
                const uploadResult = await cloudinary_1.cloudinary.uploader.upload(`data:image/jpeg;base64,${base64Data}`, {
                    folder: 'attendbox/scans',
                    public_id: filename,
                    resource_type: 'image',
                    transformation: [{ width: 800, height: 800, crop: 'limit' }]
                });
                photoPath = uploadResult.secure_url;
                console.log('📸 BLE photo uploaded to Cloudinary:', photoPath);
            }
            catch (err) {
                console.error('Failed to upload BLE photo to Cloudinary:', err);
            }
        }
        // Calculate Philippines time (UTC+8)
        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const localDate = phTime.toISOString().split('T')[0];
        // Format time in 12-hour format with AM/PM
        // Use getUTC methods since phTime is already adjusted to PH time
        const hour24 = phTime.getUTCHours();
        const minutes = phTime.getUTCMinutes().toString().padStart(2, '0');
        const seconds = phTime.getUTCSeconds().toString().padStart(2, '0');
        const hour12 = hour24 % 12 || 12;
        const ampm = hour24 < 12 ? 'AM' : 'PM';
        const localTime = `${hour12}:${minutes}:${seconds} ${ampm}`;
        const localHour = hour24;
        const localMinute = phTime.getUTCMinutes();
        const session = hour24 < 12 ? 'AM' : 'PM';
        // Check if attendance already exists for today
        const [existingAttendance] = await db_1.default.execute(`SELECT id, status, date, time_in, time_out 
       FROM attendance 
       WHERE student_id = ? AND date = ?`, [student.id, localDate]);
        let attendanceId;
        let attendanceStatus;
        let status;
        if (existingAttendance.length === 0) {
            // No attendance today - this is their FIRST scan
            // Determine if Time-In or Late based on time
            if (localHour > 8 || (localHour === 8 && localMinute > 0)) {
                status = 'Late';
            }
            else {
                status = 'Time-In';
            }
            console.log('🔍 DEBUG: Inserting attendance with values:', {
                student_id: student.id,
                student_name: student.name,
                lrn: student.lrn,
                gender: student.gender,
                grade: student.grade,
                section: student.section,
                kiosk_id: detection.kiosk_id || null,
                scan_method: 'BLE',
                status: status
            });
            const [insertResult] = await db_1.default.execute(`INSERT INTO attendance 
         (student_id, student_name, lrn, gender, grade, section, kiosk_id, 
          scan_method, status, session, date, time_in, photo_path) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'BLE', ?, ?, ?, ?, ?)`, [
                student.id, student.name, student.lrn, student.gender,
                student.grade, student.section, detection.kiosk_id || null,
                status, session, localDate, localTime, photoPath
            ]);
            attendanceId = insertResult.insertId;
            attendanceStatus = status;
            console.log(`✅ Attendance APPROVED: ${student.name} ${status === 'Late' ? 'LATE' : 'checked IN'}`);
        }
        else {
            const existing = existingAttendance[0];
            // If already checked in, mark CHECK OUT
            if (existing.time_in && !existing.time_out) {
                await db_1.default.execute(`UPDATE attendance 
           SET time_out = ?, status = 'Time-Out'${photoPath ? ', photo_path = ?' : ''} 
           WHERE id = ?`, photoPath ? [localTime, photoPath, existing.id] : [localTime, existing.id]);
                attendanceId = existing.id;
                attendanceStatus = 'Time-Out';
                console.log(`✅ Attendance APPROVED: ${student.name} checked OUT`);
            }
            else {
                attendanceId = existing.id;
                attendanceStatus = existing.status;
            }
        }
        // Send SMS notification to parents/guardians
        const [guardians] = await db_1.default.execute('SELECT * FROM parents_teachers WHERE student_id = ?', [student.id]);
        const statusEmoji = attendanceStatus === 'Time-In' ? '✅' : attendanceStatus === 'Late' ? '⏰' : '🔔';
        const message = `${statusEmoji} ATTENDBOX: ${student.name} has ${attendanceStatus === 'Time-In' ? 'arrived at school' : attendanceStatus === 'Time-Out' ? 'left school' : 'arrived LATE'} at ${localTime}. Date: ${localDate}.`;
        for (const g of guardians) {
            if (g.contact_number) {
                const sent = await sendSms(g.contact_number, message);
                await db_1.default.execute(`INSERT INTO sms_logs (attendance_id, student_name, parent_name, phone_number, message, status, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`, [attendanceId, student.name, g.name, g.contact_number, message,
                    sent ? 'sent' : 'failed', sent ? new Date() : null]);
            }
        }
        // Update detection status to approved
        await db_1.default.execute(`UPDATE ble_detections 
       SET status = 'approved', approved_at = NOW(), approved_by = ?, attendance_id = ?
       WHERE id = ?`, [approved_by || 'kiosk', attendanceId, id]);
        res.status(201).json({
            message: 'Detection approved and attendance recorded',
            detection_id: id,
            attendance_id: attendanceId,
            student_name: student.name,
            status: attendanceStatus,
            date: localDate,
            time: localTime,
            photo_saved: photoPath ? true : false,
        });
    }
    catch (err) {
        console.error('approveDetection error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── POST /api/ble/reject/:id ─────────────────────────────────────────
// Reject a pending BLE detection (don't record attendance)
async function rejectDetection(req, res) {
    try {
        const { id } = req.params;
        const { reason, rejected_by } = req.body;
        const [result] = await db_1.default.execute(`UPDATE ble_detections 
       SET status = 'rejected', approved_at = NOW(), approved_by = ?
       WHERE id = ? AND status = 'pending'`, [rejected_by || 'kiosk', id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Detection not found or already processed' });
            return;
        }
        console.log(`❌ Detection REJECTED: ID ${id}${reason ? ` - ${reason}` : ''}`);
        res.json({
            message: 'Detection rejected',
            detection_id: id,
        });
    }
    catch (err) {
        console.error('rejectDetection error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
