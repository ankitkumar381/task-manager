# Team Task Manager

A full-stack collaborative task management web application built with Node.js, Express, SQLite, and Vanilla JavaScript.

## 🚀 Live Demo
> Deployed on Railway – https://task-manager-production-d505.up.railway.app/

## ✨ Features
- **JWT Authentication** – Signup / Login with bcrypt-hashed passwords
- **Project Management** – Create projects, add/remove members
- **Role-Based Access** – Admin (full control) vs Member (status updates only)
- **Task Management** – Create tasks with title, description, due date, priority, assignee
- **Kanban Board** – Drag-and-drop task cards across To Do / In Progress / Done
- **Dashboard** – Stats, bar chart (tasks per user), overdue tracking, recent tasks

## 🛠 Tech Stack
| Layer | Tech |
|-------|------|
| Backend | Node.js + Express.js |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcryptjs |
| Frontend | HTML + CSS + Vanilla JS |
| Deployment | Railway |

## 📁 Project Structure
```
team-task-manager/
├── backend/
│   ├── server.js          # Express app entry point
│   ├── database.js        # SQLite schema & connection
│   ├── middleware/
│   │   ├── auth.js        # JWT verification
│   │   └── role.js        # Role-based access control
│   └── routes/
│       ├── auth.js        # POST /api/auth/signup|login, GET /api/auth/me
│       ├── projects.js    # CRUD + member management
│       ├── tasks.js       # Task CRUD with role rules
│       └── dashboard.js   # Aggregated stats
├── frontend/
│   ├── index.html         # Login / Signup
│   ├── dashboard.html     # Main dashboard
│   ├── project.html       # Kanban board
│   ├── css/style.css
│   └── js/
│       ├── api.js         # Centralized API client
│       ├── auth.js
│       ├── dashboard.js
│       └── project.js
├── railway.toml
└── README.md
```

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |

### Projects
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | `/api/projects` | ✅ | Any |
| POST | `/api/projects` | ✅ | Any |
| GET | `/api/projects/:id` | ✅ | Member+ |
| PUT | `/api/projects/:id` | ✅ | Admin |
| DELETE | `/api/projects/:id` | ✅ | Admin |
| POST | `/api/projects/:id/members` | ✅ | Admin |
| DELETE | `/api/projects/:id/members/:userId` | ✅ | Admin |

### Tasks
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| GET | `/api/projects/:id/tasks` | ✅ | Member+ |
| POST | `/api/projects/:id/tasks` | ✅ | Admin |
| PUT | `/api/tasks/:taskId` | ✅ | Admin (all) / Member (status) |
| DELETE | `/api/tasks/:taskId` | ✅ | Admin |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Aggregated stats |

## 👤 Role Permissions
| Action | Admin | Member |
|--------|-------|--------|
| Create/delete tasks | ✅ | ❌ |
| Update all task fields | ✅ | ❌ |
| Update task status | ✅ | ✅ (assigned only) |
| Add/remove members | ✅ | ❌ |
| Delete project | ✅ | ❌ |
