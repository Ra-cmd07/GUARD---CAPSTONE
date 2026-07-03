import { Router } from 'express';
import {
  updateBleLocation,
  updateBleLocationBatch,
  getLiveStudentLocations,
  getStudentLocation,
  getBeacons,
  deactivateStudentLocation,
} from '../controllers/locationController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Real-time BLE location updates
router.post('/ble-update', updateBleLocation);
router.post('/ble-batch', updateBleLocationBatch);

// Get live student positions
router.get('/students-live', protect, getLiveStudentLocations);

// Get specific student location (for parent dashboard)
router.get('/student/:id', getStudentLocation);

// Get all beacons
router.get('/beacons', getBeacons);

// Deactivate student location
router.post('/deactivate/:studentId', protect, deactivateStudentLocation);

export default router;
