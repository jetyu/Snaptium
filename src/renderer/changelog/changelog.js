import { initI18n, applyI18n, t, getLanguage } from "../i18n.js";
import { marked } from "../../utils/marked.js";

const CONFIG = {
  LANGUAGE_EN_US: "en-US",
  LANGUAGE_ZH_CN: "zh-CN",
  MAX_VISIBLE_ITEMS: 3,
};

const electronAPI = window.electronAPI;

async function resolveChangelogPath(lang) {
  if (!electronAPI?.app || !electronAPI?.path) {
    throw new Error("electronAPI 不完整，无法定位更新日志目录");
  }
  const appPath = await electronAPI.app.getAppPath();
  const filename = lang === CONFIG.LANGUAGE_EN_US ? "history_en.md" : "history_cn.md";

  const folderPath = electronAPI.path.join(appPath, "src", "assets", "changelog");
  return electronAPI.path.join(folderPath, filename);
}

async function readMarkdownFile(lang) {
  try {
    const filePath = await resolveChangelogPath(lang);
    return await electronAPI.fs.readFile(filePath, "utf8");
  } catch (error) {
    console.error("Failed to read changelog", error);
    throw error;
  }
}

function renderMarkdown(markdown, container) {
  marked.setOptions({
    gfm: true,
    breaks: true,
    sanitize: false,
  });

  const renderedHtml = marked.parse(markdown);
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = renderedHtml;

  container.innerHTML = "";

  const items = [];
  let currentItem = null;
  const versionRegex = /^\[?v?\d+\.\d+\.\d+\]?/;

  Array.from(tempDiv.childNodes).forEach((node) => {
    const isVersionHeader =
      node.nodeType === 1 &&
      node.tagName === "H3" &&
      versionRegex.test(node.textContent.trim());

    if (isVersionHeader) {
      currentItem = document.createElement("div");
      currentItem.className = "changelog-item";
      items.push(currentItem);
      container.appendChild(currentItem);
    }

    const target = currentItem || container;

    if (node.nodeType === 1 && node.tagName === "SCRIPT") {
      return;
    }

    target.appendChild(node);
  });

  items.forEach((item, index) => {
    if (index >= CONFIG.MAX_VISIBLE_ITEMS) {
      item.classList.add("hidden");
    }
  });

  if (items.length > CONFIG.MAX_VISIBLE_ITEMS) {
    const loadMoreLink = document.createElement("a");
    loadMoreLink.href = "#";
    loadMoreLink.className = "load-more-link";
    loadMoreLink.textContent = t("changelog.loadMore");
    loadMoreLink.addEventListener("click", (e) => {
      e.preventDefault();
      container.querySelectorAll(".changelog-item.hidden").forEach((item) => {
        item.classList.remove("hidden");
      });
      loadMoreLink.parentElement?.remove();
    });

    const loadMoreDiv = document.createElement("div");
    loadMoreDiv.className = "load-more";
    loadMoreDiv.appendChild(loadMoreLink);
    container.appendChild(loadMoreDiv);
  }
}

async function detectCurrentLanguage() {
  try {
    const lang = await getLanguage();
    if (lang && lang.toLowerCase().startsWith("zh")) {
      return CONFIG.LANGUAGE_ZH_CN;
    }
    return CONFIG.LANGUAGE_EN_US;
  } catch {
    return CONFIG.LANGUAGE_EN_US;
  }
}

async function initializeChangelog() {
  const container = document.getElementById("changelog-container");
  if (!container) {
    return;
  }

  try {
    await initI18n();
    await applyI18n();

    if (!electronAPI?.fs || !electronAPI?.path) {
      throw new Error("electronAPI 未提供文件系统访问能力");
    }

    const lang = await detectCurrentLanguage();
    const markdown = await readMarkdownFile(lang);
    renderMarkdown(markdown, container);
  } catch (error) {
    console.error("Failed to initialize changelog", error);
    container.textContent = error?.message || t("changelog.errors.initializationFailed");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeChangelog().catch((error) => {
    console.error("Failed to initialize changelog", error);
  });
});
