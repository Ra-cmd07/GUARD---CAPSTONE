"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Route imports
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes"));
const studentRoutes_1 = __importDefault(require("./routes/studentRoutes"));
const guardianRoutes_1 = __importDefault(require("./routes/guardianRoutes"));
const scanPhotoRoutes_1 = __importDefault(require("./routes/scanPhotoRoutes"));
const bleRoutes_1 = __importDefault(require("./routes/bleRoutes"));
const rfidRoutes_1 = __importDefault(require("./routes/rfidRoutes"));
// Middleware imports
const errorMiddleware_1 = require("./middleware/errorMiddleware");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '5000');
// ─── Core Middleware ──────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '10mb' })); // large limit for base64 photos
app.use(express_1.default.urlencoded({ extended: true }));
// ─── Static Files (uploaded scan photos) ─────────────────────────────
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, 'uploads')));
// ─── API Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes_1.default);
app.use('/api/attendance', attendanceRoutes_1.default);
app.use('/api/students', studentRoutes_1.default);
app.use('/api/guardians', guardianRoutes_1.default);
app.use('/api/scan-photos', scanPhotoRoutes_1.default);
app.use('/api/ble', bleRoutes_1.default);
app.use('/api/rfid', rfidRoutes_1.default);
// ─── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ─── 404 Handler ─────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// ─── Global Error Handler ─────────────────────────────────────────────
app.use(errorMiddleware_1.errorHandler);
// ─── Start Server ─────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 AttendBox API running at http://localhost:${PORT}`);
});
exports.default = app;
