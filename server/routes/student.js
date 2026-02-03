const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { verifyToken, isStudent, generateStudentToken } = require('../middleware/auth');
const {
  calculateReadingAge,
  calculateSkillScores,
  calculateDifficultyScores,
  normalizeSkillType
} = require('../utils/scoring');

// GET /api/student/available - Get students available for login (with pending tests)
router.get('/available', (req, res) => {
  try {
    // Get students who have assigned tests but haven't completed them
    const students = db.prepare(`
      SELECT DISTINCT s.id, s.first_name, s.last_name, s.class_name, ta.id as assignment_id, ta.test_form_number
      FROM students s
      JOIN test_assignments ta ON s.class_name = ta.class_name AND s.teacher_id = ta.teacher_id
      LEFT JOIN test_results tr ON s.id = tr.student_id AND ta.id = tr.test_assignment_id
      WHERE ta.is_active = 1 AND tr.id IS NULL
      ORDER BY s.class_name, s.last_name, s.first_name
    `).all();

    // Group by class
    const grouped = {};
    students.forEach(s => {
      if (!grouped[s.class_name]) {
        grouped[s.class_name] = [];
      }
      grouped[s.class_name].push({
        id: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        assignmentId: s.assignment_id,
        testFormNumber: s.test_form_number
      });
    });

    res.json(grouped);
  } catch (err) {
    console.error('Get available students error:', err);
    res.status(500).json({ error: 'Failed to retrieve available students.' });
  }
});

// POST /api/student/login - Student login with name + DOB
router.post('/login', (req, res) => {
  try {
    const { studentId, dateOfBirth } = req.body;

    if (!studentId || !dateOfBirth) {
      return res.status(400).json({ error: 'Student ID and date of birth are required.' });
    }

    // Get student with pending test
    const student = db.prepare(`
      SELECT s.*, ta.id as assignment_id, ta.test_form_number
      FROM students s
      JOIN test_assignments ta ON s.class_name = ta.class_name AND s.teacher_id = ta.teacher_id
      LEFT JOIN test_results tr ON s.id = tr.student_id AND ta.id = tr.test_assignment_id
      WHERE s.id = ? AND ta.is_active = 1 AND tr.id IS NULL
    `).get(studentId);

    if (!student) {
      return res.status(401).json({ error: 'Student not found or no pending tests.' });
    }

    // Validate DOB (support multiple formats)
    const normalizedInputDob = normalizeDateOfBirth(dateOfBirth);
    const normalizedStudentDob = student.date_of_birth;

    if (normalizedInputDob !== normalizedStudentDob) {
      return res.status(401).json({ error: 'Incorrect date of birth. Please try again.' });
    }

    const token = generateStudentToken(student, student.assignment_id);

    res.json({
      token,
      student: {
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        className: student.class_name,
        testFormNumber: student.test_form_number,
        assignmentId: student.assignment_id
      }
    });
  } catch (err) {
    console.error('Student login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Helper function to normalize date of birth
function normalizeDateOfBirth(dob) {
  // Support DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD formats
  let parts;
  if (dob.includes('/')) {
    parts = dob.split('/');
    if (parts[0].length === 4) {
      // YYYY/MM/DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else {
      // DD/MM/YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  } else if (dob.includes('-')) {
    parts = dob.split('-');
    if (parts[0].length === 4) {
      // YYYY-MM-DD (already correct format)
      return dob;
    } else {
      // DD-MM-YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return dob;
}

// Protected routes below require student token
// GET /api/student/test - Get assigned test
router.get('/test', verifyToken, isStudent, (req, res) => {
  try {
    const testData = require(`../data/tests/form${req.user.assignmentId ? getTestFormNumber(req.user.assignmentId) : 1}.json`);

    // Remove correct answers from response
    const sanitizedTest = {
      formNumber: testData.formNumber,
      totalTime: testData.totalTime,
      totalQuestions: testData.totalQuestions,
      parts: testData.parts.map(part => ({
        partNumber: part.partNumber,
        title: part.title,
        readingAge: part.readingAge,
        passage: part.passage,
        questions: part.questions.map(q => ({
          questionNumber: q.questionNumber,
          questionText: q.questionText,
          options: q.options
        }))
      }))
    };

    res.json(sanitizedTest);
  } catch (err) {
    console.error('Get test error:', err);
    // If test file doesn't exist, return a message
    if (err.code === 'MODULE_NOT_FOUND') {
      return res.status(404).json({ error: 'Test content not available.' });
    }
    res.status(500).json({ error: 'Failed to load test.' });
  }
});

// Helper to get test form number from assignment
function getTestFormNumber(assignmentId) {
  const assignment = db.prepare('SELECT test_form_number FROM test_assignments WHERE id = ?').get(assignmentId);
  return assignment ? assignment.test_form_number : 1;
}

// POST /api/student/test/submit - Submit completed test
router.post('/test/submit', verifyToken, isStudent, (req, res) => {
  try {
    const { answers, timeTakenSeconds } = req.body;

    if (!answers || !Array.isArray(answers) || answers.length !== 26) {
      return res.status(400).json({ error: 'All 26 questions must be answered.' });
    }

    // Check if already completed
    const existing = db.prepare(`
      SELECT id FROM test_results
      WHERE student_id = ? AND test_assignment_id = ?
    `).get(req.user.id, req.user.assignmentId);

    if (existing) {
      return res.status(400).json({ error: 'You have already completed this test.' });
    }

    // Get test form number
    const assignment = db.prepare('SELECT test_form_number FROM test_assignments WHERE id = ?')
      .get(req.user.assignmentId);

    if (!assignment) {
      return res.status(404).json({ error: 'Test assignment not found.' });
    }

    // Load test data for scoring
    let testData;
    try {
      testData = require(`../data/tests/form${assignment.test_form_number}.json`);
    } catch (err) {
      return res.status(500).json({ error: 'Test data not available for scoring.' });
    }

    // Build answer key
    const answerKey = {};
    testData.parts.forEach(part => {
      part.questions.forEach(q => {
        answerKey[q.questionNumber] = {
          correctAnswer: q.correctAnswer,
          skillType: q.skillType,
          difficultyLevel: q.difficultyLevel
        };
      });
    });

    // Score the test
    let totalScore = 0;
    const scoredAnswers = answers.map(answer => {
      const key = answerKey[answer.questionNumber];
      const isCorrect = answer.selectedAnswer === key.correctAnswer;
      if (isCorrect) totalScore++;

      return {
        questionNumber: answer.questionNumber,
        selectedAnswer: answer.selectedAnswer,
        correctAnswer: key.correctAnswer,
        isCorrect,
        skillType: key.skillType,
        difficultyLevel: key.difficultyLevel
      };
    });

    // Calculate skill scores
    const skillScores = calculateSkillScores(scoredAnswers);

    // Calculate difficulty scores
    const difficultyScores = calculateDifficultyScores(scoredAnswers);

    // Calculate reading age
    const readingAge = calculateReadingAge(difficultyScores);

    // Calculate percentage
    const percentageScore = Math.round((totalScore / 26) * 100 * 10) / 10;

    // Insert test result
    const resultInsert = db.prepare(`
      INSERT INTO test_results (
        student_id, test_form_number, test_assignment_id, time_taken_seconds,
        total_score, percentage_score, estimated_reading_age,
        literal_comprehension_score, inference_score, vocabulary_score, synthesis_score,
        difficulty_1_score, difficulty_2_score, difficulty_3_score, difficulty_4_score, difficulty_5_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = resultInsert.run(
      req.user.id,
      assignment.test_form_number,
      req.user.assignmentId,
      timeTakenSeconds || 0,
      totalScore,
      percentageScore,
      readingAge,
      skillScores.literal_comprehension.score,
      skillScores.inference.score,
      skillScores.vocabulary.score,
      skillScores.synthesis.score,
      difficultyScores[1].score,
      difficultyScores[2].score,
      difficultyScores[3].score,
      difficultyScores[4].score,
      difficultyScores[5].score
    );

    // Insert individual answers
    const answerInsert = db.prepare(`
      INSERT INTO student_answers (test_result_id, question_number, selected_answer, correct_answer, is_correct, skill_type, difficulty_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    scoredAnswers.forEach(answer => {
      answerInsert.run(
        result.lastInsertRowid,
        answer.questionNumber,
        answer.selectedAnswer,
        answer.correctAnswer,
        answer.isCorrect ? 1 : 0,
        answer.skillType,
        answer.difficultyLevel
      );
    });

    res.json({
      message: 'Test submitted successfully.',
      resultId: result.lastInsertRowid,
      score: totalScore,
      totalPossible: 26,
      percentage: percentageScore,
      readingAge
    });
  } catch (err) {
    console.error('Submit test error:', err);
    res.status(500).json({ error: 'Failed to submit test. Please try again.' });
  }
});

// GET /api/student/results - Get own results (optional feature)
router.get('/results', verifyToken, isStudent, (req, res) => {
  try {
    const result = db.prepare(`
      SELECT tr.*, s.first_name, s.last_name, s.class_name
      FROM test_results tr
      JOIN students s ON tr.student_id = s.id
      WHERE tr.student_id = ? AND tr.test_assignment_id = ?
    `).get(req.user.id, req.user.assignmentId);

    if (!result) {
      return res.status(404).json({ error: 'No results found.' });
    }

    res.json({
      score: result.total_score,
      totalPossible: result.total_possible,
      percentage: result.percentage_score,
      readingAge: result.estimated_reading_age,
      completedAt: result.completed_at
    });
  } catch (err) {
    console.error('Get student results error:', err);
    res.status(500).json({ error: 'Failed to retrieve results.' });
  }
});

module.exports = router;
