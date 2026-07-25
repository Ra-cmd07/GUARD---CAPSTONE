const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'attendbox_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

(async () => {
  try {
    const conn = await pool.getConnection();
    
    // Get full CREATE TABLE for both tables
    console.log('=== STUDENTS TABLE ===');
    const [students] = await conn.query('SHOW CREATE TABLE students');
    console.log(students[0]['Create Table']);
    
    console.log('\n=== SECTIONS TABLE ===');
    const [sections] = await conn.query('SHOW CREATE TABLE sections');
    console.log(sections[0]['Create Table']);
    
    // Check for orphaned section_id values
    console.log('\n=== ORPHANED SECTION IDS ===');
    const [orphaned] = await conn.query(`
      SELECT DISTINCT section_id FROM students 
      WHERE section_id NOT IN (SELECT id FROM sections)
      AND section_id IS NOT NULL
    `);
    console.log('Orphaned records:', orphaned);
    
    // Check storage engines
    console.log('\n=== STORAGE ENGINES ===');
    const [studentEngine] = await conn.query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_NAME='students' AND TABLE_SCHEMA='attendbox_db'");
    const [sectionEngine] = await conn.query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_NAME='sections' AND TABLE_SCHEMA='attendbox_db'");
    console.log('Students engine:', studentEngine[0]);
    console.log('Sections engine:', sectionEngine[0]);
    
    // Check column definitions
    console.log('\n=== COLUMN TYPES ===');
    const [studentCols] = await conn.query("DESCRIBE students");
    const [sectionCols] = await conn.query("DESCRIBE sections");
    
    const studentsSection = studentCols.find(col => col.Field === 'section_id');
    const sectionId = sectionCols.find(col => col.Field === 'id');
    
    console.log('students.section_id:', studentsSection);
    console.log('sections.id:', sectionId);
    
    conn.release();
    pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
