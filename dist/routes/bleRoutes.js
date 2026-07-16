"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bleController_1 = require("../controllers/bleController");
const router = (0, express_1.Router)();
router.post('/upload', bleController_1.uploadBleData);
router.post('/detect', bleController_1.detectBleToken); // ESP32 BLE token detection
router.get('/scan-status', bleController_1.getScanStatus); // ESP32 checks if should scan
router.post('/scan-status', bleController_1.setScanStatus); // Kiosk starts/stops scanning
router.get('/devices', bleController_1.getBleDevices);
router.get('/dashboard', bleController_1.getBleDashboard);
router.get('/logs', bleController_1.getBleDashboard);
exports.default = router;
