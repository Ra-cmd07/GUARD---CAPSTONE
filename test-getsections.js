const mysql = require('mysql2/promise');

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'attendbox_db'
    });

    console.log('Testing getSections query...\n');

    const [sections] = await connection.query(`
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

    console.log('✅ Query successful! Results:\n');
    sections.forEach((sec, i) => {
      console.log(`${i+1}. ${sec.name} (Grade ${sec.grade}) - ${sec.student_count} students | Capacity: ${sec.capacity}`);
    });

    console.log(`\n✅ Total sections: ${sections.length}`);
    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
