/* Tema claro/escuro — escuro é o padrão. Persiste entre páginas/sessões. */
(function () {
  const saved = localStorage.getItem("mindside_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);

  const ICON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>`;

  function labelFor(theme) {
    return theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro";
  }

  function paint(btn, theme) {
    btn.innerHTML = ICON;
    btn.setAttribute("aria-label", labelFor(theme));
    btn.setAttribute("title", labelFor(theme));
  }

  window.MindsideTheme = {
    current() { return localStorage.getItem("mindside_theme") || "dark"; },
    toggle() {
      const next = this.current() === "dark" ? "light" : "dark";
      localStorage.setItem("mindside_theme", next);
      document.documentElement.setAttribute("data-theme", next);
      document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
        paint(btn, next);
      });
    },
    init() {
      const curr = this.current();
      document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
        paint(btn, curr);
        if (btn.__themeBound) return;
        btn.__themeBound = true;
        btn.addEventListener("click", () => this.toggle());
      });
    }
  };
  document.addEventListener("DOMContentLoaded", () => window.MindsideTheme.init());
})();
