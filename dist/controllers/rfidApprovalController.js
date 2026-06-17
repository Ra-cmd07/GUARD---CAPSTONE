"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectRFID = detectRFID;
exports.getPendingRFID = getPendingRFID;
exports.approveRFID = approveRFID;
exports.rejectRFID = rejectRFID;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = __importDefault(require("../lib/db"));
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
        // Determine attendance status
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const session = now.getHours() < 12 ? 'AM' : 'PM';
        const timeStr = now.toTimeString().slice(0, 8);
        // Check if Time-In already exists today
        const [existingIn] = await db_1.default.execute(`SELECT id FROM attendance
       WHERE student_id = ? AND date = ? AND status IN ('Time-In','Late')`, [student.id, today]);
        let status;
        if (existingIn.length > 0) {
            status = 'Time-Out';
        }
        else {
            const hour = now.getHours();
            const min = now.getMinutes();
            status = (hour > 8 || (hour === 8 && min > 0)) ? 'Late' : 'Time-In';
        }
        // Prevent duplicate same status
        const [dupCheck] = await db_1.default.execute('SELECT id FROM attendance WHERE student_id = ? AND date = ? AND status = ?', [student.id, today, status]);
        if (dupCheck.length > 0) {
            // Mark as approved but don't record again
            await db_1.default.execute('UPDATE rfid_detections SET status = \'APPROVED\', approved_at = NOW(), approved_by = ? WHERE id = ?', [approved_by, id]);
            res.status(409).json({
                error: 'Already recorded',
                already_exists: true,
                student_name: student.name,
                status,
            });
            return;
        }
        // Save photo
        let photoPath = null;
        if (photo_base64) {
            const uploadsDir = path_1.default.join(__dirname, '..', 'uploads', 'scans');
            if (!fs_1.default.existsSync(uploadsDir))
                fs_1.default.mkdirSync(uploadsDir, { recursive: true });
            const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const filename = `rfid_${Date.now()}_${student.name.replace(/\s+/g, '_')}.jpg`;
            fs_1.default.writeFileSync(path_1.default.join(uploadsDir, filename), buffer);
            photoPath = `/uploads/scans/${filename}`;
        }
        // Insert attendance
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
            photoPath,
        ]);
        const attendanceId = attResult.insertId;
        // Log photo
        if (photoPath) {
            await db_1.default.execute('INSERT INTO scan_photos (attendance_id, student_name, status, photo_path) VALUES (?, ?, ?, ?)', [attendanceId, student.name, status, photoPath]);
        }
        // Update detection status
        await db_1.default.execute('UPDATE rfid_detections SET status = \'APPROVED\', approved_at = NOW(), approved_by = ? WHERE id = ?', [approved_by, id]);
        // Send SMS to parents
        const [guardians] = await db_1.default.execute('SELECT * FROM parents_teachers WHERE student_id = ?', [student.id]);
        const statusEmoji = status === 'Time-In' ? '✅' : status === 'Late' ? '⏰' : '🔔';
        const timeDisplay = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
        const message = `${statusEmoji} ATTENDBOX: ${student.name} has ${status === 'Time-In' ? 'arrived at school' : status === 'Time-Out' ? 'left school' : 'arrived LATE'} at ${timeDisplay}. Date: ${today}.`;
        for (const g of guardians) {
            if (g.contact_number) {
                const sent = await sendSms(g.contact_number, message);
                await db_1.default.execute(`INSERT INTO sms_logs (attendance_id, student_name, parent_name, phone_number, message, status, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`, [attendanceId, student.name, g.name, g.contact_number, message,
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
            photo_path: photoPath,
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
