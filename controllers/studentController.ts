import { Request, Response } from 'express';
import pool from '../lib/db';
import { AuthRequest } from '../middleware/authMiddleware';

// ─── GET /api/students ────────────────────────────────────────────────
export async function getStudents(req: AuthRequest, res: Response): Promise<void> {
  console.log('[getStudents] START');
  console.log('[getStudents] req.user:', JSON.stringify(req.user));
  
  try {
    const { role, profileId } = req.user!;
    console.log(`[getStudents] Role: ${role}, ProfileId: ${profileId}`);
    
    // For parent role, directly query without complex joins
    if (role === 'parent' && profileId) {
      console.log(`[getStudents] Querying for parent ${profileId}`);
      
      // Get student linked to this parent (using parents_teachers.student_id)
      const [parentRows] = await pool.execute(
        'SELECT student_id FROM parents_teachers WHERE id = ? AND student_id IS NOT NULL',
        [profileId]
      ) as any[];
      console.log(`[getStudents] Parent record:`, parentRows);
      
      if ((parentRows as any[]).length === 0 || !(parentRows as any[])[0].student_id) {
        console.log('[getStudents] No children found for this parent');
        res.json([]);
        return;
      }
      
      const studentId = (parentRows as any[])[0].student_id;
      console.log(`[getStudents] Student ID:`, studentId);
      
      // Get student details
      const [students] = await pool.execute(
        `SELECT id, lrn, name, gender, grade, section, mac_address, rfid_uid, is_active, created_at
         FROM students WHERE id = ?`,
        [studentId]
      ) as any[];
      console.log(`[getStudents] Found ${(students as any[]).length} student(s)`);
      
      res.json(students);
      return;
    }
    
    // Original logic for other roles
    let query = `
      SELECT
        s.id, s.lrn, s.name, s.gender, s.grade, s.section,
        s.mac_address, s.rfid_uid, s.is_active, s.created_at
      FROM students s
    `;
    const params: any[] = [];

    if (role === 'teacher' && profileId) {
      const [tRows] = await pool.execute(
        'SELECT section FROM teachers WHERE id = ?', [profileId]
      ) as any[];
      const sec = (tRows as any[])[0]?.section;
      if (sec) { query += ' WHERE s.section = ?'; params.push(sec); }
    } else if (role === 'student' && profileId) {
      query += ' WHERE s.id = ?';
      params.push(profileId);
    }

    query += ' ORDER BY s.name';
    const [rows] = await pool.execute(query, params) as any[];
    
    // For each student, fetch their guardian contacts from parents_teachers table
    const students = rows as any[];
    for (const student of students) {
      const [guardians] = await pool.execute(
        'SELECT role, name, contact_number FROM parents_teachers WHERE student_id = ?',
        [student.id]
      ) as any[];
      student.parents_guardians = guardians;
    }
    
    res.json(students);
  } catch (err) {
    const errorMessage = (err as Error).message;
    const errorStack = (err as Error).stack;
    console.error('getStudents error:', errorMessage);
    console.error('Stack:', errorStack);
    console.error('User:', req.user);
    res.status(500).json({ 
      error: 'Server error', 
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined 
    });
  }
}

// ─── POST /api/students ───────────────────────────────────────────────
export async function createStudent(req: AuthRequest, res: Response): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { lrn, name, gender, grade, section, mac_address, rfid_uid, parents_guardians } = req.body;

    if (!lrn || !name || !gender) {
      res.status(400).json({ error: 'lrn, name, and gender are required' });
      return;
    }

    const [result] = await conn.execute(
      `INSERT INTO students (lrn, name, gender, grade, section, mac_address, rfid_uid, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [lrn, name,
       gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : gender,
       grade || null, section || null, mac_address || null, rfid_uid || null,
       req.user?.id || null]
    ) as any[];
    const studentId = (result as any).insertId;

    if (Array.isArray(parents_guardians)) {
      for (const pg of parents_guardians) {
        if (pg.name) {
          await conn.execute(
            'INSERT INTO parents_teachers (student_id, role, name, contact_number) VALUES (?, ?, ?, ?)',
            [studentId, pg.role, pg.name, pg.contact_number || null]
          );
        }
      }
    }

    await conn.commit();
    res.status(201).json({ id: studentId, message: 'Student registered successfully' });
  } catch (err: any) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'LRN already registered' });
      return;
    }
    console.error('createStudent error:', err);
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
      'SELECT * FROM parents_teachers WHERE student_id = ?', [id]
    ) as any[];
    res.json({ ...(students as any[])[0], parents_guardians: guardians });
  } catch (err) {
    console.error('getStudentById error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── PUT /api/students/:id ────────────────────────────────────────────
export async function updateStudent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, gender, grade, section, mac_address, rfid_uid } = req.body;

    await pool.execute(
      `UPDATE students SET name=?, gender=?, grade=?, section=?, mac_address=?, rfid_uid=?, updated_by=?
       WHERE id=?`,
      [name,
       gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : (gender || null),
       grade || null, section || null, mac_address || null, rfid_uid || null,
       req.user!.id, id]
    );
    res.json({ message: 'Student updated' });
  } catch (err) {
    console.error('updateStudent error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /api/students/:id/attendance ────────────────────────────────
export async function getStudentAttendance(req: Request, res: Response): Promise<void> {
  try {
    const { id }   = req.params;
    const from     = req.query.from as string;
    const to       = req.query.to   as string;

    let q = 'SELECT *, DATE_FORMAT(date, "%Y-%m-%d") as date_str FROM attendance WHERE student_id = ?';
    const p: any[] = [id];

    if (from) { q += ' AND date >= ?'; p.push(from); }
    if (to)   { q += ' AND date <= ?'; p.push(to); }
    q += ' ORDER BY date DESC, timestamp DESC';

    const [rows] = await pool.execute(q, p) as any[];
    
    // Replace date with formatted string to avoid timezone issues
    const formatted = (rows as any[]).map(r => ({
      ...r,
      date: r.date_str  // Use the formatted string instead of DATE object
    }));
    
    res.json(formatted);
  } catch (err) {
    console.error('getStudentAttendance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /api/students/:id/sms-logs ──────────────────────────────────────
export async function getStudentSmsLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Get SMS logs for this student
    const [logs] = await pool.execute(
      `SELECT 
        id, student_name, parent_name, phone_number, message, 
        status, provider, sent_at, created_at
       FROM sms_logs 
       WHERE student_name = (SELECT name FROM students WHERE id = ?)
       ORDER BY created_at DESC
       LIMIT 100`,
      [id]
    ) as any[];
    
    res.json(logs);
  } catch (err) {
    console.error('Error fetching SMS logs:', err);
    res.status(500).json({ error: 'Failed to fetch SMS logs' });
  }
}

// ─── DELETE /api/students/:id/sms-logs/clear ─────────────────────────────
export async function clearStudentSmsLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    console.log(`🗑️  Parent clearing SMS history for student ${id}...`);
    
    // Get student name first
    const [students] = await pool.execute(
      'SELECT name FROM students WHERE id = ?',
      [id]
    ) as any[];
    
    if ((students as any[]).length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    
    const studentName = (students as any[])[0].name;
    
    // Count before deletion
    const [countBefore] = await pool.execute(
      'SELECT COUNT(*) as total FROM sms_logs WHERE student_name = ?',
      [studentName]
    ) as any[];
    const totalBefore = (countBefore as any[])[0].total;
    
    // Delete SMS logs for this student only
    const [result] = await pool.execute(
      'DELETE FROM sms_logs WHERE student_name = ?',
      [studentName]
    ) as any[];
    
    console.log(`✅ Deleted ${(result as any).affectedRows} SMS logs for ${studentName}`);
    
    res.json({
      success: true,
      message: 'SMS history cleared successfully',
      deletedCount: (result as any).affectedRows,
      previousCount: totalBefore
    });
  } catch (err) {
    console.error('Error clearing student SMS logs:', err);
    res.status(500).json({ error: 'Failed to clear SMS history' });
  }
}
