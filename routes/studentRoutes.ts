import { Router } from 'express';
import { protect, requireRole } from '../middleware/authMiddleware';
import {
  getStudents,
  createStudent,
  getStudentById,
  updateStudent,
  getStudentAttendance,
} from '../controllers/studentController';

const router = Router();

router.get('/',                  protect, getStudents);
router.post('/',                 protect, requireRole('admin','teacher'), createStudent);
router.get('/:id',               protect, getStudentById);
router.put('/:id',               protect, requireRole('admin','teacher'), updateStudent);
router.get('/:id/attendance',    protect, getStudentAttendance);

export default router;
