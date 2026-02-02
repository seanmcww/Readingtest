# Reading Assessment System - Detailed Requirements Document

## Project Overview

A web-based reading assessment platform for UK secondary schools (Year 7-8) that delivers standardized reading tests, automatically scores them, calculates reading ages, and provides detailed diagnostic reports at individual, class, and year group levels.

---

## 1. SYSTEM ARCHITECTURE

### 1.1 Technology Stack
- **Frontend:** React.js (single-page application)
- **Backend:** Node.js with Express.js
- **Database:** SQLite (local, no external network connection)
- **Authentication:** JWT (JSON Web Tokens)
- **Styling:** CSS/Tailwind CSS (or similar)
- **Charts/Visualization:** Chart.js or Recharts for data visualization

### 1.2 Deployment Requirements
- Must run entirely on local network
- No external API calls or cloud dependencies
- Self-contained system that can be deployed on a single server
- All data stored locally in SQLite database

### 1.3 Browser Compatibility
- Chrome (primary)
- Firefox
- Edge
- Safari

---

## 2. USER ROLES & AUTHENTICATION

### 2.1 Admin Role
**Login:**
- Username: `admin`
- Password: Set during initial system setup (default: `admin123` - must be changed on first login)

**Permissions:**
- Create, edit, and delete teacher accounts
- View all system data (all schools, teachers, students, results)
- Reset passwords for teacher accounts
- Access all reports
- Export all data
- Manage system settings

**Cannot:**
- Take tests
- Be assigned to specific classes

### 2.2 Teacher Role
**Creation:**
- Created by Admin only
- Requires: username, password, email (optional), full name

**Login:**
- Username and password

**Permissions:**
- Create student accounts within their assigned classes
- Add students (name, date of birth, class/form group)
- Assign specific tests to entire classes
- View results for their own students only
- Generate reports for their classes
- Export their class data to CSV
- Edit student information (name, DOB, class)
- Delete student accounts

**Cannot:**
- View other teachers' students or results
- Create other teacher accounts
- Access admin functions
- Delete their own account

### 2.3 Student Role
**Creation:**
- Created by teachers
- Requires: First name, Last name, Date of birth, Class/form group

**Login:**
- Select name from dropdown (shows only students in classes with assigned tests)
- Enter date of birth (DD/MM/YYYY format)
- No traditional username/password

**Permissions:**
- Take assigned test (one time only per test assignment)
- View own results after completion (optional feature)

**Cannot:**
- Access any administrative functions
- View other students' results
- Retake same test once completed

---

## 3. DATABASE SCHEMA

### 3.1 Tables Required

#### users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'teacher')),
  full_name TEXT NOT NULL,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);
```

#### students
```sql
CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  class_name TEXT NOT NULL,
  teacher_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### test_assignments
```sql
CREATE TABLE test_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_name TEXT NOT NULL,
  test_form_number INTEGER NOT NULL CHECK(test_form_number BETWEEN 1 AND 8),
  teacher_id INTEGER NOT NULL,
  assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  due_date DATETIME,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### test_results
```sql
CREATE TABLE test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  test_form_number INTEGER NOT NULL,
  test_assignment_id INTEGER NOT NULL,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  time_taken_seconds INTEGER,
  total_score INTEGER NOT NULL,
  total_possible INTEGER NOT NULL DEFAULT 26,
  percentage_score REAL NOT NULL,
  estimated_reading_age REAL NOT NULL,
  
  -- Skill area scores
  literal_comprehension_score INTEGER,
  literal_comprehension_possible INTEGER DEFAULT 5,
  inference_score INTEGER,
  inference_possible INTEGER DEFAULT 10,
  vocabulary_score INTEGER,
  vocabulary_possible INTEGER DEFAULT 8,
  synthesis_score INTEGER,
  synthesis_possible INTEGER DEFAULT 3,
  
  -- Difficulty level performance
  difficulty_1_score INTEGER,
  difficulty_1_possible INTEGER DEFAULT 3,
  difficulty_2_score INTEGER,
  difficulty_2_possible INTEGER DEFAULT 6,
  difficulty_3_score INTEGER,
  difficulty_3_possible INTEGER DEFAULT 8,
  difficulty_4_score INTEGER,
  difficulty_4_possible INTEGER DEFAULT 5,
  difficulty_5_score INTEGER,
  difficulty_5_possible INTEGER DEFAULT 4,
  
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (test_assignment_id) REFERENCES test_assignments(id) ON DELETE CASCADE
);
```

#### student_answers
```sql
CREATE TABLE student_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_result_id INTEGER NOT NULL,
  question_number INTEGER NOT NULL,
  selected_answer TEXT NOT NULL, -- 'A', 'B', 'C', or 'D'
  is_correct BOOLEAN NOT NULL,
  skill_type TEXT NOT NULL,
  difficulty_level INTEGER NOT NULL,
  FOREIGN KEY (test_result_id) REFERENCES test_results(id) ON DELETE CASCADE
);
```

---

## 4. TEST CONTENT & STRUCTURE

### 4.1 Test Forms
- **Total Forms:** 8 parallel forms (Forms 1-8)
- **Structure per form:**
  - Part 1: Narrative Fiction (10 questions)
  - Part 2: Non-Fiction (8 questions)
  - Part 3: Literary Non-Fiction (8 questions)
  - **Total:** 26 multiple choice questions
- **Time:** 25 minutes recommended (not enforced by system, but track actual time taken)

### 4.2 Question Tagging System
Each question has:
- **Question Number:** 1-26
- **Skill Type:** 
  - Literal Comprehension
  - Inference-Basic
  - Inference-Intermediate
  - Inference-Advanced
  - Vocabulary-Context
  - Vocabulary-Analysis
  - Vocabulary-Figurative
  - Vocabulary-Sophisticated
  - Comprehension-Synthesis
  - Comprehension-Analytical
- **Difficulty Level:** 1-5 (maps to reading ages 7-16)
- **Correct Answer:** A, B, C, or D

### 4.3 Test Content Storage
Store test content in structured JSON format:

```json
{
  "formNumber": 1,
  "parts": [
    {
      "partNumber": 1,
      "title": "Narrative Fiction",
      "readingAge": "8-10",
      "passage": "Full text of passage...",
      "questions": [
        {
          "questionNumber": 1,
          "questionText": "What was Maya looking for?",
          "options": {
            "A": "Her grandmother's letter",
            "B": "A small silver key",
            "C": "Her little brother",
            "D": "A wooden box"
          },
          "correctAnswer": "B",
          "skillType": "Literal Comprehension",
          "difficultyLevel": 1,
          "targetPValue": 0.90
        }
      ]
    }
  ]
}
```

---

## 5. READING AGE CALCULATION ALGORITHM

### 5.1 Reading Age Estimation Formula

Based on performance across difficulty levels:

```
If score on Level 1-2 questions >= 60%:
  Reading Age = 7-8

If score on Level 1-3 questions >= 60%:
  Reading Age = 9-10

If score on Level 1-4 questions >= 60%:
  Reading Age = 11-12

If score on Level 1-4 questions >= 70%:
  Reading Age = 13-14

If score on all questions >= 80%:
  Reading Age = 15-16
```

**More precise calculation:**
```javascript
function calculateReadingAge(answers) {
  // Group answers by difficulty level
  const byDifficulty = groupByDifficulty(answers);
  
  // Calculate percentage correct for each cumulative level
  const level1_2 = percentCorrect(byDifficulty[1], byDifficulty[2]);
  const level1_3 = percentCorrect(byDifficulty[1], byDifficulty[2], byDifficulty[3]);
  const level1_4 = percentCorrect(byDifficulty[1], byDifficulty[2], byDifficulty[3], byDifficulty[4]);
  const allLevels = percentCorrect(byDifficulty[1], byDifficulty[2], byDifficulty[3], byDifficulty[4], byDifficulty[5]);
  
  // Determine reading age band
  if (allLevels >= 80) return 15.5; // 15-16
  if (level1_4 >= 70) return 13.5; // 13-14
  if (level1_4 >= 60) return 11.5; // 11-12
  if (level1_3 >= 60) return 9.5; // 9-10
  if (level1_2 >= 60) return 7.5; // 7-8
  
  // Below expected level
  return 7.0; // Below 7
}
```

### 5.2 Skill Area Analysis

Calculate percentage scores for each skill area:

```javascript
{
  "literalComprehension": {
    "score": 4,
    "possible": 5,
    "percentage": 80
  },
  "inference": {
    "score": 7,
    "possible": 10,
    "percentage": 70
  },
  "vocabulary": {
    "score": 5,
    "possible": 8,
    "percentage": 62.5
  },
  "synthesis": {
    "score": 2,
    "possible": 3,
    "percentage": 66.7
  }
}
```

**Weakness Threshold:** Any skill area with < 60% is flagged as a weakness.

---

## 6. USER WORKFLOWS

### 6.1 Admin Workflow

**Initial Setup:**
1. Login with default admin credentials
2. Force password change on first login
3. Create teacher accounts

**Creating Teacher Account:**
1. Navigate to "Manage Teachers"
2. Click "Add New Teacher"
3. Enter: username, password, full name, email (optional)
4. Click "Create Teacher"
5. System generates account and displays confirmation

**Managing System:**
1. View dashboard with overall statistics
2. Access all reports (year group level)
3. Reset teacher passwords if needed
4. View audit logs (optional feature)

### 6.2 Teacher Workflow

**Initial Login:**
1. Login with provided username/password
2. View dashboard showing their classes and students

**Adding Students:**
1. Navigate to "My Students"
2. Click "Add New Student"
3. Enter: First name, Last name, Date of birth (DD/MM/YYYY), Class/form group
4. Click "Add Student"
5. Student appears in class list

**Bulk Import Students (Optional Enhancement):**
1. Upload CSV file with columns: first_name, last_name, date_of_birth, class_name
2. System validates and imports students
3. Shows confirmation of successful imports and any errors

**Assigning Tests:**
1. Navigate to "Assign Tests"
2. Select class/form group from dropdown
3. Select test form number (1-8) - system recommends next sequential test
4. Set optional due date
5. Click "Assign Test"
6. All students in that class now see the test available when they login

**Viewing Results:**
1. Navigate to "Results"
2. Select class or individual student
3. View summary statistics
4. Generate detailed reports
5. Export to CSV

### 6.3 Student Workflow

**Login Process:**
1. Navigate to student login page
2. Select their name from dropdown (shows only students with assigned tests)
3. Enter date of birth (DD/MM/YYYY)
4. System validates and logs them in

**Taking Test:**
1. See welcome screen with instructions
2. Click "Start Test"
3. Timer starts (optional - tracks time but doesn't enforce limit)
4. Read passage and answer questions
5. Questions presented one at a time or all visible (design choice)
6. Can navigate back/forward between questions
7. Click "Submit Test" when complete
8. Confirmation dialog: "Are you sure you want to submit?"
9. Test submitted and marked automatically
10. See confirmation message (optional: show score immediately or only to teacher)

**Test Interface Requirements:**
- Clear, readable font (minimum 16px)
- Passage visible while answering questions (split screen or scrollable)
- Progress indicator (Question X of 26)
- Clear answer selection (radio buttons)
- "Previous" and "Next" navigation
- "Submit Test" button only on final question
- Timer display showing elapsed time (optional)

---

## 7. REPORTING SYSTEM

### 7.1 Individual Student Report

**Components:**
- Student name, DOB, chronological age
- Test form taken, completion date, time taken
- Overall score (X/26, percentage)
- Estimated reading age
- **Gap Analysis:** Chronological age vs. reading age (e.g., "2 years below expected")
- Skill area breakdown (table with scores and percentages):
  - Literal Comprehension: 4/5 (80%)
  - Inference: 7/10 (70%)
  - Vocabulary: 5/8 (62.5%)
  - Synthesis: 2/3 (66.7%)
- **Identified Weaknesses:** Areas scoring < 60%
- **Recommended Interventions:** Text-based suggestions for weak areas
- Performance by difficulty level (chart showing % correct for each level 1-5)
- Question-by-question breakdown (optional, detailed view)

**Format:** 
- View on screen
- Download as PDF (optional enhancement)
- Print-friendly CSS

### 7.2 Class Report

**Components:**
- Class name, teacher name, test form number
- Number of students completed vs. assigned
- Class statistics:
  - Mean reading age
  - Median reading age
  - Range (lowest to highest reading age)
  - Standard deviation
- Distribution chart (histogram of reading ages)
- Student list table with columns:
  - Name
  - DOB
  - Chronological Age
  - Reading Age
  - Gap (years ahead/behind)
  - Overall Score (%)
  - Weakest Skill Area
- **Students of Concern:** Automatically flagged students with:
  - Reading age 2+ years below chronological age
  - Overall score < 50%
- Skill area analysis (class averages):
  - Literal Comprehension: 78%
  - Inference: 65%
  - Vocabulary: 71%
  - Synthesis: 69%
- **Common Weaknesses:** Skills where >50% of class scores < 60%

**Export:** 
- CSV download with all student data
- Formatted for Excel

### 7.3 Year Group Report

**Components:**
- Year group (e.g., Year 7 or Year 8)
- Number of students total
- Number of students tested
- Overall statistics:
  - Mean reading age by year group
  - Percentage at/above expected level
  - Percentage 1 year below expected
  - Percentage 2+ years below expected
- Distribution visualization (box plot or histogram)
- **Key Readers of Concern:** 
  - Top 10-20 students most below expected level
  - Sorted by gap size
- Class-by-class comparison table:
  - Class name
  - Teacher name
  - Mean reading age
  - % at expected level
  - Identified concerns
- **Year Group Skill Analysis:**
  - Average performance in each skill area
  - Weakest skills across year group
  - Trends analysis (if multiple tests taken over time)

**API (Automated Performance Indicator) Analysis:**
Calculate and display:
- **At-risk students:** Reading age 2+ years below chronological age
- **Priority intervention list:** Students with multiple skill weaknesses
- **Whole-cohort weaknesses:** Skills where >40% of year group struggles
- **Progress tracking:** If students have taken multiple tests, show growth rates

**Export:**
- Comprehensive CSV with all year group data
- Summary report (PDF optional)

---

## 8. SPECIFIC FEATURES & FUNCTIONALITY

### 8.1 Test Assignment Logic

**Sequential Assignment:**
- System tracks which test forms each class has completed
- When teacher assigns next test, system suggests next sequential number
- Example: Class 7A completed Form 1 → System recommends Form 2
- Teacher can override and select any form 1-8
- Prevents assigning same form twice to same class

**Assignment Rules:**
- One test assignment active per class at a time
- Students can only take assigned test once
- Once completed, result is locked (no retakes)

### 8.2 Automatic Scoring

**Process:**
1. Student submits test
2. System retrieves correct answer key for that test form
3. Compares student answers to correct answers
4. Calculates:
   - Total score
   - Scores by skill area
   - Scores by difficulty level
5. Runs reading age calculation algorithm
6. Stores all results in database
7. Updates student record as "completed"

**Validation:**
- All 26 questions must be answered to submit
- Warning if any questions unanswered
- No partial test submissions

### 8.3 Data Export (CSV Format)

**Individual Student Export:**
```csv
Student Name,Date of Birth,Chronological Age,Test Form,Date Taken,Time Taken (mins),Overall Score,Percentage,Reading Age,Age Gap,Literal Comp %,Inference %,Vocabulary %,Synthesis %,Weaknesses
John Smith,15/09/2012,12.4,1,2025-01-15,23,22,84.6,13.5,+1.1,100,80,75,66.7,Vocabulary
```

**Class Export:**
```csv
Class,Student Name,DOB,Chron Age,Test Form,Date Taken,Score,Percentage,Reading Age,Gap,Literal %,Inference %,Vocab %,Synthesis %,Concerns
7A,John Smith,15/09/2012,12.4,1,2025-01-15,22,84.6,13.5,+1.1,100,80,75,66.7,None
7A,Sarah Jones,03/11/2012,12.2,1,2025-01-15,16,61.5,9.5,-2.7,80,50,62.5,66.7,At Risk - Inference
```

**Year Group Export:**
```csv
Year,Class,Student Name,DOB,Chron Age,Test Form,Date Taken,Score,%,Reading Age,Gap,At Risk,Priority,Literal %,Inference %,Vocab %,Synthesis %
7,7A,John Smith,15/09/2012,12.4,1,2025-01-15,22,84.6,13.5,+1.1,No,No,100,80,75,66.7
7,7A,Sarah Jones,03/11/2012,12.2,1,2025-01-15,16,61.5,9.5,-2.7,Yes,Yes,80,50,62.5,66.7
```

### 8.4 Student Login Security

**Name Selection:**
- Dropdown only shows students who:
  - Have been assigned a test
  - Haven't completed that test yet
- Grouped by class for easier selection

**Date of Birth Validation:**
- Must match exactly (DD/MM/YYYY format)
- 3 failed attempts = account locked for 5 minutes
- Error message: "Incorrect date of birth. Please try again."

**Session Management:**
- Student sessions expire after 60 minutes of inactivity
- Warning at 55 minutes: "Your session will expire soon"
- Auto-save draft answers (if implementing pause feature)

### 8.5 Progress Tracking Over Time

**Multiple Test Results:**
- Students can take multiple tests over academic year (Forms 1-8)
- System tracks progression:
  - Test 1 (September): Reading age 9.5
  - Test 2 (November): Reading age 10.2
  - Test 3 (January): Reading age 10.8
- Calculate growth rate (months per month)
- Display growth chart on individual reports
- Flag students not making expected progress (< 1 month growth per month)

---

## 9. USER INTERFACE REQUIREMENTS

### 9.1 General Design Principles
- Clean, professional interface suitable for school environment
- High contrast for readability
- Responsive design (works on tablets and desktops)
- Accessibility considerations (WCAG 2.1 AA compliance)
- Consistent navigation across all sections

### 9.2 Color Scheme Suggestions
- Primary: Professional blue (#2563eb)
- Success: Green (#16a34a)
- Warning: Amber (#f59e0b)
- Danger: Red (#dc2626)
- Background: Light grey (#f3f4f6)
- Text: Dark grey (#1f2937)

### 9.3 Key Pages

**Admin Dashboard:**
- Summary cards: Total teachers, Total students, Total tests completed
- Recent activity log
- Quick actions: Add teacher, View reports
- System health status

**Teacher Dashboard:**
- Summary cards: My students, Active assignments, Completed tests
- Recent test results (last 5)
- Quick actions: Add student, Assign test, View results
- Class performance overview charts

**Student Test Interface:**
- Clean, minimal design
- Left panel: Passage text (scrollable)
- Right panel: Questions and answer options
- Top bar: Progress, timer, student name
- Bottom: Previous/Next/Submit buttons

**Reports Interface:**
- Filters: Class, date range, test form
- Summary statistics at top
- Detailed data tables below
- Export button prominent
- Charts and visualizations for key metrics

### 9.4 Mobile Responsiveness
- Admin and Teacher interfaces: Desktop-optimized, tablet-friendly
- Student test interface: Should work on tablets (minimum 10" screen)
- Reports: Best viewed on desktop, exportable for printing

---

## 10. TECHNICAL IMPLEMENTATION DETAILS

### 10.1 API Endpoints Required

**Authentication:**
- POST `/api/auth/login` - Login (all user types)
- POST `/api/auth/logout` - Logout
- GET `/api/auth/verify` - Verify JWT token
- POST `/api/auth/change-password` - Change password

**Admin:**
- GET `/api/admin/teachers` - List all teachers
- POST `/api/admin/teachers` - Create teacher
- PUT `/api/admin/teachers/:id` - Update teacher
- DELETE `/api/admin/teachers/:id` - Delete teacher
- POST `/api/admin/teachers/:id/reset-password` - Reset teacher password

**Teachers:**
- GET `/api/teacher/students` - Get teacher's students
- POST `/api/teacher/students` - Add student
- PUT `/api/teacher/students/:id` - Update student
- DELETE `/api/teacher/students/:id` - Delete student
- POST `/api/teacher/students/bulk` - Bulk import students
- GET `/api/teacher/classes` - Get teacher's classes
- POST `/api/teacher/assignments` - Assign test to class
- GET `/api/teacher/assignments` - Get teacher's test assignments
- GET `/api/teacher/results` - Get results for teacher's students
- GET `/api/teacher/results/:studentId` - Get specific student results
- GET `/api/teacher/reports/class/:className` - Generate class report
- GET `/api/teacher/reports/student/:studentId` - Generate student report
- GET `/api/teacher/export/class/:className` - Export class data to CSV

**Students:**
- POST `/api/student/login` - Student login (name + DOB)
- GET `/api/student/test` - Get assigned test
- POST `/api/student/test/submit` - Submit completed test
- GET `/api/student/results` - Get own results (optional)

**Tests:**
- GET `/api/tests/:formNumber` - Get test content
- GET `/api/tests/:formNumber/answers` - Get answer key (admin/teacher only)

**Reports:**
- GET `/api/reports/year-group/:year` - Year group report (admin/teacher)
- GET `/api/reports/api-analysis/:year` - Automated analysis (admin/teacher)
- GET `/api/reports/export/year/:year` - Export year data to CSV

### 10.2 Security Considerations

**Password Storage:**
- Use bcryptjs with salt rounds = 10
- Never store plain text passwords

**JWT Tokens:**
- Expiry: 8 hours for teachers/admin, 2 hours for students
- Include user ID and role in payload
- Sign with strong secret key (stored in .env)

**Student Authentication:**
- DOB validation without exposing other student data
- Rate limiting on failed attempts

**Data Protection:**
- Prepared statements to prevent SQL injection
- Input validation and sanitization
- CORS configured for local network only

**File Upload Security (if implementing CSV import):**
- Validate file type and size
- Parse safely to prevent code injection
- Limit to CSV files only

### 10.3 Performance Considerations

**Database Optimization:**
- Indexes on frequently queried fields:
  - students.teacher_id
  - students.class_name
  - test_results.student_id
  - test_results.test_assignment_id
- Compound indexes for common queries

**Caching:**
- Cache test content in memory (doesn't change)
- Cache frequently accessed reports (optional)

**Query Optimization:**
- Use JOIN statements efficiently
- Limit result sets appropriately
- Pagination for large data sets (>100 records)

### 10.4 Error Handling

**User-Facing Errors:**
- Clear, actionable error messages
- No technical jargon
- Examples:
  - "Unable to add student. A student with this name and date of birth already exists in your class."
  - "Test submission failed. Please check your internet connection and try again."
  - "Your session has expired. Please log in again."

**Server Errors:**
- Log detailed errors to console/file
- Return generic message to user
- Include error codes for debugging

### 10.5 Data Backup & Recovery

**Backup Strategy:**
- SQLite database file location: `/data/reading_assessment.db`
- Recommend daily backups by school IT
- Export functionality provides additional backup

**Database Initialization:**
- Include setup script to create all tables
- Seed with default admin account
- Include sample data for testing (optional)

---

## 11. DEVELOPMENT PHASES

### Phase 1: Core Infrastructure (Priority 1)
- [ ] Set up project structure
- [ ] Configure Express server
- [ ] Create SQLite database and schema
- [ ] Implement authentication system (JWT)
- [ ] Create login pages for all user types
- [ ] Build basic React frontend structure

### Phase 2: User Management (Priority 1)
- [ ] Admin can create teacher accounts
- [ ] Teachers can add students
- [ ] Student login with name + DOB
- [ ] Password change functionality
- [ ] User session management

### Phase 3: Test Content & Delivery (Priority 1)
- [ ] Import test content (Forms 1-3) into database/JSON
- [ ] Build test interface for students
- [ ] Implement test submission and auto-scoring
- [ ] Calculate reading age
- [ ] Store results in database

### Phase 4: Test Assignment (Priority 2)
- [ ] Teacher can assign tests to classes
- [ ] Sequential test recommendation
- [ ] Students see assigned tests
- [ ] Prevent duplicate test attempts
- [ ] Track completion status

### Phase 5: Reporting (Priority 2)
- [ ] Individual student report
- [ ] Class report with statistics
- [ ] Year group report
- [ ] API analysis (at-risk students, weak skills)
- [ ] Data visualization (charts)

### Phase 6: Data Export (Priority 2)
- [ ] CSV export for individual students
- [ ] CSV export for classes
- [ ] CSV export for year groups
- [ ] Formatted exports for Excel compatibility

### Phase 7: Enhancement & Polish (Priority 3)
- [ ] Teacher dashboard with summary stats
- [ ] Student progress tracking over time
- [ ] Bulk student import via CSV
- [ ] Improved UI/UX polish
- [ ] Print-friendly report layouts
- [ ] Help documentation

### Phase 8: Testing & Deployment (Priority 1)
- [ ] Unit tests for core functions
- [ ] Integration tests for APIs
- [ ] User acceptance testing
- [ ] Deployment documentation
- [ ] Admin guide
- [ ] Teacher guide

---

## 12. TESTING REQUIREMENTS

### 12.1 Unit Tests
- Authentication functions
- Reading age calculation algorithm
- Skill area analysis
- CSV export formatting
- Student answer validation

### 12.2 Integration Tests
- Login flows for all user types
- Test assignment and completion workflow
- Report generation
- Data export

### 12.3 User Acceptance Testing
- Admin creates teacher → successful
- Teacher adds students → appear in system
- Teacher assigns test → students see it
- Student takes test → results calculated correctly
- Reports generate accurately
- CSV exports contain correct data

---

## 13. DEPLOYMENT & SETUP

### 13.1 Installation Steps
1. Clone repository
2. Run `npm install` to install dependencies
3. Create `.env` file with configuration:
   ```
   JWT_SECRET=your-secret-key-here
   PORT=3000
   DB_PATH=./data/reading_assessment.db
   ```
4. Run database initialization script: `npm run init-db`
5. Start server: `npm start`
6. Access at `http://localhost:3000`

### 13.2 Initial Configuration
1. Login with default admin credentials
2. Change admin password immediately
3. Create teacher accounts
4. Import test content (if not included)
5. Create backup schedule

### 13.3 System Requirements
- Node.js version 18+ 
- 2GB RAM minimum
- 10GB storage for database
- Modern web browser (Chrome, Firefox, Edge, Safari)

---

## 14. MAINTENANCE & SUPPORT

### 14.1 Regular Maintenance
- Weekly database backup
- Monthly review of error logs
- Quarterly security updates
- Annual review of test content

### 14.2 Support Documentation
- Admin user guide
- Teacher user guide
- Student quick start guide
- Troubleshooting guide
- API documentation (for developers)

---

## 15. FUTURE ENHANCEMENTS (Optional)

### 15.1 Additional Features
- PDF export for reports
- Email notifications for test completion
- Parent portal to view student results
- Mobile app for test delivery
- Integration with school MIS systems
- Reading age growth projections
- Comparison with national norms
- Text-to-speech for accessibility
- Dark mode toggle

### 15.2 Analytics Enhancements
- Machine learning to predict at-risk students
- Intervention effectiveness tracking
- Longitudinal studies across cohorts
- Question-level analysis (which questions are too hard/easy)

---

## 16. SUCCESS CRITERIA

The system will be considered successful when:

1. ✅ Admin can create and manage teacher accounts
2. ✅ Teachers can add students and assign tests
3. ✅ Students can log in with name + DOB and complete tests
4. ✅ Tests are automatically scored with accurate reading age calculation
5. ✅ Individual student reports show reading age and skill breakdown
6. ✅ Class reports identify students of concern and common weaknesses
7. ✅ Year group reports provide API analysis and priority lists
8. ✅ All reports can be exported to CSV format
9. ✅ System runs entirely on local network without external dependencies
10. ✅ Interface is intuitive and requires minimal training

---

## 17. CONTACTS & STAKEHOLDERS

**Project Owner:** [Your Name]
**Role:** Head of English Department
**School:** [School Name]

**Technical Requirements:**
- Must comply with UK school data protection regulations
- GDPR compliant data handling
- No personally identifiable information leaves local network

---

## APPENDIX A: Sample Data Structures

### Sample Teacher Account
```json
{
  "username": "j.smith",
  "full_name": "Jane Smith",
  "email": "j.smith@school.ac.uk",
  "role": "teacher",
  "created_at": "2025-01-10T09:00:00Z"
}
```

### Sample Student Record
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "2012-09-15",
  "class_name": "7A",
  "teacher_id": 2,
  "created_at": "2025-01-15T10:30:00Z"
}
```

### Sample Test Result
```json
{
  "student_id": 45,
  "test_form_number": 1,
  "completed_at": "2025-01-20T14:25:00Z",
  "time_taken_seconds": 1380,
  "total_score": 22,
  "percentage_score": 84.6,
  "estimated_reading_age": 13.5,
  "skill_scores": {
    "literal_comprehension": {
      "score": 5,
      "possible": 5,
      "percentage": 100
    },
    "inference": {
      "score": 8,
      "possible": 10,
      "percentage": 80
    },
    "vocabulary": {
      "score": 6,
      "possible": 8,
      "percentage": 75
    },
    "synthesis": {
      "score": 3,
      "possible": 3,
      "percentage": 100
    }
  }
}
```

---

## APPENDIX B: Intervention Recommendations by Skill Area

### Literal Comprehension (< 60%)
**Interventions:**
- Reciprocal reading activities
- Explicit instruction in skimming and scanning
- Question-answer relationship (QAR) strategy
- Close reading practice with highlighting key information

### Inference (< 60%)
**Interventions:**
- Think-aloud modeling of inference-making
- "Reading between the lines" explicit instruction
- Inference question stems practice
- Evidence-based reasoning activities
- Making predictions and checking them

### Vocabulary (< 60%)
**Interventions:**
- Context clue strategy instruction (definition, synonym, antonym, example, general sense)
- Word morphology study (roots, prefixes, suffixes)
- Academic vocabulary building (Tier 2 words)
- Word mapping and semantic feature analysis
- Wide reading to build vocabulary naturally

### Synthesis/Analysis (< 60%)
**Interventions:**
- Summarizing practice (main idea identification)
- Graphic organizers for text structure
- Compare and contrast activities
- Author's purpose and craft analysis
- Critical thinking question practice

---

**END OF REQUIREMENTS DOCUMENT**

**Version:** 1.0  
**Date:** February 2, 2025  
**Status:** Ready for Development in Claude Code
