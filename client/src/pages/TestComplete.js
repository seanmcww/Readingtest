import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function TestComplete() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const result = location.state;

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '500px', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
        <h1 style={{ color: '#16a34a', marginBottom: '8px' }}>Test Complete!</h1>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>
          Well done, {user.firstName}! You have completed your reading assessment.
        </p>

        {result && (
          <div style={{
            background: '#f3f4f6',
            padding: '24px',
            borderRadius: '12px',
            marginBottom: '24px'
          }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Your Score</div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#2563eb' }}>
                {result.score}/{result.totalPossible}
              </div>
              <div style={{ fontSize: '1.25rem', color: '#4b5563' }}>
                {result.percentage}%
              </div>
            </div>
          </div>
        )}

        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '24px' }}>
          Your teacher will review your results and discuss them with you.
        </p>

        <button onClick={logout} className="btn btn-primary" style={{ width: '100%' }}>
          Finish and Exit
        </button>
      </div>
    </div>
  );
}

export default TestComplete;
