/**
 * =============================================================
 * EduCore School Management Portal — script.js
 * Author  : Japhet Sunday
 * Stack   : Vanilla JavaScript (ES6+)
 *
 * STRUCTURE:
 *   1.  State & Constants
 *   2.  localStorage Helpers
 *   3.  Navigation & Section Routing
 *   4.  Dashboard Rendering
 *   5.  Student Management (CRUD)
 *   6.  Teacher Management (CRUD)
 *   7.  Course Management (Create + Delete)
 *   8.  Result Management (CRUD + Auto Grading)
 *   9.  Attendance Tracker
 *  10.  Settings (Dark Mode, Compact Sidebar, Clear Data)
 *  11.  Toast Notification System
 *  12.  Delete Confirm Modal
 *  13.  Search / Filter Utilities
 *  14.  Global Initialisation (DOMContentLoaded)
 *
 * LOCALSTORAGE KEYS:
 *   "educore_students"   → Array of student objects
 *   "educore_teachers"   → Array of teacher objects
 *   "educore_courses"    → Array of course objects
 *   "educore_results"    → Array of result objects
 *   "educore_attendance" → Object { studentId: 'present'|'absent' }
 *   "educore_theme"      → 'dark' | 'light'
 *   "educore_compact"    → 'true' | 'false'
 * =============================================================
 */

'use strict';

/* =============================================================
   1. STATE & CONSTANTS
============================================================= */

/** Pending delete action — populated before the confirm modal opens */
let pendingDelete = { type: null, id: null };

/** Grade boundaries (used by calcGrade) */
const GRADE_SCALE = [
  { min: 70, grade: 'A',  remark: 'Excellent' },
  { min: 60, grade: 'B',  remark: 'Very Good' },
  { min: 50, grade: 'C',  remark: 'Good'      },
  { min: 40, grade: 'D',  remark: 'Pass'      },
  { min:  0, grade: 'F',  remark: 'Fail'      },
];

/** Section meta for page title updates */
const SECTION_TITLES = {
  dashboard:  { title: 'Dashboard',   sub: 'Welcome back, Admin' },
  students:   { title: 'Students',    sub: 'Manage student records' },
  teachers:   { title: 'Teachers',    sub: 'Manage faculty records' },
  courses:    { title: 'Courses',     sub: 'Manage offered courses' },
  results:    { title: 'Results',     sub: 'Academic performance records' },
  attendance: { title: 'Attendance',  sub: "Track today's attendance" },
  settings:   { title: 'Settings',    sub: 'Configure portal preferences' },
};

/* =============================================================
   2. LOCALSTORAGE HELPERS
   All data is JSON-serialised.  Each helper is a thin wrapper.
============================================================= */

/** Read an array from localStorage (returns [] on miss/error) */
function lsGet(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

/** Read a plain value (string / object) from localStorage */
function lsGetRaw(key, fallback = null) {
  const val = localStorage.getItem(key);
  return val !== null ? val : fallback;
}

/** Write an array/object to localStorage */
function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Generate a simple unique ID  (timestamp + random suffix) */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* =============================================================
   3. NAVIGATION & SECTION ROUTING
   Single-page navigation:  clicking a nav-link hides all
   .portal-section elements, then shows the target one.
============================================================= */

function activateSection(sectionName) {
  // 1. Update nav-link active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.section === sectionName);
  });

  // 2. Hide all sections, show the target
  document.querySelectorAll('.portal-section').forEach(sec => {
    sec.classList.remove('active');
  });
  const target = document.getElementById('section-' + sectionName);
  if (target) target.classList.add('active');

  // 3. Update page title in the navbar
  const meta = SECTION_TITLES[sectionName] || { title: 'Portal', sub: '' };
  document.getElementById('pageTitle').querySelector('h5').textContent = meta.title;
  document.getElementById('pageTitle').querySelector('small').textContent = meta.sub;

  // 4. Re-render relevant section when switching to it
  const renders = {
    dashboard:  renderDashboard,
    students:   renderStudentTable,
    teachers:   renderTeacherTable,
    courses:    renderCourseCards,
    results:    renderResultTable,
    attendance: renderAttendanceTable,
    settings:   renderSettingsStats,
  };
  if (renders[sectionName]) renders[sectionName]();

  // 5. Close mobile sidebar after navigation
  closeMobileSidebar();
}

/** Bind all nav-link clicks (sidebar + dropdown links) */
function initNavigation() {
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-section]');
    if (!link) return;
    e.preventDefault();
    activateSection(link.dataset.section);
  });
}

/* Mobile Sidebar Controls */
function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

/* =============================================================
   4. DASHBOARD RENDERING
   Pulls counts from localStorage and updates DOM.
============================================================= */

function renderDashboard() {
  const students   = lsGet('educore_students');
  const teachers   = lsGet('educore_teachers');
  const courses    = lsGet('educore_courses');
  const results    = lsGet('educore_results');
  const attendance = lsGetRaw('educore_attendance')
    ? JSON.parse(localStorage.getItem('educore_attendance')) : {};

  // Stat counters
  animateCount('dashStudents', students.length);
  animateCount('dashTeachers', teachers.length);
  animateCount('dashCourses',  courses.length);
  animateCount('dashResults',  results.length);

  // Sidebar badges
  document.getElementById('studentBadge').textContent = students.length;
  document.getElementById('teacherBadge').textContent = teachers.length;

  // Recent students table (last 5)
  const tbody = document.getElementById('recentStudentsTable');
  const recent = [...students].reverse().slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">
      <i class="bi bi-inbox fs-2 d-block mb-2"></i>No students yet</td></tr>`;
  } else {
    tbody.innerHTML = recent.map(s => `
      <tr>
        <td><strong>${s.firstName} ${s.lastName}</strong></td>
        <td>${s.class}</td>
        <td>${s.gender}</td>
        <td><span class="badge-status ${s.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${s.status}</span></td>
      </tr>`).join('');
  }

  // Attendance summary
  const presentCount = Object.values(attendance).filter(v => v === 'present').length;
  const absentCount  = Object.values(attendance).filter(v => v === 'absent').length;
  const total        = presentCount + absentCount;
  const rate         = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  document.getElementById('dashPresent').textContent = presentCount;
  document.getElementById('dashAbsent').textContent  = absentCount;
  document.getElementById('dashAttRate').textContent  = rate + '%';
  document.getElementById('dashAttBar').style.width   = rate + '%';
}

/** Smooth number count-up animation */
function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 600;
  const start    = performance.now();
  const from     = parseInt(el.textContent) || 0;

  function step(now) {
    const t   = Math.min((now - start) / duration, 1);
    const val = Math.round(from + (target - from) * easeOut(t));
    el.textContent = val;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/* =============================================================
   5. STUDENT MANAGEMENT
   Data shape: { id, firstName, lastName, email, phone,
                 class, gender, status, address }
============================================================= */

/** Render the student table (filtered by search term) */
function renderStudentTable(filter = '') {
  const students = lsGet('educore_students');
  const tbody    = document.getElementById('studentTableBody');
  const countEl  = document.getElementById('studentCountBadge');

  const filtered = students.filter(s =>
    `${s.firstName} ${s.lastName} ${s.email} ${s.class} ${s.gender}`
      .toLowerCase().includes(filter.toLowerCase())
  );

  countEl.textContent = `${filtered.length} student${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">
      <i class="bi bi-search fs-2 d-block mb-2"></i>
      ${filter ? 'No students match your search.' : 'No students yet. Click <strong>Add Student</strong> to begin.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s, i) => `
    <tr>
      <td><span class="text-muted">${i + 1}</span></td>
      <td>
        <div class="d-flex align-items-center gap-2">
          <div class="table-avatar">${s.firstName[0]}${s.lastName[0]}</div>
          <div>
            <strong>${s.firstName} ${s.lastName}</strong>
            <small class="d-block text-muted">${s.phone || '—'}</small>
          </div>
        </div>
      </td>
      <td>${s.email}</td>
      <td><span class="badge bg-primary-soft text-primary">${s.class}</span></td>
      <td>${s.gender}</td>
      <td>${s.phone || '—'}</td>
      <td><span class="badge-status ${s.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${s.status}</span></td>
      <td>
        <button class="btn-action btn-edit me-1" onclick="editStudent('${s.id}')" title="Edit"><i class="bi bi-pencil"></i></button>
        <button class="btn-action btn-delete" onclick="promptDelete('student','${s.id}','${s.firstName} ${s.lastName}')" title="Delete"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`).join('');

  // Re-sync sidebar badge
  document.getElementById('studentBadge').textContent = students.length;
}

/** Open the student modal in "Add" mode */
function initStudentModal() {
  const modal      = document.getElementById('studentModal');
  const addBtn     = document.getElementById('addStudentBtn');
  const saveBtn    = document.getElementById('saveStudentBtn');
  const form       = document.getElementById('studentForm');

  // Reset form when modal opens via the Add button
  addBtn.addEventListener('click', () => {
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('studentId').value = '';
    document.getElementById('studentModalLabel').innerHTML =
      '<i class="bi bi-person-plus me-2"></i>Add New Student';
    saveBtn.textContent = 'Save Student';
  });

  // Save (Add or Edit)
  saveBtn.addEventListener('click', () => {
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    const id        = document.getElementById('studentId').value;
    const students  = lsGet('educore_students');
    const student   = {
      id:         id || uid(),
      firstName:  document.getElementById('studentFirstName').value.trim(),
      lastName:   document.getElementById('studentLastName').value.trim(),
      email:      document.getElementById('studentEmail').value.trim(),
      phone:      document.getElementById('studentPhone').value.trim(),
      class:      document.getElementById('studentClass').value,
      gender:     document.getElementById('studentGender').value,
      status:     document.getElementById('studentStatus').value,
      address:    document.getElementById('studentAddress').value.trim(),
    };

    if (id) {
      // Edit existing
      const idx = students.findIndex(s => s.id === id);
      if (idx !== -1) students[idx] = student;
      showToast('Student updated successfully!', 'success');
    } else {
      // Add new
      students.push(student);
      showToast('Student added successfully!', 'success');
    }

    lsSet('educore_students', students);
    bootstrap.Modal.getInstance(modal).hide();
    form.reset();
    form.classList.remove('was-validated');
    renderStudentTable(document.getElementById('studentSearch').value);
    renderDashboard();
  });
}

/** Populate form fields for editing a student */
function editStudent(id) {
  const student = lsGet('educore_students').find(s => s.id === id);
  if (!student) return;

  document.getElementById('studentId').value          = student.id;
  document.getElementById('studentFirstName').value   = student.firstName;
  document.getElementById('studentLastName').value    = student.lastName;
  document.getElementById('studentEmail').value       = student.email;
  document.getElementById('studentPhone').value       = student.phone;
  document.getElementById('studentClass').value       = student.class;
  document.getElementById('studentGender').value      = student.gender;
  document.getElementById('studentStatus').value      = student.status;
  document.getElementById('studentAddress').value     = student.address;

  document.getElementById('studentModalLabel').innerHTML =
    '<i class="bi bi-pencil me-2"></i>Edit Student';
  document.getElementById('saveStudentBtn').textContent = 'Update Student';

  document.getElementById('studentForm').classList.remove('was-validated');

  new bootstrap.Modal(document.getElementById('studentModal')).show();
}

/* =============================================================
   6. TEACHER MANAGEMENT
   Data shape: { id, firstName, lastName, email, phone,
                 subject, qualification, status }
============================================================= */

function renderTeacherTable(filter = '') {
  const teachers = lsGet('educore_teachers');
  const tbody    = document.getElementById('teacherTableBody');
  const countEl  = document.getElementById('teacherCountBadge');

  const filtered = teachers.filter(t =>
    `${t.firstName} ${t.lastName} ${t.email} ${t.subject}`
      .toLowerCase().includes(filter.toLowerCase())
  );

  countEl.textContent = `${filtered.length} teacher${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">
      <i class="bi bi-search fs-2 d-block mb-2"></i>
      ${filter ? 'No teachers match your search.' : 'No teachers yet. Click <strong>Add Teacher</strong> to begin.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((t, i) => `
    <tr>
      <td><span class="text-muted">${i + 1}</span></td>
      <td>
        <div class="d-flex align-items-center gap-2">
          <div class="table-avatar teal">${t.firstName[0]}${t.lastName[0]}</div>
          <strong>${t.firstName} ${t.lastName}</strong>
        </div>
      </td>
      <td>${t.email}</td>
      <td><span class="badge bg-teal-soft text-teal">${t.subject}</span></td>
      <td>${t.phone || '—'}</td>
      <td>${t.qualification || '—'}</td>
      <td><span class="badge-status ${statusClass(t.status)}">${t.status}</span></td>
      <td>
        <button class="btn-action btn-edit me-1" onclick="editTeacher('${t.id}')" title="Edit"><i class="bi bi-pencil"></i></button>
        <button class="btn-action btn-delete" onclick="promptDelete('teacher','${t.id}','${t.firstName} ${t.lastName}')" title="Delete"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`).join('');

  document.getElementById('teacherBadge').textContent = teachers.length;
}

function statusClass(status) {
  if (status === 'Active')   return 'badge-active';
  if (status === 'On Leave') return 'badge-leave';
  return 'badge-inactive';
}

function initTeacherModal() {
  const modal   = document.getElementById('teacherModal');
  const addBtn  = document.getElementById('addTeacherBtn');
  const saveBtn = document.getElementById('saveTeacherBtn');
  const form    = document.getElementById('teacherForm');

  addBtn.addEventListener('click', () => {
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('teacherId').value = '';
    document.getElementById('teacherModalLabel').innerHTML =
      '<i class="bi bi-person-plus me-2"></i>Add New Teacher';
    saveBtn.textContent = 'Save Teacher';
  });

  saveBtn.addEventListener('click', () => {
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    const id       = document.getElementById('teacherId').value;
    const teachers = lsGet('educore_teachers');
    const teacher  = {
      id:            id || uid(),
      firstName:     document.getElementById('teacherFirstName').value.trim(),
      lastName:      document.getElementById('teacherLastName').value.trim(),
      email:         document.getElementById('teacherEmail').value.trim(),
      phone:         document.getElementById('teacherPhone').value.trim(),
      subject:       document.getElementById('teacherSubject').value.trim(),
      qualification: document.getElementById('teacherQualification').value.trim(),
      status:        document.getElementById('teacherStatus').value,
    };

    if (id) {
      const idx = teachers.findIndex(t => t.id === id);
      if (idx !== -1) teachers[idx] = teacher;
      showToast('Teacher updated successfully!', 'success');
    } else {
      teachers.push(teacher);
      showToast('Teacher added successfully!', 'success');
    }

    lsSet('educore_teachers', teachers);
    bootstrap.Modal.getInstance(modal).hide();
    form.reset();
    form.classList.remove('was-validated');
    renderTeacherTable(document.getElementById('teacherSearch').value);
    renderDashboard();
  });
}

function editTeacher(id) {
  const t = lsGet('educore_teachers').find(t => t.id === id);
  if (!t) return;

  document.getElementById('teacherId').value            = t.id;
  document.getElementById('teacherFirstName').value     = t.firstName;
  document.getElementById('teacherLastName').value      = t.lastName;
  document.getElementById('teacherEmail').value         = t.email;
  document.getElementById('teacherPhone').value         = t.phone;
  document.getElementById('teacherSubject').value       = t.subject;
  document.getElementById('teacherQualification').value = t.qualification;
  document.getElementById('teacherStatus').value        = t.status;

  document.getElementById('teacherModalLabel').innerHTML =
    '<i class="bi bi-pencil me-2"></i>Edit Teacher';
  document.getElementById('saveTeacherBtn').textContent = 'Update Teacher';
  document.getElementById('teacherForm').classList.remove('was-validated');

  new bootstrap.Modal(document.getElementById('teacherModal')).show();
}

/* =============================================================
   7. COURSE MANAGEMENT
   Data shape: { id, title, code, dept, units, status, desc }
============================================================= */

function renderCourseCards(filter = '') {
  const courses = lsGet('educore_courses');
  const grid    = document.getElementById('courseCardsGrid');

  const filtered = courses.filter(c =>
    `${c.title} ${c.code} ${c.dept}`.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="empty-courses">
          <i class="bi bi-journal-x"></i>
          ${filter ? 'No courses match your search.' : 'No courses yet. Click <strong>Add Course</strong> to begin.'}
        </div>
      </div>`;
    return;
  }

  // Icon pool for visual variety
  const icons = ['bi-calculator','bi-flask','bi-book','bi-globe','bi-music-note','bi-palette','bi-cpu','bi-graph-up','bi-translate','bi-rulers'];

  grid.innerHTML = filtered.map((c, i) => `
    <div class="col-12 col-sm-6 col-xl-4">
      <div class="course-card">
        <button class="course-card__delete" onclick="promptDelete('course','${c.id}','${c.title}')" title="Delete course">
          <i class="bi bi-trash3"></i>
        </button>
        <div class="course-card__icon" style="background:${cardColor(i)}">
          <i class="bi ${icons[i % icons.length]}"></i>
        </div>
        <div class="course-card__code">${c.code}</div>
        <div class="course-card__title">${c.title}</div>
        <div class="course-card__meta">
          ${c.dept ? `<i class="bi bi-building me-1"></i>${c.dept}` : ''}
          ${c.units ? ` &bull; ${c.units} unit${c.units > 1 ? 's' : ''}` : ''}
        </div>
        <span class="badge-status ${c.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${c.status}</span>
      </div>
    </div>`).join('');
}

function cardColor(i) {
  const colors = ['#6366F1','#14B8A6','#F59E0B','#F43F5E','#8B5CF6','#3B82F6','#EC4899','#10B981','#F97316','#6366F1'];
  return colors[i % colors.length];
}

function initCourseModal() {
  const modal   = document.getElementById('courseModal');
  const saveBtn = document.getElementById('saveCourseBtn');
  const form    = document.getElementById('courseForm');

  saveBtn.addEventListener('click', () => {
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    const courses = lsGet('educore_courses');
    courses.push({
      id:     uid(),
      title:  document.getElementById('courseTitle').value.trim(),
      code:   document.getElementById('courseCode').value.trim(),
      dept:   document.getElementById('courseDept').value.trim(),
      units:  document.getElementById('courseUnits').value,
      status: document.getElementById('courseStatus').value,
      desc:   document.getElementById('courseDesc').value.trim(),
    });

    lsSet('educore_courses', courses);
    bootstrap.Modal.getInstance(modal).hide();
    form.reset();
    form.classList.remove('was-validated');
    showToast('Course added successfully!', 'success');
    renderCourseCards();
    renderDashboard();
  });
}

/* =============================================================
   8. RESULT MANAGEMENT
   Data shape: { id, studentName, subject, score, grade, remark }
   Grade is auto-calculated from score using GRADE_SCALE.
============================================================= */

function calcGrade(score) {
  const s = parseInt(score);
  return GRADE_SCALE.find(g => s >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1];
}

function renderResultTable(filter = '') {
  const results = lsGet('educore_results');
  const tbody   = document.getElementById('resultTableBody');
  const countEl = document.getElementById('resultCountBadge');

  const filtered = results.filter(r =>
    `${r.studentName} ${r.subject}`.toLowerCase().includes(filter.toLowerCase())
  );

  countEl.textContent = `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">
      <i class="bi bi-search fs-2 d-block mb-2"></i>
      ${filter ? 'No results match your search.' : 'No results yet. Click <strong>Add Result</strong> to begin.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((r, i) => {
    const g = calcGrade(r.score);
    return `
      <tr>
        <td><span class="text-muted">${i + 1}</span></td>
        <td><strong>${r.studentName}</strong></td>
        <td>${r.subject}</td>
        <td><strong>${r.score}</strong><span class="text-muted">/100</span></td>
        <td><span class="badge-status grade-${g.grade}">${g.grade}</span></td>
        <td>${g.remark}</td>
        <td>
          <button class="btn-action btn-edit me-1" onclick="editResult('${r.id}')" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn-action btn-delete" onclick="promptDelete('result','${r.id}','${r.studentName} – ${r.subject}')" title="Delete"><i class="bi bi-trash3"></i></button>
        </td>
      </tr>`;
  }).join('');
}

function initResultModal() {
  const modal      = document.getElementById('resultModal');
  const saveBtn    = document.getElementById('saveResultBtn');
  const form       = document.getElementById('resultForm');
  const scoreInput = document.getElementById('resultScore');
  const preview    = document.getElementById('gradePreview');

  // Live grade preview as user types score
  scoreInput.addEventListener('input', () => {
    const val = parseInt(scoreInput.value);
    if (isNaN(val) || val < 0 || val > 100) {
      preview.textContent = 'Enter a score between 0 and 100';
      preview.style.color = '';
      return;
    }
    const g = calcGrade(val);
    preview.innerHTML = `Grade: <strong>${g.grade}</strong> — ${g.remark}`;
    const colors = { A:'#16A34A', B:'#2563EB', C:'#CA8A04', D:'#EA580C', F:'#DC2626' };
    preview.style.color = colors[g.grade] || '#64748B';
  });

  // Reset on open via Add button
  modal.addEventListener('show.bs.modal', () => {
    if (!document.getElementById('resultId').value) {
      form.reset();
      form.classList.remove('was-validated');
      preview.textContent = 'Enter a score to see the grade';
      preview.style.color = '';
      document.getElementById('resultModalLabel').innerHTML =
        '<i class="bi bi-plus-circle me-2"></i>Add Result';
    }
  });

  saveBtn.addEventListener('click', () => {
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    const id      = document.getElementById('resultId').value;
    const results = lsGet('educore_results');
    const score   = parseInt(document.getElementById('resultScore').value);
    const g       = calcGrade(score);
    const result  = {
      id:          id || uid(),
      studentName: document.getElementById('resultStudentName').value.trim(),
      subject:     document.getElementById('resultSubject').value.trim(),
      score,
      grade:       g.grade,
      remark:      g.remark,
    };

    if (id) {
      const idx = results.findIndex(r => r.id === id);
      if (idx !== -1) results[idx] = result;
      showToast('Result updated!', 'success');
    } else {
      results.push(result);
      showToast('Result added!', 'success');
    }

    lsSet('educore_results', results);
    bootstrap.Modal.getInstance(modal).hide();
    form.reset();
    document.getElementById('resultId').value = '';
    form.classList.remove('was-validated');
    renderResultTable(document.getElementById('resultSearch').value);
    renderDashboard();
  });
}

function editResult(id) {
  const r = lsGet('educore_results').find(r => r.id === id);
  if (!r) return;

  document.getElementById('resultId').value          = r.id;
  document.getElementById('resultStudentName').value = r.studentName;
  document.getElementById('resultSubject').value     = r.subject;
  document.getElementById('resultScore').value       = r.score;

  // Trigger live preview
  document.getElementById('resultScore').dispatchEvent(new Event('input'));

  document.getElementById('resultModalLabel').innerHTML =
    '<i class="bi bi-pencil me-2"></i>Edit Result';
  document.getElementById('resultForm').classList.remove('was-validated');

  new bootstrap.Modal(document.getElementById('resultModal')).show();
}

/* =============================================================
   9. ATTENDANCE TRACKER
   Stored as a plain object { studentId: 'present'|'absent' }
   This design makes O(1) lookups for a given student.
============================================================= */

function getAttendance() {
  try { return JSON.parse(localStorage.getItem('educore_attendance')) || {}; }
  catch { return {}; }
}
function saveAttendance(att) {
  localStorage.setItem('educore_attendance', JSON.stringify(att));
}

function renderAttendanceTable() {
  const students   = lsGet('educore_students');
  const attendance = getAttendance();
  const tbody      = document.getElementById('attendanceTableBody');

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">
      <i class="bi bi-people fs-2 d-block mb-2"></i>No students enrolled yet.</td></tr>`;
    updateAttSummary(attendance);
    return;
  }

  tbody.innerHTML = students.map((s, i) => {
    const status = attendance[s.id] || null;
    return `
      <tr>
        <td><span class="text-muted">${i + 1}</span></td>
        <td><strong>${s.firstName} ${s.lastName}</strong></td>
        <td>${s.class}</td>
        <td id="att-status-${s.id}">
          ${status === 'present' ? '<span class="att-present-badge"><i class="bi bi-check-circle me-1"></i>Present</span>'
          : status === 'absent'  ? '<span class="att-absent-badge"><i class="bi bi-x-circle me-1"></i>Absent</span>'
          : '<span class="att-unmarked-badge">Not Marked</span>'}
        </td>
        <td>
          <button class="btn btn-sm me-1 ${status === 'present' ? 'btn-success' : 'btn-outline-success'}"
            onclick="markAttendance('${s.id}', 'present')" style="font-size:0.78rem; border-radius:20px; padding:4px 14px;">
            <i class="bi bi-check2 me-1"></i>Present
          </button>
          <button class="btn btn-sm ${status === 'absent' ? 'btn-danger' : 'btn-outline-danger'}"
            onclick="markAttendance('${s.id}', 'absent')" style="font-size:0.78rem; border-radius:20px; padding:4px 14px;">
            <i class="bi bi-x me-1"></i>Absent
          </button>
        </td>
      </tr>`;
  }).join('');

  updateAttSummary(attendance);
}

function markAttendance(studentId, status) {
  const att = getAttendance();
  att[studentId] = status;
  saveAttendance(att);
  renderAttendanceTable(); // re-render to reflect change
  showToast(`Marked as ${status}!`, status === 'present' ? 'success' : 'error');
}

function updateAttSummary(attendance) {
  const vals    = Object.values(attendance);
  const present = vals.filter(v => v === 'present').length;
  const absent  = vals.filter(v => v === 'absent').length;
  const total   = present + absent;
  const rate    = total > 0 ? Math.round((present / total) * 100) : 0;

  document.getElementById('totalPresent').textContent = present;
  document.getElementById('totalAbsent').textContent  = absent;
  document.getElementById('attRate').textContent      = rate + '%';
}

/* =============================================================
   10. SETTINGS
   - Dark Mode: toggles data-theme on <html>
   - Compact Sidebar: toggles .compact class on sidebar
   - Clear Data: wipes all localStorage keys
============================================================= */

function initSettings() {
  const html         = document.documentElement;
  const darkToggle   = document.getElementById('darkModeToggle');
  const compactToggle= document.getElementById('compactSidebarToggle');
  const clearBtn     = document.getElementById('clearDataBtn');

  // Restore persisted preferences
  darkToggle.checked    = lsGetRaw('educore_theme', 'light') === 'dark';
  compactToggle.checked = lsGetRaw('educore_compact', 'false') === 'true';
  applyTheme(darkToggle.checked);
  applyCompact(compactToggle.checked);

  darkToggle.addEventListener('change', () => {
    applyTheme(darkToggle.checked);
    localStorage.setItem('educore_theme', darkToggle.checked ? 'dark' : 'light');
    showToast(darkToggle.checked ? 'Dark mode enabled' : 'Light mode enabled', 'info');
  });

  compactToggle.addEventListener('change', () => {
    applyCompact(compactToggle.checked);
    localStorage.setItem('educore_compact', compactToggle.checked ? 'true' : 'false');
  });

  clearBtn.addEventListener('click', () => {
    promptDelete('all', null, 'ALL DATA (students, teachers, courses, results, attendance)');
  });
}

function applyTheme(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

function applyCompact(isCompact) {
  const sidebar = document.getElementById('sidebar');
  const wrapper = document.getElementById('mainWrapper');
  sidebar.classList.toggle('compact', isCompact);
  wrapper.classList.toggle('compact', isCompact);
}

function renderSettingsStats() {
  document.getElementById('profileStudents').textContent = lsGet('educore_students').length;
  document.getElementById('profileTeachers').textContent = lsGet('educore_teachers').length;
  document.getElementById('profileCourses').textContent  = lsGet('educore_courses').length;
}

/* =============================================================
   11. TOAST NOTIFICATION SYSTEM
   showToast(message, type)
   type: 'success' | 'error' | 'info'
============================================================= */

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons     = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };

  const toast = document.createElement('div');
  toast.className = `portal-toast toast-${type}`;
  toast.innerHTML = `
    <i class="bi ${icons[type] || icons.info}"></i>
    <span>${message}</span>
    <button class="toast-close" aria-label="Close">&times;</button>`;

  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));
  container.appendChild(toast);

  // Auto-dismiss after 3.5 s
  setTimeout(() => dismissToast(toast), 3500);
}

function dismissToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add('hiding');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

/* =============================================================
   12. DELETE CONFIRM MODAL
   Stores pending delete action then executes on confirm click.
============================================================= */

function promptDelete(type, id, label) {
  pendingDelete = { type, id };
  document.getElementById('deleteModalMsg').innerHTML =
    `You are about to permanently delete <strong>${label}</strong>. This cannot be undone.`;
  new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

function initDeleteModal() {
  document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
    const { type, id } = pendingDelete;

    if (type === 'student') {
      lsSet('educore_students', lsGet('educore_students').filter(s => s.id !== id));
      // Also remove from attendance
      const att = getAttendance();
      delete att[id];
      saveAttendance(att);
      renderStudentTable(document.getElementById('studentSearch').value);
      showToast('Student deleted.', 'error');
    }

    else if (type === 'teacher') {
      lsSet('educore_teachers', lsGet('educore_teachers').filter(t => t.id !== id));
      renderTeacherTable(document.getElementById('teacherSearch').value);
      showToast('Teacher deleted.', 'error');
    }

    else if (type === 'course') {
      lsSet('educore_courses', lsGet('educore_courses').filter(c => c.id !== id));
      renderCourseCards(document.getElementById('courseSearch').value);
      showToast('Course deleted.', 'error');
    }

    else if (type === 'result') {
      lsSet('educore_results', lsGet('educore_results').filter(r => r.id !== id));
      renderResultTable(document.getElementById('resultSearch').value);
      showToast('Result deleted.', 'error');
    }

    else if (type === 'all') {
      // Wipe all data keys (keep theme + compact prefs)
      ['educore_students','educore_teachers','educore_courses','educore_results','educore_attendance']
        .forEach(k => localStorage.removeItem(k));
      renderDashboard();
      renderSettingsStats();
      showToast('All data cleared.', 'error');
    }

    renderDashboard(); // keep dashboard counts in sync
    bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
    pendingDelete = { type: null, id: null };
  });
}

/* =============================================================
   13. SEARCH / FILTER UTILITIES
   Each search input in the toolbar calls the relevant render
   function, passing the current search value as a filter.
============================================================= */

function initSearchListeners() {
  const map = {
    'studentSearch': () => renderStudentTable(document.getElementById('studentSearch').value),
    'teacherSearch': () => renderTeacherTable(document.getElementById('teacherSearch').value),
    'courseSearch':  () => renderCourseCards(document.getElementById('courseSearch').value),
    'resultSearch':  () => renderResultTable(document.getElementById('resultSearch').value),
  };

  Object.entries(map).forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', fn);
  });

  // Global search in navbar (highlights active section search)
  document.getElementById('globalSearch').addEventListener('input', e => {
    const val = e.target.value;
    // Mirror value into the active section's search input if it exists
    const active = document.querySelector('.portal-section.active');
    if (!active) return;
    const inner = active.querySelector('.toolbar-input');
    if (inner) { inner.value = val; inner.dispatchEvent(new Event('input')); }
  });
}

/* =============================================================
   14. GLOBAL INITIALISATION
   Everything inside DOMContentLoaded so the DOM is fully
   parsed before any querySelector runs.  This was the core
   bug fixed in NovaChatAI — we apply the same pattern here.
============================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Navigation ── */
  initNavigation();

  /* ── Hamburger / Sidebar overlay ── */
  document.getElementById('hamburgerBtn').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    // On mobile: open/close overlay mode
    if (window.innerWidth <= 991) {
      sidebar.classList.contains('open') ? closeMobileSidebar() : openMobileSidebar();
    } else {
      // On desktop: toggle compact mode
      const isCompact = sidebar.classList.contains('compact');
      document.getElementById('compactSidebarToggle').checked = !isCompact;
      applyCompact(!isCompact);
      localStorage.setItem('educore_compact', (!isCompact).toString());
    }
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);

  /* ── Modals ── */
  initStudentModal();
  initTeacherModal();
  initCourseModal();
  initResultModal();
  initDeleteModal();

  /* ── Search listeners ── */
  initSearchListeners();

  /* ── Settings (theme, compact, clear) ── */
  initSettings();

  /* ── Attendance reset button ── */
  document.getElementById('resetAttendanceBtn').addEventListener('click', () => {
    promptDelete('attendance-reset', null, "today's attendance records");
  });

  // Intercept the attendance-reset delete
  const origConfirm = document.getElementById('confirmDeleteBtn');
  origConfirm.addEventListener('click', () => {
    if (pendingDelete.type === 'attendance-reset') {
      saveAttendance({});
      renderAttendanceTable();
      showToast("Attendance reset for today.", 'info');
    }
  });

  /* ── Notification bell (demo) ── */
  document.getElementById('notifBtn').addEventListener('click', () => {
    showToast('You have no new notifications.', 'info');
  });

  /* ── Seed sample data on very first load ── */
  seedSampleData();

  /* ── Initial render ── */
  renderDashboard();

  // Add table-avatar styles dynamically (small detail for initials avatars)
  const style = document.createElement('style');
  style.textContent = `
    .table-avatar {
      width:32px; height:32px; border-radius:50%;
      background:var(--color-accent); color:#fff;
      font-size:0.72rem; font-weight:700;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; text-transform:uppercase;
    }
    .table-avatar.teal { background:var(--color-teal); }
  `;
  document.head.appendChild(style);

});

/* =============================================================
   15. SAMPLE DATA SEED
   Populates localStorage with realistic demo records on first
   visit (only if keys are empty).  This makes the portal
   look alive in a demo or portfolio presentation.
============================================================= */

function seedSampleData() {
  // Only seed if there is nothing yet
  if (lsGet('educore_students').length > 0) return;

  const students = [
    { id: uid(), firstName: 'Amina',   lastName: 'Bello',   email: 'amina@educore.ng',   phone: '08012341001', class: 'SS 2', gender: 'Female', status: 'Active',   address: 'No 4, Gwarimpa, Abuja' },
    { id: uid(), firstName: 'Chukwuma',lastName: 'Obi',     email: 'chukwuma@educore.ng',phone: '08012341002', class: 'JSS 3',gender: 'Male',   status: 'Active',   address: 'No 12, Wuse 2, Abuja' },
    { id: uid(), firstName: 'Fatima',  lastName: 'Yusuf',   email: 'fatima@educore.ng',  phone: '08012341003', class: 'SS 1', gender: 'Female', status: 'Active',   address: 'No 7, Kubwa, Abuja' },
    { id: uid(), firstName: 'Emeka',   lastName: 'Eze',     email: 'emeka@educore.ng',   phone: '08012341004', class: 'SS 3', gender: 'Male',   status: 'Inactive', address: 'No 3, Garki, Abuja' },
    { id: uid(), firstName: 'Ngozi',   lastName: 'Adeyemi', email: 'ngozi@educore.ng',   phone: '08012341005', class: 'JSS 2',gender: 'Female', status: 'Active',   address: 'No 9, Maitama, Abuja' },
  ];

  const teachers = [
    { id: uid(), firstName: 'Chidi',  lastName: 'Okafor', email: 'chidi@educore.ng',  phone: '08098761001', subject: 'Mathematics',  qualification: 'B.Ed, M.Sc', status: 'Active'   },
    { id: uid(), firstName: 'Aisha',  lastName: 'Musa',   email: 'aisha@educore.ng',  phone: '08098761002', subject: 'English',       qualification: 'B.A, PGDE',  status: 'Active'   },
    { id: uid(), firstName: 'Tunde',  lastName: 'Adebayo',email: 'tunde@educore.ng',  phone: '08098761003', subject: 'Physics',       qualification: 'B.Sc, M.Ed', status: 'On Leave' },
    { id: uid(), firstName: 'Blessing',lastName:'Nwosu',  email: 'blessing@educore.ng',phone:'08098761004', subject: 'Biology',       qualification: 'B.Sc, PGDE', status: 'Active'   },
  ];

  const courses = [
    { id: uid(), title: 'Further Mathematics', code: 'MTH301', dept: 'Science',       units: 4, status: 'Active', desc: 'Advanced pure and applied mathematics.' },
    { id: uid(), title: 'English Language',    code: 'ENG101', dept: 'Arts',          units: 3, status: 'Active', desc: 'Comprehension, grammar and essay writing.' },
    { id: uid(), title: 'Physics',             code: 'PHY201', dept: 'Science',       units: 4, status: 'Active', desc: 'Mechanics, waves, electricity and modern physics.' },
    { id: uid(), title: 'Christian R.S.',      code: 'CRS101', dept: 'Humanities',    units: 2, status: 'Active', desc: 'Biblical history and Christian values.' },
    { id: uid(), title: 'Economics',           code: 'ECO201', dept: 'Social Science',units: 3, status: 'Active', desc: 'Micro and macroeconomics principles.' },
    { id: uid(), title: 'Chemistry',           code: 'CHE201', dept: 'Science',       units: 4, status: 'Active', desc: 'Organic, inorganic and physical chemistry.' },
  ];

  const results = [
    { id: uid(), studentName: 'Amina Bello',     subject: 'Mathematics', score: 82, grade: 'A', remark: 'Excellent' },
    { id: uid(), studentName: 'Amina Bello',     subject: 'English',     score: 74, grade: 'A', remark: 'Excellent' },
    { id: uid(), studentName: 'Chukwuma Obi',    subject: 'Physics',     score: 65, grade: 'B', remark: 'Very Good' },
    { id: uid(), studentName: 'Fatima Yusuf',    subject: 'Chemistry',   score: 58, grade: 'C', remark: 'Good'      },
    { id: uid(), studentName: 'Emeka Eze',       subject: 'Economics',   score: 43, grade: 'D', remark: 'Pass'      },
    { id: uid(), studentName: 'Ngozi Adeyemi',   subject: 'English',     score: 91, grade: 'A', remark: 'Excellent' },
  ];

  // Seed all data
  lsSet('educore_students', students);
  lsSet('educore_teachers', teachers);
  lsSet('educore_courses',  courses);
  lsSet('educore_results',  results);

  // Seed some attendance records
  const att = {};
  att[students[0].id] = 'present';
  att[students[1].id] = 'present';
  att[students[2].id] = 'absent';
  att[students[3].id] = 'present';
  att[students[4].id] = 'absent';
  saveAttendance(att);
}
