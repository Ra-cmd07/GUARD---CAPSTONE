const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'attendbox_db'
    });

    // Get Bernie's password hash
    const [users] = await connection.query(`
      SELECT u.id, u.username, u.password, t.name
      FROM users u
      JOIN teachers t ON t.user_id = u.id
      WHERE t.id = 2
      LIMIT 1
    `);

    if (users.length > 0) {
      const user = users[0];
      console.log('Bernie found:');
      console.log(`  username: ${user.username}`);
      console.log(`  name: ${user.name}`);
      console.log(`  password hash: ${user.password.substring(0, 40)}...`);
      
      // Test various passwords
      const testPasswords = ['password123', 'password', 'Bernie', 'bernie', '123456'];
      console.log('\nTesting passwords:');
      
      for (const pwd of testPasswords) {
        const match = await bcrypt.compare(pwd, user.password);
        console.log(`  ${pwd}: ${match ? '✅ MATCH' : '❌'}`);
      }
    } else {
      console.log('Bernie not found');
    }

    await connection.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
