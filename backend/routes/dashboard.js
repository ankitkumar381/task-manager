const router = require('express').Router();
const { db } = require('../database');
const auth = require('../middleware/auth');

// GET /api/dashboard
router.get('/', auth, (req, res) => {
  const userId = req.user.id;
  const today  = new Date().toISOString().split('T')[0];

  const myProjectIds = db.prepare(
    'SELECT project_id FROM project_members WHERE user_id = ?'
  ).all(userId).map(r => r.project_id);

  if (myProjectIds.length === 0) {
    return res.json({
      total_tasks: 0,
      by_status: { todo: 0, in_progress: 0, done: 0 },
      overdue: 0,
      tasks_per_user: [],
      my_projects: 0,
      recent_tasks: []
    });
  }

  const ph = myProjectIds.map(() => '?').join(',');

  const total_tasks = db.prepare(
    `SELECT COUNT(*) as c FROM tasks WHERE project_id IN (${ph})`
  ).get(...myProjectIds).c;

  const statusRows = db.prepare(
    `SELECT status, COUNT(*) as c FROM tasks WHERE project_id IN (${ph}) GROUP BY status`
  ).all(...myProjectIds);
  const by_status = { todo: 0, in_progress: 0, done: 0 };
  statusRows.forEach(r => { by_status[r.status] = r.c; });

  const overdue = db.prepare(
    `SELECT COUNT(*) as c FROM tasks WHERE project_id IN (${ph}) AND due_date < ? AND status != 'done'`
  ).get(...myProjectIds, today).c;

  const tasks_per_user = db.prepare(`
    SELECT u.name, COUNT(t.id) as task_count FROM tasks t
    JOIN users u ON u.id = t.assigned_to
    WHERE t.project_id IN (${ph}) AND t.assigned_to IS NOT NULL
    GROUP BY t.assigned_to ORDER BY task_count DESC LIMIT 10
  `).all(...myProjectIds);

  const recent_tasks = db.prepare(`
    SELECT t.*, p.name as project_name, u.name as assigned_name FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.project_id IN (${ph})
    ORDER BY t.created_at DESC LIMIT 5
  `).all(...myProjectIds);

  res.json({
    total_tasks,
    by_status,
    overdue,
    tasks_per_user,
    my_projects: myProjectIds.length,
    recent_tasks
  });
});

module.exports = router;
