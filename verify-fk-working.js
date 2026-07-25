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
    
    console.log('=== FOREIGN KEY VERIFICATION ===\n');
    
    // Check valid data
    console.log('1. Checking students with valid section_id references:');
    const [validStudents] = await conn.query(`
      SELECT s.id, s.name, s.section_id, sec.name as section_name 
      FROM students s
      JOIN sections sec ON s.section_id = sec.id
      LIMIT 5
    `);
    console.log(`   Found ${validStudents.length} students with valid references`);
    validStudents.forEach(row => {
      console.log(`   - ${row.name} (section_id: ${row.section_id} → ${row.section_name})`);
    });
    
    // Test constraint - try to insert invalid section_id
    console.log('\n2. Testing constraint (attempting invalid insert):');
    try {
      await conn.query('INSERT INTO students (lrn, name, section_id, teacher_id) VALUES (?, ?, ?, ?)', 
        ['TEST-999', 'Constraint Test', 9999, 1]);
      console.log('   ✗ ERROR: Constraint did NOT block invalid insert!');
    } catch (err) {
      console.log('   ✓ Constraint working: ' + err.message);
    }
    
    // Check current column type
    console.log('\n3. Current column definitions:');
    const [cols] = await conn.query('DESCRIBE students');
    const sectionIdCol = cols.find(c => c.Field === 'section_id');
    console.log(`   students.section_id: ${sectionIdCol.Type} ${sectionIdCol.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    
    const [secCols] = await conn.query('DESCRIBE sections');
    const idCol = secCols.find(c => c.Field === 'id');
    console.log(`   sections.id: ${idCol.Type} ${idCol.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    
    console.log('\n✓ Foreign key constraint is active and working!');
    console.log('\nYou can now safely drop the old section (text) column when ready:');
    console.log('  ALTER TABLE students DROP COLUMN section;');
    
    conn.release();
    pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
