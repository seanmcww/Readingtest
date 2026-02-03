import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { studentApi } from '../utils/api';

function TestInterface() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPart, setCurrentPart] = useState(0);
  const [answers, setAnswers] = useState({});
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTest();
  }, []);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const loadTest = async () => {
    try {
      const data = await studentApi.getTest();
      setTest(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionNumber, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionNumber]: answer
    }));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAnsweredCount = () => Object.keys(answers).length;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Format answers for submission
      const formattedAnswers = [];
      for (let i = 1; i <= 26; i++) {
        formattedAnswers.push({
          questionNumber: i,
          selectedAnswer: answers[i] || 'A' // Default to A if not answered
        });
      }

      const result = await studentApi.submitTest(formattedAnswers, elapsedTime);
      navigate('/test-complete', { state: result });
    } catch (err) {
      setError(err.message);
      setShowSubmitModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const checkUnanswered = () => {
    const unanswered = [];
    for (let i = 1; i <= 26; i++) {
      if (!answers[i]) {
        unanswered.push(i);
      }
    }
    return unanswered;
  };

  if (loading) {
    return (
      <div className="test-container" style={{ padding: '48px' }}>
        <div className="loading">
          <div className="spinner"></div>
        </div>
        <p className="text-center mt-2">Loading your test...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="test-container" style={{ padding: '48px' }}>
        <div className="alert alert-error">{error}</div>
        <button onClick={logout} className="btn btn-secondary mt-2">Return to Login</button>
      </div>
    );
  }

  const part = test.parts[currentPart];
  const unanswered = checkUnanswered();

  return (
    <div className="test-container">
      {/* Header */}
      <div className="test-header">
        <div>
          <strong>{user.firstName} {user.lastName}</strong>
          <span style={{ color: '#6b7280', marginLeft: '12px' }}>Class {user.className}</span>
        </div>
        <div className="test-progress">
          {getAnsweredCount()}/26 Questions Answered
        </div>
        <div className="test-timer">
          {formatTime(elapsedTime)}
        </div>
      </div>

      {/* Part Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {test.parts.map((p, index) => (
          <button
            key={index}
            className={`btn ${currentPart === index ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCurrentPart(index)}
          >
            Part {p.partNumber}: {p.title}
          </button>
        ))}
      </div>

      {/* Test Content */}
      <div className="test-content">
        {/* Passage Panel */}
        <div className="passage-panel">
          <h2 className="passage-title">Part {part.partNumber}: {part.title}</h2>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '16px' }}>
            Reading Age: {part.readingAge}
          </p>
          <div className="passage-text">
            {part.passage}
          </div>
        </div>

        {/* Questions Panel */}
        <div className="questions-panel">
          {part.questions.map(question => (
            <div key={question.questionNumber} className="question">
              <div className="question-number">
                Question {question.questionNumber}
                {answers[question.questionNumber] && (
                  <span style={{ color: '#16a34a', marginLeft: '8px' }}>✓</span>
                )}
              </div>
              <div className="question-text">{question.questionText}</div>
              <div className="options">
                {Object.entries(question.options).map(([letter, text]) => (
                  <label
                    key={letter}
                    className={`option ${answers[question.questionNumber] === letter ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`q${question.questionNumber}`}
                      value={letter}
                      checked={answers[question.questionNumber] === letter}
                      onChange={() => handleAnswerSelect(question.questionNumber, letter)}
                    />
                    <span className="option-text">
                      <strong>{letter}.</strong> {text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="test-nav">
        <button
          className="btn btn-secondary"
          onClick={() => setCurrentPart(p => Math.max(0, p - 1))}
          disabled={currentPart === 0}
        >
          ← Previous Part
        </button>

        <div>
          {currentPart < test.parts.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setCurrentPart(p => p + 1)}
            >
              Next Part →
            </button>
          ) : (
            <button
              className="btn btn-success"
              onClick={() => setShowSubmitModal(true)}
            >
              Submit Test
            </button>
          )}
        </div>
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Submit Test?</h2>
              <button className="modal-close" onClick={() => setShowSubmitModal(false)}>&times;</button>
            </div>

            <p>You have answered <strong>{getAnsweredCount()}</strong> out of <strong>26</strong> questions.</p>
            <p>Time taken: <strong>{formatTime(elapsedTime)}</strong></p>

            {unanswered.length > 0 && (
              <div className="alert alert-warning" style={{ marginTop: '16px' }}>
                <strong>Warning:</strong> You have {unanswered.length} unanswered question(s):
                Questions {unanswered.join(', ')}
              </div>
            )}

            <p style={{ marginTop: '16px' }}>
              Are you sure you want to submit? You cannot change your answers after submission.
            </p>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
              >
                Review Answers
              </button>
              <button
                className="btn btn-success"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TestInterface;
