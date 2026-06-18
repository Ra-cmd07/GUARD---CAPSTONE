import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import pool from '../lib/db';
import { emitAttendanceEvent } from '../src/websocket/socketHandler';
import { cloudinary } from '../config/cloudinary';

// Lightweight SMS helper — replace body with real provider (Semaphore, Vonage, etc.)
async function sendSms(phone: string, message: string): Promise<boolean> {
  try {
    // TODO: integrate real SMS gateway
    console.log(`📱 SMS → ${phone}: ${message}`);
    return true;
  } catch {
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

    // Check if Time-In already exists today → this is a Time-Out
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
      const min  = phTime.getUTCMinutes();
      status = (hour > 8 || (hour === 8 && min > 0)) ? 'Late' : 'Time-In';
    }

    // Prevent duplicate same status
    const [dupCheck] = await pool.execute(
      'SELECT id FROM attendance WHERE student_id = ? AND date = ? AND status = ?',
      [student.id, today, status]
    ) as any[];
    if ((dupCheck as any[]).length > 0) {
      res.status(409).json({
        error: 'Already recorded',
        already_exists: true,
        student_name: student.name,
        status,
      });
      return;
    }

    // ── Save photo to Cloudinary ─────────────────────────────────────
    let photoPath: string | null = null;
    if (photo_base64) {
      try {
        const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
        const filename   = `scan_${Date.now()}_${student.name.replace(/\s+/g, '_')}`;
        
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
        
        photoPath = uploadResult.secure_url; // Cloudinary HTTPS URL
        console.log('📸 Photo uploaded to Cloudinary:', photoPath);
      } catch (err) {
        console.error('Failed to upload photo to Cloudinary:', err);
        // Don't fail the attendance, just log the error
      }
    }

    // ── Insert attendance ────────────────────────────────────────────
    const [attResult] = await pool.execute(
      `INSERT INTO attendance
         (student_id, student_name, lrn, gender, grade, section,
          kiosk_id, scan_method, status, session, date, time_in, time_out,
          photo_path, qr_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        student.id, student.name, student.lrn, student.gender,
        student.grade, student.section,
        kiosk_id || null, scan_method, status, session, today,
        status === 'Time-In' || status === 'Late' ? timeStr : null,
        status === 'Time-Out' ? timeStr : null,
        photoPath, qr_data || null,
      ]
    ) as any[];
    const attendanceId = (attResult as any).insertId;

    // ── Log photo to scan_photos table ───────────────────────────────
    if (photoPath) {
      await pool.execute(
        'INSERT INTO scan_photos (attendance_id, student_name, status, photo_path) VALUES (?, ?, ?, ?)',
        [attendanceId, student.name, status, photoPath]
      );
    }

    // ── SMS to parents ────────────────────────────────────────────────
    const [guardians] = await pool.execute(
      'SELECT * FROM parents_teachers WHERE student_id = ?', [student.id]
    ) as any[];

    const statusEmoji = status === 'Time-In' ? '✅' : status === 'Late' ? '⏰' : '🔔';
    const timeDisplay = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
    const message     = `${statusEmoji} ATTENDBOX: ${student.name} has ${status === 'Time-In' ? 'arrived at school' : status === 'Time-Out' ? 'left school' : 'arrived LATE'} at ${timeDisplay}. Date: ${today}.`;

    const smsResults: any[] = [];
    for (const g of guardians as any[]) {
      if (g.contact_number) {
        const sent = await sendSms(g.contact_number, message);
        await pool.execute(
          `INSERT INTO sms_logs (attendance_id, student_name, parent_name, phone_number, message, status, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [attendanceId, student.name, g.name, g.contact_number, message,
           sent ? 'sent' : 'failed', sent ? new Date() : null]
        );
        smsResults.push({ name: g.name, phone: g.contact_number, sent });
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
      section: student.section,
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
      photo_path:   photoPath,
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
