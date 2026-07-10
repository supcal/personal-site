const year = document.querySelector("#year");

if (year) {
  year.textContent = new Date().getFullYear();
}

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
  });

  byField("email_link").forEach((node) => {
    node.href = `mailto:${data.email}`;
    node.textContent = data.email;
  });

  byField("source_link").forEach((node) => {
    node.href = data.source_url;
  });

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
