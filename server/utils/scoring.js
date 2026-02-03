/**
 * Reading Age Calculation and Scoring Utilities
 * Based on difficulty level performance across cumulative levels
 */

/**
 * Calculate reading age based on performance across difficulty levels
 * @param {Object} difficultyScores - Scores by difficulty level
 * @returns {number} Estimated reading age
 */
function calculateReadingAge(difficultyScores) {
  // Calculate percentages for cumulative levels
  const level1_2_correct = (difficultyScores[1]?.score || 0) + (difficultyScores[2]?.score || 0);
  const level1_2_possible = (difficultyScores[1]?.possible || 3) + (difficultyScores[2]?.possible || 6);
  const level1_2_percent = (level1_2_correct / level1_2_possible) * 100;

  const level1_3_correct = level1_2_correct + (difficultyScores[3]?.score || 0);
  const level1_3_possible = level1_2_possible + (difficultyScores[3]?.possible || 8);
  const level1_3_percent = (level1_3_correct / level1_3_possible) * 100;

  const level1_4_correct = level1_3_correct + (difficultyScores[4]?.score || 0);
  const level1_4_possible = level1_3_possible + (difficultyScores[4]?.possible || 5);
  const level1_4_percent = (level1_4_correct / level1_4_possible) * 100;

  const allLevels_correct = level1_4_correct + (difficultyScores[5]?.score || 0);
  const allLevels_possible = level1_4_possible + (difficultyScores[5]?.possible || 4);
  const allLevels_percent = (allLevels_correct / allLevels_possible) * 100;

  // Determine reading age band (more granular calculation)
  if (allLevels_percent >= 80) {
    // 15-16 range - interpolate within
    const excess = allLevels_percent - 80;
    return 15 + (excess / 20) * 1; // Max 16
  }
  if (level1_4_percent >= 70) {
    // 13-14 range
    const excess = level1_4_percent - 70;
    return 13 + (excess / 10) * 1;
  }
  if (level1_4_percent >= 60) {
    // 11-12 range
    const excess = level1_4_percent - 60;
    return 11 + (excess / 10) * 1;
  }
  if (level1_3_percent >= 60) {
    // 9-10 range
    const excess = level1_3_percent - 60;
    return 9 + (excess / 40) * 1;
  }
  if (level1_2_percent >= 60) {
    // 7-8 range
    const excess = level1_2_percent - 60;
    return 7 + (excess / 40) * 1;
  }

  // Below expected level - calculate based on level 1-2 performance
  if (level1_2_percent >= 40) {
    return 6.5;
  }
  return 6.0;
}

/**
 * Calculate skill area scores from answers
 * @param {Array} answers - Array of answer objects with skill_type and is_correct
 * @returns {Object} Skill scores with score, possible, and percentage
 */
function calculateSkillScores(answers) {
  const skills = {
    literal_comprehension: { score: 0, possible: 0 },
    inference: { score: 0, possible: 0 },
    vocabulary: { score: 0, possible: 0 },
    synthesis: { score: 0, possible: 0 }
  };

  answers.forEach(answer => {
    const skillType = normalizeSkillType(answer.skill_type);
    if (skills[skillType]) {
      skills[skillType].possible++;
      if (answer.is_correct) {
        skills[skillType].score++;
      }
    }
  });

  // Calculate percentages
  Object.keys(skills).forEach(key => {
    skills[key].percentage = skills[key].possible > 0
      ? Math.round((skills[key].score / skills[key].possible) * 100 * 10) / 10
      : 0;
  });

  return skills;
}

/**
 * Normalize skill type to main categories
 */
function normalizeSkillType(skillType) {
  const type = skillType.toLowerCase();
  if (type.includes('literal') || type.includes('retrieval')) {
    return 'literal_comprehension';
  }
  if (type.includes('inference')) {
    return 'inference';
  }
  if (type.includes('vocabulary') || type.includes('figurative')) {
    return 'vocabulary';
  }
  if (type.includes('synthesis') || type.includes('analytical')) {
    return 'synthesis';
  }
  return 'inference'; // Default
}

/**
 * Calculate difficulty level scores from answers
 * @param {Array} answers - Array of answer objects with difficulty_level and is_correct
 * @returns {Object} Difficulty scores by level
 */
function calculateDifficultyScores(answers) {
  const levels = {
    1: { score: 0, possible: 0 },
    2: { score: 0, possible: 0 },
    3: { score: 0, possible: 0 },
    4: { score: 0, possible: 0 },
    5: { score: 0, possible: 0 }
  };

  answers.forEach(answer => {
    const level = answer.difficulty_level;
    if (levels[level]) {
      levels[level].possible++;
      if (answer.is_correct) {
        levels[level].score++;
      }
    }
  });

  // Calculate percentages
  Object.keys(levels).forEach(key => {
    levels[key].percentage = levels[key].possible > 0
      ? Math.round((levels[key].score / levels[key].possible) * 100 * 10) / 10
      : 0;
  });

  return levels;
}

/**
 * Calculate chronological age from date of birth
 * @param {string} dateOfBirth - DOB in YYYY-MM-DD format
 * @returns {number} Age in years with decimal
 */
function calculateChronologicalAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  const diffMs = today - dob;
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(diffYears * 10) / 10;
}

/**
 * Calculate reading age gap
 * @param {number} chronologicalAge - Student's actual age
 * @param {number} readingAge - Estimated reading age
 * @returns {Object} Gap analysis
 */
function calculateReadingGap(chronologicalAge, readingAge) {
  const gap = Math.round((readingAge - chronologicalAge) * 10) / 10;
  return {
    gap,
    isAtRisk: gap <= -2,
    isPriority: gap <= -3,
    status: gap >= 0 ? 'at_or_above' : gap >= -1 ? 'slightly_below' : gap >= -2 ? 'below' : 'significantly_below'
  };
}

/**
 * Get weakness threshold flag
 * @param {number} percentage - Score percentage
 * @returns {boolean} True if below 60% threshold
 */
function isWeakness(percentage) {
  return percentage < 60;
}

/**
 * Get intervention recommendations based on weak areas
 * @param {Object} skillScores - Skill area scores
 * @returns {Array} List of interventions
 */
function getInterventionRecommendations(skillScores) {
  const interventions = [];

  if (isWeakness(skillScores.literal_comprehension.percentage)) {
    interventions.push({
      skill: 'Literal Comprehension',
      recommendations: [
        'Reciprocal reading activities',
        'Explicit instruction in skimming and scanning',
        'Question-answer relationship (QAR) strategy',
        'Close reading practice with highlighting key information'
      ]
    });
  }

  if (isWeakness(skillScores.inference.percentage)) {
    interventions.push({
      skill: 'Inference',
      recommendations: [
        'Think-aloud modeling of inference-making',
        '"Reading between the lines" explicit instruction',
        'Inference question stems practice',
        'Evidence-based reasoning activities',
        'Making predictions and checking them'
      ]
    });
  }

  if (isWeakness(skillScores.vocabulary.percentage)) {
    interventions.push({
      skill: 'Vocabulary',
      recommendations: [
        'Context clue strategy instruction',
        'Word morphology study (roots, prefixes, suffixes)',
        'Academic vocabulary building (Tier 2 words)',
        'Word mapping and semantic feature analysis',
        'Wide reading to build vocabulary naturally'
      ]
    });
  }

  if (isWeakness(skillScores.synthesis.percentage)) {
    interventions.push({
      skill: 'Synthesis/Analysis',
      recommendations: [
        'Summarizing practice (main idea identification)',
        'Graphic organizers for text structure',
        'Compare and contrast activities',
        "Author's purpose and craft analysis",
        'Critical thinking question practice'
      ]
    });
  }

  return interventions;
}

module.exports = {
  calculateReadingAge,
  calculateSkillScores,
  calculateDifficultyScores,
  calculateChronologicalAge,
  calculateReadingGap,
  isWeakness,
  getInterventionRecommendations,
  normalizeSkillType
};
