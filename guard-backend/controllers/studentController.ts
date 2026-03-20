import { Request, Response } from 'express';
import pool from '../lib/db';
import { AuthRequest } from '../middleware/authMiddleware';

// ─── GET /api/students ────────────────────────────────────────────────
export async function getStudents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      `SELECT
         s.id, s.lrn, s.name, s.gender, s.created_at,
         JSON_ARRAYAGG(
           JSON_OBJECT(
             'role',           pg.role,
             'name',           pg.name,
             'contact_number', pg.contact_number
           )
         ) AS parents_guardians
       FROM students s
       LEFT JOIN parents_guardians pg ON s.id = pg.student_id
       GROUP BY s.id
       ORDER BY s.name`
    ) as any[];

    res.json(rows);
  } catch (err) {
    console.error('getStudents error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── POST /api/students ───────────────────────────────────────────────
export async function createStudent(req: AuthRequest, res: Response): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { lrn, name, gender, parents_guardians } = req.body;

    if (!lrn || !name || !gender) {
      res.status(400).json({ error: 'lrn, name, and gender are required' });
      return;
    }

    // Insert student
    const [result] = await conn.execute(
      'INSERT INTO students (lrn, name, gender) VALUES (?, ?, ?)',
      [lrn, name, gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : gender]
    ) as any[];

    const studentId = (result as any).insertId;

    // Insert each parent/guardian
    if (Array.isArray(parents_guardians)) {
      for (const pg of parents_guardians) {
        if (pg.name) {
          await conn.execute(
            `INSERT INTO parents_guardians (student_id, role, name, contact_number)
             VALUES (?, ?, ?, ?)`,
            [studentId, pg.role, pg.name, pg.contact_number || null]
          );
        }
      }
    }

    await conn.commit();

    res.status(201).json({
      id:      studentId,
      message: 'Student registered successfully',
    });
  } catch (err: any) {
    await conn.rollback();
    console.error('createStudent error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'LRN already registered' });
      return;
    }
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

// ─── GET /api/students/:id ────────────────────────────────────────────
export async function getStudentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const [students] = await pool.execute(
      'SELECT * FROM students WHERE id = ?', [id]
    ) as any[];

    if ((students as any[]).length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const [guardians] = await pool.execute(
      'SELECT * FROM parents_guardians WHERE student_id = ?', [id]
    ) as any[];

    res.json({ ...(students as any[])[0], parents_guardians: guardians });
  } catch (err) {
    console.error('getStudentById error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}