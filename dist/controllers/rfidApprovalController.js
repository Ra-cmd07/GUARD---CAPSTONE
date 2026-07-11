"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectRFID = detectRFID;
exports.getPendingRFID = getPendingRFID;
exports.approveRFID = approveRFID;
exports.rejectRFID = rejectRFID;
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
// ─── POST /api/rfid/detect ───────────────────────────────────────────
// ESP32 sends RFID detection → Store as PENDING
async function detectRFID(req, res) {
    try {
        const { rfid_uid, kiosk_id } = req.body;
        if (!rfid_uid) {
            res.status(400).json({ error: 'rfid_uid is required' });
            return;
        }
        console.log(`📡 RFID detected: ${rfid_uid}`);
        // Find student by RFID
        const [students] = await db_1.default.execute('SELECT * FROM students WHERE UPPER(rfid_uid) = UPPER(?) AND is_active = 1', [rfid_uid]);
        if (students.length === 0) {
            res.status(404).json({ error: 'Student not found or not registered' });
            return;
        }
        const student = students[0];
        // Check for existing pending detection (last 30 seconds)
        const [existing] = await db_1.default.execute(`SELECT id FROM rfid_detections 
       WHERE rfid_uid = ? 
       AND status = 'PENDING_APPROVAL'
       AND detected_at >= DATE_SUB(NOW(), INTERVAL 30 SECOND)`, [rfid_uid]);
        if (existing.length > 0) {
            res.status(409).json({
                error: 'Detection already pending approval',
                detection_id: existing[0].id
            });
            return;
        }
        // Insert pending detection
        const [result] = await db_1.default.execute(`INSERT INTO rfid_detections 
       (rfid_uid, student_id, student_name, kiosk_id, status, detected_at)
       VALUES (?, ?, ?, ?, 'PENDING_APPROVAL', NOW())`, [rfid_uid, student.id, student.name, kiosk_id || null]);
        const detectionId = result.insertId;
        console.log(`✅ RFID detection stored as PENDING (ID: ${detectionId})`);
        res.status(201).json({
            message: 'Detection stored, awaiting approval',
            detection_id: detectionId,
            student_id: student.id,
            student_name: student.name,
            status: 'PENDING_APPROVAL',
        });
    }
    catch (err) {
        console.error('detectRFID error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/rfid/pending ───────────────────────────────────────────
// Kiosk polls for pending RFID detections
async function getPendingRFID(req, res) {
    try {
        const seconds = Number(req.query.seconds) || 60;
        const kioskId = req.query.kiosk_id ? Number(req.query.kiosk_id) : null;
        let query = `
      SELECT 
        r.id,
        r.rfid_uid,
        r.student_id,
        r.student_name,
        r.kiosk_id,
        r.status,
        r.detected_at,
        s.lrn,
        s.grade,
        s.section,
        s.gender
      FROM rfid_detections r
      LEFT JOIN students s ON r.student_id = s.id
      WHERE r.status = 'PENDING_APPROVAL'
      AND r.detected_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
    `;
        const params = [seconds];
        if (kioskId !== null) {
            query += ' AND r.kiosk_id = ?';
            params.push(kioskId);
        }
        query += ' ORDER BY r.detected_at ASC LIMIT 1';
        const [rows] = await db_1.default.execute(query, params);
        res.json(rows);
    }
    catch (err) {
        console.error('getPendingRFID error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── POST /api/rfid/approve/:id ──────────────────────────────────────
// Guard approves RFID detection → Record attendance
async function approveRFID(req, res) {
    try {
        const { id } = req.params;
        const { photo_base64, approved_by = 'kiosk_guard' } = req.body;
        console.log(`👍 Approving RFID detection ID: ${id}`);
        // Get detection details
        const [detections] = await db_1.default.execute('SELECT * FROM rfid_detections WHERE id = ? AND status = \'PENDING_APPROVAL\'', [id]);
        if (detections.length === 0) {
            res.status(404).json({ error: 'Detection not found or already processed' });
            return;
        }
        const detection = detections[0];
        // Get student details
        const [students] = await db_1.default.execute('SELECT * FROM students WHERE id = ?', [detection.student_id]);
        if (students.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        const student = students[0];
        // Determine attendance status (Philippines timezone UTC+8)
        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const today = phTime.toISOString().split('T')[0];
        // Format time in 12-hour format with AM/PM
        // Use getUTC methods since phTime is already adjusted to PH time
        const hour24 = phTime.getUTCHours();
        const minutes = phTime.getUTCMinutes().toString().padStart(2, '0');
        const seconds = phTime.getUTCSeconds().toString().padStart(2, '0');
        const hour12 = hour24 % 12 || 12;
        const ampm = hour24 < 12 ? 'AM' : 'PM';
        const timeStr = `${hour12}:${minutes}:${seconds} ${ampm}`;
        const localHour = hour24;
        const session = hour24 < 12 ? 'AM' : 'PM';
        // AUTO-TOGGLE: Check last attendance record for THIS SESSION (AM/PM) to determine next status
        const [lastRecord] = await db_1.default.execute(`SELECT status FROM attendance
       WHERE student_id = ? AND date = ? AND session = ?
       ORDER BY timestamp DESC
       LIMIT 1`, [student.id, today, session]);
        let status;
        if (lastRecord.length > 0) {
            const lastStatus = lastRecord[0].status;
            // Toggle based on last status IN THIS SESSION
            if (lastStatus === 'Time-Out') {
                // Last was Time-Out, so next is Time-In (check if late)
                const hour = phTime.getUTCHours();
                const min = phTime.getUTCMinutes();
                status = (hour > 8 || (hour === 8 && min > 0)) ? 'Late' : 'Time-In';
            }
            else {
                // Last was Time-In or Late, so next is Time-Out
                status = 'Time-Out';
            }
        }
        else {
            // No record for this session yet, first scan is Time-In (check if late)
            const hour = phTime.getUTCHours();
            const min = phTime.getUTCMinutes();
            status = (hour > 8 || (hour === 8 && min > 0)) ? 'Late' : 'Time-In';
        }
        // REMOVED: Duplicate check - now allows unlimited attendance records per day
        // Insert attendance IMMEDIATELY (don't wait for photo)
        const [attResult] = await db_1.default.execute(`INSERT INTO attendance
       (student_id, student_name, lrn, gender, grade, section,
        kiosk_id, scan_method, status, session, date, time_in, time_out,
        photo_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            student.id, student.name, student.lrn, student.gender,
            student.grade, student.section,
            detection.kiosk_id || null, 'RFID', status, session, today,
            status === 'Time-In' || status === 'Late' ? timeStr : null,
            status === 'Time-Out' ? timeStr : null,
            null, // Photo path will be updated later
        ]);
        const attendanceId = attResult.insertId;
        // Upload photo to Cloudinary in BACKGROUND (async)
        if (photo_base64) {
            (async () => {
                try {
                    const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
                    const filename = `rfid_${Date.now()}_${student.name.replace(/\s+/g, '_')}`;
                    const uploadResult = await cloudinary_1.cloudinary.uploader.upload(`data:image/jpeg;base64,${base64Data}`, {
                        folder: 'attendbox/scans',
                        public_id: filename,
                        resource_type: 'image',
                        transformation: [{ width: 800, height: 800, crop: 'limit' }]
                    });
                    const photoPath = uploadResult.secure_url;
                    console.log('📸 RFID photo uploaded to Cloudinary:', photoPath);
                    // Update attendance record with photo path
                    await db_1.default.execute('UPDATE attendance SET photo_path = ? WHERE id = ?', [photoPath, attendanceId]);
                    // Log photo
                    // Log photo
                    await db_1.default.execute('INSERT INTO scan_photos (attendance_id, student_name, status, photo_path) VALUES (?, ?, ?, ?)', [attendanceId, student.name, status, photoPath]);
                }
                catch (err) {
                    console.error('Background RFID photo upload failed:', err);
                }
            })();
        }
        // Update detection status
        await db_1.default.execute('UPDATE rfid_detections SET status = \'APPROVED\', approved_at = NOW(), approved_by = ? WHERE id = ?', [approved_by, id]);
        // Send SMS to parents using parent_student junction table
        const [guardians] = await db_1.default.execute(`SELECT p.name, p.contact, ps.relationship
       FROM parent_student ps
       JOIN parents p ON ps.parent_id = p.id
       WHERE ps.student_id = ?`, [student.id]);
        const statusEmoji = status === 'Time-In' ? '✅' : status === 'Late' ? '⏰' : '🔔';
        const timeDisplay = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
        const message = `${statusEmoji} ATTENDBOX: ${student.name} has ${status === 'Time-In' ? 'arrived at school' : status === 'Time-Out' ? 'left school' : 'arrived LATE'} at ${timeDisplay}. Date: ${today}.`;
        for (const g of guardians) {
            if (g.contact) { // Changed from g.contact_number to g.contact
                const sent = await sendSms(g.contact, message);
                await db_1.default.execute(`INSERT INTO sms_logs (attendance_id, student_name, parent_name, phone_number, message, status, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`, [attendanceId, student.name, g.name, g.contact, message,
                    sent ? 'sent' : 'failed', sent ? new Date() : null]);
            }
        }
        console.log(`✅ RFID approved → Attendance recorded (ID: ${attendanceId})`);
        res.status(201).json({
            message: 'Attendance approved and recorded',
            attendance_id: attendanceId,
            student_name: student.name,
            status,
            session,
            date: today,
            time: timeStr,
            photo_path: null, // Photo uploaded in background
        });
    }
    catch (err) {
        console.error('approveRFID error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── POST /api/rfid/reject/:id ───────────────────────────────────────
// Guard rejects RFID detection
async function rejectRFID(req, res) {
    try {
        const { id } = req.params;
        const { reason = 'Rejected by guard', rejected_by = 'kiosk_guard' } = req.body;
        console.log(`👎 Rejecting RFID detection ID: ${id}`);
        const [result] = await db_1.default.execute('UPDATE rfid_detections SET status = \'REJECTED\', rejected_at = NOW(), rejected_by = ?, rejection_reason = ? WHERE id = ? AND status = \'PENDING_APPROVAL\'', [rejected_by, reason, id]);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Detection not found or already processed' });
            return;
        }
        res.json({ message: 'Detection rejected' });
    }
    catch (err) {
        console.error('rejectRFID error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
