import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { AttendanceRecord, Student } from '../types';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function ParentDashboardScreen() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: { backgroundColor: '#f8fbff', borderTopColor: '#e5e7eb', borderTopWidth: 1 },
      }}
    >
      <Tab.Screen name="Home" component={ParentHomeScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="home-outline" size={size} color={color} />) }} />
      <Tab.Screen name="Live Map" component={ParentLiveMapScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="map-outline" size={size} color={color} />) }} />
      <Tab.Screen name="Logout" component={ParentLogoutScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="log-out-outline" size={size} color={color} />) }} />
    </Tab.Navigator>
  );
}

function ParentHomeScreen() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: childrenData }, { data: attendanceData }] = await Promise.all([
        api.get('/students'),
        api.get('/attendance', { params: { limit: 20 } }),
      ]);
      setChildren(childrenData);
      setAttendance(attendanceData);
    } catch (error) {
      console.error('ParentHome failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <LinearGradient colors={['#2563eb', '#93c5fd', '#eff6ff']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={[styles.loadingText, { color: '#eef2ff' }]}>Loading parent dashboard...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

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
              <Text style={styles.smallHeader}>Good morning,</Text>
              <Text style={styles.headerTitle}>{(user?.profile as any)?.name || user?.username}</Text>
              <Text style={styles.headerSubtitle}>{format(new Date(), 'MMM d, yyyy')}</Text>
            </View>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{((user?.profile as any)?.name || user?.username || 'U').charAt(0).toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.topCard}>
            <Text style={styles.cardLabel}>Family overview</Text>
            <Text style={styles.cardTitle}>{children.length} children linked</Text>
            <Text style={styles.cardDetails}>Manage attendance and location for your family at a glance.</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.summaryCardLeft]}>
              <Text style={styles.summaryLabel}>Total kids</Text>
              <Text style={styles.summaryValue}>{children.length}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardRight]}>
              <Text style={styles.summaryLabel}>Attendance items</Text>
              <Text style={styles.summaryValue}>{attendance.length}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Your Children</Text>
          {children.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No children are linked to this account yet.</Text>
            </View>
          ) : (
            children.map((child) => (
              <View key={child.id} style={styles.card}>
                <Text style={styles.cardName}>{child.name}</Text>
                <Text style={styles.itemDetails}>{child.grade || 'Grade N/A'} • {child.section || 'Section N/A'}</Text>
                <Text style={styles.cardMeta}>LRN: {child.lrn}</Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Recent Attendance</Text>
          {attendance.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No recent attendance records yet.</Text>
            </View>
          ) : (
            attendance.map((record) => (
              <View key={record.id} style={styles.attendanceCard}>
                <View style={styles.attendanceHeader}>
                  <Text style={styles.attendanceStudent}>{record.student_name}</Text>
                  <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) }]}>{record.status}</Text>
                </View>
                <Text style={styles.attendanceText}>{format(new Date(record.timestamp), 'MMM dd, yyyy • hh:mm a')}</Text>
                <Text style={styles.attendanceText}>Method: {record.scan_method || 'N/A'}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function ParentLiveMapScreen() {
  const [children, setChildren] = useState<Student[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLiveData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: childrenData }, { data: liveData }] = await Promise.all([
        api.get('/students'),
        api.get('/location/students-live'),
      ]);
      setChildren(childrenData);
      const childIds = new Set(childrenData.map((child: Student) => child.id));
      const filtered = liveData.locations?.filter((item: any) => childIds.has(item.studentId)) || [];
      setLocations(filtered);
    } catch (error) {
      console.error('ParentLiveMap failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLiveData();
  }, [loadLiveData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLiveData();
  };

  if (loading) {
    return (
      <LinearGradient colors={['#2563eb', '#93c5fd', '#eff6ff']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={[styles.loadingText, { color: '#eef2ff' }]}>Loading live map...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#2563eb', '#93c5fd', '#eff6ff']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#eff6ff" />
        <ScrollView
          style={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.sectionTitle}>Live Child Locations</Text>
          {locations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No live location updates available for your children.</Text>
            </View>
          ) : (
            locations.map((location) => (
              <View key={location.studentId} style={styles.card}>
                <Text style={styles.cardName}>{location.name}</Text>
                <Text style={styles.itemDetails}>{location.section || 'Section N/A'}</Text>
                <Text style={styles.cardMeta}>Position: {location.location?.name || 'Unknown'}</Text>
                <Text style={styles.cardMeta}>Updated: {location.secondsAgo} sec ago</Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function ParentLogoutScreen() {
  const { user, logout } = useAuth();

  return (
    <LinearGradient colors={['#2563eb', '#93c5fd', '#eff6ff']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#eff6ff" />
        <View style={styles.logoutContainer}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.profileCard}>
            <Text style={styles.profileLabel}>Username</Text>
            <Text style={styles.profileValue}>{user?.username}</Text>
            <Text style={styles.profileLabel}>Role</Text>
            <Text style={styles.profileValue}>{user?.role}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function getStatusColor(status: string) {
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
  card: {
    backgroundColor: '#ffffffee',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
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
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12,
    marginHorizontal: 16,
  },
  sectionTitleLight: {
    fontSize: 20,
    fontWeight: '700',
    color: '#eef2ff',
    marginBottom: 12,
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
  smallHeader: {
    color: '#dbeafe',
    fontSize: 12,
    marginBottom: 6,
  },
  headerSubtitle: {
    color: '#dbeafe',
    fontSize: 13,
    marginTop: 4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  topCard: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    padding: 22,
    marginHorizontal: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 5,
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
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  cardDetails: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  summaryCardLeft: {
    marginRight: 8,
  },
  summaryCardRight: {
    marginLeft: 8,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  scrollContent: {
    paddingBottom: 32,
    paddingTop: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: '#9ca3af',
  },
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  attendanceStudent: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  attendanceText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  logoutContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  profileValue: {
    fontSize: 16,
    color: '#111827',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
