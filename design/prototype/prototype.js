const root = document.documentElement;
const views = [...document.querySelectorAll("[data-view]")];

function showView(name) {
  for (const view of views) view.classList.toggle("is-active", view.dataset.view === name);
  window.scrollTo({ top: 0, behavior: "instant" });
}

document.querySelectorAll("[data-view-link]").forEach((el) => {
  el.addEventListener("click", (event) => {
    event.preventDefault();
    showView(el.dataset.viewLink);
  });
});

document.getElementById("analyze-button")?.addEventListener("click", () => showView("progress"));
document.getElementById("show-report")?.addEventListener("click", () => showView("report"));

document.getElementById("theme-toggle")?.addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
});

const drawer = document.getElementById("evidence-drawer");
const backdrop = document.getElementById("drawer-backdrop");
const closeEvidence = document.getElementById("close-evidence");
let lastEvidenceTrigger = null;

function setDrawer(open) {
  drawer?.classList.toggle("is-open", open);
  drawer?.setAttribute("aria-hidden", String(!open));
  if (backdrop) backdrop.hidden = !open;
  if (open) closeEvidence?.focus();
  else lastEvidenceTrigger?.focus();
}

document.querySelectorAll(".evidence-button").forEach((button) => {
  button.addEventListener("click", () => {
    lastEvidenceTrigger = button;
    setDrawer(true);
  });
});
closeEvidence?.addEventListener("click", () => setDrawer(false));
backdrop?.addEventListener("click", () => setDrawer(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawer?.classList.contains("is-open")) setDrawer(false);
});

const scoreDialog = document.getElementById("score-dialog");
document.getElementById("score-details")?.addEventListener("click", () => scoreDialog?.showModal());
