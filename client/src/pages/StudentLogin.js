import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { studentApi } from '../utils/api';

function StudentLogin() {
  const [students, setStudents] = useState({});
  const [selectedStudent, setSelectedStudent] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { studentLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const data = await studentApi.getAvailable();
      setStudents(data);
    } catch (err) {
      setError('Failed to load student list');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await studentLogin(selectedStudent, dateOfBirth);
      navigate('/test');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDOB = (value) => {
    // Allow users to type in DD/MM/YYYY format
    const cleaned = value.replace(/[^\d]/g, '');
    let formatted = cleaned;

    if (cleaned.length > 2) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    if (cleaned.length > 4) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4) + '/' + cleaned.slice(4, 8);
    }

    return formatted;
  };

  const hasStudents = Object.keys(students).length > 0;

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Reading Assessment</h1>
        <p className="login-subtitle">Student Login</p>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : !hasStudents ? (
          <div className="empty-state">
            <p>No tests are currently available.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>
              Please check with your teacher if you should have a test assigned.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Select Your Name</label>
              <select
                className="form-select"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                required
              >
                <option value="">-- Select your name --</option>
                {Object.entries(students).map(([className, studentList]) => (
                  <optgroup key={className} label={`Class ${className}`}>
                    {studentList.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.firstName} {student.lastName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth (DD/MM/YYYY)</label>
              <input
                type="text"
                className="form-input"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(formatDOB(e.target.value))}
                placeholder="DD/MM/YYYY"
                maxLength={10}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px' }}
              disabled={submitting || !selectedStudent || dateOfBirth.length < 10}
            >
              {submitting ? 'Logging in...' : 'Start Test'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link
            to="/login"
            style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}
          >
            Staff login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default StudentLogin;
