require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function create50Students() {
  console.log('👥 Creating 50 student users...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'attendbox_db'
  });

  try {
    // Hash the password once (same for all students)
    const password = '12345678';
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('🔐 Password hashed successfully\n');

    // Filipino student names (mix of common names)
    const firstNames = [
      'Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Rosa', 'Miguel', 'Luz', 'Carlos', 'Elena',
      'Ramon', 'Sofia', 'Rico', 'Isabel', 'Luis', 'Carmen', 'Angel', 'Teresa', 'Diego', 'Catalina',
      'Marco', 'Patricia', 'Javier', 'Andrea', 'Rafael', 'Cristina', 'Manuel', 'Laura', 'Antonio', 'Diana',
      'Gabriel', 'Beatriz', 'Fernando', 'Melissa', 'Jorge', 'Victoria', 'Roberto', 'Natalia', 'Daniel', 'Paula',
      'Ricardo', 'Gabriela', 'Andres', 'Adriana', 'Eduardo', 'Valeria', 'Felipe', 'Monica', 'Oscar', 'Juliana'
    ];

    const lastNames = [
      'Reyes', 'Santos', 'Cruz', 'Bautista', 'Garcia', 'Dela Cruz', 'Ramos', 'Mendoza', 'Torres', 'Flores',
      'Gonzales', 'Rivera', 'Castillo', 'Aquino', 'Mercado', 'Villanueva', 'Morales', 'Aguilar', 'Hernandez', 'Lopez',
      'Santiago', 'Romero', 'Diaz', 'Martinez', 'Fernandez', 'Pascual', 'Valdez', 'Navarro', 'Rojas', 'Castro',
      'Salazar', 'Gutierrez', 'Jimenez', 'Vasquez', 'Ortiz', 'Ruiz', 'Perez', 'Gomez', 'Alvarez', 'Dominguez',
      'Suarez', 'Ramirez', 'Velasco', 'Tan', 'Lim', 'Ong', 'Sy', 'Chua', 'Go', 'Ng'
    ];

    const grades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
    const sections = ['Section A', 'Section B', 'Section C', 'Section D'];
    const genders = ['M', 'F'];

    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i <= 50; i++) {
      try {
        // Generate student data
        const firstName = firstNames[i - 1];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const fullName = `${firstName} ${lastName}`;
        const username = `student${i}`;
        const lrn = `2026010000${String(i).padStart(2, '0')}`; // Unique 12-digit LRN starting with 2026
        const gender = genders[i % 2]; // Alternate M/F
        const grade = grades[Math.floor(Math.random() * grades.length)];
        const section = sections[Math.floor(Math.random() * sections.length)];
        const contact = `09${Math.floor(Math.random() * 900000000 + 100000000)}`; // Random PH mobile

        // Step 1: Insert into students table
        const [studentResult] = await connection.execute(
          `INSERT INTO students (lrn, name, gender, grade, section, is_active)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [lrn, fullName, gender, grade, section]
        );

        const studentId = studentResult.insertId;

        // Step 2: Insert into users table (role_id = 4 for student)
        const [userResult] = await connection.execute(
          `INSERT INTO users (username, password, role_id, is_active)
           VALUES (?, ?, 4, 1)`,
          [username, hashedPassword]
        );

        const userId = userResult.insertId;

        // Step 3: Link user to student
        await connection.execute(
          `UPDATE students SET user_id = ? WHERE id = ?`,
          [userId, studentId]
        );

        console.log(`✅ ${String(i).padStart(2, '0')}. ${username.padEnd(12)} | ${fullName.padEnd(25)} | ${grade} ${section}`);
        successCount++;

      } catch (error) {
        console.error(`❌ ${String(i).padStart(2, '0')}. Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('📊 Summary:');
    console.log('═'.repeat(80));
    console.log(`✅ Successfully created: ${successCount} students`);
    console.log(`❌ Failed: ${errorCount} students`);
    console.log(`📝 Username format: student1, student2, ... student50`);
    console.log(`🔑 Password (all): 12345678`);
    console.log(`👤 Role: Student (role_id = 4)`);
    console.log('\n📋 Sample Login Credentials:');
    console.log('─'.repeat(80));
    console.log('Username: student1  | Password: 12345678');
    console.log('Username: student2  | Password: 12345678');
    console.log('Username: student3  | Password: 12345678');
    console.log('...');
    console.log('Username: student50 | Password: 12345678');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  } finally {
    await connection.end();
  }
}

create50Students();
