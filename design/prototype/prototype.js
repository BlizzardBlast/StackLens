const root = document.documentElement;
const views = [...document.querySelectorAll("[data-view]")];
const themeToggle = document.getElementById("theme-toggle");

function showView(name) {
  for (const view of views) view.classList.toggle("is-active", view.dataset.view === name);
  window.scrollTo({ top: 0, behavior: "auto" });
  const heading = document.querySelector(`[data-view="${name}"] h1`);
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

document.querySelectorAll("[data-view-link]").forEach((el) => {
  el.addEventListener("click", (event) => {
    event.preventDefault();
    showView(el.dataset.viewLink);
  });
});

const githubTab = document.getElementById("github-tab");
const packageTab = document.getElementById("package-tab");
const githubPanel = document.getElementById("github-panel");
const packagePanel = document.getElementById("package-panel");
const analyzeButton = document.getElementById("analyze-button");
const inputError = document.getElementById("input-error");
let inputMode = "github";

function setInputMode(mode) {
  inputMode = mode;
  const githubActive = mode === "github";
  githubTab?.classList.toggle("is-selected", githubActive);
  packageTab?.classList.toggle("is-selected", !githubActive);
  githubTab?.setAttribute("aria-selected", String(githubActive));
  packageTab?.setAttribute("aria-selected", String(!githubActive));
  if (githubPanel) githubPanel.hidden = !githubActive;
  if (packagePanel) packagePanel.hidden = githubActive;
  if (analyzeButton) analyzeButton.firstChild.textContent = githubActive ? "Analyze repository " : "Analyze package.json ";
  if (inputError) inputError.hidden = true;
}

githubTab?.addEventListener("click", () => setInputMode("github"));
packageTab?.addEventListener("click", () => setInputMode("package"));

document.querySelector(".segmented")?.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const next = inputMode === "github" ? packageTab : githubTab;
  next?.focus();
  setInputMode(inputMode === "github" ? "package" : "github");
});

analyzeButton?.addEventListener("click", () => {
  if (!inputError) return;
  inputError.hidden = true;

  if (inputMode === "github") {
    const value = document.getElementById("repo-input")?.value.trim() ?? "";
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+(?:\.git)?\/?$/i.test(value)) {
      inputError.textContent = "Enter a public GitHub repository URL such as https://github.com/owner/repository.";
      inputError.hidden = false;
      return;
    }
    showView("progress");
    return;
  }

  const raw = document.getElementById("package-input")?.value ?? "";
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("manifest");
    showView("report");
  } catch {
    inputError.textContent = "Enter valid JSON for package.json. Your input has been preserved.";
    inputError.hidden = false;
  }
});

document.getElementById("show-report")?.addEventListener("click", () => showView("report"));

themeToggle?.addEventListener("click", () => {
  const dark = root.dataset.theme !== "dark";
  root.dataset.theme = dark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeToggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
});

const drawer = document.getElementById("evidence-drawer");
const closeEvidence = document.getElementById("close-evidence");
let lastEvidenceTrigger = null;

document.querySelectorAll(".evidence-button").forEach((button) => {
  button.addEventListener("click", () => {
    lastEvidenceTrigger = button;
    drawer?.showModal();
  });
});
closeEvidence?.addEventListener("click", () => drawer?.close());
drawer?.addEventListener("close", () => lastEvidenceTrigger?.focus());

const scoreDialog = document.getElementById("score-dialog");
document.getElementById("score-details")?.addEventListener("click", () => scoreDialog?.showModal());

document.getElementById("compact-category")?.addEventListener("change", (event) => {
  const target = document.getElementById(event.target.value);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
});
