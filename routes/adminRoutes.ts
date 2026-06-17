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

router.get('/kiosks',              ...admin, getKiosks);
router.post('/kiosks',             ...admin, createKiosk);
router.put('/kiosks/:id',          ...admin, updateKiosk);

router.get('/sms-logs',            ...admin, getSmsLogs);
router.get('/login-logs',          ...admin, getLoginLogs);

export default router;
