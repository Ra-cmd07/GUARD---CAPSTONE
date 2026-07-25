import { Router } from 'express';
import { protect, requireRole } from '../middleware/authMiddleware';
import {
  getDashboardStats,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  resetPassword,
  toggleUserStatus,
  getKiosks,
  createKiosk,
  updateKiosk,
  getSmsLogs,
  getLoginLogs,
  clearSmsLogs,
  addParentToStudent,
  updateStudent,
  getSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
  getTeachers,
  assignTeachersToSection,
  getSectionTeachers,
  getClassSchedules,
} from '../controllers/adminController';

const router = Router();
const admin  = [protect, requireRole('admin')];

router.get('/dashboard',           ...admin, getDashboardStats);
router.get('/users',               ...admin, getUsers);
router.get('/users/:id',           ...admin, getUserById);
router.post('/users',              ...admin, createUser);
router.put('/users/:id',           ...admin, updateUser);
router.post('/users/:id/reset-password', ...admin, resetPassword);
router.patch('/users/:id/toggle-status', ...admin, toggleUserStatus);
router.post('/students/:id/add-parent', ...admin, addParentToStudent);
router.patch('/students/:id', ...admin, updateStudent);

router.get('/kiosks',              ...admin, getKiosks);
router.post('/kiosks',             ...admin, createKiosk);
router.put('/kiosks/:id',          ...admin, updateKiosk);

router.get('/sections',            ...admin, getSections);
router.get('/sections/:id',        ...admin, getSectionById);
router.get('/sections/:id/teachers', ...admin, getSectionTeachers);
router.post('/sections',           ...admin, createSection);
router.patch('/sections/:id',      ...admin, updateSection);
router.post('/sections/:id/assign-teachers', ...admin, assignTeachersToSection);
router.delete('/sections/:id',     ...admin, deleteSection);

router.get('/teachers',            ...admin, getTeachers);

router.get('/class-schedules',     ...admin, getClassSchedules);

router.get('/sms-logs',            ...admin, getSmsLogs);
router.delete('/sms-logs/clear',   ...admin, clearSmsLogs);
router.get('/login-logs',          ...admin, getLoginLogs);

export default router;
