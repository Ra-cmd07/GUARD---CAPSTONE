"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGuardian = createGuardian;
exports.getGuardians = getGuardians;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = __importDefault(require("../lib/db"));
// ─── POST /api/guardians ──────────────────────────────────────────────
async function createGuardian(req, res) {
    try {
        const { name, age, address, relationship, contact, student_name, photo_base64 } = req.body;
        if (!name || !student_name) {
            res.status(400).json({ error: 'name and student_name are required' });
            return;
        }
        let photoPath = null;
        // Save base64 photo if provided
        if (photo_base64) {
            const uploadsDir = path_1.default.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
            if (!fs_1.default.existsSync(uploadsDir))
                fs_1.default.mkdirSync(uploadsDir, { recursive: true });
            const filename = `guardian_${Date.now()}.jpg`;
            const filepath = path_1.default.join(uploadsDir, filename);
            const buffer = Buffer.from(photo_base64, 'base64');
            fs_1.default.writeFileSync(filepath, buffer);
            photoPath = `/uploads/${filename}`;
        }
        const [result] = await db_1.default.execute(`INSERT INTO teacher (name, age, address, relationship, contact, student_name, photo_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [name, age || null, address || null, relationship || null,
            contact || null, student_name, photoPath]);
        res.status(201).json({
            id: result.insertId,
            message: 'Guardian registered successfully',
        });
    }
    catch (err) {
        console.error('createGuardian error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/guardians?student_name= ────────────────────────────────
async function getGuardians(req, res) {
    try {
        const { student_name } = req.query;
        let query = 'SELECT * FROM teacher';
        let params = [];
        if (student_name) {
            query += ' WHERE student_name LIKE ?';
            params = [`%${student_name}%`];
        }
        query += ' ORDER BY created_at DESC';
        const [rows] = await db_1.default.execute(query, params);
        res.json(rows);
    }
    catch (err) {
        console.error('getGuardians error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
