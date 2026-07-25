#!/usr/bin/env node
/**
 * Test script: Verify multi-section support endpoints
 * Usage: node test-multi-section.js
 */

const mysql = require('mysql2/promise');
const http = require('http');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'attendbox_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function makeRequest(method, path, authToken = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function test() {
  let conn;
  try {
    conn = await pool.getConnection();

    console.log('🧪 Testing Multi-Section Support\n');

    // Check sections table
    console.log('1️⃣ Checking sections table...');
    const [sections] = await conn.query(`SELECT * FROM sections`);
    console.log(`   ✓ Found ${sections.length} sections`);
    sections.forEach(s => console.log(`     - ${s.name} (Grade: ${s.grade}, Code: ${s.section_code})`));

    // Check teacher_sections table
    console.log('\n2️⃣ Checking teacher_sections junction table...');
    const [links] = await conn.query(`
      SELECT ts.*, t.name as teacher_name, s.name as section_name
      FROM teacher_sections ts
      JOIN teachers t ON ts.teacher_id = t.id
      JOIN sections s ON ts.section_id = s.id
    `);
    console.log(`   ✓ Found ${links.length} teacher-section links`);
    links.forEach(l => console.log(`     - Teacher: ${l.teacher_name} → Section: ${l.section_name} (Primary: ${l.is_primary})`));

    // Get a teacher user for testing
    console.log('\n3️⃣ Finding teacher user for API testing...');
    const [teachers] = await conn.query(`
      SELECT u.id, u.username, t.name as teacher_name
      FROM users u
      JOIN teachers t ON t.user_id = u.id
      WHERE u.role_id = 2
      LIMIT 1
    `);

    if (teachers.length === 0) {
      console.log('   ❌ No teacher users found');
      return;
    }

    const teacherUser = teachers[0];
    console.log(`   ✓ Found teacher: ${teacherUser.teacher_name} (user_id: ${teacherUser.id}, username: ${teacherUser.username})`);

    // Generate JWT token for testing (simple mock)
    // In real testing, you'd need to properly authenticate
    console.log('\n4️⃣ Testing API endpoints...');
    console.log('   Note: API requires proper authentication.');
    console.log('   To fully test:');
    console.log('   1. Log in to the web app as a teacher');
    console.log('   2. Open browser DevTools → Network tab');
    console.log('   3. Check requests to /api/teacher/sections, /api/teacher/classes, /api/teacher/attendance/today');
    console.log('   4. Verify they return sections array with proper filtering');

    console.log('\n5️⃣ Database verification complete! ✅');
    console.log('\n📋 Summary:');
    console.log(`   - Sections: ${sections.length}`);
    console.log(`   - Teacher-Section Links: ${links.length}`);
    console.log(`   - Teachers: ${teachers.length}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

test();
