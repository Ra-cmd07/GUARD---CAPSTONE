import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import pool from '../lib/db';
import { format } from 'date-fns';

// Get teacher's assigned classes
export async function getTeacherClasses(req: AuthRequest, res: Response) {
  try {
    const teacherId = req.user?.id;
    
    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get teacher's profile to find their section/class
    const [teacher]: any = await pool.query(
      `SELECT u.id, u.username, 
              JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.name')) as name,
              JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.section')) as section,
              JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.subject')) as subject,
              JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.room')) as room,
              JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.schedule')) as schedule
       FROM users u
       WHERE u.id = ? AND u.role = 'teacher'`,
      [teacherId]
    );

    if (!teacher || teacher.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherData = teacher[0];

    // Get students in teacher's section
    const [students]: any = await pool.query(
      `SELECT s.id, s.lrn, s.name, s.grade, s.section, s.preferred_method,
              COUNT(DISTINCT DATE(a.date)) as days_present,
              (SELECT COUNT(DISTINCT DATE(a2.date)) 
               FROM attendance_logs a2 
               WHERE a2.student_id = s.id 
               AND a2.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
               AND a2.status IN ('Time-In', 'Late')) as attendance_30d
       FROM students s
       LEFT JOIN attendance_logs a ON a.student_id = s.id 
         AND a.status IN ('Time-In', 'Late')
         AND a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       WHERE s.section = ?
       GROUP BY s.id
       ORDER BY s.name`,
      [teacherData.section]
    );

    res.json({
      teacher: teacherData,
      students: students,
      totalStudents: students.length,
    });
  } catch (error) {
    console.error('Error getting teacher classes:', error);
    res.status(500).json({ error: 'Failed to load classes' });
  }
}

// Get today's attendance summary for teacher's class
export async function getTodayAttendanceSummary(req: AuthRequest, res: Response) {
  try {
    const teacherId = req.user?.id;
    const date = req.query.date as string || format(new Date(), 'yyyy-MM-dd');

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get teacher's section
    const [teacher]: any = await pool.query(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.section')) as section
       FROM users u
       WHERE u.id = ? AND u.role = 'teacher'`,
      [teacherId]
    );

    if (!teacher || teacher.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const section = teacher[0].section;

    // Get attendance records for today
    const [attendance]: any = await pool.query(
      `SELECT a.*, s.name as student_name, s.lrn, s.grade, s.section
       FROM attendance_logs a
       JOIN students s ON a.student_id = s.id
       WHERE s.section = ? AND DATE(a.date) = ?
       ORDER BY a.timestamp DESC`,
      [section, date]
    );

    // Get all students in section
    const [allStudents]: any = await pool.query(
      `SELECT id, lrn, name, grade, section, preferred_method
       FROM students
       WHERE section = ?
       ORDER BY name`,
      [section]
    );

    // Calculate stats
    const presentStudents = new Set();
    const lateStudents = new Set();
    const absentStudents = new Set(allStudents.map((s: any) => s.id));

    attendance.forEach((record: any) => {
      if (record.status === 'Time-In') {
        presentStudents.add(record.student_id);
        absentStudents.delete(record.student_id);
      } else if (record.status === 'Late') {
        lateStudents.add(record.student_id);
        absentStudents.delete(record.student_id);
      }
    });

    const stats = {
      present: presentStudents.size,
      late: lateStudents.size,
      absent: absentStudents.size,
      total: allStudents.length,
      attendanceRate: allStudents.length > 0 
        ? Math.round(((presentStudents.size + lateStudents.size) / allStudents.length) * 100) 
        : 0,
    };

    res.json({
      date,
      section,
      stats,
      attendance,
      allStudents,
    });
  } catch (error) {
    console.error('Error getting attendance summary:', error);
    res.status(500).json({ error: 'Failed to load attendance summary' });
  }
}

// Mark manual attendance
export async function markManualAttendance(req: AuthRequest, res: Response) {
  try {
    const teacherId = req.user?.id;
    const { student_id, status, session, reason } = req.body;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify teacher has permission to mark this student
    const [teacher]: any = await pool.query(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.section')) as section
       FROM users u
       WHERE u.id = ? AND u.role = 'teacher'`,
      [teacherId]
    );

    const [student]: any = await pool.query(
      `SELECT id, name, section FROM students WHERE id = ?`,
      [student_id]
    );

    if (!student || student.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (teacher[0].section !== student[0].section) {
      return res.status(403).json({ error: 'Cannot mark attendance for students outside your class' });
    }

    // Insert manual attendance record
    const [result]: any = await pool.query(
      `INSERT INTO attendance_logs 
       (student_id, date, status, session, scan_method, is_overridden, override_reason, override_by)
       VALUES (?, CURDATE(), ?, ?, 'Manual', 1, ?, ?)`,
      [student_id, status, session || 'AM', reason || 'Manually marked by teacher', teacherId]
    );

    res.json({
      success: true,
      message: `Attendance marked for ${student[0].name}`,
      attendanceId: result.insertId,
    });
  } catch (error) {
    console.error('Error marking manual attendance:', error);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
}

// Add excuse/note to attendance
export async function addAttendanceNote(req: AuthRequest, res: Response) {
  try {
    const teacherId = req.user?.id;
    const { attendance_id, student_id, note, excuse_type } = req.body;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify teacher has permission
    const [teacher]: any = await pool.query(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.section')) as section
       FROM users u
       WHERE u.id = ? AND u.role = 'teacher'`,
      [teacherId]
    );

    const [student]: any = await pool.query(
      `SELECT section FROM students WHERE id = ?`,
      [student_id]
    );

    if (!student || student.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (teacher[0].section !== student[0].section) {
      return res.status(403).json({ error: 'Cannot add notes for students outside your class' });
    }

    // Update attendance record with note
    if (attendance_id) {
      await pool.query(
        `UPDATE attendance_logs 
         SET override_reason = CONCAT(IFNULL(override_reason, ''), '\n', ?)
         WHERE id = ?`,
        [note, attendance_id]
      );
    }

    // Create a teacher note record (for tracking)
    await pool.query(
      `INSERT INTO teacher_notes (teacher_id, student_id, attendance_id, note, excuse_type, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [teacherId, student_id, attendance_id, note, excuse_type || 'general']
    );

    res.json({
      success: true,
      message: 'Note added successfully',
    });
  } catch (error: any) {
    console.error('Error adding attendance note:', error);
    
    // If teacher_notes table doesn't exist, just update attendance_logs
    if (error.code === 'ER_NO_SUCH_TABLE') {
      try {
        const { attendance_id, note } = req.body;
        await pool.query(
          `UPDATE attendance_logs 
           SET override_reason = CONCAT(IFNULL(override_reason, ''), '\n', ?)
           WHERE id = ?`,
          [note, attendance_id]
        );
        return res.json({ success: true, message: 'Note added to attendance record' });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to add note' });
      }
    }
    
    res.status(500).json({ error: 'Failed to add note' });
  }
}

// Excuse absence (mark as excused)
export async function excuseAbsence(req: AuthRequest, res: Response) {
  try {
    const teacherId = req.user?.id;
    const { student_id, date, reason } = req.body;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify teacher has permission
    const [teacher]: any = await pool.query(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.section')) as section,
              JSON_UNQUOTE(JSON_EXTRACT(u.profile, '$.name')) as teacher_name
       FROM users u
       WHERE u.id = ? AND u.role = 'teacher'`,
      [teacherId]
    );

    const [student]: any = await pool.query(
      `SELECT id, name, section FROM students WHERE id = ?`,
      [student_id]
    );

    if (!student || student.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (teacher[0].section !== student[0].section) {
      return res.status(403).json({ error: 'Cannot excuse students outside your class' });
    }

    // Check if attendance record exists
    const [existing]: any = await pool.query(
      `SELECT id FROM attendance_logs 
       WHERE student_id = ? AND DATE(date) = ?`,
      [student_id, date]
    );

    if (existing.length > 0) {
      // Update existing record
      await pool.query(
        `UPDATE attendance_logs 
         SET status = 'Excused', 
             is_overridden = 1, 
             override_reason = ?, 
             override_by = ?
         WHERE id = ?`,
        [reason || `Excused by ${teacher[0].teacher_name}`, teacherId, existing[0].id]
      );
    } else {
      // Create new excused record
      await pool.query(
        `INSERT INTO attendance_logs 
         (student_id, date, status, session, scan_method, is_overridden, override_reason, override_by)
         VALUES (?, ?, 'Excused', 'AM', 'Manual', 1, ?, ?)`,
        [student_id, date, reason || `Excused by ${teacher[0].teacher_name}`, teacherId]
      );
    }

    res.json({
      success: true,
      message: `Absence excused for ${student[0].name}`,
    });
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

