const router = require('express').Router({ mergeParams: true });
const { db } = require('../database');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');

// GET /api/projects/:id/tasks
router.get('/', auth, requireRole('admin', 'member'), (req, res) => {
  const tasks = db.prepare(`
    SELECT t.*, u.name AS assigned_name, u.email AS assigned_email, c.name AS created_by_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.project_id = ?
    ORDER BY t.created_at DESC
  `).all(req.params.id);
  res.json({ tasks });
});

// POST /api/projects/:id/tasks
router.post('/', auth, requireRole('admin'), (req, res) => {
  const { title, description, due_date, priority, assigned_to } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title is required' });

  const validPriorities = ['low', 'medium', 'high'];
  if (priority && !validPriorities.includes(priority))
    return res.status(400).json({ error: 'Priority must be low, medium, or high' });

  if (assigned_to) {
    const isMember = db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(req.params.id, assigned_to);
    if (!isMember) return res.status(400).json({ error: 'Assignee must be a project member' });
  }

  const result = db.prepare(`
    INSERT INTO tasks (project_id, title, description, due_date, priority, assigned_to, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, title, description || '', due_date || null, priority || 'medium', assigned_to || null, req.user.id);

  const task = db.prepare(`
    SELECT t.*, u.name AS assigned_name, u.email AS assigned_email, c.name AS created_by_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to LEFT JOIN users c ON c.id = t.created_by
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ task });
});

// PUT /api/tasks/:taskId
router.put('/:taskId', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const member = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(task.project_id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member of this project' });

  const isAdmin    = member.role === 'admin';
  const isAssignee = String(task.assigned_to) === String(req.user.id);

  if (!isAdmin && !isAssignee)
    return res.status(403).json({ error: 'You can only update tasks assigned to you' });

  const validStatuses   = ['todo', 'in_progress', 'done'];
  const validPriorities = ['low', 'medium', 'high'];

  if (isAdmin) {
    const { title, description, due_date, priority, status, assigned_to } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (status   && !validStatuses.includes(status))     return res.status(400).json({ error: 'Invalid status' });
    if (priority && !validPriorities.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });

    db.prepare(`
      UPDATE tasks SET title=?, description=?, due_date=?, priority=?, status=?, assigned_to=? WHERE id=?
    `).run(
      title,
      description   ?? task.description,
      due_date      ?? task.due_date,
      priority      ?? task.priority,
      status        ?? task.status,
      assigned_to !== undefined ? (assigned_to || null) : task.assigned_to,
      req.params.taskId
    );
  } else {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Members can only update task status' });
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, req.params.taskId);
  }

  const updated = db.prepare(`
    SELECT t.*, u.name AS assigned_name, u.email AS assigned_email, c.name AS created_by_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to LEFT JOIN users c ON c.id = t.created_by
    WHERE t.id = ?
  `).get(req.params.taskId);

  res.json({ task: updated });
});

// DELETE /api/tasks/:taskId
router.delete('/:taskId', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const member = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(task.project_id, req.user.id);

  if (!member || member.role !== 'admin')
    return res.status(403).json({ error: 'Only admins can delete tasks' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.taskId);
  res.json({ message: 'Task deleted' });
});

module.exports = router;
