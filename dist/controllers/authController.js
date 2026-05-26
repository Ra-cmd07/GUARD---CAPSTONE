"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../lib/db"));
const auth_1 = require("../lib/auth");
// ─── POST /api/auth/register ──────────────────────────────────────────
async function register(req, res) {
    try {
        const { name, username, password, age, gender, section, contact, address } = req.body;
        if (!name || !username || !password) {
            res.status(400).json({ error: 'Name, username, and password are required' });
            return;
        }
        // Check duplicate username
        const [existing] = await db_1.default.execute('SELECT id FROM teachers WHERE username = ?', [username]);
        if (existing.length > 0) {
            res.status(400).json({ error: 'Username already taken' });
            return;
        }
        const hashed = await bcryptjs_1.default.hash(password, 10);
        const [result] = await db_1.default.execute(`INSERT INTO teachers (name, username, password, age, gender, section, contact, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [name, username, hashed,
            age || null,
            gender || null,
            section || null,
            contact || null,
            address || null]);
        res.status(201).json({
            message: 'Registered successfully',
            id: result.insertId,
        });
    }
    catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── POST /api/auth/login ─────────────────────────────────────────────
async function login(req, res) {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }
        const [rows] = await db_1.default.execute('SELECT * FROM teachers WHERE username = ?', [username]);
        const teacher = rows[0];
        if (!teacher) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }
        const match = await bcryptjs_1.default.compare(password, teacher.password);
        if (!match) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }
        const token = (0, auth_1.signToken)({ id: teacher.id, username: teacher.username });
        res.json({
            token,
            teacher: {
                id: teacher.id,
                name: teacher.name,
                username: teacher.username,
                section: teacher.section,
            },
        });
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
