import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend API URL - Local network (HTTP on port 5001 for mobile)
// The main backend runs HTTPS on port 5000 for the web app.
// A plain HTTP companion server runs on port 5001 for the mobile app
// because React Native rejects self-signed HTTPS certificates.
// Make sure your phone is on the SAME WiFi network — do NOT use --tunnel.
export const API_BASE_URL = 'http://192.168.1.29:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 
    'Content-Type': 'application/json'
  },
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['authToken', 'user']);
      // Navigation will be handled by the app
    }
    return Promise.reject(error);
  }
);

export default api;
