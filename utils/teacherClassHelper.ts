import pool from '../lib/db';

/**
 * Get the active class for a section at a given time
 * Returns the teacher_class_id if a class is currently active, or null if none
 * 
 * @param section_id - The section ID
 * @param current_time - Current time in HH:mm:ss format (e.g., "08:30:00")
 * @param day_of_week - Day of week (e.g., "Monday", "Tuesday", etc.)
 * @returns Promise<number | null> - teacher_class_id or null if no active class
 * 
 * @example
 * const classId = await getActiveClassForSection(2, "08:30:00", "Monday");
 * // Returns the teacher_class_id if a class in section 2 is active at 08:30 on Monday
 */
export async function getActiveClassForSection(
  section_id: number,
  current_time: string,
  day_of_week: string
): Promise<number | null> {
  try {
    const [results]: any = await pool.execute(
      `SELECT tc.id
       FROM teacher_classes tc
       WHERE tc.section_id = ?
         AND tc.day_of_week = ?
         AND tc.time_start <= ?
         AND tc.time_end >= ?
         AND tc.is_active = 1
       LIMIT 1`,
      [section_id, day_of_week, current_time, current_time]
    );

    if (results && results.length > 0) {
      return results[0].id;
    }

    return null;
  } catch (error) {
    console.error('❌ Error in getActiveClassForSection:', error);
    return null;
  }
}

/**
 * Get active classes for a teacher at a given time
 * Returns all active classes for the teacher at the specified time
 * 
 * @param teacher_id - The teacher ID (from teachers table)
 * @param current_time - Current time in HH:mm:ss format
 * @param day_of_week - Day of week
 * @returns Promise<number[]> - Array of teacher_class_ids
 */
export async function getActiveClassesForTeacher(
  teacher_id: number,
  current_time: string,
  day_of_week: string
): Promise<number[]> {
  try {
    const [results]: any = await pool.execute(
      `SELECT tc.id
       FROM teacher_classes tc
       WHERE tc.teacher_id = ?
         AND tc.day_of_week = ?
         AND tc.time_start <= ?
         AND tc.time_end >= ?
         AND tc.is_active = 1`,
      [teacher_id, day_of_week, current_time, current_time]
    );

    if (results && results.length > 0) {
      return results.map((r: any) => r.id);
    }

    return [];
  } catch (error) {
    console.error('❌ Error in getActiveClassesForTeacher:', error);
    return [];
  }
}

/**
 * Get the next upcoming class for a section
 * Useful for pre-planning or getting class info before a class starts
 * 
 * @param section_id - The section ID
 * @param current_time - Current time in HH:mm:ss format
 * @param day_of_week - Day of week
 * @returns Promise<any | null> - Class details or null if no upcoming class
 */
export async function getNextClassForSection(
  section_id: number,
  current_time: string,
  day_of_week: string
): Promise<any | null> {
  try {
    const [results]: any = await pool.execute(
      `SELECT tc.id, tc.subject, tc.teacher_id, tc.time_start, tc.time_end
       FROM teacher_classes tc
       WHERE tc.section_id = ?
         AND tc.day_of_week = ?
         AND tc.time_start > ?
         AND tc.is_active = 1
       ORDER BY tc.time_start ASC
       LIMIT 1`,
      [section_id, day_of_week, current_time]
    );

    if (results && results.length > 0) {
      return results[0];
    }

    return null;
  } catch (error) {
    console.error('❌ Error in getNextClassForSection:', error);
    return null;
  }
}

export default {
  getActiveClassForSection,
  getActiveClassesForTeacher,
  getNextClassForSection,
};
