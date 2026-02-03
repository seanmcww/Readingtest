import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { teacherApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function Results() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const { isAdmin } = useAuth();

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      const data = await teacherApi.getResults();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = filter
    ? results.filter(r =>
        r.class_name.toLowerCase().includes(filter.toLowerCase()) ||
        r.first_name.toLowerCase().includes(filter.toLowerCase()) ||
        r.last_name.toLowerCase().includes(filter.toLowerCase())
      )
    : results;

  // Get unique classes for filter
  const classes = [...new Set(results.map(r => r.class_name))].sort();

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="flex flex-between flex-center mb-3">
        <h1>Test Results</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name or class..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: '250px' }}
          />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {results.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <p>No test results yet</p>
            <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Results will appear here after students complete their tests
            </p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span>{filteredResults.length} results</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {classes.map(cls => (
                <Link
                  key={cls}
                  to={`/reports/class/${encodeURIComponent(cls)}`}
                  className="btn btn-small btn-secondary"
                >
                  {cls} Report
                </Link>
              ))}
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  {isAdmin && <th>Teacher</th>}
                  <th>Test</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Reading Age</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map(result => {
                  const chronAge = calculateAge(result.date_of_birth);
                  const gap = result.estimated_reading_age - chronAge;
                  const isAtRisk = gap <= -2;

                  return (
                    <tr key={result.id}>
                      <td>
                        <Link to={`/reports/student/${result.student_id}`}>
                          <strong>{result.first_name} {result.last_name}</strong>
                        </Link>
                      </td>
                      <td>{result.class_name}</td>
                      {isAdmin && <td>{result.teacher_name}</td>}
                      <td>Form {result.test_form_number}</td>
                      <td>{new Date(result.completed_at).toLocaleDateString('en-GB')}</td>
                      <td>
                        {result.total_score}/26 ({result.percentage_score}%)
                      </td>
                      <td>
                        <strong>{result.estimated_reading_age.toFixed(1)}</strong>
                        <span style={{ fontSize: '0.8rem', color: gap >= 0 ? '#16a34a' : '#dc2626', marginLeft: '4px' }}>
                          ({gap >= 0 ? '+' : ''}{gap.toFixed(1)})
                        </span>
                      </td>
                      <td>
                        {isAtRisk ? (
                          <span className="badge badge-danger">At Risk</span>
                        ) : gap < 0 ? (
                          <span className="badge badge-warning">Below</span>
                        ) : (
                          <span className="badge badge-success">On Track</span>
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/reports/student/${result.student_id}`}
                          className="btn btn-small btn-primary"
                        >
                          View Report
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function calculateAge(dob) {
  const today = new Date();
  const birth = new Date(dob);
  const diffMs = today - birth;
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

export default Results;
