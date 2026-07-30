import express from 'express';
import { protect, requireRole } from '../middleware/authMiddleware';
import {
  getAssignments,
  getAssignmentsGrouped,
  getAssignmentsMetadata,
  createAssignment,
  updateAssignment,
  updateSectionAdviser,
  deleteAssignment,
} from '../controllers/assignmentController';

const router = express.Router();
const admin = [protect, requireRole('admin')];

router.get('/',               ...admin, getAssignments);
router.get('/grouped',        ...admin, getAssignmentsGrouped);
router.get('/metadata',       ...admin, getAssignmentsMetadata);
router.post('/',              ...admin, createAssignment);
router.put('/:id',            ...admin, updateAssignment);
router.patch('/section-adviser', ...admin, updateSectionAdviser);
router.delete('/:id',         ...admin, deleteAssignment);

export default router;
