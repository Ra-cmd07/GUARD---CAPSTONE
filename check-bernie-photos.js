const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'attendbox_db'
  });

  try {
    const [rows] = await pool.execute(
      `SELECT id, student_name, photo_path, date, status, timestamp 
       FROM attendance 
       WHERE student_name = 'Bernie' 
       ORDER BY id DESC 
       LIMIT 5`
    );

    console.log('Bernie\'s Recent Attendance Records:');
    console.log(JSON.stringify(rows, null, 2));

    // Check if photo files exist
    const fs = require('fs');
    const path = require('path');
    
    console.log('\n--- Checking Photo Files ---');
    for (const row of rows) {
      if (row.photo_path) {
        const fullPath = path.join(__dirname, '..', row.photo_path);
        const exists = fs.existsSync(fullPath);
        console.log(`\nRecord ${row.id}:`);
        console.log(`  Photo Path: ${row.photo_path}`);
        console.log(`  Full Path: ${fullPath}`);
        console.log(`  File Exists: ${exists ? 'YES ✓' : 'NO ✗'}`);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
