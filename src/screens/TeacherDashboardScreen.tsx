import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, StatusBar } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { AttendanceRecord, AttendanceStatus, Student, TeacherProfile } from '../types';

type TeacherTabParamList = {
  Sections: undefined;
  SF2: undefined;
  'Attendance Editor': undefined;
  Logout: undefined;
};

const Tab = createBottomTabNavigator<TeacherTabParamList>();

export default function TeacherDashboardScreen() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: { backgroundColor: '#f8fbff', borderTopColor: '#e5e7eb', borderTopWidth: 1 },
      }}
    >
      <Tab.Screen name="Sections" component={TeacherSectionScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="people-outline" size={size} color={color} />), tabBarLabel: 'Sections' }} />
      <Tab.Screen name="SF2" component={TeacherSF2Screen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="document-text-outline" size={size} color={color} />), tabBarLabel: 'SF2' }} />
      <Tab.Screen name="Attendance Editor" component={TeacherAttendanceEditorScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="create-outline" size={size} color={color} />), tabBarLabel: 'Attendance' }} />
      <Tab.Screen name="Logout" component={TeacherLogoutScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="log-out-outline" size={size} color={color} />), tabBarLabel: 'Logout' }} />
    </Tab.Navigator>
  );
}

function TeacherSectionScreen() {
  const { user } = useAuth();
  const [section, setSection] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: classData }, { data: attendanceData }] = await Promise.all([
          api.get('/teacher/classes'),
          api.get('/teacher/attendance/today'),
        ]);
        setSection(classData.teacher?.section || 'My Section');
        setStudents(classData.students || []);
        setAttendance(attendanceData.attendance || []);
      } catch (error) {
        console.error('TeacherSection failed to load data:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    // re-run effect by calling load inline
    (async () => {
      try {
        const [{ data: classData }, { data: attendanceData }] = await Promise.all([
          api.get('/teacher/classes'),
          api.get('/teacher/attendance/today'),
        ]);
        setSection(classData.teacher?.section || 'My Section');
        setStudents(classData.students || []);
        setAttendance(attendanceData.attendance || []);
      } catch (error) {
        console.error(error);
      } finally {
        setRefreshing(false);
      }
    })();
  };

  const handleMark = async (studentId: number, status: 'Time-In' | 'Late' | 'Absent') => {
    try {
      await api.post('/teacher/attendance/manual', { student_id: studentId, status, session: 'AM' });
      Alert.alert('Success', `Marked ${status} for student.`);
      onRefresh();
    } catch (error) {
      console.error('Failed to mark attendance:', error);
      Alert.alert('Error', 'Unable to update attendance right now.');
    }
  };

  const statusMap: Record<number, AttendanceStatus | undefined> = {};
  attendance.forEach((it) => {
    if (it.student_id) {
      statusMap[it.student_id] = it.status;
    }
  });

  const stats = {
    totalStudents: students.length,
    present: attendance.filter((it) => it.status === 'Time-In').length,
    late: attendance.filter((it) => it.status === 'Late').length,
    absent: attendance.filter((it) => it.status === 'Absent').length,
  };

  const userInitial = (user?.profile?.name?.charAt(0) || user?.username?.charAt(0) || 'T').toUpperCase();
  const attendeeDate = format(new Date(), 'MMM d, yyyy');

  if (loading) {
    return (
      <LinearGradient colors={['#2563eb', '#60a5fa', '#eff6ff']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={[styles.loadingText, { color: '#eef2ff' }]}>Loading teacher dashboard...</Text>
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
              <Text style={styles.smallHeader}> </Text>
              <Text style={styles.headerTitle}>{user?.profile?.name || user?.username}</Text>
              <Text style={styles.headerSubtitle}>{attendeeDate}</Text>
            </View>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{userInitial}</Text>
            </View>
          </View>

          <View style={styles.overviewCard}>
            <Text style={styles.cardLabel}>Section overview</Text>
            <Text style={styles.cardTitle}>{section || 'My Section'}</Text>
            <Text style={styles.cardDetails}>Manage attendance for your class and keep student status up to date.</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total students</Text>
              <Text style={styles.summaryValue}>{stats.totalStudents}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Present</Text>
              <Text style={styles.summaryValue}>{stats.present}</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Late</Text>
              <Text style={styles.summaryValue}>{stats.late}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Absent</Text>
              <Text style={styles.summaryValue}>{stats.absent}</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Attendance Roster</Text>
          {students.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No students found for your section.</Text>
            </View>
          ) : (
            students.map((student) => (
              <View key={student.id} style={styles.studentCard}>
                <View>
                  <Text style={styles.cardName}>{student.name}</Text>
                  <Text style={styles.cardDetails}>{student.grade || 'Grade N/A'} • {student.section || 'Section N/A'}</Text>
                  <Text style={styles.cardMeta}>LRN: {student.lrn || 'N/A'}</Text>
                </View>
                <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(statusMap[student.id] || 'Absent') }]}>{statusMap[student.id] || 'Not marked'}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function TeacherAttendanceEditorScreen() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: classData }, { data: attendanceData }] = await Promise.all([
        api.get('/teacher/classes'),
        api.get('/teacher/attendance/today'),
      ]);
      setStudents(classData.students || []);
      setAttendance(attendanceData.attendance || []);
    } catch (error) {
      console.error('TeacherAttendanceEditor failed to load data:', error);
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

  const handleMark = async (studentId: number, status: AttendanceStatus) => {
    try {
      await api.post('/teacher/attendance/manual', { student_id: studentId, status, session: 'AM' });
      Alert.alert('Success', `Marked ${status} for student.`);
      loadData();
    } catch (error) {
      console.error('TeacherAttendanceEditor mark failed:', error);
      Alert.alert('Error', 'Unable to update attendance right now.');
    }
  };

  const statusMap: Record<number, AttendanceStatus | undefined> = {};
  attendance.forEach((it) => {
    if (it.student_id) {
      statusMap[it.student_id] = it.status;
    }
  });

  const teacherName = user?.profile?.name || user?.username;

  if (loading) {
    return (
      <LinearGradient colors={['#2563eb', '#60a5fa', '#eff6ff']} style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={[styles.loadingText, { color: '#eef2ff' }]}>Loading attendance editor...</Text>
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
              <Text style={styles.smallHeader}>Attendance editor</Text>
              <Text style={styles.headerTitle}>{teacherName}</Text>
              <Text style={styles.headerSubtitle}>{format(new Date(), 'MMM d, yyyy')}</Text>
            </View>
          </View>

          <View style={styles.overviewCard}>
            <Text style={styles.cardLabel}>Editor overview</Text>
            <Text style={styles.cardTitle}>{students.length} students</Text>
            <Text style={styles.cardDetails}>Tap a status button to update attendance today.</Text>
          </View>

          {students.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No students are currently assigned to your section.</Text>
            </View>
          ) : (
            students.map((student) => (
              <View key={student.id} style={styles.editorCard}>
                <View style={styles.editorHeader}>
                  <View>
                    <Text style={styles.cardName}>{student.name}</Text>
                    <Text style={styles.cardDetails}>{student.grade || 'Grade N/A'} • {student.section || 'Section N/A'}</Text>
                    <Text style={styles.cardMeta}>LRN: {student.lrn}</Text>
                  </View>
                  <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(statusMap[student.id] || 'Absent') }]}>{statusMap[student.id] || 'Not marked'}</Text>
                </View>
                <View style={styles.editorButtonRow}>
                  <TouchableOpacity style={[styles.actionButton, styles.timeInButton]} onPress={() => handleMark(student.id, 'Time-In')}>
                    <Text style={styles.actionButtonText}>Time-In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.lateButton]} onPress={() => handleMark(student.id, 'Late')}>
                    <Text style={styles.actionButtonText}>Late</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.absentButton]} onPress={() => handleMark(student.id, 'Absent')}>
                    <Text style={styles.actionButtonText}>Absent</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function TeacherSF2Screen() {
  return (
    <LinearGradient colors={['#2563eb', '#60a5fa', '#eff6ff']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#eff6ff" />
        <ScrollView contentContainerStyle={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>School Form 2</Text>
            <Text style={styles.placeholderText}>This is the new SF2 menu for teachers. You can use this screen to view and submit School Form 2 entries.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => {}}>
              <Text style={styles.primaryButtonText}>Open SF2</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
function TeacherLogoutScreen() {
  const { user, logout } = useAuth();
  const profile = user?.profile as TeacherProfile | null;

  return (
    <LinearGradient colors={['#2563eb', '#60a5fa', '#eff6ff']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#eff6ff" />
        <View style={styles.logoutContainer}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.profileCard}>
            <Text style={styles.profileLabel}>Name</Text>
            <Text style={styles.profileValue}>{profile?.name || user?.username || 'Teacher'}</Text>
            <Text style={styles.profileLabel}>Section</Text>
            <Text style={styles.profileValue}>{profile?.section || 'N/A'}</Text>
            <Text style={styles.profileLabel}>Role</Text>
            <Text style={styles.profileValue}>{user?.role || 'Teacher'}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 16,
  },
  safeArea: {
    flex: 1,
  },
  gradient: {
    flex: 1,
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#dbeafe',
    fontSize: 13,
    marginTop: 4,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  overviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  cardLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 20,
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
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 16,
    marginBottom: 14,
  },
  emptyState: {
    backgroundColor: '#ffffffee',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentInfo: {
    flex: 1,
    paddingRight: 10,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    color: '#fff',
    fontWeight: '700',
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
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
  },
  placeholderCard: {
    width: '100%',
    backgroundColor: '#ffffffee',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  editorCard: {
    backgroundColor: '#ffffffee',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  editorButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  timeInButton: {
    backgroundColor: '#10b981',
  },
  lateButton: {
    backgroundColor: '#f59e0b',
  },
  absentButton: {
    backgroundColor: '#ef4444',
  },
});

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
