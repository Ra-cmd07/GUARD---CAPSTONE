"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const teacherController_1 = require("../controllers/teacherController");
const router = express_1.default.Router();
// All teacher routes require authentication
router.use(authMiddleware_1.protect);
// Get teacher's assigned sections
router.get('/sections', teacherController_1.getTeacherSections);
// Get teacher's assigned classes and students
router.get('/classes', teacherController_1.getTeacherClasses);
// Get today's attendance summary for teacher's class
router.get('/attendance/today', teacherController_1.getTodayAttendanceSummary);
// Mark manual attendance
router.post('/attendance/manual', teacherController_1.markManualAttendance);
// Add note to attendance record
router.post('/attendance/note', teacherController_1.addAttendanceNote);
// Excuse absence
router.post('/attendance/excuse', teacherController_1.excuseAbsence);
exports.default = router;
