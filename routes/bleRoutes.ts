import { Router } from 'express';
import { getBleDashboard, getBleDevices, uploadBleData } from '../controllers/bleController';

const router = Router();

router.post('/upload', uploadBleData);
router.get('/devices', getBleDevices);
router.get('/dashboard', getBleDashboard);
router.get('/logs', getBleDashboard);

export default router;
