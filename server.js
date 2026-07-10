const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const dataFile = path.join(root, "data", "site.json");
const authFile = process.env.ADMIN_AUTH_FILE
  ? path.resolve(process.env.ADMIN_AUTH_FILE)
  : path.join(root, ".admin-auth.json");
const port = Number(process.env.PORT || 5173);
const sessions = new Map();
const sessionTtlMs = 8 * 60 * 60 * 1000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".csv": "text/csv; charset=utf-8"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 80 * 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function getPathname(req) {
  return new URL(req.url, `http://localhost:${port}`).pathname;
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = 210000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return { salt, iterations, hash, createdAt: new Date().toISOString() };
}

function readPasswordRecord() {
  if (!fs.existsSync(authFile)) return null;
  return safeJsonParse(fs.readFileSync(authFile, "utf8"));
}

function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash || !record?.iterations) return false;
  const actual = crypto.pbkdf2Sync(password, record.salt, record.iterations, 32, "sha256");
  const expected = Buffer.from(record.hash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + sessionTtlMs);
  return token;
}

function getBearerToken(req) {
  const value = req.headers.authorization || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function isAuthorized(req) {
  const token = getBearerToken(req);
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  sessions.set(token, Date.now() + sessionTtlMs);
  return true;
}

function requireAdmin(req, res) {
  if (isAuthorized(req)) return true;
  send(res, 401, JSON.stringify({ error: "Admin login required." }));
  return false;
}

function backupDataFile() {
  if (!fs.existsSync(dataFile)) return;
  const backupDir = path.join(root, "data", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(dataFile, path.join(backupDir, `site-${stamp}.json`));
}

function writeSiteData(siteData) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  backupDataFile();
  fs.writeFileSync(dataFile, `${JSON.stringify(siteData, null, 2)}\n`, "utf8");
}

function sanitizeFileName(name) {
  const ext = path.extname(name || "");
  const base = path.basename(name || "file", ext).replace(/[^\w\u4e00-\u9fa5.-]+/g, "-");
  return `${base || "file"}-${crypto.randomBytes(4).toString("hex")}${ext || ""}`;
}

async function handleApi(req, res) {
  const pathname = getPathname(req);

  if (req.method === "GET" && pathname === "/api/admin/status") {
    send(res, 200, JSON.stringify({ configured: Boolean(readPasswordRecord()) }));
    return true;
  }

  if (req.method === "POST" && pathname === "/api/admin/setup") {
    if (readPasswordRecord()) {
      send(res, 409, JSON.stringify({ error: "Admin password already configured." }));
      return true;
    }
    const payload = safeJsonParse(await readBody(req));
    const password = String(payload?.password || "");
    if (password.length < 8) {
      send(res, 400, JSON.stringify({ error: "Password must be at least 8 characters." }));
      return true;
    }
    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    fs.writeFileSync(authFile, `${JSON.stringify(createPasswordRecord(password), null, 2)}\n`, "utf8");
    send(res, 200, JSON.stringify({ ok: true, token: createSession() }));
    return true;
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    const payload = safeJsonParse(await readBody(req));
    if (!verifyPassword(String(payload?.password || ""), readPasswordRecord())) {
      send(res, 401, JSON.stringify({ error: "Invalid password." }));
      return true;
    }
    send(res, 200, JSON.stringify({ ok: true, token: createSession() }));
    return true;
  }

  if (req.method === "POST" && pathname === "/api/admin/logout") {
    sessions.delete(getBearerToken(req));
    send(res, 200, JSON.stringify({ ok: true }));
    return true;
  }

  if (req.method === "GET" && pathname === "/api/site") {
    if (!requireAdmin(req, res)) return true;
    const text = fs.readFileSync(dataFile, "utf8");
    send(res, 200, text);
    return true;
  }

  if (req.method === "POST" && pathname === "/api/site") {
    if (!requireAdmin(req, res)) return true;
    const body = await readBody(req);
    const nextData = safeJsonParse(body);
    if (!nextData || typeof nextData !== "object") {
      send(res, 400, JSON.stringify({ error: "Invalid JSON payload." }));
      return true;
    }
    writeSiteData(nextData);
    send(res, 200, JSON.stringify({ ok: true, savedAt: new Date().toISOString() }));
    return true;
  }

  if (req.method === "POST" && pathname === "/api/upload") {
    if (!requireAdmin(req, res)) return true;
    const body = await readBody(req);
    const payload = safeJsonParse(body);
    if (!payload || !payload.fileName || !payload.dataUrl) {
      send(res, 400, JSON.stringify({ error: "Missing fileName or dataUrl." }));
      return true;
    }
    const match = String(payload.dataUrl).match(/^data:.*?;base64,(.+)$/);
    if (!match) {
      send(res, 400, JSON.stringify({ error: "Expected a base64 data URL." }));
      return true;
    }
    const folder = String(payload.folder || "resources").replace(/[^\w-]/g, "");
    const outDir = path.join(root, "files", folder);
    fs.mkdirSync(outDir, { recursive: true });
    const fileName = sanitizeFileName(payload.fileName);
    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, Buffer.from(match[1], "base64"));
    send(res, 200, JSON.stringify({ ok: true, url: `files/${folder}/${fileName}` }));
    return true;
  }

  return false;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.normalize(path.join(root, pathname));

  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": ext === ".json" ? "no-store" : "public, max-age=300"
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/") && await handleApi(req, res)) return;
    serveStatic(req, res);
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message }));
  }
});

server.listen(port, () => {
  console.log(`Academic site preview: http://localhost:${port}`);
  console.log(`Local admin:          http://localhost:${port}/admin.html`);
});
