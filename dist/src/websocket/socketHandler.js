"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeWebSocket = initializeWebSocket;
exports.getIO = getIO;
exports.emitAttendanceEvent = emitAttendanceEvent;
exports.emitAttendanceOverride = emitAttendanceOverride;
const socket_io_1 = require("socket.io");
let io = null;
// Initialize WebSocket server
function initializeWebSocket(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });
    io.on('connection', (socket) => {
        console.log(`🔌 WebSocket client connected: ${socket.id}`);
        // Handle user identification (role-based rooms)
        socket.on('identify', (data) => {
            console.log(`👤 User identified:`, data);
            // Join role-specific room
            socket.join(data.role);
            // Teachers join their section room
            if (data.role === 'teacher' && data.section) {
                socket.join(`section:${data.section}`);
                console.log(`👨‍🏫 Teacher joined room: section:${data.section}`);
            }
            // Parents join their child's room
            if (data.role === 'parent' && data.profileId) {
                socket.join(`parent:${data.profileId}`);
                console.log(`👨‍👩‍👧 Parent joined room: parent:${data.profileId}`);
            }
            // Students join their own room
            if (data.role === 'student' && data.profileId) {
                socket.join(`student:${data.profileId}`);
                console.log(`🎓 Student joined room: student:${data.profileId}`);
            }
            socket.emit('identified', { success: true });
        });
        socket.on('disconnect', () => {
            console.log(`🔌 WebSocket client disconnected: ${socket.id}`);
        });
    });
    console.log('✅ WebSocket server initialized');
    return io;
}
// Get WebSocket instance
function getIO() {
    return io;
}
// Emit attendance event to relevant users
function emitAttendanceEvent(data) {
    if (!io) {
        console.warn('⚠️  WebSocket not initialized');
        return;
    }
    console.log('📡 Broadcasting attendance event:', data);
    // Notify teachers in the section
    if (data.section) {
        io.to(`section:${data.section}`).emit('attendance:new', {
            type: 'new_attendance',
            student: {
                id: data.studentId,
                name: data.studentName,
                section: data.section,
                grade: data.grade,
            },
            attendance: {
                status: data.status,
                method: data.method,
                timestamp: data.timestamp,
            },
        });
        console.log(`  → Sent to teachers in section:${data.section}`);
    }
    // Notify parent
    if (data.parentId) {
        io.to(`parent:${data.parentId}`).emit('attendance:new', {
            type: 'child_attendance',
            student: {
                id: data.studentId,
                name: data.studentName,
                section: data.section,
                grade: data.grade,
            },
            attendance: {
                status: data.status,
                method: data.method,
                timestamp: data.timestamp,
            },
        });
        console.log(`  → Sent to parent:${data.parentId}`);
    }
    // Notify the student
    io.to(`student:${data.studentId}`).emit('attendance:new', {
        type: 'my_attendance',
        attendance: {
            status: data.status,
            method: data.method,
            timestamp: data.timestamp,
        },
    });
    console.log(`  → Sent to student:${data.studentId}`);
    // Notify all admins
    io.to('admin').emit('attendance:new', {
        type: 'system_attendance',
        student: {
            id: data.studentId,
            name: data.studentName,
            section: data.section,
            grade: data.grade,
        },
        attendance: {
            status: data.status,
            method: data.method,
            timestamp: data.timestamp,
        },
    });
    console.log(`  → Sent to all admins`);
}
// Emit attendance override event
function emitAttendanceOverride(data) {
    if (!io)
        return;
    console.log('📡 Broadcasting override event:', data);
    // Notify teachers in the section
    io.to(`section:${data.section}`).emit('attendance:override', {
        type: 'attendance_override',
        student: {
            id: data.studentId,
            name: data.studentName,
            section: data.section,
        },
        override: {
            oldStatus: data.oldStatus,
            newStatus: data.newStatus,
            teacherName: data.teacherName,
            reason: data.reason,
        },
    });
    // Notify admins
    io.to('admin').emit('attendance:override', {
        type: 'attendance_override',
        student: {
            id: data.studentId,
            name: data.studentName,
            section: data.section,
        },
        override: {
            oldStatus: data.oldStatus,
            newStatus: data.newStatus,
            teacherName: data.teacherName,
            reason: data.reason,
        },
    });
}
exports.default = { initializeWebSocket, getIO, emitAttendanceEvent, emitAttendanceOverride };
