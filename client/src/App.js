import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import StudentLogin from './pages/StudentLogin';
import ChangePassword from './pages/ChangePassword';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import Students from './pages/Students';
import Assignments from './pages/Assignments';
import Results from './pages/Results';
import StudentReport from './pages/StudentReport';
import ClassReport from './pages/ClassReport';
import YearReport from './pages/YearReport';
import Teachers from './pages/Teachers';
import TestInterface from './pages/TestInterface';
import TestComplete from './pages/TestComplete';

// Layout Component
import Layout from './components/Layout';

// Protected Route Component
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Home redirect based on role
function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'teacher':
      return <Navigate to="/teacher" replace />;
    case 'student':
      return <Navigate to="/test" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/student-login" element={<StudentLogin />} />

      {/* Home Redirect */}
      <Route path="/" element={<HomeRedirect />} />

      {/* Change Password */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin']}>
            <Layout>
              <AdminDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/teachers"
        element={
          <ProtectedRoute roles={['admin']}>
            <Layout>
              <Teachers />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports/year/:year"
        element={
          <ProtectedRoute roles={['admin']}>
            <Layout>
              <YearReport />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Teacher Routes */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <Layout>
              <TeacherDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <Layout>
              <Students />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/assignments"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <Layout>
              <Assignments />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/results"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <Layout>
              <Results />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/student/:id"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <Layout>
              <StudentReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/class/:className"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <Layout>
              <ClassReport />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/year/:year"
        element={
          <ProtectedRoute roles={['admin', 'teacher']}>
            <Layout>
              <YearReport />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Student Routes */}
      <Route
        path="/test"
        element={
          <ProtectedRoute roles={['student']}>
            <TestInterface />
          </ProtectedRoute>
        }
      />
      <Route
        path="/test-complete"
        element={
          <ProtectedRoute roles={['student']}>
            <TestComplete />
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
