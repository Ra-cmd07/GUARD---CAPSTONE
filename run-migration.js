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

    // Check if section_id column exists
    const [columns] = await connection.query(
      'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = "attendance" AND COLUMN_NAME = "section_id"'
    );

    if (columns.length > 0) {
      console.log('✅ section_id column already exists');
      await connection.end();
      process.exit(0);
    }

    console.log('⏳ Adding section_id column to attendance table...');
    
    // Add section_id column
    await connection.query(
      'ALTER TABLE `attendance` ADD COLUMN `section_id` INT(10) UNSIGNED DEFAULT NULL AFTER `grade`'
    );
    console.log('✅ Column added');

    // Add foreign key
    try {
      await connection.query(
        'ALTER TABLE `attendance` ADD CONSTRAINT `fk_attendance_section_id` FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
      );
      console.log('✅ Foreign key added');
    } catch (err) {
      console.log('⚠️  Foreign key creation failed (might already exist):', err.message);
    }

    // Add indexes
    try {
      await connection.query(
        'CREATE INDEX `idx_attendance_section_id` ON `attendance`(`section_id`)'
      );
      console.log('✅ Index 1 added');
    } catch (err) {
      console.log('⚠️  Index 1 creation failed (might already exist)');
    }

    try {
      await connection.query(
        'CREATE INDEX `idx_attendance_student_date_section` ON `attendance`(`student_id`, `date`, `section_id`)'
      );
      console.log('✅ Index 2 added');
    } catch (err) {
      console.log('⚠️  Index 2 creation failed (might already exist)');
    }

    // Populate section_id from students
    const [result] = await connection.query(
      'UPDATE `attendance` a JOIN `students` s ON a.`student_id` = s.`id` SET a.`section_id` = s.`section_id` WHERE a.`section_id` IS NULL AND s.`section_id` IS NOT NULL'
    );
    console.log('✅ Populated section_id for', result.changedRows, 'attendance records');

    // Verify
    const [verify] = await connection.query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN section_id IS NOT NULL THEN 1 ELSE 0 END) as with_section_id FROM attendance'
    );
    console.log('\n📊 Final status:');
    console.log('   Total attendance records:', verify[0].total);
    console.log('   Records with section_id:', verify[0].with_section_id);

    await connection.end();
    console.log('\n✅ Migration complete! You can now restart the backend server.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error('SQL State:', err.sqlState);
    process.exit(1);
  }
})();
