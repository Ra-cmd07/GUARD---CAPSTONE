import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

interface UseWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  error: string | null;
}

/**
 * WebSocket hook for real-time updates
 * Connects to backend Socket.IO server and handles reconnection
 */
export function useWebSocket(userRole?: string, profileId?: number): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    console.log('🔌 Connecting to WebSocket:', SOCKET_URL);
    
    // Create socket connection
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      console.log('✅ WebSocket connected:', socket.id);
      setConnected(true);
      setError(null);

      // Identify user role for room assignment
      if (userRole) {
        socket.emit('identify', { role: userRole, profileId });
        console.log(`👤 Identified as ${userRole} (profileId: ${profileId})`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ WebSocket connection error:', err.message);
      setError(err.message);
      setConnected(false);
    });

    socket.on('identified', (data) => {
      console.log('✅ User identified:', data);
    });

    // Cleanup on unmount
    return () => {
      console.log('🔌 Disconnecting WebSocket');
      socket.disconnect();
    };
  }, [userRole, profileId]);

  return {
    socket: socketRef.current,
    connected,
    error,
  };
}

export default useWebSocket;
