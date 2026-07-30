"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssignments = getAssignments;
exports.getAssignmentsMetadata = getAssignmentsMetadata;
exports.createAssignment = createAssignment;
exports.updateAssignment = updateAssignment;
exports.deleteAssignment = deleteAssignment;
const db_1 = __importDefault(require("../lib/db"));
async function getAssignments(_req, res) {
    try {
        const [rows] = await db_1.default.execute(`SELECT a.id, a.year_level, a.strand, a.track, a.section, a.subject,
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
       ORDER BY a.year_level, a.strand, a.track, a.section, a.subject`, []);
        res.json(rows);
    }
    catch (err) {
        console.error('getAssignments error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
async function getAssignmentsMetadata(_req, res) {
    try {
        const [teacherRows] = await db_1.default.execute(`SELECT t.id, t.name, u.username
       FROM teachers t
       LEFT JOIN users u ON u.id = t.user_id
       ORDER BY t.name`);
        const [studentRows] = await db_1.default.execute(`SELECT s.id, s.lrn, s.name, s.grade, s.section,
              GROUP_CONCAT(asg.assignment_id ORDER BY asg.assignment_id SEPARATOR ',') AS assignment_ids
       FROM students s
       LEFT JOIN assignment_students asg ON asg.student_id = s.id
       WHERE s.is_active = 1
       GROUP BY s.id
       ORDER BY s.name`);
        const students = studentRows.map((student) => ({
            ...student,
            assignment_ids: student.assignment_ids ? student.assignment_ids.split(',').map((id) => Number(id)) : [],
            assignment_id: student.assignment_ids ? Number(student.assignment_ids.split(',')[0]) : null,
        }));
        res.json({ teachers: teacherRows, students });
    }
    catch (err) {
        console.error('getAssignmentsMetadata error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
async function createAssignment(req, res) {
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const { year_level, strand, track, section, subject, teacher_id, subject_teacher_id, student_ids } = req.body;
        if (!year_level || !section || !subject) {
            res.status(400).json({ error: 'year_level, section, and subject are required' });
            return;
        }
        const [result] = await conn.execute(`INSERT INTO assignments
         (year_level, strand, track, section, subject, teacher_id, subject_teacher_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [year_level, strand || null, track || null, section, subject, teacher_id || null, subject_teacher_id || null, req.user.id]);
        const assignmentId = result.insertId;
        if (Array.isArray(student_ids) && student_ids.length > 0) {
            const values = student_ids.map((studentId) => [assignmentId, studentId, req.user.id]);
            await conn.query(`INSERT IGNORE INTO assignment_students (assignment_id, student_id, created_by)
         VALUES ?`, [values]);
        }
        await conn.commit();
        res.status(201).json({ message: 'Assignment created', id: assignmentId });
    }
    catch (err) {
        await conn.rollback();
        console.error('createAssignment error:', err);
        res.status(500).json({ error: 'Server error' });
    }
    finally {
        conn.release();
    }
}
async function updateAssignment(req, res) {
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const { year_level, strand, track, section, subject, teacher_id, subject_teacher_id, student_ids } = req.body;
        if (!year_level || !section || !subject) {
            res.status(400).json({ error: 'year_level, section, and subject are required' });
            return;
        }
        await conn.execute(`UPDATE assignments
       SET year_level = ?, strand = ?, track = ?, section = ?, subject = ?, teacher_id = ?, subject_teacher_id = ?, updated_by = ?
       WHERE id = ?`, [year_level, strand || null, track || null, section, subject, teacher_id || null, subject_teacher_id || null, req.user.id, id]);
        await conn.execute('DELETE FROM assignment_students WHERE assignment_id = ?', [id]);
        if (Array.isArray(student_ids) && student_ids.length > 0) {
            const values = student_ids.map((studentId) => [id, studentId, req.user.id]);
            await conn.query(`INSERT IGNORE INTO assignment_students (assignment_id, student_id, created_by)
         VALUES ?`, [values]);
        }
        await conn.commit();
        res.json({ message: 'Assignment updated' });
    }
    catch (err) {
        await conn.rollback();
        console.error('updateAssignment error:', err);
        res.status(500).json({ error: 'Server error' });
    }
    finally {
        conn.release();
    }
}
async function deleteAssignment(req, res) {
    try {
        const { id } = req.params;
        await db_1.default.execute('DELETE FROM assignments WHERE id = ?', [id]);
        res.json({ message: 'Assignment deleted' });
    }
    catch (err) {
        console.error('deleteAssignment error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
