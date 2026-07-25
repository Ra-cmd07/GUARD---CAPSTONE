"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = getDashboardStats;
exports.getUsers = getUsers;
exports.getUserById = getUserById;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.resetPassword = resetPassword;
exports.toggleUserStatus = toggleUserStatus;
exports.getKiosks = getKiosks;
exports.createKiosk = createKiosk;
exports.updateKiosk = updateKiosk;
exports.getSmsLogs = getSmsLogs;
exports.getLoginLogs = getLoginLogs;
exports.addParentToStudent = addParentToStudent;
exports.clearSmsLogs = clearSmsLogs;
exports.getSections = getSections;
exports.getSectionById = getSectionById;
exports.createSection = createSection;
exports.updateSection = updateSection;
exports.deleteSection = deleteSection;
exports.getTeachers = getTeachers;
exports.getClassSchedules = getClassSchedules;
exports.updateStudent = updateStudent;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../lib/db"));
// ─── GET /api/admin/dashboard ─────────────────────────────────────────
async function getDashboardStats(_req, res) {
    try {
        const [[stats]] = await db_1.default.execute('SELECT * FROM v_dashboard_stats');
        const [recentLogs] = await db_1.default.execute(`SELECT 
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
       LIMIT 200`);
        const [activeKiosks] = await db_1.default.execute(`SELECT id, name, location, gate, is_active, last_ping
       FROM kiosks WHERE is_active = 1`);
        res.json({ stats, recentLogs, activeKiosks });
    }
    catch (err) {
        console.error('getDashboardStats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/admin/users ─────────────────────────────────────────────
async function getUsers(req, res) {
    try {
        const role = req.query.role;
        let query = `
      SELECT u.id, u.username, u.is_active, r.name AS role,
             u.created_at, u.updated_at
      FROM users u JOIN roles r ON r.id = u.role_id
    `;
        const params = [];
        if (role) {
            query += ' WHERE r.name = ?';
            params.push(role);
        }
        query += ' ORDER BY u.created_at DESC';
        const [rows] = await db_1.default.execute(query, params);
        res.json(rows);
    }
    catch (err) {
        console.error('getUsers error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/admin/users/:id ─────────────────────────────────────────
async function getUserById(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await db_1.default.execute(`SELECT u.id, u.username, u.is_active, r.name AS role, u.created_at
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`, [id]);
        const user = rows[0];
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        let profile = null;
        if (user.role === 'teacher') {
            const [t] = await db_1.default.execute('SELECT * FROM teachers WHERE user_id = ?', [id]);
            profile = t[0] || null;
        }
        else if (user.role === 'parent') {
            const [p] = await db_1.default.execute('SELECT * FROM parents WHERE user_id = ?', [id]);
            profile = p[0] || null;
            if (profile) {
                const [children] = await db_1.default.execute(`SELECT s.* FROM students s
           JOIN parent_student ps ON ps.student_id = s.id
           WHERE ps.parent_id = ?`, [profile.id]);
                profile.children = children;
            }
        }
        else if (user.role === 'student') {
            const [s] = await db_1.default.execute('SELECT * FROM students WHERE user_id = ?', [id]);
            profile = s[0] || null;
        }
        res.json({ ...user, profile });
    }
    catch (err) {
        console.error('getUserById error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── POST /api/admin/users ────────────────────────────────────────────
async function createUser(req, res) {
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const { username, password, role, name, age, gender, section, section_id, contact, address, subject, room, schedule, relationship, employee_id, lrn, grade, mac_address, rfid_uid, parents, // Array of parent accounts for students
         } = req.body;
        if (!username || !password || !role || !name) {
            res.status(400).json({ error: 'username, password, role, and name are required' });
            return;
        }
        const [existCheck] = await conn.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (existCheck.length > 0) {
            res.status(400).json({ error: 'Username already taken' });
            return;
        }
        const [roleRows] = await conn.execute('SELECT id FROM roles WHERE name = ?', [role]);
        const roleId = roleRows[0]?.id;
        if (!roleId) {
            res.status(400).json({ error: 'Invalid role' });
            return;
        }
        const hashed = await bcryptjs_1.default.hash(password, 10);
        const [ur] = await conn.execute('INSERT INTO users (username, password, role_id, created_by) VALUES (?, ?, ?, ?)', [username, hashed, roleId, req.user.id]);
        const userId = ur.insertId;
        let profileId = null;
        if (role === 'teacher') {
            const [tr] = await conn.execute(`INSERT INTO teachers (user_id, name, employee_id, age, gender, section, subject, room, schedule, contact, address, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userId, name, employee_id || null, age || null, gender || null,
                section || null, subject || null, room || null, schedule || null,
                contact || null, address || null, req.user.id]);
            profileId = tr.insertId;
        }
        else if (role === 'parent') {
            const [pr] = await conn.execute('INSERT INTO parents (user_id, name, relationship, contact, address, created_by) VALUES (?, ?, ?, ?, ?, ?)', [userId, name, relationship || null, contact || null, address || null, req.user.id]);
            profileId = pr.insertId;
        }
        else if (role === 'student') {
            if (!lrn) {
                res.status(400).json({ error: 'LRN is required for students' });
                return;
            }
            const [sr] = await conn.execute(`INSERT INTO students (user_id, lrn, name, gender, grade, section_id, mac_address, rfid_uid, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userId, lrn, name,
                gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : (gender || null),
                grade || null, section_id || null, mac_address || null, rfid_uid || null, req.user.id]);
            profileId = sr.insertId;
            // Create parent accounts if provided
            const createdParents = [];
            if (Array.isArray(parents) && parents.length > 0) {
                const [parentRoleRows] = await conn.execute('SELECT id FROM roles WHERE name = ?', ['parent']);
                const parentRoleId = parentRoleRows[0]?.id;
                for (const parent of parents) {
                    if (!parent.username || !parent.name || !parent.password)
                        continue;
                    // Check if parent username already exists
                    const [parentExistCheck] = await conn.execute('SELECT id FROM users WHERE username = ?', [parent.username]);
                    if (parentExistCheck.length > 0) {
                        console.log(`Skipping parent ${parent.username} - username already exists`);
                        continue;
                    }
                    // Create parent user account
                    const parentHashed = await bcryptjs_1.default.hash(parent.password, 10);
                    const [parentUserResult] = await conn.execute('INSERT INTO users (username, password, role_id, created_by) VALUES (?, ?, ?, ?)', [parent.username, parentHashed, parentRoleId, req.user.id]);
                    const parentUserId = parentUserResult.insertId;
                    // Create parent profile
                    const [parentProfileResult] = await conn.execute('INSERT INTO parents (user_id, name, contact, address, created_by) VALUES (?, ?, ?, ?, ?)', [parentUserId, parent.name, parent.contact || null, address || null, req.user.id]);
                    const parentId = parentProfileResult.insertId;
                    // Link parent to student
                    await conn.execute('INSERT INTO parent_student (parent_id, student_id, relationship) VALUES (?, ?, ?)', [parentId, profileId, parent.relationship || 'Parent']);
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
    }
    catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Duplicate entry (LRN or username already exists)' });
            return;
        }
        console.error('createUser error:', err);
        res.status(500).json({ error: 'Server error' });
    }
    finally {
        conn.release();
    }
}
// ─── PUT /api/admin/users/:id ─────────────────────────────────────────
async function updateUser(req, res) {
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const { name, age, gender, section, section_id, contact, address, subject, room, schedule, relationship, employee_id, lrn, grade, mac_address, rfid_uid, is_active, } = req.body;
        const [rows] = await conn.execute(`SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`, [id]);
        const user = rows[0];
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        if (is_active !== undefined) {
            await conn.execute('UPDATE users SET is_active = ?, updated_by = ? WHERE id = ?', [is_active ? 1 : 0, req.user.id, id]);
        }
        if (user.role === 'teacher') {
            await conn.execute(`UPDATE teachers SET name=?, employee_id=?, age=?, gender=?, section=?, subject=?, room=?, schedule=?, contact=?, address=?, updated_by=?
         WHERE user_id=?`, [name, employee_id || null, age || null, gender || null, section || null,
                subject || null, room || null, schedule || null, contact || null, address || null,
                req.user.id, id]);
        }
        else if (user.role === 'parent') {
            await conn.execute('UPDATE parents SET name=?, relationship=?, contact=?, address=?, updated_by=? WHERE user_id=?', [name, relationship || null, contact || null, address || null, req.user.id, id]);
        }
        else if (user.role === 'student') {
            await conn.execute(`UPDATE students SET name=?, lrn=?, gender=?, grade=?, section_id=?, mac_address=?, rfid_uid=?, updated_by=?
         WHERE user_id=?`, [name, lrn || null,
                gender === 'Male' ? 'M' : gender === 'Female' ? 'F' : (gender || null),
                grade || null, section_id || null, mac_address || null, rfid_uid || null,
                req.user.id, id]);
        }
        await conn.commit();
        res.json({ message: 'User updated' });
    }
    catch (err) {
        await conn.rollback();
        console.error('updateUser error:', err);
        res.status(500).json({ error: 'Server error' });
    }
    finally {
        conn.release();
    }
}
// ─── POST /api/admin/users/:id/reset-password ─────────────────────────
async function resetPassword(req, res) {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        if (!newPassword) {
            res.status(400).json({ error: 'newPassword is required' });
            return;
        }
        const hashed = await bcryptjs_1.default.hash(newPassword, 10);
        await db_1.default.execute('UPDATE users SET password = ?, updated_by = ? WHERE id = ?', [hashed, req.user.id, id]);
        res.json({ message: 'Password reset successfully' });
    }
    catch (err) {
        console.error('resetPassword error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── PATCH /api/admin/users/:id/toggle-status ─────────────────────────
async function toggleUserStatus(req, res) {
    try {
        const { id } = req.params;
        await db_1.default.execute('UPDATE users SET is_active = NOT is_active, updated_by = ? WHERE id = ?', [req.user.id, id]);
        const [rows] = await db_1.default.execute('SELECT is_active FROM users WHERE id = ?', [id]);
        const active = rows[0]?.is_active;
        res.json({ message: `User ${active ? 'activated' : 'deactivated'}`, is_active: active });
    }
    catch (err) {
        console.error('toggleUserStatus error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/admin/kiosks ────────────────────────────────────────────
async function getKiosks(_req, res) {
    try {
        const [rows] = await db_1.default.execute('SELECT * FROM kiosks ORDER BY name');
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── POST /api/admin/kiosks ───────────────────────────────────────────
async function createKiosk(req, res) {
    try {
        const { name, location, gate, ip_address } = req.body;
        if (!name) {
            res.status(400).json({ error: 'name is required' });
            return;
        }
        const [r] = await db_1.default.execute('INSERT INTO kiosks (name, location, gate, ip_address, created_by) VALUES (?, ?, ?, ?, ?)', [name, location || null, gate || null, ip_address || null, req.user.id]);
        res.status(201).json({ id: r.insertId, message: 'Kiosk created' });
    }
    catch (err) {
        console.error('createKiosk error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── PUT /api/admin/kiosks/:id ────────────────────────────────────────
async function updateKiosk(req, res) {
    try {
        const { id } = req.params;
        const { name, location, gate, ip_address, is_active } = req.body;
        await db_1.default.execute('UPDATE kiosks SET name=?, location=?, gate=?, ip_address=?, is_active=?, updated_by=? WHERE id=?', [name, location || null, gate || null, ip_address || null,
            is_active !== undefined ? (is_active ? 1 : 0) : 1, req.user.id, id]);
        res.json({ message: 'Kiosk updated' });
    }
    catch (err) {
        console.error('updateKiosk error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/admin/sms-logs ──────────────────────────────────────────
async function getSmsLogs(_req, res) {
    try {
        const [rows] = await db_1.default.execute('SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 200');
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── GET /api/admin/login-logs ────────────────────────────────────────
async function getLoginLogs(_req, res) {
    try {
        const [rows] = await db_1.default.execute('SELECT * FROM login_logs ORDER BY logged_at DESC LIMIT 200');
        res.json(rows);
    }
    catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}
// ─── POST /api/admin/students/:id/add-parent ─────────────────────────
async function addParentToStudent(req, res) {
    const conn = await db_1.default.getConnection();
    try {
        await conn.beginTransaction();
        const { id: studentId } = req.params;
        const { username, password, name, relationship, contact, address } = req.body;
        if (!username || !password || !name) {
            res.status(400).json({ error: 'username, password, and name are required' });
            return;
        }
        // Verify student exists
        const [studentCheck] = await conn.execute('SELECT id, name FROM students WHERE id = ?', [studentId]);
        if (studentCheck.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        // Check if username already exists
        const [existCheck] = await conn.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (existCheck.length > 0) {
            res.status(400).json({ error: 'Username already taken' });
            return;
        }
        // Get parent role ID
        const [roleRows] = await conn.execute('SELECT id FROM roles WHERE name = ?', ['parent']);
        const parentRoleId = roleRows[0]?.id;
        // Create user account
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const [userResult] = await conn.execute('INSERT INTO users (username, password, role_id, created_by) VALUES (?, ?, ?, ?)', [username, hashedPassword, parentRoleId, req.user.id]);
        const userId = userResult.insertId;
        // Create parent profile
        const [parentResult] = await conn.execute('INSERT INTO parents (user_id, name, contact, address, created_by) VALUES (?, ?, ?, ?, ?)', [userId, name, contact || null, address || null, req.user.id]);
        const parentId = parentResult.insertId;
        // Link parent to student
        await conn.execute('INSERT INTO parent_student (parent_id, student_id, relationship) VALUES (?, ?, ?)', [parentId, studentId, relationship || 'Parent']);
        await conn.commit();
        res.status(201).json({
            message: 'Parent account created and linked successfully',
            parentId,
            parentUsername: username,
            linkedToStudent: studentCheck[0].name,
        });
    }
    catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Username already exists' });
            return;
        }
        console.error('addParentToStudent error:', err);
        res.status(500).json({ error: 'Server error' });
    }
    finally {
        conn.release();
    }
}
// ─── DELETE /api/admin/sms-logs/clear ─────────────────────────────────
async function clearSmsLogs(req, res) {
    try {
        console.log(`🗑️  Admin ${req.user?.username} clearing SMS history...`);
        // Count before deletion
        const [countBefore] = await db_1.default.execute('SELECT COUNT(*) as total FROM sms_logs');
        const totalBefore = countBefore[0].total;
        // Delete all SMS logs
        const [result] = await db_1.default.execute('DELETE FROM sms_logs');
        console.log(`✅ Deleted ${result.affectedRows} SMS log records`);
        res.json({
            success: true,
            message: 'SMS history cleared successfully',
            deletedCount: result.affectedRows,
            previousCount: totalBefore
        });
    }
    catch (err) {
        console.error('clearSmsLogs error:', err);
        res.status(500).json({ error: 'Failed to clear SMS history' });
    }
}
// ─── GET /api/admin/sections ──────────────────────────────────────────
async function getSections(_req, res) {
    try {
        const [sections] = await db_1.default.execute(`
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
    `);
        res.json({ sections });
    }
    catch (err) {
        console.error('getSections error:', err);
        res.status(500).json({ error: 'Failed to fetch sections' });
    }
}
// ─── GET /api/admin/sections/:id ──────────────────────────────────────
async function getSectionById(req, res) {
    try {
        const { id } = req.params;
        const [sections] = await db_1.default.execute(`SELECT * FROM sections WHERE id = ?`, [id]);
        if (!sections || sections.length === 0) {
            res.status(404).json({ error: 'Section not found' });
            return;
        }
        res.json({ section: sections[0] });
    }
    catch (err) {
        console.error('getSectionById error:', err);
        res.status(500).json({ error: 'Failed to fetch section' });
    }
}
// ─── POST /api/admin/sections ─────────────────────────────────────────
async function createSection(req, res) {
    try {
        const { name, grade, section_code, room_number, capacity, is_active } = req.body;
        // Validate required fields
        if (!name || !grade || !section_code) {
            res.status(400).json({ error: 'Section name, grade, and code are required' });
            return;
        }
        // Check if section already exists
        const [existing] = await db_1.default.execute(`SELECT id FROM sections WHERE name = ?`, [name]);
        if (existing && existing.length > 0) {
            res.status(409).json({ error: 'Section with this name already exists' });
            return;
        }
        // Create section
        const [result] = await db_1.default.execute(`INSERT INTO sections (name, grade, section_code, room_number, capacity, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`, [name, grade, section_code, room_number || null, capacity || null, is_active !== undefined ? is_active : 1]);
        const sectionId = result.insertId;
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
    }
    catch (err) {
        console.error('createSection error:', err);
        res.status(500).json({ error: 'Failed to create section' });
    }
}
// ─── PATCH /api/admin/sections/:id ────────────────────────────────────
async function updateSection(req, res) {
    try {
        const { id } = req.params;
        const { name, grade, section_code, room_number, capacity, is_active } = req.body;
        // Check if section exists
        const [existing] = await db_1.default.execute(`SELECT * FROM sections WHERE id = ?`, [id]);
        if (!existing || existing.length === 0) {
            res.status(404).json({ error: 'Section not found' });
            return;
        }
        const section = existing[0];
        // Prepare update fields
        const updates = [];
        const values = [];
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
        await db_1.default.execute(`UPDATE sections SET ${updates.join(', ')} WHERE id = ?`, values);
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
    }
    catch (err) {
        console.error('updateSection error:', err);
        res.status(500).json({ error: 'Failed to update section' });
    }
}
// ─── DELETE /api/admin/sections/:id ───────────────────────────────────
async function deleteSection(req, res) {
    try {
        const { id } = req.params;
        // Check if section exists
        const [existing] = await db_1.default.execute(`SELECT * FROM sections WHERE id = ?`, [id]);
        if (!existing || existing.length === 0) {
            res.status(404).json({ error: 'Section not found' });
            return;
        }
        const section = existing[0];
        // Check if section has students
        const [studentCount] = await db_1.default.execute(`SELECT COUNT(*) as count FROM students WHERE section = ?`, [section.name]);
        const count = studentCount[0].count;
        if (count > 0) {
            res.status(409).json({
                error: `Cannot delete section with ${count} student(s). Please reassign students first.`
            });
            return;
        }
        // Delete section
        await db_1.default.execute(`DELETE FROM sections WHERE id = ?`, [id]);
        // Also delete teacher-section links
        await db_1.default.execute(`DELETE FROM teacher_sections WHERE section_id = ?`, [id]);
        console.log(`✅ Admin ${req.user?.username} deleted section: ${section.name}`);
        res.json({
            success: true,
            message: 'Section deleted successfully',
        });
    }
    catch (err) {
        console.error('deleteSection error:', err);
        res.status(500).json({ error: 'Failed to delete section' });
    }
}
// ─── GET /api/admin/teachers ─────────────────────────────────────────
async function getTeachers(_req, res) {
    try {
        const [teachers] = await db_1.default.execute(`
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
    `);
        res.json({ teachers });
    }
    catch (err) {
        console.error('getTeachers error:', err);
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
}
// ─── GET /api/admin/class-schedules ──────────────────────────────────
async function getClassSchedules(_req, res) {
    try {
        const [classes] = await db_1.default.execute(`
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
    `);
        res.json({ classes });
    }
    catch (err) {
        console.error('getClassSchedules error:', err);
        res.status(500).json({ error: 'Failed to fetch class schedules' });
    }
}
// ─── PATCH /api/admin/students/:id ────────────────────────────────────
async function updateStudent(req, res) {
    const conn = await db_1.default.getConnection();
    try {
        const { id: studentId } = req.params;
        const { name, section_id } = req.body;
        if (!name || !section_id) {
            res.status(400).json({ error: 'Name and section_id are required' });
            return;
        }
        // Verify student exists
        const [studentCheck] = await conn.execute('SELECT id FROM students WHERE id = ?', [studentId]);
        if (studentCheck.length === 0) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }
        // Verify section exists
        const [sectionCheck] = await conn.execute('SELECT id FROM sections WHERE id = ?', [section_id]);
        if (sectionCheck.length === 0) {
            res.status(404).json({ error: 'Section not found' });
            return;
        }
        // Update student
        await conn.execute('UPDATE students SET name = ?, section_id = ? WHERE id = ?', [name, section_id, studentId]);
        res.json({
            message: 'Student updated successfully',
            studentId
        });
    }
    catch (err) {
        console.error('updateStudent error:', err);
        res.status(500).json({ error: 'Server error' });
    }
    finally {
        conn.release();
    }
}
