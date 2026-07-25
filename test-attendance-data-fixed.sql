-- ============================================
-- TEST ATTENDANCE DATA FOR SF2 REPORT (FIXED)
-- ============================================
-- This script inserts sample attendance records for testing the SF2 Report feature
-- Uses the correct table names and structure
-- Date: 2026-07-24 (Today)

-- First, find your teacher's section by running:
-- SELECT section FROM teachers LIMIT 1;
-- Replace 'Grade 7 - Section 1' below with your actual section

-- STEP 1: Create test students if they don't exist
-- The section MUST match your teacher's section in the teachers table
INSERT IGNORE INTO `students` (
  `id`,
  `lrn`,
  `name`,
  `gender`,
  `grade`,
  `section`,
  `is_active`,
  `created_at`
) VALUES
(101, 'LRN001', 'John Doe', 'M', '7', 'Grade 7 - Section 1', 1, NOW()),
(102, 'LRN002', 'Jane Smith', 'F', '7', 'Grade 7 - Section 1', 1, NOW()),
(103, 'LRN003', 'Michael Brown', 'M', '7', 'Grade 7 - Section 1', 1, NOW()),
(104, 'LRN004', 'Sarah Davis', 'F', '7', 'Grade 7 - Section 1', 1, NOW()),
(105, 'LRN005', 'James Wilson', 'M', '7', 'Grade 7 - Section 1', 1, NOW()),
(106, 'LRN006', 'Emma Taylor', 'F', '7', 'Grade 7 - Section 1', 1, NOW()),
(107, 'LRN007', 'Oliver Martinez', 'M', '7', 'Grade 7 - Section 1', 1, NOW()),
(108, 'LRN008', 'Sophia Anderson', 'F', '7', 'Grade 7 - Section 1', 1, NOW()),
(109, 'LRN009', 'Lucas Thompson', 'M', '7', 'Grade 7 - Section 1', 1, NOW()),
(110, 'LRN010', 'Isabella Garcia', 'F', '7', 'Grade 7 - Section 1', 1, NOW());

-- STEP 2: Insert test attendance records for today
-- Using attendance table (the correct table in your database)
INSERT INTO `attendance` (
  `student_id`,
  `student_name`,
  `lrn`,
  `gender`,
  `grade`,
  `section`,
  `scan_method`,
  `status`,
  `session`,
  `date`,
  `time_in`,
  `time_out`,
  `timestamp`,
  `notes`,
  `is_overridden`
) VALUES
-- Present students (Time-In on 2026-07-24)
(101, 'John Doe', 'LRN001', 'M', '7', 'Grade 7 - Section 1', 'QR', 'Time-In', 'AM', '2026-07-24', '07:15:00', NULL, '2026-07-24 07:15:30', 'Arrived on time', 0),
(102, 'Jane Smith', 'LRN002', 'F', '7', 'Grade 7 - Section 1', 'RFID', 'Time-In', 'AM', '2026-07-24', '07:20:00', NULL, '2026-07-24 07:20:15', 'Arrived on time', 0),
(103, 'Michael Brown', 'LRN003', 'M', '7', 'Grade 7 - Section 1', 'QR', 'Time-In', 'AM', '2026-07-24', '07:18:00', NULL, '2026-07-24 07:18:45', NULL, 0),
(104, 'Sarah Davis', 'LRN004', 'F', '7', 'Grade 7 - Section 1', 'BLE', 'Time-In', 'AM', '2026-07-24', '07:22:00', NULL, '2026-07-24 07:22:30', NULL, 0),
(105, 'James Wilson', 'LRN005', 'M', '7', 'Grade 7 - Section 1', 'QR', 'Time-In', 'AM', '2026-07-24', '07:16:00', NULL, '2026-07-24 07:16:20', NULL, 0),

-- Late students (30+ minutes after 07:30 class start)
(106, 'Emma Taylor', 'LRN006', 'F', '7', 'Grade 7 - Section 1', 'QR', 'Late', 'AM', '2026-07-24', '08:05:00', NULL, '2026-07-24 08:05:45', 'Traffic delay', 0),
(107, 'Oliver Martinez', 'LRN007', 'M', '7', 'Grade 7 - Section 1', 'RFID', 'Late', 'AM', '2026-07-24', '08:15:00', NULL, '2026-07-24 08:15:30', 'Doctor appointment', 0),
(108, 'Sophia Anderson', 'LRN008', 'F', '7', 'Grade 7 - Section 1', 'QR', 'Late', 'AM', '2026-07-24', '08:10:00', NULL, '2026-07-24 08:10:15', NULL, 0),

-- Absent students (no time records)
(109, 'Lucas Thompson', 'LRN009', 'M', '7', 'Grade 7 - Section 1', 'Manual', 'Absent', 'AM', '2026-07-24', NULL, NULL, '2026-07-24 09:00:00', 'No record', 0),
(110, 'Isabella Garcia', 'LRN010', 'F', '7', 'Grade 7 - Section 1', 'Manual', 'Absent', 'AM', '2026-07-24', NULL, NULL, '2026-07-24 09:00:00', 'Sick leave', 0),

-- Time-Out records (same students, later in the day on 2026-07-24)
(101, 'John Doe', 'LRN001', 'M', '7', 'Grade 7 - Section 1', 'QR', 'Time-Out', 'PM', '2026-07-24', NULL, '16:30:00', '2026-07-24 16:30:45', NULL, 0),
(102, 'Jane Smith', 'LRN002', 'F', '7', 'Grade 7 - Section 1', 'RFID', 'Time-Out', 'PM', '2026-07-24', NULL, '16:35:00', '2026-07-24 16:35:20', NULL, 0),
(103, 'Michael Brown', 'LRN003', 'M', '7', 'Grade 7 - Section 1', 'QR', 'Time-Out', 'PM', '2026-07-24', NULL, '16:28:00', '2026-07-24 16:28:30', NULL, 0),
(104, 'Sarah Davis', 'LRN004', 'F', '7', 'Grade 7 - Section 1', 'BLE', 'Time-Out', 'PM', '2026-07-24', NULL, '16:32:00', '2026-07-24 16:32:15', NULL, 0),
(105, 'James Wilson', 'LRN005', 'M', '7', 'Grade 7 - Section 1', 'QR', 'Time-Out', 'PM', '2026-07-24', NULL, '16:29:00', '2026-07-24 16:29:45', NULL, 0),
(106, 'Emma Taylor', 'LRN006', 'F', '7', 'Grade 7 - Section 1', 'QR', 'Time-Out', 'PM', '2026-07-24', NULL, '16:31:00', '2026-07-24 16:31:30', NULL, 0),
(107, 'Oliver Martinez', 'LRN007', 'M', '7', 'Grade 7 - Section 1', 'RFID', 'Time-Out', 'PM', '2026-07-24', NULL, '16:33:00', '2026-07-24 16:33:20', NULL, 0),
(108, 'Sophia Anderson', 'LRN008', 'F', '7', 'Grade 7 - Section 1', 'QR', 'Time-Out', 'PM', '2026-07-24', NULL, '16:30:30', '2026-07-24 16:30:35', NULL, 0);

-- ============================================
-- SUMMARY OF TEST DATA
-- ============================================
-- Total students created: 10
-- Attendance records: 18 (8 AM + 10 Time-Out records)
--
-- Breakdown by status:
--   Present (Time-In): 5 students
--   Late: 3 students
--   Absent: 2 students
--   Time-Out: 8 records
--
-- For SF2 report (selected month: July 2026):
--   - Expected to see 10 students total
--   - 5 present on 2026-07-24
--   - 3 late on 2026-07-24
--   - 2 absent on 2026-07-24
