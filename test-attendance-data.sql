-- ============================================
-- TEST ATTENDANCE DATA FOR SF2 REPORT
-- ============================================
-- This script inserts sample attendance records for testing the SF2 Report feature
-- Uses the correct table name: attendance_logs (not attendance)
-- Date: 2026-07-24 (Today)

-- IMPORTANT: Update 'Grade 7 - Section 1' to match your teacher's actual section!
-- Run this to find your teacher section:
-- SELECT JSON_UNQUOTE(JSON_EXTRACT(profile, '$.section')) as section FROM users WHERE role = 'teacher' LIMIT 1;

-- STEP 1: First, create test students (if they don't exist)
-- Replace 'Grade 7 - Section 1' with your actual teacher's section
INSERT IGNORE INTO `students` (
  `id`,
  `name`,
  `lrn`,
  `gender`,
  `grade`,
  `section`,
  `created_at`
) VALUES
(101, 'John Doe', 'LRN001', 'M', '7', 'Grade 7 - Section 1', NOW()),
(102, 'Jane Smith', 'LRN002', 'F', '7', 'Grade 7 - Section 1', NOW()),
(103, 'Michael Brown', 'LRN003', 'M', '7', 'Grade 7 - Section 1', NOW()),
(104, 'Sarah Davis', 'LRN004', 'F', '7', 'Grade 7 - Section 1', NOW()),
(105, 'James Wilson', 'LRN005', 'M', '7', 'Grade 7 - Section 1', NOW()),
(106, 'Emma Taylor', 'LRN006', 'F', '7', 'Grade 7 - Section 1', NOW()),
(107, 'Oliver Martinez', 'LRN007', 'M', '7', 'Grade 7 - Section 1', NOW()),
(108, 'Sophia Anderson', 'LRN008', 'F', '7', 'Grade 7 - Section 1', NOW()),
(109, 'Lucas Thompson', 'LRN009', 'M', '7', 'Grade 7 - Section 1', NOW()),
(110, 'Isabella Garcia', 'LRN010', 'F', '7', 'Grade 7 - Section 1', NOW());

-- STEP 2: Insert test attendance records for today
-- Using attendance_logs table (the correct table used by the API)
INSERT INTO `attendance_logs` (
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
-- Present students (Time-In)
(101, 'John Doe', 'LRN001', 'M', '7', 'Grade 7 - Section 1', 'QR', 'Time-In', 'AM', '2026-07-24', '07:15:00', NULL, '2026-07-24 07:15:30', 'Arrived on time', 0),
(102, 'Jane Smith', 'LRN002', 'F', '7', 'Grade 7 - Section 1', 'RFID', 'Time-In', 'AM', '2026-07-24', '07:20:00', NULL, '2026-07-24 07:20:15', 'Arrived on time', 0),
(103, 'Michael Brown', 'LRN003', 'M', '7', 'Grade 7 - Section 1', 'QR', 'Time-In', 'AM', '2026-07-24', '07:18:00', NULL, '2026-07-24 07:18:45', NULL, 0),
(104, 'Sarah Davis', 'LRN004', 'F', '7', 'Grade 7 - Section 1', 'BLE', 'Time-In', 'AM', '2026-07-24', '07:22:00', NULL, '2026-07-24 07:22:30', NULL, 0),
(105, 'James Wilson', 'LRN005', 'M', '7', 'Grade 7 - Section 1', 'QR', 'Time-In', 'AM', '2026-07-24', '07:16:00', NULL, '2026-07-24 07:16:20', NULL, 0),
-- Late students (30+ minutes after 07:30 class start)
(106, 'Emma Taylor', 'LRN006', 'F', '7', 'Grade 7 - Section 1', 'QR', 'Late', 'AM', '2026-07-24', '08:05:00', NULL, '2026-07-24 08:05:45', 'Traffic delay', 0),
(107, 'Oliver Martinez', 'LRN007', 'M', '7', 'Grade 7 - Section 1', 'RFID', 'Late', 'AM', '2026-07-24', '08:15:00', NULL, '2026-07-24 08:15:30', 'Doctor appointment', 0),
(108, 'Sophia Anderson', 'LRN008', 'F', '7', 'Grade 7 - Section 1', 'QR', 'Late', 'AM', '2026-07-24', '08:10:00', NULL, '2026-07-24 08:10:15', NULL, 0),
-- Absent students
(109, 'Lucas Thompson', 'LRN009', 'M', '7', 'Grade 7 - Section 1', 'Manual', 'Absent', 'AM', '2026-07-24', NULL, NULL, '2026-07-24 09:00:00', 'No record', 0),
(110, 'Isabella Garcia', 'LRN010', 'F', '7', 'Grade 7 - Section 1', 'Manual', 'Absent', 'AM', '2026-07-24', NULL, NULL, '2026-07-24 09:00:00', 'Sick leave', 0),
-- Time-Out records (same students, later in the day)
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
-- Total students: 10
-- Present (Time-In): 5
-- Late: 3
-- Absent: 2
-- Time-Out records: 8 (matching Time-In and Late students)
--
-- This data is designed for testing the SF2 Report feature
-- You can view it in the attendance table and generate reports
--
-- To test:
-- 1. Run this SQL file
-- 2. Go to teacher dashboard
-- 3. Click on SF2 Report button
-- 4. Select July 2026
-- 5. You should see all attendance records with breakdown by status
