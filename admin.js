const schemas = {
  stats: {
    label: "学术概览",
    addText: "添加概览",
    fields: [
      ["value", "数字"],
      ["label", "说明"],
    ],
    empty: { value: "", label: "" },
  },
  profile: {
    label: "简介段落",
    addText: "添加段落",
    type: "text",
    empty: "",
  },
  research: {
    label: "研究方向",
    addText: "添加研究方向",
    fields: [
      ["title", "标题"],
      ["description", "说明", "textarea"],
    ],
    empty: { title: "", description: "" },
  },
  projects: {
    label: "科研项目",
    addText: "添加项目",
    fields: [
      ["period", "时间"],
      ["title", "项目名称"],
      ["description", "说明", "textarea"],
    ],
    empty: { period: "", title: "", description: "" },
  },
  publications: {
    label: "代表性论文",
    addText: "添加论文",
    fields: [
      ["year", "年份"],
      ["text", "论文信息", "textarea"],
    ],
    empty: { year: "", text: "" },
  },
  courses: {
    label: "讲授课程",
    addText: "添加课程",
    type: "text",
    empty: "",
  },
  awards: {
    label: "奖励情况",
    addText: "添加奖励",
    type: "text",
    empty: "",
  },
};

let siteData = {};

const clone = (value) => JSON.parse(JSON.stringify(value));
const inputFor = (path) => document.querySelector(`[data-path="${path}"]`);

const setByPath = (path, value) => {
  siteData[path] = value;
};

const makeLabel = (labelText, input) => {
  const label = document.createElement("label");
  label.textContent = labelText;
  label.append(input);
  return label;
};

const makeInput = (value, onInput, multiline = false) => {
  const input = document.createElement(multiline ? "textarea" : "input");
  if (multiline) input.rows = 3;
  input.value = value || "";
  input.addEventListener("input", () => {
    onInput(input.value);
    renderAll();
  });
  return input;
};

const renderRepeatable = (key) => {
  const schema = schemas[key];
  const container = document.querySelector(`[data-repeat="${key}"]`);
  const template = document.querySelector("#rowTemplate");
  if (!container || !template) return;

  container.dataset.label = schema.label;
  container.replaceChildren();

  siteData[key].forEach((item, index) => {
    const row = template.content.firstElementChild.cloneNode(true);
    const fields = row.querySelector(".row-fields");

    if (schema.type === "text") {
      const input = makeInput(item, (value) => {
        siteData[key][index] = value;
      }, true);
      fields.append(makeLabel("内容", input));
    } else {
      schema.fields.forEach(([field, labelText, type]) => {
        const input = makeInput(item[field], (value) => {
          siteData[key][index][field] = value;
        }, type === "textarea");
        const label = makeLabel(labelText, input);
        if (type === "textarea") label.classList.add("full");
        fields.append(label);
      });
    }

    row.querySelector('[data-action="remove"]').addEventListener("click", () => {
      siteData[key].splice(index, 1);
      renderAll();
    });

    row.querySelector('[data-action="up"]').addEventListener("click", () => {
      if (index === 0) return;
      [siteData[key][index - 1], siteData[key][index]] = [
        siteData[key][index],
        siteData[key][index - 1],
      ];
      renderAll();
    });

    row.querySelector('[data-action="down"]').addEventListener("click", () => {
      if (index === siteData[key].length - 1) return;
      [siteData[key][index + 1], siteData[key][index]] = [
        siteData[key][index],
        siteData[key][index + 1],
      ];
      renderAll();
    });

    container.append(row);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "add-row";
  add.textContent = schema.addText;
  add.addEventListener("click", () => {
    siteData[key].push(clone(schema.empty));
    renderAll();
  });
  container.append(add);
};

const updatePrimitiveInputs = () => {
  document.querySelectorAll("[data-path]").forEach((input) => {
    input.value = siteData[input.dataset.path] || "";
  });
};

const updatePreview = () => {
  document.querySelector("#previewKicker").textContent = siteData.hero_kicker || "";
  document.querySelector("#previewTitle").textContent = siteData.hero_title || "";
  document.querySelector("#previewSummary").textContent = siteData.hero_summary || "";
  document.querySelector("#previewName").textContent = siteData.name || "";
  document.querySelector("#previewEmail").textContent = siteData.email || "";
  document.querySelector("#jsonPreview").value = JSON.stringify(siteData, null, 2);
};

const renderAll = () => {
  updatePrimitiveInputs();
  Object.keys(schemas).forEach(renderRepeatable);
  updatePreview();
};

const downloadJson = () => {
  const blob = new Blob([JSON.stringify(siteData, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "data.json";
  link.click();
  URL.revokeObjectURL(url);
};

const copyJson = async () => {
  await navigator.clipboard.writeText(JSON.stringify(siteData, null, 2));
  const button = document.querySelector("#copyJson");
  const original = button.textContent;
  button.textContent = "已复制";
  window.setTimeout(() => {
    button.textContent = original;
  }, 1400);
};

const bindPrimitiveInputs = () => {
  document.querySelectorAll("[data-path]").forEach((input) => {
    input.addEventListener("input", () => {
      setByPath(input.dataset.path, input.value);
      updatePreview();
    });
  });
};

fetch("./data.json")
  .then((response) => response.json())
  .then((data) => {
    siteData = data;
    bindPrimitiveInputs();
    renderAll();
  });

document.querySelector("#downloadJson").addEventListener("click", downloadJson);
document.querySelector("#copyJson").addEventListener("click", copyJson);
