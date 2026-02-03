require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/reading_assessment.db';
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

console.log('Initializing database...');

// Create tables
db.exec(`
  -- Users table (admin and teachers)
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'teacher')),
    full_name TEXT NOT NULL,
    email TEXT,
    must_change_password BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  -- Students table
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    class_name TEXT NOT NULL,
    year_group INTEGER,
    teacher_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Test assignments table
  CREATE TABLE IF NOT EXISTS test_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_name TEXT NOT NULL,
    test_form_number INTEGER NOT NULL CHECK(test_form_number BETWEEN 1 AND 8),
    teacher_id INTEGER NOT NULL,
    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Test results table
  CREATE TABLE IF NOT EXISTS test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    test_form_number INTEGER NOT NULL,
    test_assignment_id INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    time_taken_seconds INTEGER,
    total_score INTEGER NOT NULL,
    total_possible INTEGER NOT NULL DEFAULT 26,
    percentage_score REAL NOT NULL,
    estimated_reading_age REAL NOT NULL,

    -- Skill area scores
    literal_comprehension_score INTEGER DEFAULT 0,
    literal_comprehension_possible INTEGER DEFAULT 5,
    inference_score INTEGER DEFAULT 0,
    inference_possible INTEGER DEFAULT 10,
    vocabulary_score INTEGER DEFAULT 0,
    vocabulary_possible INTEGER DEFAULT 8,
    synthesis_score INTEGER DEFAULT 0,
    synthesis_possible INTEGER DEFAULT 3,

    -- Difficulty level performance
    difficulty_1_score INTEGER DEFAULT 0,
    difficulty_1_possible INTEGER DEFAULT 3,
    difficulty_2_score INTEGER DEFAULT 0,
    difficulty_2_possible INTEGER DEFAULT 6,
    difficulty_3_score INTEGER DEFAULT 0,
    difficulty_3_possible INTEGER DEFAULT 8,
    difficulty_4_score INTEGER DEFAULT 0,
    difficulty_4_possible INTEGER DEFAULT 5,
    difficulty_5_score INTEGER DEFAULT 0,
    difficulty_5_possible INTEGER DEFAULT 4,

    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (test_assignment_id) REFERENCES test_assignments(id) ON DELETE CASCADE
  );

  -- Student answers table
  CREATE TABLE IF NOT EXISTS student_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_result_id INTEGER NOT NULL,
    question_number INTEGER NOT NULL,
    selected_answer TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    skill_type TEXT NOT NULL,
    difficulty_level INTEGER NOT NULL,
    FOREIGN KEY (test_result_id) REFERENCES test_results(id) ON DELETE CASCADE
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacher_id);
  CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);
  CREATE INDEX IF NOT EXISTS idx_results_student ON test_results(student_id);
  CREATE INDEX IF NOT EXISTS idx_results_assignment ON test_results(test_assignment_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_class ON test_assignments(class_name);
  CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON test_assignments(teacher_id);
`);

// Create default admin account
const adminPassword = bcrypt.hashSync('admin123', 10);
const insertAdmin = db.prepare(`
  INSERT OR IGNORE INTO users (username, password_hash, role, full_name, must_change_password)
  VALUES (?, ?, ?, ?, ?)
`);

insertAdmin.run('admin', adminPassword, 'admin', 'System Administrator', 1);

console.log('Database initialized successfully!');
console.log('Default admin account created:');
console.log('  Username: admin');
console.log('  Password: admin123');
console.log('  (You will be required to change this password on first login)');

db.close();
