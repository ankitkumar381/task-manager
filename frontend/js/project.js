// Guard
if (!localStorage.getItem('ttm_token')) window.location.href = '/';

const user      = JSON.parse(localStorage.getItem('ttm_user') || '{}');
const params    = new URLSearchParams(window.location.search);
const projectId = params.get('id');
if (!projectId) window.location.href = '/dashboard.html';

let myRole    = 'member';
let members   = [];
let allTasks  = [];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const projTitle     = document.getElementById('proj-title');
const projDesc      = document.getElementById('proj-desc-text');
const backBtn       = document.getElementById('back-btn');
const logoutBtn     = document.getElementById('logout-btn');
const userNameEl    = document.getElementById('user-name');
const addTaskBtn    = document.getElementById('add-task-btn');
const manageMembBtn = document.getElementById('manage-members-btn');
const adminOnlyEls  = document.querySelectorAll('.admin-only');

const taskModal       = document.getElementById('task-modal');
const taskForm        = document.getElementById('task-form');
const taskModalClose  = document.getElementById('task-modal-close');
const taskModalTitle  = document.getElementById('task-modal-title');

const memberModal      = document.getElementById('member-modal');
const memberForm       = document.getElementById('member-form');
const memberModalClose = document.getElementById('member-modal-close');
const membersList      = document.getElementById('members-list');

const colTodo       = document.getElementById('col-todo');
const colInProgress = document.getElementById('col-in-progress');
const colDone       = document.getElementById('col-done');

userNameEl.textContent = user.name || 'User';
backBtn.addEventListener('click', () => window.location.href = '/dashboard.html');
logoutBtn.addEventListener('click', () => { localStorage.clear(); window.location.href = '/'; });

// ── Load project ──────────────────────────────────────────────────────────────
async function loadProject() {
  try {
    const [projData, taskData] = await Promise.all([
      api.getProject(projectId),
      api.getTasks(projectId)
    ]);
    myRole  = projData.my_role;
    members = projData.members;
    allTasks = taskData.tasks;

    projTitle.textContent = projData.project.name;
    projDesc.textContent  = projData.project.description || 'No description';

    // Show/hide admin elements
    adminOnlyEls.forEach(el => el.classList.toggle('hidden', myRole !== 'admin'));

    renderBoard(allTasks);
    renderMembersList();
  } catch (err) {
    alert('Error loading project: ' + err.message);
    window.location.href = '/dashboard.html';
  }
}

// ── Kanban Board ──────────────────────────────────────────────────────────────
function renderBoard(tasks) {
  colTodo.innerHTML       = '';
  colInProgress.innerHTML = '';
  colDone.innerHTML       = '';

  const buckets = { todo: colTodo, in_progress: colInProgress, done: colDone };

  tasks.forEach(task => {
    const card = createTaskCard(task);
    buckets[task.status]?.appendChild(card);
  });

  // Show empty state if empty
  Object.entries(buckets).forEach(([status, col]) => {
    if (col.children.length === 0) {
      col.innerHTML = `<div class="empty-col">No tasks here</div>`;
    }
  });

  setupDragDrop();
}

function createTaskCard(task) {
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0] && task.status !== 'done';
  const canEdit   = myRole === 'admin' || task.assigned_to === user.id;

  const card = document.createElement('div');
  card.className = `task-card priority-${task.priority}${isOverdue ? ' overdue' : ''}`;
  card.dataset.id     = task.id;
  card.dataset.status = task.status;
  card.draggable = canEdit;

  card.innerHTML = `
    <div class="task-card-header">
      <span class="priority-badge ${task.priority}">${task.priority}</span>
      ${myRole === 'admin' ? `<button class="icon-btn delete-task-btn" data-id="${task.id}" title="Delete task">🗑️</button>` : ''}
    </div>
    <h4 class="task-title">${escHtml(task.title)}</h4>
    ${task.description ? `<p class="task-desc">${escHtml(task.description)}</p>` : ''}
    <div class="task-meta">
      ${task.due_date ? `<span class="due-date ${isOverdue ? 'overdue-text' : ''}">📅 ${task.due_date}</span>` : ''}
      ${task.assigned_name ? `<span class="assignee">👤 ${escHtml(task.assigned_name)}</span>` : '<span class="assignee unassigned">Unassigned</span>'}
    </div>
    ${canEdit ? `
    <div class="task-status-row">
      <select class="status-select" data-id="${task.id}">
        <option value="todo"        ${task.status === 'todo'        ? 'selected' : ''}>📋 To Do</option>
        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>⚡ In Progress</option>
        <option value="done"        ${task.status === 'done'        ? 'selected' : ''}>✅ Done</option>
      </select>
    </div>` : ''}
  `;

  // Status change
  card.querySelector('.status-select')?.addEventListener('change', async (e) => {
    try {
      await api.updateTask(task.id, { status: e.target.value });
      loadProject();
    } catch (err) { alert(err.message); }
  });

  // Delete task
  card.querySelector('.delete-task-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this task?')) return;
    try {
      await api.deleteTask(task.id);
      loadProject();
    } catch (err) { alert(err.message); }
  });

  // Edit on click (admin only)
  if (myRole === 'admin') {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-task-btn') || e.target.closest('.status-select')) return;
      openEditTaskModal(task);
    });
  }

  return card;
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────
function setupDragDrop() {
  document.querySelectorAll('.task-card[draggable=true]').forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  document.querySelectorAll('.kanban-col-body').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = col.closest('.kanban-col').dataset.status;
      try {
        await api.updateTask(taskId, { status: newStatus });
        loadProject();
      } catch (err) { alert(err.message); }
    });
  });
}

// ── Task Modal ────────────────────────────────────────────────────────────────
let editingTaskId = null;

addTaskBtn?.addEventListener('click', () => openTaskModal());
taskModalClose.addEventListener('click', () => taskModal.classList.remove('open'));
taskModal.addEventListener('click', e => { if (e.target === taskModal) taskModal.classList.remove('open'); });

function populateAssigneeSelect(selectedId = null) {
  const sel = document.getElementById('task-assignee');
  sel.innerHTML = '<option value="">— Unassigned —</option>' +
    members.map(m => `<option value="${m.id}" ${String(m.id) === String(selectedId) ? 'selected' : ''}>${escHtml(m.name)}</option>`).join('');
}

function openTaskModal(task = null) {
  editingTaskId = task ? task.id : null;
  taskModalTitle.textContent = task ? 'Edit Task' : 'New Task';
  document.getElementById('task-title').value       = task?.title       || '';
  document.getElementById('task-description').value = task?.description || '';
  document.getElementById('task-due-date').value    = task?.due_date    || '';
  document.getElementById('task-priority').value    = task?.priority    || 'medium';
  document.getElementById('task-status').value      = task?.status      || 'todo';
  populateAssigneeSelect(task?.assigned_to);
  taskModal.classList.add('open');
}

function openEditTaskModal(task) { openTaskModal(task); }

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = taskForm.querySelector('button[type=submit]');
  btn.disabled = true;

  const body = {
    title:       document.getElementById('task-title').value.trim(),
    description: document.getElementById('task-description').value.trim(),
    due_date:    document.getElementById('task-due-date').value || null,
    priority:    document.getElementById('task-priority').value,
    status:      document.getElementById('task-status').value,
    assigned_to: document.getElementById('task-assignee').value || null,
  };

  try {
    if (editingTaskId) {
      await api.updateTask(editingTaskId, body);
    } else {
      await api.createTask(projectId, body);
    }
    taskModal.classList.remove('open');
    taskForm.reset();
    loadProject();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

// ── Member Modal ──────────────────────────────────────────────────────────────
manageMembBtn?.addEventListener('click', () => { renderMembersList(); memberModal.classList.add('open'); });
memberModalClose.addEventListener('click', () => memberModal.classList.remove('open'));
memberModal.addEventListener('click', e => { if (e.target === memberModal) memberModal.classList.remove('open'); });

function renderMembersList() {
  membersList.innerHTML = members.map(m => `
    <div class="member-item">
      <div class="member-avatar">${m.name.charAt(0).toUpperCase()}</div>
      <div class="member-info">
        <span class="member-name">${escHtml(m.name)}</span>
        <span class="member-email">${escHtml(m.email)}</span>
      </div>
      <span class="member-role-badge ${m.role}">${m.role}</span>
      ${myRole === 'admin' && m.id !== user.id
        ? `<button class="icon-btn remove-member-btn" data-id="${m.id}">✕</button>`
        : ''}
    </div>
  `).join('');

  membersList.querySelectorAll('.remove-member-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this member?')) return;
      try {
        await api.removeMember(projectId, btn.dataset.id);
        loadProject();
        memberModal.classList.remove('open');
      } catch (err) { alert(err.message); }
    });
  });
}

memberForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = memberForm.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await api.addMember(projectId, {
      email: document.getElementById('member-email').value.trim(),
      role:  document.getElementById('member-role').value,
    });
    memberForm.reset();
    await loadProject();
    renderMembersList();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadProject();
