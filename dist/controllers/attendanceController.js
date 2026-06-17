"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendance = getAttendance;
exports.createAttendance = createAttendance;
exports.updateAttendance = updateAttendance;
exports.deleteAttendance = deleteAttendance;
exports.getAttendanceStats = getAttendanceStats;
exports.getOverrideLogs = getOverrideLogs;
exports.getRecentAttendance = getRecentAttendance;
const db_1 = __importDefault(require("../lib/db"));
// ─── GET /api/attendance ──────────────────────────────────────────────
// Admin sees all; Teacher sees own class; Parent sees child; Student sees own
async function getAttendance(req, res) {
    try {
        const { role, id: userId, profileId } = req.user;
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const section = req.query.section;
        let query = `
      SELECT a.id, a.student_id, a.student_name, a.lrn, a.gender,
             a.grade, a.section, a.teacher_id, a.teacher_name,
             a.kiosk_id, a.scan_method, a.status, a.session,
             a.date, a.time_in, a.time_out, a.timestamp,
             a.photo_path, a.by_whom, a.notes, a.is_overridden,
             a.created_at, a.updated_at
      FROM attendance a
      WHERE a.date = ?
    `;
        const params = [date];
        if (role === 'teacher' && profileId) {
            // Teacher sees only their assigned section
            const [tRows] = await db_1.default.execute('SELECT section FROM teachers WHERE id = ?', [profileId]);
            const teacherSection = tRows[0]?.section;
            if (teacherSection) {
                query += ' AND a.section = ?';
                params.push(teacherSection);
            }
            else {
                query += ' AND a.teacher_id = ?';
                params.push(profileId);
            }
        }
        else if (role === 'parent' && profileId) {
            // Parent sees only their children
            query += ` AND a.student_id IN (
        SELECT ps.student_id FROM parent_student ps WHERE ps.parent_id = ?
      )`;
            params.push(profileId);
        }
        else if (role === 'student' && profileId) {
            query += ' AND a.student_id = ?';
            params.push(profileId);
        }
        else if (role === 'admin') {
            // Admin can filter by section
            if (section) {
                query += ' AND a.section = ?';
                params.push(section);
            }
        }
        query += ' ORDER BY a.timestamp DESC';
        const [rows] = await db_1.default.execute(query, params);
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
        const { role, profileId } = req.user;
        const { student_id, student_name, lrn, gender, grade, section, teacher_id, teacher_name, kiosk_id, scan_method, status, session, date, time_in, time_out, photo_path, qr_data, by_whom, notes, } = req.body;
        if (!student_name || !status || !date) {
            res.status(400).json({ error: 'student_name, status, and date are required' });
            return;
        }
        // Resolve teacher info from token if teacher role
        let resolvedTeacherId = teacher_id || null;
        let resolvedTeacherName = teacher_name || null;
        if (role === 'teacher' && profileId && !resolvedTeacherId) {
            resolvedTeacherId = profileId;
            const [tRows] = await db_1.default.execute('SELECT name FROM teachers WHERE id = ?', [profileId]);
            resolvedTeacherName = tRows[0]?.name || null;
        }
        // Prevent duplicate same-status record on the same day
        const [existing] = await db_1.default.execute(`SELECT id FROM attendance WHERE student_name = ? AND date = ? AND status = ?`, [student_name, date, status]);
        if (existing.length > 0) {
            res.status(409).json({ error: 'Already recorded', already_exists: true });
            return;
        }
        const session_ = session || (new Date().getHours() < 12 ? 'AM' : 'PM');
        const scanMethod = scan_method || 'QR';
        const [result] = await db_1.default.execute(`INSERT INTO attendance
         (student_id, student_name, lrn, gender, grade, section,
          teacher_id, teacher_name, kiosk_id, scan_method,
          status, session, date, time_in, time_out,
          photo_path, qr_data, by_whom, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            student_id || null, student_name,
            lrn || null, gender || null, grade || null, section || null,
            resolvedTeacherId, resolvedTeacherName,
            kiosk_id || null, scanMethod,
            status, session_, date,
            time_in || null, time_out || null,
            photo_path || null, qr_data || null,
            by_whom || null, notes || null,
        ]);
        const newId = result.insertId;
        res.status(201).json({ id: newId, message: 'Attendance recorded' });
    }
    catch (err) {
        console.error('createAttendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── PATCH /api/attendance/:id ────────────────────────────────────────
// Teachers can override their class records (logged); admin can override all
async function updateAttendance(req, res) {
    try {
        const { id } = req.params;
        const { role, profileId } = req.user;
        const { status, session, notes, reason } = req.body;
        // Fetch existing record
        const [existingRows] = await db_1.default.execute('SELECT * FROM attendance WHERE id = ?', [id]);
        const existing = existingRows[0];
        if (!existing) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        // Teacher can only update their section
        if (role === 'teacher' && profileId) {
            const [tRows] = await db_1.default.execute('SELECT section FROM teachers WHERE id = ?', [profileId]);
            const teacherSection = tRows[0]?.section;
            if (teacherSection && existing.section !== teacherSection) {
                res.status(403).json({ error: 'Cannot update records outside your section' });
                return;
            }
        }
        await db_1.default.execute(`UPDATE attendance SET status = ?, session = ?, notes = ?, is_overridden = 1, updated_by = ?
       WHERE id = ?`, [status || existing.status, session || existing.session, notes || existing.notes,
            req.user.id, id]);
        // Log the override if made by a teacher
        if (role === 'teacher' && profileId && (status !== existing.status || session !== existing.session)) {
            await db_1.default.execute(`INSERT INTO attendance_override_log
           (attendance_id, teacher_id, old_status, new_status, old_session, new_session, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, profileId, existing.status, status || existing.status,
                existing.session, session || existing.session, reason || null]);
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
        await db_1.default.execute('DELETE FROM attendance WHERE id = ?', [id]);
        res.json({ message: 'Deleted successfully' });
    }
    catch (err) {
        console.error('deleteAttendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/attendance/stats ────────────────────────────────────────
async function getAttendanceStats(req, res) {
    try {
        const { role, profileId } = req.user;
        const date = req.query.date || new Date().toISOString().split('T')[0];
        let sectionFilter = '';
        let params = [date];
        if (role === 'teacher' && profileId) {
            const [tRows] = await db_1.default.execute('SELECT section FROM teachers WHERE id = ?', [profileId]);
            const sec = tRows[0]?.section;
            if (sec) {
                sectionFilter = ' AND section = ?';
                params.push(sec);
            }
        }
        const [rows] = await db_1.default.execute(`SELECT status, COUNT(*) AS count
       FROM attendance
       WHERE date = ? ${sectionFilter}
       GROUP BY status`, params);
        const stats = { 'Time-In': 0, 'Time-Out': 0, Late: 0, Absent: 0 };
        for (const row of rows) {
            stats[row.status] = Number(row.count);
        }
        stats.present = stats['Time-In'] + stats['Late'];
        res.json(stats);
    }
    catch (err) {
        console.error('getAttendanceStats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/attendance/override-logs ────────────────────────────────
async function getOverrideLogs(req, res) {
    try {
        const [rows] = await db_1.default.execute(`SELECT aol.*, t.name AS teacher_name, a.student_name, a.date
       FROM attendance_override_log aol
       JOIN teachers t ON t.id = aol.teacher_id
       JOIN attendance a ON a.id = aol.attendance_id
       ORDER BY aol.overridden_at DESC
       LIMIT 200`);
        res.json(rows);
    }
    catch (err) {
        console.error('getOverrideLogs error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/attendance/recent ───────────────────────────────────────
// Get recent attendance records for kiosk display (WiFi-based BLE polling)
async function getRecentAttendance(req, res) {
    try {
        const scan_method = req.query.method || 'BLE';
        const seconds = Number(req.query.seconds) || 30; // Last 30 seconds by default
        const [rows] = await db_1.default.execute(`SELECT 
        a.id, 
        a.student_id, 
        a.student_name, 
        a.status, 
        a.date,
        a.time_in,
        a.time_out,
        a.scan_method,
        a.photo_path,
        a.timestamp,
        TIMESTAMPDIFF(SECOND, a.timestamp, NOW()) as seconds_ago
       FROM attendance a
       WHERE a.scan_method = ? 
       AND a.timestamp >= DATE_SUB(NOW(), INTERVAL ? SECOND)
       ORDER BY a.timestamp DESC
       LIMIT 10`, [scan_method, seconds]);
        res.json(rows);
    }
    catch (err) {
        console.error('getRecentAttendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
