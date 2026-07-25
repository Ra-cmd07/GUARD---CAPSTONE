import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import pool from '../lib/db';
import { format } from 'date-fns';

// ─── Helper: get teacher row from DB ─────────────────────────────────
async function getTeacherRow(userId: number): Promise<any | null> {
  const [rows]: any = await pool.query(
    `SELECT t.id, t.user_id, t.name, t.section, t.subject, t.room, t.schedule, t.contact
     FROM teachers t
     WHERE t.user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows.length > 0 ? rows[0] : null;
}

// ─── GET /teacher/classes ─────────────────────────────────────────────
export async function getTeacherClasses(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const teacher = await getTeacherRow(userId);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    // Get students in teacher's section
    const [students]: any = await pool.query(
      `SELECT id, lrn, name, grade, section, preferred_method,
              0 AS days_present,
              0 AS attendance_30d
       FROM students
       WHERE LOWER(section) = LOWER(?)
       ORDER BY name`,
      [teacher.section]
    );

    res.json({
      teacher: {
        name:     teacher.name,
        section:  teacher.section,
        subject:  teacher.subject,
        room:     teacher.room,
        schedule: teacher.schedule,
      },
      students,
      totalStudents: students.length,
    });
  } catch (error) {
    console.error('Error getting teacher classes:', error);
    res.status(500).json({ error: 'Failed to load classes' });
  }
}

// ─── GET /teacher/attendance/today ────────────────────────────────────
export async function getTodayAttendanceSummary(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const date = (req.query.date as string) || format(new Date(), 'yyyy-MM-dd');

    const teacher = await getTeacherRow(userId);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const section = teacher.section;

    // Attendance records for this section + date
    const [attendance]: any = await pool.query(
      `SELECT id, student_id, student_name, lrn, grade, section,
              status, session, scan_method, date, time_in, time_out,
              timestamp, photo_path, is_overridden, notes
       FROM attendance
       WHERE LOWER(section) = LOWER(?) AND DATE(CONVERT_TZ(date, '+00:00', '+08:00')) = ?
       ORDER BY timestamp DESC`,
      [section, date]
    );

    // All students in section (case-insensitive match)
    const [allStudents]: any = await pool.query(
      `SELECT id, lrn, name, grade, section, preferred_method
       FROM students WHERE LOWER(section) = LOWER(?) ORDER BY name`,
      [section]
    );

    // Stats
    const presentSet = new Set<number>();
    const lateSet    = new Set<number>();
    const absentSet  = new Set<number>(allStudents.map((s: any) => s.id));

    for (const r of attendance) {
      if (r.status === 'Time-In') {
        presentSet.add(r.student_id);
        absentSet.delete(r.student_id);
      } else if (r.status === 'Late') {
        lateSet.add(r.student_id);
        absentSet.delete(r.student_id);
      }
    }

    const stats = {
      present:        presentSet.size,
      late:           lateSet.size,
      absent:         absentSet.size,
      total:          allStudents.length,
      attendanceRate: allStudents.length > 0
        ? Math.round(((presentSet.size + lateSet.size) / allStudents.length) * 100)
        : 0,
    };

    res.json({ date, section, stats, attendance, allStudents });
  } catch (error) {
    console.error('Error getting attendance summary:', error);
    res.status(500).json({ error: 'Failed to load attendance summary' });
  }
}

// ─── POST /teacher/attendance/manual ─────────────────────────────────
export async function markManualAttendance(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { student_id, status, session, reason } = req.body;

    const teacher = await getTeacherRow(userId);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const [studentRows]: any = await pool.query(
      `SELECT id, name, lrn, grade, section FROM students WHERE id = ?`,
      [student_id]
    );
    if (!studentRows.length) return res.status(404).json({ error: 'Student not found' });
    const student = studentRows[0];

    if (teacher.section !== student.section)
      return res.status(403).json({ error: 'Cannot mark attendance for students outside your class' });

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const timeStr = format(new Date(), 'HH:mm:ss');

    const [result]: any = await pool.query(
      `INSERT INTO attendance
         (student_id, student_name, lrn, grade, section,
          teacher_id, teacher_name, scan_method, status, session,
          date, time_in, timestamp, is_overridden, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Manual', ?, ?, ?, ?, NOW(), 1, ?, NOW())`,
      [
        student.id, student.name, student.lrn, student.grade, student.section,
        teacher.id, teacher.name,
        status, session || 'AM',
        dateStr, timeStr,
        reason || 'Manually marked by teacher',
      ]
    );

    res.json({
      success: true,
      message: `Attendance marked for ${student.name}`,
      attendanceId: result.insertId,
    });
  } catch (error) {
    console.error('Error marking manual attendance:', error);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
}

// ─── POST /teacher/attendance/note ───────────────────────────────────
export async function addAttendanceNote(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { attendance_id, student_id, note, excuse_type } = req.body;

    const teacher = await getTeacherRow(userId);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const [studentRows]: any = await pool.query(
      `SELECT section FROM students WHERE id = ?`, [student_id]
    );
    if (!studentRows.length) return res.status(404).json({ error: 'Student not found' });
    if (teacher.section !== studentRows[0].section)
      return res.status(403).json({ error: 'Cannot add notes for students outside your class' });

    if (attendance_id) {
      await pool.query(
        `UPDATE attendance SET notes = CONCAT(IFNULL(notes, ''), ' | ', ?) WHERE id = ?`,
        [note, attendance_id]
      );
    }

    // Try inserting into teacher_notes (silently skip if table missing)
    try {
      await pool.query(
        `INSERT INTO teacher_notes (teacher_id, student_id, attendance_id, note, excuse_type, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [teacher.id, student_id, attendance_id, note, excuse_type || 'general']
      );
    } catch (_) { /* table may not exist */ }

    res.json({ success: true, message: 'Note added successfully' });
  } catch (error) {
    console.error('Error adding attendance note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
}

// ─── POST /teacher/attendance/excuse ─────────────────────────────────
export async function excuseAbsence(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { student_id, date, reason } = req.body;

    const teacher = await getTeacherRow(userId);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const [studentRows]: any = await pool.query(
      `SELECT id, name, lrn, grade, section FROM students WHERE id = ?`,
      [student_id]
    );
    if (!studentRows.length) return res.status(404).json({ error: 'Student not found' });
    const student = studentRows[0];

    if (teacher.section !== student.section)
      return res.status(403).json({ error: 'Cannot excuse students outside your class' });

    const excuseNote = reason || `Excused by ${teacher.name}`;

    const [existing]: any = await pool.query(
      `SELECT id FROM attendance WHERE student_id = ? AND DATE(CONVERT_TZ(date, '+00:00', '+08:00')) = ? LIMIT 1`,
      [student_id, date]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE attendance SET status = 'Absent', is_overridden = 1, notes = ? WHERE id = ?`,
        [excuseNote, existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance
           (student_id, student_name, lrn, grade, section,
            teacher_id, teacher_name, scan_method, status, session,
            date, timestamp, is_overridden, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Manual', 'Absent', 'AM', ?, NOW(), 1, ?, NOW())`,
        [
          student.id, student.name, student.lrn, student.grade, student.section,
          teacher.id, teacher.name,
          date, excuseNote,
        ]
      );
    }

    res.json({ success: true, message: `Absence excused for ${student.name}` });
  } catch (error) {
    console.error('Error excusing absence:', error);
    res.status(500).json({ error: 'Failed to excuse absence' });
  }
}

export default {
  getTeacherClasses,
  getTodayAttendanceSummary,
  markManualAttendance,
  addAttendanceNote,
  excuseAbsence,
};
