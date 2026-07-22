import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { AttendanceRecord, AttendanceStatus, StudentProfile } from '../types';

const Tab = createBottomTabNavigator();

export default function StudentPortalScreen() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: { backgroundColor: '#f8fbff', borderTopColor: '#e5e7eb', borderTopWidth: 1 },
      }}
    >
      <Tab.Screen name="Home" component={StudentHomeScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="home-outline" size={size} color={color} />) }} />
      <Tab.Screen name="Calendar" component={StudentCalendarScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="calendar-outline" size={size} color={color} />) }} />
      <Tab.Screen name="Logout" component={StudentLogoutScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="log-out-outline" size={size} color={color} />) }} />
    </Tab.Navigator>
  );
}

function StudentHomeScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!user?.profileId) return;
      const [{ data: profileData }, { data: attendanceData }] = await Promise.all([
        api.get(`/students/${user.profileId}`),
        api.get(`/students/${user.profileId}/attendance`),
      ]);
      setProfile(profileData);
      setAttendance(attendanceData);
    } catch (error) {
      console.error('StudentHome failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <LinearGradient colors={['#2563eb', '#60a5fa', '#eff6ff']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={[styles.loadingText, { color: '#eef2ff' }]}>Loading student portal...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const qrPayload = profile
    ? JSON.stringify({ lrn: profile.lrn, name: profile.name, grade: profile.grade, section: profile.section })
    : '';

  return (
    <LinearGradient colors={['#1d4ed8', '#2563eb', '#60a5fa']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#2563eb" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.smallHeader}>Student Portal</Text>
              <Text style={styles.headerTitle}>{profile?.name || 'Student'}</Text>
              <Text style={styles.headerSubtitle}>{format(new Date(), 'MMM d, yyyy')}</Text>
            </View>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{(profile?.name?.charAt(0) || 'S').toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Your QR Code</Text>
            <Text style={styles.cardTitle}>Tap to scan</Text>
            <Text style={styles.cardDetails}>Use this code at the kiosk for quick attendance.</Text>
            <View style={styles.qrContainer}>
              {qrPayload ? <QRCode value={qrPayload} size={180} /> : null}
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>LRN</Text>
              <Text style={styles.infoValue}>{profile?.lrn || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Grade</Text>
              <Text style={styles.infoValue}>{profile?.grade || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Section</Text>
              <Text style={styles.infoValue}>{profile?.section || 'N/A'}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Recent Attendance</Text>
          {attendance.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No attendance records yet.</Text>
            </View>
          ) : (
            attendance.slice(0, 8).map((record) => (
              <View key={record.id} style={styles.attendanceCard}>
                <View style={styles.attendanceRow}>
                  <Text style={styles.attendanceDate}>{format(new Date(record.timestamp), 'MMM dd')}</Text>
                  <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) }]}>{record.status}</Text>
                </View>
                <Text style={styles.attendanceText}>{record.session} session • {record.scan_method || 'N/A'}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function StudentCalendarScreen() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!user?.profileId) return;
      const { data } = await api.get(`/students/${user.profileId}/attendance`);
      setAttendance(data);
    } catch (error) {
      console.error('StudentCalendar failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <LinearGradient colors={['#2563eb', '#60a5fa', '#eff6ff']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={[styles.loadingText, { color: '#eef2ff' }]}>Loading calendar...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#2563eb', '#60a5fa', '#eff6ff']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#eff6ff" />
        <ScrollView
          style={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.sectionTitle}>Attendance Calendar</Text>
          {attendance.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No attendance records available.</Text>
            </View>
          ) : (
            attendance.map((record) => (
              <View key={record.id} style={styles.attendanceCard}>
                <View style={styles.attendanceRow}>
                  <Text style={styles.attendanceDate}>{format(new Date(record.timestamp), 'MMM dd, yyyy')}</Text>
                  <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) }]}>{record.status}</Text>
                </View>
                <Text style={styles.attendanceText}>{record.session} session • {record.scan_method || 'N/A'}</Text>
                <Text style={styles.attendanceText}>{record.time_in || 'No time in'}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function StudentLogoutScreen() {
  const { user, logout } = useAuth();
  const profile = user?.profile as StudentProfile | null;

  return (
    <LinearGradient colors={['#2563eb', '#60a5fa', '#eff6ff']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#eff6ff" />
        <View style={styles.logoutContainer}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.profileCard}>
            <Text style={styles.profileLabel}>Name</Text>
            <Text style={styles.profileValue}>{profile?.name || user?.username || 'Student'}</Text>
            <Text style={styles.profileLabel}>Role</Text>
            <Text style={styles.profileValue}>{user?.role || 'Student'}</Text>
            <Text style={styles.profileLabel}>LRN</Text>
            <Text style={styles.profileValue}>{profile?.lrn || 'N/A'}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function getStatusColor(status: AttendanceStatus) {
  switch (status) {
    case 'Time-In':
      return '#10b981';
    case 'Time-Out':
      return '#3b82f6';
    case 'Late':
      return '#f59e0b';
    case 'Absent':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  safeArea: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  headerTitleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  smallHeader: {
    color: '#dbeafe',
    fontSize: 12,
    marginBottom: 6,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  headerSubtitle: {
    color: '#dbeafe',
    fontSize: 13,
    marginTop: 4,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  cardDetails: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 14,
    lineHeight: 20,
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  attendanceDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  attendanceText: {
    fontSize: 13,
    color: '#4b5563',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  logoutContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 10,
  },
  profileValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
