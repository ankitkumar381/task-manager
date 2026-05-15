const { db } = require('../database');

module.exports = function requireRole(...roles) {
  return (req, res, next) => {
    const projectId = req.params.id || req.params.projectId;
    if (!projectId) return res.status(400).json({ error: 'Project id missing' });

    const member = db.prepare(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, req.user.id);

    if (!member) return res.status(403).json({ error: 'Not a member of this project' });
    if (!roles.includes(member.role))
      return res.status(403).json({ error: 'Insufficient permissions' });

    req.projectRole = member.role;
    next();
  };
};
