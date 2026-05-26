"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendance = getAttendance;
exports.createAttendance = createAttendance;
exports.updateAttendance = updateAttendance;
exports.deleteAttendance = deleteAttendance;
const db_1 = __importDefault(require("../lib/db"));
// ─── GET /api/attendance?date=YYYY-MM-DD ──────────────────────────────
async function getAttendance(req, res) {
    try {
        const teacherId = req.teacher.id;
        const date = req.query.date ||
            new Date().toISOString().split('T')[0];
        const [rows] = await db_1.default.execute(`SELECT id, teacher_id, student_id, student_name, lrn, gender, teacher_name,
         by_whom, status, session, date, timestamp, updated_at
       FROM attendance
       WHERE teacher_id = ? AND date = ?
       ORDER BY timestamp DESC`, [teacherId, date]);
        res.json(rows);
    }
    catch (err) {
        console.error('getAttendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── POST /api/attendance ─────────────────────────────────────────────
async function createAttendance(req, res) {
    try {
        const teacherId = req.teacher.id;
        const { student_name, lrn, gender, teacher_name, by_whom, status, session, date, qr_data, } = req.body;
        if (!student_name || !status || !date) {
            res.status(400).json({ error: 'student_name, status, and date are required' });
            return;
        }
        // Prevent duplicate same-status record on the same day
        const [existing] = await db_1.default.execute(`SELECT id FROM attendance
       WHERE teacher_id = ? AND student_name = ? AND date = ? AND status = ?`, [teacherId, student_name, date, status]);
        if (existing.length > 0) {
            res.status(409).json({ error: 'Already recorded', already_exists: true });
            return;
        }
        const [result] = await db_1.default.execute(`INSERT INTO attendance
         (teacher_id, student_name, lrn, gender, teacher_name,
          by_whom, status, session, date, qr_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [teacherId,
            student_name,
            lrn || null,
            gender || null,
            teacher_name || null,
            by_whom || null,
            status,
            session || 'AM',
            date,
            qr_data || null]);
        res.status(201).json({
            id: result.insertId,
            message: 'Attendance recorded',
        });
    }
    catch (err) {
        console.error('createAttendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── PATCH /api/attendance/:id ────────────────────────────────────────
async function updateAttendance(req, res) {
    try {
        const { id } = req.params;
        const { status, session } = req.body;
        const teacherId = req.teacher.id;
        const [result] = await db_1.default.execute(`UPDATE attendance
       SET status = ?, session = ?
       WHERE id = ? AND teacher_id = ?`, [status, session || 'AM', id, teacherId]);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Record not found or not yours' });
            return;
        }
        res.json({ message: 'Updated successfully' });
    }
    catch (err) {
        console.error('updateAttendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── DELETE /api/attendance/:id ───────────────────────────────────────
async function deleteAttendance(req, res) {
    try {
        const { id } = req.params;
        const teacherId = req.teacher.id;
        await db_1.default.execute('DELETE FROM attendance WHERE id = ? AND teacher_id = ?', [id, teacherId]);
        res.json({ message: 'Deleted successfully' });
    }
    catch (err) {
        console.error('deleteAttendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
