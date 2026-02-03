// API utility functions

const getToken = () => localStorage.getItem('token');

const apiRequest = async (url, options = {}) => {
  const token = getToken();

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    }
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};

export const api = {
  get: (url) => apiRequest(url),
  post: (url, body) => apiRequest(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiRequest(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url) => apiRequest(url, { method: 'DELETE' })
};

// Admin API
export const adminApi = {
  getTeachers: () => api.get('/api/admin/teachers'),
  createTeacher: (data) => api.post('/api/admin/teachers', data),
  updateTeacher: (id, data) => api.put(`/api/admin/teachers/${id}`, data),
  deleteTeacher: (id) => api.delete(`/api/admin/teachers/${id}`),
  resetPassword: (id, newPassword) => api.post(`/api/admin/teachers/${id}/reset-password`, { newPassword }),
  getDashboard: () => api.get('/api/admin/dashboard'),
  getAllStudents: () => api.get('/api/admin/all-students')
};

// Teacher API
export const teacherApi = {
  getStudents: () => api.get('/api/teacher/students'),
  addStudent: (data) => api.post('/api/teacher/students', data),
  updateStudent: (id, data) => api.put(`/api/teacher/students/${id}`, data),
  deleteStudent: (id) => api.delete(`/api/teacher/students/${id}`),
  bulkImport: (students) => api.post('/api/teacher/students/bulk', { students }),
  getClasses: () => api.get('/api/teacher/classes'),
  getAssignments: () => api.get('/api/teacher/assignments'),
  createAssignment: (data) => api.post('/api/teacher/assignments', data),
  updateAssignment: (id, data) => api.put(`/api/teacher/assignments/${id}`, data),
  getResults: () => api.get('/api/teacher/results'),
  getStudentResults: (id) => api.get(`/api/teacher/results/${id}`),
  getDashboard: () => api.get('/api/teacher/dashboard'),
  getNextTest: (className) => api.get(`/api/teacher/next-test/${encodeURIComponent(className)}`)
};

// Student API
export const studentApi = {
  getAvailable: () => fetch('/api/student/available').then(r => r.json()),
  getTest: () => api.get('/api/student/test'),
  submitTest: (answers, timeTakenSeconds) => api.post('/api/student/test/submit', { answers, timeTakenSeconds }),
  getResults: () => api.get('/api/student/results')
};

// Reports API
export const reportsApi = {
  getStudentReport: (id) => api.get(`/api/reports/student/${id}`),
  getClassReport: (className) => api.get(`/api/reports/class/${encodeURIComponent(className)}`),
  getYearReport: (year) => api.get(`/api/reports/year-group/${year}`),
  exportStudent: (id) => `/api/reports/export/student/${id}`,
  exportClass: (className) => `/api/reports/export/class/${encodeURIComponent(className)}`,
  exportYear: (year) => `/api/reports/export/year/${year}`
};

// Tests API
export const testsApi = {
  getAvailable: () => api.get('/api/tests/available'),
  getTest: (formNumber) => api.get(`/api/tests/${formNumber}`),
  getAnswerKey: (formNumber) => api.get(`/api/tests/${formNumber}/answers`)
};
