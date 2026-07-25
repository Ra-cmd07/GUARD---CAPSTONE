import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import pool from '../lib/db';
import { format } from 'date-fns';
import { emitAttendanceEvent } from '../src/websocket/socketHandler';
import { savePhotoLocally } from '../utils/localPhotoUpload';
import { uploadQueue } from '../utils/uploadQueue';
import { getActiveClassForSection } from '../utils/teacherClassHelper';

/**
 * Queue SMS for GSM module to send
 * Converts phone numbers to international format (+63...)
 */
async function queueSmsForGSM(
  phone: string,
  message: string,
  studentId: number,
  attendanceId: number
): Promise<boolean> {
  try {
    // Convert phone number to international format for GSM
    // 0917... → +63917...
    // 0953 681 2353 → +639536812353
    let internationalPhone = phone.trim().replace(/\s+/g, ''); // Remove spaces
    
    if (internationalPhone.startsWith('0')) {
      // Local format: replace leading 0 with +63
      internationalPhone = '+63' + internationalPhone.substring(1);
    } else if (internationalPhone.startsWith('63') && !internationalPhone.startsWith('+')) {
      // Missing + prefix
      internationalPhone = '+' + internationalPhone;
    } else if (!internationalPhone.startsWith('+63')) {
      // Invalid format, try to fix
      console.warn(`⚠️  Invalid phone format: ${phone}, attempting to fix...`);
      internationalPhone = '+63' + internationalPhone.replace(/^0+/, '');
    }
    
    await pool.execute(
      `INSERT INTO sms_queue 
       (phone_number, message, student_id, attendance_id, priority, status, created_at) 
       VALUES (?, ?, ?, ?, 'normal', 'pending', NOW())`,
      [internationalPhone, message, studentId, attendanceId]
    );
    console.log(`📩 SMS queued for GSM module → ${internationalPhone}: ${message.substring(0, 50)}...`);
    return true;
  } catch (error) {
    console.error('❌ Failed to queue SMS:', error);
    return false;
  }
}

// ─── POST /api/kiosk/scan ─────────────────────────────────────────────
// Central scan handler — called by kiosk UI after student authenticates
export async function kioskScan(req: Request, res: Response): Promise<void> {
  try {
    const {
      scan_method,      // 'QR' | 'RFID' | 'BLE'
      identifier,       // LRN (QR), RFID uid, or MAC (BLE)
      kiosk_id,
      photo_base64,     // optional captured photo
      qr_data,          // raw QR JSON string if scan_method = 'QR'
    } = req.body;

    if (!scan_method || !identifier) {
      res.status(400).json({ error: 'scan_method and identifier are required' });
      return;
    }

    // ── Resolve student ──────────────────────────────────────────────
    let student: any = null;

    if (scan_method === 'QR') {
      // identifier = LRN
      const [rows] = await pool.execute(
        'SELECT * FROM students WHERE lrn = ? AND is_active = 1', [identifier]
      ) as any[];
      student = (rows as any[])[0];
    } else if (scan_method === 'RFID') {
      // identifier = RFID uid
      const [rows] = await pool.execute(
        'SELECT s.* FROM students s WHERE UPPER(s.rfid_uid) = UPPER(?) AND s.is_active = 1',
        [identifier]
      ) as any[];
      student = (rows as any[])[0];
    } else if (scan_method === 'BLE') {
      // identifier = MAC address
      const normalizedMac = identifier.toLowerCase().replace(/[:\-]/g, '');
      const [rows] = await pool.execute(
        `SELECT s.* FROM students s
         WHERE REPLACE(REPLACE(LOWER(s.mac_address), ':', ''), '-', '') = ?
         AND s.is_active = 1`,
        [normalizedMac]
      ) as any[];
      student = (rows as any[])[0];
    }

    if (!student) {
      res.status(404).json({ error: 'Student not found or not registered for this scan method' });
      return;
    }

    // ── Determine status (Philippines timezone UTC+8) ────────────────
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const today = phTime.toISOString().split('T')[0];
    
    // Format time in 12-hour format with AM/PM
    // Use getUTC methods since phTime is already adjusted to PH time
    const hour24 = phTime.getUTCHours();
    const minutes = phTime.getUTCMinutes().toString().padStart(2, '0');
    const seconds = phTime.getUTCSeconds().toString().padStart(2, '0');
    const hour12 = hour24 % 12 || 12; // Convert 0 to 12 for midnight
    const ampm = hour24 < 12 ? 'AM' : 'PM';
    const timeStr = `${hour12}:${minutes}:${seconds} ${ampm}`;
    
    const localHour = hour24;
    const session = hour24 < 12 ? 'AM' : 'PM';

    // AUTO-TOGGLE: Check last attendance record for THIS SESSION (AM/PM) to determine next status
    const [lastRecord] = await pool.execute(
      `SELECT status FROM attendance
       WHERE student_id = ? AND date = ? AND session = ?
       ORDER BY timestamp DESC
       LIMIT 1`,
      [student.id, today, session]
    ) as any[];

    let status: string;
    
    if ((lastRecord as any[]).length > 0) {
      const lastStatus = (lastRecord as any[])[0].status;
      
      // Toggle based on last status IN THIS SESSION
      if (lastStatus === 'Time-Out') {
        // Last was Time-Out, so next is Time-In (check if late)
        const hour = phTime.getUTCHours();
        const min  = phTime.getUTCMinutes();
        status = (hour > 8 || (hour === 8 && min > 0)) ? 'Late' : 'Time-In';
      } else {
        // Last was Time-In or Late, so next is Time-Out
        status = 'Time-Out';
      }
    } else {
      // No record for this session yet, first scan is Time-In (check if late)
      const hour = phTime.getUTCHours();
      const min  = phTime.getUTCMinutes();
      status = (hour > 8 || (hour === 8 && min > 0)) ? 'Late' : 'Time-In';
    }

    // REMOVED: Duplicate check - now allows unlimited check-ins/outs per day

    // ── Get active teacher class for this section and time ──────────────
    const dayOfWeek = format(phTime, 'EEEE'); // Get day name from phTime (already in PH time)
    const timeHHmmss = format(phTime, 'HH:mm:ss');
    const activeClassId = await getActiveClassForSection(student.section_id, timeHHmmss, dayOfWeek);

    // ── Insert attendance IMMEDIATELY (don't wait for photo) ──────────
    const [attResult] = await pool.execute(
      `INSERT INTO attendance
         (student_id, student_name, lrn, gender, grade, section_id,
          kiosk_id, scan_method, status, session, date, time_in, time_out,
          photo_path, qr_data, teacher_class_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student.id, student.name, student.lrn, student.gender,
        student.grade, student.section_id,
        kiosk_id || null, scan_method, status, session, today,
        status === 'Time-In' || status === 'Late' ? timeStr : null,
        status === 'Time-Out' ? timeStr : null,
        null, // Photo path will be updated later
        qr_data || null,
        activeClassId, // Add teacher_class_id
      ]
    ) as any[];
    const attendanceId = (attResult as any).insertId;

    // ── Upload photo to local storage in BACKGROUND (async) ─────────────
    if (photo_base64) {
      // Don't await - let it run in background
      (async () => {
        try {
          const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
          
          const photoPath = await savePhotoLocally(base64Data, student.name, 'scan');
          console.log('📸 Photo saved locally:', photoPath);

          // Update attendance record with photo path (both local_path and photo_path for compatibility)
          await pool.execute(
            'UPDATE attendance SET local_path = ?, photo_path = ? WHERE id = ?',
            [photoPath, photoPath, attendanceId]
          );

          // Log to scan_photos table
          await pool.execute(
            'INSERT INTO scan_photos (attendance_id, student_name, status, photo_path, local_path) VALUES (?, ?, ?, ?, ?)',
            [attendanceId, student.name, status, photoPath, photoPath]
          );

          // Queue Cloudinary upload (background, non-blocking)
          uploadQueue.enqueue(attendanceId, photoPath, student.name);
          console.log('📤 Queued for Cloudinary upload');
        } catch (err) {
          console.error('Background photo upload failed:', err);
        }
      })();
    }

    // ── SMS to parents ────────────────────────────────────────────────
    const [guardians] = await pool.execute(
      `SELECT p.name, p.contact, ps.relationship
       FROM parent_student ps
       JOIN parents p ON ps.parent_id = p.id
       WHERE ps.student_id = ?`,
      [student.id]
    ) as any[];

    const statusEmoji = status === 'Time-In' ? '✅' : status === 'Late' ? '⏰' : '🔔';
    const timeDisplay = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
    const message     = `${statusEmoji} ATTENDBOX: ${student.name} has ${status === 'Time-In' ? 'arrived at school' : status === 'Time-Out' ? 'left school' : 'arrived LATE'} at ${timeDisplay}. Date: ${today}.`;

    const smsResults: any[] = [];
    for (const g of guardians as any[]) {
      if (g.contact) {
        // Queue SMS for GSM module (ESP32 will poll and send)
        const queued = await queueSmsForGSM(g.contact, message, student.id, attendanceId);
        
        // Log to sms_logs table for tracking
        await pool.execute(
          `INSERT INTO sms_logs (attendance_id, student_name, parent_name, phone_number, message, status, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [attendanceId, student.name, g.name, g.contact, message,
           queued ? 'queued' : 'failed', queued ? new Date() : null]
        );
        smsResults.push({ name: g.name, phone: g.contact, queued });
      }
    }

    // ── Update kiosk last_ping ────────────────────────────────────────
    if (kiosk_id) {
      await pool.execute('UPDATE kiosks SET last_ping = NOW() WHERE id = ?', [kiosk_id]);
    }

    // ── Emit real-time WebSocket event ────────────────────────────────
    // Get parent ID for WebSocket room targeting
    const parentId = (guardians as any[])[0]?.id || null;
    
    emitAttendanceEvent({
      studentId: student.id,
      studentName: student.name,
      status,
      section_id: student.section_id,
      grade: student.grade,
      parentId,
      method: scan_method,
      timestamp: phTime,
    });

    res.status(201).json({
      message:      'Attendance recorded',
      attendanceId,
      student_name: student.name,
      status,
      session,
      date:         today,
      time:         timeStr,
      photo_path:   null, // Photo uploaded in background
      sms:          smsResults,
    });
  } catch (err) {
    console.error('kioskScan error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /api/kiosk/ping/:kioskId ────────────────────────────────────
export async function kioskPing(req: Request, res: Response): Promise<void> {
  try {
    const { kioskId } = req.params;
    await pool.execute('UPDATE kiosks SET last_ping = NOW() WHERE id = ?', [kioskId]);

    const [rows] = await pool.execute(
      'SELECT * FROM kiosks WHERE id = ?', [kioskId]
    ) as any[];
    const kiosk = (rows as any[])[0];
    if (!kiosk) { res.status(404).json({ error: 'Kiosk not found' }); return; }

    res.json(kiosk);
  } catch (err) {
    console.error('kioskPing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /api/kiosk/list ──────────────────────────────────────────────
export async function getKioskList(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, location, gate, is_active FROM kiosks WHERE is_active = 1'
    ) as any[];
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /api/kiosk/recent-scans ─────────────────────────────────────
// Returns recent attendance records (last 10 seconds) for kiosk display
export async function getRecentScans(req: Request, res: Response): Promise<void> {
  try {
    const seconds = Number(req.query.seconds) || 10;
    const kioskId = req.query.kiosk_id ? Number(req.query.kiosk_id) : null;
    
    let query = `
      SELECT 
        a.id as attendance_id,
        a.student_id,
        a.student_name,
        a.lrn,
        a.scan_method,
        a.status,
        a.session,
        a.date,
        a.time_in,
        a.time_out,
        a.photo_path,
        a.created_at
      FROM attendance a
      WHERE a.created_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
    `;
    
    const params: any[] = [seconds];
    
    if (kioskId !== null) {
      query += ' AND a.kiosk_id = ?';
      params.push(kioskId);
    }
    
    query += ' ORDER BY a.created_at DESC LIMIT 1';
    
    const [rows] = await pool.execute(query, params) as any[];
    
    res.json(rows);
  } catch (err) {
    console.error('getRecentScans error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
