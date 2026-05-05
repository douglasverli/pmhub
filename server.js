const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const REQUESTED_DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
let DATA_DIR = REQUESTED_DATA_DIR;

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (err) {
  console.warn(`Could not use DATA_DIR "${DATA_DIR}". Falling back to local ./data folder.`);
  DATA_DIR = path.join(__dirname, "data");
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DATA_FILE = path.join(DATA_DIR, "pmhub-data.json");

app.use(express.json({ limit: "25mb" }));
app.use(express.static(__dirname));

function initials(name) {
  return String(name || "User").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
}

function defaultUsers() {
  return [
    { id: "admin", name: "Douglas F.", email: "admin@pmhub.com", password: "admin123", role: "Admin", color: "#6366F1", initials: "DF" }
  ];
}

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { workspace: defaultWorkspace(), projects: [], projectData: {}, users: defaultUsers() };
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return normalizeData(parsed);
  } catch (err) {
    console.error("Could not read data file:", err);
    return { workspace: defaultWorkspace(), projects: [], projectData: {}, users: defaultUsers() };
  }
}

function defaultWorkspace() {
  return { id: "team", name: "Team Workspace", mode: "team", createdAt: new Date().toISOString() };
}

function normalizeData(parsed) {
  const users = Array.isArray(parsed.users) && parsed.users.length ? parsed.users : defaultUsers();
  const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
  const projectData = parsed.projectData && typeof parsed.projectData === "object" ? parsed.projectData : {};
  const workspace = parsed.workspace && typeof parsed.workspace === "object" ? parsed.workspace : defaultWorkspace();

  const normalizedProjects = projects.map(p => ({
    ...p,
    workspaceId: p.workspaceId || workspace.id,
    members: Array.isArray(p.members) && p.members.length ? p.members : users.map(u => u.id),
    visibility: p.visibility || "team"
  }));

  return { workspace, users, projects: normalizedProjects, projectData };
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalizeData(data), null, 2));
}

function makeId(prefix = "p") {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function safeUser(user) {
  const { password, pwd, ...safe } = user;
  return safe;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "PMHub", dataFile: DATA_FILE });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/workspace", (req, res) => {
  const data = readData();
  res.json(data.workspace);
});

app.put("/api/workspace", (req, res) => {
  const data = readData();
  data.workspace = { ...data.workspace, ...req.body, id: data.workspace.id || "team" };
  writeData(data);
  res.json(data.workspace);
});

app.post("/api/login", (req, res) => {
  const data = readData();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || req.body.pwd || "");
  const user = data.users.find(u => String(u.email).toLowerCase() === email && (u.password === password || u.pwd === password));
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ success: true, user: safeUser(user), workspace: data.workspace });
});

app.get("/api/users", (req, res) => {
  const data = readData();
  res.json(data.users.map(safeUser));
});

app.post("/api/users", (req, res) => {
  const data = readData();
  const id = req.body.id || makeId("u");
  const name = String(req.body.name || "New User").trim() || "New User";
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || req.body.pwd || "changeme");
  const role = req.body.role || "Editor";
  if (!email) return res.status(400).json({ error: "Email is required" });
  if (data.users.some(u => String(u.email).toLowerCase() === email)) return res.status(409).json({ error: "User already exists" });
  const user = { id, name, email, password, role, color: req.body.color || "#6366F1", initials: req.body.initials || initials(name) };
  data.users.push(user);
  data.projects = data.projects.map(p => ({ ...p, members: Array.from(new Set([...(p.members || []), id])) }));
  writeData(data);
  res.json(safeUser(user));
});

app.get("/api/projects", (req, res) => {
  const data = readData();
  const userId = req.query.userId;
  const projects = userId
    ? data.projects.filter(p => p.visibility === "team" || (p.members || []).includes(userId))
    : data.projects;
  res.json(projects);
});

app.post("/api/projects", (req, res) => {
  const data = readData();
  const now = new Date().toISOString();
  const id = req.body.id || makeId("p");
  const name = (req.body.name || "New Project").trim() || "New Project";
  const tasks = Array.isArray(req.body.tasks) ? req.body.tasks : [];
  const members = Array.isArray(req.body.members) && req.body.members.length ? req.body.members : data.users.map(u => u.id);

  const project = {
    id,
    name,
    taskCount: tasks.length,
    createdAt: now,
    updatedAt: now,
    workspaceId: data.workspace.id,
    visibility: "team",
    members
  };

  data.projects = [project, ...data.projects.filter(p => p.id !== id)];
  data.projectData[id] = { name, tasks };
  writeData(data);
  res.json(project);
});

app.get("/api/projects/:id", (req, res) => {
  const data = readData();
  const id = req.params.id;
  const meta = data.projects.find(p => p.id === id);
  const saved = data.projectData[id];

  if (!meta && !saved) return res.status(404).json({ error: "Project not found" });

  res.json({
    id,
    name: saved?.name || meta?.name || "Untitled",
    tasks: Array.isArray(saved?.tasks) ? saved.tasks : [],
    members: meta?.members || data.users.map(u => u.id),
    visibility: meta?.visibility || "team",
    updatedAt: meta?.updatedAt
  });
});

app.put("/api/projects/:id", (req, res) => {
  const data = readData();
  const id = req.params.id;
  const now = new Date().toISOString();
  const name = (req.body.name || "Untitled").trim() || "Untitled";
  const tasks = Array.isArray(req.body.tasks) ? req.body.tasks : [];

  const existing = data.projects.find(p => p.id === id);
  const meta = {
    id,
    name,
    taskCount: tasks.length,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    workspaceId: existing?.workspaceId || data.workspace.id,
    visibility: existing?.visibility || "team",
    members: Array.isArray(req.body.members) && req.body.members.length ? req.body.members : (existing?.members || data.users.map(u => u.id))
  };

  data.projects = [meta, ...data.projects.filter(p => p.id !== id)];
  data.projectData[id] = { name, tasks };
  writeData(data);
  res.json(meta);
});

app.put("/api/projects/:id/members", (req, res) => {
  const data = readData();
  const id = req.params.id;
  const project = data.projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  project.members = Array.isArray(req.body.members) ? req.body.members : project.members || [];
  project.updatedAt = new Date().toISOString();
  writeData(data);
  res.json(project);
});

app.delete("/api/projects/:id", (req, res) => {
  const data = readData();
  const id = req.params.id;
  data.projects = data.projects.filter(p => p.id !== id);
  delete data.projectData[id];
  writeData(data);
  res.json({ success: true });
});


app.post("/api/projects/:id/invite", (req, res) => {
  const data = readData();
  const id = req.params.id;
  const project = data.projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const email = String(req.body.email || "").trim().toLowerCase();
  const role = req.body.role || "Editor";
  if (!email) return res.status(400).json({ error: "Email is required" });

  let user = data.users.find(u => String(u.email).toLowerCase() === email);
  const tempPassword = req.body.password || "changeme";
  if (!user) {
    user = {
      id: makeId("u"),
      name: req.body.name || email.split("@")[0],
      email,
      password: tempPassword,
      role,
      color: "#6366F1",
      initials: initials(req.body.name || email)
    };
    data.users.push(user);
  }

  project.members = Array.from(new Set([...(project.members || []), user.id]));
  project.updatedAt = new Date().toISOString();
  writeData(data);

  res.json({
    success: true,
    projectId: id,
    user: safeUser(user),
    inviteUrl: `${req.headers["x-forwarded-proto"] || req.protocol}://${req.get("host")}/?project=${id}`,
    tempPassword: user.password === tempPassword ? tempPassword : undefined
  });
});

app.get("/api/projects/:id/activity", (req, res) => {
  const data = readData();
  const saved = data.projectData[req.params.id];
  const tasks = Array.isArray(saved?.tasks) ? saved.tasks : [];
  res.json(tasks.slice(-20).map(t => ({
    taskId: t.id,
    task: t.name,
    status: t.status,
    owners: t.owners || t.assignees || [],
    updatedAt: t.updatedAt || null
  })));
});


app.listen(PORT, () => {
  console.log(`Project Management Hub running at http://localhost:${PORT}`);
});
