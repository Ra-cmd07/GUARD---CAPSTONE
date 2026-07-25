-- ============================================================
-- Multi-Section Test Data for Teacher Dashboard
-- ============================================================

-- 1. Create sections (if they don't exist)
INSERT IGNORE INTO `sections` (name, grade, section_code, is_active) VALUES
('Grade 7 - Section A', '7', 'A', 1),
('Grade 7 - Section B', '7', 'B', 1),
('Grade 8 - Section A', '8', 'A', 1);

-- 2. Link Bernie (teacher_id = 2) to all sections
-- Get section IDs and link them
INSERT IGNORE INTO `teacher_sections` (teacher_id, section_id, is_primary) 
SELECT 2, id, CASE WHEN name = 'Grade 7 - Section A' THEN 1 ELSE 0 END
FROM sections 
WHERE name IN ('Grade 7 - Section A', 'Grade 7 - Section B', 'Grade 8 - Section A');

-- 3. Create students for Grade 7 - Section A (IDs 201-208)
INSERT IGNORE INTO `students` (id, lrn, name, gender, grade, section, teacher_id, is_active) VALUES
(201, 'LRN000201', 'Alice Johnson', 'F', 'Grade 7', 'Grade 7 - Section A', 2, 1),
(202, 'LRN000202', 'Bob Smith', 'M', 'Grade 7', 'Grade 7 - Section A', 2, 1),
(203, 'LRN000203', 'Carol Davis', 'F', 'Grade 7', 'Grade 7 - Section A', 2, 1),
(204, 'LRN000204', 'David Brown', 'M', 'Grade 7', 'Grade 7 - Section A', 2, 1),
(205, 'LRN000205', 'Emma Wilson', 'F', 'Grade 7', 'Grade 7 - Section A', 2, 1),
(206, 'LRN000206', 'Frank Miller', 'M', 'Grade 7', 'Grade 7 - Section A', 2, 1),
(207, 'LRN000207', 'Grace Lee', 'F', 'Grade 7', 'Grade 7 - Section A', 2, 1),
(208, 'LRN000208', 'Henry Taylor', 'M', 'Grade 7', 'Grade 7 - Section A', 2, 1);

-- 4. Create students for Grade 7 - Section B (IDs 209-216)
INSERT IGNORE INTO `students` (id, lrn, name, gender, grade, section, teacher_id, is_active) VALUES
(209, 'LRN000209', 'Isabella Garcia', 'F', 'Grade 7', 'Grade 7 - Section B', 2, 1),
(210, 'LRN000210', 'James Martinez', 'M', 'Grade 7', 'Grade 7 - Section B', 2, 1),
(211, 'LRN000211', 'Kylie Anderson', 'F', 'Grade 7', 'Grade 7 - Section B', 2, 1),
(212, 'LRN000212', 'Liam Thomas', 'M', 'Grade 7', 'Grade 7 - Section B', 2, 1),
(213, 'LRN000213', 'Mia Jackson', 'F', 'Grade 7', 'Grade 7 - Section B', 2, 1),
(214, 'LRN000214', 'Noah White', 'M', 'Grade 7', 'Grade 7 - Section B', 2, 1),
(215, 'LRN000215', 'Olivia Harris', 'F', 'Grade 7', 'Grade 7 - Section B', 2, 1),
(216, 'LRN000216', 'Patrick Clark', 'M', 'Grade 7', 'Grade 7 - Section B', 2, 1);

-- 5. Create students for Grade 8 - Section A (IDs 217-224)
INSERT IGNORE INTO `students` (id, lrn, name, gender, grade, section, teacher_id, is_active) VALUES
(217, 'LRN000217', 'Quinn Lewis', 'F', 'Grade 8', 'Grade 8 - Section A', 2, 1),
(218, 'LRN000218', 'Robert Walker', 'M', 'Grade 8', 'Grade 8 - Section A', 2, 1),
(219, 'LRN000219', 'Sophia Hall', 'F', 'Grade 8', 'Grade 8 - Section A', 2, 1),
(220, 'LRN000220', 'Thomas Young', 'M', 'Grade 8', 'Grade 8 - Section A', 2, 1),
(221, 'LRN000221', 'Uma Hernandez', 'F', 'Grade 8', 'Grade 8 - Section A', 2, 1),
(222, 'LRN000222', 'Victor King', 'M', 'Grade 8', 'Grade 8 - Section A', 2, 1),
(223, 'LRN000223', 'Wendy Wright', 'F', 'Grade 8', 'Grade 8 - Section A', 2, 1),
(224, 'LRN000224', 'Xavier Lopez', 'M', 'Grade 8', 'Grade 8 - Section A', 2, 1);

-- 6. Create TODAY's attendance records for Grade 7 - Section A
INSERT IGNORE INTO `attendance` 
(student_id, student_name, lrn, gender, grade, section, teacher_id, teacher_name, scan_method, status, session, date, time_in, timestamp) 
VALUES
-- Present students
(201, 'Alice Johnson', 'LRN000201', 'F', 'Grade 7', 'Grade 7 - Section A', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:15:00', NOW()),
(202, 'Bob Smith', 'LRN000202', 'M', 'Grade 7', 'Grade 7 - Section A', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:18:00', NOW()),
(203, 'Carol Davis', 'LRN000203', 'F', 'Grade 7', 'Grade 7 - Section A', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:20:00', NOW()),
-- Late students
(204, 'David Brown', 'LRN000204', 'M', 'Grade 7', 'Grade 7 - Section A', 2, 'Bernie', 'Manual', 'Late', 'AM', CURDATE(), '08:15:00', NOW()),
(205, 'Emma Wilson', 'LRN000205', 'F', 'Grade 7', 'Grade 7 - Section A', 2, 'Bernie', 'Manual', 'Late', 'AM', CURDATE(), '08:20:00', NOW()),
-- Absent students (no time_in)
(206, 'Frank Miller', 'LRN000206', 'M', 'Grade 7', 'Grade 7 - Section A', 2, 'Bernie', 'Manual', 'Absent', 'AM', CURDATE(), NULL, NOW()),
(207, 'Grace Lee', 'LRN000207', 'F', 'Grade 7', 'Grade 7 - Section A', 2, 'Bernie', 'Manual', 'Absent', 'AM', CURDATE(), NULL, NOW());

-- 7. Create TODAY's attendance records for Grade 7 - Section B
INSERT IGNORE INTO `attendance` 
(student_id, student_name, lrn, gender, grade, section, teacher_id, teacher_name, scan_method, status, session, date, time_in, timestamp) 
VALUES
-- Present students
(209, 'Isabella Garcia', 'LRN000209', 'F', 'Grade 7', 'Grade 7 - Section B', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:16:00', NOW()),
(210, 'James Martinez', 'LRN000210', 'M', 'Grade 7', 'Grade 7 - Section B', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:19:00', NOW()),
(211, 'Kylie Anderson', 'LRN000211', 'F', 'Grade 7', 'Grade 7 - Section B', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:21:00', NOW()),
(212, 'Liam Thomas', 'LRN000212', 'M', 'Grade 7', 'Grade 7 - Section B', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:17:00', NOW()),
-- Late students
(213, 'Mia Jackson', 'LRN000213', 'F', 'Grade 7', 'Grade 7 - Section B', 2, 'Bernie', 'Manual', 'Late', 'AM', CURDATE(), '08:10:00', NOW()),
-- Absent students
(214, 'Noah White', 'LRN000214', 'M', 'Grade 7', 'Grade 7 - Section B', 2, 'Bernie', 'Manual', 'Absent', 'AM', CURDATE(), NULL, NOW()),
(215, 'Olivia Harris', 'LRN000215', 'F', 'Grade 7', 'Grade 7 - Section B', 2, 'Bernie', 'Manual', 'Absent', 'AM', CURDATE(), NULL, NOW()),
(216, 'Patrick Clark', 'LRN000216', 'M', 'Grade 7', 'Grade 7 - Section B', 2, 'Bernie', 'Manual', 'Absent', 'AM', CURDATE(), NULL, NOW());

-- 8. Create TODAY's attendance records for Grade 8 - Section A
INSERT IGNORE INTO `attendance` 
(student_id, student_name, lrn, gender, grade, section, teacher_id, teacher_name, scan_method, status, session, date, time_in, timestamp) 
VALUES
-- Present students
(217, 'Quinn Lewis', 'LRN000217', 'F', 'Grade 8', 'Grade 8 - Section A', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:14:00', NOW()),
(218, 'Robert Walker', 'LRN000218', 'M', 'Grade 8', 'Grade 8 - Section A', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:22:00', NOW()),
(219, 'Sophia Hall', 'LRN000219', 'F', 'Grade 8', 'Grade 8 - Section A', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:18:00', NOW()),
(220, 'Thomas Young', 'LRN000220', 'M', 'Grade 8', 'Grade 8 - Section A', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:16:00', NOW()),
(221, 'Uma Hernandez', 'LRN000221', 'F', 'Grade 8', 'Grade 8 - Section A', 2, 'Bernie', 'Manual', 'Time-In', 'AM', CURDATE(), '07:20:00', NOW()),
-- Late students
(222, 'Victor King', 'LRN000222', 'M', 'Grade 8', 'Grade 8 - Section A', 2, 'Bernie', 'Manual', 'Late', 'AM', CURDATE(), '08:05:00', NOW()),
-- Absent students
(223, 'Wendy Wright', 'LRN000223', 'F', 'Grade 8', 'Grade 8 - Section A', 2, 'Bernie', 'Manual', 'Absent', 'AM', CURDATE(), NULL, NOW()),
(224, 'Xavier Lopez', 'LRN000224', 'M', 'Grade 8', 'Grade 8 - Section A', 2, 'Bernie', 'Manual', 'Absent', 'AM', CURDATE(), NULL, NOW());

-- ============================================================
-- VERIFICATION QUERIES (run these to verify data was created)
-- ============================================================

-- Check sections created
-- SELECT id, name, grade, section_code FROM sections ORDER BY name;

-- Check Bernie's assigned sections
-- SELECT ts.*, s.name as section_name FROM teacher_sections ts
-- JOIN sections s ON ts.section_id = s.id
-- WHERE ts.teacher_id = 2;

-- Check students in each section
-- SELECT id, name, section, COUNT(*) as student_count FROM students 
-- WHERE teacher_id = 2 GROUP BY section ORDER BY section;

-- Check today's attendance by section
-- SELECT section, status, COUNT(*) as count FROM attendance 
-- WHERE teacher_id = 2 AND DATE(date) = CURDATE()
-- GROUP BY section, status;

-- Check section dropdown data (what the API returns)
-- SELECT s.id, s.name, s.grade, s.section_code, s.room_number, s.capacity,
--        ts.is_primary, COUNT(st.id) as student_count
-- FROM sections s
-- JOIN teacher_sections ts ON s.id = ts.section_id
-- JOIN teachers t ON ts.teacher_id = t.id
-- LEFT JOIN students st ON st.section = s.name AND st.teacher_id = t.id
-- WHERE t.user_id = 4  -- Bernie's user_id
-- GROUP BY s.id
-- ORDER BY ts.is_primary DESC, s.name;
