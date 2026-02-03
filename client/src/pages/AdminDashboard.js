import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../utils/api';

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await adminApi.getDashboard();
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
      <h1 style={{ marginBottom: '24px' }}>Admin Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{data.stats.totalTeachers}</div>
          <div className="stat-label">Teachers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.stats.totalStudents}</div>
          <div className="stat-label">Students</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.stats.totalTestsCompleted}</div>
          <div className="stat-label">Tests Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.stats.activeAssignments}</div>
          <div className="stat-label">Active Assignments</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Quick Actions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link to="/admin/teachers" className="btn btn-primary">
              Manage Teachers
            </Link>
            <Link to="/students" className="btn btn-secondary">
              View All Students
            </Link>
            <Link to="/results" className="btn btn-secondary">
              View All Results
            </Link>
            <Link to="/reports/year/7" className="btn btn-secondary">
              Year 7 Report
            </Link>
            <Link to="/reports/year/8" className="btn btn-secondary">
              Year 8 Report
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Test Results</h2>
          </div>
          {data.recentResults.length === 0 ? (
            <p className="text-center" style={{ color: '#6b7280' }}>No test results yet</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
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
                      <td>{result.class_name}</td>
                      <td>{result.total_score}/26 ({result.percentage_score}%)</td>
                      <td>{result.estimated_reading_age.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
