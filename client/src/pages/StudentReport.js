import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reportsApi } from '../utils/api';

function StudentReport() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReport();
  }, [id]);

  const loadReport = async () => {
    try {
      const data = await reportsApi.getStudentReport(id);
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  const { student, results } = report;
  const latestResult = results[0];

  return (
    <div>
      <div className="report-header">
        <Link to="/results" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to Results
        </Link>
        <h1 className="report-title mt-2">
          {student.firstName} {student.lastName}
        </h1>
        <div className="report-subtitle">
          Class {student.className} | DOB: {new Date(student.dateOfBirth).toLocaleDateString('en-GB')} |
          Chronological Age: {student.chronologicalAge.toFixed(1)} years
        </div>
      </div>

      {results.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>No test results available for this student</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid-2">
            {/* Reading Age Summary */}
            <div className="card">
              <div className="reading-age-display">
                <div className="reading-age-value">{latestResult.estimatedReadingAge.toFixed(1)}</div>
                <div className="reading-age-label">Estimated Reading Age</div>
                <div className={`gap-indicator ${latestResult.gapAnalysis.gap >= 0 ? 'gap-positive' : 'gap-negative'}`}>
                  {latestResult.gapAnalysis.gap >= 0 ? '+' : ''}{latestResult.gapAnalysis.gap.toFixed(1)} years vs chronological age
                </div>
              </div>
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <p><strong>Test Form:</strong> {latestResult.testFormNumber}</p>
                <p><strong>Date:</strong> {new Date(latestResult.completedAt).toLocaleDateString('en-GB')}</p>
                <p><strong>Score:</strong> {latestResult.totalScore}/{latestResult.totalPossible} ({latestResult.percentageScore}%)</p>
                {latestResult.timeTaken > 0 && (
                  <p><strong>Time:</strong> {Math.round(latestResult.timeTaken / 60)} minutes</p>
                )}
              </div>
            </div>

            {/* Skill Breakdown */}
            <div className="card">
              <h2 className="card-title mb-2">Skill Area Analysis</h2>
              <div className="skill-bars">
                <SkillBar
                  label="Literal Comprehension"
                  score={latestResult.skillScores.literal_comprehension}
                />
                <SkillBar
                  label="Inference"
                  score={latestResult.skillScores.inference}
                />
                <SkillBar
                  label="Vocabulary"
                  score={latestResult.skillScores.vocabulary}
                />
                <SkillBar
                  label="Synthesis/Analysis"
                  score={latestResult.skillScores.synthesis}
                />
              </div>

              {latestResult.weaknesses.length > 0 && (
                <div className="mt-3">
                  <h3 style={{ fontSize: '0.9rem', color: '#dc2626', marginBottom: '8px' }}>
                    Identified Weaknesses (below 60%)
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {latestResult.weaknesses.map(w => (
                      <span key={w} className="badge badge-danger">{w}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Difficulty Level Performance */}
          <div className="card">
            <h2 className="card-title mb-2">Performance by Difficulty Level</h2>
            <div className="skill-bars">
              {[1, 2, 3, 4, 5].map(level => (
                <SkillBar
                  key={level}
                  label={`Level ${level}`}
                  score={latestResult.difficultyScores[level]}
                />
              ))}
            </div>
          </div>

          {/* Interventions */}
          {latestResult.interventions.length > 0 && (
            <div className="card">
              <h2 className="card-title mb-2">Recommended Interventions</h2>
              {latestResult.interventions.map((intervention, index) => (
                <div key={index} style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1rem', color: '#dc2626', marginBottom: '8px' }}>
                    {intervention.skill}
                  </h3>
                  <ul style={{ paddingLeft: '20px', color: '#4b5563' }}>
                    {intervention.recommendations.map((rec, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{rec}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Test History */}
          {results.length > 1 && (
            <div className="card">
              <h2 className="card-title mb-2">Test History</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Form</th>
                      <th>Score</th>
                      <th>Reading Age</th>
                      <th>Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={index}>
                        <td>{new Date(result.completedAt).toLocaleDateString('en-GB')}</td>
                        <td>Form {result.testFormNumber}</td>
                        <td>{result.percentageScore}%</td>
                        <td>{result.estimatedReadingAge.toFixed(1)}</td>
                        <td style={{ color: result.gapAnalysis.gap >= 0 ? '#16a34a' : '#dc2626' }}>
                          {result.gapAnalysis.gap >= 0 ? '+' : ''}{result.gapAnalysis.gap.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Export Button */}
          <div className="flex flex-between mt-3">
            <Link to={`/reports/class/${encodeURIComponent(student.className)}`} className="btn btn-secondary">
              View Class Report
            </Link>
            <a
              href={reportsApi.exportStudent(id)}
              className="btn btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Export to CSV
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function SkillBar({ label, score }) {
  const percentage = score.percentage || 0;
  const colorClass = percentage >= 60 ? 'good' : percentage >= 40 ? 'warning' : 'danger';

  return (
    <div className="skill-bar">
      <span className="skill-label">{label}</span>
      <div className="skill-progress">
        <div
          className={`skill-fill ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="skill-value">
        {score.score}/{score.possible} ({percentage}%)
      </span>
    </div>
  );
}

export default StudentReport;
