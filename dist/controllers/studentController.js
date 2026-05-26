"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudents = getStudents;
exports.createStudent = createStudent;
exports.getStudentById = getStudentById;
const db_1 = __importDefault(require("../lib/db"));
// ─── GET /api/students ────────────────────────────────────────────────
async function getStudents(req, res) {
    try {
        const [rows] = await db_1.default.execute(`SELECT
         s.id, s.lrn, s.name, s.gender, s.mac_address, s.created_at,
         JSON_ARRAYAGG(
           JSON_OBJECT(
             'role',           pg.role,
             'name',           pg.name,
             'contact_number', pg.contact_number
           )
         ) AS parents_guardians
       FROM students s
       LEFT JOIN parents_teachers pg ON s.id = pg.student_id
       GROUP BY s.id
       ORDER BY s.name`);
        res.json(rows);
    }
    catch (err) {
        console.error('getStudents error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── POST /api/students ───────────────────────────────────────────────
async function createStudent(req, res) {
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const { lrn, name, gender, mac_address, parents_guardians } = req.body;
        if (!lrn || !name || !gender) {
            res.status(400).json({ error: 'lrn, name, and gender are required' });
            return;
        }
        // Insert student
        const [result] = await conn.execute('INSERT INTO students (lrn, name, gender, mac_address) VALUES (?, ?, ?, ?)', [
            lrn,
            name,
            gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : gender,
            mac_address || null,
        ]);
        const studentId = result.insertId;
        // Insert each parent/guardian
        if (Array.isArray(parents_guardians)) {
            for (const pg of parents_guardians) {
                if (pg.name) {
                    await conn.execute(`INSERT INTO parents_teachers (student_id, role, name, contact_number)
             VALUES (?, ?, ?, ?)`, [studentId, pg.role, pg.name, pg.contact_number || null]);
                }
            }
        }
        await conn.commit();
        res.status(201).json({
            id: studentId,
            message: 'Student registered successfully',
        });
    }
    catch (err) {
        await conn.rollback();
        console.error('createStudent error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'LRN already registered' });
            return;
        }
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
