import { useState } from 'react';
import {
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, CircularProgress,
  Typography, Select, MenuItem, Tooltip,
} from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';
import { format } from 'date-fns';
import type { AttendanceRecord, AttendanceStatus } from '../../types/index.tsx';

const STATUS_COLORS: Record<AttendanceStatus, 'success' | 'info' | 'warning' | 'error'> = {
  'Time-In':  'success',
  'Time-Out': 'info',
  'Late':     'warning',
  'Absent':   'error',
};

interface Props {
  rows:           AttendanceRecord[];
  loading:        boolean;
  onDelete:       (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
}

export default function AttendanceTable({ rows, loading, onDelete, onStatusChange }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>LRN</TableCell>
            <TableCell>Student Name</TableCell>
            <TableCell>Gender</TableCell>
            <TableCell>Teacher</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Time</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                <CircularProgress size={32} color="primary" />
              </TableCell>
            </TableRow>
          )}

          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                <Typography fontSize="3rem">📱</Typography>
                <Typography color="text.secondary" fontWeight={600}>
                  No attendance records yet today
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enable the scanner and scan QR codes to start
                </Typography>
              </TableCell>
            </TableRow>
          )}

          {rows.map(row => (
            <TableRow key={row.id} hover>
              <TableCell sx={{ fontFamily: 'monospace' }}>{row.lrn || '—'}</TableCell>
              <TableCell><b>{row.student_name}</b></TableCell>
              <TableCell>
                <Chip
                  label={row.gender === 'M' ? '♂ Male' : '♀ Female'}
                  size="small"
                  sx={{
                    bgcolor: row.gender === 'M' ? '#4A90E2' : '#E94B9E',
                    color: '#fff', fontWeight: 600,
                  }}
                />
              </TableCell>
              <TableCell>{row.by_whom || row.guardian_name || '—'}</TableCell>
              <TableCell>
                {editingId === row.id ? (
                  <Select
                    size="small"
                    value={row.status}
                    autoFocus
                    onBlur={() => setEditingId(null)}
                    onChange={e => {
                      onStatusChange(row.id, e.target.value);
                      setEditingId(null);
                    }}
                    sx={{ minWidth: 110 }}
                  >
                    {['Time-In','Time-Out','Late','Absent'].map(s => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                ) : (
                  <Chip
                    label={row.status}
                    color={STATUS_COLORS[row.status] || 'default'}
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                )}
              </TableCell>
              <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                {row.timestamp
                  ? format(new Date(row.timestamp), 'hh:mm:ss aa')
                  : '—'}
              </TableCell>
              <TableCell align="center">
                <Tooltip title="Edit status">
                  <IconButton size="small" color="warning"
                    onClick={() => setEditingId(row.id)}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove record">
                  <IconButton size="small" color="error"
                    onClick={() => {
                      if (confirm(`Remove record for ${row.student_name}?`)) {
                        onDelete(row.id);
                      }
                    }}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}