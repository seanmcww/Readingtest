import React, { useState, useEffect } from 'react';
import { teacherApi, testsApi } from '../utils/api';

function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    className: '',
    testFormNumber: '',
    dueDate: ''
  });
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assignmentsData, classesData, testsData] = await Promise.all([
        teacherApi.getAssignments(),
        teacherApi.getClasses(),
        testsApi.getAvailable()
      ]);
      setAssignments(assignmentsData);
      setClasses(classesData);
      setAvailableTests(testsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = async (className) => {
    setFormData({ ...formData, className });

    if (className) {
      try {
        const rec = await teacherApi.getNextTest(className);
        setRecommendation(rec);
        setFormData(prev => ({ ...prev, testFormNumber: rec.recommendedForm.toString() }));
      } catch (err) {
        console.error('Failed to get recommendation:', err);
      }
    } else {
      setRecommendation(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await teacherApi.createAssignment({
        className: formData.className,
        testFormNumber: parseInt(formData.testFormNumber),
        dueDate: formData.dueDate || null
      });
      setShowModal(false);
      setFormData({ className: '', testFormNumber: '', dueDate: '' });
      setRecommendation(null);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this assignment?')) {
      return;
    }

    try {
      await teacherApi.updateAssignment(id, { isActive: false });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const activeAssignments = assignments.filter(a => a.is_active);
  const pastAssignments = assignments.filter(a => !a.is_active);

  return (
    <div>
      <div className="flex flex-between flex-center mb-3">
        <h1>Test Assignments</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
          disabled={classes.length === 0}
        >
          Assign Test
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {classes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>Add students first to assign tests</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Active Assignments</h2>
            </div>
            {activeAssignments.length === 0 ? (
              <p className="text-center" style={{ color: '#6b7280', padding: '24px' }}>
                No active test assignments
              </p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Test Form</th>
                      <th>Assigned</th>
                      <th>Due Date</th>
                      <th>Progress</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAssignments.map(a => (
                      <tr key={a.id}>
                        <td><strong>{a.class_name}</strong></td>
                        <td>Form {a.test_form_number}</td>
                        <td>{new Date(a.assigned_date).toLocaleDateString('en-GB')}</td>
                        <td>{a.due_date ? new Date(a.due_date).toLocaleDateString('en-GB') : '-'}</td>
                        <td>
                          <span className={a.completed_count === a.total_students ? 'badge badge-success' : 'badge badge-warning'}>
                            {a.completed_count}/{a.total_students} completed
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeactivate(a.id)}
                            className="btn btn-small btn-secondary"
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {pastAssignments.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Past Assignments</h2>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Test Form</th>
                      <th>Assigned</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastAssignments.map(a => (
                      <tr key={a.id}>
                        <td>{a.class_name}</td>
                        <td>Form {a.test_form_number}</td>
                        <td>{new Date(a.assigned_date).toLocaleDateString('en-GB')}</td>
                        <td>{a.completed_count}/{a.total_students}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Assign Test Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Assign Test to Class</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Select Class</label>
                <select
                  className="form-select"
                  value={formData.className}
                  onChange={(e) => handleClassChange(e.target.value)}
                  required
                >
                  <option value="">-- Select a class --</option>
                  {classes.map(cls => (
                    <option key={cls.class_name} value={cls.class_name}>
                      {cls.class_name} ({cls.student_count} students)
                    </option>
                  ))}
                </select>
              </div>

              {recommendation && (
                <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                  <strong>Recommended:</strong> Form {recommendation.recommendedForm}
                  {recommendation.usedForms.length > 0 && (
                    <span> (already used: Forms {recommendation.usedForms.join(', ')})</span>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Test Form</label>
                <select
                  className="form-select"
                  value={formData.testFormNumber}
                  onChange={(e) => setFormData({ ...formData, testFormNumber: e.target.value })}
                  required
                >
                  <option value="">-- Select a test form --</option>
                  {availableTests.map(test => (
                    <option
                      key={test.formNumber}
                      value={test.formNumber}
                      disabled={recommendation?.usedForms?.includes(test.formNumber)}
                    >
                      Form {test.formNumber} - {test.topics}
                      {recommendation?.usedForms?.includes(test.formNumber) ? ' (already used)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Due Date (optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Assign Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Assignments;
