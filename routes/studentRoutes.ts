import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { getStudents, createStudent, getStudentById } from '../controllers/studentController';

const router = Router();

router.get('/',    protect, getStudents);
router.post('/',   protect, createStudent);
router.get('/:id', protect, getStudentById);

export default router;