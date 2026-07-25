const mysql = require('mysql2/promise');

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'attendbox_db'
    });

    console.log('✅ Connected to database');
    console.log('\n⏳ Running teacher_classes table migration...\n');

    // Create teacher_classes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`teacher_classes\` (
        \`id\` INT(10) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        \`teacher_id\` INT(10) UNSIGNED NOT NULL,
        \`section_id\` INT(10) UNSIGNED NOT NULL,
        \`subject\` VARCHAR(100) NOT NULL,
        \`time_start\` TIME NOT NULL COMMENT 'Class start time (08:00:00)',
        \`time_end\` TIME NOT NULL COMMENT 'Class end time (09:00:00)',
        \`day_of_week\` ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL DEFAULT 'Monday',
        \`room_number\` VARCHAR(50) DEFAULT NULL,
        \`capacity\` INT(10) UNSIGNED DEFAULT NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT(10) UNSIGNED DEFAULT NULL,
        \`updated_by\` INT(10) UNSIGNED DEFAULT NULL,
        
        FOREIGN KEY \`fk_teacher_classes_teacher_id\` (teacher_id) REFERENCES \`teachers\`(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY \`fk_teacher_classes_section_id\` (section_id) REFERENCES \`sections\`(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        
        INDEX \`idx_teacher_id\` (teacher_id),
        INDEX \`idx_section_id\` (section_id),
        INDEX \`idx_day_of_week\` (day_of_week),
        INDEX \`idx_time_range\` (time_start, time_end),
        INDEX \`idx_teacher_day_time\` (teacher_id, day_of_week, time_start),
        
        UNIQUE KEY \`unique_teacher_class_schedule\` (teacher_id, section_id, time_start, day_of_week)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    console.log('✅ teacher_classes table created');

    // Check if teacher_class_id column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'attendance' AND COLUMN_NAME = 'teacher_class_id'
    `);

    if (columns.length === 0) {
      console.log('⏳ Adding teacher_class_id column to attendance table...');
      
      await connection.query(`
        ALTER TABLE \`attendance\` ADD COLUMN \`teacher_class_id\` INT(10) UNSIGNED DEFAULT NULL AFTER \`section_id\`
      `);
      console.log('✅ teacher_class_id column added');

      try {
        await connection.query(`
          ALTER TABLE \`attendance\` ADD FOREIGN KEY \`fk_attendance_teacher_class_id\` 
          (teacher_class_id) REFERENCES \`teacher_classes\`(id) ON DELETE SET NULL ON UPDATE CASCADE
        `);
        console.log('✅ Foreign key added');
      } catch (err) {
        console.log('⚠️  Foreign key may already exist:', err.message);
      }

      try {
        await connection.query(`
          CREATE INDEX \`idx_attendance_teacher_class_id\` ON \`attendance\`(teacher_class_id)
        `);
        console.log('✅ Index created');
      } catch (err) {
        console.log('⚠️  Index may already exist');
      }
    } else {
      console.log('✅ teacher_class_id column already exists');
    }

    // Insert sample data for Bernie
    console.log('\n⏳ Inserting sample data for Bernie (teacher_id=2)...\n');
    
    const [insertResult] = await connection.query(`
      INSERT INTO \`teacher_classes\` (teacher_id, section_id, subject, time_start, time_end, day_of_week, room_number, capacity)
      VALUES
      -- Math classes for Grade 7-A (Monday-Friday, 8am-9am)
      (2, 2, 'Math', '08:00:00', '09:00:00', 'Monday', '201', 40),
      (2, 2, 'Math', '08:00:00', '09:00:00', 'Tuesday', '201', 40),
      (2, 2, 'Math', '08:00:00', '09:00:00', 'Wednesday', '201', 40),
      (2, 2, 'Math', '08:00:00', '09:00:00', 'Thursday', '201', 40),
      (2, 2, 'Math', '08:00:00', '09:00:00', 'Friday', '201', 40),
      -- Science classes for Grade 8-A (Monday-Friday, 12pm-1pm)
      (2, 4, 'Science', '12:00:00', '13:00:00', 'Monday', '203', 38),
      (2, 4, 'Science', '12:00:00', '13:00:00', 'Tuesday', '203', 38),
      (2, 4, 'Science', '12:00:00', '13:00:00', 'Wednesday', '203', 38),
      (2, 4, 'Science', '12:00:00', '13:00:00', 'Thursday', '203', 38),
      (2, 4, 'Science', '12:00:00', '13:00:00', 'Friday', '203', 38)
      ON DUPLICATE KEY UPDATE updated_at = NOW()
    `);

    console.log(`✅ Inserted ${insertResult.affectedRows} class schedules`);

    // Verify the setup
    console.log('\n📊 VERIFICATION - Bernie\'s Class Schedule:\n');
    
    const [schedule] = await connection.query(`
      SELECT 
        tc.id,
        tc.subject,
        s.name as section_name,
        tc.time_start,
        tc.time_end,
        tc.day_of_week,
        tc.room_number,
        tc.capacity,
        (SELECT COUNT(*) FROM students WHERE section_id = tc.section_id) as enrolled_students
      FROM teacher_classes tc
      JOIN sections s ON tc.section_id = s.id
      WHERE tc.teacher_id = 2
      ORDER BY FIELD(tc.day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday'),
               tc.time_start
    `);

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    schedule.forEach((row) => {
      console.log(`${row.day_of_week.padEnd(12)} | ${row.time_start}-${row.time_end} | ${row.subject.padEnd(10)} | ${row.section_name.padEnd(15)} | Room ${row.room_number} | ${row.enrolled_students} students`);
    });

    console.log('\n✅ Total class schedules for Bernie: ' + schedule.length);

    await connection.end();
    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error('\nIf you get "Duplicate entry" error, the tables already exist (this is OK)');
    process.exit(1);
  }
})();
