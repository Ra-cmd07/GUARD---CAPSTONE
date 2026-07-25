"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeacherSections = getTeacherSections;
exports.getTeacherClasses = getTeacherClasses;
exports.getTodayAttendanceSummary = getTodayAttendanceSummary;
exports.markManualAttendance = markManualAttendance;
exports.addAttendanceNote = addAttendanceNote;
exports.excuseAbsence = excuseAbsence;
const db_1 = __importDefault(require("../lib/db"));
const date_fns_1 = require("date-fns");
// Get teacher's assigned sections
async function getTeacherSections(req, res) {
    try {
        console.log('📚 getTeacherSections called for user:', req.user?.id);
        const teacherId = req.user?.id;
        if (!teacherId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get teacher's assigned sections
        const [sections] = await db_1.default.query(`SELECT s.id, s.name, s.grade, s.section_code, s.room_number, s.capacity,
              ts.is_primary,
              COUNT(st.id) as student_count
       FROM sections s
       JOIN teacher_sections ts ON s.id = ts.section_id
       JOIN teachers t ON ts.teacher_id = t.id
       LEFT JOIN students st ON st.section_id = s.id
       WHERE t.user_id = ?
       GROUP BY s.id
       ORDER BY ts.is_primary DESC, s.name`, [teacherId]);
        res.json({
            sections: sections,
            total: sections.length,
        });
    }
    catch (error) {
        console.error('Error getting teacher sections:', error);
        res.status(500).json({ error: 'Failed to load sections' });
    }
}
// Get teacher's assigned classes from all sections
async function getTeacherClasses(req, res) {
    try {
        console.log('🎓 getTeacherClasses called for user:', req.user?.id);
        const teacherId = req.user?.id;
        const selectedSectionId = req.query.section_id;
        if (!teacherId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get teacher's profile from teachers table
        const [teacher] = await db_1.default.query(`SELECT t.id
       FROM teachers t
       WHERE t.user_id = ?`, [teacherId]);
        if (!teacher || teacher.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        const dbTeacherId = teacher[0].id;
        // Get teacher's assigned sections
        const [sections] = await db_1.default.query(`SELECT s.id, s.name, s.grade, s.section_code
       FROM sections s
       JOIN teacher_sections ts ON s.id = ts.section_id
       WHERE ts.teacher_id = ?
       ORDER BY s.name`, [dbTeacherId]);
        // Determine which section to fetch students from
        let activeSectionId = selectedSectionId ? parseInt(selectedSectionId) : (sections.length > 0 ? sections[0].id : null);
        const activeSection = activeSectionId ? sections.find((s) => s.id === activeSectionId) : null;
        // Get students from the selected section (or all sections if none selected)
        let students = [];
        if (activeSectionId) {
            const [sectionStudents] = await db_1.default.query(`SELECT s.id, s.lrn, s.name, s.grade,
                COUNT(DISTINCT DATE(a.date)) as days_present,
                (SELECT COUNT(DISTINCT DATE(a2.date)) 
                 FROM attendance a2 
                 WHERE a2.student_id = s.id 
                 AND a2.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                 AND a2.status IN ('Time-In', 'Late')) as attendance_30d
         FROM students s
         LEFT JOIN attendance a ON a.student_id = s.id 
           AND a.status IN ('Time-In', 'Late')
           AND a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         WHERE s.section_id = ?
         GROUP BY s.id
         ORDER BY s.name`, [activeSectionId]);
            students = sectionStudents;
        }
        else {
            // Fallback to all students in sections assigned to this teacher
            const [allStudents] = await db_1.default.query(`SELECT s.id, s.lrn, s.name, s.grade,
                COUNT(DISTINCT DATE(a.date)) as days_present,
                (SELECT COUNT(DISTINCT DATE(a2.date)) 
                 FROM attendance a2 
                 WHERE a2.student_id = s.id 
                 AND a2.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                 AND a2.status IN ('Time-In', 'Late')) as attendance_30d
         FROM students s
         LEFT JOIN attendance a ON a.student_id = s.id 
           AND a.status IN ('Time-In', 'Late')
           AND a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         WHERE s.section_id IN (
           SELECT s2.id FROM sections s2
           JOIN teacher_sections ts ON s2.id = ts.section_id
           WHERE ts.teacher_id = ?
         )
         GROUP BY s.id
         ORDER BY s.name`, [dbTeacherId]);
            students = allStudents;
        }
        res.json({
            sections: sections,
            activeSection: activeSection,
            students: students,
            totalStudents: students.length,
        });
    }
    catch (error) {
        console.error('Error getting teacher classes:', error);
        res.status(500).json({ error: 'Failed to load classes' });
    }
}
// Get today's attendance summary for teacher's classes (with section filtering)
// Get today's attendance summary for teacher's classes (with section filtering)
async function getTodayAttendanceSummary(req, res) {
    try {
        console.log('📊 getTodayAttendanceSummary called for user:', req.user?.id);
        const teacherId = req.user?.id;
        const date = req.query.date || (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
        const selectedSectionId = req.query.section_id;
        if (!teacherId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get teacher's ID from teachers table
        const [teacher] = await db_1.default.query(`SELECT id FROM teachers WHERE user_id = ?`, [teacherId]);
        if (!teacher || teacher.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        const dbTeacherId = teacher[0].id;
        // Get teacher's assigned sections
        const [sections] = await db_1.default.query(`SELECT s.id, s.name, s.grade, s.section_code
       FROM sections s
       JOIN teacher_sections ts ON s.id = ts.section_id
       WHERE ts.teacher_id = ?
       ORDER BY s.name`, [dbTeacherId]);
        if (!sections || sections.length === 0) {
            return res.status(404).json({ error: 'No sections assigned to teacher' });
        }
        // Determine active section
        let activeSectionId = selectedSectionId ? parseInt(selectedSectionId) : sections[0].id;
        const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];
        console.log('📚 Active section:', activeSection.name);
        // Get attendance records for the selected section
        const [attendance] = await db_1.default.query(`SELECT a.*, s.name as student_name, s.lrn, s.grade
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE a.section_id = ? AND DATE(a.date) = ?
       ORDER BY a.timestamp DESC`, [activeSection.id, date]);
        console.log('📋 Attendance records found:', attendance.length);
        // Get all enrolled students in the selected section
        const [allStudents] = await db_1.default.query(`SELECT id, lrn, name, grade
       FROM students
       WHERE section_id = ?
       ORDER BY name`, [activeSection.id]);
        // Calculate stats
        const presentStudents = new Set();
        const lateStudents = new Set();
        const absentStudents = new Set(allStudents.map((s) => s.id));
        attendance.forEach((record) => {
            if (record.status === 'Time-In') {
                presentStudents.add(record.student_id);
                absentStudents.delete(record.student_id);
            }
            else if (record.status === 'Late') {
                lateStudents.add(record.student_id);
                absentStudents.delete(record.student_id);
            }
        });
        const stats = {
            present: presentStudents.size,
            late: lateStudents.size,
            absent: absentStudents.size,
            total: allStudents.length,
            attendanceRate: allStudents.length > 0
                ? Math.round(((presentStudents.size + lateStudents.size) / allStudents.length) * 100)
                : 0,
        };
        res.json({
            date,
            section: activeSection.name,
            sections: sections,
            stats,
            attendance,
            allStudents,
        });
    }
    catch (error) {
        console.error('❌ Error getting attendance summary:', error);
        res.status(500).json({ error: 'Failed to load attendance summary' });
    }
}
// Mark manual attendance
async function markManualAttendance(req, res) {
    try {
        const teacherId = req.user?.id;
        const { student_id, section_id, status, session, reason } = req.body;
        if (!teacherId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get teacher ID from teachers table
        const [teacher] = await db_1.default.query(`SELECT id FROM teachers WHERE user_id = ?`, [teacherId]);
        if (!teacher || teacher.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        const dbTeacherId = teacher[0].id;
        // Verify teacher has permission for this section
        const [permission] = await db_1.default.query(`SELECT ts.section_id FROM teacher_sections ts
       WHERE ts.teacher_id = ? AND ts.section_id = ?`, [dbTeacherId, section_id]);
        if (!permission || permission.length === 0) {
            return res.status(403).json({ error: 'Cannot mark attendance for students in sections you do not teach' });
        }
        const [student] = await db_1.default.query(`SELECT id, name FROM students WHERE id = ? AND section_id = ?`, [student_id, section_id]);
        if (!student || student.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        // Insert manual attendance record
        const [result] = await db_1.default.query(`INSERT INTO attendance 
       (student_id, section_id, date, status, scan_method, override_reason, override_by)
       VALUES (?, ?, CURDATE(), ?, 'Manual', ?, ?)`, [student_id, section_id, status, reason || 'Manually marked by teacher', dbTeacherId]);
        res.json({
            success: true,
            message: `Attendance marked for ${student[0].name}`,
            attendanceId: result.insertId,
        });
    }
    catch (error) {
        console.error('Error marking manual attendance:', error);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
}
// Add excuse/note to attendance
async function addAttendanceNote(req, res) {
    try {
        const teacherId = req.user?.id;
        const { attendance_id, student_id, section_id, note, excuse_type } = req.body;
        if (!teacherId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get teacher ID from teachers table
        const [teacher] = await db_1.default.query(`SELECT id FROM teachers WHERE user_id = ?`, [teacherId]);
        if (!teacher || teacher.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        const dbTeacherId = teacher[0].id;
        // Verify teacher has permission for this section
        const [permission] = await db_1.default.query(`SELECT ts.section_id FROM teacher_sections ts
       WHERE ts.teacher_id = ? AND ts.section_id = ?`, [dbTeacherId, section_id]);
        if (!permission || permission.length === 0) {
            return res.status(403).json({ error: 'Cannot add notes for students in sections you do not teach' });
        }
        const [student] = await db_1.default.query(`SELECT id FROM students WHERE id = ? AND section_id = ?`, [student_id, section_id]);
        if (!student || student.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        // Update attendance record with note
        if (attendance_id) {
            await db_1.default.query(`UPDATE attendance 
         SET override_reason = CONCAT(IFNULL(override_reason, ''), '\n', ?)
         WHERE id = ?`, [note, attendance_id]);
        }
        res.json({
            success: true,
            message: 'Note added successfully',
        });
    }
    catch (error) {
        console.error('Error adding attendance note:', error);
        res.status(500).json({ error: 'Failed to add note' });
    }
}
// Excuse absence (mark as excused)
async function excuseAbsence(req, res) {
    try {
        const teacherId = req.user?.id;
        const { student_id, section_id, date, reason } = req.body;
        if (!teacherId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get teacher ID from teachers table
        const [teacher] = await db_1.default.query(`SELECT id FROM teachers WHERE user_id = ?`, [teacherId]);
        if (!teacher || teacher.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        const dbTeacherId = teacher[0].id;
        // Verify teacher has permission for this section
        const [permission] = await db_1.default.query(`SELECT ts.section_id FROM teacher_sections ts
       WHERE ts.teacher_id = ? AND ts.section_id = ?`, [dbTeacherId, section_id]);
        if (!permission || permission.length === 0) {
            return res.status(403).json({ error: 'Cannot excuse students in sections you do not teach' });
        }
        const [student] = await db_1.default.query(`SELECT id, name FROM students WHERE id = ? AND section_id = ?`, [student_id, section_id]);
        if (!student || student.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        // Check if attendance record exists
        const [existing] = await db_1.default.query(`SELECT id FROM attendance 
       WHERE student_id = ? AND section_id = ? AND DATE(date) = ?`, [student_id, section_id, date]);
        if (existing.length > 0) {
            // Update existing record
            await db_1.default.query(`UPDATE attendance 
         SET status = 'Excused', 
             override_reason = ?, 
             override_by = ?
         WHERE id = ?`, [reason || 'Excused by teacher', dbTeacherId, existing[0].id]);
        }
        else {
            // Create new excused record
            await db_1.default.query(`INSERT INTO attendance 
         (student_id, section_id, date, status, scan_method, override_reason, override_by)
         VALUES (?, ?, ?, 'Excused', 'Manual', ?, ?)`, [student_id, section_id, date, reason || 'Excused by teacher', dbTeacherId]);
        }
        res.json({
            success: true,
            message: `Absence excused for ${student[0].name}`,
        });
    }
    catch (error) {
        console.error('Error excusing absence:', error);
        res.status(500).json({ error: 'Failed to excuse absence' });
    }
}
exports.default = {
    getTeacherSections,
    getTeacherClasses,
    getTodayAttendanceSummary,
    markManualAttendance,
    addAttendanceNote,
    excuseAbsence,
};
