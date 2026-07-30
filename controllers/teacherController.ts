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

// ─── Helper: build role label for audit notes ─────────────────────────
// Queries the exact assignment row for (teacherId, studentSection) to determine
// whether the teacher is the adviser or subject teacher for that section.
// Returns one of:
//   "Adviser – Section IT3R4"
//   "Subject Teacher – Mathematics (IT3R4)"
//   "Teacher"  (fallback when no matching assignment found)
export async function buildTeacherRoleLabel(teacherId: number, studentSection?: string): Promise<string> {
  try {
    if (studentSection) {
      // Find the exact assignment row that matches this teacher + this section.
      // A single row can have both teacher_id (adviser) and subject_teacher_id (subject teacher).
      // We prioritise the adviser role: if teacher_id matches, they are the adviser.
      const [rows]: any = await pool.query(
        `SELECT section, subject,
                teacher_id,
                subject_teacher_id
         FROM assignments
         WHERE LOWER(TRIM(section)) = LOWER(TRIM(?))
           AND (teacher_id = ? OR subject_teacher_id = ?)
         ORDER BY
           -- adviser match comes first
           CASE WHEN teacher_id = ? THEN 0 ELSE 1 END
         LIMIT 1`,
        [studentSection, teacherId, teacherId, teacherId]
      );

      if (rows.length > 0) {
        const row = rows[0];
        if (Number(row.teacher_id) === teacherId) {
          // This teacher is the ADVISER for this section
          return `Adviser – Section ${row.section}`;
        } else {
          // This teacher is the SUBJECT TEACHER for this section
          return `Subject Teacher – ${row.subject} (${row.section})`;
        }
      }
    }

    // Fallback: no studentSection provided or no matching assignment row found.
    // Check if the teacher is an adviser for any section.
    const [adviserRows]: any = await pool.query(
      `SELECT section FROM assignments WHERE teacher_id = ? LIMIT 1`,
      [teacherId]
    );
    if (adviserRows.length > 0) {
      return `Adviser – Section ${adviserRows[0].section}`;
    }

    // Check if subject teacher for any section.
    const [subjectRows]: any = await pool.query(
      `SELECT subject, section FROM assignments WHERE subject_teacher_id = ? LIMIT 1`,
      [teacherId]
    );
    if (subjectRows.length > 0) {
      return `Subject Teacher – ${subjectRows[0].subject}${subjectRows[0].section ? ` (${subjectRows[0].section})` : ''}`;
    }

    // Last resort: teachers table section column only (adviser assumed)
    const [tRows]: any = await pool.query(
      `SELECT section, subject FROM teachers WHERE id = ? LIMIT 1`,
      [teacherId]
    );
    if (tRows.length > 0) {
      const t = tRows[0];
      if (t.section) return `Adviser – Section ${t.section}`;
      if (t.subject) return `Subject Teacher – ${t.subject}`;
    }
  } catch (err) {
    console.error('buildTeacherRoleLabel error:', err);
  }
  return 'Teacher';
}

async function getAssignmentsForTeacher(teacherId: number): Promise<any[]> {
  // Get ALL assignments where this teacher is EITHER adviser OR subject teacher
  const [rows]: any = await pool.query(
    `SELECT id, year_level, strand, track, section, subject,
            teacher_id, subject_teacher_id,
            CASE WHEN teacher_id = ? THEN 'adviser' ELSE 'subject_teacher' END AS role
     FROM assignments
     WHERE teacher_id = ? OR subject_teacher_id = ?
     ORDER BY year_level, strand, track, section, subject`,
    [teacherId, teacherId, teacherId]
  );
  return rows;
}

async function getTeacherStudentIds(teacherId: number): Promise<number[]> {
  const [rows]: any = await pool.query(
    `SELECT DISTINCT asg.student_id
     FROM assignment_students asg
     JOIN assignments a ON a.id = asg.assignment_id
     WHERE a.teacher_id = ? OR a.subject_teacher_id = ?`,
    [teacherId, teacherId]
  );
  return (rows as any[]).map((row) => row.student_id);
}

// ─── GET /teacher/classes ─────────────────────────────────────────────
export async function getTeacherClasses(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const teacher = await getTeacherRow(userId);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const assignments = await getAssignmentsForTeacher(teacher.id);

    // ── Case 1: Teacher is assigned as ADVISER in the assignments table ──
    // Only show advisory class if teacher_id matches (they are the class adviser)
    const advisoryAssignments = assignments.filter((a: any) => a.teacher_id === teacher.id);

    if (advisoryAssignments.length > 0) {
      const studentIds = await getTeacherStudentIds(teacher.id);
      const [students]: any = await pool.query(
        `SELECT id, lrn, name, grade, section, preferred_method,
                0 AS days_present, 0 AS attendance_30d
         FROM students
         WHERE id IN (?)
         ORDER BY name`,
        [studentIds.length > 0 ? studentIds : [0]]
      );

      res.json({
        teacher: {
          name:       teacher.name,
          section:    advisoryAssignments[0].section,
          subject:    advisoryAssignments[0].subject,
          room:       teacher.room,
          schedule:   teacher.schedule,
          year_level: advisoryAssignments[0].year_level,
          strand:     advisoryAssignments[0].strand,
          track:      advisoryAssignments[0].track,
          assignments,
          is_adviser: true,
        },
        students,
        totalStudents: students.length,
      });
      return;
    }

    // ── Case 2: Teacher is ONLY a subject teacher (not an adviser) ──
    // No advisory class — return empty advisory with their subject assignments
    if (assignments.length > 0) {
      const studentIds = await getTeacherStudentIds(teacher.id);
      const [students]: any = await pool.query(
        `SELECT id, lrn, name, grade, section, preferred_method,
                0 AS days_present, 0 AS attendance_30d
         FROM students
         WHERE id IN (?)
         ORDER BY name`,
        [studentIds.length > 0 ? studentIds : [0]]
      );

      res.json({
        teacher: {
          name:       teacher.name,
          section:    null,        // NOT an adviser — no advisory section
          subject:    assignments[0].subject,
          room:       teacher.room,
          schedule:   teacher.schedule,
          year_level: assignments[0].year_level,
          strand:     assignments[0].strand,
          track:      assignments[0].track,
          assignments,
          is_adviser: false,       // Key flag: hide Classroom Advisory in sidebar
        },
        students,
        totalStudents: students.length,
      });
      return;
    }

    // ── Case 3: No assignments at all — fall back to old section-based lookup ──
    // Only used for teachers not yet configured in the new Assignment system
    const [students]: any = await pool.query(
      `SELECT id, lrn, name, grade, section, preferred_method,
              0 AS days_present, 0 AS attendance_30d
       FROM students
       WHERE LOWER(section) = LOWER(?)
       ORDER BY name`,
      [teacher.section]
    );

    res.json({
      teacher: {
        name:       teacher.name,
        section:    teacher.section,
        subject:    teacher.subject,
        room:       teacher.room,
        schedule:   teacher.schedule,
        is_adviser: !!teacher.section,  // show advisory only if section is set
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

    const assignments = await getAssignmentsForTeacher(teacher.id);
    let attendance: any[] = [];
    let allStudents: any[] = [];
    let section = teacher.section || '';

    if (assignments.length > 0) {
      // If teacher has explicit assignments, prefer the assignment's section
      section = assignments[0]?.section || section;
      const studentIds = await getTeacherStudentIds(teacher.id);

      // Final attendance (verified — from attendance table)
      const [attendanceRows]: any = await pool.query(
        `SELECT id, student_id, student_name, lrn, grade, section,
                status, session, scan_method,
                DATE_FORMAT(date, '%Y-%m-%d') AS date,
                time_in, time_out,
                timestamp, photo_path, is_overridden, notes,
                1 AS is_verified
         FROM attendance
         WHERE student_id IN (?) AND DATE(CONVERT_TZ(date, '+00:00', '+08:00')) = ?
         ORDER BY timestamp DESC`,
        [studentIds.length > 0 ? studentIds : [0], date]
      );

      // Partial attendance (pending — from partial_attendance table)
      const [partialRows]: any = await pool.query(
        `SELECT id, student_id, student_name, lrn, grade, section,
                status, session, scan_method,
                DATE_FORMAT(date, '%Y-%m-%d') AS date,
                time_in, NULL AS time_out,
                scanned_at AS timestamp, photo_path, 0 AS is_overridden, notes,
                0 AS is_verified
         FROM partial_attendance
         WHERE student_id IN (?) AND date = ?
         ORDER BY scanned_at DESC`,
        [studentIds.length > 0 ? studentIds : [0], date]
      );

      attendance = [...attendanceRows, ...partialRows];

      const [studentRows]: any = await pool.query(
        `SELECT id, lrn, name, grade, section, preferred_method
         FROM students WHERE id IN (?) ORDER BY name`,
        [studentIds.length > 0 ? studentIds : [0]]
      );
      allStudents = studentRows;
    } else {
      // Final
      const [attendanceRows]: any = await pool.query(
        `SELECT id, student_id, student_name, lrn, grade, section,
                status, session, scan_method,
                DATE_FORMAT(date, '%Y-%m-%d') AS date,
                time_in, time_out,
                timestamp, photo_path, is_overridden, notes,
                1 AS is_verified
         FROM attendance
         WHERE LOWER(section) = LOWER(?) AND DATE(CONVERT_TZ(date, '+00:00', '+08:00')) = ?
         ORDER BY timestamp DESC`,
        [section, date]
      );

      // Partial
      const [partialRows]: any = await pool.query(
        `SELECT id, student_id, student_name, lrn, grade, section,
                status, session, scan_method,
                DATE_FORMAT(date, '%Y-%m-%d') AS date,
                time_in, NULL AS time_out,
                scanned_at AS timestamp, photo_path, 0 AS is_overridden, notes,
                0 AS is_verified
         FROM partial_attendance
         WHERE LOWER(section) = LOWER(?) AND date = ?
         ORDER BY scanned_at DESC`,
        [section, date]
      );

      attendance = [...attendanceRows, ...partialRows];

      const [studentRows]: any = await pool.query(
        `SELECT id, lrn, name, grade, section, preferred_method
         FROM students WHERE LOWER(section) = LOWER(?) ORDER BY name`,
        [section]
      );
      allStudents = studentRows;
    }

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

    res.json({ date, section: section, stats, attendance, allStudents });
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

    if (teacher.section.toLowerCase() !== student.section.toLowerCase())
      return res.status(403).json({ error: 'Cannot mark attendance for students outside your class' });

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const timeStr = format(new Date(), 'HH:mm:ss');

    const roleLabel = await buildTeacherRoleLabel(teacher.id, student.section);
    const auditNote = reason
      ? `${reason} | Manually recorded by ${teacher.name} (${roleLabel})`
      : `Manually recorded by ${teacher.name} (${roleLabel})`;

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
        auditNote,
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
    if (teacher.section.toLowerCase() !== studentRows[0].section.toLowerCase())
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

    if (teacher.section.toLowerCase() !== student.section.toLowerCase())
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

// ─── GET /teacher/subject-assignments ────────────────────────────────
// Returns all subject assignments where this teacher is the subject_teacher
export async function getTeacherSubjectAssignments(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const teacher = await getTeacherRow(userId);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    // Assignments where this teacher is the subject teacher
    const [rows]: any = await pool.query(
      `SELECT a.id, a.year_level, a.strand, a.track, a.section, a.subject,
              a.teacher_id,
              adv.name AS adviser_name,
              COUNT(DISTINCT asg.student_id) AS student_count
       FROM assignments a
       LEFT JOIN teachers adv ON adv.id = a.teacher_id
       LEFT JOIN assignment_students asg ON asg.assignment_id = a.id
       WHERE a.subject_teacher_id = ?
       GROUP BY a.id
       ORDER BY a.year_level, a.strand, a.track, a.section, a.subject`,
      [teacher.id]
    );

    // Also include assignments where teacher is the adviser (advisory class)
    const [advisoryRows]: any = await pool.query(
      `SELECT a.id, a.year_level, a.strand, a.track, a.section, a.subject,
              a.teacher_id,
              adv.name AS adviser_name,
              COUNT(DISTINCT asg.student_id) AS student_count
       FROM assignments a
       LEFT JOIN teachers adv ON adv.id = a.teacher_id
       LEFT JOIN assignment_students asg ON asg.assignment_id = a.id
       WHERE a.teacher_id = ? AND (a.subject_teacher_id IS NULL OR a.subject_teacher_id = ?)
       GROUP BY a.id
       ORDER BY a.section, a.subject`,
      [teacher.id, teacher.id]
    );

    res.json({
      advisory: advisoryRows,
      subjects: rows,
      teacher: { id: teacher.id, name: teacher.name, section: teacher.section },
    });
  } catch (error) {
    console.error('Error getting subject assignments:', error);
    res.status(500).json({ error: 'Failed to load subject assignments' });
  }
}

// ─── GET /teacher/subject-attendance ─────────────────────────────────
// Returns partial (from partial_attendance) + final (from attendance) for an assignment
export async function getSubjectAttendance(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { assignment_id, date } = req.query as Record<string, string>;
    if (!assignment_id) return res.status(400).json({ error: 'assignment_id required' });

    const targetDate = date || format(new Date(), 'yyyy-MM-dd');

    // Get the assignment's students
    const [studentRows]: any = await pool.query(
      `SELECT s.id, s.lrn, s.name, s.grade, s.section
       FROM assignment_students asg
       JOIN students s ON s.id = asg.student_id
       WHERE asg.assignment_id = ?
       ORDER BY s.name`,
      [assignment_id]
    );

    if (!studentRows.length) {
      return res.json({ partial: [], final: [], students: [], date: targetDate });
    }

    const studentIds = studentRows.map((s: any) => s.id);

    // Partial — kiosk scans waiting for teacher verification (separate table)
    const [partialRows]: any = await pool.query(
      `SELECT id, student_id, student_name, lrn, status, session, scan_method,
              DATE_FORMAT(date, '%Y-%m-%d') AS date,
              time_in, photo_path, notes, scanned_at AS timestamp
       FROM partial_attendance
       WHERE student_id IN (?)
         AND date = ?
       ORDER BY scanned_at DESC`,
      [studentIds, targetDate]
    );

    // Final — verified records in the attendance table
    const [finalRows]: any = await pool.query(
      `SELECT id, student_id, student_name, lrn, status, session, scan_method,
              DATE_FORMAT(date, '%Y-%m-%d') AS date,
              time_in, timestamp, photo_path, notes, is_overridden,
              teacher_name
       FROM attendance
       WHERE student_id IN (?)
         AND DATE(CONVERT_TZ(date, '+00:00', '+08:00')) = ?
       ORDER BY timestamp DESC`,
      [studentIds, targetDate]
    );

    res.json({ partial: partialRows, final: finalRows, students: studentRows, date: targetDate });
  } catch (error) {
    console.error('Error getting subject attendance:', error);
    res.status(500).json({ error: 'Failed to load subject attendance' });
  }
}

// ─── POST /teacher/attendance/verify ─────────────────────────────────
// Promotes a partial_attendance record → attendance (final)
export async function verifyPartialAttendance(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { attendance_id, status } = req.body;
    if (!attendance_id) return res.status(400).json({ error: 'attendance_id required' });

    const teacher = await getTeacherRow(userId);
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    // Fetch the partial record
    const [partialRows]: any = await pool.query(
      `SELECT * FROM partial_attendance WHERE id = ? LIMIT 1`,
      [attendance_id]
    );
    if (!partialRows.length) {
      return res.status(404).json({ error: 'Partial attendance record not found' });
    }
    const partial = partialRows[0];

    const validStatuses = ['Time-In', 'Late', 'Absent', 'Time-Out', 'Excused'];
    const finalStatus = validStatuses.includes(status) ? status : partial.status;

    const roleLabel = await buildTeacherRoleLabel(teacher.id, partial.section);
    const verifyNote = `Verified by ${teacher.name} (${roleLabel})`;

    // Promote: INSERT into attendance
    await pool.query(
      `INSERT INTO attendance
         (student_id, student_name, lrn, gender, grade, section,
          kiosk_id, scan_method, status, session, date, time_in, time_out,
          photo_path, local_path, qr_data, notes,
          teacher_id, teacher_name, is_overridden, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [
        partial.student_id, partial.student_name, partial.lrn, partial.gender,
        partial.grade, partial.section,
        partial.kiosk_id, partial.scan_method, finalStatus, partial.session,
        partial.date, partial.time_in, partial.time_out,
        partial.photo_path, partial.local_path, partial.qr_data,
        verifyNote,
        teacher.id, teacher.name,
      ]
    );

    // Remove from partial_attendance
    await pool.query(`DELETE FROM partial_attendance WHERE id = ?`, [attendance_id]);

    res.json({ success: true, message: 'Attendance verified and moved to Final list' });
  } catch (error) {
    console.error('Error verifying attendance:', error);
    res.status(500).json({ error: 'Failed to verify attendance' });
  }
}

export default {
  getTeacherClasses,
  getTodayAttendanceSummary,
  markManualAttendance,
  addAttendanceNote,
  excuseAbsence,
  getTeacherSubjectAssignments,
  getSubjectAttendance,
  verifyPartialAttendance,
};
