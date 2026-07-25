-- ============================================================
-- Migration: Add multi-section support for teachers
-- ============================================================

-- Create SECTIONS table
CREATE TABLE IF NOT EXISTS `sections` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(100) NOT NULL COMMENT 'e.g., Grade 7 - Section A',
  `grade`        VARCHAR(20)  DEFAULT NULL,
  `section_code` VARCHAR(50)  DEFAULT NULL COMMENT 'e.g., G7-A',
  `room_number`  VARCHAR(50)  DEFAULT NULL,
  `capacity`     INT UNSIGNED DEFAULT NULL,
  `is_active`    TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by`   INT UNSIGNED DEFAULT NULL,
  `updated_by`   INT UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sections_name` (`name`),
  KEY `idx_sections_grade` (`grade`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create TEACHER_SECTIONS junction table
CREATE TABLE IF NOT EXISTS `teacher_sections` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `teacher_id` INT UNSIGNED NOT NULL,
  `section_id` INT UNSIGNED NOT NULL,
  `is_primary` TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'True if primary advisor',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_teacher_section` (`teacher_id`, `section_id`),
  KEY `idx_ts_section_id` (`section_id`),
  CONSTRAINT `fk_ts_teacher`
    FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ts_section`
    FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Populate sections from existing teacher section values
INSERT IGNORE INTO `sections` (name, grade, section_code, is_active) 
SELECT DISTINCT 
  section as name,
  CASE WHEN section LIKE '%Grade%' THEN SUBSTRING_INDEX(SUBSTRING(section, POSITION('Grade' IN section)), ' ', 2) ELSE NULL END as grade,
  SUBSTRING_INDEX(section, ' ', -1) as section_code,
  1
FROM teachers 
WHERE section IS NOT NULL AND section != '';

-- Link teachers to sections
INSERT IGNORE INTO `teacher_sections` (teacher_id, section_id, is_primary)
SELECT DISTINCT t.id, s.id, 1
FROM teachers t
JOIN sections s ON t.section = s.name
WHERE t.section IS NOT NULL AND t.section != '';
