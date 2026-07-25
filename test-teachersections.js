const mysql = require('mysql2/promise');

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'attendbox_db'
    });

    console.log('Testing getTeacherSections query...\n');

    // First get a teacher that exists
    const [teachers] = await connection.query('SELECT id FROM teachers LIMIT 1');
    
    if (teachers.length === 0) {
      console.log('⚠️  No teachers found in database');
      await connection.end();
      process.exit(0);
    }

    const teacherId = teachers[0].id;
    console.log(`Testing with teacher ID: ${teacherId}\n`);

    const [sections] = await connection.query(`
      SELECT s.id, s.name, s.grade, s.section_code, s.room_number, s.capacity,
              ts.is_primary,
              COUNT(st.id) as student_count
       FROM sections s
       JOIN teacher_sections ts ON s.id = ts.section_id
       JOIN teachers t ON ts.teacher_id = t.id
       LEFT JOIN students st ON st.section_id = s.id
       WHERE t.id = ?
       GROUP BY s.id
       ORDER BY ts.is_primary DESC, s.name
    `, [teacherId]);

    if (sections.length === 0) {
      console.log('⚠️  Teacher has no assigned sections');
      await connection.end();
      process.exit(0);
    }

    console.log('✅ Query successful! Results:\n');
    sections.forEach((sec, i) => {
      const primary = sec.is_primary ? '(PRIMARY)' : '';
      console.log(`${i+1}. ${sec.name} (Grade ${sec.grade}) - ${sec.student_count} students ${primary}`);
    });

    console.log(`\n✅ Total assigned sections: ${sections.length}`);
    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
