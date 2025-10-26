import { initI18n, applyI18n } from "../i18n.js";

function setTextContent(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value ?? "";
  }
}

async function setupAboutPage() {
  try {
    await initI18n();
    await applyI18n();
  } catch (error) {
    console.error("Failed to initialize i18n for about page", error);
  }

  const electronAPI = window.electronAPI;
  if (!electronAPI?.ipcRenderer) {
    console.error("ipcRenderer not available, cannot update about information");
    return;
  }

  const { ipcRenderer } = electronAPI;

  ipcRenderer.once("versions", (_event, versions) => {
    if (!versions) {
      return;
    }

    setTextContent("app-version", versions.app);
    setTextContent("electron-version", versions.electron);
    setTextContent("node-version", versions.node);
    setTextContent("chrome-version", versions.chrome);
    setTextContent("v8-version", versions.v8);
    setTextContent("app-author", versions.author);
    setTextContent("app-license", versions.license);
  });

  ipcRenderer.send("request-versions");
}

document.addEventListener("DOMContentLoaded", () => {
  setupAboutPage().catch((error) => {
    console.error("Failed to initialize about page", error);
  });
});
