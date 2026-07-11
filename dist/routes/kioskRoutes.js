"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const kioskController_1 = require("../controllers/kioskController");
const router = (0, express_1.Router)();
// Kiosk routes are intentionally unauthenticated — the kiosk is a trusted device
router.post('/scan', kioskController_1.kioskScan);
router.get('/ping/:kioskId', kioskController_1.kioskPing);
router.get('/list', kioskController_1.getKioskList);
router.get('/recent-scans', kioskController_1.getRecentScans);
exports.default = router;
