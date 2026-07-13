// ─── Auth & Users ─────────────────────────────────────────────────────
export type UserRole = 'admin' | 'teacher' | 'parent' | 'student';

export interface UserProfile {
  id: number;
  username: string;
  role: UserRole;
  profileId?: number;
  profile?: TeacherProfile | ParentProfile | StudentProfile | null;
}

export interface TeacherProfile {
  id: number;
  user_id: number;
  name: string;
  section?: string;
  subject?: string;
  room?: string;
  schedule?: string;
  contact?: string;
  gender?: string;
  employee_id?: string;
}

export interface ParentProfile {
  id: number;
  user_id: number;
  name: string;
  relationship?: string;
  contact?: string;
  children?: Student[];
}

export interface StudentProfile {
  id: number;
  user_id?: number;
  lrn: string;
  name: string;
  gender: 'M' | 'F';
  grade?: string;
  section?: string;
  mac_address?: string;
  rfid_uid?: string;
}

// ─── Attendance ────────────────────────────────────────────────────────
export type AttendanceStatus = 'Time-In' | 'Time-Out' | 'Late' | 'Absent';

export interface AttendanceRecord {
  id: number;
  student_id?: number;
  student_name: string;
  lrn?: string;
  gender?: 'M' | 'F';
  grade?: string;
  section?: string;
  teacher_id?: number;
  teacher_name?: string;
  kiosk_id?: number;
  scan_method?: 'QR' | 'RFID' | 'BLE' | 'Manual';
  status: AttendanceStatus;
  session: 'AM' | 'PM';
  date: string;
  time_in?: string;
  time_out?: string;
  timestamp: string;
  photo_path?: string;
  qr_data?: string;
  by_whom?: string;
  notes?: string;
  is_overridden?: number;
}

export interface AttendanceStats {
  'Time-In': number;
  'Time-Out': number;
  Late: number;
  Absent: number;
  present: number;
}

// ─── Students ─────────────────────────────────────────────────────────
export interface Student {
  id: number;
  lrn: string;
  name: string;
  gender: 'M' | 'F' | string;
  grade?: string;
  section?: string;
  mac_address?: string;
  rfid_uid?: string;
  is_active?: number;
  created_at?: string;
}

// ─── Dashboard ─────────────────────────────────────────────────────────
export interface AdminStats {
  total_students: number;
  total_teachers: number;
  active_kiosks: number;
  sms_today: number;
  attendance_today: number;
  present_today: number;
  attendance_rate_today: number;
}
