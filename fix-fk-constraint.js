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
    
    console.log('Starting foreign key constraint fix...\n');
    
    // 1. Drop old index on section column
    console.log('1. Dropping old section index...');
    try {
      await conn.query('ALTER TABLE students DROP INDEX idx_students_section');
      console.log('   ✓ Index dropped\n');
    } catch (err) {
      console.log('   ℹ Index does not exist or already dropped\n');
    }
    
    // 2. Modify column type to match sections.id (INT UNSIGNED)
    console.log('2. Fixing section_id column type...');
    await conn.query('ALTER TABLE students MODIFY COLUMN section_id INT(10) UNSIGNED NOT NULL');
    console.log('   ✓ Column type changed to INT(10) UNSIGNED\n');
    
    // 3. Add foreign key constraint
    console.log('3. Adding foreign key constraint...');
    await conn.query(`
      ALTER TABLE students ADD CONSTRAINT fk_students_section_id 
      FOREIGN KEY (section_id) REFERENCES sections(id) 
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    console.log('   ✓ Foreign key constraint created\n');
    
    // 4. Verify
    console.log('4. Verifying constraint...');
    const [constraints] = await conn.query(`
      SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME 
      FROM information_schema.REFERENTIAL_CONSTRAINTS 
      WHERE CONSTRAINT_NAME = 'fk_students_section_id'
    `);
    
    if (constraints.length > 0) {
      console.log('   ✓ Constraint verified:', constraints[0]);
    }
    
    console.log('\n✓ Foreign key constraint successfully created!');
    console.log('\nNext steps:');
    console.log('  - Test the constraint with invalid data (should fail)');
    console.log('  - When ready, drop the old section column:');
    console.log('    ALTER TABLE students DROP COLUMN section;');
    
    conn.release();
    pool.end();
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
})();
