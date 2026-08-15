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
  getSchoolSettings,
  updateSchoolSettings,
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

router.get('/kiosks',              ...admin, getKiosks);
router.post('/kiosks',             ...admin, createKiosk);
router.put('/kiosks/:id',          ...admin, updateKiosk);

router.get('/sms-logs',            ...admin, getSmsLogs);
router.delete('/sms-logs/clear',   ...admin, clearSmsLogs);
router.get('/login-logs',          ...admin, getLoginLogs);

// School settings
router.get('/school-settings',     ...admin, getSchoolSettings);
router.put('/school-settings',     ...admin, updateSchoolSettings);

export default router;
