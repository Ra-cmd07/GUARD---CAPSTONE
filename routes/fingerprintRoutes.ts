import { Router } from 'express';
import { protect, requireRole } from '../middleware/authMiddleware';
import {
  getLocations,
  createLocation,
  captureFingerprint,
  deleteLocation,
  getLocationSamples,
  predictLocation,
} from '../controllers/fingerprintController';

const router = Router();

// ── Public (authenticated) ─────────────────────────────────────────────
router.get('/locations',             protect, getLocations);
router.get('/locations/:id/samples', protect, getLocationSamples);
router.get('/predict',               protect, predictLocation);

// ── Admin only ─────────────────────────────────────────────────────────
router.post('/locations',            protect, requireRole('admin'), createLocation);
router.post('/capture',              protect, requireRole('admin'), captureFingerprint);
router.delete('/locations/:id',      protect, requireRole('admin'), deleteLocation);

export default router;
