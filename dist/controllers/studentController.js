"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudents = getStudents;
exports.createStudent = createStudent;
exports.getStudentById = getStudentById;
exports.updateStudent = updateStudent;
exports.getStudentAttendance = getStudentAttendance;
const db_1 = __importDefault(require("../lib/db"));
// ─── GET /api/students ────────────────────────────────────────────────
async function getStudents(req, res) {
    console.log('[getStudents] START');
    console.log('[getStudents] req.user:', JSON.stringify(req.user));
    try {
        const { role, profileId } = req.user;
        console.log(`[getStudents] Role: ${role}, ProfileId: ${profileId}`);
        // For parent role, get their children via parents_teachers.user_id
        if (role === 'parent') {
            console.log(`[getStudents] Querying for parent user_id: ${req.user.id}`);
            // Query students linked to this parent via user_id
            const [students] = await db_1.default.execute(`SELECT DISTINCT
          s.id, s.lrn, s.name, s.gender, s.grade, s.section,
          s.mac_address, s.rfid_uid, s.is_active, s.created_at
         FROM students s
         INNER JOIN parents_teachers pt ON s.id = pt.student_id
         WHERE pt.user_id = ?
         ORDER BY s.name`, [req.user.id]);
            console.log(`[getStudents] Found ${students.length} children for parent`);
            // Add guardians info for each student
            for (const student of students) {
                const [guardians] = await db_1.default.execute('SELECT role, name, contact_number FROM parents_teachers WHERE student_id = ?', [student.id]);
                student.parents_guardians = guardians;
            }
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
        const params = [];
        if (role === 'teacher' && profileId) {
            const [tRows] = await db_1.default.execute('SELECT section FROM teachers WHERE id = ?', [profileId]);
            const sec = tRows[0]?.section;
            if (sec) {
                query += ' WHERE s.section = ?';
                params.push(sec);
            }
        }
        else if (role === 'student' && profileId) {
            query += ' WHERE s.id = ?';
            params.push(profileId);
        }
        query += ' ORDER BY s.name';
        const [rows] = await db_1.default.execute(query, params);
        // For each student, fetch their guardian contacts from parents_teachers table
        const students = rows;
        for (const student of students) {
            const [guardians] = await db_1.default.execute('SELECT role, name, contact_number FROM parents_teachers WHERE student_id = ?', [student.id]);
            student.parents_guardians = guardians;
        }
        res.json(students);
    }
    catch (err) {
        const errorMessage = err.message;
        const errorStack = err.stack;
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
async function createStudent(req, res) {
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const { lrn, name, gender, grade, section, mac_address, rfid_uid, parents_guardians } = req.body;
        if (!lrn || !name || !gender) {
            res.status(400).json({ error: 'lrn, name, and gender are required' });
            return;
        }
        const [result] = await conn.execute(`INSERT INTO students (lrn, name, gender, grade, section, mac_address, rfid_uid, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [lrn, name,
            gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : gender,
            grade || null, section || null, mac_address || null, rfid_uid || null,
            req.user?.id || null]);
        const studentId = result.insertId;
        if (Array.isArray(parents_guardians)) {
            for (const pg of parents_guardians) {
                if (pg.name) {
                    await conn.execute('INSERT INTO parents_teachers (student_id, role, name, contact_number) VALUES (?, ?, ?, ?)', [studentId, pg.role, pg.name, pg.contact_number || null]);
                }
            }
        }
        await conn.commit();
        res.status(201).json({ id: studentId, message: 'Student registered successfully' });
    }
    catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'LRN already registered' });
            return;
        }
        console.error('createStudent error:', err);
        res.status(500).json({ error: 'Server error' });
    }
    finally {
        conn.release();
    }
}
// ─── GET /api/students/:id ────────────────────────────────────────────
async function getStudentById(req, res) {
    try {
        const { id } = req.params;
        const [students] = await db_1.default.execute('SELECT * FROM students WHERE id = ?', [id]);
        if (students.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        const [guardians] = await db_1.default.execute('SELECT * FROM parents_teachers WHERE student_id = ?', [id]);
        res.json({ ...students[0], parents_guardians: guardians });
    }
    catch (err) {
        console.error('getStudentById error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── PUT /api/students/:id ────────────────────────────────────────────
async function updateStudent(req, res) {
    try {
        const { id } = req.params;
        const { name, gender, grade, section, mac_address, rfid_uid } = req.body;
        await db_1.default.execute(`UPDATE students SET name=?, gender=?, grade=?, section=?, mac_address=?, rfid_uid=?, updated_by=?
       WHERE id=?`, [name,
            gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : (gender || null),
            grade || null, section || null, mac_address || null, rfid_uid || null,
            req.user.id, id]);
        res.json({ message: 'Student updated' });
    }
    catch (err) {
        console.error('updateStudent error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/students/:id/attendance ────────────────────────────────
async function getStudentAttendance(req, res) {
    try {
        const { id } = req.params;
        const from = req.query.from;
        const to = req.query.to;
        let q = 'SELECT * FROM attendance WHERE student_id = ?';
        const p = [id];
        if (from) {
            q += ' AND date >= ?';
            p.push(from);
        }
        if (to) {
            q += ' AND date <= ?';
            p.push(to);
        }
        q += ' ORDER BY date DESC, timestamp DESC';
        const [rows] = await db_1.default.execute(q, p);
        res.json(rows);
    }
    catch (err) {
        console.error('getStudentAttendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
