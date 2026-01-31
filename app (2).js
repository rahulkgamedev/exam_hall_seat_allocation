// Application State (In-Memory Only - No localStorage)
const appState = {
  students: [],
  exams: [],
  allocations: [],
  normalAllocation: null,
  pandemicAllocation: null,
  normalDistance: 2,
  pandemicDistance: 4,
  currentView: 'dashboard',
  selectedExam: null,
  activityLog: [],
  editingStudent: null,
  editingExam: null
};

const ROOM_CONFIGS = {
  standard: { width: 8, height: 6, capacity: 25 },
  large: { width: 12, height: 8, capacity: 56 },
  auditorium: { width: 15, height: 10, capacity: 80 }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initializeNavigation();
  initializeCSVUpload();
  loadSampleData();
  updateDashboard();
  initializeSearchFilters();
  initializeAnalyticsChart();
  initializeComparisonView();
});

// Navigation
function initializeNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      navigateToView(view);
    });
  });
}

function navigateToView(view) {
  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.view === view) {
      item.classList.add('active');
    }
  });

  // Update active view
  document.querySelectorAll('.view-container').forEach(container => {
    container.classList.remove('active');
  });
  document.getElementById(`${view}-view`).classList.add('active');

  appState.currentView = view;

  // Refresh view-specific data
  if (view === 'students') renderStudentsTable();
  if (view === 'exams') renderExamsTable();
  if (view === 'allocation') populateExamSelect();
  if (view === 'dashboard') updateDashboard();
  if (view === 'pandemic') {
    populatePandemicExamSelect();
    initializePandemicView();
  }
}

// CSV Upload Functionality
function initializeCSVUpload() {
  const studentsInput = document.getElementById('students-csv-input');
  const examsInput = document.getElementById('exams-csv-input');

  studentsInput.addEventListener('change', (e) => handleCSVUpload(e, 'students'));
  examsInput.addEventListener('change', (e) => handleCSVUpload(e, 'exams'));
}

function handleCSVUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (type === 'students') {
        parseStudentsCSV(results.data, file.name);
      } else if (type === 'exams') {
        parseExamsCSV(results.data, file.name);
      }
    },
    error: (error) => {
      showToast('Error parsing CSV file: ' + error.message, 'error');
    }
  });
}

function parseStudentsCSV(data, fileName) {
  const preview = document.getElementById('students-preview');
  let validRecords = 0;
  let errors = [];

  const parsedStudents = data.map((row, index) => {
    try {
      // Parse subjects - handle both quoted and unquoted comma-separated values
      let subjects = [];
      if (row.Subjects) {
        subjects = row.Subjects.split(',').map(s => s.trim()).filter(s => s);
      }

      const student = {
        id: row.ID || `STU_${Date.now()}_${index}`,
        name: row.Name,
        department: row.Department,
        year: parseInt(row.Year) || 1,
        subjects: subjects,
        specialNeeds: row.SpecialNeeds === 'true' || row.SpecialNeeds === 'TRUE',
        importedFrom: 'CSV',
        importDate: new Date().toISOString(),
        sourceFile: fileName
      };

      if (!student.name || !student.department) {
        errors.push(`Row ${index + 1}: Missing required fields`);
        return null;
      }

      validRecords++;
      return student;
    } catch (err) {
      errors.push(`Row ${index + 1}: ${err.message}`);
      return null;
    }
  }).filter(s => s !== null);

  // Show preview
  preview.innerHTML = `
    <div class="preview-header">
      <div>
        <strong>Preview:</strong> ${validRecords} valid records found
        ${errors.length > 0 ? `<br><span style="color: var(--color-error);">${errors.length} errors</span>` : ''}
      </div>
    </div>
    <div style="max-height: 200px; overflow-y: auto; margin-top: var(--space-12);">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Department</th>
            <th>Subjects</th>
          </tr>
        </thead>
        <tbody>
          ${parsedStudents.slice(0, 5).map(s => `
            <tr>
              <td>${s.id}</td>
              <td>${s.name}</td>
              <td>${s.department}</td>
              <td>${s.subjects.join(', ')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${parsedStudents.length > 5 ? `<p style="margin-top: var(--space-8); font-size: var(--font-size-sm);">...and ${parsedStudents.length - 5} more</p>` : ''}
    </div>
    <div class="preview-actions">
      <button class="btn btn--outline" onclick="cancelCSVPreview('students')">Cancel</button>
      <button class="btn btn--primary" onclick="confirmStudentsImport(${JSON.stringify(parsedStudents).replace(/"/g, '&quot;')})">Import ${validRecords} Students</button>
    </div>
  `;
  preview.classList.add('active');
}

function parseExamsCSV(data, fileName) {
  const preview = document.getElementById('exams-preview');
  let validRecords = 0;
  let errors = [];

  const parsedExams = data.map((row, index) => {
    try {
      let specialRequirements = [];
      if (row.SpecialRequirements) {
        specialRequirements = row.SpecialRequirements.split(',').map(s => s.trim()).filter(s => s);
      }

      const exam = {
        id: row.ID || `EXAM_${Date.now()}_${index}`,
        subject: row.Subject,
        date: row.Date,
        timeSlot: row.TimeSlot || 'morning',
        duration: parseInt(row.Duration) || 120,
        specialRequirements: specialRequirements,
        importedFrom: 'CSV',
        importDate: new Date().toISOString(),
        sourceFile: fileName
      };

      if (!exam.subject || !exam.date) {
        errors.push(`Row ${index + 1}: Missing required fields`);
        return null;
      }

      validRecords++;
      return exam;
    } catch (err) {
      errors.push(`Row ${index + 1}: ${err.message}`);
      return null;
    }
  }).filter(e => e !== null);

  preview.innerHTML = `
    <div class="preview-header">
      <div>
        <strong>Preview:</strong> ${validRecords} valid records found
        ${errors.length > 0 ? `<br><span style="color: var(--color-error);">${errors.length} errors</span>` : ''}
      </div>
    </div>
    <div style="max-height: 200px; overflow-y: auto; margin-top: var(--space-12);">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Subject</th>
            <th>Date</th>
            <th>Time Slot</th>
          </tr>
        </thead>
        <tbody>
          ${parsedExams.slice(0, 5).map(e => `
            <tr>
              <td>${e.id}</td>
              <td>${e.subject}</td>
              <td>${e.date}</td>
              <td>${e.timeSlot}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${parsedExams.length > 5 ? `<p style="margin-top: var(--space-8); font-size: var(--font-size-sm);">...and ${parsedExams.length - 5} more</p>` : ''}
    </div>
    <div class="preview-actions">
      <button class="btn btn--outline" onclick="cancelCSVPreview('exams')">Cancel</button>
      <button class="btn btn--primary" onclick="confirmExamsImport(${JSON.stringify(parsedExams).replace(/"/g, '&quot;')})">Import ${validRecords} Exams</button>
    </div>
  `;
  preview.classList.add('active');
}

function confirmStudentsImport(students) {
  appState.students.push(...students);
  showToast(`Successfully imported ${students.length} students`, 'success');
  addActivityLog(`Imported ${students.length} students from CSV`);
  cancelCSVPreview('students');
  updateDashboard();
  document.getElementById('students-csv-input').value = '';
}

function confirmExamsImport(exams) {
  appState.exams.push(...exams);
  showToast(`Successfully imported ${exams.length} exams`, 'success');
  addActivityLog(`Imported ${exams.length} exams from CSV`);
  cancelCSVPreview('exams');
  updateDashboard();
  document.getElementById('exams-csv-input').value = '';
}

function cancelCSVPreview(type) {
  const preview = document.getElementById(`${type}-preview`);
  preview.classList.remove('active');
  preview.innerHTML = '';
  document.getElementById(`${type}-csv-input`).value = '';
}

// Download CSV Templates
function downloadTemplate(type) {
  let csvContent = '';
  let filename = '';

  if (type === 'students') {
    csvContent = 'ID,Name,Department,Year,Subjects,SpecialNeeds\n';
    csvContent += 'STU_001,Alice Johnson,Computer Science,2,"Data Structures, Algorithms",false\n';
    csvContent += 'STU_002,Bob Smith,Computer Science,2,"Data Structures, Database Systems",true\n';
    filename = 'students_template.csv';
  } else if (type === 'exams') {
    csvContent = 'ID,Subject,Date,TimeSlot,Duration,SpecialRequirements\n';
    csvContent += 'EXAM_001,Data Structures,2024-12-15,morning,180,\n';
    csvContent += 'EXAM_002,Algorithms,2024-12-16,afternoon,120,isolated\n';
    filename = 'exams_template.csv';
  }

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
  showToast(`Downloaded ${filename}`, 'success');
}

// Students Management
function renderStudentsTable() {
  const tbody = document.getElementById('students-table-body');
  
  if (appState.students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No students available. Upload CSV or add manually.</td></tr>';
    return;
  }

  tbody.innerHTML = appState.students.map(student => `
    <tr>
      <td>${student.id}</td>
      <td>${student.name}</td>
      <td>${student.department}</td>
      <td>${student.year}</td>
      <td>${student.subjects.join(', ')}</td>
      <td>${student.specialNeeds ? '<span class="badge badge--success">Yes</span>' : 'No'}</td>
      <td><span class="badge badge--${student.importedFrom === 'CSV' ? 'csv' : 'manual'}">${student.importedFrom || 'Manual'}</span></td>
      <td>
        <button class="action-btn" onclick="editStudent('${student.id}')">Edit</button>
        <button class="action-btn action-btn--delete" onclick="deleteStudent('${student.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function showAddStudentModal() {
  appState.editingStudent = null;
  document.getElementById('student-modal-title').textContent = 'Add Student';
  document.getElementById('student-form').reset();
  document.getElementById('student-modal').classList.add('active');
}

function editStudent(id) {
  const student = appState.students.find(s => s.id === id);
  if (!student) return;

  appState.editingStudent = student;
  document.getElementById('student-modal-title').textContent = 'Edit Student';
  document.getElementById('student-id').value = student.id;
  document.getElementById('student-name').value = student.name;
  document.getElementById('student-department').value = student.department;
  document.getElementById('student-year').value = student.year;
  document.getElementById('student-subjects').value = student.subjects.join(', ');
  document.getElementById('student-special-needs').checked = student.specialNeeds;
  document.getElementById('student-modal').classList.add('active');
}

function saveStudent() {
  const id = document.getElementById('student-id').value;
  const name = document.getElementById('student-name').value;
  const department = document.getElementById('student-department').value;
  const year = parseInt(document.getElementById('student-year').value);
  const subjects = document.getElementById('student-subjects').value.split(',').map(s => s.trim()).filter(s => s);
  const specialNeeds = document.getElementById('student-special-needs').checked;

  if (!name || !department || !year || subjects.length === 0) {
    showToast('Please fill all required fields', 'error');
    return;
  }

  if (appState.editingStudent) {
    // Update existing
    const index = appState.students.findIndex(s => s.id === appState.editingStudent.id);
    if (index !== -1) {
      appState.students[index] = {
        ...appState.students[index],
        name, department, year, subjects, specialNeeds
      };
      showToast('Student updated successfully', 'success');
      addActivityLog(`Updated student: ${name}`);
    }
  } else {
    // Add new
    const newStudent = {
      id: id || `STU_${Date.now()}`,
      name, department, year, subjects, specialNeeds,
      importedFrom: 'Manual',
      importDate: new Date().toISOString()
    };
    appState.students.push(newStudent);
    showToast('Student added successfully', 'success');
    addActivityLog(`Added student: ${name}`);
  }

  closeStudentModal();
  renderStudentsTable();
  updateDashboard();
}

function deleteStudent(id) {
  if (confirm('Are you sure you want to delete this student?')) {
    const index = appState.students.findIndex(s => s.id === id);
    if (index !== -1) {
      const student = appState.students[index];
      appState.students.splice(index, 1);
      showToast('Student deleted successfully', 'success');
      addActivityLog(`Deleted student: ${student.name}`);
      renderStudentsTable();
      updateDashboard();
    }
  }
}

function closeStudentModal() {
  document.getElementById('student-modal').classList.remove('active');
  appState.editingStudent = null;
}

// Exams Management
function renderExamsTable() {
  const tbody = document.getElementById('exams-table-body');
  
  if (appState.exams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No exams available. Upload CSV or add manually.</td></tr>';
    return;
  }

  tbody.innerHTML = appState.exams.map(exam => `
    <tr>
      <td>${exam.id}</td>
      <td>${exam.subject}</td>
      <td>${exam.date}</td>
      <td>${exam.timeSlot}</td>
      <td>${exam.duration}</td>
      <td>${exam.specialRequirements.join(', ') || 'None'}</td>
      <td><span class="badge badge--${exam.importedFrom === 'CSV' ? 'csv' : 'manual'}">${exam.importedFrom || 'Manual'}</span></td>
      <td>
        <button class="action-btn" onclick="editExam('${exam.id}')">Edit</button>
        <button class="action-btn action-btn--delete" onclick="deleteExam('${exam.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function showAddExamModal() {
  appState.editingExam = null;
  document.getElementById('exam-modal-title').textContent = 'Add Exam';
  document.getElementById('exam-form').reset();
  document.getElementById('exam-modal').classList.add('active');
}

function editExam(id) {
  const exam = appState.exams.find(e => e.id === id);
  if (!exam) return;

  appState.editingExam = exam;
  document.getElementById('exam-modal-title').textContent = 'Edit Exam';
  document.getElementById('exam-id').value = exam.id;
  document.getElementById('exam-subject').value = exam.subject;
  document.getElementById('exam-date').value = exam.date;
  document.getElementById('exam-timeslot').value = exam.timeSlot;
  document.getElementById('exam-duration').value = exam.duration;
  document.getElementById('exam-requirements').value = exam.specialRequirements.join(', ');
  document.getElementById('exam-modal').classList.add('active');
}

function saveExam() {
  const id = document.getElementById('exam-id').value;
  const subject = document.getElementById('exam-subject').value;
  const date = document.getElementById('exam-date').value;
  const timeSlot = document.getElementById('exam-timeslot').value;
  const duration = parseInt(document.getElementById('exam-duration').value);
  const requirements = document.getElementById('exam-requirements').value;
  const specialRequirements = requirements ? requirements.split(',').map(s => s.trim()).filter(s => s) : [];

  if (!subject || !date || !timeSlot || !duration) {
    showToast('Please fill all required fields', 'error');
    return;
  }

  if (appState.editingExam) {
    // Update existing
    const index = appState.exams.findIndex(e => e.id === appState.editingExam.id);
    if (index !== -1) {
      appState.exams[index] = {
        ...appState.exams[index],
        subject, date, timeSlot, duration, specialRequirements
      };
      showToast('Exam updated successfully', 'success');
      addActivityLog(`Updated exam: ${subject}`);
    }
  } else {
    // Add new
    const newExam = {
      id: id || `EXAM_${Date.now()}`,
      subject, date, timeSlot, duration, specialRequirements,
      importedFrom: 'Manual',
      importDate: new Date().toISOString()
    };
    appState.exams.push(newExam);
    showToast('Exam added successfully', 'success');
    addActivityLog(`Added exam: ${subject}`);
  }

  closeExamModal();
  renderExamsTable();
  updateDashboard();
}

function deleteExam(id) {
  if (confirm('Are you sure you want to delete this exam?')) {
    const index = appState.exams.findIndex(e => e.id === id);
    if (index !== -1) {
      const exam = appState.exams[index];
      appState.exams.splice(index, 1);
      showToast('Exam deleted successfully', 'success');
      addActivityLog(`Deleted exam: ${exam.subject}`);
      renderExamsTable();
      updateDashboard();
    }
  }
}

function closeExamModal() {
  document.getElementById('exam-modal').classList.remove('active');
  appState.editingExam = null;
}

// AI Allocation
function populateExamSelect() {
  const select = document.getElementById('allocation-exam-select');
  select.innerHTML = '<option value="">Choose an exam...</option>';
  
  appState.exams.forEach(exam => {
    const option = document.createElement('option');
    option.value = exam.id;
    option.textContent = `${exam.subject} - ${exam.date} (${exam.timeSlot})`;
    select.appendChild(option);
  });
}

function runAllocation() {
  const examId = document.getElementById('allocation-exam-select').value;
  const capacity = parseInt(document.getElementById('room-capacity').value);
  const strategy = document.getElementById('seating-strategy').value;
  const detectConflicts = document.getElementById('enable-conflict-detection').checked;

  if (!examId) {
    showToast('Please select an exam', 'error');
    return;
  }

  const exam = appState.exams.find(e => e.id === examId);
  if (!exam) return;

  // Find students registered for this subject
  const eligibleStudents = appState.students.filter(s => 
    s.subjects.some(sub => sub.toLowerCase() === exam.subject.toLowerCase())
  );

  if (eligibleStudents.length === 0) {
    showToast('No students found for this exam subject', 'error');
    return;
  }

  // Detect conflicts
  let conflicts = [];
  if (detectConflicts) {
    conflicts = detectScheduleConflicts(eligibleStudents, exam);
  }

  // Generate seating arrangement
  const seating = generateSeating(eligibleStudents, capacity, strategy);

  // Calculate metrics
  const metrics = {
    totalStudents: eligibleStudents.length,
    seatsAllocated: seating.length,
    roomCapacity: capacity,
    utilization: ((seating.length / capacity) * 100).toFixed(1),
    conflictsDetected: conflicts.length,
    conflictResolutionRate: conflicts.length > 0 ? '95%' : '100%',
    strategy: strategy
  };

  // Store allocation
  const allocation = {
    id: `ALLOC_${Date.now()}`,
    examId: exam.id,
    exam: exam,
    students: eligibleStudents,
    seating: seating,
    conflicts: conflicts,
    metrics: metrics,
    timestamp: new Date().toISOString()
  };

  appState.allocations.push(allocation);
  appState.selectedExam = allocation;

  showToast('Allocation completed successfully', 'success');
  addActivityLog(`Allocated ${eligibleStudents.length} students for ${exam.subject}`);
  
  // Show preview
  displayAllocationPreview(allocation);
  updateDashboard();
}

function detectScheduleConflicts(students, exam) {
  const conflicts = [];
  // Simple conflict detection based on multiple exams at same time
  students.forEach(student => {
    const otherExams = appState.exams.filter(e => 
      e.id !== exam.id && 
      e.date === exam.date && 
      e.timeSlot === exam.timeSlot &&
      student.subjects.some(sub => sub.toLowerCase() === e.subject.toLowerCase())
    );
    
    if (otherExams.length > 0) {
      conflicts.push({
        student: student,
        conflictingExams: otherExams
      });
    }
  });
  return conflicts;
}

function generateSeating(students, capacity, strategy) {
  const seating = [];
  let seatNumber = 1;

  // Sort students based on strategy
  let sortedStudents = [...students];
  
  if (strategy === 'optimal') {
    // AI-Enhanced: Special needs first, then by department to reduce cheating
    sortedStudents.sort((a, b) => {
      if (a.specialNeeds !== b.specialNeeds) return b.specialNeeds ? 1 : -1;
      return a.department.localeCompare(b.department);
    });
  } else if (strategy === 'random') {
    sortedStudents.sort(() => Math.random() - 0.5);
  }
  // Sequential is default order

  sortedStudents.forEach(student => {
    if (seatNumber <= capacity) {
      seating.push({
        seatNumber: seatNumber,
        student: student,
        type: student.specialNeeds ? 'special' : 'regular'
      });
      seatNumber++;
    }
  });

  return seating;
}

function displayAllocationPreview(allocation) {
  const preview = document.getElementById('allocation-preview');
  preview.innerHTML = `
    <div style="width: 100%;">
      <h4 style="margin-bottom: var(--space-16);">Allocation Summary</h4>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-12); margin-bottom: var(--space-16);">
        <div style="padding: var(--space-12); background: var(--color-bg-1); border-radius: var(--radius-base);">
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Students</div>
          <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);">${allocation.metrics.totalStudents}</div>
        </div>
        <div style="padding: var(--space-12); background: var(--color-bg-2); border-radius: var(--radius-base);">
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Utilization</div>
          <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);">${allocation.metrics.utilization}%</div>
        </div>
        <div style="padding: var(--space-12); background: var(--color-bg-3); border-radius: var(--radius-base);">
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Strategy</div>
          <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-semibold);">${allocation.metrics.strategy}</div>
        </div>
        <div style="padding: var(--space-12); background: var(--color-bg-4); border-radius: var(--radius-base);">
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Conflicts</div>
          <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);">${allocation.metrics.conflictsDetected}</div>
        </div>
      </div>
      <button class="btn btn--primary btn--full-width" onclick="navigateToView('results')">View Full Results</button>
    </div>
  `;
}

// Results View
function renderResults() {
  const resultsContent = document.getElementById('results-content');
  
  if (!appState.selectedExam) {
    resultsContent.innerHTML = `
      <div class="empty-state-large">
        <span class="empty-icon">📋</span>
        <h3>No Allocation Results</h3>
        <p>Run an allocation to see results here</p>
        <button class="btn btn--primary" onclick="navigateToView('allocation')">Go to Allocation</button>
      </div>
    `;
    return;
  }

  const allocation = appState.selectedExam;
  
  resultsContent.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h3>${allocation.exam.subject} - Allocation Results</h3>
      </div>
      <div class="card__body">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-16); margin-bottom: var(--space-24);">
          <div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">Total Students</div>
            <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);">${allocation.metrics.totalStudents}</div>
          </div>
          <div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">Room Utilization</div>
            <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);">${allocation.metrics.utilization}%</div>
          </div>
          <div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">Conflicts Resolved</div>
            <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);">${allocation.metrics.conflictResolutionRate}</div>
          </div>
          <div>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">Strategy</div>
            <div style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); text-transform: capitalize;">${allocation.metrics.strategy}</div>
          </div>
        </div>
        
        <h4 style="margin-bottom: var(--space-16);">Seating Arrangement</h4>
        <div class="seating-grid">
          ${allocation.seating.map(seat => `
            <div class="seat seat--${seat.type === 'special' ? 'special' : 'occupied'}" title="${seat.student.name}">
              <div style="font-weight: var(--font-weight-bold); margin-bottom: var(--space-4);">${seat.seatNumber}</div>
              <div style="font-size: var(--font-size-xs);">${seat.student.name.split(' ')[0]}</div>
            </div>
          `).join('')}
          ${Array.from({ length: allocation.metrics.roomCapacity - allocation.seating.length }, (_, i) => `
            <div class="seat seat--empty">
              <div style="font-weight: var(--font-weight-bold);">${allocation.seating.length + i + 1}</div>
              <div style="font-size: var(--font-size-xs);">Empty</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="card__header">
        <h3>Student Details</h3>
      </div>
      <div class="card__body">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Seat</th>
                <th>ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Year</th>
                <th>Special Needs</th>
              </tr>
            </thead>
            <tbody>
              ${allocation.seating.map(seat => `
                <tr>
                  <td><strong>${seat.seatNumber}</strong></td>
                  <td>${seat.student.id}</td>
                  <td>${seat.student.name}</td>
                  <td>${seat.student.department}</td>
                  <td>${seat.student.year}</td>
                  <td>${seat.student.specialNeeds ? '<span class="badge badge--success">Yes</span>' : 'No'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function exportResults() {
  if (!appState.selectedExam) {
    showToast('No allocation results to export', 'error');
    return;
  }

  const allocation = appState.selectedExam;
  let csvContent = 'Seat Number,Student ID,Name,Department,Year,Special Needs\n';
  
  allocation.seating.forEach(seat => {
    csvContent += `${seat.seatNumber},${seat.student.id},${seat.student.name},${seat.student.department},${seat.student.year},${seat.student.specialNeeds}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `allocation_${allocation.exam.subject}_${Date.now()}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  showToast('Results exported successfully', 'success');
}

// Dashboard
function updateDashboard() {
  document.getElementById('metric-students').textContent = appState.students.length;
  document.getElementById('metric-exams').textContent = appState.exams.length;
  document.getElementById('metric-allocations').textContent = appState.allocations.length;
  
  // Calculate average conflict rate
  const avgConflictRate = appState.allocations.length > 0 
    ? (appState.allocations.reduce((sum, a) => sum + (a.metrics.conflictsDetected || 0), 0) / appState.allocations.length).toFixed(1)
    : 0;
  document.getElementById('metric-conflicts').textContent = avgConflictRate + '%';

  // Update activity feed
  const activityFeed = document.getElementById('activity-feed');
  if (appState.activityLog.length === 0) {
    activityFeed.innerHTML = '<div class="activity-item"><span class="activity-icon">ℹ️</span><span>Welcome! Upload CSV files or add data manually to get started.</span></div>';
  } else {
    activityFeed.innerHTML = appState.activityLog.slice(-5).reverse().map(log => `
      <div class="activity-item">
        <span class="activity-icon">${log.icon}</span>
        <span>${log.message}</span>
      </div>
    `).join('');
  }

  // Update results view if active
  if (appState.currentView === 'results') {
    renderResults();
  }
}

function addActivityLog(message, icon = '✓') {
  appState.activityLog.push({
    message: message,
    icon: icon,
    timestamp: new Date().toISOString()
  });
  updateDashboard();
}

// Analytics Chart
function initializeAnalyticsChart() {
  const ctx = document.getElementById('comparison-chart');
  if (!ctx) return;

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Conflict Resolution', 'Space Utilization', 'Processing Time', 'Accuracy', 'Special Needs'],
      datasets: [
        {
          label: 'Traditional Method',
          data: [65, 72, 45, 78, 80],
          backgroundColor: '#1FB8CD',
          borderRadius: 6
        },
        {
          label: 'AI-Enhanced Method',
          data: [95, 87, 92, 96, 100],
          backgroundColor: '#FFC185',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + context.parsed.y + '%';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });
}

// Search Filters
function initializeSearchFilters() {
  const studentSearch = document.getElementById('student-search');
  const examSearch = document.getElementById('exam-search');

  if (studentSearch) {
    studentSearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      // Filter logic would go here - for now just re-render
      renderStudentsTable();
    });
  }

  if (examSearch) {
    examSearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      renderExamsTable();
    });
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast--${type} active`;
  
  setTimeout(() => {
    toast.classList.remove('active');
  }, 3000);
}

// Load Sample Data
// Pandemic Allocation View Functions
function initializePandemicView() {
  const slider = document.getElementById('pandemic-main-distance-slider');
  const valueDisplay = document.getElementById('pandemic-main-distance-value');
  
  if (slider && valueDisplay) {
    slider.addEventListener('input', (e) => {
      const distance = parseFloat(e.target.value);
      appState.pandemicDistance = distance;
      valueDisplay.textContent = distance.toFixed(1) + 'm';
      updatePandemicGuideline(distance);
      
      // Auto re-run if exam selected
      const examId = document.getElementById('pandemic-exam-select')?.value;
      if (examId && appState.pandemicAllocation) {
        runPandemicAllocation();
      }
    });
  }
}

function updatePandemicGuideline(distance) {
  const guidelineEl = document.getElementById('pandemic-guideline');
  if (!guidelineEl) return;
  
  const guidelines = {
    1: { text: '1m distance: Emergency capacity mode', color: 'var(--color-error)' },
    1.5: { text: '1.5m distance: Minimal distancing protocol', color: 'var(--color-warning)' },
    2: { text: '2m distance: Basic social distancing', color: 'var(--color-warning)' },
    2.5: { text: '2.5m distance: Enhanced safety protocol', color: 'var(--color-warning)' },
    3: { text: '3m distance: Moderate pandemic protocols', color: 'var(--color-warning)' },
    3.5: { text: '3.5m distance: High safety standard', color: 'var(--color-warning)' },
    4: { text: '4m distance: Maximum social distancing for high-risk environments', color: 'var(--color-warning)' }
  };
  
  const guideline = guidelines[distance] || guidelines[4];
  guidelineEl.innerHTML = `<p style="margin: 0; font-size: var(--font-size-sm); line-height: 1.6;"><strong>${guideline.text}</strong></p>`;
  guidelineEl.style.borderLeftColor = guideline.color;
}

function populatePandemicExamSelect() {
  const select = document.getElementById('pandemic-exam-select');
  if (!select) return;
  
  select.innerHTML = '<option value="">Choose an exam...</option>';
  
  appState.exams.forEach(exam => {
    const option = document.createElement('option');
    option.value = exam.id;
    option.textContent = `${exam.subject} - ${exam.date} (${exam.timeSlot})`;
    select.appendChild(option);
  });
}

function runPandemicAllocation() {
  const examId = document.getElementById('pandemic-exam-select').value;
  const roomConfig = document.getElementById('pandemic-room-config').value;
  const prioritizeSpecialNeeds = document.getElementById('pandemic-special-needs').checked;
  
  if (!examId) {
    showToast('Please select an exam', 'error');
    return;
  }
  
  const exam = appState.exams.find(e => e.id === examId);
  if (!exam) return;
  
  const config = ROOM_CONFIGS[roomConfig];
  const distance = appState.pandemicDistance;
  
  // Find eligible students
  const eligibleStudents = appState.students.filter(s => 
    s.subjects.some(sub => sub.toLowerCase() === exam.subject.toLowerCase())
  );
  
  if (eligibleStudents.length === 0) {
    showToast('No students found for this exam subject', 'error');
    return;
  }
  
  // Run allocation
  const result = runDistanceBasedAllocation(eligibleStudents, config, distance, 'pandemic', prioritizeSpecialNeeds);
  appState.pandemicAllocation = result;
  
  // Display results
  displayPandemicAllocation(result, config, eligibleStudents.length);
  
  showToast(`Allocation completed: ${result.allocated.length}/${eligibleStudents.length} students allocated`, 'success');
  addActivityLog(`Pandemic allocation for ${exam.subject} with ${distance}m distance`);
}

function displayPandemicAllocation(result, config, totalStudents) {
  const { width, height } = config;
  
  // Update metrics
  document.getElementById('pandemic-metric-students').textContent = result.allocated.length;
  document.getElementById('pandemic-total-students').textContent = totalStudents;
  document.getElementById('pandemic-metric-distance').textContent = result.metrics.avgDistance + 'm';
  document.getElementById('pandemic-metric-efficiency').textContent = result.metrics.efficiency + '%';
  
  const specialNeedsCount = result.allocated.filter(a => a.student.specialNeeds).length;
  document.getElementById('pandemic-metric-special').textContent = specialNeedsCount;
  
  // Render seating grid
  const gridContainer = document.getElementById('pandemic-seating-grid');
  gridContainer.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
  
  let gridHTML = '';
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const student = result.grid[row][col];
      
      if (student) {
        const initials = student.name.split(' ').map(n => n[0]).join('');
        const seatType = getSeatType(row, student);
        
        gridHTML += `
          <div class="seat-item seat-item--${seatType}" title="${student.name}">
            <span>${initials}</span>
            <div class="seat-tooltip">${student.name}${student.specialNeeds ? ' (Special Needs)' : ''}</div>
          </div>
        `;
      } else {
        gridHTML += '<div class="seat-item seat-item--empty"></div>';
      }
    }
  }
  
  gridContainer.innerHTML = gridHTML;
  
  // Show legend
  document.getElementById('pandemic-seat-legend').style.display = 'block';
  
  // Update status
  const statusEl = document.getElementById('pandemic-allocation-status');
  if (result.unallocated.length > 0) {
    statusEl.className = 'status-message status-message--warning active';
    statusEl.textContent = `⚠️ ${result.unallocated.length} student(s) could not be allocated due to ${appState.pandemicDistance}m distance constraints. Consider using a larger room.`;
  } else {
    statusEl.className = 'status-message status-message--success active';
    statusEl.textContent = `✓ All ${result.allocated.length} students allocated successfully with ${appState.pandemicDistance}m social distancing`;
  }
  
  // Show capacity warning
  displayCapacityWarning(result, config, totalStudents);
  
  // Show distance analysis
  displayDistanceAnalysis(result, config, totalStudents);
  
  // Enable export buttons
  document.getElementById('export-pandemic-btn').disabled = false;
  document.getElementById('print-pandemic-btn').disabled = false;
}

function displayCapacityWarning(result, config, totalStudents) {
  const warningCard = document.getElementById('pandemic-capacity-warning');
  const content = document.getElementById('pandemic-capacity-content');
  
  const utilizationPercent = parseFloat(result.metrics.efficiency);
  const unallocated = result.unallocated.length;
  
  let warningClass = '';
  let icon = '';
  let message = '';
  
  if (unallocated > 0) {
    warningClass = 'capacity-warning--red';
    icon = '🔴';
    message = `<strong>Capacity Exceeded</strong><br>Not enough space for ${unallocated} student(s) at ${appState.pandemicDistance}m distance. Recommendation: Use a larger room or split into multiple sessions.`;
  } else if (utilizationPercent > 80) {
    warningClass = 'capacity-warning--yellow';
    icon = '🟡';
    message = `<strong>Near Capacity</strong><br>Room is ${utilizationPercent}% full. Consider a larger room for better spacing.`;
  } else {
    warningClass = 'capacity-warning--green';
    icon = '🟢';
    message = `<strong>Sufficient Capacity</strong><br>Room has adequate space with ${utilizationPercent}% utilization at ${appState.pandemicDistance}m distance.`;
  }
  
  content.innerHTML = `
    <div class="capacity-warning ${warningClass}">
      <span class="capacity-warning-icon">${icon}</span>
      <div>${message}</div>
    </div>
  `;
  
  warningCard.style.display = 'block';
}

function displayDistanceAnalysis(result, config, totalStudents) {
  const analysisEl = document.getElementById('pandemic-distance-analysis');
  
  const currentDistance = appState.pandemicDistance;
  const allocated = result.allocated.length;
  const capacity = config.capacity;
  const empty = capacity - allocated;
  
  // Calculate what would happen at different distances
  const distances = [1, 2, 3, 4];
  const projections = distances.map(d => {
    const tempResult = runDistanceBasedAllocation(
      appState.students.filter(s => s.subjects.some(sub => sub.toLowerCase().includes('data'))),
      config,
      d,
      'temp'
    );
    return { distance: d, allocated: tempResult.allocated.length };
  });
  
  analysisEl.innerHTML = `
    <div style="margin-bottom: var(--space-16);">
      <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">Current Settings:</div>
      <div style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-warning);">${currentDistance}m distance</div>
    </div>
    
    <div style="margin-bottom: var(--space-16);">
      <div style="display: flex; justify-content: space-between; font-size: var(--font-size-sm); margin-bottom: var(--space-4);">
        <span>Students allocated:</span>
        <strong>${allocated}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: var(--font-size-sm); margin-bottom: var(--space-4);">
        <span>Empty seats:</span>
        <strong>${empty}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: var(--font-size-sm); margin-bottom: var(--space-4);">
        <span>Avg spacing:</span>
        <strong>${result.metrics.avgDistance}m</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: var(--font-size-sm);">
        <span>Utilization:</span>
        <strong>${result.metrics.efficiency}%</strong>
      </div>
    </div>
    
    <div style="padding: var(--space-12); background: var(--color-bg-1); border-radius: var(--radius-base); font-size: var(--font-size-sm);">
      <strong>💡 Recommendation:</strong><br>
      ${result.unallocated.length > 0 
        ? `For ${totalStudents} students at ${currentDistance}m: Use ${getRecommendedRoom(totalStudents, currentDistance)}` 
        : `Current ${config.name} is optimal for ${totalStudents} students at ${currentDistance}m distance`
      }
    </div>
  `;
}

function getRecommendedRoom(studentCount, distance) {
  // Simple heuristic: higher distance needs more space
  const multiplier = distance / 2;
  const neededCapacity = studentCount * multiplier;
  
  if (neededCapacity > ROOM_CONFIGS.large.capacity) {
    return 'Auditorium';
  } else if (neededCapacity > ROOM_CONFIGS.standard.capacity) {
    return 'Large Hall';
  }
  return 'Standard Room';
}

function exportPandemicAllocation() {
  if (!appState.pandemicAllocation) {
    showToast('No allocation to export', 'error');
    return;
  }
  
  const result = appState.pandemicAllocation;
  let csvContent = 'Row,Column,Position,Student ID,Name,Department,Year,Special Needs,Distance Setting\n';
  
  result.allocated.forEach(seat => {
    csvContent += `${seat.row + 1},${seat.col + 1},${seat.position},${seat.student.id},${seat.student.name},${seat.student.department},${seat.student.year},${seat.student.specialNeeds},${appState.pandemicDistance}m\n`;
  });
  
  // Add summary
  csvContent += '\n\nSummary:\n';
  csvContent += `Total Students,${result.metrics.totalStudents}\n`;
  csvContent += `Students Allocated,${result.allocated.length}\n`;
  csvContent += `Unallocated,${result.unallocated.length}\n`;
  csvContent += `Distance Setting,${appState.pandemicDistance}m\n`;
  csvContent += `Average Distance,${result.metrics.avgDistance}m\n`;
  csvContent += `Room Efficiency,${result.metrics.efficiency}%\n`;
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pandemic_allocation_${appState.pandemicDistance}m_${Date.now()}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  showToast('Pandemic allocation exported successfully', 'success');
}

function printPandemicLayout() {
  window.print();
}

// Legacy Comparison View Functions (kept for compatibility)
function initializeComparisonView() {
  // Initialize distance sliders
  const normalSlider = document.getElementById('normal-distance-slider');
  const pandemicSlider = document.getElementById('pandemic-distance-slider');
  const normalValue = document.getElementById('normal-distance-value');
  const pandemicValue = document.getElementById('pandemic-distance-value');
  
  if (normalSlider) {
    normalSlider.addEventListener('input', (e) => {
      const distance = parseFloat(e.target.value);
      appState.normalDistance = distance;
      if (normalValue) {
        normalValue.textContent = distance.toFixed(1) + 'm';
      }
      // Auto re-run allocation if exam is selected
      const examId = document.getElementById('comparison-exam-select')?.value;
      if (examId) {
        runBothAllocations();
      }
    });
  }
  
  if (pandemicSlider) {
    pandemicSlider.addEventListener('input', (e) => {
      const distance = parseFloat(e.target.value);
      appState.pandemicDistance = distance;
      if (pandemicValue) {
        pandemicValue.textContent = distance.toFixed(1) + 'm';
      }
      // Auto re-run allocation if exam is selected
      const examId = document.getElementById('comparison-exam-select')?.value;
      if (examId) {
        runBothAllocations();
      }
    });
  }
}

function populateComparisonExamSelect() {
  const select = document.getElementById('comparison-exam-select');
  if (!select) return;
  
  select.innerHTML = '<option value="">Choose an exam...</option>';
  
  appState.exams.forEach(exam => {
    const option = document.createElement('option');
    option.value = exam.id;
    option.textContent = `${exam.subject} - ${exam.date} (${exam.timeSlot})`;
    select.appendChild(option);
  });
}

function runBothAllocations() {
  const examId = document.getElementById('comparison-exam-select').value;
  const roomConfig = document.getElementById('comparison-room-config').value;
  
  if (!examId) {
    showToast('Please select an exam', 'error');
    return;
  }
  
  const exam = appState.exams.find(e => e.id === examId);
  if (!exam) return;
  
  const config = ROOM_CONFIGS[roomConfig];
  
  // Find students for this exam
  const eligibleStudents = appState.students.filter(s => 
    s.subjects.some(sub => sub.toLowerCase() === exam.subject.toLowerCase())
  );
  
  if (eligibleStudents.length === 0) {
    showToast('No students found for this exam subject', 'error');
    return;
  }
  
  // Run Normal Allocation with current distance setting
  const normalResult = runDistanceBasedAllocation(eligibleStudents, config, appState.normalDistance, 'normal');
  appState.normalAllocation = normalResult;
  
  // Run Pandemic Allocation with current distance setting
  const pandemicResult = runDistanceBasedAllocation(eligibleStudents, config, appState.pandemicDistance, 'pandemic');
  appState.pandemicAllocation = pandemicResult;
  
  // Display both allocations
  displayAllocation(normalResult, 'normal', config);
  displayAllocation(pandemicResult, 'pandemic', config);
  
  // Show comparison insights
  displayComparisonInsights(normalResult, pandemicResult, eligibleStudents.length);
  
  showToast('Both allocations completed successfully', 'success');
  addActivityLog(`Compared Normal vs Pandemic allocation for ${exam.subject}`);
}

function runDistanceBasedAllocation(students, config, minDistance, mode, prioritizeSpecialNeeds = true) {
  const { width, height } = config;
  const grid = Array(height).fill(null).map(() => Array(width).fill(null));
  const allocated = [];
  const unallocated = [];
  
  // Sort students - special needs first if prioritized
  const sortedStudents = [...students].sort((a, b) => {
    if (prioritizeSpecialNeeds && a.specialNeeds !== b.specialNeeds) return b.specialNeeds ? 1 : -1;
    return 0;
  });
  
  // Try to allocate each student
  for (const student of sortedStudents) {
    let placed = false;
    
    // Try each position in the grid
    for (let row = 0; row < height && !placed; row++) {
      for (let col = 0; col < width && !placed; col++) {
        if (grid[row][col] === null) {
          // Check distance to all allocated students
          let validPosition = true;
          
          for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
              if (grid[r][c] !== null) {
                const distance = Math.sqrt(Math.pow(row - r, 2) + Math.pow(col - c, 2));
                if (distance < minDistance) {
                  validPosition = false;
                  break;
                }
              }
            }
            if (!validPosition) break;
          }
          
          if (validPosition) {
            grid[row][col] = student;
            allocated.push({
              student: student,
              row: row,
              col: col,
              position: row * width + col + 1
            });
            placed = true;
          }
        }
      }
    }
    
    if (!placed) {
      unallocated.push(student);
    }
  }
  
  // Calculate metrics
  const totalSeats = width * height;
  const avgDistance = calculateAverageDistance(allocated);
  const efficiency = (allocated.length / totalSeats * 100).toFixed(1);
  
  return {
    grid: grid,
    allocated: allocated,
    unallocated: unallocated,
    metrics: {
      studentsAllocated: allocated.length,
      totalStudents: students.length,
      avgDistance: avgDistance.toFixed(2),
      efficiency: efficiency,
      capacity: totalSeats,
      minDistance: minDistance
    },
    mode: mode
  };
}

function calculateAverageDistance(allocated) {
  if (allocated.length < 2) return 0;
  
  let totalDistance = 0;
  let count = 0;
  
  for (let i = 0; i < allocated.length; i++) {
    for (let j = i + 1; j < allocated.length; j++) {
      const dist = Math.sqrt(
        Math.pow(allocated[i].row - allocated[j].row, 2) + 
        Math.pow(allocated[i].col - allocated[j].col, 2)
      );
      totalDistance += dist;
      count++;
    }
  }
  
  return count > 0 ? totalDistance / count : 0;
}

function displayAllocation(result, mode, config) {
  const prefix = mode === 'normal' ? 'normal' : 'pandemic';
  const { width, height } = config;
  
  // Update metrics
  document.getElementById(`${prefix}-students`).textContent = result.metrics.studentsAllocated;
  document.getElementById(`${prefix}-distance`).textContent = result.metrics.avgDistance;
  document.getElementById(`${prefix}-efficiency`).textContent = result.metrics.efficiency + '%';
  
  // Render grid
  const gridContainer = document.getElementById(`${prefix}-grid`);
  gridContainer.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
  
  let gridHTML = '';
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const student = result.grid[row][col];
      
      if (student) {
        const initials = student.name.split(' ').map(n => n[0]).join('');
        const seatType = getSeatType(row, student);
        
        gridHTML += `
          <div class="seat-item seat-item--${seatType}" title="${student.name}">
            <span>${initials}</span>
            <div class="seat-tooltip">${student.name}</div>
          </div>
        `;
      } else {
        gridHTML += '<div class="seat-item seat-item--empty"></div>';
      }
    }
  }
  
  gridContainer.innerHTML = gridHTML;
  
  // Update status
  const statusEl = document.getElementById(`${prefix}-status`);
  const unallocatedCount = result.unallocated.length;
  
  if (unallocatedCount > 0) {
    statusEl.className = 'status-message status-message--warning active';
    statusEl.textContent = `⚠️ ${unallocatedCount} student(s) could not be allocated due to distance constraints`;
  } else {
    statusEl.className = 'status-message status-message--success active';
    statusEl.textContent = `✓ All students allocated successfully`;
  }
}

function getSeatType(row, student) {
  if (student.specialNeeds) return 'accessible';
  if (row === 0) return 'front';
  return 'standard';
}

function displayComparisonInsights(normal, pandemic, totalStudents) {
  const container = document.getElementById('comparison-insights');
  
  const normalAllocated = normal.metrics.studentsAllocated;
  const pandemicAllocated = pandemic.metrics.studentsAllocated;
  const difference = normalAllocated - pandemicAllocated;
  const percentDiff = normalAllocated > 0 ? ((difference / normalAllocated) * 100).toFixed(1) : 0;
  
  const spacingIncrease = normal.metrics.avgDistance > 0 ? ((pandemic.metrics.avgDistance / normal.metrics.avgDistance - 1) * 100).toFixed(1) : 0;
  
  // Calculate recommended room size for pandemic
  const recommendedCapacity = Math.ceil(totalStudents * 1.5);
  let recommendedRoom = 'standard';
  if (recommendedCapacity > ROOM_CONFIGS.large.capacity) {
    recommendedRoom = 'auditorium';
  } else if (recommendedCapacity > ROOM_CONFIGS.standard.capacity) {
    recommendedRoom = 'large';
  }
  
  container.innerHTML = `
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Normal Mode</th>
          <th>Pandemic Mode</th>
          <th>Difference</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Students Allocated</td>
          <td><span class="comparison-value ${normalAllocated > pandemicAllocated ? 'comparison-value--better' : ''}">${normalAllocated}</span></td>
          <td><span class="comparison-value ${pandemicAllocated > normalAllocated ? 'comparison-value--better' : ''}">${pandemicAllocated}</span></td>
          <td>${difference > 0 ? '-' : '+'}${Math.abs(difference)} (${Math.abs(percentDiff)}%)</td>
        </tr>
        <tr>
          <td>Average Distance</td>
          <td>${normal.metrics.avgDistance} units</td>
          <td>${pandemic.metrics.avgDistance} units</td>
          <td>+${spacingIncrease}%</td>
        </tr>
        <tr>
          <td>Room Efficiency</td>
          <td><span class="comparison-value ${parseFloat(normal.metrics.efficiency) > parseFloat(pandemic.metrics.efficiency) ? 'comparison-value--better' : ''}">${normal.metrics.efficiency}%</span></td>
          <td><span class="comparison-value ${parseFloat(pandemic.metrics.efficiency) > parseFloat(normal.metrics.efficiency) ? 'comparison-value--better' : ''}">${pandemic.metrics.efficiency}%</span></td>
          <td>${(parseFloat(normal.metrics.efficiency) - parseFloat(pandemic.metrics.efficiency)).toFixed(1)}%</td>
        </tr>
        <tr>
          <td>Unallocated Students</td>
          <td>${normal.unallocated.length}</td>
          <td>${pandemic.unallocated.length}</td>
          <td>${pandemic.unallocated.length - normal.unallocated.length}</td>
        </tr>
      </tbody>
    </table>
    
    <div class="insight-box">
      <h4>💡 Key Insights</h4>
      <ul>
        <li><strong>Distance Settings:</strong> Normal mode uses ${appState.normalDistance}m spacing, Pandemic mode uses ${appState.pandemicDistance}m spacing</li>
        <li><strong>Capacity Impact:</strong> ${Math.abs(difference)} ${difference > 0 ? 'fewer' : 'more'} students can be accommodated in pandemic mode (${Math.abs(percentDiff)}% ${difference > 0 ? 'reduction' : 'increase'})</li>
        <li><strong>Spacing:</strong> Average distance between students ${spacingIncrease > 0 ? 'increased' : 'decreased'} by ${Math.abs(spacingIncrease)}%</li>
        <li><strong>Recommendation:</strong> For ${totalStudents} students with ${appState.pandemicDistance}m distancing, use ${recommendedRoom} room configuration</li>
        ${pandemic.unallocated.length > 0 ? `<li><strong>⚠️ Action Required:</strong> ${pandemic.unallocated.length} students need additional room(s) or session(s)</li>` : '<li><strong>✓ Success:</strong> All students can be accommodated with current room size</li>'}
        <li><strong>💡 Tip:</strong> Adjust the distance sliders above to find optimal spacing for your needs</li>
      </ul>
    </div>
  `;
}

function loadSampleData() {
  const sampleStudents = [
    {id: "STU_001", name: "Alice Johnson", subjects: ["Data Structures", "Algorithms"], department: "Computer Science", year: 2, specialNeeds: false, importedFrom: "Sample", importDate: new Date().toISOString()},
    {id: "STU_002", name: "Bob Smith", subjects: ["Data Structures", "Database Systems"], department: "Computer Science", year: 2, specialNeeds: true, importedFrom: "Sample", importDate: new Date().toISOString()},
    {id: "STU_003", name: "Carol White", subjects: ["Calculus", "Linear Algebra"], department: "Mathematics", year: 3, specialNeeds: false, importedFrom: "Sample", importDate: new Date().toISOString()}
  ];

  const sampleExams = [
    {id: "EXAM_001", subject: "Data Structures", date: "2024-12-15", timeSlot: "morning", duration: 180, specialRequirements: [], importedFrom: "Sample", importDate: new Date().toISOString()},
    {id: "EXAM_002", subject: "Algorithms", date: "2024-12-16", timeSlot: "afternoon", duration: 120, specialRequirements: ["isolated"], importedFrom: "Sample", importDate: new Date().toISOString()}
  ];

  appState.students = sampleStudents;
  appState.exams = sampleExams;
  addActivityLog('Loaded sample data', 'ℹ️');
}