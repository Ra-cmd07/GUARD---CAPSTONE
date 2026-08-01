import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { AttendanceRecord, Student } from '../types';
import { format } from 'date-fns';

export default function ParentDashboardScreen() {
  const { user, logout } = useAuth();
  const [children, setChildren] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Fetch children
      const { data: studentsData } = await api.get('/students');
      setChildren(studentsData);

      // Fetch recent attendance
      const { data: attendanceData } = await api.get('/attendance', {
        params: { limit: 20 },
      });
      setAttendance(attendanceData);
    } catch (error) {
      console.error('Failed to load data:', error);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Time-In':
        return '#10b981';
      case 'Time-Out':
        return '#3b82f6';
      case 'Late':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome Back,</Text>
          <Text style={styles.name}>
            {(user?.profile as any)?.name || user?.username}
          </Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Children Cards */}
        <Text style={styles.sectionTitle}>Your Children</Text>
        {children.map((child) => (
          <View key={child.id} style={styles.childCard}>
            <View style={styles.childAvatar}>
              <Text style={styles.childAvatarText}>
                {child.name.charAt(0)}
              </Text>
            </View>
            <View style={styles.childInfo}>
              <Text style={styles.childName}>{child.name}</Text>
              <Text style={styles.childDetails}>
                {child.grade} - {child.section}
              </Text>
              <Text style={styles.childLRN}>LRN: {child.lrn}</Text>
            </View>
          </View>
        ))}

        {/* Recent Attendance */}
        <Text style={styles.sectionTitle}>Recent Attendance</Text>
        {attendance.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No attendance records yet</Text>
          </View>
        ) : (
          attendance.map((record) => (
            <View key={record.id} style={styles.attendanceCard}>
              <View style={styles.attendanceHeader}>
                <Text style={styles.attendanceStudent}>
                  {record.student_name}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(record.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{record.status}</Text>
                </View>
              </View>
              <Text style={styles.attendanceTime}>
                {format(new Date(record.timestamp), 'MMM dd, yyyy - hh:mm a')}
              </Text>
              <Text style={styles.attendanceMethod}>
                Method: {record.scan_method}
              </Text>
              
              {/* HYBRID PHOTO DISPLAY */}
              {record.cloudinary_uploaded && record.cloudinary_url ? (
                // Photo uploaded to Cloudinary - display from CDN
                <Image
                  source={{ uri: record.cloudinary_url }}
                  style={styles.attendancePhoto}
                  resizeMode="cover"
                />
              ) : record.local_path ? (
                // Photo still uploading to Cloudinary - show indicator
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={styles.uploadingText}>
                    📤 Uploading to cloud...
                  </Text>
                  <Text style={styles.uploadingSubtext}>
                    Photo will appear shortly
                  </Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
    backgroundColor: '#2563eb',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 14,
    color: '#dbeafe',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 12,
  },
  childCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  childAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  childAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  childDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  childLRN: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  attendanceStudent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  attendanceTime: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  attendanceMethod: {
    fontSize: 12,
    color: '#9ca3af',
  },
  attendancePhoto: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 12,
  },
  uploadingContainer: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  uploadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  uploadingSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});
