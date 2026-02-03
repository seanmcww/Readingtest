import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { teacherApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    className: '',
    yearGroup: ''
  });
  const { isAdmin } = useAuth();

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const data = await teacherApi.getStudents();
      setStudents(data);
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
      if (editingStudent) {
        await teacherApi.updateStudent(editingStudent.id, formData);
      } else {
        await teacherApi.addStudent(formData);
      }
      setShowModal(false);
      setEditingStudent(null);
      setFormData({ firstName: '', lastName: '', dateOfBirth: '', className: '', yearGroup: '' });
      loadStudents();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      firstName: student.first_name,
      lastName: student.last_name,
      dateOfBirth: student.date_of_birth,
      className: student.class_name,
      yearGroup: student.year_group || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student? This will also delete all their test results.')) {
      return;
    }

    try {
      await teacherApi.deleteStudent(id);
      loadStudents();
    } catch (err) {
      setError(err.message);
    }
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setFormData({ firstName: '', lastName: '', dateOfBirth: '', className: '', yearGroup: '' });
    setShowModal(true);
  };

  // Group students by class
  const studentsByClass = students.reduce((acc, student) => {
    if (!acc[student.class_name]) {
      acc[student.class_name] = [];
    }
    acc[student.class_name].push(student);
    return acc;
  }, {});

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="flex flex-between flex-center mb-3">
        <h1>Students</h1>
        <button onClick={openAddModal} className="btn btn-primary">Add Student</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {students.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👨‍🎓</div>
            <p>No students yet</p>
            <button onClick={openAddModal} className="btn btn-primary mt-2">
              Add Your First Student
            </button>
          </div>
        </div>
      ) : (
        Object.entries(studentsByClass).sort().map(([className, classStudents]) => (
          <div key={className} className="card">
            <div className="card-header">
              <h2 className="card-title">Class {className}</h2>
              <span className="badge badge-info">{classStudents.length} students</span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Date of Birth</th>
                    {isAdmin && <th>Teacher</th>}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map(student => (
                    <tr key={student.id}>
                      <td>
                        <Link to={`/reports/student/${student.id}`}>
                          {student.first_name} {student.last_name}
                        </Link>
                      </td>
                      <td>{new Date(student.date_of_birth).toLocaleDateString('en-GB')}</td>
                      {isAdmin && <td>{student.teacher_name}</td>}
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleEdit(student)}
                            className="btn btn-small btn-secondary"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(student.id)}
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
          </div>
        ))
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingStudent ? 'Edit Student' : 'Add Student'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Class Name (e.g., 7A, 8B)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.className}
                  onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                  required
                  placeholder="e.g., 7A"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Year Group (optional)</label>
                <select
                  className="form-select"
                  value={formData.yearGroup}
                  onChange={(e) => setFormData({ ...formData, yearGroup: e.target.value })}
                >
                  <option value="">Select year group</option>
                  <option value="7">Year 7</option>
                  <option value="8">Year 8</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingStudent ? 'Update' : 'Add'} Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Students;
