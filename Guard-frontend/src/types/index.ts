export type AttendanceStatus = 'Drop-off' | 'Pick-up' | 'Late' | 'Absent';

export interface AttendanceRecord {
  id:           number;
  student_name: string;
  lrn:          string;
  gender:       'M' | 'F';
  guardian_name:string;
  by_whom:      string;
  status:       AttendanceStatus;
  session:      'AM' | 'PM';
  date:         string;
  timestamp:    string;
}

export interface QRPayload {
  lrn:      string;
  student:  string;
  gender:   'M' | 'F';
  role:     string;
  name:     string;
  contacts: string[];
}

export interface StudentForm {
  lrn:    string;
  name:   string;
  gender: string;
}

export interface GuardianForm {
  role:           string;
  name:           string;
  contact_number: string;
}