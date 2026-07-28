import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import fs from 'fs';
import { initializeWebSocket } from './src/websocket/socketHandler';
import { uploadQueue } from './utils/uploadQueue';

dotenv.config();

// ─── Route imports ────────────────────────────────────────────────────
import authRoutes       from './routes/authRoutes';
import adminRoutes      from './routes/adminRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import studentRoutes    from './routes/studentRoutes';
import guardianRoutes   from './routes/guardianRoutes';
import scanPhotoRoutes  from './routes/scanPhotoRoutes';
import bleRoutes        from './routes/bleRoutes';
import rfidRoutes       from './routes/rfidRoutes';
import kioskRoutes      from './routes/kioskRoutes';
import locationRoutes   from './routes/locationRoutes';
import bleApprovalRoutes from './routes/bleApprovalRoutes';
import rfidApprovalRoutes from './routes/rfidApprovalRoutes';
import reportsRoutes    from './routes/reportsRoutes';
import kiosksRoutes     from './routes/kiosksRoutes';
import gsmRoutes        from './routes/gsmRoutes';
import teacherRoutes    from './routes/teacherRoutes';
import notificationRoutes from './routes/notificationRoutes';
import excuseRoutes       from './routes/excuseRoutes';
import messageRoutes      from './routes/messageRoutes';
import alertRoutes        from './routes/alertRoutes';
import announcementRoutes from './routes/announcementRoutes';
import { checkAttendanceThresholds } from './controllers/attendanceAlertController';

import { errorHandler } from './middleware/errorMiddleware';

const app  = express();
const PORT = parseInt(process.env.PORT || '5000');

// ─── Core Middleware ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow images from same origin
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false, // IMPORTANT: Disable this to allow image loading!
}));
app.use(cors({
  origin:         process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ─────────────────────────────────────────────────────
// Handle both dev (ts-node from root) and prod (node from dist/) modes
const uploadsPath = __dirname.endsWith('dist') 
  ? path.join(__dirname, '..', 'uploads')  // Production: dist/server.js -> ../uploads
  : path.join(__dirname, 'uploads');       // Development: server.ts -> ./uploads
  
console.log('📁 Serving static uploads from:', path.resolve(uploadsPath));

// Serve uploads with proper CORS headers - FIX: Use * to allow all origins
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}, express.static(uploadsPath));

// ─── API Routes ────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/attendance',  attendanceRoutes);
app.use('/api/students',    studentRoutes);
app.use('/api/guardians',   guardianRoutes);
app.use('/api/scan-photos', scanPhotoRoutes);
app.use('/api/ble',         bleRoutes);
app.use('/api/ble',         bleApprovalRoutes);  // BLE pending approval routes
app.use('/api/rfid',        rfidApprovalRoutes); // RFID approval routes FIRST (/detect, /pending, /approve, /reject)
app.use('/api/rfid',        rfidRoutes);         // Old RFID routes second (/logs, /dashboard)
app.use('/api/kiosk',       kioskRoutes);
app.use('/api/location',    locationRoutes);
app.use('/api/reports',     reportsRoutes);
app.use('/api/kiosks',      kiosksRoutes);
app.use('/api/gsm',         gsmRoutes);
app.use('/api/teacher',        teacherRoutes);
app.use('/api/notifications',  notificationRoutes);
app.use('/api/excuse',         excuseRoutes);
app.use('/api/messages',       messageRoutes);
app.use('/api/alerts',         alertRoutes);
app.use('/api/announcements',  announcementRoutes);

// ─── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────
// Check if HTTPS certificates exist
const certPath = path.resolve(__dirname, 'certs/localhost.pem');
const keyPath  = path.resolve(__dirname, 'certs/localhost-key.pem');
const httpsEnabled = fs.existsSync(certPath) && fs.existsSync(keyPath);

let server;

if (httpsEnabled) {
  // HTTPS mode - enables camera on phone
  const httpsOptions = {
    key:  fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
  server = createHttpsServer(httpsOptions, app);
  console.log('🔒 HTTPS mode enabled');
} else {
  // HTTP fallback
  server = createHttpServer(app);
  console.log('⚠️  HTTP mode (no certificates found)');
}

// Initialize WebSocket
const io = initializeWebSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  const proto = httpsEnabled ? 'https' : 'http';
  console.log(`🚀 AttendBox API running at ${proto}://0.0.0.0:${PORT}`);
  console.log(`   Local:   ${proto}://localhost:${PORT}`);
  console.log(`   Network: ${proto}://192.168.1.37:${PORT}`);
  console.log(`🔌 WebSocket server ready for real-time updates`);
  console.log(`📤 Background upload queue initialized`);

  // ── Daily attendance threshold check ─────────────────────────────
  // Runs once on startup, then every 24 hours
  const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const runWithDelay = () => {
    // First run: 60 seconds after startup (let DB settle)
    setTimeout(async () => {
      await checkAttendanceThresholds();
      // Then repeat every 24 hours
      setInterval(checkAttendanceThresholds, RUN_INTERVAL_MS);
    }, 60_000);
  };
  runWithDelay();
  console.log(`⏰ Attendance threshold checker scheduled (runs daily)`);
});

export default app;
export { io };
