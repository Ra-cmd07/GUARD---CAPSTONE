import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';

interface TeacherClass {
  id: number;
  teacher_id: number;
  section_id: number;
  subject: string;
  time_start: string;
  time_end: string;
  day_of_week: string;
  room_number: string;
  capacity: number;
  is_active: boolean;
  created_at: string;
  section_name: string;
  grade: string;
  section_code: string;
  enrolled_students: number;
}

interface CreateClassForm {
  teacher_id: number | '';
  section_id: number | '';
  subject: string;
  time_start: string;
  time_end: string;
  day_of_week: string;
  room_number: string;
  capacity: number | '';
}

interface Section {
  id: number;
  name: string;
  grade: string;
}

interface Teacher {
  id: number;
  name: string;
  user_id: number;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface TeacherClassScheduleProps {
  readOnly?: boolean;
  forAllTeachers?: boolean;
  initialTab?: number;
}

export default function TeacherClassSchedule({ forAllTeachers = false, initialTab = 0 }: TeacherClassScheduleProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [allClasses, setAllClasses] = useState<TeacherClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(initialTab);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [sectionDetails, setSectionDetails] = useState<any>(null);
  const [sectionDetailsLoading, setSectionDetailsLoading] = useState(false);
  const [editTeachersOpen, setEditTeachersOpen] = useState(false);
  const [selectedTeachers, setSelectedTeachers] = useState<number[]>([]);
  const [editingTeachersLoading, setEditingTeachersLoading] = useState(false);

  const [formData, setFormData] = useState<CreateClassForm>({
    teacher_id: '',
    section_id: '',
    subject: '',
    time_start: '',
    time_end: '',
    day_of_week: 'Monday',
    room_number: '',
    capacity: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let classesRes;
        if (forAllTeachers && isAdmin) {
          const res = await api.get('/admin/class-schedules');
          classesRes = res;
        } else {
          classesRes = await api.get('/teacher/classes');
        }
        
        const sectionsRes = isAdmin 
          ? await api.get('/admin/sections')
          : await api.get('/teacher/sections');

        const classesData = Array.isArray(classesRes.data) 
          ? classesRes.data 
          : (classesRes.data.classes || []);
        
        if (forAllTeachers && isAdmin) {
          setAllClasses(classesData);
          if (classesData.length > 0) {
            setSelectedTeacherId(classesData[0].teacher_id);
          }
        } else {
          setClasses(classesData);
        }
        
        const sectionsData = sectionsRes.data.sections || sectionsRes.data || [];
        setSections(sectionsData);

        if (isAdmin) {
          try {
            const teachersRes = await api.get('/admin/teachers');
            const teachersData = teachersRes.data.teachers || [];
            setTeachers(teachersData);
          } catch (err) {
            console.error('Error fetching teachers:', err);
          }
        }
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load class schedule');
        setClasses([]);
        setSections([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin]);

  useEffect(() => {
    if (forAllTeachers && isAdmin && selectedTeacherId) {
      const filtered = allClasses.filter(c => c.teacher_id === selectedTeacherId);
      setClasses(filtered);
    }
  }, [selectedTeacherId, allClasses, forAllTeachers, isAdmin]);

  const handleCreateClick = () => {
    setFormData({
      teacher_id: selectedTeacherId || '',
      section_id: '',
      subject: '',
      time_start: '',
      time_end: '',
      day_of_week: 'Monday',
      room_number: '',
      capacity: '',
    });
    setOpenCreate(true);
  };

  const handleEditClick = (classItem: TeacherClass) => {
    setFormData({
      teacher_id: classItem.teacher_id,
      section_id: classItem.section_id,
      subject: classItem.subject,
      time_start: classItem.time_start,
      time_end: classItem.time_end,
      day_of_week: classItem.day_of_week,
      room_number: classItem.room_number,
      capacity: classItem.capacity,
    });
    setEditingId(classItem.id);
    setOpenEdit(true);
  };

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this class?')) return;

    try {
      await api.delete(`/teacher/classes/${id}`);
      setClasses(classes.filter(c => c.id !== id));
      setSuccessMessage('Class deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete class');
    }
  };

  const handleSectionSelect = async (sectionId: number) => {
    try {
      setSectionDetailsLoading(true);
      setSelectedSectionId(sectionId);
      console.log(`📋 Fetching details for section ${sectionId}`);
      const res = await api.get(`/admin/sections/${sectionId}`);
      console.log(`✅ Section response:`, res.data);
      setSectionDetails(res.data);
      // Set initially selected teachers
      const teacherIds = (res.data.teachers || []).map((t: any) => t.id);
      setSelectedTeachers(teacherIds);
    } catch (err: any) {
      console.error(`❌ Error fetching section ${sectionId}:`, err);
      setError(err.response?.data?.error || 'Failed to load section details');
    } finally {
      setSectionDetailsLoading(false);
    }
  };

  const handleSaveTeachers = async () => {
    try {
      setEditingTeachersLoading(true);
      setError(null);
      await api.post(`/admin/sections/${selectedSectionId}/assign-teachers`, {
        teacher_ids: selectedTeachers
      });
      setSuccessMessage('Teachers assigned successfully');
      setEditTeachersOpen(false);
      // Refresh section details
      if (selectedSectionId) {
        await handleSectionSelect(selectedSectionId);
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Error assigning teachers:', err);
      setError(err.response?.data?.error || 'Failed to assign teachers');
    } finally {
      setEditingTeachersLoading(false);
    }
  };

  const handleSaveClass = async () => {
    try {
      if (isAdmin && !formData.teacher_id) {
        setError('Please select a teacher');
        return;
      }

      if (!formData.section_id || !formData.subject || !formData.time_start || !formData.time_end) {
        setError('Please fill in all required fields');
        return;
      }

      const payload = {
        ...formData,
        capacity: formData.capacity ? Number(formData.capacity) : null,
      };

      if (editingId) {
        await api.put(`/teacher/classes/${editingId}`, payload);
        const res = await api.get('/teacher/classes');
        setClasses(res.data.classes || res.data);
        setSuccessMessage('Class updated successfully');
        setOpenEdit(false);
      } else {
        const res = await api.post('/teacher/classes', payload);
        setClasses([...classes, res.data.class]);
        setSuccessMessage('Class created successfully');
        setOpenCreate(false);
      }

      setEditingId(null);
      setError(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save class');
    }
  };

  const handleFormChange = (e: React.ChangeEvent<any>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const groupedByDay = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day] = classes.filter(c => c.day_of_week === day);
    return acc;
  }, {} as Record<string, TeacherClass[]>);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}>
        <Typography variant="h4" fontWeight={700} sx={{ fontSize: { xs: '1.25rem', sm: '2rem' } }}>
          📅 {isAdmin ? 'Manage Schedules' : 'My Classes'}
        </Typography>
        
        {forAllTeachers && isAdmin && teachers.length > 0 && (
          <FormControl sx={{ 
            minWidth: { xs: '100%', sm: 280 }, 
            order: { xs: 3, sm: 'unset' },
          }}>
            <Select
              value={selectedTeacherId || ''}
              onChange={(e) => setSelectedTeacherId(e.target.value as any)}
              displayEmpty
            >
              <MenuItem value="" disabled>
                Select Teacher
              </MenuItem>
              {teachers.map(teacher => (
                <MenuItem key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        
        {isAdmin && (
          <Button
            variant="contained"
            onClick={handleCreateClick}
            sx={{ order: { xs: 2, sm: 'unset' } }}
          >
            ➕ Add Class
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {isAdmin && (
        <Paper sx={{ mb: 3, borderRadius: 1.5 }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, newValue) => setTabValue(newValue)}
          >
            <Tab label="📅 Class Schedule" />
            <Tab label="🏫 Sections & Enrollment" />
          </Tabs>
        </Paper>
      )}

      {tabValue === 0 && (
        <Box>
          {Object.keys(groupedByDay).every(day => groupedByDay[day].length === 0) ? (
            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                No classes scheduled yet
              </Typography>
              <Button variant="contained" onClick={handleCreateClick}>
                Create Your First Class
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={2.5}>
              {DAYS_OF_WEEK.map(day => {
                const dayClasses = groupedByDay[day];
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={day}>
                    <Paper sx={{ height: '100%', borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', p: 2 }}>
                        <Typography variant="h6" fontWeight={700} sx={{ textAlign: 'center' }}>
                          {day}
                        </Typography>
                      </Box>

                      <Box sx={{ p: 2 }}>
                        {dayClasses.length === 0 ? (
                          <Typography fontSize="0.9rem" sx={{ opacity: 0.6, textAlign: 'center' }}>
                            📅 No classes scheduled
                          </Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {dayClasses.map(cls => (
                              <Paper key={cls.id} sx={{ p: 1.5, background: '#f5f5f5', borderLeft: '4px solid #3b82f6' }}>
                                <Typography fontWeight={700} fontSize="0.95rem" sx={{ mb: 0.5 }}>
                                  {cls.subject}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                  <Chip label={`${cls.time_start} - ${cls.time_end}`} size="small" />
                                  <Chip label={cls.section_name} size="small" />
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                                  {isAdmin && (
                                    <>
                                      <Tooltip title="Edit">
                                        <IconButton size="small" onClick={() => handleEditClick(cls)}>
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Delete">
                                        <IconButton size="small" onClick={() => handleDeleteClick(cls.id)}>
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  )}
                                </Box>
                              </Paper>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Box>
      )}

      {tabValue === 1 && isAdmin && (
        <Box>
          <FormControl sx={{ minWidth: 250, mb: 3 }}>
            <InputLabel>Select Section</InputLabel>
            <Select
              value={selectedSectionId || ''}
              onChange={(e) => handleSectionSelect(Number(e.target.value))}
              label="Select Section"
            >
              {sections.map(section => (
                <MenuItem key={section.id} value={section.id}>
                  {section.name} ({section.grade})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {sectionDetailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : sectionDetails ? (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 3, borderRadius: 2, background: '#e0f2fe' }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                    📋 Section Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography><strong>Name:</strong> {sectionDetails.section?.name}</Typography>
                    <Typography><strong>Grade:</strong> {sectionDetails.section?.grade}</Typography>
                    <Typography><strong>Total Students:</strong> {sectionDetails.students?.length || 0}</Typography>
                  </Box>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Paper sx={{ p: 3, borderRadius: 2, background: '#fef3c7' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" fontWeight={700}>
                      👨‍🏫 Assigned Teachers
                    </Typography>
                    <Button 
                      size="small" 
                      variant="contained"
                      onClick={() => setEditTeachersOpen(true)}
                      sx={{ textTransform: 'none' }}
                    >
                      ✏️ Edit
                    </Button>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {sectionDetails.teachers && sectionDetails.teachers.length > 0 ? (
                      sectionDetails.teachers.map((teacher: any) => (
                        <Chip key={teacher.id} label={teacher.name} />
                      ))
                    ) : (
                      <Typography variant="body2" color="textSecondary">No teachers assigned</Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 3, borderRadius: 2 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                    👥 Enrolled Students ({sectionDetails.students?.length || 0})
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f3f4f6' }}>
                          <TableCell sx={{ fontWeight: 700 }}>Student Name</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>LRN</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sectionDetails.students && sectionDetails.students.length > 0 ? (
                          sectionDetails.students.map((student: any) => (
                            <TableRow key={student.id} hover>
                              <TableCell>{student.name}</TableCell>
                              <TableCell>{student.lrn || 'N/A'}</TableCell>
                              <TableCell>
                                <Chip
                                  label={student.is_active ? 'Active' : 'Inactive'}
                                  size="small"
                                  color={student.is_active ? 'success' : 'default'}
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                              No students enrolled
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="textSecondary">
                Select a section to view details
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Edit Teachers Dialog */}
      <Dialog open={editTeachersOpen} onClose={() => setEditTeachersOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ background: '#3b82f6', color: '#fff', fontWeight: 700 }}>
          ✏️ Assign Teachers to Section
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Select which teachers teach classes in this section
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel>Teachers</InputLabel>
            <Select
              multiple
              value={selectedTeachers}
              onChange={(e) => {
                const values = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                setSelectedTeachers(values.map(v => typeof v === 'string' ? parseInt(v) : v));
              }}
              label="Teachers"
            >
              {teachers.map(teacher => (
                <MenuItem key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
            Selected: {selectedTeachers.length} teacher(s)
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button onClick={() => setEditTeachersOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveTeachers} 
            variant="contained"
            disabled={editingTeachersLoading}
          >
            {editingTeachersLoading ? 'Saving...' : 'Save Teachers'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={openCreate || openEdit} 
        onClose={() => {
          setOpenCreate(false);
          setOpenEdit(false);
          setEditingId(null);
        }} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          {editingId ? '✏️ Edit Class' : '➕ Create New Class'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {isAdmin && (
            <FormControl fullWidth>
              <InputLabel>Teacher *</InputLabel>
              <Select
                name="teacher_id"
                value={formData.teacher_id}
                onChange={handleFormChange}
                label="Teacher *"
              >
                {teachers.map(t => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControl fullWidth>
            <InputLabel>Section *</InputLabel>
            <Select
              name="section_id"
              value={formData.section_id}
              onChange={handleFormChange}
              label="Section *"
            >
              {sections.map(s => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({s.grade})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Subject *"
            name="subject"
            value={formData.subject}
            onChange={handleFormChange}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Day of Week *</InputLabel>
            <Select
              name="day_of_week"
              value={formData.day_of_week}
              onChange={handleFormChange}
              label="Day of Week *"
            >
              {DAYS_OF_WEEK.map(day => (
                <MenuItem key={day} value={day}>
                  {day}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="Start Time *"
              name="time_start"
              type="time"
              value={formData.time_start}
              onChange={handleFormChange}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Time *"
              name="time_end"
              type="time"
              value={formData.time_end}
              onChange={handleFormChange}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <TextField
            label="Room Number"
            name="room_number"
            value={formData.room_number}
            onChange={handleFormChange}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, gap: 1 }}>
          <Button 
            onClick={() => {
              setOpenCreate(false);
              setOpenEdit(false);
              setEditingId(null);
            }}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveClass} 
            variant="contained"
          >
            {editingId ? 'Update Class' : 'Create Class'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
