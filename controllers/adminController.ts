import { Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../lib/db';
import { AuthRequest } from '../middleware/authMiddleware';

// ─── GET /api/admin/dashboard ─────────────────────────────────────────
export async function getDashboardStats(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [[stats]] = await pool.execute('SELECT * FROM v_dashboard_stats') as any[];

    const [recentLogs] = await pool.execute(
      `SELECT a.id, a.student_name, a.grade, a.section, a.timestamp,
              a.scan_method, a.status, a.photo_path
       FROM attendance a
       ORDER BY a.timestamp DESC
       LIMIT 20`
    ) as any[];

    const [activeKiosks] = await pool.execute(
      `SELECT id, name, location, gate, is_active, last_ping
       FROM kiosks WHERE is_active = 1`
    ) as any[];

    res.json({ stats, recentLogs, activeKiosks });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /api/admin/users ─────────────────────────────────────────────
export async function getUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const role = req.query.role as string | undefined;
    let query = `
      SELECT u.id, u.username, u.is_active, r.name AS role,
             u.created_at, u.updated_at
      FROM users u JOIN roles r ON r.id = u.role_id
    `;
    const params: any[] = [];
    if (role) { query += ' WHERE r.name = ?'; params.push(role); }
    query += ' ORDER BY u.created_at DESC';

    const [rows] = await pool.execute(query, params) as any[];
    res.json(rows);
  } catch (err) {
    console.error('getUsers error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /api/admin/users/:id ─────────────────────────────────────────
export async function getUserById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.is_active, r.name AS role, u.created_at
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
      [id]
    ) as any[];
    const user = (rows as any[])[0];
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    let profile: any = null;
    if (user.role === 'teacher') {
      const [t] = await pool.execute('SELECT * FROM teachers WHERE user_id = ?', [id]) as any[];
      profile = (t as any[])[0] || null;
    } else if (user.role === 'parent') {
      const [p] = await pool.execute('SELECT * FROM parents WHERE user_id = ?', [id]) as any[];
      profile = (p as any[])[0] || null;
      if (profile) {
        const [children] = await pool.execute(
          `SELECT s.* FROM students s
           JOIN parent_student ps ON ps.student_id = s.id
           WHERE ps.parent_id = ?`, [profile.id]
        ) as any[];
        profile.children = children;
      }
    } else if (user.role === 'student') {
      const [s] = await pool.execute('SELECT * FROM students WHERE user_id = ?', [id]) as any[];
      profile = (s as any[])[0] || null;
    }

    res.json({ ...user, profile });
  } catch (err) {
    console.error('getUserById error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── POST /api/admin/users ────────────────────────────────────────────
export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const {
      username, password, role,
      name, age, gender, section, contact, address,
      subject, room, schedule, relationship, employee_id,
      lrn, grade, mac_address, rfid_uid,
    } = req.body;

    if (!username || !password || !role || !name) {
      res.status(400).json({ error: 'username, password, role, and name are required' });
      return;
    }

    const [existCheck] = await conn.execute('SELECT id FROM users WHERE username = ?', [username]) as any[];
    if ((existCheck as any[]).length > 0) {
      res.status(400).json({ error: 'Username already taken' });
      return;
    }

    const [roleRows] = await conn.execute('SELECT id FROM roles WHERE name = ?', [role]) as any[];
    const roleId = (roleRows as any[])[0]?.id;
    if (!roleId) { res.status(400).json({ error: 'Invalid role' }); return; }

    const hashed = await bcrypt.hash(password, 10);
    const [ur] = await conn.execute(
      'INSERT INTO users (username, password, role_id, created_by) VALUES (?, ?, ?, ?)',
      [username, hashed, roleId, req.user!.id]
    ) as any[];
    const userId = (ur as any).insertId;

    let profileId: number | null = null;

    if (role === 'teacher') {
      const [tr] = await conn.execute(
        `INSERT INTO teachers (user_id, name, employee_id, age, gender, section, subject, room, schedule, contact, address, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, employee_id || null, age || null, gender || null,
         section || null, subject || null, room || null, schedule || null,
         contact || null, address || null, req.user!.id]
      ) as any[];
      profileId = (tr as any).insertId;
    } else if (role === 'parent') {
      const [pr] = await conn.execute(
        'INSERT INTO parents (user_id, name, relationship, contact, address, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, name, relationship || null, contact || null, address || null, req.user!.id]
      ) as any[];
      profileId = (pr as any).insertId;
    } else if (role === 'student') {
      if (!lrn) { res.status(400).json({ error: 'LRN is required for students' }); return; }
      const [sr] = await conn.execute(
        `INSERT INTO students (user_id, lrn, name, gender, grade, section, mac_address, rfid_uid, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, lrn, name,
         gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : (gender || null),
         grade || null, section || null, mac_address || null, rfid_uid || null, req.user!.id]
      ) as any[];
      profileId = (sr as any).insertId;
    }

    await conn.commit();
    res.status(201).json({ message: 'User created', userId, profileId });
  } catch (err: any) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Duplicate entry (LRN or username already exists)' });
      return;
    }
    console.error('createUser error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

// ─── PUT /api/admin/users/:id ─────────────────────────────────────────
export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const {
      name, age, gender, section, contact, address,
      subject, room, schedule, relationship, employee_id,
      lrn, grade, mac_address, rfid_uid, is_active,
    } = req.body;

    const [rows] = await conn.execute(
      `SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`, [id]
    ) as any[];
    const user = (rows as any[])[0];
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (is_active !== undefined) {
      await conn.execute(
        'UPDATE users SET is_active = ?, updated_by = ? WHERE id = ?',
        [is_active ? 1 : 0, req.user!.id, id]
      );
    }

    if (user.role === 'teacher') {
      await conn.execute(
        `UPDATE teachers SET name=?, employee_id=?, age=?, gender=?, section=?, subject=?, room=?, schedule=?, contact=?, address=?, updated_by=?
         WHERE user_id=?`,
        [name, employee_id || null, age || null, gender || null, section || null,
         subject || null, room || null, schedule || null, contact || null, address || null,
         req.user!.id, id]
      );
    } else if (user.role === 'parent') {
      await conn.execute(
        'UPDATE parents SET name=?, relationship=?, contact=?, address=?, updated_by=? WHERE user_id=?',
        [name, relationship || null, contact || null, address || null, req.user!.id, id]
      );
    } else if (user.role === 'student') {
      await conn.execute(
        `UPDATE students SET name=?, lrn=?, gender=?, grade=?, section=?, mac_address=?, rfid_uid=?, updated_by=?
         WHERE user_id=?`,
        [name, lrn || null,
         gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : (gender || null),
         grade || null, section || null, mac_address || null, rfid_uid || null,
         req.user!.id, id]
      );
    }

    await conn.commit();
    res.json({ message: 'User updated' });
  } catch (err) {
    await conn.rollback();
    console.error('updateUser error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

// ─── POST /api/admin/users/:id/reset-password ─────────────────────────
export async function resetPassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id }          = req.params;
    const { newPassword } = req.body;
    if (!newPassword) { res.status(400).json({ error: 'newPassword is required' }); return; }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE users SET password = ?, updated_by = ? WHERE id = ?',
      [hashed, req.user!.id, id]
    );
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── PATCH /api/admin/users/:id/toggle-status ─────────────────────────
export async function toggleUserStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await pool.execute(
      'UPDATE users SET is_active = NOT is_active, updated_by = ? WHERE id = ?',
      [req.user!.id, id]
    );
    const [rows] = await pool.execute('SELECT is_active FROM users WHERE id = ?', [id]) as any[];
    const active = (rows as any[])[0]?.is_active;
    res.json({ message: `User ${active ? 'activated' : 'deactivated'}`, is_active: active });
  } catch (err) {
    console.error('toggleUserStatus error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /api/admin/kiosks ────────────────────────────────────────────
export async function getKiosks(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute('SELECT * FROM kiosks ORDER BY name') as any[];
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── POST /api/admin/kiosks ───────────────────────────────────────────
export async function createKiosk(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, location, gate, ip_address } = req.body;
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }
    const [r] = await pool.execute(
      'INSERT INTO kiosks (name, location, gate, ip_address, created_by) VALUES (?, ?, ?, ?, ?)',
      [name, location || null, gate || null, ip_address || null, req.user!.id]
    ) as any[];
    res.status(201).json({ id: (r as any).insertId, message: 'Kiosk created' });
  } catch (err) {
    console.error('createKiosk error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── PUT /api/admin/kiosks/:id ────────────────────────────────────────
export async function updateKiosk(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, location, gate, ip_address, is_active } = req.body;
    await pool.execute(
      'UPDATE kiosks SET name=?, location=?, gate=?, ip_address=?, is_active=?, updated_by=? WHERE id=?',
      [name, location || null, gate || null, ip_address || null,
       is_active !== undefined ? (is_active ? 1 : 0) : 1, req.user!.id, id]
    );
    res.json({ message: 'Kiosk updated' });
  } catch (err) {
    console.error('updateKiosk error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /api/admin/sms-logs ──────────────────────────────────────────
export async function getSmsLogs(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 200'
    ) as any[];
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── GET /api/admin/login-logs ────────────────────────────────────────
export async function getLoginLogs(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM login_logs ORDER BY logged_at DESC LIMIT 200'
    ) as any[];
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── DELETE /api/admin/sms-logs/clear ─────────────────────────────────
export async function clearSmsLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    console.log(`🗑️  Admin ${req.user?.username} clearing SMS history...`);
    
    // Count before deletion
    const [countBefore] = await pool.execute('SELECT COUNT(*) as total FROM sms_logs') as any[];
    const totalBefore = (countBefore as any[])[0].total;
    
    // Delete all SMS logs
    const [result] = await pool.execute('DELETE FROM sms_logs') as any[];
    
    console.log(`✅ Deleted ${(result as any).affectedRows} SMS log records`);
    
    res.json({
      success: true,
      message: 'SMS history cleared successfully',
      deletedCount: (result as any).affectedRows,
      previousCount: totalBefore
    });
  } catch (err) {
    console.error('clearSmsLogs error:', err);
    res.status(500).json({ error: 'Failed to clear SMS history' });
  }
}
