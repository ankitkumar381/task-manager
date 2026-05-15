const router = require('express').Router();
const { db } = require('../database');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');

// GET /api/projects
router.get('/', auth, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, pm.role as my_role,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
      (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id) as member_count
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    ORDER BY p.created_at DESC
  `).all(req.user.id);
  res.json({ projects });
});

// POST /api/projects
router.post('/', auth, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const insert = db.transaction(() => {
    const proj = db.prepare('INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(proj.lastInsertRowid, req.user.id, 'admin');
    return proj.lastInsertRowid;
  });
  const id = insert();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json({ project, my_role: 'admin' });
});

// GET /api/projects/:id
router.get('/:id', auth, requireRole('admin', 'member'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, pm.role FROM project_members pm
    JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?
  `).all(req.params.id);
  res.json({ project, members, my_role: req.projectRole });
});

// PUT /api/projects/:id
router.put('/:id', auth, requireRole('admin'), (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });
  db.prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?').run(name, description || '', req.params.id);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ project });
});

// DELETE /api/projects/:id
router.delete('/:id', auth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ message: 'Project deleted' });
});

// POST /api/projects/:id/members
router.post('/:id/members', auth, requireRole('admin'), (req, res) => {
  const { email, role = 'member' } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Role must be admin or member' });
  const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'User not found. Ask them to sign up first.' });
  const existing = db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, user.id);
  if (existing) return res.status(409).json({ error: 'User is already a member' });
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, user.id, role);
  res.status(201).json({ message: 'Member added', user, role });
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', auth, requireRole('admin'), (req, res) => {
  if (String(req.user.id) === String(req.params.userId))
    return res.status(400).json({ error: 'You cannot remove yourself' });
  const result = db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Member not found' });
  res.json({ message: 'Member removed' });
});

// GET /api/projects/:id/members
router.get('/:id/members', auth, requireRole('admin', 'member'), (req, res) => {
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, pm.role FROM project_members pm
    JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ?
  `).all(req.params.id);
  res.json({ members });
});

module.exports = router;
