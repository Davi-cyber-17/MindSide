/* Monta a sidebar/app-shell comum a todas as páginas internas. */
const NAV_ITEMS = [
  { href: "dashboard.html", icon: "dashboard", label: "Dashboard", area: "ia", group: "rotina" },
  { href: "assistente.html", icon: "assistente", label: "Assistente IA", area: "ia", group: "rotina" },
  { href: "agenda.html", icon: "agenda", label: "Agenda Semanal", area: "agenda", group: "rotina" },
  { href: "tarefas.html", icon: "tarefas", label: "Tarefas", area: "tarefas", group: "rotina" },
  { href: "compromissos.html", icon: "compromissos", label: "Compromissos", area: "compromissos", group: "rotina" },
  { href: "objetivos.html", icon: "objetivos", label: "Objetivos", area: "objetivos", group: "rotina" },
  { href: "historico.html", icon: "historico", label: "Histórico", area: "historico", group: "sistema" },
  { href: "configuracoes.html", icon: "configuracoes", label: "Configurações", area: "configuracoes", group: "sistema" },
];

const NAV_ICONS = {
  dashboard: `<svg viewBox="0 0 32 32" aria-hidden="true"><path class="icon-fill" d="M3 14.5 16 3l13 11.5v14H3z"/><path d="M2 14.5 16 2l14 12.5M5 13v16h22V13M12 29V18h8v11M9 14h4v4H9z"/></svg>`,
  agenda: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect class="icon-fill" x="3" y="6" width="26" height="23" rx="4"/><path d="M3 13h26M10 3v7M22 3v7M10 18h2m7 0h2m-11 6h2m7 0h2" stroke-linecap="round" stroke-width="2.5"/></svg>`,
  tarefas: `<svg viewBox="0 0 32 32" aria-hidden="true"><path class="icon-fill" d="M8 6h16a3 3 0 0 1 3 3v19H5V9a3 3 0 0 1 3-3Z"/><path d="M12 6V4a4 4 0 0 1 8 0v2M10 14h12M10 19h12M10 24h8" stroke-linecap="round"/><circle cx="7" cy="14" r=".7"/><circle cx="7" cy="19" r=".7"/><circle cx="7" cy="24" r=".7"/></svg>`,
  compromissos: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect class="icon-fill" x="3" y="6" width="26" height="23" rx="4"/><path d="M3 13h26M10 3v7M22 3v7M8 19h3m5 0h3m5 0h1m-17 5h3m4-1 2 2 5-5" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/></svg>`,
  objetivos: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle class="icon-fill" cx="14" cy="18" r="11"/><circle cx="14" cy="18" r="7"/><circle cx="14" cy="18" r="3"/><path d="m14 18 13-13m-5 0h5v5m-8-1 4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  assistente: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3v3M10 5l2 2M22 5l-2 2" stroke-linecap="round"/><rect x="14.5" y="7" width="3" height="3" rx=".8" fill="currentColor"/><path class="icon-fill" d="M10 12h12v2h2v2h2v9h-2v2H8v-2H6v-9h2v-2h2v-2Z"/><path d="M10 12h12v2h2v2h2v9h-2v2H8v-2H6v-9h2v-2h2v-2Z" stroke-linejoin="round"/><rect x="11" y="18" width="2.5" height="2.5" fill="currentColor"/><rect x="18.5" y="18" width="2.5" height="2.5" fill="currentColor"/><path d="M13.5 23h5" stroke-linecap="round"/></svg>`,
  historico: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle class="icon-fill" cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="10"/><path d="M16 9v7l5 4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 4v2M28 16h-2M16 28v-2M4 16h2" stroke-linecap="round"/></svg>`,
  configuracoes: `<svg viewBox="0 0 32 32" aria-hidden="true"><path class="icon-fill" d="m13 3 6 0 1 4 3 1 3-2 4 5-2 3v4l2 3-4 5-3-2-3 1-1 4h-6l-1-4-3-1-3 2-4-5 2-3v-4l-2-3 4-5 3 2 3-1z"/><circle cx="16" cy="16" r="6"/><circle cx="16" cy="16" r="2.5"/></svg>`,
};

function formatUserSubtitle(email) {
  if (!email) return "Sessão local isolada";
  if (email.startsWith("guest_") && email.endsWith("@example.com")) {
    return "Sessão visitante";
  }
  return email;
}

function formatTodayHeader() {
  const now = new Date();
  return now.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).toUpperCase().replace(".", "");
}

function renderShell(activePage, pageTitle, pageSubtitle) {
  if (!requireAuth()) return;
  const user = Api.user() || { name: "Visitante", email: "Sessão sem login" };

  const shellRoot = document.getElementById("app-shell");
  const rotinaItems = NAV_ITEMS.filter(i => i.group === "rotina");
  const sistemaItems = NAV_ITEMS.filter(i => i.group === "sistema");

  const renderLinks = (items) => items.map(item => `
    <a class="side-link ${item.href === activePage ? "active" : ""}" href="${item.href}" ${item.href === activePage ? 'aria-current="page"' : ""}>
      <span class="ic ic-${item.icon}">${NAV_ICONS[item.icon]}</span>
      <span>${item.label}</span>
    </a>`).join("");

  const showQuickAssistant = activePage !== "assistente.html";

  if (!document.querySelector('link[rel="icon"]')) {
    const fav = document.createElement("link");
    fav.rel = "icon";
    fav.type = "image/svg+xml";
    fav.href = "assets/stickers/slime-default.svg";
    document.head.appendChild(fav);
  }

  shellRoot.innerHTML = `
    <div class="sidebar-overlay" id="sidebar-overlay" aria-hidden="true"></div>
    <aside class="sidebar" id="sidebar" aria-label="Navegação principal">
      <div class="sidebar-header-row">
        <a class="brand" href="index.html"><span class="brand-dot"></span> MINDSIDE</a>
        <button class="sidebar-close" id="sidebar-close" aria-label="Fechar menu de navegação">✕</button>
      </div>
      <nav>
        <div class="sidebar-nav-label">Rotina</div>
        ${renderLinks(rotinaItems)}
        <div class="sidebar-nav-label" style="margin-top:10px;">Sistema</div>
        ${renderLinks(sistemaItems)}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user" title="${escapeHtml(user.email || "")}">
          <div style="width:38px;height:32px;flex-shrink:0;" data-slime></div>
          <div class="sidebar-user-info">
            <div class="name">${escapeHtml(user ? user.name : "Visitante")}</div>
            <div class="email">${escapeHtml(formatUserSubtitle(user ? user.email : ""))}</div>
          </div>
        </div>
        <button class="btn btn-sm btn-ghost" data-logout title="Reiniciar uma nova sessão limpa">↻ Nova sessão</button>
      </div>
    </aside>
    <main class="main-area">
      <header class="topbar">
        <div class="topbar-title-group">
          <button class="menu-toggle" id="menu-toggle" aria-label="Abrir menu de navegação">☰</button>
          <span class="topbar-accent-bar" aria-hidden="true"></span>
          <div>
            <h1>${pageTitle}</h1>
            ${pageSubtitle ? `<div class="sub">${pageSubtitle}</div>` : ""}
          </div>
        </div>
        <div class="top-actions">
          <span class="topbar-date-pill" title="Data de referência da rotina">${formatTodayHeader()}</span>
          ${showQuickAssistant ? `<a class="btn btn-sm btn-primary" href="assistente.html">Organizar com IA</a>` : ""}
          <button class="theme-toggle" data-theme-toggle aria-label="Mudar para tema claro"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg></button>
        </div>
      </header>
      <div id="page-content"></div>
    </main>
  `;

  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const closeSidebar = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  };
  document.getElementById("menu-toggle").addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    overlay.classList.toggle("open", isOpen);
  });
  document.getElementById("sidebar-close").addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });

  window.MindsideTheme.init();
  initLogout();
  initSlimes();
}
