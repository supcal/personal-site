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
  links: {
    label: "图标链接",
    addText: "添加链接",
    fields: [
      ["label", "名称"],
      ["url", "地址"],
      ["icon", "图标 mail/building/code/link"],
    ],
    empty: { label: "", url: "", icon: "link" },
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
      ["paper_url", "论文网址"],
      ["pdf_url", "PDF 链接"],
      ["code_url", "代码链接"],
    ],
    empty: { year: "", text: "", paper_url: "", pdf_url: "", code_url: "" },
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
let isDirty = false;

const storageKey = "personal-site-editor-draft";
const authKey = "personal-site-editor-auth";
const passwordHash = "5c130f4a86c9beb7406caf830eec4414010c5132fcae42875768efb6c6417c45";
const clone = (value) => JSON.parse(JSON.stringify(value));
const inputFor = (path) => document.querySelector(`[data-path="${path}"]`);

const hashText = async (text) => {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const unlockEditor = () => {
  document.body.classList.remove("locked");
  document.querySelector("#authScreen").hidden = true;
};

const bindAuth = () => {
  if (sessionStorage.getItem(authKey) === "ok") {
    unlockEditor();
    return;
  }

  document.querySelector("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#editorPassword").value;
    const error = document.querySelector("#authError");
    if ((await hashText(password)) === passwordHash) {
      sessionStorage.setItem(authKey, "ok");
      unlockEditor();
      return;
    }
    error.textContent = "密码不正确";
  });
};

const setByPath = (path, value) => {
  siteData[path] = value;
};

const updateSaveStatus = (message) => {
  const status = document.querySelector("#saveStatus");
  if (status) status.textContent = message;
};

const markDirty = () => {
  isDirty = true;
  updateSaveStatus("有未保存修改");
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
    markDirty();
    renderAll();
  });
  return input;
};

const renderRepeatable = (key) => {
  const schema = schemas[key];
  const container = document.querySelector(`[data-repeat="${key}"]`);
  const template = document.querySelector("#rowTemplate");
  if (!container || !template) return;

  if (!Array.isArray(siteData[key])) siteData[key] = [];
  container.dataset.label = schema.label;
  container.replaceChildren();

  siteData[key].forEach((item, index) => {
    const row = template.content.firstElementChild.cloneNode(true);
    const fields = row.querySelector(".row-fields");

    if (schema.type === "text") {
      fields.append(
        makeLabel(
          "内容",
          makeInput(item, (value) => {
            siteData[key][index] = value;
          }, true),
        ),
      );
    } else {
      schema.fields.forEach(([field, labelText, type]) => {
        const input = makeInput(item[field], (value) => {
          siteData[key][index][field] = value;
        }, type === "textarea");
        const label = makeLabel(labelText, input);
        if (type === "textarea") label.classList.add("full");
        fields.append(label);
      });

      if (key === "publications") {
        const upload = document.createElement("input");
        upload.type = "file";
        upload.accept = "application/pdf";
        upload.addEventListener("change", () => {
          const [file] = upload.files;
          if (!file) return;
          const reader = new FileReader();
          reader.addEventListener("load", () => {
            siteData[key][index].pdf_url = reader.result;
            markDirty();
            renderAll();
          });
          reader.readAsDataURL(file);
        });
        fields.append(makeLabel("上传 PDF", upload));
      }
    }

    row.querySelector('[data-action="remove"]').addEventListener("click", () => {
      siteData[key].splice(index, 1);
      markDirty();
      renderAll();
    });

    row.querySelector('[data-action="up"]').addEventListener("click", () => {
      if (index === 0) return;
      [siteData[key][index - 1], siteData[key][index]] = [
        siteData[key][index],
        siteData[key][index - 1],
      ];
      markDirty();
      renderAll();
    });

    row.querySelector('[data-action="down"]').addEventListener("click", () => {
      if (index === siteData[key].length - 1) return;
      [siteData[key][index + 1], siteData[key][index]] = [
        siteData[key][index],
        siteData[key][index + 1],
      ];
      markDirty();
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
    markDirty();
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

  const portrait = document.querySelector("#previewPortrait");
  portrait.src = siteData.portrait || "";
  portrait.style.objectPosition = `${siteData.portrait_x || 50}% ${siteData.portrait_y || 50}%`;
  portrait.style.transform = `scale(${siteData.portrait_scale || 1})`;

  document.querySelector("#jsonPreview").value = JSON.stringify(siteData, null, 2);
};

const renderAll = () => {
  updatePrimitiveInputs();
  Object.keys(schemas).forEach(renderRepeatable);
  updatePreview();
};

const saveDraft = () => {
  localStorage.setItem(storageKey, JSON.stringify(siteData));
  isDirty = false;
  updateSaveStatus(`已保存到浏览器草稿：${new Date().toLocaleString()}`);
};

const downloadJson = () => {
  if (isDirty) saveDraft();
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
  if (isDirty) saveDraft();
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
      markDirty();
      updatePreview();
    });
  });
};

const bindPortraitUpload = () => {
  const input = document.querySelector("#portraitUpload");
  input.addEventListener("change", () => {
    const [file] = input.files;
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      siteData.portrait = reader.result;
      inputFor("portrait").value = siteData.portrait;
      markDirty();
      updatePreview();
    });
    reader.readAsDataURL(file);
  });
};

fetch("./data.json")
  .then((response) => response.json())
  .then((data) => {
    const saved = localStorage.getItem(storageKey);
    siteData = saved ? JSON.parse(saved) : data;
    bindPrimitiveInputs();
    bindPortraitUpload();
    renderAll();
    updateSaveStatus(saved ? "已加载浏览器本地草稿" : "尚未保存本次修改");
  });

document.querySelector("#saveDraft").addEventListener("click", saveDraft);
document.querySelector("#downloadJson").addEventListener("click", downloadJson);
document.querySelector("#copyJson").addEventListener("click", copyJson);
bindAuth();
