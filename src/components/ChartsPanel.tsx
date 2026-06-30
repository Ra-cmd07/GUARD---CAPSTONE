import React, { useMemo } from 'react';
import { Paper, Box, Typography, Grid } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type Point = { date: string; value: number };

export default function ChartsPanel({ trend }: { trend?: Point[] }) {
  // Generate sample data if none provided (fallback only)
  const sampleData = useMemo(() => {
    const last7days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7days.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.floor(Math.random() * 30) + 70,
      });
    }
    return last7days;
  }, []);

  const data = (trend && trend.length > 0) ? trend : sampleData;
  const hasRealData = trend && trend.length > 0;

  const avgAttendance = Math.round(data.reduce((a, b) => a + b.value, 0) / data.length);
  const highestDay = Math.max(...data.map(d => d.value));
  const lowestDay = Math.min(...data.map(d => d.value));

  return (
    <Grid container spacing={2.5}>
      {/* Trend Chart */}
      <Grid item xs={12} md={8}>
        <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography fontWeight={700}>Attendance Trend</Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" color={hasRealData ? 'success.main' : 'text.secondary'}>
                {hasRealData ? '✓ Live Data' : 'Sample Data'}
              </Typography>
              <Typography variant="caption" color="text.secondary">Last {data.length} days</Typography>
            </Box>
          </Box>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" style={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip formatter={(value: any) => `${value}%`} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Grid>

      {/* Summary Stats */}
      <Grid item xs={12} md={4}>
        <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography fontWeight={700} mb={2}>Summary</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ p: 1.5, bgcolor: '#f0f9ff', borderRadius: 1, borderLeft: '4px solid #3b82f6' }}>
              <Typography variant="caption" color="text.secondary">Average Attendance</Typography>
              <Typography variant="h5" fontWeight={700} color="#3b82f6">
                {avgAttendance}%
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: 1, borderLeft: '4px solid #2e7d32' }}>
              <Typography variant="caption" color="text.secondary">Highest Day</Typography>
              <Typography variant="h5" fontWeight={700} color="#2e7d32">
                {highestDay}%
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, bgcolor: '#fef3c7', borderRadius: 1, borderLeft: '4px solid #f59e0b' }}>
              <Typography variant="caption" color="text.secondary">Lowest Day</Typography>
              <Typography variant="h5" fontWeight={700} color="#f59e0b">
                {lowestDay}%
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Grid>

      {!hasRealData && (
        <Grid item xs={12}>
          <Paper elevation={1} sx={{ p: 2, bgcolor: '#eff6ff', borderRadius: 1, border: '1px solid #bfdbfe' }}>
            <Typography variant="body2" color="#1e40af" fontWeight={500}>
              ℹ️ Showing sample data. The dashboard will display real attendance data as soon as students scan in.
            </Typography>
          </Paper>
        </Grid>
      )}
    </Grid>
  );
}
