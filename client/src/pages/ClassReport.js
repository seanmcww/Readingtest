import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reportsApi } from '../utils/api';

function ClassReport() {
  const { className } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReport();
  }, [className]);

  const loadReport = async () => {
    try {
      const data = await reportsApi.getClassReport(decodeURIComponent(className));
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

  const { stats, students, studentsOfConcern } = report;

  return (
    <div>
      <div className="report-header">
        <Link to="/results" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to Results
        </Link>
        <h1 className="report-title mt-2">Class {report.className} Report</h1>
        <div className="report-subtitle">
          Teacher: {report.teacherName} | {stats.totalStudents} students
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.completedCount}/{stats.totalStudents}</div>
          <div className="stat-label">Tests Completed</div>
        </div>
        {stats.meanReadingAge && (
          <>
            <div className="stat-card">
              <div className="stat-value">{stats.meanReadingAge}</div>
              <div className="stat-label">Mean Reading Age</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.minReadingAge} - {stats.maxReadingAge}</div>
              <div className="stat-label">Reading Age Range</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: stats.atRiskCount > 0 ? '#dc2626' : '#16a34a' }}>
                {stats.atRiskCount}
              </div>
              <div className="stat-label">At-Risk Students</div>
            </div>
          </>
        )}
      </div>

      {stats.skillAverages && (
        <div className="card">
          <h2 className="card-title mb-2">Class Skill Averages</h2>
          <div className="skill-bars">
            <SkillBar label="Literal Comprehension" percentage={stats.skillAverages.literalComprehension} />
            <SkillBar label="Inference" percentage={stats.skillAverages.inference} />
            <SkillBar label="Vocabulary" percentage={stats.skillAverages.vocabulary} />
            <SkillBar label="Synthesis/Analysis" percentage={stats.skillAverages.synthesis} />
          </div>

          {stats.commonWeaknesses?.length > 0 && (
            <div className="mt-3">
              <h3 style={{ fontSize: '0.9rem', color: '#dc2626', marginBottom: '8px' }}>
                Common Weaknesses (more than 50% of class below 60%)
              </h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {stats.commonWeaknesses.map(w => (
                  <span key={w} className="badge badge-danger">{w}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Students of Concern */}
      {studentsOfConcern.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Students of Concern</h2>
            <span className="badge badge-danger">{studentsOfConcern.length} students 2+ years below</span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Chron. Age</th>
                  <th>Reading Age</th>
                  <th>Gap</th>
                  <th>Weakest Skill</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentsOfConcern.map(s => (
                  <tr key={s.studentId}>
                    <td>
                      <Link to={`/reports/student/${s.studentId}`}>
                        <strong>{s.firstName} {s.lastName}</strong>
                      </Link>
                    </td>
                    <td>{s.chronologicalAge.toFixed(1)}</td>
                    <td>{s.readingAge.toFixed(1)}</td>
                    <td style={{ color: '#dc2626', fontWeight: 600 }}>{s.gap.toFixed(1)}</td>
                    <td><span className="badge badge-warning">{s.weakestSkill}</span></td>
                    <td>
                      <Link to={`/reports/student/${s.studentId}`} className="btn btn-small btn-primary">
                        View Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Students */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">All Students</h2>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>DOB</th>
                <th>Chron. Age</th>
                <th>Reading Age</th>
                <th>Gap</th>
                <th>Score</th>
                <th>Weakest Skill</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.studentId}>
                  <td>
                    <Link to={`/reports/student/${s.studentId}`}>
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td>{new Date(s.dateOfBirth).toLocaleDateString('en-GB')}</td>
                  <td>{s.chronologicalAge.toFixed(1)}</td>
                  <td>{s.hasResult ? s.readingAge.toFixed(1) : '-'}</td>
                  <td style={{ color: s.hasResult ? (s.gap >= 0 ? '#16a34a' : '#dc2626') : '#6b7280' }}>
                    {s.hasResult ? `${s.gap >= 0 ? '+' : ''}${s.gap.toFixed(1)}` : '-'}
                  </td>
                  <td>{s.hasResult ? `${s.percentageScore}%` : '-'}</td>
                  <td>
                    {s.hasResult && s.weakestSkill && (
                      <span className="badge badge-warning">{s.weakestSkill}</span>
                    )}
                  </td>
                  <td>
                    {!s.hasResult ? (
                      <span className="badge badge-info">Not Tested</span>
                    ) : s.isAtRisk ? (
                      <span className="badge badge-danger">At Risk</span>
                    ) : s.gap < 0 ? (
                      <span className="badge badge-warning">Below</span>
                    ) : (
                      <span className="badge badge-success">On Track</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export */}
      <div className="flex flex-between mt-3">
        <div></div>
        <a
          href={reportsApi.exportClass(className)}
          className="btn btn-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Export to CSV
        </a>
      </div>
    </div>
  );
}

function SkillBar({ label, percentage }) {
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
      <span className="skill-value">{percentage}%</span>
    </div>
  );
}

export default ClassReport;
