import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reportsApi } from '../utils/api';

function YearReport() {
  const { year } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadReport();
  }, [year]);

  const loadReport = async () => {
    try {
      const data = await reportsApi.getYearReport(year);
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

  const { stats, classSummary, keyReadersConcern, priorityIntervention, allStudents } = report;

  return (
    <div>
      <div className="report-header">
        <h1 className="report-title">Year {stats.yearGroup} Report</h1>
        <div className="report-subtitle">
          {stats.totalStudents} students | {stats.testedCount} tested
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.testedCount}/{stats.totalStudents}</div>
          <div className="stat-label">Students Tested</div>
        </div>
        {stats.meanReadingAge && (
          <>
            <div className="stat-card">
              <div className="stat-value">{stats.meanReadingAge}</div>
              <div className="stat-label">Mean Reading Age</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#16a34a' }}>{stats.atOrAboveExpected}%</div>
              <div className="stat-label">At or Above Expected</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#dc2626' }}>{stats.twoOrMoreBelow}%</div>
              <div className="stat-label">2+ Years Below</div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'classes' ? 'active' : ''}`}
          onClick={() => setActiveTab('classes')}
        >
          By Class
        </button>
        <button
          className={`tab ${activeTab === 'concern' ? 'active' : ''}`}
          onClick={() => setActiveTab('concern')}
        >
          Students of Concern ({keyReadersConcern.length})
        </button>
        <button
          className={`tab ${activeTab === 'priority' ? 'active' : ''}`}
          onClick={() => setActiveTab('priority')}
        >
          Priority Intervention ({priorityIntervention.length})
        </button>
        <button
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Students
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats.skillAverages && (
        <div className="grid-2">
          <div className="card">
            <h2 className="card-title mb-2">Year Group Skill Averages</h2>
            <div className="skill-bars">
              <SkillBar label="Literal Comprehension" percentage={stats.skillAverages.literalComprehension} />
              <SkillBar label="Inference" percentage={stats.skillAverages.inference} />
              <SkillBar label="Vocabulary" percentage={stats.skillAverages.vocabulary} />
              <SkillBar label="Synthesis/Analysis" percentage={stats.skillAverages.synthesis} />
            </div>

            {stats.cohortWeaknesses?.length > 0 && (
              <div className="mt-3">
                <h3 style={{ fontSize: '0.9rem', color: '#dc2626', marginBottom: '8px' }}>
                  Cohort-Wide Weaknesses (more than 40% struggling)
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {stats.cohortWeaknesses.map(w => (
                    <span key={w} className="badge badge-danger">{w}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="card-title mb-2">Key Statistics</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Students</span>
                <strong>{stats.totalStudents}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Tested</span>
                <strong>{stats.testedCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>At or Above Expected Level</span>
                <strong style={{ color: '#16a34a' }}>{stats.atOrAboveExpected}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>1 Year Below</span>
                <strong style={{ color: '#f59e0b' }}>{stats.oneYearBelow}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>2+ Years Below</span>
                <strong style={{ color: '#dc2626' }}>{stats.twoOrMoreBelow}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>At-Risk Students</span>
                <strong style={{ color: '#dc2626' }}>{stats.atRiskCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Priority Intervention Needed</span>
                <strong style={{ color: '#dc2626' }}>{stats.priorityCount}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Classes Tab */}
      {activeTab === 'classes' && (
        <div className="card">
          <h2 className="card-title mb-2">Class Comparison</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Teacher</th>
                  <th>Students</th>
                  <th>Mean Reading Age</th>
                  <th>At Expected %</th>
                  <th>At Risk</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classSummary.map(cls => (
                  <tr key={cls.className}>
                    <td><strong>{cls.className}</strong></td>
                    <td>{cls.teacherName}</td>
                    <td>{cls.studentCount}</td>
                    <td>{cls.meanReadingAge}</td>
                    <td>{cls.atExpectedPercent}%</td>
                    <td>
                      {cls.atRiskCount > 0 ? (
                        <span className="badge badge-danger">{cls.atRiskCount}</span>
                      ) : (
                        <span className="badge badge-success">0</span>
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/reports/class/${encodeURIComponent(cls.className)}`}
                        className="btn btn-small btn-primary"
                      >
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

      {/* Students of Concern Tab */}
      {activeTab === 'concern' && (
        <div className="card">
          <h2 className="card-title mb-2">Key Readers of Concern (2+ Years Below)</h2>
          {keyReadersConcern.length === 0 ? (
            <p className="text-center" style={{ color: '#6b7280', padding: '24px' }}>
              No students of concern identified
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Chron. Age</th>
                    <th>Reading Age</th>
                    <th>Gap</th>
                    <th>Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keyReadersConcern.map(s => (
                    <tr key={s.studentId}>
                      <td>
                        <Link to={`/reports/student/${s.studentId}`}>
                          <strong>{s.firstName} {s.lastName}</strong>
                        </Link>
                      </td>
                      <td>{s.className}</td>
                      <td>{s.chronologicalAge.toFixed(1)}</td>
                      <td>{s.readingAge.toFixed(1)}</td>
                      <td style={{ color: '#dc2626', fontWeight: 600 }}>{s.gap.toFixed(1)}</td>
                      <td>{s.percentageScore}%</td>
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
          )}
        </div>
      )}

      {/* Priority Intervention Tab */}
      {activeTab === 'priority' && (
        <div className="card">
          <h2 className="card-title mb-2">Priority Intervention List</h2>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            Students who are at-risk (2+ years below) AND have multiple skill weaknesses
          </p>
          {priorityIntervention.length === 0 ? (
            <p className="text-center" style={{ color: '#6b7280', padding: '24px' }}>
              No priority intervention students identified
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Gap</th>
                    <th>Weak Areas</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {priorityIntervention.map(s => (
                    <tr key={s.studentId}>
                      <td>
                        <Link to={`/reports/student/${s.studentId}`}>
                          <strong>{s.firstName} {s.lastName}</strong>
                        </Link>
                      </td>
                      <td>{s.className}</td>
                      <td style={{ color: '#dc2626', fontWeight: 600 }}>{s.gap.toFixed(1)}</td>
                      <td><span className="badge badge-danger">{s.weaknessCount} skills</span></td>
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
          )}
        </div>
      )}

      {/* All Students Tab */}
      {activeTab === 'all' && (
        <div className="card">
          <h2 className="card-title mb-2">All Students</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Chron. Age</th>
                  <th>Reading Age</th>
                  <th>Gap</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allStudents.map(s => (
                  <tr key={s.studentId}>
                    <td>
                      <Link to={`/reports/student/${s.studentId}`}>
                        {s.firstName} {s.lastName}
                      </Link>
                    </td>
                    <td>{s.className}</td>
                    <td>{s.chronologicalAge.toFixed(1)}</td>
                    <td>{s.hasResult ? s.readingAge.toFixed(1) : '-'}</td>
                    <td style={{ color: s.hasResult ? (s.gap >= 0 ? '#16a34a' : '#dc2626') : '#6b7280' }}>
                      {s.hasResult ? `${s.gap >= 0 ? '+' : ''}${s.gap.toFixed(1)}` : '-'}
                    </td>
                    <td>
                      {!s.hasResult ? (
                        <span className="badge badge-info">Not Tested</span>
                      ) : s.isPriority ? (
                        <span className="badge badge-danger">Priority</span>
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
      )}

      {/* Export */}
      <div className="flex flex-between mt-3">
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/reports/year/7" className={`btn ${year === '7' ? 'btn-primary' : 'btn-secondary'}`}>
            Year 7
          </Link>
          <Link to="/reports/year/8" className={`btn ${year === '8' ? 'btn-primary' : 'btn-secondary'}`}>
            Year 8
          </Link>
        </div>
        <a
          href={reportsApi.exportYear(year)}
          className="btn btn-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Export Year {year} to CSV
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

export default YearReport;
