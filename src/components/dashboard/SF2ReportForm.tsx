import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Download as DownloadIcon, Print as PrintIcon } from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import api from '../../api/client';
import type { AttendanceRecord } from '../../types';

interface SF2Data {
  schoolName: string;
  schoolID: string;
  section: string;
  gradeLevel: string;
  teacher: string;
  month: string;
  year: string;
  schoolYear: string;
  students: SF2Student[];
  generatedDate: string;
  daysInMonth: number;
  totalEnrollment: number;
}

interface SF2Student {
  lrn: string;
  name: string;
  gender: string;
  attendance: Record<number, string>; // day -> status (blank=Present, x=Absent, ½=Late)
  total_present: number;
  total_absent: number;
  total_late: number;
  remarks: string;
}

interface SF2ReportFormProps {
  selectedSectionId?: number;
}

export default function SF2ReportForm({ selectedSectionId: propSectionId }: SF2ReportFormProps) {
  const [sf2Data, setSF2Data] = useState<SF2Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [schoolName, setSchoolName] = useState('AttendBox School');
  const [schoolID, setSchoolID] = useState('');
  const [schoolYear, setSchoolYear] = useState('2026-2027');
  const [gradeLevel, setGradeLevel] = useState('Grade 7');
  const [sectionId, setSectionId] = useState<number | null>(propSectionId || null);
  const [sectionName, setSectionName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [availableSections, setAvailableSections] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  // Fetch available sections for the teacher
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const { data } = await api.get('/teacher/sections');
        console.log('✅ SF2 Sections fetched:', data);
        const sections = data.sections || [];
        setAvailableSections(sections);
        if (sections.length > 0 && !sectionId) {
          setSectionId(sections[0].id);
          setSectionName(sections[0].name);
        }
      } catch (error) {
        console.error('❌ Failed to load sections:', error);
        setAvailableSections([]);
      }
    };
    fetchSections();
  }, []);

  // Fetch available classes for the teacher
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const { data } = await api.get('/teacher/classes');
        console.log('✅ SF2 Classes fetched:', data);
        const classes = data.classes || [];
        setAvailableClasses(classes);
      } catch (error) {
        console.error('❌ Failed to load classes:', error);
        setAvailableClasses([]);
      }
    };
    fetchClasses();
  }, []);

  // Fetch attendance records for the month
  useEffect(() => {
    const fetchMonthlyData = async () => {
      setLoading(true);
      try {
        const [year, month] = selectedMonth.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = endOfMonth(startDate);

        const records: AttendanceRecord[] = [];
        const days = eachDayOfInterval({ start: startDate, end: endDate });

        // Fetch data for each day with section filtering
        for (const day of days) {
          const dateStr = format(day, 'yyyy-MM-dd');
          try {
            const params = sectionId ? `&section_id=${sectionId}` : '';
            const { data } = await api.get(`/teacher/attendance/today?date=${dateStr}${params}`);
            if (data.attendance && Array.isArray(data.attendance)) {
              records.push(...data.attendance);
            }
          } catch (err) {
            console.error(`❌ Error fetching ${dateStr}:`, err);
          }
        }

        console.log('✅ Monthly data fetched. Records:', records.length);
        setAllRecords(records);
      } catch (err) {
        console.error('❌ Error fetching monthly data:', err);
        setAllRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMonthlyData();
  }, [selectedMonth, sectionId]);

  // Generate SF2 report
  const generateSF2 = () => {
    const [year, month] = selectedMonth.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = endOfMonth(startDate);
    const daysInMonth = endDate.getDate();

    // Get all enrolled students (even if no attendance records)
    const studentMap = new Map<string, SF2Student>();

    // First, initialize all students with absents
    allRecords.forEach((record) => {
      const key = `${record.lrn}-${record.student_name}`;
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          lrn: record.lrn || 'N/A',
          name: record.student_name || 'Unknown',
          gender: record.gender || 'U',
          attendance: {},
          total_present: 0,
          total_absent: 0,
          total_late: 0,
          remarks: '',
        });

        // Initialize all days as absent
        for (let day = 1; day <= daysInMonth; day++) {
          studentMap.get(key)!.attendance[day] = 'x';
        }
      }
    });

    // Then mark actual attendance
    allRecords.forEach((record) => {
      const key = `${record.lrn}-${record.student_name}`;
      const student = studentMap.get(key);
      if (!student) return;

      // Safe date parsing with validation
      if (!record.date) {
        console.warn('Missing date field in record:', record);
        return;
      }

      const dayNum = parseInt(record.date.split('-')[2]);

      // Only mark first record of the day
      if (student.attendance[dayNum] === 'x' || student.attendance[dayNum] === undefined) {
        if (record.status === 'Time-In') {
          student.attendance[dayNum] = ''; // Blank = Present
        } else if (record.status === 'Late') {
          student.attendance[dayNum] = '½'; // Half = Late/Tardy
        } else if (record.status === 'Absent') {
          student.attendance[dayNum] = 'x'; // x = Absent
        }
      }
    });

    // Calculate totals
    const students = Array.from(studentMap.values());
    students.forEach((student) => {
      for (let day = 1; day <= daysInMonth; day++) {
        const status = student.attendance[day];
        if (status === '') student.total_present++;
        else if (status === 'x') student.total_absent++;
        else if (status === '½') student.total_late++;
      }
    });

    const report: SF2Data = {
      schoolName,
      schoolID,
      section: sectionName,
      gradeLevel,
      teacher,
      month: format(startDate, 'MMMM'),
      year,
      schoolYear,
      students: students.sort((a, b) => a.name.localeCompare(b.name)),
      generatedDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      daysInMonth,
      totalEnrollment: students.length,
    };

    setSF2Data(report);
  };

  // Export to PDF (simple print to PDF)
  const handlePrint = () => {
    window.print();
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Form Header */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="School Form 2 (SF2) Daily Attendance Report of Learners"
          subheader="DepEd Official Format"
        />
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="School ID"
                value={schoolID}
                onChange={(e) => setSchoolID(e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="School Name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                type="month"
                label="Month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="School Year"
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Grade Level"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              {availableSections.length > 1 ? (
                <FormControl fullWidth size="small">
                  <InputLabel>Section</InputLabel>
                  <Select
                    value={sectionId || ''}
                    onChange={(e) => {
                      const id = e.target.value as number;
                      setSectionId(id);
                      const selected = availableSections.find(sec => sec.id === id);
                      if (selected) setSectionName(selected.name);
                    }}
                    label="Section"
                  >
                    {availableSections.map((sec) => (
                      <MenuItem key={sec.id} value={sec.id}>
                        {sec.name} ({sec.student_count} students)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  label="Section"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  fullWidth
                  size="small"
                />
              )}
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Class Adviser/Teacher"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={12}>
              {availableClasses.length > 0 && (
                <FormControl fullWidth size="small">
                  <InputLabel>Filter by Specific Class (Optional)</InputLabel>
                  <Select
                    value={selectedClassId || ''}
                    onChange={(e) => {
                      const classId = e.target.value ? (e.target.value as number) : null;
                      setSelectedClassId(classId);
                      if (classId) {
                        const classData = availableClasses.find(c => c.id === classId);
                        if (classData) {
                          setSectionId(classData.section_id);
                          setSectionName(classData.section_name);
                          setGradeLevel(classData.grade);
                        }
                      }
                    }}
                    label="Filter by Specific Class (Optional)"
                  >
                    <MenuItem value="">All Classes</MenuItem>
                    {availableClasses.map((cls) => (
                      <MenuItem key={cls.id} value={cls.id}>
                        {cls.subject} - {cls.section_name} ({cls.day_of_week} {cls.time_start})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Grid>
          </Grid>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Button
              variant="contained"
              onClick={generateSF2}
              disabled={loading}
              sx={{ mr: 1 }}
            >
              Generate Report
            </Button>
          )}
        </CardContent>
      </Card>

      {/* SF2 Report - Official Format */}
      {sf2Data && (
        <Box sx={{ '@media print': { margin: 0, padding: 0 } }}>
          <Paper
            sx={{
              p: 3,
              fontFamily: 'Arial, sans-serif',
              fontSize: '11px',
              '@media print': {
                boxShadow: 'none',
                padding: '10mm',
              },
            }}
          >
            {/* Header Section */}
            <Box sx={{ textAlign: 'center', mb: 1, pb: 1, borderBottom: '3px solid #000' }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '16px', mb: 0.3 }}>
                SCHOOL FORM 2 (SF2)
              </Typography>
              <Typography sx={{ fontWeight: 'bold', fontSize: '13px', mb: 0.3 }}>
                DAILY ATTENDANCE REPORT OF LEARNERS
              </Typography>
              <Typography sx={{ fontSize: '9px', fontStyle: 'italic' }}>
                (This replaced Form 1, Form 2 &amp; STS Form 4 - Absenteeism and Dropout Profile)
              </Typography>
            </Box>

            {/* School Information - Two Column Layout */}
            <Box sx={{ mb: 2, fontSize: '10px' }}>
              <Grid container spacing={1} sx={{ mb: 1 }}>
                <Grid item xs={6}>
                  <Typography>
                    <strong>School ID</strong> ________________ <strong>Name of School</strong> {sf2Data.schoolName}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography>
                    <strong>School Year</strong> {sf2Data.schoolYear}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container spacing={1} sx={{ mb: 1 }}>
                <Grid item xs={4}>
                  <Typography>
                    <strong>Report for the Month of</strong> ________
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography>
                    <strong>Grade Level</strong> {sf2Data.gradeLevel}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography>
                    <strong>Section</strong> {sf2Data.section}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {/* Attendance Table */}
            <TableContainer sx={{ mb: 2 }}>
              <Table
                size="small"
                sx={{
                  border: '1px solid #000',
                  '& th, & td': {
                    border: '1px solid #000',
                    padding: '4px',
                    textAlign: 'center',
                    fontSize: '9px',
                  },
                  '& th': {
                    backgroundColor: '#f0f0f0',
                    fontWeight: 'bold',
                  },
                }}
              >
                <TableHead>
                  {/* First header row with dates */}
                  <TableRow>
                    <TableCell rowSpan={2} sx={{ width: '2%', verticalAlign: 'middle', fontSize: '8px' }}>No.</TableCell>
                    <TableCell rowSpan={2} sx={{ width: '15%', verticalAlign: 'middle', fontSize: '8px', fontWeight: 'bold', textAlign: 'left' }}>
                      LEARNER'S NAME
                    </TableCell>
                    {Array.from({ length: sf2Data.daysInMonth }).map((_, i) => (
                      <TableCell key={`date-${i}`} sx={{ width: '1.5%', p: '1px', fontSize: '8px', fontWeight: 'bold' }}>
                        {i + 1}
                      </TableCell>
                    ))}
                    <TableCell rowSpan={2} sx={{ width: '3%', fontWeight: 'bold', verticalAlign: 'middle', fontSize: '8px' }}>Absent</TableCell>
                    <TableCell rowSpan={2} sx={{ width: '3%', fontWeight: 'bold', verticalAlign: 'middle', fontSize: '8px' }}>Tardy</TableCell>
                    <TableCell rowSpan={2} sx={{ width: '8%', fontWeight: 'bold', verticalAlign: 'middle', textAlign: 'left', fontSize: '8px' }}>REMARKS</TableCell>
                  </TableRow>

                  {/* Second header row with day-of-week indicators */}
                  <TableRow>
                    {Array.from({ length: sf2Data.daysInMonth }).map((_, i) => {
                      const dayOfWeek = new Date(
                        parseInt(sf2Data.year),
                        parseInt(selectedMonth.split('-')[1]) - 1,
                        i + 1
                      ).toLocaleDateString('en-US', { weekday: 'short' })
                        .substring(0, 2)
                        .toUpperCase();
                      return (
                        <TableCell key={`day-${i}`} sx={{ width: '1.5%', p: '1px', fontSize: '8px', fontWeight: 'bold' }}>
                          {dayOfWeek}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sf2Data.students.map((student, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontSize: '8px' }}>{idx + 1}</TableCell>
                      <TableCell sx={{ textAlign: 'left', fontWeight: '400', fontSize: '8px' }}>
                        {student.name}
                      </TableCell>
                      {Array.from({ length: sf2Data.daysInMonth }).map((_, day) => (
                        <TableCell key={day} sx={{ p: '1px', fontSize: '8px', fontWeight: 'bold' }}>
                          {student.attendance[day + 1] || ''}
                        </TableCell>
                      ))}
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '8px' }}>
                        {student.total_absent}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '8px' }}>
                        {student.total_late}
                      </TableCell>
                      <TableCell sx={{ fontSize: '8px', textAlign: 'left' }}>
                        {student.remarks}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Daily Totals Row */}
                  <TableRow sx={{ backgroundColor: '#e8e8e8', fontWeight: 'bold' }}>
                    <TableCell colSpan={2} sx={{ textAlign: 'right', fontWeight: 'bold', fontSize: '8px' }}>
                      TOTAL PER DAY
                    </TableCell>
                    {Array.from({ length: sf2Data.daysInMonth }).map((_, day) => {
                      let dayPresent = 0, dayAbsent = 0, dayLate = 0;
                      sf2Data.students.forEach((student) => {
                        const status = student.attendance[day + 1];
                        if (status === '') dayPresent++;
                        else if (status === 'x') dayAbsent++;
                        else if (status === '½') dayLate++;
                      });
                      return (
                        <TableCell key={day} sx={{ fontSize: '7px', fontWeight: 'bold', p: '1px' }}>
                          P:{dayPresent} A:{dayAbsent} T:{dayLate}
                        </TableCell>
                      );
                    })}
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '8px' }}>
                      {sf2Data.students.reduce((sum, s) => sum + s.total_absent, 0)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '8px' }}>
                      {sf2Data.students.reduce((sum, s) => sum + s.total_late, 0)}
                    </TableCell>
                    <TableCell>&nbsp;</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* Legend */}
            <Box sx={{ mb: 2, p: 1, backgroundColor: '#f9f9f9', border: '1px solid #ccc', fontSize: '9px' }}>
              <Typography sx={{ fontWeight: 'bold', mb: 0.5 }}>
                1. CODES FOR CHECKING ATTENDANCE:
              </Typography>
              <Typography sx={{ fontSize: '9px' }}>
                <strong>blank</strong> = Present; <strong>(x)</strong> = Absent; <strong>½</strong> = Tardy (Half shaded = Upper for Late Comer, Lower for Cutting Classes)
              </Typography>
            </Box>

            {/* Summary Section */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '10px', mb: 1 }}>
                SUMMARY FOR THE MONTH
              </Typography>
              <Grid container spacing={2} sx={{ fontSize: '9px' }}>
                <Grid item xs={4}>
                  <Typography>
                    <strong>Total Enrolled:</strong> {sf2Data.totalEnrollment}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography>
                    <strong>Days of Classes:</strong> {sf2Data.daysInMonth}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography>
                    <strong>Generated:</strong> {format(new Date(), 'MMM dd, yyyy')}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {/* Signature Section */}
            <Box sx={{ mt: 4, pt: 2 }}>
              <Typography sx={{ fontSize: '9px', mb: 2 }}>
                I certify that this is a true and correct report.
              </Typography>
              <Grid container spacing={4} sx={{ fontSize: '9px' }}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Box sx={{ minHeight: '35px', mb: 0.5 }}>&nbsp;</Box>
                    <Typography sx={{ borderTop: '1px solid #000', fontSize: '9px' }}>
                      Signature of Teacher over Printed Name
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Box sx={{ minHeight: '35px', mb: 0.5 }}>&nbsp;</Box>
                    <Typography sx={{ borderTop: '1px solid #000', fontSize: '9px' }}>
                      Signature of School Head over Printed Name
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Print and Export Buttons */}
          <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'center' }}>
            <Button
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              variant="contained"
            >
              Print / Save as PDF
            </Button>
          </Box>
        </Box>
      )}

      {sf2Data && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="caption">
            <strong>Notes:</strong> This report follows DepEd SF2 format. Blank cells indicate present students. Use the Print button to save as PDF or print directly.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
