import { Request, Response } from 'express';
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

// ─── GET /api/ble/pending ─────────────────────────────────────────────
// Get pending BLE detections for kiosk approval
export async function getPendingDetections(req: Request, res: Response): Promise<void> {
  try {
    const seconds = Number(req.query.seconds) || 60; // Last 60 seconds by default
    
    const [rows] = await pool.execute(
      `SELECT 
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
       ORDER BY detected_at DESC`,
      [seconds]
    ) as any[];

    res.json(rows);
  } catch (err) {
    console.error('getPendingDetections error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── POST /api/ble/approve/:id ────────────────────────────────────────
// Approve a pending BLE detection and record attendance
export async function approveDetection(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { photo_base64, approved_by } = req.body;

    // Get detection details
    const [detections]: any = await pool.execute(
      'SELECT * FROM ble_detections WHERE id = ? AND status = \"pending\"',
      [id]
    );

    if ((detections as any[]).length === 0) {
      res.status(404).json({ error: 'Detection not found or already processed' });
      return;
    }

    const detection = (detections as any[])[0];

    // Get full student details (including lrn, gender, grade, section)
    const [students] = await pool.execute(
      'SELECT * FROM students WHERE id = ?',
      [detection.student_id]
    ) as any[];

    if ((students as any[]).length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const student = (students as any[])[0];

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
        console.log('📸 BLE photo uploaded to Cloudinary:', photoPath);
      } catch (err) {
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

    // AUTO-TOGGLE: Check last attendance record for THIS SESSION (AM/PM) to determine next status
    const [lastRecord] = await pool.execute(
      `SELECT status FROM attendance
       WHERE student_id = ? AND date = ? AND session = ?
       ORDER BY timestamp DESC
       LIMIT 1`,
      [student.id, localDate, session]
    ) as any[];

    let status: string;
    let attendanceId;
    let attendanceStatus;
    
    if ((lastRecord as any[]).length > 0) {
      const lastStatus = (lastRecord as any[])[0].status;
      
      // Toggle based on last status IN THIS SESSION
      if (lastStatus === 'Time-Out') {
        // Last was Time-Out, so next is Time-In (check if late)
        status = (localHour > 8 || (localHour === 8 && localMinute > 0)) ? 'Late' : 'Time-In';
      } else {
        // Last was Time-In or Late, so next is Time-Out
        status = 'Time-Out';
      }
    } else {
      // No record for this session yet, first scan is Time-In (check if late)
      status = (localHour > 8 || (localHour === 8 && localMinute > 0)) ? 'Late' : 'Time-In';
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
      status: status,
      session: session
    });
    
    // Insert new attendance record (session-based)
    const [insertResult] = await pool.execute(
      `INSERT INTO attendance 
       (student_id, student_name, lrn, gender, grade, section, kiosk_id, 
        scan_method, status, session, date, time_in, time_out, photo_path) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'BLE', ?, ?, ?, ?, ?, ?)`,
      [
        student.id, student.name, student.lrn, student.gender,
        student.grade, student.section, detection.kiosk_id || null,
        status, session, localDate,
        status === 'Time-In' || status === 'Late' ? localTime : null,
        status === 'Time-Out' ? localTime : null,
        photoPath
      ]
    ) as any[];
    
    attendanceId = (insertResult as any).insertId;
    attendanceStatus = status;
    
    console.log(`✅ Attendance APPROVED (${session}): ${student.name} ${status === 'Late' ? 'LATE' : status}`);

    // Send SMS notification to parents/guardians
    const [guardians] = await pool.execute(
      'SELECT * FROM parents_teachers WHERE student_id = ?',
      [student.id]
    ) as any[];

    const statusEmoji = attendanceStatus === 'Time-In' ? '✅' : attendanceStatus === 'Late' ? '⏰' : '🔔';
    const message = `${statusEmoji} ATTENDBOX: ${student.name} has ${attendanceStatus === 'Time-In' ? 'arrived at school' : attendanceStatus === 'Time-Out' ? 'left school' : 'arrived LATE'} at ${localTime}. Date: ${localDate}.`;

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

    // Update detection status to approved
    await pool.execute(
      `UPDATE ble_detections 
       SET status = 'approved', approved_at = NOW(), approved_by = ?, attendance_id = ?
       WHERE id = ?`,
      [approved_by || 'kiosk', attendanceId, id]
    );

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

  } catch (err) {
    console.error('approveDetection error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── POST /api/ble/reject/:id ─────────────────────────────────────────
// Reject a pending BLE detection (don't record attendance)
export async function rejectDetection(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason, rejected_by } = req.body;

    const [result] = await pool.execute(
      `UPDATE ble_detections 
       SET status = 'rejected', approved_at = NOW(), approved_by = ?
       WHERE id = ? AND status = 'pending'`,
      [rejected_by || 'kiosk', id]
    ) as any[];

    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: 'Detection not found or already processed' });
      return;
    }

    console.log(`❌ Detection REJECTED: ID ${id}${reason ? ` - ${reason}` : ''}`);

    res.json({
      message: 'Detection rejected',
      detection_id: id,
    });

  } catch (err) {
    console.error('rejectDetection error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
