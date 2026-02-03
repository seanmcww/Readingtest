import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Layout({ children }) {
  const { user, logout, isAdmin, isTeacher } = useAuth();
  const location = useLocation();

  const navLinks = isAdmin
    ? [
        { to: '/admin', label: 'Dashboard' },
        { to: '/admin/teachers', label: 'Teachers' },
        { to: '/students', label: 'Students' },
        { to: '/assignments', label: 'Assignments' },
        { to: '/results', label: 'Results' }
      ]
    : [
        { to: '/teacher', label: 'Dashboard' },
        { to: '/students', label: 'Students' },
        { to: '/assignments', label: 'Assignments' },
        { to: '/results', label: 'Results' }
      ];

  return (
    <div className="app-container">
      <nav className="navbar">
        <h1>Reading Assessment System</h1>
        <div className="navbar-links">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                fontWeight: location.pathname === link.to ? '600' : '400',
                background: location.pathname === link.to ? 'rgba(255,255,255,0.15)' : 'transparent'
              }}
            >
              {link.label}
            </Link>
          ))}
          <span className="user-info">
            {user?.fullName || user?.username} ({user?.role})
          </span>
          <button onClick={logout}>Logout</button>
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;
