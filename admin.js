const adminState = {
  data: null,
  module: "profile",
  editing: null,
  importPreview: [],
  token: sessionStorage.getItem("academic-admin-token") || "",
  photoEditor: null
};

const modules = [
  ["profile", "个人信息"],
  ["research", "研究方向"],
  ["publications", "论文发表"],
  ["projects", "科研项目"],
  ["teaching", "教学课程"],
  ["admissions", "招生信息"],
  ["news", "新闻动态"],
  ["team", "团队成员"],
  ["resources", "资源下载"],
  ["raw", "原始 JSON"]
];

const publicationTypes = [
  ["journal_article", "期刊论文"],
  ["conference_paper", "会议论文"],
  ["degree_thesis", "学位论文"],
  ["preprint", "预印本"],
  ["patent", "专利"],
  ["software_copyright", "软著"],
  ["book_or_textbook", "著作/教材"]
];

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function byId(id) {
  return document.getElementById(id);
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getLocalized(value, locale) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[locale] || "";
}

function setLocalized(target, field, zh, en) {
  target[field] = { zh: zh || "", en: en || "" };
}

function splitTags(value) {
  return String(value || "")
    .split(/[,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinTags(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function optionList(items, selected) {
  return items.map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`).join("");
}

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (adminState.token) headers.set("Authorization", `Bearer ${adminState.token}`);
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    adminState.token = "";
    sessionStorage.removeItem("academic-admin-token");
    renderAuth("登录已过期，请重新输入密码。");
    throw new Error("Admin login required.");
  }
  return res;
}

async function initAdmin() {
  const res = await fetch("/api/admin/status", { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) {
    renderStaticAdminNotice();
    return;
  }
  const status = await res.json();
  if (!status.configured) {
    renderAuth("首次使用，请先设置后台密码。", true);
    return;
  }
  if (!adminState.token) {
    renderAuth("请输入后台密码。");
    return;
  }
  loadData().catch(() => renderAuth("登录已过期，请重新输入密码。"));
}

function renderStaticAdminNotice() {
  byId("admin-menu").innerHTML = "";
  byId("admin-app").innerHTML = `
    <h1>在线后台未启用</h1>
    <p class="status">这个页面现在运行在 GitHub Pages 静态环境中，不能直接保存内容到仓库。为了安全写入 GitHub，需要 GitHub 登录/OAuth 或本地发布流程。</p>
    <div class="list">
      <article class="list-item">
        <h3>最简单的维护方式</h3>
        <p>在自己的电脑上运行 <code>npm start</code>，打开 <code>http://localhost:5173/admin.html</code>，输入后台密码后可视化修改内容，再推送到 GitHub。</p>
      </article>
      <article class="list-item">
        <h3>后续升级</h3>
        <p>如果要真正在线修改，需要接入 GitHub OAuth 或访问控制服务。普通前端密码无法安全地写入 GitHub 仓库。</p>
      </article>
    </div>
    <div class="hero-actions">
      <a class="button-primary" href="index.html">返回网站</a>
    </div>
  `;
}

function renderAuth(message, setupMode = false) {
  byId("admin-menu").innerHTML = "";
  byId("admin-app").innerHTML = `
    <h1>${setupMode ? "设置后台密码" : "后台登录"}</h1>
    <p class="status">${esc(message || "")}</p>
    <div class="form-grid">
      <div class="field full">
        <label>后台密码</label>
        <input id="admin-password" type="password" autocomplete="${setupMode ? "new-password" : "current-password"}" placeholder="至少 8 位">
      </div>
      ${setupMode ? `<div class="field full"><label>再次输入密码</label><input id="admin-password-confirm" type="password" autocomplete="new-password"></div>` : ""}
    </div>
    <div class="hero-actions">
      <button type="button" id="admin-login" class="button-primary">${setupMode ? "设置并进入后台" : "进入后台"}</button>
      <a class="button-secondary" href="index.html">返回网站预览</a>
    </div>
    <p class="status">提示：这个密码保护的是本地管理后台。真正上线后的在线后台，后续还应接 GitHub 登录或访问控制服务。</p>
  `;
  byId("admin-login").addEventListener("click", () => submitAuth(setupMode));
  byId("admin-password").addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitAuth(setupMode);
  });
}

async function submitAuth(setupMode) {
  const password = byId("admin-password").value;
  if (setupMode && password !== byId("admin-password-confirm").value) {
    renderAuth("两次输入的密码不一致。", true);
    return;
  }
  const res = await fetch(setupMode ? "/api/admin/setup" : "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    renderAuth(result.error || "密码验证失败。", setupMode);
    return;
  }
  adminState.token = result.token;
  sessionStorage.setItem("academic-admin-token", adminState.token);
  await loadData();
}

async function loadData() {
  const res = await apiFetch("/api/site", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("请通过 npm start 启动本地后台服务后访问 admin.html。");
  }
  adminState.data = await res.json();
  renderMenu();
  render();
}

async function saveData() {
  adminState.data.meta.updatedAt = new Date().toISOString().slice(0, 10);
  const res = await apiFetch("/api/site", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(adminState.data)
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "保存失败");
  }
  toast("已保存到 data/site.json，并自动生成备份。");
}

function toast(message) {
  const panel = byId("admin-app");
  const note = document.createElement("div");
  note.className = "status";
  note.textContent = message;
  panel.prepend(note);
  setTimeout(() => note.remove(), 4200);
}

function renderMenu() {
  byId("admin-menu").innerHTML = modules.map(([key, label]) => (
    `<button type="button" data-module="${key}" class="${adminState.module === key ? "active" : ""}">${label}</button>`
  )).join("");
  byId("admin-menu").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-module]");
    if (!button) return;
    adminState.module = button.dataset.module;
    adminState.editing = null;
    adminState.importPreview = [];
    renderMenu();
    render();
  });
}

function localizedFields(base, label, value = {}) {
  return `
    <div class="field">
      <label>${label}（中文）</label>
      <input id="${base}-zh" value="${esc(getLocalized(value, "zh"))}">
    </div>
    <div class="field">
      <label>${label}（英文）</label>
      <input id="${base}-en" value="${esc(getLocalized(value, "en"))}">
    </div>
  `;
}

function localizedTextarea(base, label, value = {}) {
  return `
    <div class="field">
      <label>${label}（中文）</label>
      <textarea id="${base}-zh">${esc(getLocalized(value, "zh"))}</textarea>
    </div>
    <div class="field">
      <label>${label}（英文）</label>
      <textarea id="${base}-en">${esc(getLocalized(value, "en"))}</textarea>
    </div>
  `;
}

function renderProfile() {
  const profile = adminState.data.profile;
  return `
    <div class="toolbar"><h1>个人信息</h1><button type="button" id="save-profile">应用修改</button></div>
    <div class="form-grid">
      ${localizedFields("name", "姓名", profile.name)}
      ${localizedFields("title", "职称/身份", profile.title)}
      ${localizedFields("affiliation", "单位", profile.affiliation)}
      <div class="field"><label>邮箱</label><input id="email" value="${esc(profile.email)}"></div>
      <div class="field"><label>电话</label><input id="phone" value="${esc(profile.phone)}"></div>
      <div class="field"><label>办公室</label><input id="office" value="${esc(profile.office)}"></div>
      <div class="field"><label>工作照 URL</label><input id="photo" value="${esc(profile.photo)}"></div>
      <div class="field"><label>上传工作照</label><input id="photo-file" type="file" accept="image/*"></div>
      <div class="field full">
        <label>照片裁剪与缩放</label>
        <div class="photo-cropper">
          <canvas id="photo-crop-canvas" width="800" height="1000" aria-label="工作照裁剪预览"></canvas>
          <div class="form-grid">
            <div class="field"><label>缩放</label><input id="photo-zoom" type="range" min="0.5" max="3" step="0.01" value="1"></div>
            <div class="field"><label>左右移动</label><input id="photo-offset-x" type="range" min="-100" max="100" step="1" value="0"></div>
            <div class="field"><label>上下移动</label><input id="photo-offset-y" type="range" min="-100" max="100" step="1" value="0"></div>
            <div class="field"><label>输出比例</label><input value="4:5，适合首页工作照" disabled></div>
          </div>
        </div>
      </div>
      <div class="field full"><label>关键词，用逗号分隔</label><input id="keywords" value="${esc(joinTags(profile.keywords))}"></div>
      ${localizedTextarea("summary", "首页摘要", profile.summary)}
      ${localizedTextarea("bio", "个人简介", profile.bio)}
    </div>
  `;
}

function bindProfile() {
  byId("save-profile").addEventListener("click", async () => {
    const profile = adminState.data.profile;
    setLocalized(profile, "name", byId("name-zh").value, byId("name-en").value);
    setLocalized(profile, "title", byId("title-zh").value, byId("title-en").value);
    setLocalized(profile, "affiliation", byId("affiliation-zh").value, byId("affiliation-en").value);
    setLocalized(profile, "summary", byId("summary-zh").value, byId("summary-en").value);
    setLocalized(profile, "bio", byId("bio-zh").value, byId("bio-en").value);
    profile.email = byId("email").value.trim();
    profile.phone = byId("phone").value.trim();
    profile.office = byId("office").value.trim();
    profile.photo = byId("photo").value.trim();
    profile.keywords = splitTags(byId("keywords").value);
    const file = byId("photo-file").files[0];
    if (adminState.photoEditor?.image) {
      profile.photo = await uploadDataUrl("work-photo.jpg", getCroppedPhotoDataUrl(), "images");
      adminState.photoEditor = null;
    } else if (file) {
      profile.photo = await uploadFile(file, "images");
    }
    toast("个人信息已应用。记得保存全部内容。");
    render();
  });
  bindPhotoEditor();
}

function bindPhotoEditor() {
  const fileInput = byId("photo-file");
  const zoom = byId("photo-zoom");
  const offsetX = byId("photo-offset-x");
  const offsetY = byId("photo-offset-y");
  const canvas = byId("photo-crop-canvas");
  if (!fileInput || !canvas) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const image = new Image();
    image.onload = () => {
      adminState.photoEditor = { image, zoom: 1, offsetX: 0, offsetY: 0 };
      zoom.value = "1";
      offsetX.value = "0";
      offsetY.value = "0";
      drawPhotoCrop();
    };
    image.src = dataUrl;
  });

  [zoom, offsetX, offsetY].forEach((input) => {
    input.addEventListener("input", () => {
      if (!adminState.photoEditor) return;
      adminState.photoEditor.zoom = Number(zoom.value);
      adminState.photoEditor.offsetX = Number(offsetX.value);
      adminState.photoEditor.offsetY = Number(offsetY.value);
      drawPhotoCrop();
    });
  });

  drawPhotoCrop();
}

function drawPhotoCrop() {
  const canvas = byId("photo-crop-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#edf3f1";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#d9dedc";
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

  const editor = adminState.photoEditor;
  if (!editor?.image) {
    ctx.fillStyle = "#6a7478";
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("选择照片后在这里裁剪", canvas.width / 2, canvas.height / 2);
    return;
  }

  const image = editor.image;
  const baseScale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const scale = baseScale * editor.zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (canvas.width - width) / 2 + editor.offsetX * canvas.width / 100;
  const y = (canvas.height - height) / 2 + editor.offsetY * canvas.height / 100;
  ctx.drawImage(image, x, y, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
}

function getCroppedPhotoDataUrl() {
  const canvas = byId("photo-crop-canvas");
  return canvas.toDataURL("image/jpeg", 0.9);
}

function renderListModule(key, title, columns, formRenderer) {
  const rows = adminState.data[key] || [];
  const editingItem = rows.find((item) => item.id === adminState.editing) || null;
  return `
    <div class="toolbar">
      <h1>${title}</h1>
      <button type="button" id="new-item">新增</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>${columns.map((col) => `<th>${col.label}</th>`).join("")}<th>操作</th></tr></thead>
        <tbody>
          ${rows.map((item) => `<tr>${columns.map((col) => `<td>${esc(col.value(item))}</td>`).join("")}<td><button type="button" data-edit="${item.id}">编辑</button> <button type="button" class="danger" data-delete="${item.id}">删除</button></td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    <hr>
    ${formRenderer(editingItem)}
  `;
}

function bindListModule(key, emptyFactory, collect) {
  byId("new-item").addEventListener("click", () => {
    const item = emptyFactory();
    adminState.data[key].push(item);
    adminState.editing = item.id;
    render();
  });
  byId("admin-app").querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      adminState.editing = button.dataset.edit;
      render();
    });
  });
  byId("admin-app").querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirm("确认删除这条内容？保存前仍只是在内存中修改。")) return;
      adminState.data[key] = adminState.data[key].filter((item) => item.id !== button.dataset.delete);
      adminState.editing = null;
      render();
    });
  });
  const save = byId("save-item");
  if (save) {
    save.addEventListener("click", async () => {
      const item = adminState.data[key].find((entry) => entry.id === adminState.editing);
      await collect(item);
      toast("条目已应用。记得保存全部内容。");
      render();
    });
  }
}

function renderResearchForm(item) {
  if (!item) return `<p class="status">请选择一条研究方向编辑，或点击新增。</p>`;
  return `
    <h2>编辑研究方向</h2>
    <div class="form-grid">
      ${localizedFields("title", "标题", item.title)}
      ${localizedTextarea("summary", "简介", item.summary)}
      <div class="field full"><label>关键词</label><input id="keywords" value="${esc(joinTags(item.keywords))}"></div>
      <div class="field"><label>排序</label><input id="order" type="number" value="${esc(item.order)}"></div>
    </div>
    <button type="button" id="save-item">应用条目</button>
  `;
}

function renderResearchAdmin() {
  return renderListModule("research", "研究方向", [
    { label: "标题", value: (item) => getLocalized(item.title, "zh") },
    { label: "关键词", value: (item) => joinTags(item.keywords) },
    { label: "排序", value: (item) => item.order }
  ], renderResearchForm);
}

function bindResearchAdmin() {
  bindListModule("research", () => ({
    id: uid("research"),
    title: { zh: "新研究方向", en: "" },
    summary: { zh: "", en: "" },
    keywords: [],
    order: adminState.data.research.length + 1
  }), (item) => {
    setLocalized(item, "title", byId("title-zh").value, byId("title-en").value);
    setLocalized(item, "summary", byId("summary-zh").value, byId("summary-en").value);
    item.keywords = splitTags(byId("keywords").value);
    item.order = Number(byId("order").value || 0);
  });
}

function emptyPublication() {
  return {
    id: uid("pub"),
    type: "journal_article",
    title: { zh: "新论文标题", en: "" },
    authors: "",
    year: new Date().getFullYear(),
    date: "",
    venue: "",
    levels: [],
    jcr: "",
    cas: "",
    ccf: "",
    doi: "",
    cnki: "",
    pdf: "",
    projectUrl: "",
    codeUrl: "",
    datasetUrl: "",
    abstract: { zh: "", en: "" },
    keywords: [],
    areas: [],
    featured: false,
    pinned: false,
    status: "published",
    bibtex: "",
    citation: "",
    notes: ""
  };
}

function renderPublicationForm(item) {
  if (!item) return `<p class="status">请选择一篇论文编辑，或点击新增论文。</p>${renderImportBox()}`;
  return `
    <h2>编辑论文</h2>
    <div class="form-grid">
      ${localizedFields("title", "标题", item.title)}
      <div class="field"><label>类型</label><select id="type">${optionList(publicationTypes, item.type)}</select></div>
      <div class="field"><label>年份</label><input id="year" type="number" value="${esc(item.year)}"></div>
      <div class="field full"><label>作者</label><input id="authors" value="${esc(item.authors)}"></div>
      <div class="field"><label>发表来源</label><input id="venue" value="${esc(item.venue)}"></div>
      <div class="field"><label>状态</label><select id="status"><option value="published" ${item.status === "published" ? "selected" : ""}>公开</option><option value="draft" ${item.status === "draft" ? "selected" : ""}>草稿</option><option value="private" ${item.status === "private" ? "selected" : ""}>隐藏</option></select></div>
      <div class="field"><label>级别标签</label><input id="levels" value="${esc(joinTags(item.levels))}"></div>
      <div class="field"><label>研究方向</label><input id="areas" value="${esc(joinTags(item.areas))}"></div>
      <div class="field"><label>关键词</label><input id="keywords" value="${esc(joinTags(item.keywords))}"></div>
      <div class="field"><label>DOI</label><input id="doi" value="${esc(item.doi)}"></div>
      <div class="field"><label>知网链接</label><input id="cnki" value="${esc(item.cnki)}"></div>
      <div class="field"><label>PDF 链接</label><input id="pdf" value="${esc(item.pdf)}"></div>
      <div class="field"><label>上传 PDF</label><input id="pdf-file" type="file" accept="application/pdf"></div>
      <div class="field"><label>项目主页</label><input id="projectUrl" value="${esc(item.projectUrl)}"></div>
      <div class="field"><label>代码链接</label><input id="codeUrl" value="${esc(item.codeUrl)}"></div>
      <div class="field"><label>数据集链接</label><input id="datasetUrl" value="${esc(item.datasetUrl)}"></div>
      <div class="field"><label>JCR 分区</label><input id="jcr" value="${esc(item.jcr)}"></div>
      <div class="field"><label>中科院分区</label><input id="cas" value="${esc(item.cas)}"></div>
      <div class="field"><label>CCF 等级</label><input id="ccf" value="${esc(item.ccf)}"></div>
      ${localizedTextarea("abstract", "摘要", item.abstract)}
      <div class="field full"><label>BibTeX</label><textarea id="bibtex">${esc(item.bibtex)}</textarea></div>
      <div class="field full"><label>引用格式</label><textarea id="citation">${esc(item.citation)}</textarea></div>
      <div class="field full"><label>备注（不建议公开展示）</label><textarea id="notes">${esc(item.notes)}</textarea></div>
      <div class="field"><label><input id="featured" type="checkbox" ${item.featured ? "checked" : ""}> 代表作</label></div>
      <div class="field"><label><input id="pinned" type="checkbox" ${item.pinned ? "checked" : ""}> 置顶</label></div>
    </div>
    <button type="button" id="save-item">应用论文</button>
    ${renderImportBox()}
  `;
}

function renderImportBox() {
  return `
    <hr>
    <h2>批量导入论文</h2>
    <p class="status">第一版支持 CSV。Excel 可先另存为 CSV 后导入；原生 XLSX 解析后续可加依赖库实现。</p>
    <div class="form-grid">
      <div class="field"><label>CSV 文件</label><input id="csv-file" type="file" accept=".csv,text/csv"></div>
      <div class="field"><label>导入模式</label><select id="import-mode"><option value="append">只新增</option><option value="upsert">按 DOI 或标题+年份更新</option><option value="replace">替换全部论文</option></select></div>
    </div>
    <div class="hero-actions">
      <button type="button" id="preview-import">预览导入</button>
      <button type="button" id="apply-import">确认导入</button>
    </div>
    <div id="import-preview">${renderImportPreview()}</div>
  `;
}

function renderImportPreview() {
  if (!adminState.importPreview.length) return "";
  return `
    <h3>导入预览：${adminState.importPreview.length} 条</h3>
    <div class="table-wrap"><table><thead><tr><th>标题</th><th>作者</th><th>年份</th><th>类型</th><th>来源</th></tr></thead><tbody>
      ${adminState.importPreview.slice(0, 20).map((item) => `<tr><td>${esc(getLocalized(item.title, "zh"))}</td><td>${esc(item.authors)}</td><td>${esc(item.year)}</td><td>${esc(item.type)}</td><td>${esc(item.venue)}</td></tr>`).join("")}
    </tbody></table></div>
  `;
}

function renderPublicationsAdmin() {
  return renderListModule("publications", "论文发表", [
    { label: "标题", value: (item) => getLocalized(item.title, "zh") },
    { label: "年份", value: (item) => item.year },
    { label: "类型", value: (item) => publicationTypes.find(([key]) => key === item.type)?.[1] || item.type },
    { label: "状态", value: (item) => item.status }
  ], renderPublicationForm);
}

function bindPublicationsAdmin() {
  bindListModule("publications", emptyPublication, async (item) => {
    setLocalized(item, "title", byId("title-zh").value, byId("title-en").value);
    setLocalized(item, "abstract", byId("abstract-zh").value, byId("abstract-en").value);
    item.type = byId("type").value;
    item.year = Number(byId("year").value || new Date().getFullYear());
    item.authors = byId("authors").value.trim();
    item.venue = byId("venue").value.trim();
    item.status = byId("status").value;
    item.levels = splitTags(byId("levels").value);
    item.areas = splitTags(byId("areas").value);
    item.keywords = splitTags(byId("keywords").value);
    item.doi = byId("doi").value.trim();
    item.cnki = byId("cnki").value.trim();
    item.pdf = byId("pdf").value.trim();
    item.projectUrl = byId("projectUrl").value.trim();
    item.codeUrl = byId("codeUrl").value.trim();
    item.datasetUrl = byId("datasetUrl").value.trim();
    item.jcr = byId("jcr").value.trim();
    item.cas = byId("cas").value.trim();
    item.ccf = byId("ccf").value.trim();
    item.bibtex = byId("bibtex").value;
    item.citation = byId("citation").value;
    item.notes = byId("notes").value;
    item.featured = byId("featured").checked;
    item.pinned = byId("pinned").checked;
    const file = byId("pdf-file").files[0];
    if (file) item.pdf = await uploadFile(file, "publications");
  });
  bindImportControls();
}

function bindImportControls() {
  const preview = byId("preview-import");
  const apply = byId("apply-import");
  if (!preview || !apply) return;
  preview.addEventListener("click", async () => {
    const file = byId("csv-file").files[0];
    if (!file) return toast("请先选择 CSV 文件。");
    const text = await file.text();
    adminState.importPreview = csvToPublications(text);
    render();
  });
  apply.addEventListener("click", () => {
    if (!adminState.importPreview.length) return toast("请先预览导入。");
    const mode = byId("import-mode").value;
    if (mode === "replace" && !confirm("确认用导入结果替换全部论文？保存时会生成备份。")) return;
    if (mode === "replace") {
      adminState.data.publications = adminState.importPreview;
    } else {
      adminState.importPreview.forEach((incoming) => {
        const index = adminState.data.publications.findIndex((old) => (
          incoming.doi && old.doi === incoming.doi
        ) || (
          getLocalized(old.title, "zh") === getLocalized(incoming.title, "zh") && Number(old.year) === Number(incoming.year)
        ));
        if (index >= 0 && mode === "upsert") adminState.data.publications[index] = { ...adminState.data.publications[index], ...incoming };
        if (index < 0 || mode === "append") adminState.data.publications.push(incoming);
      });
    }
    adminState.importPreview = [];
    toast("导入结果已应用。请检查后保存全部内容。");
    render();
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function csvToPublications(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((item) => item.trim());
  return rows.slice(1).map((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
    const item = emptyPublication();
    item.id = record.id || uid("pub");
    item.title = { zh: record.title || record.title_zh || "未命名论文", en: record.title_en || "" };
    item.type = record.type || "journal_article";
    item.year = Number(record.year || new Date().getFullYear());
    item.authors = record.authors || "";
    item.venue = record.venue || record.venue_name || "";
    item.levels = splitTags(record.levels || record.level_indexing);
    item.doi = record.doi || "";
    item.pdf = record.pdf || record.pdf_url || "";
    item.cnki = record.cnki || record.cnki_url || "";
    item.projectUrl = record.project || record.project_url || "";
    item.codeUrl = record.code || record.code_url || "";
    item.datasetUrl = record.dataset || record.dataset_url || "";
    item.abstract = { zh: record.abstract || record.abstract_zh || "", en: record.abstract_en || "" };
    item.keywords = splitTags(record.keywords);
    item.areas = splitTags(record.areas || record.research_area);
    item.featured = ["true", "1", "yes", "是"].includes(String(record.featured).toLowerCase());
    item.status = record.visibility === "private" ? "private" : (record.status || "published");
    return item;
  });
}

function renderGenericForm(item, config) {
  if (!item) return `<p class="status">请选择一条内容编辑，或点击新增。</p>`;
  return `
    <h2>编辑${config.singular}</h2>
    <div class="form-grid">
      ${localizedFields("title", config.titleLabel, item[config.titleField])}
      ${config.extra(item)}
    </div>
    <button type="button" id="save-item">应用条目</button>
  `;
}

function genericModule(key, config) {
  return {
    render: () => renderListModule(key, config.title, config.columns, (item) => renderGenericForm(item, config)),
    bind: () => bindListModule(key, config.empty, config.collect)
  };
}

const genericModules = {
  projects: genericModule("projects", {
    title: "科研项目",
    singular: "项目",
    titleField: "title",
    titleLabel: "项目名称",
    columns: [
      { label: "项目", value: (item) => getLocalized(item.title, "zh") },
      { label: "时间", value: (item) => item.period },
      { label: "状态", value: (item) => item.status }
    ],
    empty: () => ({ id: uid("project"), title: { zh: "新项目", en: "" }, role: { zh: "", en: "" }, period: "", source: "", summary: { zh: "", en: "" }, status: "active", order: adminState.data.projects.length + 1 }),
    extra: (item) => `${localizedFields("role", "角色", item.role)}${localizedTextarea("summary", "简介", item.summary)}<div class="field"><label>时间</label><input id="period" value="${esc(item.period)}"></div><div class="field"><label>来源</label><input id="source" value="${esc(item.source)}"></div><div class="field"><label>状态</label><input id="status" value="${esc(item.status)}"></div><div class="field"><label>排序</label><input id="order" type="number" value="${esc(item.order)}"></div>`,
    collect: (item) => { setLocalized(item, "title", byId("title-zh").value, byId("title-en").value); setLocalized(item, "role", byId("role-zh").value, byId("role-en").value); setLocalized(item, "summary", byId("summary-zh").value, byId("summary-en").value); item.period = byId("period").value; item.source = byId("source").value; item.status = byId("status").value; item.order = Number(byId("order").value || 0); }
  }),
  teaching: genericModule("teaching", {
    title: "教学课程",
    singular: "课程",
    titleField: "name",
    titleLabel: "课程名称",
    columns: [
      { label: "课程", value: (item) => getLocalized(item.name, "zh") },
      { label: "对象", value: (item) => getLocalized(item.audience, "zh") },
      { label: "学期", value: (item) => item.semester }
    ],
    empty: () => ({ id: uid("course"), name: { zh: "新课程", en: "" }, audience: { zh: "", en: "" }, semester: "", summary: { zh: "", en: "" }, order: adminState.data.teaching.length + 1 }),
    extra: (item) => `${localizedFields("audience", "授课对象", item.audience)}${localizedTextarea("summary", "课程简介", item.summary)}<div class="field"><label>学期</label><input id="semester" value="${esc(item.semester)}"></div><div class="field"><label>排序</label><input id="order" type="number" value="${esc(item.order)}"></div>`,
    collect: (item) => { setLocalized(item, "name", byId("title-zh").value, byId("title-en").value); setLocalized(item, "audience", byId("audience-zh").value, byId("audience-en").value); setLocalized(item, "summary", byId("summary-zh").value, byId("summary-en").value); item.semester = byId("semester").value; item.order = Number(byId("order").value || 0); }
  }),
  news: genericModule("news", {
    title: "新闻动态",
    singular: "新闻",
    titleField: "title",
    titleLabel: "新闻标题",
    columns: [
      { label: "标题", value: (item) => getLocalized(item.title, "zh") },
      { label: "日期", value: (item) => item.date },
      { label: "发布", value: (item) => item.published ? "是" : "否" }
    ],
    empty: () => ({ id: uid("news"), title: { zh: "新动态", en: "" }, date: new Date().toISOString().slice(0, 10), cover: "", body: { zh: "", en: "" }, published: true }),
    extra: (item) => `${localizedTextarea("body", "正文", item.body)}<div class="field"><label>日期</label><input id="date" type="date" value="${esc(item.date)}"></div><div class="field"><label>封面图 URL</label><input id="cover" value="${esc(item.cover)}"></div><div class="field"><label><input id="published" type="checkbox" ${item.published ? "checked" : ""}> 发布</label></div>`,
    collect: (item) => { setLocalized(item, "title", byId("title-zh").value, byId("title-en").value); setLocalized(item, "body", byId("body-zh").value, byId("body-en").value); item.date = byId("date").value; item.cover = byId("cover").value; item.published = byId("published").checked; }
  }),
  team: genericModule("team", {
    title: "团队成员",
    singular: "成员",
    titleField: "name",
    titleLabel: "姓名",
    columns: [
      { label: "姓名", value: (item) => getLocalized(item.name, "zh") },
      { label: "身份", value: (item) => getLocalized(item.role, "zh") },
      { label: "研究方向", value: (item) => getLocalized(item.research, "zh") }
    ],
    empty: () => ({ id: uid("team"), name: { zh: "新成员", en: "" }, role: { zh: "", en: "" }, research: { zh: "", en: "" }, email: "", photo: "", order: adminState.data.team.length + 1 }),
    extra: (item) => `${localizedFields("role", "身份", item.role)}${localizedTextarea("research", "研究方向", item.research)}<div class="field"><label>邮箱</label><input id="email" value="${esc(item.email)}"></div><div class="field"><label>照片 URL</label><input id="photo" value="${esc(item.photo)}"></div><div class="field"><label>排序</label><input id="order" type="number" value="${esc(item.order)}"></div>`,
    collect: (item) => { setLocalized(item, "name", byId("title-zh").value, byId("title-en").value); setLocalized(item, "role", byId("role-zh").value, byId("role-en").value); setLocalized(item, "research", byId("research-zh").value, byId("research-en").value); item.email = byId("email").value; item.photo = byId("photo").value; item.order = Number(byId("order").value || 0); }
  }),
  resources: genericModule("resources", {
    title: "资源下载",
    singular: "资源",
    titleField: "title",
    titleLabel: "资源标题",
    columns: [
      { label: "标题", value: (item) => getLocalized(item.title, "zh") },
      { label: "分类", value: (item) => item.category },
      { label: "发布", value: (item) => item.published ? "是" : "否" }
    ],
    empty: () => ({ id: uid("resource"), title: { zh: "新资源", en: "" }, category: "", description: { zh: "", en: "" }, file: "", url: "", published: true }),
    extra: (item) => `${localizedTextarea("description", "说明", item.description)}<div class="field"><label>分类</label><input id="category" value="${esc(item.category)}"></div><div class="field"><label>文件路径</label><input id="file" value="${esc(item.file)}"></div><div class="field"><label>外部链接</label><input id="url" value="${esc(item.url)}"></div><div class="field"><label>上传文件</label><input id="upload-file" type="file"></div><div class="field"><label><input id="published" type="checkbox" ${item.published ? "checked" : ""}> 发布</label></div>`,
    collect: async (item) => { setLocalized(item, "title", byId("title-zh").value, byId("title-en").value); setLocalized(item, "description", byId("description-zh").value, byId("description-en").value); item.category = byId("category").value; item.file = byId("file").value; item.url = byId("url").value; item.published = byId("published").checked; const file = byId("upload-file").files[0]; if (file) item.file = await uploadFile(file, "resources"); }
  })
};

function renderAdmissionsAdmin() {
  const item = adminState.data.admissions;
  return `
    <div class="toolbar"><h1>招生信息</h1><button type="button" id="save-admissions">应用修改</button></div>
    <div class="form-grid">
      ${localizedFields("title", "标题", item.title)}
      ${localizedTextarea("content", "内容", item.content)}
      <div class="field"><label><input id="enabled" type="checkbox" ${item.enabled ? "checked" : ""}> 启用招生信息</label></div>
    </div>
  `;
}

function bindAdmissionsAdmin() {
  byId("save-admissions").addEventListener("click", () => {
    const item = adminState.data.admissions;
    setLocalized(item, "title", byId("title-zh").value, byId("title-en").value);
    setLocalized(item, "content", byId("content-zh").value, byId("content-en").value);
    item.enabled = byId("enabled").checked;
    toast("招生信息已应用。记得保存全部内容。");
  });
}

function renderRawAdmin() {
  return `
    <div class="toolbar"><h1>原始 JSON</h1><button type="button" id="apply-raw">应用 JSON</button></div>
    <p class="status">高级功能：适合整体检查或批量修改数据。格式错误会被拒绝。</p>
    <textarea id="raw-json" style="min-height: 560px; font-family: Consolas, monospace;">${esc(JSON.stringify(adminState.data, null, 2))}</textarea>
  `;
}

function bindRawAdmin() {
  byId("apply-raw").addEventListener("click", () => {
    try {
      adminState.data = JSON.parse(byId("raw-json").value);
      toast("JSON 已应用。记得保存全部内容。");
      renderMenu();
      render();
    } catch (error) {
      toast(`JSON 格式错误：${error.message}`);
    }
  });
}

async function uploadFile(file, folder) {
  return uploadDataUrl(file.name, await fileToDataUrl(file), folder);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadDataUrl(fileName, dataUrl, folder) {
  const res = await apiFetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, dataUrl, folder })
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "上传失败");
  return result.url;
}

function render() {
  const app = byId("admin-app");
  if (!adminState.data) return;
  const renderers = {
    profile: renderProfile,
    research: renderResearchAdmin,
    publications: renderPublicationsAdmin,
    projects: genericModules.projects.render,
    teaching: genericModules.teaching.render,
    admissions: renderAdmissionsAdmin,
    news: genericModules.news.render,
    team: genericModules.team.render,
    resources: genericModules.resources.render,
    raw: renderRawAdmin
  };
  app.innerHTML = renderers[adminState.module]();
  const binders = {
    profile: bindProfile,
    research: bindResearchAdmin,
    publications: bindPublicationsAdmin,
    projects: genericModules.projects.bind,
    teaching: genericModules.teaching.bind,
    admissions: bindAdmissionsAdmin,
    news: genericModules.news.bind,
    team: genericModules.team.bind,
    resources: genericModules.resources.bind,
    raw: bindRawAdmin
  };
  binders[adminState.module]();
}

byId("save-site").addEventListener("click", () => {
  if (!adminState.data) {
    renderAuth("请先登录后台。");
    return;
  }
  saveData().catch((error) => toast(`保存失败：${error.message}`));
});

byId("publish-site").addEventListener("click", async () => {
  if (!adminState.data) {
    renderAuth("请先登录后台。");
    return;
  }
  if (!confirm("发布前请确认已经点击“保存全部内容”。现在要把当前网站发布到 GitHub 吗？")) return;
  const button = byId("publish-site");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "正在发布...";
  try {
    const res = await apiFetch("/api/publish", { method: "POST" });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || "发布失败");
    toast(`发布完成：${result.commit || ""} ${result.pagesUrl || ""}`);
  } catch (error) {
    toast(`发布失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});

byId("logout-admin").addEventListener("click", async () => {
  if (adminState.token) {
    await apiFetch("/api/admin/logout", { method: "POST" }).catch(() => {});
  }
  adminState.token = "";
  adminState.data = null;
  sessionStorage.removeItem("academic-admin-token");
  renderAuth("已退出登录。");
});

initAdmin().catch((error) => {
  byId("admin-app").innerHTML = `<p class="status">${esc(error.message)}</p>`;
});
