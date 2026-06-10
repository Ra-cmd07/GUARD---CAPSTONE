import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

// ─── ROUTE IMPORTS ────────────────────────────────────────────────────
import authRoutes from './routes/authRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import studentRoutes from './routes/studentRoutes';
import guardianRoutes from './routes/guardianRoutes';
import scanPhotoRoutes from './routes/scanPhotoRoutes';
import bleRoutes from './routes/bleRoutes';
import rfidRoutes from './routes/rfidRoutes';
import { errorHandler } from './middleware/errorMiddleware';

// ─── ENV ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000');
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── CORS ORIGINS ─────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5173',
];

if (NODE_ENV === 'development') {
    ALLOWED_ORIGINS.push('http://192.168.1.29:5173');
    ALLOWED_ORIGINS.push('http://192.168.1.29:3000');
}

// ─── RATE LIMITERS ────────────────────────────────────────────────────
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/health',
});

const bleLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many BLE uploads. Max 10 per minute.',
    statusCode: 429,
    standardHeaders: true,
    legacyHeaders: false,
});

// ─── APP INIT ─────────────────────────────────────────────────────────
const app = express();

// ─── CORE MIDDLEWARE ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // allow curl/mobile
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        console.warn(`❌ CORS rejected: ${origin}`);
        callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
}));
app.use(morgan('dev'));
app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        uptime: process.uptime(),
    });
});

// ─── ROUTES ───────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/scan-photos', scanPhotoRoutes);
app.use('/api/rfid', rfidRoutes);

// BLE routes — auth is handled inside bleRoutes
app.use('/api/ble', bleLimiter, bleRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        error: 'Route not found',
        path: req.path,
        method: req.method,
    });
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.message?.includes('CORS')) {
        return res.status(403).json({
            status: 'error',
            error: 'CORS policy violation',
            message: err.message,
        });
    }
    errorHandler(err, req, res, next);
});

// ─── START ────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AttendBox API running at http://0.0.0.0:${PORT}`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://192.168.1.29:${PORT}`);
    console.log(`✅ MySQL connected successfully`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

export default app;