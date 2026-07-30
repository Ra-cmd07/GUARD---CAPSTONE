import { Response } from 'express';
import pool from '../lib/db';
import { AuthRequest } from '../middleware/authMiddleware';

// Cache for runtime schema checks to avoid querying information_schema on every request
let _subjectTeacherColumnCache: { has?: boolean; ts?: number } = {};

async function hasSubjectTeacherColumn(): Promise<boolean> {
  const now = Date.now();
  if (_subjectTeacherColumnCache.ts && now - (_subjectTeacherColumnCache.ts || 0) < 60_000) {
    return !!_subjectTeacherColumnCache.has;
  }
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND COLUMN_NAME = 'subject_teacher_id'`
    ) as any[];
    const has = rows && rows[0] && Number(rows[0].cnt) > 0;
    _subjectTeacherColumnCache = { has, ts: now };
    return has;
  } catch (err) {
    console.warn('Could not determine subject_teacher_id column existence, assuming false', err);
    _subjectTeacherColumnCache = { has: false, ts: now };
    return false;
  }
}

export async function getAssignments(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const includeSubjectTeacher = await hasSubjectTeacherColumn();
    if (includeSubjectTeacher) {
      const [rows] = await pool.execute(
        `SELECT a.id, a.year_level, a.strand, a.track, a.section, a.subject,
                a.teacher_id,
                t.name AS adviser_name,
                u.username AS adviser_username,
                a.subject_teacher_id,
                st.name AS subject_teacher_name,
                su.username AS subject_teacher_username,
                COUNT(asg.student_id) AS student_count
         FROM assignments a
         LEFT JOIN teachers t ON t.id = a.teacher_id
         LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN teachers st ON st.id = a.subject_teacher_id
         LEFT JOIN users su ON su.id = st.user_id
         LEFT JOIN assignment_students asg ON asg.assignment_id = a.id
         GROUP BY a.id, a.year_level, a.strand, a.track, a.section, a.subject, a.teacher_id, t.name, u.username, a.subject_teacher_id, st.name, su.username
         ORDER BY a.year_level, a.strand, a.track, a.section, a.subject`,
        []
      ) as any[];
      res.json(rows);
      return;
    }

    // fallback path when DB schema doesn't have subject_teacher_id
    const [rows] = await pool.execute(
      `SELECT a.id, a.year_level, a.strand, a.track, a.section, a.subject,
              a.teacher_id,
              t.name AS adviser_name,
              u.username AS adviser_username,
              COUNT(asg.student_id) AS student_count
       FROM assignments a
       LEFT JOIN teachers t ON t.id = a.teacher_id
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN assignment_students asg ON asg.assignment_id = a.id
       GROUP BY a.id, a.year_level, a.strand, a.track, a.section, a.subject, a.teacher_id, t.name, u.username
       ORDER BY a.year_level, a.strand, a.track, a.section, a.subject`,
      []
    ) as any[];

    // normalize shape so frontend can handle missing subject teacher fields
    const normalized = (rows as any[]).map((r) => ({
      ...r,
      subject_teacher_id: null,
      subject_teacher_name: null,
      subject_teacher_username: null,
    }));
    res.json(normalized);
  } catch (err) {
    console.error('getAssignments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /admin/assignments/grouped ─────────────────────────────────
// Returns assignments grouped by (year_level + strand + track + section)
// Each group = one "class block" in Image 1 layout
export async function getAssignmentsGrouped(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      `SELECT a.id, a.year_level, a.strand, a.track, a.section, a.subject,
              a.teacher_id,
              t.name AS adviser_name,
              u.username AS adviser_username,
              a.subject_teacher_id,
              st.name AS subject_teacher_name,
              su.username AS subject_teacher_username,
              COUNT(DISTINCT asg.student_id) AS student_count,
              GROUP_CONCAT(DISTINCT asg.student_id ORDER BY asg.student_id SEPARATOR ',') AS student_ids_csv
       FROM assignments a
       LEFT JOIN teachers t ON t.id = a.teacher_id
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN teachers st ON st.id = a.subject_teacher_id
       LEFT JOIN users su ON su.id = st.user_id
       LEFT JOIN assignment_students asg ON asg.assignment_id = a.id
       GROUP BY a.id, a.year_level, a.strand, a.track, a.section, a.subject,
                a.teacher_id, t.name, u.username,
                a.subject_teacher_id, st.name, su.username
       ORDER BY a.year_level, a.strand, a.track, a.section, a.subject`,
      []
    ) as any[];

    // Parse student_ids_csv into arrays
    const rowsWithIds = (rows as any[]).map((r) => ({
      ...r,
      student_ids: r.student_ids_csv ? r.student_ids_csv.split(',').map(Number) : [],
      student_count: Number(r.student_count),
    }));

    // Group by section key
    const groups: Record<string, any> = {};
    for (const row of rowsWithIds) {
      const key = `${row.year_level}|${row.strand || ''}|${row.track || ''}|${row.section}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          year_level: row.year_level,
          strand: row.strand,
          track: row.track,
          section: row.section,
          adviser_id: row.teacher_id,
          adviser_name: row.adviser_name,
          adviser_username: row.adviser_username,
          subjects: [],
        };
      }
      groups[key].subjects.push({
        id: row.id,
        subject: row.subject,
        subject_teacher_id: row.subject_teacher_id,
        subject_teacher_name: row.subject_teacher_name,
        subject_teacher_username: row.subject_teacher_username,
        student_count: row.student_count,
        student_ids: row.student_ids,
      });
    }

    res.json(Object.values(groups));
  } catch (err) {
    console.error('getAssignmentsGrouped error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAssignmentsMetadata(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [teacherRows] = await pool.execute(
      `SELECT t.id, t.name, u.username
       FROM teachers t
       LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.name`
    ) as any[];

    const [studentRows] = await pool.execute(
      `SELECT s.id, s.lrn, s.name, s.grade, s.section,
              GROUP_CONCAT(asg.assignment_id ORDER BY asg.assignment_id SEPARATOR ',') AS assignment_ids
       FROM students s
       LEFT JOIN assignment_students asg ON asg.student_id = s.id
       WHERE s.is_active = 1
       GROUP BY s.id
       ORDER BY s.name`
    ) as any[];

    const students = studentRows.map((student: any) => ({
      ...student,
      assignment_ids: student.assignment_ids ? student.assignment_ids.split(',').map((id: string) => Number(id)) : [],
      assignment_id: student.assignment_ids ? Number(student.assignment_ids.split(',')[0]) : null,
    }));

    res.json({ teachers: teacherRows, students });
  } catch (err) {
    console.error('getAssignmentsMetadata error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createAssignment(req: AuthRequest, res: Response): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { year_level, strand, track, section, subject, teacher_id, subject_teacher_id, student_ids } = req.body;

    if (!year_level || !section || !subject) {
      res.status(400).json({ error: 'year_level, section, and subject are required' });
      return;
    }

    const includeSubjectTeacher = await hasSubjectTeacherColumn();
    let result: any;
    if (includeSubjectTeacher) {
      [result] = await conn.execute(
        `INSERT INTO assignments
           (year_level, strand, track, section, subject, teacher_id, subject_teacher_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [year_level, strand || null, track || null, section, subject, teacher_id || null, subject_teacher_id || null, req.user!.id]
      ) as any[];
    } else {
      [result] = await conn.execute(
        `INSERT INTO assignments
           (year_level, strand, track, section, subject, teacher_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [year_level, strand || null, track || null, section, subject, teacher_id || null, req.user!.id]
      ) as any[];
    }

    const assignmentId = (result as any).insertId;

    if (Array.isArray(student_ids) && student_ids.length > 0) {
      const values = student_ids.map((studentId: number) => [assignmentId, studentId, req.user!.id]);
      await conn.query(
        `INSERT IGNORE INTO assignment_students (assignment_id, student_id, created_by)
         VALUES ?`,
        [values]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Assignment created', id: assignmentId });
  } catch (err) {
    await conn.rollback();
    console.error('createAssignment error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

export async function updateAssignment(req: AuthRequest, res: Response): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { year_level, strand, track, section, subject, teacher_id, subject_teacher_id, student_ids } = req.body;

    if (!year_level || !section || !subject) {
      res.status(400).json({ error: 'year_level, section, and subject are required' });
      return;
    }

    const includeSubjectTeacher = await hasSubjectTeacherColumn();
    if (includeSubjectTeacher) {
      await conn.execute(
        `UPDATE assignments
         SET year_level = ?, strand = ?, track = ?, section = ?, subject = ?, teacher_id = ?, subject_teacher_id = ?, updated_by = ?
         WHERE id = ?`,
        [year_level, strand || null, track || null, section, subject, teacher_id || null, subject_teacher_id || null, req.user!.id, id]
      );
    } else {
      await conn.execute(
        `UPDATE assignments
         SET year_level = ?, strand = ?, track = ?, section = ?, subject = ?, teacher_id = ?, updated_by = ?
         WHERE id = ?`,
        [year_level, strand || null, track || null, section, subject, teacher_id || null, req.user!.id, id]
      );
    }

    await conn.execute(
      'DELETE FROM assignment_students WHERE assignment_id = ?',
      [id]
    );

    if (Array.isArray(student_ids) && student_ids.length > 0) {
      const values = student_ids.map((studentId: number) => [id, studentId, req.user!.id]);
      await conn.query(
        `INSERT IGNORE INTO assignment_students (assignment_id, student_id, created_by)
         VALUES ?`,
        [values]
      );
    }

    await conn.commit();
    res.json({ message: 'Assignment updated' });
  } catch (err) {
    await conn.rollback();
    console.error('updateAssignment error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

export async function deleteAssignment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM assignments WHERE id = ?', [id]);
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    console.error('deleteAssignment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── PATCH /admin/assignments/section-adviser ────────────────────────
// Updates adviser (teacher_id) for ALL rows matching a given section block
export async function updateSectionAdviser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { year_level, strand, track, section, adviser_id } = req.body;
    if (!year_level || !section) {
      res.status(400).json({ error: 'year_level and section are required' });
      return;
    }
    await pool.execute(
      `UPDATE assignments
       SET teacher_id = ?, updated_by = ?
       WHERE year_level = ?
         AND (strand IS NULL AND ? IS NULL OR strand = ?)
         AND (track IS NULL AND ? IS NULL OR track = ?)
         AND section = ?`,
      [
        adviser_id || null, req.user!.id,
        year_level,
        strand || null, strand || null,
        track || null, track || null,
        section,
      ]
    );
    res.json({ message: 'Adviser updated for section' });
  } catch (err) {
    console.error('updateSectionAdviser error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
