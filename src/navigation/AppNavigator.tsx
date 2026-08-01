import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import ParentDashboardScreen from '../screens/ParentDashboardScreen';
import StudentPortalScreen from '../screens/StudentPortalScreen';
import FingerprintCalibrationScreen from '../screens/FingerprintCalibrationScreen';
import { ActivityIndicator, View } from 'react-native';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { isAuthed, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthed ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : role === 'parent' ? (
          <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} />
        ) : role === 'student' ? (
          <Stack.Screen name="StudentPortal" component={StudentPortalScreen} />
        ) : role === 'admin' ? (
          <Stack.Screen name="FingerprintCalibration" component={FingerprintCalibrationScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
