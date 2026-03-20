import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Route imports
import authRoutes       from './routes/authRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import studentRoutes    from './routes/studentRoutes';
import guardianRoutes   from './routes/guardianRoutes';
import scanPhotoRoutes  from './routes/scanPhotoRoutes';

// Middleware imports
import { errorHandler } from './middleware/errorMiddleware';

const app  = express();
const PORT = parseInt(process.env.PORT || '5000');

// ─── Core Middleware ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));          // large limit for base64 photos
app.use(express.urlencoded({ extended: true }));

// ─── Static Files (uploaded scan photos) ─────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API Routes ───────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/attendance',  attendanceRoutes);
app.use('/api/students',    studentRoutes);
app.use('/api/guardians',   guardianRoutes);
app.use('/api/scan-photos', scanPhotoRoutes);

// ─── Health Check ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 ChildTrack API running at http://localhost:${PORT}`);
});

export default app;