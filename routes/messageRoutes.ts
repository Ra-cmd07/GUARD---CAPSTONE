import express from 'express';
import { protect } from '../middleware/authMiddleware';
import {
  sendMessage,
  getTeacherMessages,
  getParentMessages,
  markMessageRead,
} from '../controllers/messageController';

const router = express.Router();
router.use(protect);

// ─── Teacher routes ───────────────────────────────────────────────────
// POST /api/messages/teacher          — send message to parent
router.post('/teacher', sendMessage);
// GET  /api/messages/teacher          — view sent messages
router.get('/teacher', getTeacherMessages);

// ─── Parent routes ────────────────────────────────────────────────────
// GET  /api/messages/parent           — view received messages
router.get('/parent', getParentMessages);
// PATCH /api/messages/parent/:id/read — mark one message as read
router.patch('/parent/:id/read', markMessageRead);

export default router;
