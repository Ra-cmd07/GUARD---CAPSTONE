"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitExcuse = submitExcuse;
exports.getParentExcuseRequests = getParentExcuseRequests;
exports.getTeacherExcuseRequests = getTeacherExcuseRequests;
exports.resolveExcuseRequest = resolveExcuseRequest;
exports.deleteExcuseRequest = deleteExcuseRequest;
const db_1 = __importDefault(require("../lib/db"));
const notificationController_1 = require("./notificationController");
const date_fns_1 = require("date-fns");
// ─── Helper: get parent row from DB ──────────────────────────────────
async function getParentRow(userId) {
    const [rows] = await db_1.default.query(`SELECT p.id, p.user_id, p.name, p.contact
     FROM parents p WHERE p.user_id = ? LIMIT 1`, [userId]);
    return rows.length > 0 ? rows[0] : null;
}
// ─── Helper: get teacher for a student's section ──────────────────────
async function getTeacherForStudent(studentId) {
    const [rows] = await db_1.default.query(`SELECT t.id, t.user_id, t.name, t.section
     FROM teachers t
     JOIN students s ON LOWER(s.section) = LOWER(t.section)
     WHERE s.id = ?
     LIMIT 1`, [studentId]);
    return rows.length > 0 ? rows[0] : null;
}
// ─── POST /parent/excuse ──────────────────────────────────────────────
// Parent submits an excuse for their child's absence
async function submitExcuse(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { student_id, date, reason, attendance_id } = req.body;
        if (!student_id || !date || !reason?.trim())
            return res.status(400).json({ error: 'student_id, date, and reason are required' });
        const parent = await getParentRow(userId);
        if (!parent)
            return res.status(404).json({ error: 'Parent profile not found' });
        // Verify this parent is linked to this student
        const [link] = await db_1.default.query(`SELECT id FROM parent_student WHERE parent_id = ? AND student_id = ?`, [parent.id, student_id]);
        if (!link.length)
            return res.status(403).json({ error: 'Not authorized for this student' });
        // Find the teacher for this student
        const teacher = await getTeacherForStudent(student_id);
        // Check no duplicate pending request for same student + date
        const [existing] = await db_1.default.query(`SELECT id FROM excuse_requests
       WHERE student_id = ? AND date = ? AND status = 'pending'`, [student_id, date]);
        if (existing.length)
            return res.status(409).json({ error: 'A pending excuse request already exists for this date' });
        // Get student name
        const [studentRows] = await db_1.default.query(`SELECT name FROM students WHERE id = ?`, [student_id]);
        const studentName = studentRows[0]?.name || 'Student';
        // Insert excuse request
        const [result] = await db_1.default.query(`INSERT INTO excuse_requests
         (student_id, parent_id, teacher_id, attendance_id, date, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`, [student_id, parent.id, teacher?.id || null, attendance_id || null, date, reason.trim()]);
        // Notify the teacher via in-app notification
        if (teacher?.user_id) {
            await (0, notificationController_1.createNotification)(teacher.user_id, '📋 New Excuse Request', `${parent.name} submitted an excuse for ${studentName} on ${(0, date_fns_1.format)(new Date(date + 'T00:00:00'), 'MMM d, yyyy')}`, 'info', '/teacher');
        }
        res.status(201).json({
            success: true,
            message: 'Excuse request submitted successfully',
            excuseId: result.insertId,
        });
    }
    catch (error) {
        console.error('Error submitting excuse:', error);
        res.status(500).json({ error: 'Failed to submit excuse request' });
    }
}
// ─── GET /parent/excuse-requests ─────────────────────────────────────
// Parent views their submitted excuse requests
async function getParentExcuseRequests(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const parent = await getParentRow(userId);
        if (!parent)
            return res.status(404).json({ error: 'Parent profile not found' });
        const [rows] = await db_1.default.query(`SELECT er.id, er.student_id, er.date, er.reason,
              er.status, er.teacher_note, er.created_at, er.resolved_at,
              s.name AS student_name,
              t.name AS teacher_name
       FROM excuse_requests er
       JOIN students  s ON s.id = er.student_id
       LEFT JOIN teachers t ON t.id = er.teacher_id
       WHERE er.parent_id = ?
       ORDER BY er.created_at DESC
       LIMIT 50`, [parent.id]);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching excuse requests:', error);
        res.status(500).json({ error: 'Failed to fetch excuse requests' });
    }
}
// ─── GET /teacher/excuse-requests ────────────────────────────────────
// Teacher views pending excuse requests for their class
async function getTeacherExcuseRequests(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        // Get teacher row
        const [tRows] = await db_1.default.query(`SELECT id, name, section FROM teachers WHERE user_id = ? LIMIT 1`, [userId]);
        if (!tRows.length)
            return res.status(404).json({ error: 'Teacher profile not found' });
        const teacher = tRows[0];
        const statusFilter = req.query.status || 'pending';
        const [rows] = await db_1.default.query(`SELECT er.id, er.student_id, er.date, er.reason,
              er.status, er.teacher_note, er.created_at, er.resolved_at,
              s.name AS student_name, s.lrn, s.section,
              p.name AS parent_name, p.contact AS parent_contact
       FROM excuse_requests er
       JOIN students  s ON s.id = er.student_id
       LEFT JOIN parents p ON p.id = er.parent_id
       WHERE LOWER(s.section) = LOWER(?)
         AND (? = 'all' OR er.status = ?)
       ORDER BY er.status ASC, er.created_at DESC`, [teacher.section, statusFilter, statusFilter]);
        const pendingCount = rows.filter((r) => r.status === 'pending').length;
        res.json({ requests: rows, pendingCount });
    }
    catch (error) {
        console.error('Error fetching teacher excuse requests:', error);
        res.status(500).json({ error: 'Failed to fetch excuse requests' });
    }
}
// ─── PATCH /teacher/excuse-requests/:id ──────────────────────────────
// Teacher approves or rejects an excuse request
async function resolveExcuseRequest(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id } = req.params;
        const { action, teacher_note } = req.body; // action: 'approve' | 'reject'
        if (!['approve', 'reject'].includes(action))
            return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
        // Get the excuse request
        const [excuseRows] = await db_1.default.query(`SELECT er.*, s.name AS student_name, s.section,
              p.user_id AS parent_user_id, p.name AS parent_name, p.contact AS parent_contact
       FROM excuse_requests er
       JOIN students s ON s.id = er.student_id
       JOIN parents  p ON p.id = er.parent_id
       WHERE er.id = ?`, [id]);
        if (!excuseRows.length)
            return res.status(404).json({ error: 'Excuse request not found' });
        const excuse = excuseRows[0];
        if (excuse.status !== 'pending')
            return res.status(409).json({ error: 'This request has already been resolved' });
        // Verify teacher owns this section
        const [tRows] = await db_1.default.query(`SELECT id, name, section FROM teachers WHERE user_id = ? LIMIT 1`, [userId]);
        if (!tRows.length)
            return res.status(404).json({ error: 'Teacher not found' });
        if (tRows[0].section.toLowerCase() !== excuse.section.toLowerCase())
            return res.status(403).json({ error: 'This student is not in your class' });
        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        // Update excuse request status
        await db_1.default.query(`UPDATE excuse_requests
       SET status = ?, teacher_note = ?, resolved_at = NOW()
       WHERE id = ?`, [newStatus, teacher_note || null, id]);
        // If APPROVED → update attendance record status to Excused
        if (action === 'approve') {
            if (excuse.attendance_id) {
                await db_1.default.query(`UPDATE attendance SET status = 'Absent', is_overridden = 1,
                                 notes = CONCAT(IFNULL(notes,''), ' | Excused by teacher')
           WHERE id = ?`, [excuse.attendance_id]);
            }
            else {
                // Find the attendance record by student + date
                const [attRows] = await db_1.default.query(`SELECT id FROM attendance
           WHERE student_id = ? AND DATE(CONVERT_TZ(date,'+00:00','+08:00')) = ?
           LIMIT 1`, [excuse.student_id, excuse.date]);
                if (attRows.length) {
                    await db_1.default.query(`UPDATE attendance SET status = 'Absent', is_overridden = 1,
                                   notes = CONCAT(IFNULL(notes,''), ' | Excused by teacher')
             WHERE id = ?`, [attRows[0].id]);
                }
            }
        }
        // Notify parent via in-app notification
        const actionText = action === 'approve' ? '✅ Approved' : '❌ Rejected';
        const dateStr = (0, date_fns_1.format)(new Date(excuse.date + 'T00:00:00'), 'MMM d, yyyy');
        await (0, notificationController_1.createNotification)(excuse.parent_user_id, `${actionText}: Excuse for ${excuse.student_name}`, action === 'approve'
            ? `Your excuse request for ${excuse.student_name} on ${dateStr} was approved.${teacher_note ? ' Note: ' + teacher_note : ''}`
            : `Your excuse request for ${excuse.student_name} on ${dateStr} was rejected.${teacher_note ? ' Reason: ' + teacher_note : ''}`, action === 'approve' ? 'info' : 'warning', '/parent');
        res.json({
            success: true,
            message: `Excuse request ${newStatus}`,
            status: newStatus,
        });
    }
    catch (error) {
        console.error('Error resolving excuse request:', error);
        res.status(500).json({ error: 'Failed to resolve excuse request' });
    }
}
exports.default = {
    submitExcuse,
    getParentExcuseRequests,
    getTeacherExcuseRequests,
    resolveExcuseRequest,
    deleteExcuseRequest,
};
async function deleteExcuseRequest(req, res) {
    try {
        const userId = req.user?.id;
        const { id } = req.params;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        // Verify teacher owns this section
        const [tRows] = await db_1.default.query('SELECT section FROM teachers WHERE user_id = ? LIMIT 1', [userId]);
        if (!tRows.length)
            return res.status(404).json({ error: 'Teacher not found' });
        // Verify the request belongs to this teacher's section
        const [excuseRows] = await db_1.default.query(`SELECT er.id FROM excuse_requests er
       JOIN students s ON s.id = er.student_id
       WHERE er.id = ? AND LOWER(s.section) = LOWER(?)`, [id, tRows[0].section]);
        if (!excuseRows.length)
            return res.status(404).json({ error: 'Excuse request not found or not in your class' });
        await db_1.default.query('DELETE FROM excuse_requests WHERE id = ?', [id]);
        res.json({ success: true, message: 'Excuse request deleted' });
    }
    catch (error) {
        console.error('Error deleting excuse request:', error);
        res.status(500).json({ error: 'Failed to delete excuse request' });
    }
}
