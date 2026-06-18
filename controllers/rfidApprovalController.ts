import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import pool from '../lib/db';
import { cloudinary } from '../config/cloudinary';

// Lightweight SMS helper
async function sendSms(phone: string, message: string): Promise<boolean> {
  try {
    console.log(`📱 SMS → ${phone}: ${message}`);
    return true;
  } catch {
    return false;
  }
}

// ─── POST /api/rfid/detect ───────────────────────────────────────────
// ESP32 sends RFID detection → Store as PENDING
export async function detectRFID(req: Request, res: Response): Promise<void> {
  try {
    const { rfid_uid, kiosk_id } = req.body;

    if (!rfid_uid) {
      res.status(400).json({ error: 'rfid_uid is required' });
      return;
    }

    console.log(`📡 RFID detected: ${rfid_uid}`);

    // Find student by RFID
    const [students] = await pool.execute(
      'SELECT * FROM students WHERE UPPER(rfid_uid) = UPPER(?) AND is_active = 1',
      [rfid_uid]
    ) as any[];

    if ((students as any[]).length === 0) {
      res.status(404).json({ error: 'Student not found or not registered' });
      return;
    }

    const student = (students as any[])[0];

    // Check for existing pending detection (last 30 seconds)
    const [existing] = await pool.execute(
      `SELECT id FROM rfid_detections 
       WHERE rfid_uid = ? 
       AND status = 'PENDING_APPROVAL'
       AND detected_at >= DATE_SUB(NOW(), INTERVAL 30 SECOND)`,
      [rfid_uid]
    ) as any[];

    if ((existing as any[]).length > 0) {
      res.status(409).json({ 
        error: 'Detection already pending approval',
        detection_id: (existing as any[])[0].id 
      });
      return;
    }

    // Insert pending detection
    const [result] = await pool.execute(
      `INSERT INTO rfid_detections 
       (rfid_uid, student_id, student_name, kiosk_id, status, detected_at)
       VALUES (?, ?, ?, ?, 'PENDING_APPROVAL', NOW())`,
      [rfid_uid, student.id, student.name, kiosk_id || null]
    ) as any[];

    const detectionId = (result as any).insertId;

    console.log(`✅ RFID detection stored as PENDING (ID: ${detectionId})`);

    res.status(201).json({
      message: 'Detection stored, awaiting approval',
      detection_id: detectionId,
      student_id: student.id,
      student_name: student.name,
      status: 'PENDING_APPROVAL',
    });
  } catch (err) {
    console.error('detectRFID error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /api/rfid/pending ───────────────────────────────────────────
// Kiosk polls for pending RFID detections
export async function getPendingRFID(req: Request, res: Response): Promise<void> {
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

    const params: any[] = [seconds];

    if (kioskId !== null) {
      query += ' AND r.kiosk_id = ?';
      params.push(kioskId);
    }

    query += ' ORDER BY r.detected_at ASC LIMIT 1';

    const [rows] = await pool.execute(query, params) as any[];

    res.json(rows);
  } catch (err) {
    console.error('getPendingRFID error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── POST /api/rfid/approve/:id ──────────────────────────────────────
// Guard approves RFID detection → Record attendance
export async function approveRFID(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { photo_base64, approved_by = 'kiosk_guard' } = req.body;

    console.log(`👍 Approving RFID detection ID: ${id}`);

    // Get detection details
    const [detections] = await pool.execute(
      'SELECT * FROM rfid_detections WHERE id = ? AND status = \'PENDING_APPROVAL\'',
      [id]
    ) as any[];

    if ((detections as any[]).length === 0) {
      res.status(404).json({ error: 'Detection not found or already processed' });
      return;
    }

    const detection = (detections as any[])[0];

    // Get student details
    const [students] = await pool.execute(
      'SELECT * FROM students WHERE id = ?',
      [detection.student_id]
    ) as any[];

    if ((students as any[]).length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const student = (students as any[])[0];

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

    // Check if Time-In already exists today
    const [existingIn] = await pool.execute(
      `SELECT id FROM attendance
       WHERE student_id = ? AND date = ? AND status IN ('Time-In','Late')`,
      [student.id, today]
    ) as any[];

    let status: string;
    if ((existingIn as any[]).length > 0) {
      status = 'Time-Out';
    } else {
      // Late check: after 8:00 AM Philippines time
      const hour = phTime.getUTCHours();
      const min = phTime.getUTCMinutes();
      status = (hour > 8 || (hour === 8 && min > 0)) ? 'Late' : 'Time-In';
    }

    // Prevent duplicate same status
    const [dupCheck] = await pool.execute(
      'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND status = ?',
      [student.id, today, status]
    ) as any[];

    if ((dupCheck as any[]).length > 0) {
      // Mark as approved but don't record again
      await pool.execute(
        'UPDATE rfid_detections SET status = \'APPROVED\', approved_at = NOW(), approved_by = ? WHERE id = ?',
        [approved_by, id]
      );

      res.status(409).json({
        error: 'Already recorded',
        already_exists: true,
        student_name: student.name,
        status,
      });
      return;
    }

    // Save photo to Cloudinary
    let photoPath: string | null = null;
    if (photo_base64) {
      try {
        const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
        const filename = `rfid_${Date.now()}_${student.name.replace(/\s+/g, '_')}`;
        
        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(
          `data:image/jpeg;base64,${base64Data}`,
          {
            folder: 'attendbox/scans',
            public_id: filename,
            resource_type: 'image',
            transformation: [{ width: 800, height: 800, crop: 'limit' }]
          }
        );
        
        photoPath = uploadResult.secure_url;
        console.log('📸 RFID photo uploaded to Cloudinary:', photoPath);
      } catch (err) {
        console.error('Failed to upload RFID photo to Cloudinary:', err);
      }
    }

    // Insert attendance
    const [attResult] = await pool.execute(
      `INSERT INTO attendance
       (student_id, student_name, lrn, gender, grade, section,
        kiosk_id, scan_method, status, session, date, time_in, time_out,
        photo_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student.id, student.name, student.lrn, student.gender,
        student.grade, student.section,
        detection.kiosk_id || null, 'RFID', status, session, today,
        status === 'Time-In' || status === 'Late' ? timeStr : null,
        status === 'Time-Out' ? timeStr : null,
        photoPath,
      ]
    ) as any[];

    const attendanceId = (attResult as any).insertId;

    // Log photo
    if (photoPath) {
      await pool.execute(
        'INSERT INTO scan_photos (attendance_id, student_name, status, photo_path) VALUES (?, ?, ?, ?)',
        [attendanceId, student.name, status, photoPath]
      );
    }

    // Update detection status
    await pool.execute(
      'UPDATE rfid_detections SET status = \'APPROVED\', approved_at = NOW(), approved_by = ? WHERE id = ?',
      [approved_by, id]
    );

    // Send SMS to parents
    const [guardians] = await pool.execute(
      'SELECT * FROM parents_teachers WHERE student_id = ?',
      [student.id]
    ) as any[];

    const statusEmoji = status === 'Time-In' ? '✅' : status === 'Late' ? '⏰' : '🔔';
    const timeDisplay = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
    const message = `${statusEmoji} ATTENDBOX: ${student.name} has ${status === 'Time-In' ? 'arrived at school' : status === 'Time-Out' ? 'left school' : 'arrived LATE'} at ${timeDisplay}. Date: ${today}.`;

    for (const g of guardians as any[]) {
      if (g.contact_number) {
        const sent = await sendSms(g.contact_number, message);
        await pool.execute(
          `INSERT INTO sms_logs (attendance_id, student_name, parent_name, phone_number, message, status, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [attendanceId, student.name, g.name, g.contact_number, message,
           sent ? 'sent' : 'failed', sent ? new Date() : null]
        );
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
  } catch (err) {
    console.error('approveRFID error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── POST /api/rfid/reject/:id ───────────────────────────────────────
// Guard rejects RFID detection
export async function rejectRFID(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason = 'Rejected by guard', rejected_by = 'kiosk_guard' } = req.body;

    console.log(`👎 Rejecting RFID detection ID: ${id}`);

    const [result] = await pool.execute(
      'UPDATE rfid_detections SET status = \'REJECTED\', rejected_at = NOW(), rejected_by = ?, rejection_reason = ? WHERE id = ? AND status = \'PENDING_APPROVAL\'',
      [rejected_by, reason, id]
    ) as any[];

    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: 'Detection not found or already processed' });
      return;
    }

    res.json({ message: 'Detection rejected' });
  } catch (err) {
    console.error('rejectRFID error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
