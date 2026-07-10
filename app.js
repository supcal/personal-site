const state = {
  data: null,
  locale: localStorage.getItem("academic-site-locale") || "zh",
  page: "home"
};

const navItems = [
  ["home", "学术主页", "Home"],
  ["profile", "个人简介", "Profile"],
  ["research", "研究方向", "Research"],
  ["publications", "论文发表", "Publications"],
  ["projects", "科研项目", "Projects"],
  ["teaching", "教学课程", "Teaching"],
  ["admissions", "招生信息", "Admissions"],
  ["news", "新闻动态", "News"],
  ["team", "团队成员", "Team"],
  ["resources", "资源下载", "Resources"]
];

const typeLabels = {
  journal_article: ["期刊论文", "Journal"],
  conference_paper: ["会议论文", "Conference"],
  degree_thesis: ["学位论文", "Thesis"],
  preprint: ["预印本", "Preprint"],
  patent: ["专利", "Patent"],
  software_copyright: ["软著", "Software Copyright"],
  book_or_textbook: ["著作/教材", "Book/Textbook"]
};

function t(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value[state.locale] || value.zh || value.en || "";
}

function text(labelZh, labelEn) {
  return state.locale === "zh" ? labelZh : labelEn;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function linkButton(url, label) {
  if (!url) return "";
  return `<a class="small-button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function getRoute() {
  const raw = location.hash.replace("#", "") || "home";
  return navItems.some(([key]) => key === raw) ? raw : "home";
}

async function loadData() {
  const response = await fetch("data/site.json", { cache: "no-store" });
  state.data = await response.json();
  document.title = state.locale === "zh" ? state.data.meta.siteTitle : state.data.meta.siteTitleEn;
  render();
}

function renderNav() {
  const profile = state.data.profile;
  document.getElementById("brand-name").textContent = t(profile.name);
  document.getElementById("brand-affiliation").textContent = t(profile.affiliation);
  const nav = document.getElementById("nav-links");
  nav.innerHTML = navItems.map(([key, zh, en]) => (
    `<a href="#${key}" class="${state.page === key ? "active" : ""}">${text(zh, en)}</a>`
  )).join("") +
    `<button class="lang-toggle" type="button" id="lang-toggle">${state.locale === "zh" ? "EN" : "中文"}</button>` +
    `<a class="admin-link" href="admin.html">${text("本地后台", "Local Admin")}</a>`;
  document.getElementById("lang-toggle").addEventListener("click", () => {
    state.locale = state.locale === "zh" ? "en" : "zh";
    localStorage.setItem("academic-site-locale", state.locale);
    render();
  });
}

function renderFooter() {
  const profile = state.data.profile;
  document.getElementById("footer").innerHTML = `${escapeHtml(t(profile.name))} · ${escapeHtml(t(profile.affiliation))} · <a href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a>`;
}

function renderHome() {
  const { profile, homepage, research, publications, news } = state.data;
  const featured = publications.filter((item) => item.featured).slice(0, 4);
  return `
    <section class="hero">
      <div>
        <p class="eyebrow">${escapeHtml(t(profile.affiliation))}</p>
        <h1>${escapeHtml(t(profile.name))}</h1>
        <p>${escapeHtml(t(profile.title))}</p>
        <p>${escapeHtml(t(profile.summary))}</p>
        <div class="tag-row">${profile.keywords.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
        <div class="hero-actions">
          <a class="button-primary" href="#publications">${text("查看论文成果", "View Publications")}</a>
          <a class="button-secondary" href="#admissions">${text("招生与合作", "Admissions")}</a>
          <a class="button-secondary" href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a>
        </div>
      </div>
      <img class="portrait" src="${escapeHtml(profile.photo)}" alt="${escapeHtml(t(profile.name))}">
    </section>
    <div class="stats">
      ${homepage.stats.map((item) => `<div class="stat"><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(t(item.label))}</span></div>`).join("")}
    </div>
    <section>
      <h2>${text("研究方向", "Research Areas")}</h2>
      <div class="section-grid">${research.map(renderResearchCard).join("")}</div>
    </section>
    <section>
      <h2>${text("代表性成果", "Selected Publications")}</h2>
      <div class="list">${featured.map(renderPublicationItem).join("")}</div>
    </section>
    <section>
      <h2>${text("近期动态", "News")}</h2>
      <div class="list">${news.filter((item) => item.published).slice(0, 3).map(renderNewsItem).join("")}</div>
    </section>
  `;
}

function renderProfile() {
  const { profile, awards } = state.data;
  return `
    <div class="layout">
      <aside class="side-note">
        <strong>${escapeHtml(t(profile.name))}</strong>
        <p>${escapeHtml(t(profile.title))}</p>
        <p>${escapeHtml(profile.email)}</p>
      </aside>
      <section>
        <h1>${text("个人简介", "Profile")}</h1>
        <p>${escapeHtml(t(profile.bio))}</p>
        <h2>${text("学术关键词", "Academic Keywords")}</h2>
        <div class="tag-row">${profile.keywords.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
        <h2>${text("奖励荣誉", "Awards")}</h2>
        <div class="list">${awards.map((item) => `<article class="list-item"><div class="list-meta">${escapeHtml(item.year)}</div><h3>${escapeHtml(t(item.title))}</h3><p>${escapeHtml(t(item.summary))}</p></article>`).join("")}</div>
      </section>
    </div>
  `;
}

function renderResearchCard(item) {
  return `
    <article class="card">
      <h3>${escapeHtml(t(item.title))}</h3>
      <p>${escapeHtml(t(item.summary))}</p>
      <div class="tag-row">${(item.keywords || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    </article>
  `;
}

function renderResearch() {
  return `
    <h1>${text("研究方向", "Research Areas")}</h1>
    <div class="section-grid">${state.data.research.map(renderResearchCard).join("")}</div>
  `;
}

function renderPublicationItem(item) {
  const typeLabel = typeLabels[item.type] ? typeLabels[item.type][state.locale === "zh" ? 0 : 1] : item.type;
  return `
    <article class="list-item publication-item" data-year="${item.year}" data-type="${escapeHtml(item.type)}">
      <div class="list-meta">
        <span>${escapeHtml(item.year)}</span>
        <span>${escapeHtml(typeLabel)}</span>
        <span>${escapeHtml(item.venue || "")}</span>
      </div>
      <div class="publication-title">${escapeHtml(t(item.title))}</div>
      <p>${escapeHtml(item.authors)}</p>
      <div class="tag-row">
        ${(item.featured ? [`<span class="tag">${text("代表作", "Selected")}</span>`] : []).join("")}
        ${(item.levels || []).map((level) => `<span class="tag">${escapeHtml(level)}</span>`).join("")}
        ${(item.areas || []).map((area) => `<span class="tag">${escapeHtml(area)}</span>`).join("")}
      </div>
      <div class="hero-actions">
        ${linkButton(item.pdf, "PDF")}
        ${linkButton(item.doi ? `https://doi.org/${item.doi.replace(/^https?:\/\/doi.org\//, "")}` : "", "DOI")}
        ${linkButton(item.cnki, "CNKI")}
        ${linkButton(item.projectUrl, "Project")}
        ${linkButton(item.codeUrl, "Code")}
        ${linkButton(item.datasetUrl, "Dataset")}
      </div>
    </article>
  `;
}

function renderPublications() {
  const publications = state.data.publications
    .filter((item) => item.status !== "private")
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.year - a.year);
  const years = [...new Set(publications.map((item) => item.year))].sort((a, b) => b - a);
  const types = [...new Set(publications.map((item) => item.type))];
  return `
    <h1>${text("论文发表", "Publications")}</h1>
    <p>${text("正式论文库，支持按年份、类型、级别、关键词和代表作状态进行筛选。", "A structured publication library with filters for year, type, level, keywords, and selected works.")}</p>
    <div class="filters" id="publication-filters">
      <input id="pub-search" placeholder="${text("搜索标题、作者、关键词", "Search title, authors, keywords")}">
      <select id="pub-year"><option value="">${text("全部年份", "All Years")}</option>${years.map((year) => `<option>${year}</option>`).join("")}</select>
      <select id="pub-type"><option value="">${text("全部类型", "All Types")}</option>${types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(typeLabels[type]?.[state.locale === "zh" ? 0 : 1] || type)}</option>`).join("")}</select>
      <select id="pub-featured"><option value="">${text("全部成果", "All Works")}</option><option value="true">${text("代表作", "Selected")}</option></select>
      <select id="pub-link"><option value="">${text("全部链接", "All Links")}</option><option value="pdf">PDF</option><option value="doi">DOI</option><option value="codeUrl">Code</option><option value="datasetUrl">Dataset</option></select>
    </div>
    <div class="list" id="publication-list">${publications.map(renderPublicationItem).join("")}</div>
  `;
}

function attachPublicationFilters() {
  const list = document.getElementById("publication-list");
  if (!list) return;
  const inputs = ["pub-search", "pub-year", "pub-type", "pub-featured", "pub-link"].map((id) => document.getElementById(id));
  const apply = () => {
    const [search, year, type, featured, link] = inputs.map((input) => input.value.trim().toLowerCase());
    const filtered = state.data.publications.filter((item) => {
      const haystack = [
        t(item.title), item.authors, item.venue, ...(item.keywords || []), ...(item.levels || []), ...(item.areas || [])
      ].join(" ").toLowerCase();
      return (!search || haystack.includes(search)) &&
        (!year || String(item.year) === year) &&
        (!type || item.type.toLowerCase() === type) &&
        (!featured || item.featured) &&
        (!link || Boolean(item[link]));
    }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.year - a.year);
    list.innerHTML = filtered.map(renderPublicationItem).join("") || `<p class="status">${text("没有匹配的成果。", "No matching publications.")}</p>`;
  };
  inputs.forEach((input) => input.addEventListener("input", apply));
}

function renderProjects() {
  return `<h1>${text("科研项目", "Research Projects")}</h1><div class="list">${state.data.projects.sort((a, b) => a.order - b.order).map((item) => `<article class="list-item"><div class="list-meta">${escapeHtml(item.period)} · ${escapeHtml(item.source)}</div><h3>${escapeHtml(t(item.title))}</h3><p>${escapeHtml(t(item.role))}</p><p>${escapeHtml(t(item.summary))}</p></article>`).join("")}</div>`;
}

function renderTeaching() {
  return `<h1>${text("教学课程", "Teaching")}</h1><div class="section-grid">${state.data.teaching.sort((a, b) => a.order - b.order).map((item) => `<article class="card"><h3>${escapeHtml(t(item.name))}</h3><p>${escapeHtml(t(item.audience))} · ${escapeHtml(item.semester)}</p><p>${escapeHtml(t(item.summary))}</p></article>`).join("")}</div>`;
}

function renderAdmissions() {
  const item = state.data.admissions;
  return `<h1>${escapeHtml(t(item.title))}</h1><article class="list-item"><p>${escapeHtml(t(item.content))}</p><a class="button-primary" href="mailto:${escapeHtml(state.data.profile.email)}">${text("邮件联系", "Contact by Email")}</a></article>`;
}

function renderNewsItem(item) {
  return `<article class="list-item"><div class="list-meta">${escapeHtml(item.date)}</div><h3>${escapeHtml(t(item.title))}</h3><p>${escapeHtml(t(item.body))}</p></article>`;
}

function renderNews() {
  return `<h1>${text("新闻动态", "News")}</h1><div class="list">${state.data.news.filter((item) => item.published).map(renderNewsItem).join("")}</div>`;
}

function renderTeam() {
  return `<h1>${text("团队成员", "Team")}</h1><div class="section-grid">${state.data.team.sort((a, b) => a.order - b.order).map((item) => `<article class="card"><h3>${escapeHtml(t(item.name))}</h3><p>${escapeHtml(t(item.role))}</p><p>${escapeHtml(t(item.research))}</p>${item.email ? `<p>${escapeHtml(item.email)}</p>` : ""}</article>`).join("")}</div>`;
}

function renderResources() {
  return `<h1>${text("资源下载", "Resources")}</h1><div class="list">${state.data.resources.map((item) => `<article class="list-item"><div class="list-meta">${escapeHtml(item.category)}</div><h3>${escapeHtml(t(item.title))}</h3><p>${escapeHtml(t(item.description))}</p>${linkButton(item.file || item.url, text("下载/查看", "Open"))}</article>`).join("")}</div>`;
}

function render() {
  if (!state.data) return;
  state.page = getRoute();
  renderNav();
  renderFooter();
  const views = {
    home: renderHome,
    profile: renderProfile,
    research: renderResearch,
    publications: renderPublications,
    projects: renderProjects,
    teaching: renderTeaching,
    admissions: renderAdmissions,
    news: renderNews,
    team: renderTeam,
    resources: renderResources
  };
  document.getElementById("app").innerHTML = views[state.page]();
  attachPublicationFilters();
  window.scrollTo({ top: 0, behavior: "instant" });
}

window.addEventListener("hashchange", render);
loadData().catch((error) => {
  document.getElementById("app").innerHTML = `<p class="status">内容加载失败：${escapeHtml(error.message)}</p>`;
});
