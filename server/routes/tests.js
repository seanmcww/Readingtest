const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { verifyToken, isTeacherOrAdmin } = require('../middleware/auth');

// GET /api/tests/available - Get list of available test forms
router.get('/available', (req, res) => {
  try {
    const testsDir = path.join(__dirname, '../data/tests');
    const files = fs.readdirSync(testsDir);

    const availableForms = files
      .filter(f => f.startsWith('form') && f.endsWith('.json'))
      .map(f => {
        const formNumber = parseInt(f.replace('form', '').replace('.json', ''));
        const testData = require(path.join(testsDir, f));
        return {
          formNumber,
          totalQuestions: testData.totalQuestions,
          totalTime: testData.totalTime,
          topics: testData.topics || 'N/A'
        };
      })
      .sort((a, b) => a.formNumber - b.formNumber);

    res.json(availableForms);
  } catch (err) {
    console.error('Get available tests error:', err);
    res.status(500).json({ error: 'Failed to retrieve available tests.' });
  }
});

// GET /api/tests/:formNumber - Get test content (for teachers to preview)
router.get('/:formNumber', verifyToken, isTeacherOrAdmin, (req, res) => {
  try {
    const formNumber = parseInt(req.params.formNumber);

    if (formNumber < 1 || formNumber > 8) {
      return res.status(400).json({ error: 'Test form number must be between 1 and 8.' });
    }

    const testPath = path.join(__dirname, `../data/tests/form${formNumber}.json`);

    if (!fs.existsSync(testPath)) {
      return res.status(404).json({ error: 'Test form not found.' });
    }

    const testData = require(testPath);

    // For preview, include full test but mark which answers are correct
    res.json(testData);
  } catch (err) {
    console.error('Get test error:', err);
    res.status(500).json({ error: 'Failed to retrieve test content.' });
  }
});

// GET /api/tests/:formNumber/answers - Get answer key (admin/teacher only)
router.get('/:formNumber/answers', verifyToken, isTeacherOrAdmin, (req, res) => {
  try {
    const formNumber = parseInt(req.params.formNumber);

    if (formNumber < 1 || formNumber > 8) {
      return res.status(400).json({ error: 'Test form number must be between 1 and 8.' });
    }

    const testPath = path.join(__dirname, `../data/tests/form${formNumber}.json`);

    if (!fs.existsSync(testPath)) {
      return res.status(404).json({ error: 'Test form not found.' });
    }

    const testData = require(testPath);

    // Extract answer key
    const answerKey = [];
    testData.parts.forEach(part => {
      part.questions.forEach(q => {
        answerKey.push({
          questionNumber: q.questionNumber,
          correctAnswer: q.correctAnswer,
          skillType: q.skillType,
          difficultyLevel: q.difficultyLevel
        });
      });
    });

    res.json({
      formNumber,
      answerKey,
      skillDistribution: {
        literalComprehension: answerKey.filter(a => a.skillType.toLowerCase().includes('literal')).length,
        inference: answerKey.filter(a => a.skillType.toLowerCase().includes('inference')).length,
        vocabulary: answerKey.filter(a => a.skillType.toLowerCase().includes('vocab')).length,
        synthesis: answerKey.filter(a => a.skillType.toLowerCase().includes('synth') || a.skillType.toLowerCase().includes('analy')).length
      },
      difficultyDistribution: {
        level1: answerKey.filter(a => a.difficultyLevel === 1).length,
        level2: answerKey.filter(a => a.difficultyLevel === 2).length,
        level3: answerKey.filter(a => a.difficultyLevel === 3).length,
        level4: answerKey.filter(a => a.difficultyLevel === 4).length,
        level5: answerKey.filter(a => a.difficultyLevel === 5).length
      }
    });
  } catch (err) {
    console.error('Get answer key error:', err);
    res.status(500).json({ error: 'Failed to retrieve answer key.' });
  }
});

module.exports = router;
