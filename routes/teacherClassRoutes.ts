import express from 'express';
import { protect, requireRole } from '../middleware/authMiddleware';
import {
  getTeacherClasses,
  getTodayClasses,
  createTeacherClass,
  getClassAttendance,
  getTeacherClassDetail,
  updateTeacherClass,
  deleteTeacherClass,
} from '../controllers/teacherClassController';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * GET /api/teacher/classes
 * Get all classes for the current teacher (accessible to teachers and admins)
 */
router.get('/', getTeacherClasses);

/**
 * GET /api/teacher/classes/today
 * Get today's classes with current class indicator (accessible to teachers and admins)
 */
router.get('/today', getTodayClasses);

/**
 * POST /api/teacher/classes
 * Create a new class schedule (admin only)
 */
router.post('/', requireRole('admin'), createTeacherClass);

/**
 * GET /api/teacher/classes/:classId
 * Get details of a specific class (accessible to teachers and admins)
 */
router.get('/:classId', getTeacherClassDetail);

/**
 * PUT /api/teacher/classes/:classId
 * Update a class schedule (admin only)
 */
router.put('/:classId', requireRole('admin'), updateTeacherClass);

/**
 * DELETE /api/teacher/classes/:classId
 * Delete (deactivate) a class schedule (admin only)
 */
router.delete('/:classId', requireRole('admin'), deleteTeacherClass);

/**
 * GET /api/teacher/classes/:classId/attendance
 * Get attendance records for a specific class on a specific date (accessible to teachers and admins)
 */
router.get('/:classId/attendance', getClassAttendance);

export default router;
