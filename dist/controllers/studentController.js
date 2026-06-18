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
exports.getStudentSmsLogs = getStudentSmsLogs;
exports.clearStudentSmsLogs = clearStudentSmsLogs;
const db_1 = __importDefault(require("../lib/db"));
// ─── GET /api/students ────────────────────────────────────────────────
async function getStudents(req, res) {
    console.log('[getStudents] START');
    console.log('[getStudents] req.user:', JSON.stringify(req.user));
    try {
        const { role, profileId } = req.user;
        console.log(`[getStudents] Role: ${role}, ProfileId: ${profileId}`);
        // For parent role, directly query without complex joins
        if (role === 'parent' && profileId) {
            console.log(`[getStudents] Querying for parent ${profileId}`);
            // Get student linked to this parent (using parents_teachers.student_id)
            const [parentRows] = await db_1.default.execute('SELECT student_id FROM parents_teachers WHERE id = ? AND student_id IS NOT NULL', [profileId]);
            console.log(`[getStudents] Parent record:`, parentRows);
            if (parentRows.length === 0 || !parentRows[0].student_id) {
                console.log('[getStudents] No children found for this parent');
                res.json([]);
                return;
            }
            const studentId = parentRows[0].student_id;
            console.log(`[getStudents] Student ID:`, studentId);
            // Get student details
            const [students] = await db_1.default.execute(`SELECT id, lrn, name, gender, grade, section, mac_address, rfid_uid, is_active, created_at
         FROM students WHERE id = ?`, [studentId]);
            console.log(`[getStudents] Found ${students.length} student(s)`);
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
        let q = 'SELECT *, DATE_FORMAT(date, "%Y-%m-%d") as date_str FROM attendance WHERE student_id = ?';
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
        // Replace date with formatted string to avoid timezone issues
        const formatted = rows.map(r => ({
            ...r,
            date: r.date_str // Use the formatted string instead of DATE object
        }));
        res.json(formatted);
    }
    catch (err) {
        console.error('getStudentAttendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/students/:id/sms-logs ──────────────────────────────────────
async function getStudentSmsLogs(req, res) {
    try {
        const { id } = req.params;
        // Get SMS logs for this student
        const [logs] = await db_1.default.execute(`SELECT 
        id, student_name, parent_name, phone_number, message, 
        status, provider, sent_at, created_at
       FROM sms_logs 
       WHERE student_name = (SELECT name FROM students WHERE id = ?)
       ORDER BY created_at DESC
       LIMIT 100`, [id]);
        res.json(logs);
    }
    catch (err) {
        console.error('Error fetching SMS logs:', err);
        res.status(500).json({ error: 'Failed to fetch SMS logs' });
    }
}
// ─── DELETE /api/students/:id/sms-logs/clear ─────────────────────────────
async function clearStudentSmsLogs(req, res) {
    try {
        const { id } = req.params;
        console.log(`🗑️  Parent clearing SMS history for student ${id}...`);
        // Get student name first
        const [students] = await db_1.default.execute('SELECT name FROM students WHERE id = ?', [id]);
        if (students.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        const studentName = students[0].name;
        // Count before deletion
        const [countBefore] = await db_1.default.execute('SELECT COUNT(*) as total FROM sms_logs WHERE student_name = ?', [studentName]);
        const totalBefore = countBefore[0].total;
        // Delete SMS logs for this student only
        const [result] = await db_1.default.execute('DELETE FROM sms_logs WHERE student_name = ?', [studentName]);
        console.log(`✅ Deleted ${result.affectedRows} SMS logs for ${studentName}`);
        res.json({
            success: true,
            message: 'SMS history cleared successfully',
            deletedCount: result.affectedRows,
            previousCount: totalBefore
        });
    }
    catch (err) {
        console.error('Error clearing student SMS logs:', err);
        res.status(500).json({ error: 'Failed to clear SMS history' });
    }
}
