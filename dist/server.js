"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socketHandler_1 = require("./src/websocket/socketHandler");
dotenv_1.default.config();
// ─── Route imports ────────────────────────────────────────────────────
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes"));
const studentRoutes_1 = __importDefault(require("./routes/studentRoutes"));
const guardianRoutes_1 = __importDefault(require("./routes/guardianRoutes"));
const scanPhotoRoutes_1 = __importDefault(require("./routes/scanPhotoRoutes"));
const bleRoutes_1 = __importDefault(require("./routes/bleRoutes"));
const rfidRoutes_1 = __importDefault(require("./routes/rfidRoutes"));
const kioskRoutes_1 = __importDefault(require("./routes/kioskRoutes"));
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes"));
const bleApprovalRoutes_1 = __importDefault(require("./routes/bleApprovalRoutes"));
const rfidApprovalRoutes_1 = __importDefault(require("./routes/rfidApprovalRoutes"));
const reportsRoutes_1 = __importDefault(require("./routes/reportsRoutes"));
const kiosksRoutes_1 = __importDefault(require("./routes/kiosksRoutes"));
const gsmRoutes_1 = __importDefault(require("./routes/gsmRoutes"));
const teacherRoutes_1 = __importDefault(require("./routes/teacherRoutes"));
const teacherClassRoutes_1 = __importDefault(require("./routes/teacherClassRoutes"));
const errorMiddleware_1 = require("./middleware/errorMiddleware");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '5000');
// ─── Core Middleware ──────────────────────────────────────────────────
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable CSP to allow images from same origin
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false, // IMPORTANT: Disable this to allow image loading!
}));
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// ─── Static Files ─────────────────────────────────────────────────────
// Handle both dev (ts-node from root) and prod (node from dist/) modes
const uploadsPath = __dirname.endsWith('dist')
    ? path_1.default.join(__dirname, '..', 'uploads') // Production: dist/server.js -> ../uploads
    : path_1.default.join(__dirname, 'uploads'); // Development: server.ts -> ./uploads
console.log('📁 Serving static uploads from:', path_1.default.resolve(uploadsPath));
// Serve uploads with proper CORS headers - FIX: Use * to allow all origins
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
}, express_1.default.static(uploadsPath));
// ─── API Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/attendance', attendanceRoutes_1.default);
app.use('/api/students', studentRoutes_1.default);
app.use('/api/guardians', guardianRoutes_1.default);
app.use('/api/scan-photos', scanPhotoRoutes_1.default);
app.use('/api/ble', bleRoutes_1.default);
app.use('/api/ble', bleApprovalRoutes_1.default); // BLE pending approval routes
app.use('/api/rfid', rfidApprovalRoutes_1.default); // RFID approval routes FIRST (/detect, /pending, /approve, /reject)
app.use('/api/rfid', rfidRoutes_1.default); // Old RFID routes second (/logs, /dashboard)
app.use('/api/kiosk', kioskRoutes_1.default);
app.use('/api/location', locationRoutes_1.default);
app.use('/api/reports', reportsRoutes_1.default);
app.use('/api/kiosks', kiosksRoutes_1.default);
app.use('/api/gsm', gsmRoutes_1.default);
app.use('/api/teacher/classes', teacherClassRoutes_1.default); // Register class routes FIRST for precedence
app.use('/api/teacher', teacherRoutes_1.default); // Then teacher routes
// ─── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ─── 404 Handler ──────────────────────────────────────────────────────
app.use((_req, res) => {
    console.log(`❌ 404: ${_req.method} ${_req.originalUrl}`);
    res.status(404).json({ error: 'Route not found' });
});
// ─── Global Error Handler ─────────────────────────────────────────────
app.use(errorMiddleware_1.errorHandler);
// ─── Start Server ─────────────────────────────────────────────────────
const httpServer = (0, http_1.createServer)(app);
// Initialize WebSocket
const io = (0, socketHandler_1.initializeWebSocket)(httpServer);
exports.io = io;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AttendBox API running at http://0.0.0.0:${PORT}`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`🔌 WebSocket server ready for real-time updates`);
    console.log(`📤 Background upload queue initialized`);
});
exports.default = app;
