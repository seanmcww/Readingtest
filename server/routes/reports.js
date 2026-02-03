const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { verifyToken, isTeacherOrAdmin } = require('../middleware/auth');
const {
  calculateChronologicalAge,
  calculateReadingGap,
  isWeakness,
  getInterventionRecommendations
} = require('../utils/scoring');

// All routes require teacher or admin access
router.use(verifyToken, isTeacherOrAdmin);

// GET /api/reports/student/:studentId - Individual student report
router.get('/student/:studentId', (req, res) => {
  try {
    const studentId = req.params.studentId;

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Check access
    if (req.user.role !== 'admin' && student.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Get all test results for this student
    const results = db.prepare(`
      SELECT tr.* FROM test_results tr
      WHERE tr.student_id = ?
      ORDER BY tr.completed_at DESC
    `).all(studentId);

    if (results.length === 0) {
      return res.json({
        student: {
          ...student,
          chronologicalAge: calculateChronologicalAge(student.date_of_birth)
        },
        results: [],
        message: 'No test results available for this student.'
      });
    }

    // Build detailed reports for each result
    const detailedResults = results.map(result => {
      const answers = db.prepare(`
        SELECT * FROM student_answers WHERE test_result_id = ? ORDER BY question_number
      `).all(result.id);

      const chronologicalAge = calculateChronologicalAge(student.date_of_birth);
      const gapAnalysis = calculateReadingGap(chronologicalAge, result.estimated_reading_age);

      const skillScores = {
        literal_comprehension: {
          score: result.literal_comprehension_score,
          possible: result.literal_comprehension_possible,
          percentage: Math.round((result.literal_comprehension_score / result.literal_comprehension_possible) * 100 * 10) / 10
        },
        inference: {
          score: result.inference_score,
          possible: result.inference_possible,
          percentage: Math.round((result.inference_score / result.inference_possible) * 100 * 10) / 10
        },
        vocabulary: {
          score: result.vocabulary_score,
          possible: result.vocabulary_possible,
          percentage: Math.round((result.vocabulary_score / result.vocabulary_possible) * 100 * 10) / 10
        },
        synthesis: {
          score: result.synthesis_score,
          possible: result.synthesis_possible,
          percentage: Math.round((result.synthesis_score / result.synthesis_possible) * 100 * 10) / 10
        }
      };

      const difficultyScores = {
        1: { score: result.difficulty_1_score, possible: result.difficulty_1_possible },
        2: { score: result.difficulty_2_score, possible: result.difficulty_2_possible },
        3: { score: result.difficulty_3_score, possible: result.difficulty_3_possible },
        4: { score: result.difficulty_4_score, possible: result.difficulty_4_possible },
        5: { score: result.difficulty_5_score, possible: result.difficulty_5_possible }
      };

      // Calculate percentages for difficulty levels
      Object.keys(difficultyScores).forEach(key => {
        difficultyScores[key].percentage = difficultyScores[key].possible > 0
          ? Math.round((difficultyScores[key].score / difficultyScores[key].possible) * 100 * 10) / 10
          : 0;
      });

      // Identify weaknesses
      const weaknesses = [];
      if (isWeakness(skillScores.literal_comprehension.percentage)) weaknesses.push('Literal Comprehension');
      if (isWeakness(skillScores.inference.percentage)) weaknesses.push('Inference');
      if (isWeakness(skillScores.vocabulary.percentage)) weaknesses.push('Vocabulary');
      if (isWeakness(skillScores.synthesis.percentage)) weaknesses.push('Synthesis/Analysis');

      const interventions = getInterventionRecommendations(skillScores);

      return {
        testFormNumber: result.test_form_number,
        completedAt: result.completed_at,
        timeTaken: result.time_taken_seconds,
        totalScore: result.total_score,
        totalPossible: result.total_possible,
        percentageScore: result.percentage_score,
        estimatedReadingAge: result.estimated_reading_age,
        chronologicalAge,
        gapAnalysis,
        skillScores,
        difficultyScores,
        weaknesses,
        interventions,
        answers
      };
    });

    res.json({
      student: {
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        dateOfBirth: student.date_of_birth,
        className: student.class_name,
        chronologicalAge: calculateChronologicalAge(student.date_of_birth)
      },
      results: detailedResults
    });
  } catch (err) {
    console.error('Student report error:', err);
    res.status(500).json({ error: 'Failed to generate student report.' });
  }
});

// GET /api/reports/class/:className - Class report
router.get('/class/:className', (req, res) => {
  try {
    const className = req.params.className;
    const teacherId = req.user.role === 'admin' ? null : req.user.id;

    // Get all students in class
    let studentsQuery = `
      SELECT s.*, u.full_name as teacher_name
      FROM students s
      JOIN users u ON s.teacher_id = u.id
      WHERE s.class_name = ?
    `;
    if (teacherId) {
      studentsQuery += ' AND s.teacher_id = ?';
    }
    studentsQuery += ' ORDER BY s.last_name, s.first_name';

    const students = teacherId
      ? db.prepare(studentsQuery).all(className, teacherId)
      : db.prepare(studentsQuery).all(className);

    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found in this class.' });
    }

    // Get latest test result for each student
    const studentResults = students.map(student => {
      const result = db.prepare(`
        SELECT * FROM test_results
        WHERE student_id = ?
        ORDER BY completed_at DESC
        LIMIT 1
      `).get(student.id);

      const chronologicalAge = calculateChronologicalAge(student.date_of_birth);

      if (!result) {
        return {
          studentId: student.id,
          firstName: student.first_name,
          lastName: student.last_name,
          dateOfBirth: student.date_of_birth,
          chronologicalAge,
          hasResult: false
        };
      }

      const gapAnalysis = calculateReadingGap(chronologicalAge, result.estimated_reading_age);

      // Calculate skill percentages
      const skillPercentages = {
        literalComprehension: Math.round((result.literal_comprehension_score / result.literal_comprehension_possible) * 100),
        inference: Math.round((result.inference_score / result.inference_possible) * 100),
        vocabulary: Math.round((result.vocabulary_score / result.vocabulary_possible) * 100),
        synthesis: Math.round((result.synthesis_score / result.synthesis_possible) * 100)
      };

      // Find weakest skill
      const skills = [
        { name: 'Literal Comprehension', pct: skillPercentages.literalComprehension },
        { name: 'Inference', pct: skillPercentages.inference },
        { name: 'Vocabulary', pct: skillPercentages.vocabulary },
        { name: 'Synthesis', pct: skillPercentages.synthesis }
      ];
      const weakestSkill = skills.reduce((min, s) => s.pct < min.pct ? s : min, skills[0]);

      return {
        studentId: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        dateOfBirth: student.date_of_birth,
        chronologicalAge,
        hasResult: true,
        testFormNumber: result.test_form_number,
        completedAt: result.completed_at,
        totalScore: result.total_score,
        percentageScore: result.percentage_score,
        readingAge: result.estimated_reading_age,
        gap: gapAnalysis.gap,
        isAtRisk: gapAnalysis.isAtRisk,
        isPriority: gapAnalysis.isPriority,
        skillPercentages,
        weakestSkill: weakestSkill.name
      };
    });

    // Calculate class statistics
    const completedResults = studentResults.filter(s => s.hasResult);
    const readingAges = completedResults.map(s => s.readingAge);

    const stats = {
      totalStudents: students.length,
      completedCount: completedResults.length,
      pendingCount: students.length - completedResults.length
    };

    if (readingAges.length > 0) {
      readingAges.sort((a, b) => a - b);
      const sum = readingAges.reduce((a, b) => a + b, 0);

      stats.meanReadingAge = Math.round((sum / readingAges.length) * 10) / 10;
      stats.medianReadingAge = readingAges.length % 2 === 0
        ? (readingAges[readingAges.length / 2 - 1] + readingAges[readingAges.length / 2]) / 2
        : readingAges[Math.floor(readingAges.length / 2)];
      stats.minReadingAge = readingAges[0];
      stats.maxReadingAge = readingAges[readingAges.length - 1];

      // Standard deviation
      const variance = readingAges.reduce((acc, val) => acc + Math.pow(val - stats.meanReadingAge, 2), 0) / readingAges.length;
      stats.stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

      // At-risk count
      stats.atRiskCount = completedResults.filter(s => s.isAtRisk).length;
      stats.priorityCount = completedResults.filter(s => s.isPriority).length;

      // Skill area averages
      stats.skillAverages = {
        literalComprehension: Math.round(completedResults.reduce((sum, s) => sum + s.skillPercentages.literalComprehension, 0) / completedResults.length),
        inference: Math.round(completedResults.reduce((sum, s) => sum + s.skillPercentages.inference, 0) / completedResults.length),
        vocabulary: Math.round(completedResults.reduce((sum, s) => sum + s.skillPercentages.vocabulary, 0) / completedResults.length),
        synthesis: Math.round(completedResults.reduce((sum, s) => sum + s.skillPercentages.synthesis, 0) / completedResults.length)
      };

      // Common weaknesses (skills where >50% of class scores <60%)
      stats.commonWeaknesses = [];
      const weaknessThreshold = 60;
      const classThreshold = 0.5;

      if (completedResults.filter(s => s.skillPercentages.literalComprehension < weaknessThreshold).length / completedResults.length >= classThreshold) {
        stats.commonWeaknesses.push('Literal Comprehension');
      }
      if (completedResults.filter(s => s.skillPercentages.inference < weaknessThreshold).length / completedResults.length >= classThreshold) {
        stats.commonWeaknesses.push('Inference');
      }
      if (completedResults.filter(s => s.skillPercentages.vocabulary < weaknessThreshold).length / completedResults.length >= classThreshold) {
        stats.commonWeaknesses.push('Vocabulary');
      }
      if (completedResults.filter(s => s.skillPercentages.synthesis < weaknessThreshold).length / completedResults.length >= classThreshold) {
        stats.commonWeaknesses.push('Synthesis/Analysis');
      }
    }

    // Students of concern (sorted by gap)
    const studentsOfConcern = completedResults
      .filter(s => s.isAtRisk)
      .sort((a, b) => a.gap - b.gap);

    res.json({
      className,
      teacherName: students[0]?.teacher_name,
      stats,
      students: studentResults,
      studentsOfConcern
    });
  } catch (err) {
    console.error('Class report error:', err);
    res.status(500).json({ error: 'Failed to generate class report.' });
  }
});

// GET /api/reports/year-group/:year - Year group report
router.get('/year-group/:year', (req, res) => {
  try {
    const yearGroup = req.params.year;

    // Get all students in year group (by year_group or infer from class name)
    const students = db.prepare(`
      SELECT s.*, u.full_name as teacher_name
      FROM students s
      JOIN users u ON s.teacher_id = u.id
      WHERE s.year_group = ? OR s.class_name LIKE ?
      ORDER BY s.class_name, s.last_name, s.first_name
    `).all(yearGroup, `${yearGroup}%`);

    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found in this year group.' });
    }

    // Get latest test result for each student
    const studentResults = students.map(student => {
      const result = db.prepare(`
        SELECT * FROM test_results
        WHERE student_id = ?
        ORDER BY completed_at DESC
        LIMIT 1
      `).get(student.id);

      const chronologicalAge = calculateChronologicalAge(student.date_of_birth);

      if (!result) {
        return {
          studentId: student.id,
          firstName: student.first_name,
          lastName: student.last_name,
          className: student.class_name,
          teacherName: student.teacher_name,
          chronologicalAge,
          hasResult: false
        };
      }

      const gapAnalysis = calculateReadingGap(chronologicalAge, result.estimated_reading_age);

      const skillPercentages = {
        literalComprehension: Math.round((result.literal_comprehension_score / result.literal_comprehension_possible) * 100),
        inference: Math.round((result.inference_score / result.inference_possible) * 100),
        vocabulary: Math.round((result.vocabulary_score / result.vocabulary_possible) * 100),
        synthesis: Math.round((result.synthesis_score / result.synthesis_possible) * 100)
      };

      // Count weaknesses
      const weaknessCount = [
        skillPercentages.literalComprehension,
        skillPercentages.inference,
        skillPercentages.vocabulary,
        skillPercentages.synthesis
      ].filter(p => p < 60).length;

      return {
        studentId: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        className: student.class_name,
        teacherName: student.teacher_name,
        chronologicalAge,
        hasResult: true,
        testFormNumber: result.test_form_number,
        completedAt: result.completed_at,
        totalScore: result.total_score,
        percentageScore: result.percentage_score,
        readingAge: result.estimated_reading_age,
        gap: gapAnalysis.gap,
        isAtRisk: gapAnalysis.isAtRisk,
        isPriority: gapAnalysis.isPriority,
        weaknessCount,
        skillPercentages
      };
    });

    // Calculate year group statistics
    const completedResults = studentResults.filter(s => s.hasResult);
    const readingAges = completedResults.map(s => s.readingAge);

    const stats = {
      yearGroup,
      totalStudents: students.length,
      testedCount: completedResults.length,
      untestedCount: students.length - completedResults.length
    };

    if (readingAges.length > 0) {
      readingAges.sort((a, b) => a - b);
      const sum = readingAges.reduce((a, b) => a + b, 0);

      stats.meanReadingAge = Math.round((sum / readingAges.length) * 10) / 10;

      // Calculate expected level percentages
      const expectedAge = parseInt(yearGroup) + 5; // Year 7 = 11-12, Year 8 = 12-13
      stats.atOrAboveExpected = Math.round((completedResults.filter(s => s.gap >= 0).length / completedResults.length) * 100);
      stats.oneYearBelow = Math.round((completedResults.filter(s => s.gap < 0 && s.gap >= -1).length / completedResults.length) * 100);
      stats.twoOrMoreBelow = Math.round((completedResults.filter(s => s.gap < -2).length / completedResults.length) * 100);

      // At-risk and priority counts
      stats.atRiskCount = completedResults.filter(s => s.isAtRisk).length;
      stats.priorityCount = completedResults.filter(s => s.isPriority).length;

      // Skill averages
      stats.skillAverages = {
        literalComprehension: Math.round(completedResults.reduce((sum, s) => sum + s.skillPercentages.literalComprehension, 0) / completedResults.length),
        inference: Math.round(completedResults.reduce((sum, s) => sum + s.skillPercentages.inference, 0) / completedResults.length),
        vocabulary: Math.round(completedResults.reduce((sum, s) => sum + s.skillPercentages.vocabulary, 0) / completedResults.length),
        synthesis: Math.round(completedResults.reduce((sum, s) => sum + s.skillPercentages.synthesis, 0) / completedResults.length)
      };

      // Whole-cohort weaknesses (>40% struggle)
      stats.cohortWeaknesses = [];
      if (completedResults.filter(s => s.skillPercentages.literalComprehension < 60).length / completedResults.length >= 0.4) {
        stats.cohortWeaknesses.push('Literal Comprehension');
      }
      if (completedResults.filter(s => s.skillPercentages.inference < 60).length / completedResults.length >= 0.4) {
        stats.cohortWeaknesses.push('Inference');
      }
      if (completedResults.filter(s => s.skillPercentages.vocabulary < 60).length / completedResults.length >= 0.4) {
        stats.cohortWeaknesses.push('Vocabulary');
      }
      if (completedResults.filter(s => s.skillPercentages.synthesis < 60).length / completedResults.length >= 0.4) {
        stats.cohortWeaknesses.push('Synthesis/Analysis');
      }
    }

    // Class-by-class comparison
    const classStats = {};
    completedResults.forEach(student => {
      if (!classStats[student.className]) {
        classStats[student.className] = {
          className: student.className,
          teacherName: student.teacherName,
          students: [],
          readingAges: []
        };
      }
      classStats[student.className].students.push(student);
      classStats[student.className].readingAges.push(student.readingAge);
    });

    const classSummary = Object.values(classStats).map(cls => ({
      className: cls.className,
      teacherName: cls.teacherName,
      studentCount: cls.students.length,
      meanReadingAge: Math.round((cls.readingAges.reduce((a, b) => a + b, 0) / cls.readingAges.length) * 10) / 10,
      atExpectedPercent: Math.round((cls.students.filter(s => s.gap >= 0).length / cls.students.length) * 100),
      atRiskCount: cls.students.filter(s => s.isAtRisk).length
    }));

    // Key readers of concern (top 20 most below expected)
    const keyReadersConcern = completedResults
      .filter(s => s.isAtRisk)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 20);

    // Priority intervention list (multiple weaknesses + at risk)
    const priorityIntervention = completedResults
      .filter(s => s.isAtRisk && s.weaknessCount >= 2)
      .sort((a, b) => b.weaknessCount - a.weaknessCount || a.gap - b.gap);

    res.json({
      stats,
      classSummary,
      keyReadersConcern,
      priorityIntervention,
      allStudents: studentResults
    });
  } catch (err) {
    console.error('Year group report error:', err);
    res.status(500).json({ error: 'Failed to generate year group report.' });
  }
});

// GET /api/reports/export/student/:studentId - Export individual student data
router.get('/export/student/:studentId', (req, res) => {
  try {
    const studentId = req.params.studentId;

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    if (req.user.role !== 'admin' && student.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const results = db.prepare(`
      SELECT * FROM test_results WHERE student_id = ? ORDER BY completed_at DESC
    `).all(studentId);

    // Build CSV
    const headers = [
      'Student Name', 'Date of Birth', 'Chronological Age', 'Test Form', 'Date Taken',
      'Time Taken (mins)', 'Overall Score', 'Percentage', 'Reading Age', 'Age Gap',
      'Literal Comp %', 'Inference %', 'Vocabulary %', 'Synthesis %', 'Weaknesses'
    ];

    const rows = results.map(r => {
      const chronAge = calculateChronologicalAge(student.date_of_birth);
      const gap = r.estimated_reading_age - chronAge;
      const litPct = Math.round((r.literal_comprehension_score / r.literal_comprehension_possible) * 100);
      const infPct = Math.round((r.inference_score / r.inference_possible) * 100);
      const vocPct = Math.round((r.vocabulary_score / r.vocabulary_possible) * 100);
      const synPct = Math.round((r.synthesis_score / r.synthesis_possible) * 100);

      const weaknesses = [];
      if (litPct < 60) weaknesses.push('Literal');
      if (infPct < 60) weaknesses.push('Inference');
      if (vocPct < 60) weaknesses.push('Vocabulary');
      if (synPct < 60) weaknesses.push('Synthesis');

      return [
        `${student.first_name} ${student.last_name}`,
        student.date_of_birth,
        chronAge.toFixed(1),
        r.test_form_number,
        r.completed_at,
        Math.round(r.time_taken_seconds / 60),
        `${r.total_score}/26`,
        r.percentage_score,
        r.estimated_reading_age.toFixed(1),
        (gap >= 0 ? '+' : '') + gap.toFixed(1),
        litPct,
        infPct,
        vocPct,
        synPct,
        weaknesses.join('; ') || 'None'
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="student_${studentId}_report.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export student error:', err);
    res.status(500).json({ error: 'Failed to export student data.' });
  }
});

// GET /api/reports/export/class/:className - Export class data
router.get('/export/class/:className', (req, res) => {
  try {
    const className = req.params.className;

    let studentsQuery = 'SELECT * FROM students WHERE class_name = ?';
    if (req.user.role !== 'admin') {
      studentsQuery += ' AND teacher_id = ?';
    }
    studentsQuery += ' ORDER BY last_name, first_name';

    const students = req.user.role === 'admin'
      ? db.prepare(studentsQuery).all(className)
      : db.prepare(studentsQuery).all(className, req.user.id);

    const headers = [
      'Class', 'Student Name', 'DOB', 'Chron Age', 'Test Form', 'Date Taken',
      'Score', 'Percentage', 'Reading Age', 'Gap', 'Literal %', 'Inference %',
      'Vocab %', 'Synthesis %', 'Concerns'
    ];

    const rows = students.map(student => {
      const result = db.prepare(`
        SELECT * FROM test_results WHERE student_id = ? ORDER BY completed_at DESC LIMIT 1
      `).get(student.id);

      const chronAge = calculateChronologicalAge(student.date_of_birth);

      if (!result) {
        return [
          className, `${student.first_name} ${student.last_name}`, student.date_of_birth,
          chronAge.toFixed(1), 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A',
          'N/A', 'N/A', 'N/A', 'N/A', 'Not Tested'
        ];
      }

      const gap = result.estimated_reading_age - chronAge;
      const litPct = Math.round((result.literal_comprehension_score / result.literal_comprehension_possible) * 100);
      const infPct = Math.round((result.inference_score / result.inference_possible) * 100);
      const vocPct = Math.round((result.vocabulary_score / result.vocabulary_possible) * 100);
      const synPct = Math.round((result.synthesis_score / result.synthesis_possible) * 100);

      const concerns = [];
      if (gap <= -2) concerns.push('At Risk');
      if (infPct < 60) concerns.push('Inference');
      if (vocPct < 60) concerns.push('Vocabulary');

      return [
        className, `${student.first_name} ${student.last_name}`, student.date_of_birth,
        chronAge.toFixed(1), result.test_form_number, result.completed_at,
        `${result.total_score}/26`, result.percentage_score, result.estimated_reading_age.toFixed(1),
        (gap >= 0 ? '+' : '') + gap.toFixed(1), litPct, infPct, vocPct, synPct,
        concerns.join('; ') || 'None'
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="class_${className}_report.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export class error:', err);
    res.status(500).json({ error: 'Failed to export class data.' });
  }
});

// GET /api/reports/export/year/:year - Export year group data
router.get('/export/year/:year', (req, res) => {
  try {
    const yearGroup = req.params.year;

    const students = db.prepare(`
      SELECT s.*, u.full_name as teacher_name
      FROM students s
      JOIN users u ON s.teacher_id = u.id
      WHERE s.year_group = ? OR s.class_name LIKE ?
      ORDER BY s.class_name, s.last_name, s.first_name
    `).all(yearGroup, `${yearGroup}%`);

    const headers = [
      'Year', 'Class', 'Student Name', 'DOB', 'Chron Age', 'Test Form', 'Date Taken',
      'Score', '%', 'Reading Age', 'Gap', 'At Risk', 'Priority',
      'Literal %', 'Inference %', 'Vocab %', 'Synthesis %'
    ];

    const rows = students.map(student => {
      const result = db.prepare(`
        SELECT * FROM test_results WHERE student_id = ? ORDER BY completed_at DESC LIMIT 1
      `).get(student.id);

      const chronAge = calculateChronologicalAge(student.date_of_birth);

      if (!result) {
        return [
          yearGroup, student.class_name, `${student.first_name} ${student.last_name}`,
          student.date_of_birth, chronAge.toFixed(1), 'N/A', 'N/A', 'N/A', 'N/A',
          'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'
        ];
      }

      const gap = result.estimated_reading_age - chronAge;
      const litPct = Math.round((result.literal_comprehension_score / result.literal_comprehension_possible) * 100);
      const infPct = Math.round((result.inference_score / result.inference_possible) * 100);
      const vocPct = Math.round((result.vocabulary_score / result.vocabulary_possible) * 100);
      const synPct = Math.round((result.synthesis_score / result.synthesis_possible) * 100);

      const isAtRisk = gap <= -2;
      const isPriority = isAtRisk && [litPct, infPct, vocPct, synPct].filter(p => p < 60).length >= 2;

      return [
        yearGroup, student.class_name, `${student.first_name} ${student.last_name}`,
        student.date_of_birth, chronAge.toFixed(1), result.test_form_number, result.completed_at,
        `${result.total_score}/26`, result.percentage_score, result.estimated_reading_age.toFixed(1),
        (gap >= 0 ? '+' : '') + gap.toFixed(1), isAtRisk ? 'Yes' : 'No', isPriority ? 'Yes' : 'No',
        litPct, infPct, vocPct, synPct
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="year_${yearGroup}_report.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export year error:', err);
    res.status(500).json({ error: 'Failed to export year group data.' });
  }
});

module.exports = router;
