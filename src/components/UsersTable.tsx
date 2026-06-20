import React, { useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, IconButton, Chip, Tooltip, TablePagination
} from '@mui/material';
import { PersonAdd, ToggleOn, ToggleOff, LockReset } from '@mui/icons-material';

type Props = {
  users: any[];
  onAddUser?: () => void;
  onToggleStatus: (id: number) => void;
  onResetPassword: (id: number) => void;
};

export default function UsersTable({ users, onAddUser, onToggleStatus, onResetPassword }: Props) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => (
      String(u.username || '').toLowerCase().includes(q) ||
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.role || '').toLowerCase().includes(q)
    ));
  }, [users, query]);

  const handleChangePage = (_: any, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (e: any) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); };

  return (
    <Paper elevation={2} sx={{ borderRadius: 2 }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Box display="flex" gap={2} alignItems="center">
          <Typography fontWeight={700}>Users</Typography>
          <TextField size="small" placeholder="Search username, name or role" value={query} onChange={e => setQuery(e.target.value)} />
        </Box>
        <Box>
          <Button variant="contained" startIcon={<PersonAdd />} onClick={onAddUser}>Add User</Button>
        </Box>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No users found</TableCell></TableRow>
            )}
            {filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(u => (
              <TableRow key={u.id} hover>
                <TableCell><b>{u.username}</b></TableCell>
                <TableCell>
                  <Chip label={u.role} size="small" color={u.role === 'admin' ? 'error' : u.role === 'teacher' ? 'primary' : u.role === 'parent' ? 'warning' : 'default'} />
                </TableCell>
                <TableCell>
                  <Chip label={u.is_active ? 'Active' : 'Inactive'} size="small" color={u.is_active ? 'success' : 'default'} />
                </TableCell>
                <TableCell>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</TableCell>
                <TableCell align="center">
                  <Tooltip title={u.is_active ? 'Deactivate' : 'Activate'}>
                    <IconButton size="small" color={u.is_active ? 'error' : 'success'} onClick={() => onToggleStatus(u.id)}>
                      {u.is_active ? <ToggleOff /> : <ToggleOn />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reset Password">
                    <IconButton size="small" color="warning" onClick={() => onResetPassword(u.id)}>
                      <LockReset />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5,10,25]}
      />
    </Paper>
  );
}
