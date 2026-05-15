require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./database');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── Health Check (before DB ready) ───────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── Boot: init DB then mount routes ──────────────────────────────────────────
initDb().then(() => {
  console.log('✅ Database ready');

  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/projects',  require('./routes/projects'));
  app.use('/api/projects/:id/tasks', require('./routes/tasks'));
  app.use('/api/tasks',     require('./routes/tasks'));
  app.use('/api/dashboard', require('./routes/dashboard'));

  // Catch-all: serve frontend
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
    } else {
      res.status(404).json({ error: 'Route not found' });
    }
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Team Task Manager → http://localhost:${PORT}`);
  });

}).catch(err => {
  console.error('❌ Failed to initialise database:', err);
  process.exit(1);
});
