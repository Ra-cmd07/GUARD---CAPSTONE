import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, IconButton, Chip, Snackbar, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Add, Edit, Delete, School, Close,
} from '@mui/icons-material';
import api from '../api/client';
import theme from '../theme/professionalTheme';

interface Section {
  id: number;
  name: string;
  grade: string;
  section_code: string;
  room_number?: string;
  capacity?: number;
  is_active: number;
  created_at?: string;
  student_count?: number;
}

interface SectionForm {
  name: string;
  grade: string;
  section_code: string;
  room_number?: string;
  capacity?: number;
  is_active: number;
}

function SectionDialog({
  open,
  section,
  onClose,
  onSaved,
}: {
  open: boolean;
  section: Section | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SectionForm>({
    name: '',
    grade: '',
    section_code: '',
    room_number: '',
    capacity: undefined,
    is_active: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (section) {
      setForm({
        name: section.name || '',
        grade: section.grade || '',
        section_code: section.section_code || '',
        room_number: section.room_number || '',
        capacity: section.capacity || undefined,
        is_active: section.is_active,
      });
    } else {
      setForm({
        name: '',
        grade: '',
        section_code: '',
        room_number: '',
        capacity: undefined,
        is_active: 1,
      });
    }
    setError('');
  }, [section, open]);

  const handleChange = (field: string, value: any) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.grade || !form.section_code) {
      setError('Section name, grade, and section code are required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (section?.id) {
        // Update
        await api.patch(`/admin/sections/${section.id}`, form);
      } else {
        // Create
        await api.post('/admin/sections', form);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save section');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{
        background: theme.colors.primary.gradient,
        color: '#fff',
        fontFamily: theme.typography.fontFamily.display,
        fontWeight: theme.typography.fontWeight.bold,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        {section ? 'Edit Section' : 'Create Section'}
        <IconButton
          onClick={onClose}
          sx={{ color: '#fff' }}
          size="small"
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label="Section Name *"
          fullWidth
          size="small"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., Grade 7 - Section A"
          sx={{ mb: 2 }}
        />

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Grade Level *</InputLabel>
          <Select
            value={form.grade}
            onChange={(e) => handleChange('grade', e.target.value)}
            label="Grade Level *"
          >
            {['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(g => (
              <MenuItem key={g} value={g}>Grade {g}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Section Code *"
          fullWidth
          size="small"
          value={form.section_code}
          onChange={(e) => handleChange('section_code', e.target.value)}
          placeholder="e.g., A, B, 1, 2"
          sx={{ mb: 2 }}
        />

        <TextField
          label="Room Number"
          fullWidth
          size="small"
          value={form.room_number}
          onChange={(e) => handleChange('room_number', e.target.value)}
          placeholder="e.g., 201, A-101"
          sx={{ mb: 2 }}
        />

        <TextField
          label="Capacity"
          fullWidth
          size="small"
          type="number"
          value={form.capacity || ''}
          onChange={(e) => handleChange('capacity', e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="e.g., 40"
          sx={{ mb: 2 }}
        />

        <FormControl fullWidth size="small">
          <InputLabel>Status</InputLabel>
          <Select
            value={form.is_active}
            onChange={(e) => handleChange('is_active', e.target.value)}
            label="Status"
          >
            <MenuItem value={1}>Active</MenuItem>
            <MenuItem value={0}>Inactive</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          variant="contained"
          sx={{
            background: theme.colors.primary.gradient,
            '&:hover': {
              background: theme.colors.primary.gradient,
              opacity: 0.9,
            },
          }}
        >
          {loading ? <CircularProgress size={20} /> : section ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteConfirmDialog({
  open,
  section,
  onClose,
  onConfirm,
}: {
  open: boolean;
  section: Section | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!section) return;
    setLoading(true);
    try {
      await api.delete(`/admin/sections/${section.id}`);
      onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{
        background: theme.colors.status.error.main,
        color: '#fff',
        fontFamily: theme.typography.fontFamily.display,
        fontWeight: theme.typography.fontWeight.bold,
      }}>
        Delete Section
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Typography>
          Are you sure you want to delete <strong>{section?.name}</strong>?
        </Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>
          This action cannot be undone. All associated data will be preserved, but this section will be removed.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          disabled={loading}
          variant="contained"
          sx={{ bgcolor: theme.colors.status.error.main, '&:hover': { bgcolor: theme.colors.status.error.dark } }}
        >
          {loading ? <CircularProgress size={20} /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SectionsPage() {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });

  const showSnack = (msg: string, sev: any = 'success') => setSnack({ open: true, msg, sev });

  const loadSections = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/sections');
      setSections(data.sections || []);
    } catch (error) {
      console.error('Failed to load sections:', error);
      showSnack('Failed to load sections', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const handleCreate = () => {
    setSelectedSection(null);
    setDialogOpen(true);
  };

  const handleEdit = (section: Section) => {
    setSelectedSection(section);
    setDialogOpen(true);
  };

  const handleDeleteClick = (section: Section) => {
    setSelectedSection(section);
    setDeleteDialogOpen(true);
  };

  const handleSaved = () => {
    loadSections();
    showSnack(selectedSection ? 'Section updated successfully' : 'Section created successfully');
  };

  const handleDeleted = () => {
    loadSections();
    setDeleteDialogOpen(false);
    showSnack('Section deleted successfully');
  };

  if (loading && sections.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: theme.typography.fontFamily.display }}>
          Sections Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreate}
          sx={{
            background: theme.colors.primary.gradient,
            '&:hover': {
              background: theme.colors.primary.gradient,
              opacity: 0.9,
            },
          }}
        >
          Add Section
        </Button>
      </Box>

      {/* Sections Table */}
      {sections.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
          <School sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
          <Typography color="text.secondary">No sections found. Create one to get started!</Typography>
        </Paper>
      ) : (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Section Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Grade</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Room</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Capacity</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Students</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sections.map((section) => (
                  <TableRow key={section.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <School sx={{ color: theme.colors.primary.main, fontSize: 18 }} />
                        <Typography sx={{ fontWeight: 600 }}>{section.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{section.grade}</TableCell>
                    <TableCell>
                      <Chip
                        label={section.section_code}
                        size="small"
                        sx={{
                          bgcolor: theme.colors.primary.main + '20',
                          color: theme.colors.primary.main,
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell>{section.room_number || '—'}</TableCell>
                    <TableCell align="center">{section.capacity || '—'}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${section.student_count || 0} students`}
                        size="small"
                        icon={<School />}
                        sx={{
                          bgcolor: '#e8f5e9',
                          color: '#2e7d32',
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={section.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        color={section.is_active ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(section)}
                        title="Edit"
                        sx={{ color: theme.colors.primary.main }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(section)}
                        title="Delete"
                        sx={{ color: theme.colors.status.error.main }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Dialogs */}
      <SectionDialog
        open={dialogOpen}
        section={selectedSection}
        onClose={() => {
          setDialogOpen(false);
          setSelectedSection(null);
        }}
        onSaved={handleSaved}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        section={selectedSection}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedSection(null);
        }}
        onConfirm={handleDeleted}
      />

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          severity={snack.sev}
          variant="filled"
          onClose={() => setSnack(s => ({ ...s, open: false }))}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
