"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protect = protect;
const auth_1 = require("../lib/auth");
function protect(req, res, next) {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized — no token provided' });
        return;
    }
    const token = header.slice(7);
    try {
        req.teacher = (0, auth_1.verifyToken)(token);
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
    }
}
