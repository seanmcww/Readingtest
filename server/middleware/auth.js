const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'reading-assessment-secret';

// Verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};

// Check if user is teacher or admin
const isTeacherOrAdmin = (req, res, next) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Teacher privileges required.' });
  }
  next();
};

// Check if user is student
const isStudent = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Access denied. Student access only.' });
  }
  next();
};

// Generate token for staff (8 hours)
const generateStaffToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
};

// Generate token for students (2 hours)
const generateStudentToken = (student, assignmentId) => {
  return jwt.sign(
    {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
      className: student.class_name,
      role: 'student',
      assignmentId: assignmentId
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
};

module.exports = {
  verifyToken,
  isAdmin,
  isTeacherOrAdmin,
  isStudent,
  generateStaffToken,
  generateStudentToken,
  JWT_SECRET
};
