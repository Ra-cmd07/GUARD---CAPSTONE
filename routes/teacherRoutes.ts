import express from 'express';
import { protect } from '../middleware/authMiddleware';
import {
  getTeacherClasses,
  getTodayAttendanceSummary,
  markManualAttendance,
  addAttendanceNote,
  excuseAbsence,
} from '../controllers/teacherController';

const router = express.Router();

// All teacher routes require authentication
router.use(protect);

// Get teacher's assigned classes and students
router.get('/classes', getTeacherClasses);

// Get today's attendance summary for teacher's class
router.get('/attendance/today', getTodayAttendanceSummary);

// Mark manual attendance
router.post('/attendance/manual', markManualAttendance);

// Add note to attendance record
router.post('/attendance/note', addAttendanceNote);

// Excuse absence
router.post('/attendance/excuse', excuseAbsence);

export default router;
