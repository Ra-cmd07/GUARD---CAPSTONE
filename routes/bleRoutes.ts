import { Router } from 'express';
import { 
  getBleDashboard, 
  getBleDevices, 
  uploadBleData, 
  detectBleToken,
  getScanStatus,
  setScanStatus
} from '../controllers/bleController';

const router = Router();

router.post('/upload', uploadBleData);
router.post('/detect', detectBleToken);  // ESP32 BLE token detection
router.get('/scan-status', getScanStatus);  // ESP32 checks if should scan
router.post('/scan-status', setScanStatus);  // Kiosk starts/stops scanning
router.get('/devices', getBleDevices);
router.get('/dashboard', getBleDashboard);
router.get('/logs', getBleDashboard);

export default router;
