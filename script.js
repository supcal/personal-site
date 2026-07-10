const year = document.querySelector("#year");

if (year) {
  year.textContent = new Date().getFullYear();
}

const icons = {
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>',
  building:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-7h6v7"/><path d="M8 8h.01M12 8h.01M16 8h.01M8 11h.01M12 11h.01M16 11h.01"/></svg>',
  code: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 9-4 3 4 3"/><path d="m16 9 4 3-4 3"/><path d="m14 5-4 14"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/></svg>',
};

const byField = (field) => document.querySelectorAll(`[data-field="${field}"]`);
const setText = (field, value) => {
  byField(field).forEach((node) => {
    node.textContent = value || "";
  });
};

const clearAndAppend = (selector, items) => {
  const target = document.querySelector(`[data-list="${selector}"]`);
  if (!target) return;
  target.replaceChildren(...items);
};

const create = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const iconMarkup = (name) => icons[name] || icons.link;

const addPublicationActions = (article, item) => {
  const actions = create("div", "publication-actions");
  [
    ["论文网址", item.paper_url],
    ["PDF", item.pdf_url],
    ["代码", item.code_url],
  ].forEach(([label, url]) => {
    if (!url) return;
    const link = create("a", "", label);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    actions.append(link);
  });
  if (actions.children.length) article.append(actions);
};

const renderSite = (data) => {
  document.title = `${data.name} | 天津师范大学`;
  setText("name", data.name);
  setText("role_en", data.role_en);
  setText("affiliation_cn", data.affiliation_cn);
  setText("affiliation_en", data.affiliation_en);
  setText("titles", data.titles);
  setText("hero_kicker", data.hero_kicker);
  setText("hero_title", data.hero_title);
  setText("hero_summary", data.hero_summary);
  setText("contact_note", data.contact_note);
  setText("footer_name", `${data.name} · 天津师范大学`);

  byField("portrait").forEach((node) => {
    node.src = data.portrait;
    node.alt = data.name;
    node.style.objectPosition = `${data.portrait_x || 50}% ${data.portrait_y || 50}%`;
    node.style.transform = `scale(${data.portrait_scale || 1})`;
  });

  byField("email_link").forEach((node) => {
    node.href = `mailto:${data.email}`;
    node.textContent = data.email;
  });

  byField("source_link").forEach((node) => {
    node.href = data.source_url;
  });

  clearAndAppend(
    "links",
    (data.links || []).map((item) => {
      const link = create("a", "icon-link");
      link.href = item.url;
      link.innerHTML = `${iconMarkup(item.icon)}<span>${item.label}</span>`;
      return link;
    }),
  );

  clearAndAppend(
    "stats",
    data.stats.map((item) => {
      const card = create("div");
      card.append(create("strong", "", item.value), create("span", "", item.label));
      return card;
    }),
  );

  clearAndAppend(
    "profile",
    data.profile.map((text) => create("p", "", text)),
  );

  clearAndAppend(
    "research",
    data.research.map((item, index) => {
      const article = create("article");
      article.append(
        create("span", "", String(index + 1).padStart(2, "0")),
        create("h3", "", item.title),
        create("p", "", item.description),
      );
      return article;
    }),
  );

  clearAndAppend(
    "projects",
    data.projects.map((item) => {
      const article = create("article");
      article.append(
        create("time", "", item.period),
        create("h3", "", item.title),
        create("p", "", item.description),
      );
      return article;
    }),
  );

  clearAndAppend(
    "publications",
    data.publications.map((item) => {
      const article = create("article");
      article.append(create("p", "pub-year", item.year), create("p", "", item.text));
      addPublicationActions(article, item);
      return article;
    }),
  );

  clearAndAppend(
    "all_publications",
    data.publications.map((item) => {
      const article = create("article");
      article.append(create("p", "pub-year", item.year), create("p", "", item.text));
      addPublicationActions(article, item);
      return article;
    }),
  );

  clearAndAppend(
    "courses",
    data.courses.map((item) => create("li", "", item)),
  );

  clearAndAppend(
    "awards",
    data.awards.map((item) => create("li", "", item)),
  );
};

fetch("./data.json")
  .then((response) => response.json())
  .then(renderSite)
  .catch(() => {
    document.body.classList.add("data-error");
  });
