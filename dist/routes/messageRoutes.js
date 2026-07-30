"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const messageController_1 = require("../controllers/messageController");
const router = express_1.default.Router();
router.use(authMiddleware_1.protect);
// ─── Teacher routes ───────────────────────────────────────────────────
// POST /api/messages/teacher          — send message to parent
router.post('/teacher', messageController_1.sendMessage);
// GET  /api/messages/teacher          — view sent messages
router.get('/teacher', messageController_1.getTeacherMessages);
// ─── Parent routes ────────────────────────────────────────────────────
// GET  /api/messages/parent           — view received messages
router.get('/parent', messageController_1.getParentMessages);
// PATCH /api/messages/parent/:id/read — mark one message as read
router.patch('/parent/:id/read', messageController_1.markMessageRead);
exports.default = router;
