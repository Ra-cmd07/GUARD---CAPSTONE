import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Button, Checkbox, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton,
  InputAdornment, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography, Tooltip, Alert, Select, MenuItem,
} from '@mui/material';
import { Add, Delete, Edit, Save, Search, Close, Check, ArrowDropDown } from '@mui/icons-material';
import api from '../api/client';
import theme from '../theme/professionalTheme';

// ─── Types ────────────────────────────────────────────────────────────
const YEAR_LEVELS = ['Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'];
const SHS_LEVELS  = ['Grade 11','Grade 12'];
const STRANDS     = ['STEM','ABM','HUMSS','GAS','TVL','Arts and Design','Sports'];
const SUBJECTS    = [
  'English','Mathematics','Science','Filipino','Araling Panlipunan',
  'ICT','Physical Education','Health','TLE',
  'Media and Information Literacy','General Mathematics',
  'Earth Science','Statistics and Probability','Computer Programming',
];

const SESSION_OPTIONS: { value: 'AM' | 'PM' | 'BOTH'; label: string; color: string }[] = [
  { value: 'AM',   label: 'AM',   color: '#1565c0' },
  { value: 'PM',   label: 'PM',   color: '#6a1b9a' },
  { value: 'BOTH', label: 'BOTH', color: '#2e7d32' },
];

interface TeacherOpt { id: number; name: string; username: string; }
interface StudentOpt { id: number; lrn: string; name: string; grade?: string; section?: string; }

interface SubjectRow {
  id: number | null;
  subject: string;
  session: 'AM' | 'PM' | 'BOTH';
  subject_teacher_id: number | null;
  subject_teacher_name: string | null;
  _dirty?: boolean;
  _new?: boolean;
}

interface ClassBlock {
  key: string;
  year_level: string;
  strand: string | null;
  track: string | null;
  section: string;
  adviser_id: number | null;
  adviser_name: string | null;
  student_ids: number[];   // ← section-level shared roster
  subjects: SubjectRow[];
  _editing?: boolean;
}

// ─── SelectionDialog (generic) ────────────────────────────────────────
function SelectionDialog<T extends { id: number }>(props: {
  open: boolean; title: string; items: T[]; selectedIds: number[];
  multiple?: boolean; showSelectAll?: boolean;
  itemLabel: (item: T) => string; searchPlaceholder?: string;
  onClose: () => void; onConfirm: (ids: number[]) => void;
}) {
  const { open, title, items, selectedIds, multiple = false, showSelectAll = false,
          itemLabel, searchPlaceholder = 'Search…', onClose, onConfirm } = props;
  const [search, setSearch] = useState('');
  const [sel, setSel]       = useState<number[]>(selectedIds);

  useEffect(() => { if (open) setSel(selectedIds); }, [open, selectedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter(i => itemLabel(i).toLowerCase().includes(q)) : items;
  }, [items, itemLabel, search]);

  const toggle = (id: number) => {
    if (multiple) setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    else setSel([id]);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: theme.colors.primary.main, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{title}</span>
        <IconButton onClick={onClose} sx={{ color: '#fff' }}><Close /></IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField fullWidth size="small" value={search}
          onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder}
          sx={{ mt: 1, mb: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
        />
        {showSelectAll && multiple && (
          <Box display="flex" gap={1} mb={1}>
            <Button size="small" onClick={() => setSel(filtered.map(i => i.id))}>Select All</Button>
            <Button size="small" onClick={() => setSel([])}>Clear</Button>
          </Box>
        )}
        {!multiple && (
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            Select one item
          </Typography>
        )}
        <Paper variant="outlined" sx={{ maxHeight: 340, overflowY: 'auto' }}>
          <List disablePadding>
            {filtered.length === 0 ? (
              <ListItem><ListItemText primary="No matching items" /></ListItem>
            ) : filtered.map(item => {
              const selected = sel.includes(item.id);
              return (
                <ListItem key={item.id} disablePadding>
                  <ListItemButton onClick={() => toggle(item.id)} selected={selected}>
                    {multiple && (
                      <ListItemIcon>
                        <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple />
                      </ListItemIcon>
                    )}
                    <ListItemText primary={itemLabel(item)} />
                    {!multiple && selected && <Check color="success" />}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Paper>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onConfirm(sel)} variant="contained">Confirm</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── AddSectionDialog: creates a new class block ─────────────────────
function AddSectionDialog(props: {
  open: boolean; teachers: TeacherOpt[];
  onClose: () => void; onAdd: (block: Omit<ClassBlock,'key'|'subjects'|'_editing'>) => void;
}) {
  const { open, onClose, onAdd } = props;
  // Load teachers independently so dialog always has fresh data
  const [teachers, setTeachers] = useState<TeacherOpt[]>(props.teachers);
  useEffect(() => {
    if (open) {
      api.get('/admin/assignments/metadata')
        .then(r => setTeachers(r.data.teachers || []))
        .catch(() => {});
    }
  }, [open]);
  // Sync with prop changes too
  useEffect(() => { if (props.teachers.length > 0) setTeachers(props.teachers); }, [props.teachers]);
  const [form, setForm] = useState({
    year_level: '', strand: '', track: '', section: '', adviser_id: null as number | null,
  });
  const [adviserDlg, setAdviserDlg] = useState(false);
  const [yearDlg,    setYearDlg]    = useState(false);
  const [strandDlg,  setStrandDlg]  = useState(false);
  const isSHS = SHS_LEVELS.includes(form.year_level);

  const YEAR_ITEMS   = YEAR_LEVELS.map((v, i) => ({ id: i + 1, label: v }));
  const STRAND_ITEMS = STRANDS.map((v, i) => ({ id: i + 1, label: v }));
  const selectedAdviser = teachers.find(t => t.id === form.adviser_id);

  const handleAdd = () => {
    if (!form.year_level || !form.section) return;
    onAdd({
      year_level: form.year_level, strand: form.strand || null,
      track: form.track || null, section: form.section,
      adviser_id: form.adviser_id,
      adviser_name: selectedAdviser?.name || null,
    });
    setForm({ year_level: '', strand: '', track: '', section: '', adviser_id: null });
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: theme.colors.primary.main, color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          ➕ Add Section &amp; Year Level
          <IconButton onClick={onClose} sx={{ color: '#fff' }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Box display="flex" gap={1} mb={2}>
            {/* Year Level picker */}
            <TextField label="Year Level" value={form.year_level} size="small"
              InputProps={{ readOnly: true, endAdornment:
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setYearDlg(true)}><ArrowDropDown /></IconButton>
                </InputAdornment>
              }}
              sx={{ flex: 1 }} placeholder="Select"
            />
            {/* Strand picker — only for SHS */}
            {isSHS && (
              <TextField label="Strand" value={form.strand} size="small"
                InputProps={{ readOnly: true, endAdornment:
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setStrandDlg(true)}><ArrowDropDown /></IconButton>
                  </InputAdornment>
                }}
                sx={{ flex: 1 }} placeholder="Select"
              />
            )}
            {isSHS && (
              <TextField label="Track" value={form.track} size="small"
                onChange={e => setForm(f => ({ ...f, track: e.target.value }))}
                sx={{ flex: 1 }} placeholder="e.g. ICT"
              />
            )}
          </Box>
          <Box display="flex" gap={1} mb={2}>
            <TextField label="Section *" value={form.section} size="small" sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, section: e.target.value }))} placeholder="e.g. IT3A3"
            />
          </Box>
          <TextField label="Adviser" value={selectedAdviser ? `${selectedAdviser.name} (${selectedAdviser.username})` : ''} size="small" fullWidth
            InputProps={{ readOnly: true, endAdornment:
              <InputAdornment position="end">
                <Button size="small" onClick={() => setAdviserDlg(true)}>Choose ▼</Button>
              </InputAdornment>
            }}
            placeholder="Select adviser"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!form.year_level || !form.section}>
            Add Section
          </Button>
        </DialogActions>
      </Dialog>

      <SelectionDialog open={yearDlg} title="Select Year Level"
        items={YEAR_ITEMS.map(i => ({ id: i.id, name: i.label, username: '' }))}
        selectedIds={[]} multiple={false}
        itemLabel={i => i.name} onClose={() => setYearDlg(false)}
        onConfirm={ids => { const v = YEAR_ITEMS.find(x => x.id === ids[0]); setForm(f => ({ ...f, year_level: v?.label || '' })); setYearDlg(false); }}
      />
      <SelectionDialog open={strandDlg} title="Select Strand"
        items={STRAND_ITEMS.map(i => ({ id: i.id, name: i.label, username: '' }))}
        selectedIds={[]} multiple={false}
        itemLabel={i => i.name} onClose={() => setStrandDlg(false)}
        onConfirm={ids => { const v = STRAND_ITEMS.find(x => x.id === ids[0]); setForm(f => ({ ...f, strand: v?.label || '' })); setStrandDlg(false); }}
      />
      <SelectionDialog open={adviserDlg} title="Choose Adviser"
        items={teachers} selectedIds={form.adviser_id ? [form.adviser_id] : []}
        multiple={false} itemLabel={t => `${t.name} (${t.username})`}
        searchPlaceholder="Search teachers…"
        onClose={() => setAdviserDlg(false)}
        onConfirm={ids => { setForm(f => ({ ...f, adviser_id: ids[0] || null })); setAdviserDlg(false); }}
      />
    </>
  );
}

// ─── ClassBlockCard ────────────────────────────────────────────────────
// Renders ONE class block: header row (Section + Year Level + Strand/Track) +
// Adviser row + Subject/Teacher/Students table
function ClassBlockCard(props: {
  block: ClassBlock;
  teachers: TeacherOpt[];
  students: StudentOpt[];
  onSaveRow: (blockKey: string, row: SubjectRow) => Promise<void>;
  onDeleteRow: (blockKey: string, rowId: number) => Promise<void>;
  onDeleteBlock: (blockKey: string) => void;
  onUpdateAdviser: (blockKey: string, adviserId: number | null, adviserName: string | null) => Promise<void>;
  onUpdateStudents: (blockKey: string, studentIds: number[]) => Promise<void>;
}) {
  const { block, onSaveRow, onDeleteRow, onDeleteBlock, onUpdateAdviser, onUpdateStudents } = props;
  const [teachers, setTeachers] = useState<TeacherOpt[]>(props.teachers);
  const [students, setStudents] = useState<StudentOpt[]>(props.students);

  const [loading, setLoadingState] = useState(true);

  useEffect(() => {
    api.get('/admin/assignments/metadata')
      .then(r => {
        setTeachers(r.data.teachers || []);
        setStudents(r.data.students || []);
        setLoadingState(false);
      })
      .catch(() => { setLoadingState(false); });
  }, []);

  useEffect(() => { if (props.teachers.length > 0) setTeachers(props.teachers); }, [props.teachers]);
  useEffect(() => { if (props.students.length > 0) setStudents(props.students); }, [props.students]);

  const [subjectDlg, setSubjectDlg] = useState<{open:boolean; rowIdx:number|null}>({ open:false, rowIdx:null });
  const [teacherDlg, setTeacherDlg] = useState<{open:boolean; rowIdx:number|null}>({ open:false, rowIdx:null });
  const [studentDlg, setStudentDlg] = useState(false);  // section-level
  const [adviserDlg, setAdviserDlg] = useState(false);
  const [rows,       setRows]       = useState<SubjectRow[]>(block.subjects);
  const [saving,     setSaving]     = useState<number|null>(null);
  const [error,      setError]      = useState('');

  const [lastSyncKey, setLastSyncKey] = useState(block.key);
  useEffect(() => {
    if (block.key !== lastSyncKey) {
      setRows(block.subjects);
      setLastSyncKey(block.key);
    } else if (block.subjects.length > 0 && rows.filter(r => !r._new).length === 0) {
      setRows(block.subjects);
    }
  }, [block.subjects, block.key]); // eslint-disable-line

  const isSHS = SHS_LEVELS.includes(block.year_level);

  const addRow = () => {
    setRows(prev => [...prev, {
      id: null, subject: '', session: 'AM',
      subject_teacher_id: null, subject_teacher_name: null,
      _new: true, _dirty: true,
    }]);
  };

  const updateRow = (idx: number, patch: Partial<SubjectRow>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch, _dirty: true } : r));
  };

  const saveRow = async (idx: number) => {
    const row = rows[idx];
    if (!row.subject) { setError('Subject is required'); return; }
    setSaving(idx);
    setError('');
    try {
      await onSaveRow(block.key, row);
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  const deleteRow = async (idx: number) => {
    const row = rows[idx];
    if (row._new) { setRows(prev => prev.filter((_, i) => i !== idx)); return; }
    if (!window.confirm('Delete this subject row?')) return;
    setSaving(idx);
    try {
      await onDeleteRow(block.key, row.id!);
      setRows(prev => prev.filter((_, i) => i !== idx));
    } finally {
      setSaving(null);
    }
  };

  const adviser        = teachers.find(t => t.id === block.adviser_id);
  const sectionStudents = students.filter(s => block.student_ids.includes(s.id));

  return (
    <Paper elevation={2} sx={{ mb: 3, borderRadius: 2, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
      {/* ── Header: Section + Year Level + Strand/Track ── */}
      <Box sx={{ p: 2, bgcolor: theme.colors.primary.main, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <Chip label={`☑ Section: ${block.section}`} size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700 }} />
          <Chip label={`☑ Year Level: ${block.year_level}`} size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700 }} />
          {isSHS && block.strand && (
            <Chip label={`Strand: ${block.strand}`} size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 600 }} />
          )}
          {isSHS && block.track && (
            <Chip label={`Track: ${block.track}`} size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 600 }} />
          )}
        </Box>
        <Tooltip title="Delete this entire class block">
          <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
            onClick={() => onDeleteBlock(block.key)}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Adviser row ── */}
      <Box sx={{ px: 2, py: 1.5, bgcolor: '#f0f4ff', borderBottom: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 60 }}>Adviser ☑</Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" sx={{ color: adviser ? '#1565c0' : '#999', fontStyle: adviser ? 'normal' : 'italic' }}>
            {adviser ? `${adviser.name} (${adviser.username})` : 'Not assigned'}
          </Typography>
          <Button size="small" variant="outlined" endIcon={<ArrowDropDown />}
            onClick={() => setAdviserDlg(true)} sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1 }}>
            {loading ? 'Loading...' : `Choose (${teachers.length})`}
          </Button>
        </Box>
      </Box>

      {/* ── Section-level student roster row ── */}
      <Box sx={{ px: 2, py: 1.5, bgcolor: '#f0fff4', borderBottom: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 60 }}>Students ☑</Typography>
        <Box display="flex" alignItems="center" gap={1} flex={1}>
          {sectionStudents.length > 0 ? (
            <Chip
              label={`${sectionStudents.length} student${sectionStudents.length !== 1 ? 's' : ''} in this section`}
              size="small" color="success"
              sx={{ fontWeight: 700 }}
            />
          ) : (
            <Typography variant="body2" sx={{ color: '#999', fontStyle: 'italic' }}>
              No students assigned yet
            </Typography>
          )}
          <Button size="small" variant="outlined" endIcon={<ArrowDropDown />}
            onClick={() => setStudentDlg(true)}
            sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1, ml: 1 }}>
            {loading ? 'Loading...' : `Choose (${students.length})`}
          </Button>
        </Box>
        <Typography variant="caption" sx={{ color: '#888' }}>
          All subjects in this section share the same student group
        </Typography>
      </Box>

      {/* ── Subject/Teacher table (no Students column) ── */}
      {error && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{error}</Alert>}
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell sx={{ fontWeight: 700, width: '35%' }}>
                Subjects ☑ {loading && <CircularProgress size={10} sx={{ ml: 0.5 }} />}
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: '15%' }}>
                Session
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: '35%' }}>
                Teachers ☑ {!loading && <span style={{ fontSize: '0.75rem', color: '#666' }}>({teachers.length})</span>}
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: '15%', textAlign: 'center' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3, color: '#999', fontStyle: 'italic' }}>
                  No subjects yet. Click "+ Add more slots" below.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row, idx) => {
              const rowTeacher = teachers.find(t => t.id === row.subject_teacher_id);
              const isSaving   = saving === idx;
              return (
                <TableRow key={idx} sx={{ bgcolor: row._dirty ? '#fffde7' : '#fff', '&:hover': { bgcolor: '#f5f5f5' } }}>
                  {/* Subject cell */}
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Box sx={{ flex: 1, color: row.subject ? '#1a1a1a' : '#999', fontStyle: row.subject ? 'normal' : 'italic', fontSize: '0.85rem' }}>
                        {row.subject || 'Select subject...'}
                      </Box>
                      <IconButton size="small" onClick={() => setSubjectDlg({ open: true, rowIdx: idx })}>
                        <ArrowDropDown fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                  {/* Session cell */}
                  <TableCell>
                    <Select
                      size="small"
                      value={row.session || 'AM'}
                      onChange={e => updateRow(idx, { session: e.target.value as 'AM' | 'PM' | 'BOTH' })}
                      sx={{ fontSize: '0.78rem', minWidth: 72 }}
                      renderValue={(v) => {
                        const opt = SESSION_OPTIONS.find(o => o.value === v);
                        return (
                          <Box sx={{
                            bgcolor: opt?.color || '#1565c0', color: '#fff', borderRadius: '4px',
                            px: 1, py: 0.2, fontSize: '0.72rem', fontWeight: 700, display: 'inline-block',
                          }}>
                            {v}
                          </Box>
                        );
                      }}
                    >
                      {SESSION_OPTIONS.map(opt => (
                        <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.82rem' }}>
                          <Box sx={{
                            bgcolor: opt.color, color: '#fff', borderRadius: '4px',
                            px: 1, py: 0.2, fontSize: '0.72rem', fontWeight: 700, mr: 1,
                            display: 'inline-block', minWidth: 36, textAlign: 'center',
                          }}>
                            {opt.value}
                          </Box>
                          {opt.value === 'AM'   && 'Morning only'}
                          {opt.value === 'PM'   && 'Afternoon only'}
                          {opt.value === 'BOTH' && 'Full day (Adviser)'}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  {/* Teacher cell */}
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Box sx={{ flex: 1, color: rowTeacher ? '#1a1a1a' : '#999', fontStyle: rowTeacher ? 'normal' : 'italic', fontSize: '0.8rem' }}>
                        {loading ? 'Loading...' : (rowTeacher ? rowTeacher.name : 'Select teacher...')}
                      </Box>
                      <IconButton size="small" disabled={loading} onClick={() => setTeacherDlg({ open: true, rowIdx: idx })}>
                        {loading ? <CircularProgress size={14} /> : <ArrowDropDown fontSize="small" />}
                      </IconButton>
                    </Box>
                  </TableCell>
                  {/* Actions */}
                  <TableCell align="center">
                    <Box display="flex" justifyContent="center" gap={0.5}>
                      <Tooltip title="Save row">
                        <span>
                          <IconButton size="small" color="success" disabled={isSaving || !row._dirty} onClick={() => saveRow(idx)}>
                            {isSaving ? <CircularProgress size={14} /> : <Save fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete row">
                        <IconButton size="small" color="error" onClick={() => deleteRow(idx)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {/* ── + Add more slots ── */}
      <Box sx={{ p: 1.5, borderTop: '1px dashed #e0e0e0', display: 'flex', gap: 2 }}>
        <Button size="small" startIcon={<Add />} onClick={addRow}
          sx={{ textTransform: 'none', color: theme.colors.primary.main, fontWeight: 600 }}>
          + Add more slots
        </Button>
      </Box>

      {/* ── Selection Dialogs ── */}
      {/* Subject */}
      <SelectionDialog open={subjectDlg.open} title="Choose Subject"
        items={SUBJECTS.map((s, i) => ({ id: i, name: s, username: '' }))}
        selectedIds={subjectDlg.rowIdx !== null && rows[subjectDlg.rowIdx]?.subject
          ? [SUBJECTS.indexOf(rows[subjectDlg.rowIdx].subject)] : []}
        multiple={false} itemLabel={i => i.name}
        onClose={() => setSubjectDlg({ open: false, rowIdx: null })}
        onConfirm={ids => {
          if (subjectDlg.rowIdx !== null) updateRow(subjectDlg.rowIdx, { subject: SUBJECTS[ids[0]] || '' });
          setSubjectDlg({ open: false, rowIdx: null });
        }}
      />
      {/* Teacher */}
      <SelectionDialog open={teacherDlg.open} title="Choose Teacher"
        items={teachers}
        selectedIds={teacherDlg.rowIdx !== null && rows[teacherDlg.rowIdx]?.subject_teacher_id
          ? [rows[teacherDlg.rowIdx].subject_teacher_id!] : []}
        multiple={false} itemLabel={t => `${t.name} (${t.username})`}
        searchPlaceholder="Search teachers…"
        onClose={() => setTeacherDlg({ open: false, rowIdx: null })}
        onConfirm={ids => {
          if (teacherDlg.rowIdx !== null) {
            const t = teachers.find(x => x.id === ids[0]);
            updateRow(teacherDlg.rowIdx, { subject_teacher_id: ids[0] || null, subject_teacher_name: t?.name || null });
          }
          setTeacherDlg({ open: false, rowIdx: null });
        }}
      />
      {/* Section-level Students — multiple + Select All */}
      <SelectionDialog open={studentDlg} title={`Select Students for ${block.section}`}
        items={students}
        selectedIds={block.student_ids}
        multiple showSelectAll
        itemLabel={s => `${s.name} (${s.lrn})${s.grade ? ` — ${s.grade}` : ''}${s.section ? ` ${s.section}` : ''}`}
        searchPlaceholder="Search students by name or LRN…"
        onClose={() => setStudentDlg(false)}
        onConfirm={async ids => {
          await onUpdateStudents(block.key, ids);
          setStudentDlg(false);
        }}
      />
      {/* Adviser */}
      <SelectionDialog open={adviserDlg} title="Choose Adviser"
        items={teachers} selectedIds={block.adviser_id ? [block.adviser_id] : []}
        multiple={false} itemLabel={t => `${t.name} (${t.username})`}
        searchPlaceholder="Search teachers…"
        onClose={() => setAdviserDlg(false)}
        onConfirm={async ids => {
          const t = teachers.find(x => x.id === ids[0]);
          await onUpdateAdviser(block.key, ids[0] || null, t?.name || null);
          setAdviserDlg(false);
        }}
      />
    </Paper>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────
function AssignmentsPage() {
  const [blocks,    setBlocks]    = useState<ClassBlock[]>([]);
  const [teachers,  setTeachers]  = useState<TeacherOpt[]>([]);
  const [students,  setStudents]  = useState<StudentOpt[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [addDlg,    setAddDlg]    = useState(false);
  const [snack,     setSnack]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: flat }, { data: meta }] = await Promise.all([
        api.get('/admin/assignments'),
        api.get('/admin/assignments/metadata'),
      ]);
      setTeachers(meta.teachers || []);
      setStudents(meta.students || []);

      // Build section groups from flat list
      const groups: Record<string, ClassBlock> = {};
      for (const row of flat as any[]) {
        const key = `${row.year_level}|${row.strand||''}|${row.track||''}|${row.section}`;
        if (!groups[key]) {
          groups[key] = {
            key, year_level: row.year_level,
            strand: row.strand || null, track: row.track || null,
            section: row.section,
            adviser_id: row.teacher_id || null,
            adviser_name: row.adviser_name || null,
            student_ids: [],
            subjects: [],
          };
        }
        groups[key].subjects.push({
          id: row.id, subject: row.subject,
          session: (row.session as 'AM' | 'PM' | 'BOTH') || 'AM',
          subject_teacher_id: row.subject_teacher_id || null,
          subject_teacher_name: row.subject_teacher_name || null,
        });
      }

      // Try to get student_ids per assignment from grouped endpoint (if available)
      try {
        const { data: grouped } = await api.get('/admin/assignments/grouped');
        // grouped has student_ids — merge them at section level (union of all assignment rows)
        const groupedBlocks = grouped as any[];
        const mergedBlocks: ClassBlock[] = groupedBlocks.map((b: any) => {
          // Collect all unique student_ids across all subject rows in this section
          const allStudentIds = new Set<number>();
          (b.subjects || []).forEach((s: any) => {
            (s.student_ids || []).forEach((id: number) => allStudentIds.add(id));
          });
          return {
            key: b.key || `${b.year_level}|${b.strand||''}|${b.track||''}|${b.section}`,
            year_level:   b.year_level,
            strand:       b.strand || null,
            track:        b.track  || null,
            section:      b.section,
            adviser_id:   b.adviser_id || null,
            adviser_name: b.adviser_name || null,
            student_ids:  Array.from(allStudentIds),
            subjects:     (b.subjects || []).map((s: any) => ({
              id:                   s.id,
              subject:              s.subject,
              session:              (s.session as 'AM' | 'PM' | 'BOTH') || 'AM',
              subject_teacher_id:   s.subject_teacher_id || null,
              subject_teacher_name: s.subject_teacher_name || null,
            })),
          };
        });
        setBlocks(mergedBlocks);
      } catch {
        setBlocks(Object.values(groups));
      }
    } catch (e) {
      console.error('Failed to load assignments', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Add a new unsaved block (no DB call yet — rows are saved individually)
  const handleAddBlock = (partial: Omit<ClassBlock, 'key' | 'subjects' | '_editing'>) => {
    const key = `${partial.year_level}|${partial.strand||''}|${partial.track||''}|${partial.section}`;
    if (blocks.find(b => b.key === key)) { setSnack('This section block already exists'); return; }
    setBlocks(prev => [...prev, { ...partial, key, student_ids: [], subjects: [], _editing: true }]);
  };

  // Save a single subject row (create or update) — no per-row students
  const handleSaveRow = async (blockKey: string, row: SubjectRow) => {
    const block = blocks.find(b => b.key === blockKey);
    if (!block) return;
    // Use section-level student_ids for the row
    const studentIds = block.student_ids;
    if (row._new || !row.id) {
      const { data } = await api.post('/admin/assignments', {
        year_level: block.year_level,
        strand: block.strand,
        track: block.track,
        section: block.section,
        subject: row.subject,
        session: row.session || 'AM',
        teacher_id: block.adviser_id,
        subject_teacher_id: row.subject_teacher_id,
        student_ids: studentIds,
      });
      setBlocks(prev => prev.map(b => b.key !== blockKey ? b : {
        ...b,
        subjects: b.subjects.map(s =>
          s.subject === row.subject && s._new
            ? { ...s, id: data.id, _new: false, _dirty: false }
            : s
        ),
      }));
    } else {
      await api.put(`/admin/assignments/${row.id}`, {
        year_level: block.year_level,
        strand: block.strand,
        track: block.track,
        section: block.section,
        subject: row.subject,
        session: row.session || 'AM',
        teacher_id: block.adviser_id,
        subject_teacher_id: row.subject_teacher_id,
        student_ids: studentIds,
      });
      setBlocks(prev => prev.map(b => b.key !== blockKey ? b : {
        ...b,
        subjects: b.subjects.map(s => s.id === row.id ? { ...s, _dirty: false } : s),
      }));
    }
    setSnack('Saved successfully');
  };

  // Update section-level student roster — syncs to ALL subject rows in this section
  const handleUpdateStudents = async (blockKey: string, studentIds: number[]) => {
    const block = blocks.find(b => b.key === blockKey);
    if (!block) return;
    // Update local state immediately
    setBlocks(prev => prev.map(b => b.key !== blockKey ? b : { ...b, student_ids: studentIds }));
    // Persist to DB if there are saved rows
    if (block.subjects.some(s => s.id)) {
      await api.patch('/admin/assignments/section-students', {
        year_level:  block.year_level,
        strand:      block.strand,
        track:       block.track,
        section:     block.section,
        student_ids: studentIds,
      });
      setSnack(`Student roster updated — ${studentIds.length} students assigned to all subjects in ${block.section}`);
    }
  };

  // Delete a single subject row
  const handleDeleteRow = async (blockKey: string, rowId: number) => {
    await api.delete(`/admin/assignments/${rowId}`);
    // Update local state directly instead of calling load()
    setBlocks(prev => prev.map(b => b.key !== blockKey ? b : {
      ...b, subjects: b.subjects.filter(s => s.id !== rowId),
    }));
  };

  // Delete all rows in a block
  const handleDeleteBlock = async (blockKey: string) => {
    const block = blocks.find(b => b.key === blockKey);
    if (!block) return;
    const hasDB = block.subjects.some(s => s.id);
    if (hasDB && !window.confirm(`Delete all assignments in section ${block.section}?`)) return;
    for (const row of block.subjects) {
      if (row.id) await api.delete(`/admin/assignments/${row.id}`);
    }
    setBlocks(prev => prev.filter(b => b.key !== blockKey));
  };

  // Update adviser for all rows in this block
  const handleUpdateAdviser = async (blockKey: string, adviserId: number | null, adviserName: string | null) => {
    const block = blocks.find(b => b.key === blockKey);
    if (!block) return;
    setBlocks(prev => prev.map(b => b.key !== blockKey ? b : { ...b, adviser_id: adviserId, adviser_name: adviserName }));
    if (block.subjects.some(s => s.id)) {
      await api.patch('/admin/assignments/section-adviser', {
        year_level: block.year_level,
        strand: block.strand,
        track: block.track,
        section: block.section,
        adviser_id: adviserId,
      });
    }
  };

  return (
    <Box>
      {/* Page header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={800} color={theme.colors.primary.main}>
            Class Assignment Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage Year Level / Strand / Track / Section assignments, advisers, subjects, and student groups.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setAddDlg(true)}
          sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>
          ➕ Add section &amp; year level
        </Button>
      </Box>

      {/* Snack */}
      {snack && (
        <Alert severity="success" onClose={() => setSnack('')} sx={{ mb: 2 }}>{snack}</Alert>
      )}

      {loading ? (
        <Box textAlign="center" py={8}><CircularProgress /></Box>
      ) : blocks.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', color: '#999' }}>
          <Typography variant="h6">No class assignments yet.</Typography>
          <Typography variant="body2">Click "+ Add section &amp; year level" to create your first class block.</Typography>
        </Paper>
      ) : (
        blocks.map(block => (
          <ClassBlockCard
            key={block.key}
            block={block}
            teachers={teachers}
            students={students}
            onSaveRow={handleSaveRow}
            onDeleteRow={handleDeleteRow}
            onDeleteBlock={handleDeleteBlock}
            onUpdateAdviser={handleUpdateAdviser}
            onUpdateStudents={handleUpdateStudents}
          />
        ))
      )}

      <AddSectionDialog
        open={addDlg}
        teachers={teachers}
        onClose={() => setAddDlg(false)}
        onAdd={handleAddBlock}
      />
    </Box>
  );
}

export default AssignmentsPage;
