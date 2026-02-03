import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { teacherApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function TeacherDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await teacherApi.getDashboard();
      setData(result);
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

  return (
    <div>
      <h1 style={{ marginBottom: '8px' }}>Welcome, {user.fullName}</h1>
      <p style={{ color: '#6b7280', marginBottom: '24px' }}>Teacher Dashboard</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{data.stats.totalStudents}</div>
          <div className="stat-label">My Students</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.stats.activeAssignments}</div>
          <div className="stat-label">Active Assignments</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.stats.completedTests}</div>
          <div className="stat-label">Tests Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.classes.length}</div>
          <div className="stat-label">Classes</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">My Classes</h2>
            <Link to="/students" className="btn btn-small btn-primary">Add Students</Link>
          </div>
          {data.classes.length === 0 ? (
            <p className="text-center" style={{ color: '#6b7280' }}>
              No students yet. <Link to="/students">Add your first student</Link>
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Students</th>
                    <th>Tests Done</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.classes.map(cls => (
                    <tr key={cls.class_name}>
                      <td><strong>{cls.class_name}</strong></td>
                      <td>{cls.student_count}</td>
                      <td>{cls.tests_completed}</td>
                      <td>
                        <Link
                          to={`/reports/class/${encodeURIComponent(cls.class_name)}`}
                          className="btn btn-small btn-secondary"
                        >
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

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Results</h2>
            <Link to="/results" className="btn btn-small btn-secondary">View All</Link>
          </div>
          {data.recentResults.length === 0 ? (
            <p className="text-center" style={{ color: '#6b7280' }}>No test results yet</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Reading Age</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentResults.map(result => (
                    <tr key={result.id}>
                      <td>
                        <Link to={`/reports/student/${result.student_id}`}>
                          {result.first_name} {result.last_name}
                        </Link>
                      </td>
                      <td>{result.percentage_score}%</td>
                      <td>{result.estimated_reading_age.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Quick Actions</h2>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/students" className="btn btn-primary">Add Student</Link>
          <Link to="/assignments" className="btn btn-secondary">Assign Test</Link>
          <Link to="/results" className="btn btn-secondary">View Results</Link>
        </div>
      </div>
    </div>
  );
}

export default TeacherDashboard;
