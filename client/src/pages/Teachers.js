import React, { useState, useEffect } from 'react';
import { adminApi } from '../utils/api';

function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: ''
  });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      const data = await adminApi.getTeachers();
      setTeachers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingTeacher) {
        await adminApi.updateTeacher(editingTeacher.id, {
          fullName: formData.fullName,
          email: formData.email
        });
      } else {
        await adminApi.createTeacher(formData);
      }
      setShowModal(false);
      setEditingTeacher(null);
      setFormData({ username: '', password: '', fullName: '', email: '' });
      loadTeachers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      username: teacher.username,
      password: '',
      fullName: teacher.full_name,
      email: teacher.email || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this teacher? This will also delete all their students and test results.')) {
      return;
    }

    try {
      await adminApi.deleteTeacher(id);
      loadTeachers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await adminApi.resetPassword(editingTeacher.id, newPassword);
      setShowPasswordModal(false);
      setEditingTeacher(null);
      setNewPassword('');
      alert('Password reset successfully. The teacher will need to change it on next login.');
    } catch (err) {
      setError(err.message);
    }
  };

  const openPasswordModal = (teacher) => {
    setEditingTeacher(teacher);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const openAddModal = () => {
    setEditingTeacher(null);
    setFormData({ username: '', password: '', fullName: '', email: '' });
    setShowModal(true);
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="flex flex-between flex-center mb-3">
        <h1>Manage Teachers</h1>
        <button onClick={openAddModal} className="btn btn-primary">Add Teacher</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        {teachers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👨‍🏫</div>
            <p>No teachers yet</p>
            <button onClick={openAddModal} className="btn btn-primary mt-2">
              Add First Teacher
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Students</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(teacher => (
                  <tr key={teacher.id}>
                    <td><strong>{teacher.full_name}</strong></td>
                    <td>{teacher.username}</td>
                    <td>{teacher.email || '-'}</td>
                    <td>{teacher.student_count}</td>
                    <td>
                      {teacher.last_login
                        ? new Date(teacher.last_login).toLocaleDateString('en-GB')
                        : 'Never'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleEdit(teacher)}
                          className="btn btn-small btn-secondary"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openPasswordModal(teacher)}
                          className="btn btn-small btn-secondary"
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() => handleDelete(teacher.id)}
                          className="btn btn-small btn-danger"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingTeacher ? 'Edit Teacher' : 'Add Teacher'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmit}>
              {!editingTeacher && (
                <>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email (optional)</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTeacher ? 'Update' : 'Add'} Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Reset Password for {editingTeacher?.full_name}</h2>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                The teacher will be required to change this password on their next login.
              </p>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Teachers;
