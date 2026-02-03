const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { verifyToken, isTeacherOrAdmin } = require('../middleware/auth');

// All routes require teacher or admin access
router.use(verifyToken, isTeacherOrAdmin);

// GET /api/teacher/students - Get teacher's students
router.get('/students', (req, res) => {
  try {
    let students;
    if (req.user.role === 'admin') {
      // Admin can see all students
      students = db.prepare(`
        SELECT s.*, u.full_name as teacher_name
        FROM students s
        JOIN users u ON s.teacher_id = u.id
        ORDER BY s.class_name, s.last_name, s.first_name
      `).all();
    } else {
      // Teachers see only their students
      students = db.prepare(`
        SELECT * FROM students
        WHERE teacher_id = ?
        ORDER BY class_name, last_name, first_name
      `).all(req.user.id);
    }

    res.json(students);
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ error: 'Failed to retrieve students.' });
  }
});

// POST /api/teacher/students - Add student
router.post('/students', (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth, className, yearGroup } = req.body;

    if (!firstName || !lastName || !dateOfBirth || !className) {
      return res.status(400).json({ error: 'First name, last name, date of birth, and class name are required.' });
    }

    // Validate date format
    const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dobRegex.test(dateOfBirth)) {
      return res.status(400).json({ error: 'Date of birth must be in YYYY-MM-DD format.' });
    }

    // Check for duplicate student
    const existing = db.prepare(`
      SELECT id FROM students
      WHERE first_name = ? AND last_name = ? AND date_of_birth = ? AND class_name = ?
    `).get(firstName, lastName, dateOfBirth, className);

    if (existing) {
      return res.status(400).json({ error: 'A student with this name and date of birth already exists in this class.' });
    }

    const result = db.prepare(`
      INSERT INTO students (first_name, last_name, date_of_birth, class_name, year_group, teacher_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(firstName, lastName, dateOfBirth, className, yearGroup || null, req.user.id);

    res.status(201).json({
      id: result.lastInsertRowid,
      firstName,
      lastName,
      dateOfBirth,
      className,
      message: 'Student added successfully.'
    });
  } catch (err) {
    console.error('Add student error:', err);
    res.status(500).json({ error: 'Failed to add student.' });
  }
});

// POST /api/teacher/students/bulk - Bulk import students
router.post('/students/bulk', (req, res) => {
  try {
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Students array is required.' });
    }

    const inserted = [];
    const errors = [];

    const insertStmt = db.prepare(`
      INSERT INTO students (first_name, last_name, date_of_birth, class_name, year_group, teacher_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    students.forEach((student, index) => {
      try {
        const { firstName, lastName, dateOfBirth, className, yearGroup } = student;

        if (!firstName || !lastName || !dateOfBirth || !className) {
          errors.push({ index, error: 'Missing required fields' });
          return;
        }

        const result = insertStmt.run(
          firstName, lastName, dateOfBirth, className, yearGroup || null, req.user.id
        );

        inserted.push({
          id: result.lastInsertRowid,
          firstName,
          lastName,
          className
        });
      } catch (err) {
        errors.push({ index, error: err.message });
      }
    });

    res.json({
      inserted: inserted.length,
      errors: errors.length,
      details: { inserted, errors }
    });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Failed to import students.' });
  }
});

// PUT /api/teacher/students/:id - Update student
router.put('/students/:id', (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth, className, yearGroup } = req.body;
    const studentId = req.params.id;

    // Check ownership
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (req.user.role !== 'admin' && student.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own students.' });
    }

    db.prepare(`
      UPDATE students
      SET first_name = ?, last_name = ?, date_of_birth = ?, class_name = ?, year_group = ?
      WHERE id = ?
    `).run(
      firstName || student.first_name,
      lastName || student.last_name,
      dateOfBirth || student.date_of_birth,
      className || student.class_name,
      yearGroup || student.year_group,
      studentId
    );

    res.json({ message: 'Student updated successfully.' });
  } catch (err) {
    console.error('Update student error:', err);
    res.status(500).json({ error: 'Failed to update student.' });
  }
});

// DELETE /api/teacher/students/:id - Delete student
router.delete('/students/:id', (req, res) => {
  try {
    const studentId = req.params.id;

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (req.user.role !== 'admin' && student.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own students.' });
    }

    db.prepare('DELETE FROM students WHERE id = ?').run(studentId);

    res.json({ message: 'Student deleted successfully.' });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: 'Failed to delete student.' });
  }
});

// GET /api/teacher/classes - Get teacher's classes
router.get('/classes', (req, res) => {
  try {
    let classes;
    if (req.user.role === 'admin') {
      classes = db.prepare(`
        SELECT DISTINCT class_name,
               COUNT(*) as student_count,
               (SELECT COUNT(*) FROM test_assignments ta WHERE ta.class_name = s.class_name AND ta.is_active = 1) as active_assignments
        FROM students s
        GROUP BY class_name
        ORDER BY class_name
      `).all();
    } else {
      classes = db.prepare(`
        SELECT DISTINCT class_name,
               COUNT(*) as student_count,
               (SELECT COUNT(*) FROM test_assignments ta WHERE ta.class_name = s.class_name AND ta.teacher_id = ? AND ta.is_active = 1) as active_assignments
        FROM students s
        WHERE teacher_id = ?
        GROUP BY class_name
        ORDER BY class_name
      `).all(req.user.id, req.user.id);
    }

    res.json(classes);
  } catch (err) {
    console.error('Get classes error:', err);
    res.status(500).json({ error: 'Failed to retrieve classes.' });
  }
});

// POST /api/teacher/assignments - Assign test to class
router.post('/assignments', (req, res) => {
  try {
    const { className, testFormNumber, dueDate } = req.body;

    if (!className || !testFormNumber) {
      return res.status(400).json({ error: 'Class name and test form number are required.' });
    }

    if (testFormNumber < 1 || testFormNumber > 8) {
      return res.status(400).json({ error: 'Test form number must be between 1 and 8.' });
    }

    // Check if this class has this test already assigned and active
    const existing = db.prepare(`
      SELECT id FROM test_assignments
      WHERE class_name = ? AND test_form_number = ? AND teacher_id = ? AND is_active = 1
    `).get(className, testFormNumber, req.user.id);

    if (existing) {
      return res.status(400).json({ error: 'This test form is already assigned to this class.' });
    }

    const result = db.prepare(`
      INSERT INTO test_assignments (class_name, test_form_number, teacher_id, due_date)
      VALUES (?, ?, ?, ?)
    `).run(className, testFormNumber, req.user.id, dueDate || null);

    res.status(201).json({
      id: result.lastInsertRowid,
      className,
      testFormNumber,
      message: 'Test assigned successfully.'
    });
  } catch (err) {
    console.error('Assign test error:', err);
    res.status(500).json({ error: 'Failed to assign test.' });
  }
});

// GET /api/teacher/assignments - Get teacher's test assignments
router.get('/assignments', (req, res) => {
  try {
    let assignments;
    if (req.user.role === 'admin') {
      assignments = db.prepare(`
        SELECT ta.*, u.full_name as teacher_name,
               (SELECT COUNT(*) FROM students s WHERE s.class_name = ta.class_name) as total_students,
               (SELECT COUNT(*) FROM test_results tr
                JOIN students s ON tr.student_id = s.id
                WHERE s.class_name = ta.class_name AND tr.test_assignment_id = ta.id) as completed_count
        FROM test_assignments ta
        JOIN users u ON ta.teacher_id = u.id
        ORDER BY ta.assigned_date DESC
      `).all();
    } else {
      assignments = db.prepare(`
        SELECT ta.*,
               (SELECT COUNT(*) FROM students s WHERE s.class_name = ta.class_name AND s.teacher_id = ta.teacher_id) as total_students,
               (SELECT COUNT(*) FROM test_results tr
                JOIN students s ON tr.student_id = s.id
                WHERE s.class_name = ta.class_name AND tr.test_assignment_id = ta.id) as completed_count
        FROM test_assignments ta
        WHERE ta.teacher_id = ?
        ORDER BY ta.assigned_date DESC
      `).all(req.user.id);
    }

    res.json(assignments);
  } catch (err) {
    console.error('Get assignments error:', err);
    res.status(500).json({ error: 'Failed to retrieve assignments.' });
  }
});

// PUT /api/teacher/assignments/:id - Update assignment (e.g., deactivate)
router.put('/assignments/:id', (req, res) => {
  try {
    const { isActive, dueDate } = req.body;
    const assignmentId = req.params.id;

    const assignment = db.prepare('SELECT * FROM test_assignments WHERE id = ?').get(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    if (req.user.role !== 'admin' && assignment.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only modify your own assignments.' });
    }

    db.prepare(`
      UPDATE test_assignments
      SET is_active = ?, due_date = ?
      WHERE id = ?
    `).run(
      isActive !== undefined ? (isActive ? 1 : 0) : assignment.is_active,
      dueDate !== undefined ? dueDate : assignment.due_date,
      assignmentId
    );

    res.json({ message: 'Assignment updated successfully.' });
  } catch (err) {
    console.error('Update assignment error:', err);
    res.status(500).json({ error: 'Failed to update assignment.' });
  }
});

// GET /api/teacher/results - Get results for teacher's students
router.get('/results', (req, res) => {
  try {
    let results;
    if (req.user.role === 'admin') {
      results = db.prepare(`
        SELECT tr.*, s.first_name, s.last_name, s.class_name, s.date_of_birth, u.full_name as teacher_name
        FROM test_results tr
        JOIN students s ON tr.student_id = s.id
        JOIN users u ON s.teacher_id = u.id
        ORDER BY tr.completed_at DESC
      `).all();
    } else {
      results = db.prepare(`
        SELECT tr.*, s.first_name, s.last_name, s.class_name, s.date_of_birth
        FROM test_results tr
        JOIN students s ON tr.student_id = s.id
        WHERE s.teacher_id = ?
        ORDER BY tr.completed_at DESC
      `).all(req.user.id);
    }

    res.json(results);
  } catch (err) {
    console.error('Get results error:', err);
    res.status(500).json({ error: 'Failed to retrieve results.' });
  }
});

// GET /api/teacher/results/:studentId - Get specific student results
router.get('/results/:studentId', (req, res) => {
  try {
    const studentId = req.params.studentId;

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (req.user.role !== 'admin' && student.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only view your own students\' results.' });
    }

    const results = db.prepare(`
      SELECT tr.*
      FROM test_results tr
      WHERE tr.student_id = ?
      ORDER BY tr.completed_at DESC
    `).all(studentId);

    // Get answers for each result
    const resultsWithAnswers = results.map(result => {
      const answers = db.prepare(`
        SELECT * FROM student_answers WHERE test_result_id = ? ORDER BY question_number
      `).all(result.id);
      return { ...result, answers };
    });

    res.json({ student, results: resultsWithAnswers });
  } catch (err) {
    console.error('Get student results error:', err);
    res.status(500).json({ error: 'Failed to retrieve student results.' });
  }
});

// GET /api/teacher/dashboard - Teacher dashboard stats
router.get('/dashboard', (req, res) => {
  try {
    const teacherId = req.user.id;

    const stats = {
      totalStudents: db.prepare('SELECT COUNT(*) as count FROM students WHERE teacher_id = ?').get(teacherId).count,
      activeAssignments: db.prepare('SELECT COUNT(*) as count FROM test_assignments WHERE teacher_id = ? AND is_active = 1').get(teacherId).count,
      completedTests: db.prepare(`
        SELECT COUNT(*) as count FROM test_results tr
        JOIN students s ON tr.student_id = s.id
        WHERE s.teacher_id = ?
      `).get(teacherId).count
    };

    // Get classes with stats
    const classes = db.prepare(`
      SELECT class_name,
             COUNT(*) as student_count,
             (SELECT COUNT(*) FROM test_results tr
              JOIN students s2 ON tr.student_id = s2.id
              WHERE s2.class_name = s.class_name AND s2.teacher_id = ?) as tests_completed
      FROM students s
      WHERE teacher_id = ?
      GROUP BY class_name
      ORDER BY class_name
    `).all(teacherId, teacherId);

    // Recent results
    const recentResults = db.prepare(`
      SELECT tr.*, s.first_name, s.last_name, s.class_name
      FROM test_results tr
      JOIN students s ON tr.student_id = s.id
      WHERE s.teacher_id = ?
      ORDER BY tr.completed_at DESC
      LIMIT 5
    `).all(teacherId);

    res.json({ stats, classes, recentResults });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
});

// GET /api/teacher/next-test/:className - Get recommended next test form for a class
router.get('/next-test/:className', (req, res) => {
  try {
    const className = req.params.className;

    // Get all test forms that have been assigned to this class
    const assignedForms = db.prepare(`
      SELECT DISTINCT test_form_number
      FROM test_assignments
      WHERE class_name = ? AND teacher_id = ?
      ORDER BY test_form_number
    `).all(className, req.user.id);

    const usedForms = assignedForms.map(a => a.test_form_number);

    // Find next available form (1-8)
    let recommendedForm = 1;
    for (let i = 1; i <= 8; i++) {
      if (!usedForms.includes(i)) {
        recommendedForm = i;
        break;
      }
    }

    res.json({
      className,
      usedForms,
      recommendedForm,
      availableForms: [1, 2, 3, 4, 5, 6, 7, 8].filter(f => !usedForms.includes(f))
    });
  } catch (err) {
    console.error('Get next test error:', err);
    res.status(500).json({ error: 'Failed to get test recommendation.' });
  }
});

module.exports = router;
