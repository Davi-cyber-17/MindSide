/* Tema claro/escuro — escuro é o padrão. Persiste entre páginas/sessões. */
(function () {
  const saved = localStorage.getItem("mindside_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);

  window.MindsideTheme = {
    current() { return localStorage.getItem("mindside_theme") || "dark"; },
    toggle() {
      const next = this.current() === "dark" ? "light" : "dark";
      localStorage.setItem("mindside_theme", next);
      document.documentElement.setAttribute("data-theme", next);
      document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
        btn.textContent = next === "dark" ? "☀️" : "🌙";
      });
    },
    init() {
      document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
        if (btn.__themeBound) return;
        btn.__themeBound = true;
        btn.textContent = this.current() === "dark" ? "☀️" : "🌙";
        btn.addEventListener("click", () => this.toggle());
      });
    }
  };
  document.addEventListener("DOMContentLoaded", () => window.MindsideTheme.init());
})();
