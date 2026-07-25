import { Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../lib/db';
import { AuthRequest } from '../middleware/authMiddleware';

// ─── GET /api/admin/dashboard ─────────────────────────────────────────
export async function getDashboardStats(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [[stats]] = await pool.execute('SELECT * FROM v_dashboard_stats') as any[];

    const [recentLogs] = await pool.execute(
      `SELECT 
        a.id, 
        a.student_name, 
        a.grade, 
        a.section_id,
        sec.name AS section_name,
        a.timestamp,
        a.scan_method, 
        a.status, 
        a.photo_path,
        a.student_id
       FROM attendance a
       LEFT JOIN sections sec ON a.section_id = sec.id
       INNER JOIN (
         SELECT student_id, MAX(timestamp) as max_timestamp
         FROM attendance
         GROUP BY student_id
       ) latest ON a.student_id = latest.student_id 
                AND a.timestamp = latest.max_timestamp
       ORDER BY a.timestamp DESC
       LIMIT 200`
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
      name, age, gender, section, section_id, contact, address,
      subject, room, schedule, relationship, employee_id,
      lrn, grade, mac_address, rfid_uid,
      parents, // Array of parent accounts for students
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
        `INSERT INTO students (user_id, lrn, name, gender, grade, section_id, mac_address, rfid_uid, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, lrn, name,
         gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : (gender || null),
         grade || null, section_id || null, mac_address || null, rfid_uid || null, req.user!.id]
      ) as any[];
      profileId = (sr as any).insertId;

      // Create parent accounts if provided
      const createdParents = [];
      if (Array.isArray(parents) && parents.length > 0) {
        const [parentRoleRows] = await conn.execute('SELECT id FROM roles WHERE name = ?', ['parent']) as any[];
        const parentRoleId = (parentRoleRows as any[])[0]?.id;

        for (const parent of parents) {
          if (!parent.username || !parent.name || !parent.password) continue;

          // Check if parent username already exists
          const [parentExistCheck] = await conn.execute(
            'SELECT id FROM users WHERE username = ?',
            [parent.username]
          ) as any[];
          
          if ((parentExistCheck as any[]).length > 0) {
            console.log(`Skipping parent ${parent.username} - username already exists`);
            continue;
          }

          // Create parent user account
          const parentHashed = await bcrypt.hash(parent.password, 10);
          const [parentUserResult] = await conn.execute(
            'INSERT INTO users (username, password, role_id, created_by) VALUES (?, ?, ?, ?)',
            [parent.username, parentHashed, parentRoleId, req.user!.id]
          ) as any[];
          const parentUserId = (parentUserResult as any).insertId;

          // Create parent profile
          const [parentProfileResult] = await conn.execute(
            'INSERT INTO parents (user_id, name, contact, address, created_by) VALUES (?, ?, ?, ?, ?)',
            [parentUserId, parent.name, parent.contact || null, address || null, req.user!.id]
          ) as any[];
          const parentId = (parentProfileResult as any).insertId;

          // Link parent to student
          await conn.execute(
            'INSERT INTO parent_student (parent_id, student_id, relationship) VALUES (?, ?, ?)',
            [parentId, profileId, parent.relationship || 'Parent']
          );

          createdParents.push({
            username: parent.username,
            name: parent.name,
            relationship: parent.relationship,
          });
        }
      }

      await conn.commit();
      res.status(201).json({ 
        message: 'Student and parent accounts created successfully', 
        userId, 
        profileId,
        parentsCreated: createdParents.length,
        parents: createdParents,
      });
      return;
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
      name, age, gender, section, section_id, contact, address,
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
        `UPDATE students SET name=?, lrn=?, gender=?, grade=?, section_id=?, mac_address=?, rfid_uid=?, updated_by=?
         WHERE user_id=?`,
        [name, lrn || null,
         gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : (gender || null),
         grade || null, section_id || null, mac_address || null, rfid_uid || null,
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

// ─── POST /api/admin/students/:id/add-parent ─────────────────────────
export async function addParentToStudent(req: AuthRequest, res: Response): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id: studentId } = req.params;
    const { username, password, name, relationship, contact, address } = req.body;

    if (!username || !password || !name) {
      res.status(400).json({ error: 'username, password, and name are required' });
      return;
    }

    // Verify student exists
    const [studentCheck] = await conn.execute(
      'SELECT id, name FROM students WHERE id = ?',
      [studentId]
    ) as any[];

    if ((studentCheck as any[]).length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Check if username already exists
    const [existCheck] = await conn.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    ) as any[];

    if ((existCheck as any[]).length > 0) {
      res.status(400).json({ error: 'Username already taken' });
      return;
    }

    // Get parent role ID
    const [roleRows] = await conn.execute(
      'SELECT id FROM roles WHERE name = ?',
      ['parent']
    ) as any[];
    const parentRoleId = (roleRows as any[])[0]?.id;

    // Create user account
    const hashedPassword = await bcrypt.hash(password, 10);
    const [userResult] = await conn.execute(
      'INSERT INTO users (username, password, role_id, created_by) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, parentRoleId, req.user!.id]
    ) as any[];
    const userId = (userResult as any).insertId;

    // Create parent profile
    const [parentResult] = await conn.execute(
      'INSERT INTO parents (user_id, name, contact, address, created_by) VALUES (?, ?, ?, ?, ?)',
      [userId, name, contact || null, address || null, req.user!.id]
    ) as any[];
    const parentId = (parentResult as any).insertId;

    // Link parent to student
    await conn.execute(
      'INSERT INTO parent_student (parent_id, student_id, relationship) VALUES (?, ?, ?)',
      [parentId, studentId, relationship || 'Parent']
    );

    await conn.commit();
    res.status(201).json({
      message: 'Parent account created and linked successfully',
      parentId,
      parentUsername: username,
      linkedToStudent: (studentCheck as any[])[0].name,
    });
  } catch (err: any) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Username already exists' });
      return;
    }
    console.error('addParentToStudent error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
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


// ─── GET /api/admin/sections ──────────────────────────────────────────
export async function getSections(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [sections] = await pool.execute(`
      SELECT 
        s.id, 
        s.name, 
        s.grade, 
        s.section_code, 
        s.room_number, 
        s.capacity, 
        s.is_active,
        s.created_at,
        COUNT(st.id) as student_count
      FROM sections s
      LEFT JOIN students st ON st.section_id = s.id
      GROUP BY s.id
      ORDER BY s.grade, s.section_code
    `) as any[];

    res.json({ sections });
  } catch (err) {
    console.error('getSections error:', err);
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
}

// ─── GET /api/admin/sections/:id ──────────────────────────────────────
export async function getSectionById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const [sections] = await pool.execute(
      `SELECT * FROM sections WHERE id = ?`,
      [id]
    ) as any[];

    if (!sections || (sections as any[]).length === 0) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    const section = (sections as any[])[0];

    // Get enrolled students
    const [students] = await pool.execute(
      `SELECT id, lrn, name, gender, grade, section_id, is_active, preferred_method FROM students WHERE section_id = ? ORDER BY name`,
      [id]
    ) as any[];

    console.log(`📚 Found ${(students as any[])?.length || 0} students in section ${id}`);

    // Get assigned teachers
    const [teachers] = await pool.execute(
      `SELECT DISTINCT t.id, t.name FROM teachers t 
       JOIN teacher_classes tc ON t.id = tc.teacher_id 
       WHERE tc.section_id = ? ORDER BY t.name`,
      [id]
    ) as any[];

    console.log(`👨‍🏫 Found ${(teachers as any[])?.length || 0} teachers for section ${id}`);

    const studentList = (students || []) as any[];
    const teacherList = (teachers || []) as any[];

    // Convert is_active to boolean if it's stored as 0/1
    const processedStudents = studentList.map(s => ({
      ...s,
      is_active: s.is_active === 1 || s.is_active === true,
    }));

    res.json({ 
      section,
      students: processedStudents,
      teachers: teacherList
    });
  } catch (err) {
    console.error('getSectionById error:', err);
    res.status(500).json({ error: 'Failed to fetch section' });
  }
}

// ─── POST /api/admin/sections ─────────────────────────────────────────
export async function createSection(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, grade, section_code, room_number, capacity, is_active } = req.body;

    // Validate required fields
    if (!name || !grade || !section_code) {
      res.status(400).json({ error: 'Section name, grade, and code are required' });
      return;
    }

    // Check if section already exists
    const [existing] = await pool.execute(
      `SELECT id FROM sections WHERE name = ?`,
      [name]
    ) as any[];

    if (existing && (existing as any[]).length > 0) {
      res.status(409).json({ error: 'Section with this name already exists' });
      return;
    }

    // Create section
    const [result] = await pool.execute(
      `INSERT INTO sections (name, grade, section_code, room_number, capacity, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, grade, section_code, room_number || null, capacity || null, is_active !== undefined ? is_active : 1]
    ) as any[];

    const sectionId = (result as any).insertId;

    console.log(`✅ Admin ${req.user?.username} created section: ${name}`);

    res.json({
      success: true,
      message: 'Section created successfully',
      section: {
        id: sectionId,
        name,
        grade,
        section_code,
        room_number,
        capacity,
        is_active,
      },
    });
  } catch (err) {
    console.error('createSection error:', err);
    res.status(500).json({ error: 'Failed to create section' });
  }
}

// ─── PATCH /api/admin/sections/:id ────────────────────────────────────
export async function updateSection(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, grade, section_code, room_number, capacity, is_active } = req.body;

    // Check if section exists
    const [existing] = await pool.execute(
      `SELECT * FROM sections WHERE id = ?`,
      [id]
    ) as any[];

    if (!existing || (existing as any[]).length === 0) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    const section = (existing as any[])[0];

    // Prepare update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (grade !== undefined) {
      updates.push('grade = ?');
      values.push(grade);
    }
    if (section_code !== undefined) {
      updates.push('section_code = ?');
      values.push(section_code);
    }
    if (room_number !== undefined) {
      updates.push('room_number = ?');
      values.push(room_number || null);
    }
    if (capacity !== undefined) {
      updates.push('capacity = ?');
      values.push(capacity || null);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(id);

    // Update section
    await pool.execute(
      `UPDATE sections SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    console.log(`✅ Admin ${req.user?.username} updated section: ${section.name}`);

    res.json({
      success: true,
      message: 'Section updated successfully',
      section: {
        id,
        name: name || section.name,
        grade: grade || section.grade,
        section_code: section_code || section.section_code,
        room_number,
        capacity,
        is_active: is_active !== undefined ? is_active : section.is_active,
      },
    });
  } catch (err) {
    console.error('updateSection error:', err);
    res.status(500).json({ error: 'Failed to update section' });
  }
}

// ─── DELETE /api/admin/sections/:id ───────────────────────────────────
export async function deleteSection(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Check if section exists
    const [existing] = await pool.execute(
      `SELECT * FROM sections WHERE id = ?`,
      [id]
    ) as any[];

    if (!existing || (existing as any[]).length === 0) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    const section = (existing as any[])[0];

    // Check if section has students
    const [studentCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM students WHERE section = ?`,
      [section.name]
    ) as any[];

    const count = ((studentCount as any[])[0] as any).count;

    if (count > 0) {
      res.status(409).json({ 
        error: `Cannot delete section with ${count} student(s). Please reassign students first.` 
      });
      return;
    }

    // Delete section
    await pool.execute(
      `DELETE FROM sections WHERE id = ?`,
      [id]
    );

    // Also delete teacher-section links
    await pool.execute(
      `DELETE FROM teacher_sections WHERE section_id = ?`,
      [id]
    );

    console.log(`✅ Admin ${req.user?.username} deleted section: ${section.name}`);

    res.json({
      success: true,
      message: 'Section deleted successfully',
    });
  } catch (err) {
    console.error('deleteSection error:', err);
    res.status(500).json({ error: 'Failed to delete section' });
  }
}

// ─── GET /api/admin/teachers ─────────────────────────────────────────
export async function getTeachers(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [teachers] = await pool.execute(`
      SELECT 
        t.id, 
        t.user_id,
        t.name, 
        t.employee_id,
        t.subject,
        u.username,
        u.is_active,
        COUNT(tc.id) as class_count
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN teacher_classes tc ON tc.teacher_id = t.id AND tc.is_active = 1
      GROUP BY t.id
      ORDER BY t.name
    `) as any[];

    res.json({ teachers });
  } catch (err) {
    console.error('getTeachers error:', err);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
}

// ─── GET /api/admin/class-schedules ──────────────────────────────────
export async function getClassSchedules(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [classes] = await pool.execute(`
      SELECT 
        tc.id,
        tc.teacher_id,
        tc.section_id,
        tc.subject,
        tc.time_start,
        tc.time_end,
        tc.day_of_week,
        tc.room_number,
        tc.capacity,
        tc.is_active,
        tc.created_at,
        s.name as section_name,
        s.grade,
        s.section_code,
        t.name as teacher_name,
        COUNT(DISTINCT st.id) as enrolled_students
      FROM teacher_classes tc
      JOIN sections s ON tc.section_id = s.id
      JOIN teachers t ON tc.teacher_id = t.id
      LEFT JOIN students st ON st.section_id = tc.section_id
      WHERE tc.is_active = 1
      GROUP BY tc.id
      ORDER BY tc.day_of_week, tc.time_start, t.name
    `) as any[];

    res.json({ classes });
  } catch (err) {
    console.error('getClassSchedules error:', err);
    res.status(500).json({ error: 'Failed to fetch class schedules' });
  }
}

// ─── PATCH /api/admin/students/:id ────────────────────────────────────
export async function updateStudent(req: AuthRequest, res: Response): Promise<void> {
  const conn = await pool.getConnection();
  try {
    const { id: studentId } = req.params;
    const { name, section_id } = req.body;

    if (!name || !section_id) {
      res.status(400).json({ error: 'Name and section_id are required' });
      return;
    }

    // Verify student exists
    const [studentCheck] = await conn.execute(
      'SELECT id FROM students WHERE id = ?',
      [studentId]
    ) as any[];

    if ((studentCheck as any[]).length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Verify section exists
    const [sectionCheck] = await conn.execute(
      'SELECT id FROM sections WHERE id = ?',
      [section_id]
    ) as any[];

    if ((sectionCheck as any[]).length === 0) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    // Update student
    await conn.execute(
      'UPDATE students SET name = ?, section_id = ? WHERE id = ?',
      [name, section_id, studentId]
    );

    res.json({ 
      message: 'Student updated successfully',
      studentId 
    });
  } catch (err: any) {
    console.error('updateStudent error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
}

// ─── POST /api/admin/sections/:id/assign-teachers ─────────────────────
export async function assignTeachersToSection(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { teacher_ids } = req.body;

    if (!Array.isArray(teacher_ids)) {
      res.status(400).json({ error: 'teacher_ids must be an array' });
      return;
    }

    // Check if section exists
    const [sections] = await pool.execute(
      `SELECT id FROM sections WHERE id = ?`,
      [id]
    ) as any[];

    if (!sections || (sections as any[]).length === 0) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    // Delete existing teacher assignments for this section
    await pool.execute(
      `DELETE FROM teacher_classes WHERE section_id = ?`,
      [id]
    );

    console.log(`🗑️ Cleared existing teachers for section ${id}`);

    // Add new teacher assignments
    for (const teacher_id of teacher_ids) {
      await pool.execute(
        `INSERT INTO teacher_classes (teacher_id, section_id, subject, time_start, time_end, day_of_week, room_number)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [teacher_id, id, 'TBD', '07:00', '08:00', 'Monday', 'TBD']
      );
    }

    console.log(`✅ Assigned ${teacher_ids.length} teachers to section ${id}`);

    res.json({
      success: true,
      message: `Successfully assigned ${teacher_ids.length} teacher(s) to section`
    });
  } catch (err) {
    console.error('assignTeachersToSection error:', err);
    res.status(500).json({ error: 'Failed to assign teachers' });
  }
}

// ─── GET /api/admin/sections/:id/teachers ─────────────────────────────
export async function getSectionTeachers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const [teachers] = await pool.execute(
      `SELECT DISTINCT t.id, t.name FROM teachers t 
       JOIN teacher_classes tc ON t.id = tc.teacher_id 
       WHERE tc.section_id = ? ORDER BY t.name`,
      [id]
    ) as any[];

    res.json({
      teachers: teachers || []
    });
  } catch (err) {
    console.error('getSectionTeachers error:', err);
    res.status(500).json({ error: 'Failed to fetch section teachers' });
  }
}
