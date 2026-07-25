-- ============================================================================
-- Migration: Change from section (TEXT) to section_id (FOREIGN KEY)
-- ============================================================================
-- This migration normalizes the database by replacing section name strings
-- with foreign key references to the sections table.
-- ============================================================================

-- Step 1: Add the new section_id column to students table
-- (It will be nullable during migration)
ALTER TABLE students 
ADD COLUMN section_id INT NULL 
AFTER grade;

-- Step 2: Populate section_id based on existing section names
-- This matches students.section with sections.name
UPDATE students s
SET s.section_id = (
  SELECT sec.id FROM sections sec 
  WHERE sec.name = s.section
)
WHERE s.section IS NOT NULL AND s.section != '';

-- Step 3: Make section_id NOT NULL (after data is populated)
-- First, set a default for any rows that didn't match
UPDATE students SET section_id = 1 WHERE section_id IS NULL;

-- Then alter the column
ALTER TABLE students 
MODIFY COLUMN section_id INT NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE students 
ADD CONSTRAINT fk_students_section_id 
FOREIGN KEY (section_id) REFERENCES sections(id) 
ON DELETE RESTRICT 
ON UPDATE CASCADE;

-- Step 5: Drop the old section column (OPTIONAL - keep for now if needed)
-- ALTER TABLE students DROP COLUMN section;

-- Step 6: Verify the migration
-- Run this to check all students have valid section_id
SELECT s.id, s.name, s.section_id, sec.name as section_name 
FROM students s
LEFT JOIN sections sec ON s.section_id = sec.id
ORDER BY s.id;

-- ============================================================================
-- ROLLBACK (if something goes wrong):
-- ============================================================================
-- ALTER TABLE students DROP FOREIGN KEY fk_students_section_id;
-- ALTER TABLE students DROP COLUMN section_id;
-- ============================================================================
