// Guard: redirect if not logged in
if (!localStorage.getItem('ttm_token')) window.location.href = '/';

const user = JSON.parse(localStorage.getItem('ttm_user') || '{}');

// ── DOM refs ──────────────────────────────────────────────────────────────────
const userNameEl      = document.getElementById('user-name');
const logoutBtn       = document.getElementById('logout-btn');
const projectList     = document.getElementById('project-list');
const createProjBtn   = document.getElementById('create-project-btn');
const projModal       = document.getElementById('project-modal');
const projForm        = document.getElementById('project-form');
const projModalClose  = document.getElementById('proj-modal-close');
const statTotal       = document.getElementById('stat-total');
const statProgress    = document.getElementById('stat-progress');
const statDone        = document.getElementById('stat-done');
const statOverdue     = document.getElementById('stat-overdue');
const chartCanvas     = document.getElementById('tasks-chart');
const recentList      = document.getElementById('recent-tasks-list');

userNameEl.textContent = user.name || 'User';

// ── Logout ────────────────────────────────────────────────────────────────────
logoutBtn.addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/';
});

// ── Modal ─────────────────────────────────────────────────────────────────────
createProjBtn.addEventListener('click', () => projModal.classList.add('open'));
projModalClose.addEventListener('click', () => projModal.classList.remove('open'));
projModal.addEventListener('click', (e) => { if (e.target === projModal) projModal.classList.remove('open'); });

projForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = projForm.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await api.createProject({
      name:        document.getElementById('proj-name').value.trim(),
      description: document.getElementById('proj-desc').value.trim(),
    });
    projModal.classList.remove('open');
    projForm.reset();
    loadAll();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
  }
});

// ── Load everything ───────────────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadDashboard(), loadProjects()]);
}

async function loadDashboard() {
  try {
    const data = await api.dashboard();
    statTotal.textContent    = data.total_tasks;
    statProgress.textContent = data.by_status.in_progress;
    statDone.textContent     = data.by_status.done;
    statOverdue.textContent  = data.overdue;
    renderChart(data.tasks_per_user);
    renderRecentTasks(data.recent_tasks);
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

async function loadProjects() {
  try {
    const data = await api.getProjects();
    renderProjects(data.projects);
  } catch (err) {
    console.error('Projects error:', err);
  }
}

// ── Render Projects ───────────────────────────────────────────────────────────
function renderProjects(projects) {
  if (!projects || projects.length === 0) {
    projectList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No projects yet. Create your first project!</p>
      </div>`;
    return;
  }

  projectList.innerHTML = projects.map(p => `
    <div class="project-card" onclick="window.location.href='/project.html?id=${p.id}'">
      <div class="project-card-header">
        <div class="project-avatar">${p.name.charAt(0).toUpperCase()}</div>
        <div class="project-badge ${p.my_role}">${p.my_role}</div>
      </div>
      <h3 class="project-name">${escHtml(p.name)}</h3>
      <p class="project-desc">${escHtml(p.description || 'No description')}</p>
      <div class="project-meta">
        <span>📌 ${p.task_count} tasks</span>
        <span>👥 ${p.member_count} members</span>
      </div>
    </div>
  `).join('');
}

// ── Render Recent Tasks ───────────────────────────────────────────────────────
function renderRecentTasks(tasks) {
  if (!tasks || tasks.length === 0) {
    recentList.innerHTML = '<p class="no-data">No recent tasks</p>';
    return;
  }
  recentList.innerHTML = tasks.map(t => `
    <div class="recent-task-item" onclick="window.location.href='/project.html?id=${t.project_id}'">
      <div class="recent-task-info">
        <span class="priority-dot ${t.priority}"></span>
        <span class="recent-task-title">${escHtml(t.title)}</span>
      </div>
      <div class="recent-task-meta">
        <span class="project-chip">${escHtml(t.project_name)}</span>
        <span class="status-chip ${t.status}">${statusLabel(t.status)}</span>
      </div>
    </div>
  `).join('');
}

// ── Bar Chart (Canvas API) ────────────────────────────────────────────────────
function renderChart(data) {
  const ctx = chartCanvas.getContext('2d');
  const W = chartCanvas.width  = chartCanvas.offsetWidth  || 400;
  const H = chartCanvas.height = chartCanvas.offsetHeight || 200;
  ctx.clearRect(0, 0, W, H);

  if (!data || data.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No task data yet', W / 2, H / 2);
    return;
  }

  const maxVal = Math.max(...data.map(d => d.task_count), 1);
  const barW   = Math.min(50, (W - 60) / data.length - 16);
  const gap    = (W - 60 - barW * data.length) / (data.length + 1);
  const colors = ['#6C63FF','#FF6584','#43C6AC','#F9A825','#EF5350','#42A5F5'];

  data.forEach((d, i) => {
    const barH   = ((d.task_count / maxVal) * (H - 70));
    const x      = 40 + gap + i * (barW + gap);
    const y      = H - 40 - barH;

    // Bar
    const grad = ctx.createLinearGradient(0, y, 0, H - 40);
    grad.addColorStop(0, colors[i % colors.length]);
    grad.addColorStop(1, colors[i % colors.length] + '66');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 6);
    ctx.fill();

    // Value label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.task_count, x + barW / 2, y - 6);

    // Name label
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px Inter, sans-serif';
    const shortName = d.name.length > 8 ? d.name.slice(0, 8) + '…' : d.name;
    ctx.fillText(shortName, x + barW / 2, H - 20);
  });

  // Y-axis line
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(38, 10);
  ctx.lineTo(38, H - 40);
  ctx.stroke();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function statusLabel(s) {
  return { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }[s] || s;
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadAll();
window.addEventListener('resize', () => { loadDashboard(); });
