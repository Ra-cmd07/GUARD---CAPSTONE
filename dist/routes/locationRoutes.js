"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const locationController_1 = require("../controllers/locationController");
const router = (0, express_1.Router)();
// BLE location update (from student device or BLE gateway)
router.post('/ble-update', locationController_1.updateBleLocation);
// Get student location (parents/teachers/admin)
router.get('/student/:studentId', authMiddleware_1.protect, locationController_1.getStudentLocation);
// Get all beacons (for map display)
router.get('/beacons', authMiddleware_1.protect, locationController_1.getBeacons);
// Get campus-wide location map (admin/teacher only)
router.get('/campus-map', authMiddleware_1.protect, (0, authMiddleware_1.requireRole)('admin', 'teacher'), locationController_1.getCampusMap);
exports.default = router;
