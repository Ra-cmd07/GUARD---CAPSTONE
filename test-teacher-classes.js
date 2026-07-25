/**
 * Test script for Teacher Multiple Classes API endpoints
 * Tests all 7 endpoints with sample data for Bernie (teacher_id=2, user_id=4)
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000/api/teacher/classes';

let testsPassed = 0;
let testsFailed = 0;
let AUTH_TOKEN = 'WILL_BE_OBTAINED_FROM_LOGIN';

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        } catch (err) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testGetTeacherClasses() {
  console.log('\n📚 TEST 1: GET /api/teacher/classes (Get all classes for teacher)');
  try {
    const res = await makeRequest('GET', BASE_URL);
    
    if (res.status === 200 && res.body.success && res.body.classes) {
      console.log(`  ✅ PASS - Found ${res.body.total} classes`);
      console.log(`     Classes: ${res.body.classes.map(c => `${c.subject} (${c.section_name})`).join(', ')}`);
      testsPassed++;
      return res.body.classes;
    } else {
      console.log(`  ❌ FAIL - Status: ${res.status}, Response:`, res.body);
      testsFailed++;
      return [];
    }
  } catch (err) {
    console.log(`  ❌ ERROR:`, err.message);
    testsFailed++;
    return [];
  }
}

async function testGetTodayClasses() {
  console.log('\n📅 TEST 2: GET /api/teacher/classes/today (Get today\'s classes with status)');
  try {
    const res = await makeRequest('GET', `${BASE_URL}/today`);
    
    if (res.status === 200 && res.body.success && res.body.classes) {
      console.log(`  ✅ PASS - Found ${res.body.allClasses.length} classes for today`);
      console.log(`     Current: ${res.body.classes.current.length}, Upcoming: ${res.body.classes.upcoming.length}, Completed: ${res.body.classes.completed.length}`);
      if (res.body.summary.currentClass) {
        console.log(`     Current class: ${res.body.summary.currentClass.subject} (${res.body.summary.currentClass.section_name})`);
      }
      testsPassed++;
      return res.body.allClasses;
    } else {
      console.log(`  ❌ FAIL - Status: ${res.status}, Response:`, res.body);
      testsFailed++;
      return [];
    }
  } catch (err) {
    console.log(`  ❌ ERROR:`, err.message);
    testsFailed++;
    return [];
  }
}

async function testGetClassDetail(classId) {
  console.log(`\n🔍 TEST 3: GET /api/teacher/classes/:classId (Get class detail)`);
  try {
    const res = await makeRequest('GET', `${BASE_URL}/${classId}`);
    
    if (res.status === 200 && res.body.success && res.body.class) {
      console.log(`  ✅ PASS - Retrieved class: ${res.body.class.subject} in ${res.body.class.section_name}`);
      console.log(`     Time: ${res.body.class.time_start}-${res.body.class.time_end}, Room: ${res.body.class.room_number}, Students: ${res.body.class.enrolled_students}`);
      testsPassed++;
    } else {
      console.log(`  ❌ FAIL - Status: ${res.status}, Response:`, res.body);
      testsFailed++;
    }
  } catch (err) {
    console.log(`  ❌ ERROR:`, err.message);
    testsFailed++;
  }
}

async function testGetClassAttendance(classId) {
  console.log(`\n👥 TEST 4: GET /api/teacher/classes/:classId/attendance (Get class attendance)`);
  try {
    const res = await makeRequest('GET', `${BASE_URL}/${classId}/attendance`);
    
    if (res.status === 200 && res.body.success && res.body.stats) {
      console.log(`  ✅ PASS - Retrieved attendance for ${res.body.class.subject}`);
      console.log(`     Stats: Present=${res.body.stats.present}, Late=${res.body.stats.late}, Absent=${res.body.stats.absent}, Attendance Rate=${res.body.stats.attendanceRate}%`);
      testsPassed++;
    } else {
      console.log(`  ❌ FAIL - Status: ${res.status}, Response:`, res.body);
      testsFailed++;
    }
  } catch (err) {
    console.log(`  ❌ ERROR:`, err.message);
    testsFailed++;
  }
}

async function testCreateTeacherClass() {
  console.log(`\n➕ TEST 5: POST /api/teacher/classes (Create new class)`);
  try {
    const newClass = {
      section_id: 3,  // Grade 7-B (different section)
      subject: 'PE',
      time_start: '14:00:00',
      time_end: '15:00:00',
      day_of_week: 'Wednesday',
      room_number: '205',
      capacity: 50,
    };

    const res = await makeRequest('POST', BASE_URL, newClass);
    
    if (res.status === 201 && res.body.success && res.body.classId) {
      console.log(`  ✅ PASS - Created new class with ID: ${res.body.classId}`);
      console.log(`     ${res.body.class.subject} on ${res.body.class.day_of_week} at ${res.body.class.time_start}`);
      testsPassed++;
      return res.body.classId;
    } else {
      console.log(`  ❌ FAIL - Status: ${res.status}, Response:`, res.body);
      testsFailed++;
      return null;
    }
  } catch (err) {
    console.log(`  ❌ ERROR:`, err.message);
    testsFailed++;
    return null;
  }
}

async function testUpdateTeacherClass(classId) {
  console.log(`\n✏️  TEST 6: PUT /api/teacher/classes/:classId (Update class)`);
  try {
    const updates = {
      room_number: '204',
      capacity: 35,
    };

    const res = await makeRequest('PUT', `${BASE_URL}/${classId}`, updates);
    
    if (res.status === 200 && res.body.success) {
      console.log(`  ✅ PASS - Updated class ${classId}`);
      console.log(`     New room: 204, Capacity: 35`);
      testsPassed++;
    } else {
      console.log(`  ❌ FAIL - Status: ${res.status}, Response:`, res.body);
      testsFailed++;
    }
  } catch (err) {
    console.log(`  ❌ ERROR:`, err.message);
    testsFailed++;
  }
}

async function testDeleteTeacherClass(classId) {
  console.log(`\n🗑️  TEST 7: DELETE /api/teacher/classes/:classId (Delete/Deactivate class)`);
  try {
    const res = await makeRequest('DELETE', `${BASE_URL}/${classId}`);
    
    if (res.status === 200 && res.body.success) {
      console.log(`  ✅ PASS - Deleted class ${classId}`);
      testsPassed++;
    } else {
      console.log(`  ❌ FAIL - Status: ${res.status}, Response:`, res.body);
      testsFailed++;
    }
  } catch (err) {
    console.log(`  ❌ ERROR:`, err.message);
    testsFailed++;
  }
}

async function runAllTests() {
  console.log('=====================================');
  console.log('🧪 TEACHER CLASSES API TEST SUITE');
  console.log('=====================================');
  console.log(`Base URL: ${BASE_URL}`);
  
  // Step 1: Login to get token
  console.log('\n🔐 Logging in as Bernie...');
  try {
    const loginRes = await makeRequest('POST', 'http://localhost:5000/api/auth/login', {
      username: 'bernie',
      password: '12345678'
    });
    
    if (loginRes.status === 200 && loginRes.body.token) {
      AUTH_TOKEN = loginRes.body.token;
      console.log('✅ Login successful!');
      console.log(`   Token: ${AUTH_TOKEN.substring(0, 50)}...`);
    } else {
      console.log('❌ Login failed:', loginRes.body);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Login error:', err.message);
    process.exit(1);
  }
  
  console.log(`Teacher: Bernie (user_id=4)`);
  
  try {
    // Test 1: Get all classes
    const allClasses = await testGetTeacherClasses();
    
    // Test 2: Get today's classes
    await testGetTodayClasses();
    
    // Test 3 & 4: Get class detail and attendance (use first class from list)
    if (allClasses.length > 0) {
      const firstClass = allClasses[0];
      await testGetClassDetail(firstClass.id);
      await testGetClassAttendance(firstClass.id);
    }
    
    // Test 5: Create new class
    const newClassId = await testCreateTeacherClass();
    
    // Test 6: Update class
    if (newClassId) {
      await testUpdateTeacherClass(newClassId);
    }
    
    // Test 7: Delete class
    if (newClassId) {
      await testDeleteTeacherClass(newClassId);
    }
    
    // Print summary
    console.log('\n\n=====================================');
    console.log('📊 TEST SUMMARY');
    console.log('=====================================');
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📈 Total:  ${testsPassed + testsFailed}`);
    console.log(`📊 Pass Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
    
    if (testsFailed === 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
    } else {
      console.log(`\n⚠️  ${testsFailed} test(s) failed. Check errors above.`);
    }
    
    process.exit(testsFailed === 0 ? 0 : 1);
  } catch (err) {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  }
}

// Run tests
runAllTests();
