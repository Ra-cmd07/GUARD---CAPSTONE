#!/usr/bin/env node
/**
 * Seed script: Create test data for multi-section teacher functionality
 * Usage: node seed-multi-section-test-data.js
 */

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'attendbox_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function seedData() {
  let conn;
  try {
    conn = await pool.getConnection();
    
    console.log('📊 Seeding multi-section test data...\n');

    // Step 1: Get Bernie (teacher_id = 2)
    const [bernie] = await conn.query(
      `SELECT id FROM teachers WHERE name LIKE '%Bernie%'`
    );
    
    if (bernie.length === 0) {
      console.log('❌ Bernie teacher not found');
      return;
    }

    const bernieTeacherId = bernie[0].id;
    console.log(`✓ Found Bernie (teacher_id: ${bernieTeacherId})\n`);

    // Step 2: Create additional sections
    console.log('Creating sections...');
    const sections = [
      { name: 'Grade 7 - Section A', grade: '7', code: 'A' },
      { name: 'Grade 7 - Section B', grade: '7', code: 'B' },
      { name: 'Grade 8 - Section A', grade: '8', code: 'A' },
    ];

    const sectionIds = {};
    for (const sec of sections) {
      await conn.query(
        `INSERT IGNORE INTO sections (name, grade, section_code, is_active) VALUES (?, ?, ?, 1)`,
        [sec.name, sec.grade, sec.code]
      );
      const [result] = await conn.query(`SELECT id FROM sections WHERE name = ?`, [sec.name]);
      sectionIds[sec.name] = result[0].id;
      console.log(`  ✓ ${sec.name} (ID: ${result[0].id})`);
    }

    // Step 3: Link Bernie to all sections
    console.log('\nLinking Bernie to sections...');
    for (const [sectionName, sectionId] of Object.entries(sectionIds)) {
      // Check if already linked
      const [existing] = await conn.query(
        `SELECT id FROM teacher_sections WHERE teacher_id = ? AND section_id = ?`,
        [bernieTeacherId, sectionId]
      );
      
      if (existing.length === 0) {
        const isPrimary = sectionName === 'Grade 7 - Section A' ? 1 : 0;
        await conn.query(
          `INSERT INTO teacher_sections (teacher_id, section_id, is_primary) VALUES (?, ?, ?)`,
          [bernieTeacherId, sectionId, isPrimary]
        );
        console.log(`  ✓ Linked to ${sectionName} (Primary: ${isPrimary === 1 ? 'Yes' : 'No'})`);
      }
    }

    // Step 4: Create students for each section
    console.log('\nCreating students for each section...');
    let studentCounter = 201;

    for (const [sectionName, sectionId] of Object.entries(sectionIds)) {
      const grade = sectionName.match(/Grade (\d+)/)[1];
      const numStudents = 8;
      const studentNames = [
        'Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Brown',
        'Emma Wilson', 'Frank Miller', 'Grace Lee', 'Henry Taylor',
      ];

      for (let i = 0; i < numStudents; i++) {
        const studentId = studentCounter++;
        const lrn = `LRN${String(studentId).padStart(6, '0')}`;
        const name = studentNames[i];

        await conn.query(
          `INSERT IGNORE INTO students (id, lrn, name, gender, grade, section, teacher_id, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            studentId,
            lrn,
            name,
            i % 2 === 0 ? 'M' : 'F',
            `Grade ${grade}`,
            sectionName,
            bernieTeacherId,
          ]
        );
      }
      console.log(`  ✓ Created ${numStudents} students in ${sectionName}`);
    }

    // Step 5: Create attendance records for today
    console.log('\nCreating attendance records for today...');
    const today = new Date().toISOString().split('T')[0];
    let attendanceCounter = 0;

    for (const [sectionName, sectionId] of Object.entries(sectionIds)) {
      const grade = sectionName.match(/Grade (\d+)/)[1];
      
      // Get students for this section
      const [students] = await conn.query(
        `SELECT id, lrn, name FROM students WHERE section = ? AND teacher_id = ?`,
        [sectionName, bernieTeacherId]
      );

      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        let status, timeIn;

        // Vary attendance status
        if (i % 4 === 0) {
          status = 'Absent';
          timeIn = null;
        } else if (i % 4 === 1) {
          status = 'Late';
          timeIn = '08:15:00'; // 45 min after class start
        } else {
          status = 'Time-In';
          timeIn = `07:${String(15 + i * 2).padStart(2, '0')}:00`;
        }

        await conn.query(
          `INSERT INTO attendance 
           (student_id, student_name, lrn, gender, grade, section, teacher_id, teacher_name,
            scan_method, status, session, date, time_in, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Manual', ?, 'AM', ?, ?, NOW())`,
          [
            student.id,
            student.name,
            student.lrn,
            i % 2 === 0 ? 'M' : 'F',
            `Grade ${grade}`,
            sectionName,
            bernieTeacherId,
            'Bernie',
            status,
            today,
            timeIn,
          ]
        );
        attendanceCounter++;
      }
    }
    console.log(`  ✓ Created ${attendanceCounter} attendance records`);

    // Step 6: Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST DATA SEEDING COMPLETE!\n');

    const [sectionCount] = await conn.query(
      `SELECT COUNT(*) as count FROM sections 
       WHERE id IN (SELECT section_id FROM teacher_sections WHERE teacher_id = ?)`,
      [bernieTeacherId]
    );

    const [studentCount] = await conn.query(
      `SELECT COUNT(*) as count FROM students WHERE teacher_id = ?`,
      [bernieTeacherId]
    );

    const [attendanceCount] = await conn.query(
      `SELECT COUNT(*) as count FROM attendance WHERE teacher_id = ? AND date = ?`,
      [bernieTeacherId, today]
    );

    console.log('📊 Summary:');
    console.log(`  Sections assigned to Bernie: ${sectionCount[0].count}`);
    console.log(`  Total students: ${studentCount[0].count}`);
    console.log(`  Attendance records (today): ${attendanceCount[0].count}`);
    console.log('\n🧪 Testing Instructions:');
    console.log('  1. Log in as Bernie');
    console.log('  2. Go to Teacher Dashboard');
    console.log('  3. Look for section selector dropdown in header');
    console.log('  4. Switch between sections to see different students & attendance');
    console.log('  5. Try SF2 Report and select different sections');
    console.log('\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

seedData();
