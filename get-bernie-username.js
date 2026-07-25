const mysql = require('mysql2/promise');

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'attendbox_db'
    });

    // Get Bernie's user info (teacher_id=2)
    const [users] = await connection.query(`
      SELECT u.id, u.username, u.is_active, t.name, t.id as teacher_id
      FROM users u
      JOIN teachers t ON t.user_id = u.id
      WHERE t.id = 2
      LIMIT 1
    `);

    if (users.length > 0) {
      console.log('Bernie found:');
      console.log(`  username: ${users[0].username}`);
      console.log(`  user_id: ${users[0].id}`);
      console.log(`  teacher_id: ${users[0].teacher_id}`);
      console.log(`  name: ${users[0].name}`);
    } else {
      console.log('Bernie not found');
    }

    await connection.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
