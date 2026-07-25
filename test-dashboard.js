const mysql = require('mysql2/promise');

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'attendbox_db'
    });

    console.log('Testing getDashboardStats query...\n');

    const [rows] = await connection.query(`
      SELECT 
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
       LIMIT 5
    `);

    console.log('✅ Query successful! Sample results:');
    rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.student_name} | Section: ${row.section_name} (ID: ${row.section_id}) | Status: ${row.status}`);
    });

    console.log(`\n✅ Total records returned: ${rows.length}`);
    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
