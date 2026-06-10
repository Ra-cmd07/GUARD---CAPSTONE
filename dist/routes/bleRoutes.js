import { Router } from 'express';
import { uploadBleData, getBleDevices, getBleDashboard } from '../controllers/bleController';
import { apiKeyAuth } from '../middleware/apiKeyAuth';

const router = Router();

// POST /api/ble/upload — ESP32 upload, requires API key
router.post('/upload', apiKeyAuth, uploadBleData);

// GET /api/ble/devices — list devices
router.get('/devices', getBleDevices);

// GET /api/ble/dashboard — HTML dashboard
router.get('/dashboard', getBleDashboard);

// GET /api/ble/logs — alias for dashboard
router.get('/logs', getBleDashboard);

export default router;