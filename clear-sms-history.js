const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'attendbox_db'
  });

  try {
    console.log('🗑️  Clearing SMS history...\n');
    
    // Count current records
    const [countBefore] = await pool.execute('SELECT COUNT(*) as total FROM sms_logs');
    const totalBefore = countBefore[0].total;
    
    console.log(`📊 Current SMS logs: ${totalBefore} records\n`);
    
    if (totalBefore === 0) {
      console.log('✅ SMS history is already empty!');
      return;
    }
    
    // Show sample of what will be deleted
    console.log('📋 Sample records to be deleted:');
    const [samples] = await pool.execute(
      'SELECT id, student_name, parent_name, message, created_at FROM sms_logs ORDER BY created_at DESC LIMIT 5'
    );
    console.table(samples);
    
    // Delete all SMS logs
    console.log('\n🗑️  Deleting all SMS logs...');
    const [result] = await pool.execute('DELETE FROM sms_logs');
    
    console.log(`✅ Deleted ${result.affectedRows} SMS log records\n`);
    
    // Verify deletion
    const [countAfter] = await pool.execute('SELECT COUNT(*) as total FROM sms_logs');
    const totalAfter = countAfter[0].total;
    
    console.log(`📊 SMS logs remaining: ${totalAfter} records\n`);
    
    console.log('✅ SMS history cleared!');
    console.log('✅ System will continue logging new SMS');
    console.log('✅ New attendance scans will create new SMS logs');
    console.log('\n📝 Note: This only deletes old logs, the SMS feature still works!');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();
