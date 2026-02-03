const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../utils/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// All routes require admin access
router.use(verifyToken, isAdmin);

// GET /api/admin/teachers - List all teachers
router.get('/teachers', (req, res) => {
  try {
    const teachers = db.prepare(`
      SELECT id, username, full_name, email, created_at, last_login,
             (SELECT COUNT(*) FROM students WHERE teacher_id = users.id) as student_count
      FROM users
      WHERE role = 'teacher'
      ORDER BY full_name
    `).all();

    res.json(teachers);
  } catch (err) {
    console.error('Get teachers error:', err);
    res.status(500).json({ error: 'Failed to retrieve teachers.' });
  }
});

// POST /api/admin/teachers - Create teacher
router.post('/teachers', (req, res) => {
  try {
    const { username, password, fullName, email } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Username, password, and full name are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check if username exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO users (username, password_hash, role, full_name, email)
      VALUES (?, ?, 'teacher', ?, ?)
    `).run(username, hashedPassword, fullName, email || null);

    res.status(201).json({
      id: result.lastInsertRowid,
      username,
      fullName,
      email,
      message: 'Teacher account created successfully.'
    });
  } catch (err) {
    console.error('Create teacher error:', err);
    res.status(500).json({ error: 'Failed to create teacher account.' });
  }
});

// PUT /api/admin/teachers/:id - Update teacher
router.put('/teachers/:id', (req, res) => {
  try {
    const { fullName, email } = req.body;
    const teacherId = req.params.id;

    const teacher = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(teacherId, 'teacher');
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found.' });
    }

    db.prepare('UPDATE users SET full_name = ?, email = ? WHERE id = ?')
      .run(fullName || teacher.full_name, email || teacher.email, teacherId);

    res.json({ message: 'Teacher updated successfully.' });
  } catch (err) {
    console.error('Update teacher error:', err);
    res.status(500).json({ error: 'Failed to update teacher.' });
  }
});

// DELETE /api/admin/teachers/:id - Delete teacher
router.delete('/teachers/:id', (req, res) => {
  try {
    const teacherId = req.params.id;

    const teacher = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(teacherId, 'teacher');
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(teacherId);

    res.json({ message: 'Teacher deleted successfully.' });
  } catch (err) {
    console.error('Delete teacher error:', err);
    res.status(500).json({ error: 'Failed to delete teacher.' });
  }
});

// POST /api/admin/teachers/:id/reset-password - Reset teacher password
router.post('/teachers/:id/reset-password', (req, res) => {
  try {
    const { newPassword } = req.body;
    const teacherId = req.params.id;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const teacher = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(teacherId, 'teacher');
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found.' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
      .run(hashedPassword, teacherId);

    res.json({ message: 'Password reset successfully. Teacher will be required to change password on next login.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// GET /api/admin/dashboard - Admin dashboard stats
router.get('/dashboard', (req, res) => {
  try {
    const stats = {
      totalTeachers: db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('teacher').count,
      totalStudents: db.prepare('SELECT COUNT(*) as count FROM students').get().count,
      totalTestsCompleted: db.prepare('SELECT COUNT(*) as count FROM test_results').get().count,
      activeAssignments: db.prepare('SELECT COUNT(*) as count FROM test_assignments WHERE is_active = 1').get().count
    };

    // Recent activity
    const recentResults = db.prepare(`
      SELECT tr.*, s.first_name, s.last_name, s.class_name
      FROM test_results tr
      JOIN students s ON tr.student_id = s.id
      ORDER BY tr.completed_at DESC
      LIMIT 10
    `).all();

    res.json({ stats, recentResults });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
});

// GET /api/admin/all-students - Get all students (admin view)
router.get('/all-students', (req, res) => {
  try {
    const students = db.prepare(`
      SELECT s.*, u.full_name as teacher_name
      FROM students s
      JOIN users u ON s.teacher_id = u.id
      ORDER BY s.class_name, s.last_name, s.first_name
    `).all();

    res.json(students);
  } catch (err) {
    console.error('Get all students error:', err);
    res.status(500).json({ error: 'Failed to retrieve students.' });
  }
});

module.exports = router;
