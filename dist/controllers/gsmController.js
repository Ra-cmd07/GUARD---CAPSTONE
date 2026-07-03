"use strict";
/**
 * GSM SMS Queue Controller
 * Manages SMS queue for ESP32 + SIM800L GSM module
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSMSQueueStatus = exports.markSMSFailed = exports.acknowledgeSMS = exports.getPendingSMS = exports.queueSMS = void 0;
const db_1 = __importDefault(require("../lib/db"));
/**
 * Add SMS to queue (called by kiosk when attendance recorded)
 */
const queueSMS = async (req, res) => {
    try {
        const { phone_number, message, student_id, attendance_id, priority = 'normal' } = req.body;
        if (!phone_number || !message) {
            return res.status(400).json({ error: 'Phone number and message required' });
        }
        // Insert into SMS queue
        const [result] = await db_1.default.query(`INSERT INTO sms_queue 
       (phone_number, message, student_id, attendance_id, priority, status, created_at) 
       VALUES (?, ?, ?, ?, ?, 'pending', NOW())`, [phone_number, message, student_id, attendance_id, priority]);
        console.log(`📩 SMS queued for ${phone_number}: ${message.substring(0, 50)}...`);
        res.json({
            success: true,
            sms_id: result.insertId,
            message: 'SMS queued for sending'
        });
    }
    catch (error) {
        console.error('❌ Error queueing SMS:', error);
        res.status(500).json({ error: 'Failed to queue SMS' });
    }
};
exports.queueSMS = queueSMS;
/**
 * Get pending SMS for ESP32 to send
 */
const getPendingSMS = async (req, res) => {
    try {
        const { kiosk_id } = req.query;
        const limit = parseInt(req.query.limit) || 5;
        // Get pending SMS that haven't been sent yet
        const [rows] = await db_1.default.query(`SELECT 
        id,
        phone_number,
        message,
        student_id,
        attendance_id,
        priority,
        retry_count,
        created_at
       FROM sms_queue
       WHERE status = 'pending' 
         AND (retry_count < 3 OR retry_count IS NULL)
       ORDER BY 
         CASE priority
           WHEN 'high' THEN 1
           WHEN 'normal' THEN 2
           WHEN 'low' THEN 3
           ELSE 4
         END,
         created_at ASC
       LIMIT ?`, [limit]);
        console.log(`📡 ESP32 polling: ${rows.length} pending SMS found`);
        res.json(rows);
    }
    catch (error) {
        console.error('❌ Error fetching pending SMS:', error);
        res.status(500).json({ error: 'Failed to fetch pending SMS' });
    }
};
exports.getPendingSMS = getPendingSMS;
/**
 * Mark SMS as sent (called by ESP32 after successful send)
 */
const acknowledgeSMS = async (req, res) => {
    try {
        const { id } = req.params;
        const { status = 'sent', error_message = null } = req.body;
        const [result] = await db_1.default.query(`UPDATE sms_queue 
       SET status = ?,
           sent_at = NOW(),
           error_message = ?
       WHERE id = ?`, [status, error_message, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'SMS not found' });
        }
        console.log(`✅ SMS ${id} marked as ${status}`);
        res.json({
            success: true,
            message: `SMS marked as ${status}`
        });
    }
    catch (error) {
        console.error('❌ Error acknowledging SMS:', error);
        res.status(500).json({ error: 'Failed to acknowledge SMS' });
    }
};
exports.acknowledgeSMS = acknowledgeSMS;
/**
 * Mark SMS as failed (ESP32 reports failure)
 */
const markSMSFailed = async (req, res) => {
    try {
        const { id } = req.params;
        const { error_message } = req.body;
        // Increment retry count
        const [result] = await db_1.default.query(`UPDATE sms_queue 
       SET retry_count = retry_count + 1,
           error_message = ?,
           status = CASE 
             WHEN retry_count >= 2 THEN 'failed'
             ELSE 'pending'
           END,
           last_retry_at = NOW()
       WHERE id = ?`, [error_message, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'SMS not found' });
        }
        console.log(`⚠️  SMS ${id} failed: ${error_message}`);
        res.json({
            success: true,
            message: 'SMS failure recorded'
        });
    }
    catch (error) {
        console.error('❌ Error marking SMS failed:', error);
        res.status(500).json({ error: 'Failed to mark SMS as failed' });
    }
};
exports.markSMSFailed = markSMSFailed;
/**
 * Get SMS queue status (for monitoring)
 */
const getSMSQueueStatus = async (req, res) => {
    try {
        const [stats] = await db_1.default.query(`SELECT 
        status,
        COUNT(*) as count,
        MAX(created_at) as latest
       FROM sms_queue
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY status`);
        const [recentSMS] = await db_1.default.query(`SELECT 
        id,
        phone_number,
        LEFT(message, 50) as message_preview,
        status,
        retry_count,
        created_at,
        sent_at
       FROM sms_queue
       ORDER BY created_at DESC
       LIMIT 20`);
        res.json({
            stats,
            recent: recentSMS
        });
    }
    catch (error) {
        console.error('❌ Error fetching SMS queue status:', error);
        res.status(500).json({ error: 'Failed to fetch SMS queue status' });
    }
};
exports.getSMSQueueStatus = getSMSQueueStatus;
