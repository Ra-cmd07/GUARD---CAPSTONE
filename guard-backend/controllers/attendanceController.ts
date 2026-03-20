import { Response } from 'express';
import pool from '../lib/db';
import { AuthRequest } from '../middleware/authMiddleware';

// ─── GET /api/attendance?date=YYYY-MM-DD ──────────────────────────────
export async function getAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const teacherId = req.teacher!.id;
    const date      = (req.query.date as string) ||
                      new Date().toISOString().split('T')[0];

    const [rows] = await pool.execute(
      `SELECT * FROM attendance
       WHERE teacher_id = ? AND date = ?
       ORDER BY timestamp DESC`,
      [teacherId, date]
    ) as any[];

    res.json(rows);
  } catch (err) {
    console.error('getAttendance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── POST /api/attendance ─────────────────────────────────────────────
export async function createAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const teacherId = req.teacher!.id;
    const {
      student_name, lrn, gender, guardian_name,
      by_whom, status, session, date, qr_data,
    } = req.body;

    if (!student_name || !status || !date) {
      res.status(400).json({ error: 'student_name, status, and date are required' });
      return;
    }

    // Prevent duplicate same-status record on the same day
    const [existing] = await pool.execute(
      `SELECT id FROM attendance
       WHERE teacher_id = ? AND student_name = ? AND date = ? AND status = ?`,
      [teacherId, student_name, date, status]
    ) as any[];

    if ((existing as any[]).length > 0) {
      res.status(409).json({ error: 'Already recorded', already_exists: true });
      return;
    }

    const [result] = await pool.execute(
      `INSERT INTO attendance
         (teacher_id, student_name, lrn, gender, guardian_name,
          by_whom, status, session, date, qr_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [teacherId,
       student_name,
       lrn          || null,
       gender       || null,
       guardian_name|| null,
       by_whom      || null,
       status,
       session      || 'AM',
       date,
       qr_data      || null]
    ) as any[];

    res.status(201).json({
      id:      (result as any).insertId,
      message: 'Attendance recorded',
    });
  } catch (err) {
    console.error('createAttendance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── PATCH /api/attendance/:id ────────────────────────────────────────
export async function updateAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id }     = req.params;
    const { status, session } = req.body;
    const teacherId  = req.teacher!.id;

    const [result] = await pool.execute(
      `UPDATE attendance
       SET status = ?, session = ?
       WHERE id = ? AND teacher_id = ?`,
      [status, session || 'AM', id, teacherId]
    ) as any[];

    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: 'Record not found or not yours' });
      return;
    }

    res.json({ message: 'Updated successfully' });
  } catch (err) {
    console.error('updateAttendance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── DELETE /api/attendance/:id ───────────────────────────────────────
export async function deleteAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id }    = req.params;
    const teacherId = req.teacher!.id;

    await pool.execute(
      'DELETE FROM attendance WHERE id = ? AND teacher_id = ?',
      [id, teacherId]
    );

    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('deleteAttendance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}