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
    
    console.log('=== EXISTING CONSTRAINTS ON STUDENTS ===');
    const [constraints] = await conn.query(`
      SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_NAME = 'students' AND TABLE_SCHEMA = 'attendbox_db'
    `);
    console.log(constraints);
    
    console.log('\n=== EXISTING FOREIGN KEYS ON STUDENTS ===');
    const [fks] = await conn.query(`
      SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'students' AND TABLE_SCHEMA = 'attendbox_db' AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    console.log(fks);
    
    console.log('\n=== REFERENTIAL CONSTRAINTS ===');
    const [refConstraints] = await conn.query(`
      SELECT * FROM information_schema.REFERENTIAL_CONSTRAINTS 
      WHERE CONSTRAINT_SCHEMA = 'attendbox_db' AND TABLE_NAME = 'students'
    `);
    console.log(refConstraints);
    
    conn.release();
    pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
