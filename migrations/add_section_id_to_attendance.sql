-- Migration: Add section_id column to attendance table
-- Date: 2026-07-25
-- Purpose: Support section normalization with foreign key reference

ALTER TABLE `attendance` 
ADD COLUMN `section_id` INT(10) UNSIGNED DEFAULT NULL AFTER `grade`,
ADD FOREIGN KEY `fk_attendance_section_id` (section_id) REFERENCES `sections`(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for performance
CREATE INDEX idx_attendance_section_id ON `attendance`(section_id);
CREATE INDEX idx_attendance_student_date_section ON `attendance`(student_id, date, section_id);

-- Populate section_id from students table where possible
UPDATE `attendance` a
JOIN `students` s ON a.student_id = s.id
SET a.section_id = s.section_id
WHERE a.section_id IS NULL AND s.section_id IS NOT NULL;

-- Log the migration
SELECT CONCAT('✅ Migration complete: ', 
  (SELECT COUNT(*) FROM attendance WHERE section_id IS NOT NULL), 
  ' attendance records now have section_id') as status;
