import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import ParentDashboardScreen from '../screens/ParentDashboardScreen';
import StudentPortalScreen from '../screens/StudentPortalScreen';
import FingerprintCalibrationScreen from '../screens/FingerprintCalibrationScreen';
import DistanceCalibrationScreen from '../screens/DistanceCalibrationScreen';
import RoomZoneScreen from '../screens/RoomZoneScreen';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1d4ed8',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          height: 52,
          paddingBottom: 6,
          paddingTop: 4,
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          backgroundColor: '#fff',
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="RoomCalibration"
        component={FingerprintCalibrationScreen}
        options={{
          tabBarLabel: 'Room Fingerprint',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ fontSize: size - 4, color }}>📡</Text>
          ),
        }}
      />
      <Tab.Screen
        name="RoomZone"
        component={RoomZoneScreen}
        options={{
          tabBarLabel: 'Room Zones',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ fontSize: size - 4, color }}>🚪</Text>
          ),
        }}
      />
      <Tab.Screen
        name="DistanceCalibration"
        component={DistanceCalibrationScreen}
        options={{
          tabBarLabel: 'Distance',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ fontSize: size - 4, color }}>📏</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthed, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
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
          <Stack.Screen name="AdminCalibration" component={AdminTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
});
