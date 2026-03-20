import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import {
  getAttendance,
  createAttendance,
  updateAttendance,
  deleteAttendance,
} from '../controllers/attendanceController';

const router = Router();

router.get('/',    protect, getAttendance);
router.post('/',   protect, createAttendance);
router.patch('/:id', protect, updateAttendance);
router.delete('/:id', protect, deleteAttendance);

export default router;