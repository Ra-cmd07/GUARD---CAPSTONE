#!/usr/bin/env node
/**
 * Migration script: Populate sections table and link teachers to sections
 * Usage: node migrate-to-sections.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'attendbox_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function migrate() {
  let conn;
  try {
    conn = await pool.getConnection();
    
    console.log('📊 Starting migration: sections and teacher_sections...\n');

    // Step 1: Create tables manually (bypass SQL file parsing issues)
    console.log('Creating sections table...');
    try {
      await conn.query(`DROP TABLE IF EXISTS teacher_sections`);
      await conn.query(`DROP TABLE IF EXISTS sections`);
    } catch (e) {
      // Ignore if tables don't exist
    }

    await conn.query(`
      CREATE TABLE sections (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        grade VARCHAR(20) DEFAULT NULL,
        section_code VARCHAR(50) DEFAULT NULL,
        room_number VARCHAR(50) DEFAULT NULL,
        capacity INT UNSIGNED DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT UNSIGNED DEFAULT NULL,
        updated_by INT UNSIGNED DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_sections_name (name),
        KEY idx_sections_grade (grade)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Sections table created');

    await conn.query(`
      CREATE TABLE teacher_sections (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        teacher_id INT UNSIGNED NOT NULL,
        section_id INT UNSIGNED NOT NULL,
        is_primary TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_teacher_section (teacher_id, section_id),
        KEY idx_ts_section_id (section_id),
        CONSTRAINT fk_ts_teacher FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE,
        CONSTRAINT fk_ts_section FOREIGN KEY (section_id) REFERENCES sections (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Teacher_sections table created');

    // Step 2: Get all unique sections from teachers
    const [teacherRows] = await conn.query(
      `SELECT DISTINCT section FROM teachers WHERE section IS NOT NULL AND section != '' ORDER BY section`
    );
    
    console.log(`\nFound ${teacherRows.length} unique sections from teachers table`);
    teacherRows.forEach(row => console.log(`  - ${row.section}`));

    // Step 3: Check existing sections
    const [existingSections] = await conn.query(`SELECT COUNT(*) as count FROM sections`);
    console.log(`\nExisting sections in database: ${existingSections[0].count}`);

    if (existingSections[0].count === 0 && teacherRows.length > 0) {
      console.log('\nPopulating sections...');
      for (const { section } of teacherRows) {
        const grade = section.match(/Grade\s+(\d+)/i)?.[1] || null;
        const sectionCode = section.match(/Section\s+([A-Za-z0-9])/i)?.[1] || 'A';
        
        await conn.query(
          `INSERT IGNORE INTO sections (name, grade, section_code, is_active) VALUES (?, ?, ?, 1)`,
          [section, grade, sectionCode]
        );
        console.log(`  ✓ Inserted: "${section}"`);
      }
    }

    // Step 4: Link teachers to sections
    console.log('\nLinking teachers to sections...');
    const [teachers] = await conn.query(
      `SELECT t.id, t.section FROM teachers t 
       LEFT JOIN teacher_sections ts ON t.id = ts.teacher_id
       WHERE t.section IS NOT NULL AND t.section != '' AND ts.id IS NULL`
    );

    if (teachers.length > 0) {
      for (const { id: teacherId, section } of teachers) {
        const [sectionRows] = await conn.query(
          `SELECT id FROM sections WHERE name = ?`,
          [section]
        );
        
        if (sectionRows.length > 0) {
          const sectionId = sectionRows[0].id;
          await conn.query(
            `INSERT IGNORE INTO teacher_sections (teacher_id, section_id, is_primary) VALUES (?, ?, 1)`,
            [teacherId, sectionId]
          );
          console.log(`  ✓ Linked teacher ${teacherId} → "${section}"`);
        }
      }
    } else {
      console.log('  ✓ All teachers already linked');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    
    const [finalSections] = await conn.query(`SELECT COUNT(*) as count FROM sections`);
    const [finalLinks] = await conn.query(`SELECT COUNT(*) as count FROM teacher_sections`);
    
    console.log(`  - Total sections: ${finalSections[0].count}`);
    console.log(`  - Teacher-section links: ${finalLinks[0].count}`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

migrate();
