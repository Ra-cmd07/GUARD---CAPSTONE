"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeacherClasses = getTeacherClasses;
exports.getTodayAttendanceSummary = getTodayAttendanceSummary;
exports.markManualAttendance = markManualAttendance;
exports.addAttendanceNote = addAttendanceNote;
exports.excuseAbsence = excuseAbsence;
const db_1 = __importDefault(require("../lib/db"));
const date_fns_1 = require("date-fns");
// ─── Helper: get teacher row from DB ─────────────────────────────────
async function getTeacherRow(userId) {
    const [rows] = await db_1.default.query(`SELECT t.id, t.user_id, t.name, t.section, t.subject, t.room, t.schedule, t.contact
     FROM teachers t
     WHERE t.user_id = ?
     LIMIT 1`, [userId]);
    return rows.length > 0 ? rows[0] : null;
}
async function getAssignmentsForTeacher(teacherId) {
    const [rows] = await db_1.default.query(`SELECT id, year_level, strand, track, section, subject
     FROM assignments
     WHERE teacher_id = ?
     ORDER BY year_level, strand, track, section, subject`, [teacherId]);
    return rows;
}
async function getTeacherStudentIds(teacherId) {
    const [rows] = await db_1.default.query(`SELECT DISTINCT asg.student_id
     FROM assignment_students asg
     JOIN assignments a ON a.id = asg.assignment_id
     WHERE a.teacher_id = ?`, [teacherId]);
    return rows.map((row) => row.student_id);
}
// ─── GET /teacher/classes ─────────────────────────────────────────────
async function getTeacherClasses(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const teacher = await getTeacherRow(userId);
        if (!teacher)
            return res.status(404).json({ error: 'Teacher profile not found' });
        const assignments = await getAssignmentsForTeacher(teacher.id);
        if (assignments.length > 0) {
            const studentIds = await getTeacherStudentIds(teacher.id);
            const [students] = await db_1.default.query(`SELECT id, lrn, name, grade, section, preferred_method,
                0 AS days_present,
                0 AS attendance_30d
         FROM students
         WHERE id IN (?)
         ORDER BY name`, [studentIds.length > 0 ? studentIds : [0]]);
            res.json({
                teacher: {
                    name: teacher.name,
                    section: assignments[0].section,
                    subject: assignments[0].subject,
                    room: teacher.room,
                    schedule: teacher.schedule,
                    year_level: assignments[0].year_level,
                    strand: assignments[0].strand,
                    track: assignments[0].track,
                    assignments,
                },
                students,
                totalStudents: students.length,
            });
            return;
        }
        const [students] = await db_1.default.query(`SELECT id, lrn, name, grade, section, preferred_method,
              0 AS days_present,
              0 AS attendance_30d
       FROM students
       WHERE LOWER(section) = LOWER(?)
       ORDER BY name`, [teacher.section]);
        res.json({
            teacher: {
                name: teacher.name,
                section: teacher.section,
                subject: teacher.subject,
                room: teacher.room,
                schedule: teacher.schedule,
            },
            students,
            totalStudents: students.length,
        });
    }
    catch (error) {
        console.error('Error getting teacher classes:', error);
        res.status(500).json({ error: 'Failed to load classes' });
    }
}
// ─── GET /teacher/attendance/today ────────────────────────────────────
async function getTodayAttendanceSummary(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const date = req.query.date || (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
        const teacher = await getTeacherRow(userId);
        if (!teacher)
            return res.status(404).json({ error: 'Teacher profile not found' });
        const assignments = await getAssignmentsForTeacher(teacher.id);
        let attendance = [];
        let allStudents = [];
        let section = teacher.section || '';
        if (assignments.length > 0) {
            // If teacher has explicit assignments, prefer the assignment's section
            section = assignments[0]?.section || section;
            const studentIds = await getTeacherStudentIds(teacher.id);
            const [attendanceRows] = await db_1.default.query(`SELECT id, student_id, student_name, lrn, grade, section,
                status, session, scan_method, date, time_in, time_out,
                timestamp, photo_path, is_overridden, notes
         FROM attendance
         WHERE student_id IN (?) AND DATE(CONVERT_TZ(date, '+00:00', '+08:00')) = ?
         ORDER BY timestamp DESC`, [studentIds.length > 0 ? studentIds : [0], date]);
            attendance = attendanceRows;
            const [studentRows] = await db_1.default.query(`SELECT id, lrn, name, grade, section, preferred_method
         FROM students WHERE id IN (?) ORDER BY name`, [studentIds.length > 0 ? studentIds : [0]]);
            allStudents = studentRows;
        }
        else {
            const [attendanceRows] = await db_1.default.query(`SELECT id, student_id, student_name, lrn, grade, section,
                status, session, scan_method, date, time_in, time_out,
                timestamp, photo_path, is_overridden, notes
         FROM attendance
         WHERE LOWER(section) = LOWER(?) AND DATE(CONVERT_TZ(date, '+00:00', '+08:00')) = ?
         ORDER BY timestamp DESC`, [section, date]);
            attendance = attendanceRows;
            const [studentRows] = await db_1.default.query(`SELECT id, lrn, name, grade, section, preferred_method
         FROM students WHERE LOWER(section) = LOWER(?) ORDER BY name`, [section]);
            allStudents = studentRows;
        }
        // Stats
        const presentSet = new Set();
        const lateSet = new Set();
        const absentSet = new Set(allStudents.map((s) => s.id));
        for (const r of attendance) {
            if (r.status === 'Time-In') {
                presentSet.add(r.student_id);
                absentSet.delete(r.student_id);
            }
            else if (r.status === 'Late') {
                lateSet.add(r.student_id);
                absentSet.delete(r.student_id);
            }
        }
        const stats = {
            present: presentSet.size,
            late: lateSet.size,
            absent: absentSet.size,
            total: allStudents.length,
            attendanceRate: allStudents.length > 0
                ? Math.round(((presentSet.size + lateSet.size) / allStudents.length) * 100)
                : 0,
        };
        res.json({ date, section: section, stats, attendance, allStudents });
    }
    catch (error) {
        console.error('Error getting attendance summary:', error);
        res.status(500).json({ error: 'Failed to load attendance summary' });
    }
}
// ─── POST /teacher/attendance/manual ─────────────────────────────────
async function markManualAttendance(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { student_id, status, session, reason } = req.body;
        const teacher = await getTeacherRow(userId);
        if (!teacher)
            return res.status(404).json({ error: 'Teacher profile not found' });
        const [studentRows] = await db_1.default.query(`SELECT id, name, lrn, grade, section FROM students WHERE id = ?`, [student_id]);
        if (!studentRows.length)
            return res.status(404).json({ error: 'Student not found' });
        const student = studentRows[0];
        if (teacher.section.toLowerCase() !== student.section.toLowerCase())
            return res.status(403).json({ error: 'Cannot mark attendance for students outside your class' });
        const dateStr = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
        const timeStr = (0, date_fns_1.format)(new Date(), 'HH:mm:ss');
        const [result] = await db_1.default.query(`INSERT INTO attendance
         (student_id, student_name, lrn, grade, section,
          teacher_id, teacher_name, scan_method, status, session,
          date, time_in, timestamp, is_overridden, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Manual', ?, ?, ?, ?, NOW(), 1, ?, NOW())`, [
            student.id, student.name, student.lrn, student.grade, student.section,
            teacher.id, teacher.name,
            status, session || 'AM',
            dateStr, timeStr,
            reason || 'Manually marked by teacher',
        ]);
        res.json({
            success: true,
            message: `Attendance marked for ${student.name}`,
            attendanceId: result.insertId,
        });
    }
    catch (error) {
        console.error('Error marking manual attendance:', error);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
}
// ─── POST /teacher/attendance/note ───────────────────────────────────
async function addAttendanceNote(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { attendance_id, student_id, note, excuse_type } = req.body;
        const teacher = await getTeacherRow(userId);
        if (!teacher)
            return res.status(404).json({ error: 'Teacher profile not found' });
        const [studentRows] = await db_1.default.query(`SELECT section FROM students WHERE id = ?`, [student_id]);
        if (!studentRows.length)
            return res.status(404).json({ error: 'Student not found' });
        if (teacher.section.toLowerCase() !== studentRows[0].section.toLowerCase())
            return res.status(403).json({ error: 'Cannot add notes for students outside your class' });
        if (attendance_id) {
            await db_1.default.query(`UPDATE attendance SET notes = CONCAT(IFNULL(notes, ''), ' | ', ?) WHERE id = ?`, [note, attendance_id]);
        }
        // Try inserting into teacher_notes (silently skip if table missing)
        try {
            await db_1.default.query(`INSERT INTO teacher_notes (teacher_id, student_id, attendance_id, note, excuse_type, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`, [teacher.id, student_id, attendance_id, note, excuse_type || 'general']);
        }
        catch (_) { /* table may not exist */ }
        res.json({ success: true, message: 'Note added successfully' });
    }
    catch (error) {
        console.error('Error adding attendance note:', error);
        res.status(500).json({ error: 'Failed to add note' });
    }
}
// ─── POST /teacher/attendance/excuse ─────────────────────────────────
async function excuseAbsence(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { student_id, date, reason } = req.body;
        const teacher = await getTeacherRow(userId);
        if (!teacher)
            return res.status(404).json({ error: 'Teacher profile not found' });
        const [studentRows] = await db_1.default.query(`SELECT id, name, lrn, grade, section FROM students WHERE id = ?`, [student_id]);
        if (!studentRows.length)
            return res.status(404).json({ error: 'Student not found' });
        const student = studentRows[0];
        if (teacher.section.toLowerCase() !== student.section.toLowerCase())
            return res.status(403).json({ error: 'Cannot excuse students outside your class' });
        const excuseNote = reason || `Excused by ${teacher.name}`;
        const [existing] = await db_1.default.query(`SELECT id FROM attendance WHERE student_id = ? AND DATE(CONVERT_TZ(date, '+00:00', '+08:00')) = ? LIMIT 1`, [student_id, date]);
        if (existing.length > 0) {
            await db_1.default.query(`UPDATE attendance SET status = 'Absent', is_overridden = 1, notes = ? WHERE id = ?`, [excuseNote, existing[0].id]);
        }
        else {
            await db_1.default.query(`INSERT INTO attendance
           (student_id, student_name, lrn, grade, section,
            teacher_id, teacher_name, scan_method, status, session,
            date, timestamp, is_overridden, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Manual', 'Absent', 'AM', ?, NOW(), 1, ?, NOW())`, [
                student.id, student.name, student.lrn, student.grade, student.section,
                teacher.id, teacher.name,
                date, excuseNote,
            ]);
        }
        res.json({ success: true, message: `Absence excused for ${student.name}` });
    }
    catch (error) {
        console.error('Error excusing absence:', error);
        res.status(500).json({ error: 'Failed to excuse absence' });
    }
}
exports.default = {
    getTeacherClasses,
    getTodayAttendanceSummary,
    markManualAttendance,
    addAttendanceNote,
    excuseAbsence,
};
