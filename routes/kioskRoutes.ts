import { Router } from 'express';
import { kioskScan, kioskPing, getKioskList, getRecentScans } from '../controllers/kioskController';

const router = Router();

// Kiosk routes are intentionally unauthenticated — the kiosk is a trusted device
router.post('/scan',         kioskScan);
router.get('/ping/:kioskId', kioskPing);
router.get('/list',          getKioskList);
router.get('/recent-scans',  getRecentScans);

export default router;
