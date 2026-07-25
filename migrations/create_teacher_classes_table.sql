-- Migration: Create teacher_classes table
-- Date: 2026-07-25
-- Purpose: Support teachers with multiple classes at different times/subjects/sections

-- Step 1: Create teacher_classes table
CREATE TABLE IF NOT EXISTS `teacher_classes` (
  `id` INT(10) UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `teacher_id` INT(10) UNSIGNED NOT NULL,
  `section_id` INT(10) UNSIGNED NOT NULL,
  `subject` VARCHAR(100) NOT NULL,
  `time_start` TIME NOT NULL COMMENT 'Class start time (08:00:00)',
  `time_end` TIME NOT NULL COMMENT 'Class end time (09:00:00)',
  `day_of_week` ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL DEFAULT 'Monday',
  `room_number` VARCHAR(50) DEFAULT NULL,
  `capacity` INT(10) UNSIGNED DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` INT(10) UNSIGNED DEFAULT NULL,
  `updated_by` INT(10) UNSIGNED DEFAULT NULL,
  
  -- Foreign keys
  FOREIGN KEY `fk_teacher_classes_teacher_id` (teacher_id) REFERENCES `teachers`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY `fk_teacher_classes_section_id` (section_id) REFERENCES `sections`(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  
  -- Indexes for performance
  INDEX `idx_teacher_id` (teacher_id),
  INDEX `idx_section_id` (section_id),
  INDEX `idx_day_of_week` (day_of_week),
  INDEX `idx_time_range` (time_start, time_end),
  INDEX `idx_teacher_day_time` (teacher_id, day_of_week, time_start),
  
  -- Unique constraint: prevent duplicate class schedules
  UNIQUE KEY `unique_teacher_class_schedule` (teacher_id, section_id, time_start, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Step 2: Add teacher_class_id to attendance table (if not already present)
ALTER TABLE `attendance` ADD COLUMN `teacher_class_id` INT(10) UNSIGNED DEFAULT NULL AFTER `section_id`;
ALTER TABLE `attendance` ADD FOREIGN KEY `fk_attendance_teacher_class_id` (teacher_class_id) REFERENCES `teacher_classes`(id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX `idx_attendance_teacher_class_id` ON `attendance`(teacher_class_id);

-- Step 3: Sample data for Bernie (teacher_id = 2)
-- Assuming Grade 7-A = section_id 2, Grade 8-A = section_id 4

INSERT INTO `teacher_classes` (teacher_id, section_id, subject, time_start, time_end, day_of_week, room_number, capacity)
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
(2, 4, 'Science', '12:00:00', '13:00:00', 'Friday', '203', 38);

-- Step 4: Verify the setup
SELECT 
  'Total teacher_classes created' as message,
  COUNT(*) as count
FROM teacher_classes;

SELECT 
  'Verification: Bernie (teacher_id=2) schedule:' as message;

SELECT 
  tc.id,
  tc.subject,
  s.name as section_name,
  tc.time_start,
  tc.time_end,
  tc.day_of_week,
  tc.room_number,
  tc.capacity
FROM teacher_classes tc
JOIN sections s ON tc.section_id = s.id
WHERE tc.teacher_id = 2
ORDER BY tc.day_of_week, tc.time_start;
