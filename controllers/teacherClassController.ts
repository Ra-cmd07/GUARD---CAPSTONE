import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import pool from '../lib/db';
import { format, parse } from 'date-fns';

/**
 * GET /api/teacher/classes
 * Get all classes for the current teacher with student count and section info
 */
export async function getTeacherClasses(req: AuthRequest, res: Response) {
  try {
    const teacherId = req.user?.id;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get teacher's ID from teachers table using user_id
    const [teacher]: any = await pool.query(
      `SELECT id FROM teachers WHERE user_id = ?`,
      [teacherId]
    );

    if (!teacher || teacher.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const dbTeacherId = teacher[0].id;

    // Get all classes for this teacher with section details and student count
    const [classes]: any = await pool.query(
      `SELECT 
        tc.id,
        tc.teacher_id,
        tc.section_id,
        tc.subject,
        tc.time_start,
        tc.time_end,
        tc.day_of_week,
        tc.room_number,
        tc.capacity,
        tc.is_active,
        tc.created_at,
        s.name as section_name,
        s.grade,
        s.section_code,
        COUNT(st.id) as enrolled_students
      FROM teacher_classes tc
      LEFT JOIN sections s ON tc.section_id = s.id
      LEFT JOIN students st ON st.section_id = tc.section_id
      WHERE tc.teacher_id = ?
      GROUP BY tc.id
      ORDER BY 
        FIELD(tc.day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'),
        tc.time_start`,
      [dbTeacherId]
    );

    res.json({
      success: true,
      classes: classes,
      total: classes.length,
    });
  } catch (error) {
    console.error('❌ Error getting teacher classes:', error);
    res.status(500).json({ error: 'Failed to load classes' });
  }
}

/**
 * GET /api/teacher/classes/today
 * Get today's classes for the teacher with current class indicator
 */
export async function getTodayClasses(req: AuthRequest, res: Response) {
  try {
    const teacherId = req.user?.id;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get teacher's ID from teachers table
    const [teacher]: any = await pool.query(
      `SELECT id FROM teachers WHERE user_id = ?`,
      [teacherId]
    );

    if (!teacher || teacher.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const dbTeacherId = teacher[0].id;

    // Get today's day of week
    const dayOfWeek = format(new Date(), 'EEEE'); // e.g., "Monday"
    const currentTime = format(new Date(), 'HH:mm:ss');

    // Get all classes for today
    const [todayClasses]: any = await pool.query(
      `SELECT 
        tc.id,
        tc.teacher_id,
        tc.section_id,
        tc.subject,
        tc.time_start,
        tc.time_end,
        tc.day_of_week,
        tc.room_number,
        tc.capacity,
        tc.is_active,
        s.name as section_name,
        s.grade,
        s.section_code,
        COUNT(DISTINCT st.id) as enrolled_students,
        CASE
          WHEN TIME(?) >= tc.time_start AND TIME(?) <= tc.time_end THEN 'current'
          WHEN TIME(?) < tc.time_start THEN 'upcoming'
          ELSE 'completed'
        END as class_status
      FROM teacher_classes tc
      LEFT JOIN sections s ON tc.section_id = s.id
      LEFT JOIN students st ON st.section_id = tc.section_id
      WHERE tc.teacher_id = ? 
        AND tc.day_of_week = ?
        AND tc.is_active = 1
      GROUP BY tc.id
      ORDER BY tc.time_start`,
      [currentTime, currentTime, currentTime, dbTeacherId, dayOfWeek]
    );

    // Separate into current, upcoming, and completed
    const current = todayClasses.filter((c: any) => c.class_status === 'current');
    const upcoming = todayClasses.filter((c: any) => c.class_status === 'upcoming');
    const completed = todayClasses.filter((c: any) => c.class_status === 'completed');

    res.json({
      success: true,
      date: format(new Date(), 'yyyy-MM-dd'),
      dayOfWeek: dayOfWeek,
      currentTime: currentTime,
      classes: {
        current: current,
        upcoming: upcoming,
        completed: completed,
      },
      allClasses: todayClasses,
      summary: {
        totalToday: todayClasses.length,
        currentClass: current.length > 0 ? current[0] : null,
      },
    });
  } catch (error) {
    console.error('❌ Error getting today classes:', error);
    res.status(500).json({ error: 'Failed to load today classes' });
  }
}

/**
 * POST /api/teacher/classes
 * Create a new class schedule for the teacher
 */
export async function createTeacherClass(req: AuthRequest, res: Response) {
  try {
    const adminUserId = req.user?.id;
    const { teacher_id, section_id, subject, time_start, time_end, day_of_week, room_number, capacity } = req.body;

    if (!adminUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate required fields
    if (!teacher_id || !section_id || !subject || !time_start || !time_end || !day_of_week) {
      return res.status(400).json({ 
        error: 'Missing required fields: teacher_id, section_id, subject, time_start, time_end, day_of_week' 
      });
    }

    // Verify teacher exists
    const [teacher]: any = await pool.query(
      `SELECT id FROM teachers WHERE id = ?`,
      [teacher_id]
    );

    if (!teacher || teacher.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const dbTeacherId = teacher[0].id;

    // Verify section exists
    const [section]: any = await pool.query(
      `SELECT id, name FROM sections WHERE id = ?`,
      [section_id]
    );

    if (!section || section.length === 0) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Check for duplicate schedule (same teacher, section, time, day)
    const [duplicate]: any = await pool.query(
      `SELECT id FROM teacher_classes 
       WHERE teacher_id = ? 
         AND section_id = ? 
         AND time_start = ? 
         AND day_of_week = ?
         AND is_active = 1`,
      [dbTeacherId, section_id, time_start, day_of_week]
    );

    if (duplicate && duplicate.length > 0) {
      return res.status(409).json({ 
        error: 'A class already exists for this teacher at this time on this day' 
      });
    }

    // Insert new class
    const [result]: any = await pool.query(
      `INSERT INTO teacher_classes 
       (teacher_id, section_id, subject, time_start, time_end, day_of_week, room_number, capacity, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [dbTeacherId, section_id, subject, time_start, time_end, day_of_week, room_number, capacity, adminUserId]
    );

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      classId: result.insertId,
      class: {
        id: result.insertId,
        teacher_id: dbTeacherId,
        section_id: section_id,
        section_name: section[0].name,
        subject: subject,
        time_start: time_start,
        time_end: time_end,
        day_of_week: day_of_week,
        room_number: room_number,
        capacity: capacity,
        is_active: true,
      },
    });
  } catch (error: any) {
    console.error('❌ Error creating teacher class:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        error: 'Duplicate class schedule' 
      });
    }
    
    res.status(500).json({ error: 'Failed to create class' });
  }
}

/**
 * GET /api/teacher/classes/:classId/attendance
 * Get attendance records for a specific class on a specific date
 */
export async function getClassAttendance(req: AuthRequest, res: Response) {
  try {
    const teacherId = req.user?.id;
    const { classId } = req.params;
    const date = (req.query.date as string) || format(new Date(), 'yyyy-MM-dd');

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get teacher's ID from teachers table
    const [teacher]: any = await pool.query(
      `SELECT id FROM teachers WHERE user_id = ?`,
      [teacherId]
    );

    if (!teacher || teacher.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const dbTeacherId = teacher[0].id;

    // Verify the class belongs to this teacher
    const [classRecord]: any = await pool.query(
      `SELECT tc.*, s.name as section_name 
       FROM teacher_classes tc
       LEFT JOIN sections s ON tc.section_id = s.id
       WHERE tc.id = ? AND tc.teacher_id = ?`,
      [classId, dbTeacherId]
    );

    if (!classRecord || classRecord.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const cls = classRecord[0];

    // Get all students in this section
    const [allStudents]: any = await pool.query(
      `SELECT id, lrn, name, grade
       FROM students
       WHERE section_id = ?
       ORDER BY name`,
      [cls.section_id]
    );

    // Get attendance records for this class on this date
    const [attendance]: any = await pool.query(
      `SELECT 
        a.id,
        a.student_id,
        a.teacher_class_id,
        a.section_id,
        a.timestamp,
        a.scan_method,
        a.status,
        a.photo_path,
        a.student_name,
        a.grade
       FROM attendance a
       WHERE a.teacher_class_id = ? AND DATE(a.timestamp) = ?
       ORDER BY a.timestamp DESC`,
      [classId, date]
    );

    // Create attendance map for quick lookup
    const attendanceMap = new Map();
    attendance.forEach((record: any) => {
      attendanceMap.set(record.student_id, record);
    });

    // Build attendance summary
    const presentStudents: any[] = [];
    const lateStudents: any[] = [];
    const absentStudents: any[] = [];

    allStudents.forEach((student: any) => {
      const record = attendanceMap.get(student.id);
      
      if (!record) {
        absentStudents.push({
          ...student,
          status: 'Absent',
          timestamp: null,
        });
      } else if (record.status === 'Time-In') {
        presentStudents.push(record);
      } else if (record.status === 'Late') {
        lateStudents.push(record);
      }
    });

    const stats = {
      total: allStudents.length,
      present: presentStudents.length,
      late: lateStudents.length,
      absent: absentStudents.length,
      attendanceRate: allStudents.length > 0 
        ? Math.round(((presentStudents.length + lateStudents.length) / allStudents.length) * 100)
        : 0,
    };

    res.json({
      success: true,
      class: {
        id: cls.id,
        subject: cls.subject,
        section_name: cls.section_name,
        day_of_week: cls.day_of_week,
        time_start: cls.time_start,
        time_end: cls.time_end,
        room_number: cls.room_number,
      },
      date: date,
      stats: stats,
      attendance: {
        present: presentStudents,
        late: lateStudents,
        absent: absentStudents,
      },
      allStudents: allStudents,
    });
  } catch (error) {
    console.error('❌ Error getting class attendance:', error);
    res.status(500).json({ error: 'Failed to load attendance' });
  }
}

/**
 * GET /api/teacher/classes/:classId
 * Get details of a specific class
 */
export async function getTeacherClassDetail(req: AuthRequest, res: Response) {
  try {
    const teacherId = req.user?.id;
    const { classId } = req.params;

    if (!teacherId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get teacher's ID from teachers table
    const [teacher]: any = await pool.query(
      `SELECT id FROM teachers WHERE user_id = ?`,
      [teacherId]
    );

    if (!teacher || teacher.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const dbTeacherId = teacher[0].id;

    // Get class details
    const [classRecord]: any = await pool.query(
      `SELECT 
        tc.*,
        s.name as section_name,
        s.grade,
        s.section_code,
        COUNT(DISTINCT st.id) as enrolled_students
       FROM teacher_classes tc
       LEFT JOIN sections s ON tc.section_id = s.id
       LEFT JOIN students st ON st.section_id = tc.section_id
       WHERE tc.id = ? AND tc.teacher_id = ?
       GROUP BY tc.id`,
      [classId, dbTeacherId]
    );

    if (!classRecord || classRecord.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({
      success: true,
      class: classRecord[0],
    });
  } catch (error) {
    console.error('❌ Error getting class detail:', error);
    res.status(500).json({ error: 'Failed to load class detail' });
  }
}

/**
 * PUT /api/teacher/classes/:classId
 * Update a class schedule
 */
export async function updateTeacherClass(req: AuthRequest, res: Response) {
  try {
    const adminUserId = req.user?.id;
    const { classId } = req.params;
    const { subject, time_start, time_end, room_number, capacity, is_active } = req.body;

    if (!adminUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify the class exists
    const [classRecord]: any = await pool.query(
      `SELECT id, teacher_id FROM teacher_classes WHERE id = ?`,
      [classId]
    );

    if (!classRecord || classRecord.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Update class
    const updateFields = [];
    const updateValues = [];

    if (subject !== undefined) {
      updateFields.push('subject = ?');
      updateValues.push(subject);
    }
    if (time_start !== undefined) {
      updateFields.push('time_start = ?');
      updateValues.push(time_start);
    }
    if (time_end !== undefined) {
      updateFields.push('time_end = ?');
      updateValues.push(time_end);
    }
    if (room_number !== undefined) {
      updateFields.push('room_number = ?');
      updateValues.push(room_number);
    }
    if (capacity !== undefined) {
      updateFields.push('capacity = ?');
      updateValues.push(capacity);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }

    updateFields.push('updated_by = ?');
    updateValues.push(adminUserId);

    if (updateFields.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(classId);

    await pool.query(
      `UPDATE teacher_classes SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Class updated successfully',
      classId: classId,
    });
  } catch (error) {
    console.error('❌ Error updating teacher class:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
}

/**
 * DELETE /api/teacher/classes/:classId
 * Delete a class schedule (soft delete via is_active)
 */
export async function deleteTeacherClass(req: AuthRequest, res: Response) {
  try {
    const adminUserId = req.user?.id;
    const { classId } = req.params;

    if (!adminUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify the class exists
    const [classRecord]: any = await pool.query(
      `SELECT id FROM teacher_classes WHERE id = ?`,
      [classId]
    );

    if (!classRecord || classRecord.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Soft delete (mark as inactive)
    await pool.query(
      `UPDATE teacher_classes SET is_active = 0, updated_by = ? WHERE id = ?`,
      [adminUserId, classId]
    );

    res.json({
      success: true,
      message: 'Class deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting teacher class:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
}

export default {
  getTeacherClasses,
  getTodayClasses,
  createTeacherClass,
  getClassAttendance,
  getTeacherClassDetail,
  updateTeacherClass,
  deleteTeacherClass,
};
