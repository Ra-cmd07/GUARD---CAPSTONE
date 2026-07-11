import { Grid, Paper, Typography } from '@mui/material';
import type { AttendanceRecord } from '../../types/index';

interface Props { rows: AttendanceRecord[]; }

const CARDS = [
  { key: 'Time-In',  label: 'Time-In',  color: '#28a745', icon: '🌅' },
  { key: 'Time-Out', label: 'Time-Out', color: '#17a2b8', icon: '🌇' },
  { key: 'Late',     label: 'Late',     color: '#ff9800', icon: '⏰' },
  { key: 'Absent',   label: 'Absent',   color: '#dc3545', icon: '❌' },
] as const;

export default function CounterCards({ rows }: Props) {
  const count = (status: string) => rows.filter(r => r.status === status).length;

  return (
    <Grid container spacing={2}>
      {CARDS.map(c => (
        <Grid size={{ xs: 6, sm: 3 }} key={c.key}>
          <Paper elevation={3} sx={{
            p: 2.5, textAlign: 'center', borderRadius: 2,
            borderTop: `4px solid ${c.color}`,
            transition: 'transform 0.2s',
            '&:hover': { transform: 'translateY(-2px)' },
          }}>
            <Typography fontSize="1.8rem">{c.icon}</Typography>
            <Typography variant="h3" fontWeight={800} color={c.color}>
              {count(c.key)}
            </Typography>
            <Typography variant="caption" fontWeight={700}
              textTransform="uppercase" color="text.secondary" letterSpacing={0.5}>
              {c.label}
            </Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}