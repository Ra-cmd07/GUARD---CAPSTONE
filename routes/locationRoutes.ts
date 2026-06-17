import { Router } from 'express';
import { protect, requireRole } from '../middleware/authMiddleware';
import {
  updateBleLocation,
  getStudentLocation,
  getBeacons,
  getCampusMap,
} from '../controllers/locationController';

const router = Router();

// BLE location update (from student device or BLE gateway)
router.post('/ble-update', updateBleLocation);

// Get student location (parents/teachers/admin)
router.get('/student/:studentId', protect, getStudentLocation);

// Get all beacons (for map display)
router.get('/beacons', protect, getBeacons);

// Get campus-wide location map (admin/teacher only)
router.get('/campus-map', protect, requireRole('admin', 'teacher'), getCampusMap);

export default router;
