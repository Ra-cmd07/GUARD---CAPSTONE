import { useState, useEffect, useCallback } from 'react';
import {
  IconButton, Badge, Popover, Box, Typography, Divider,
  Button, List, ListItem, ListItemText, Chip, CircularProgress,
} from '@mui/material';
import {
  Notifications as BellIcon,
  NotificationsNone as BellEmptyIcon,
  DoneAll,
  Info,
  Warning,
  ErrorOutline,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/client';
import theme from '../theme/professionalTheme';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
  is_read: boolean;
  link: string | null;
  created_at: string;
}

// ─── Type icon & colour helpers ───────────────────────────────────────
function typeIcon(type: Notification['type']) {
  if (type === 'warning') return <Warning sx={{ fontSize: 18, color: '#e65100' }} />;
  if (type === 'alert')   return <ErrorOutline sx={{ fontSize: 18, color: '#c62828' }} />;
  return <Info sx={{ fontSize: 18, color: '#1565c0' }} />;
}

function typeBg(type: Notification['type']) {
  if (type === 'warning') return '#fff3e0';
  if (type === 'alert')   return '#ffebee';
  return '#e3f2fd';
}

// ─── NotificationBell ─────────────────────────────────────────────────
interface Props {
  /** Override icon colour — defaults to white (for dark headers) */
  iconColor?: string;
}

export default function NotificationBell({ iconColor = '#fff' }: Props) {
  const [anchorEl,     setAnchorEl]     = useState<HTMLButtonElement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [loading,      setLoading]      = useState(false);

  const open = Boolean(anchorEl);

  // ── Fetch from backend ──────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Silently fail — bell just shows 0
    }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // ── Mark one as read ────────────────────────────────────────────────
  const markOne = async (n: Notification) => {
    if (!n.is_read) {
      await api.patch(`/notifications/${n.id}/read`);
      setNotifications(prev =>
        prev.map(x => x.id === n.id ? { ...x, is_read: true } : x)
      );
      setUnreadCount(c => Math.max(0, c - 1));
    }
    if (n.link) window.location.href = n.link;
  };

  // ── Mark all as read ────────────────────────────────────────────────
  const markAll = async () => {
    setLoading(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(x => ({ ...x, is_read: true })));
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Bell Button ── */}
      <IconButton onClick={e => setAnchorEl(e.currentTarget)} size="small">
        <Badge
          badgeContent={unreadCount}
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              bgcolor: '#ef4444',
              color: '#fff',
              fontSize: '0.65rem',
              minWidth: 18,
              height: 18,
            },
          }}
        >
          {unreadCount > 0
            ? <BellIcon sx={{ color: iconColor, fontSize: 24 }} />
            : <BellEmptyIcon sx={{ color: iconColor, fontSize: 24, opacity: 0.85 }} />
          }
        </Badge>
      </IconButton>

      {/* ── Popover ── */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: { xs: '95vw', sm: 380 },
            maxHeight: 520,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #e0e0e0',
          bgcolor: '#f8faff',
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a2e' }}>
            🔔 Notifications
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} new`}
                size="small"
                sx={{ ml: 1, bgcolor: '#ef4444', color: '#fff', fontSize: '0.7rem', height: 20 }}
              />
            )}
          </Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={loading ? <CircularProgress size={12} /> : <DoneAll sx={{ fontSize: 14 }} />}
              onClick={markAll}
              disabled={loading}
              sx={{ fontSize: '0.75rem', textTransform: 'none', color: theme.colors.primary.main }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        {/* List */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <BellEmptyIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No notifications yet
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((n, i) => (
                <Box key={n.id}>
                  <ListItem
                    alignItems="flex-start"
                    onClick={() => markOne(n)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: n.is_read ? '#fff' : typeBg(n.type),
                      px: 2, py: 1.5,
                      '&:hover': { filter: 'brightness(0.97)' },
                      borderLeft: n.is_read ? 'none' : `4px solid ${
                        n.type === 'alert' ? '#c62828' :
                        n.type === 'warning' ? '#e65100' : '#1565c0'
                      }`,
                    }}
                  >
                    <Box sx={{ mr: 1.5, mt: 0.25 }}>{typeIcon(n.type)}</Box>
                    <ListItemText
                      primary={
                        <Typography sx={{
                          fontWeight: n.is_read ? 500 : 700,
                          fontSize: '0.85rem',
                          color: '#1a1a2e',
                          lineHeight: 1.3,
                        }}>
                          {n.title}
                        </Typography>
                      }
                      secondary={
                        <>
                          <Typography
                            component="span"
                            sx={{ fontSize: '0.78rem', color: '#555', display: 'block', mt: 0.25 }}
                          >
                            {n.message}
                          </Typography>
                          <Typography
                            component="span"
                            sx={{ fontSize: '0.7rem', color: '#999', display: 'block', mt: 0.5 }}
                          >
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </Typography>
                        </>
                      }
                    />
                    {!n.is_read && (
                      <Box sx={{
                        width: 8, height: 8, borderRadius: '50%',
                        bgcolor: n.type === 'alert' ? '#c62828' :
                                 n.type === 'warning' ? '#e65100' : '#1565c0',
                        mt: 0.75, ml: 1, flexShrink: 0,
                      }} />
                    )}
                  </ListItem>
                  {i < notifications.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}
