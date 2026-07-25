"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const teacherClassController_1 = require("../controllers/teacherClassController");
const router = express_1.default.Router();
// All routes require authentication
router.use(authMiddleware_1.protect);
/**
 * GET /api/teacher/classes
 * Get all classes for the current teacher (accessible to teachers and admins)
 */
router.get('/', teacherClassController_1.getTeacherClasses);
/**
 * GET /api/teacher/classes/today
 * Get today's classes with current class indicator (accessible to teachers and admins)
 */
router.get('/today', teacherClassController_1.getTodayClasses);
/**
 * POST /api/teacher/classes
 * Create a new class schedule (admin only)
 */
router.post('/', (0, authMiddleware_1.requireRole)('admin'), teacherClassController_1.createTeacherClass);
/**
 * GET /api/teacher/classes/:classId
 * Get details of a specific class (accessible to teachers and admins)
 */
router.get('/:classId', teacherClassController_1.getTeacherClassDetail);
/**
 * PUT /api/teacher/classes/:classId
 * Update a class schedule (admin only)
 */
router.put('/:classId', (0, authMiddleware_1.requireRole)('admin'), teacherClassController_1.updateTeacherClass);
/**
 * DELETE /api/teacher/classes/:classId
 * Delete (deactivate) a class schedule (admin only)
 */
router.delete('/:classId', (0, authMiddleware_1.requireRole)('admin'), teacherClassController_1.deleteTeacherClass);
/**
 * GET /api/teacher/classes/:classId/attendance
 * Get attendance records for a specific class on a specific date (accessible to teachers and admins)
 */
router.get('/:classId/attendance', teacherClassController_1.getClassAttendance);
exports.default = router;
