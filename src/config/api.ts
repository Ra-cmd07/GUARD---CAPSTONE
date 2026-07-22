import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function getApiBaseUrl() {
  // Expo Go on Android physical device needs the Metro host IP,
  // which is available from the Expo manifest debuggerHost.
  const expoHost = (Constants.manifest?.debuggerHost ||
    (Constants.manifest2 as any)?.packagerOpts?.devClientDebuggerHost ||
    (Constants.expoConfig as any)?.hostUri ||
    '').split(':')[0];

  console.log('[AttendBox API] Expo host detection:', {
    platform: Platform.OS,
    debuggerHost: Constants.manifest?.debuggerHost,
    manifest2: (Constants.manifest2 as any)?.packagerOpts?.devClientDebuggerHost,
    expoConfigHost: (Constants.expoConfig as any)?.hostUri,
    resolvedHost: expoHost,
  });

  if (Platform.OS === 'android' && expoHost) {
    return `http://${expoHost}:5000/api`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  if (Platform.OS === 'ios') {
    return 'http://localhost:5000/api';
  }

  return 'http://localhost:5000/api';
}

export const API_BASE_URL = getApiBaseUrl();

console.log('[AttendBox API] Using backend URL:', API_BASE_URL);
if (typeof global !== 'undefined' && globalThis) {
  // Make the value visible in the Expo/Metro terminal as well as the app console.
  // eslint-disable-next-line no-console
  console.log('[AttendBox API] Backend target set to:', API_BASE_URL);
}

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
