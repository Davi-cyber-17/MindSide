/* Monta a sidebar/app-shell comum a todas as páginas internas. */
const NAV_ITEMS = [
  { href: "dashboard.html", icon: "🏠", label: "Dashboard", area: "ia" },
  { href: "agenda.html", icon: "📅", label: "Agenda", area: "agenda" },
  { href: "tarefas.html", icon: "📋", label: "Tarefas", area: "tarefas" },
  { href: "compromissos.html", icon: "🗓️", label: "Compromissos", area: "compromissos" },
  { href: "objetivos.html", icon: "🎯", label: "Objetivos", area: "objetivos" },
  { href: "assistente.html", icon: "🤖", label: "Assistente", area: "ia" },
  { href: "historico.html", icon: "🕓", label: "Histórico", area: "historico" },
  { href: "configuracoes.html", icon: "⚙️", label: "Configurações", area: "configuracoes" },
];

/* Escapa texto antes de inserir em innerHTML (usado por todas as telas). */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* Data local no formato AAAA-MM-DD (toISOString usaria UTC e viraria o dia à noite no Brasil). */
function localISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function renderShell(activePage, pageTitle, pageSubtitle) {
  if (!requireAuth()) return;
  const user = Api.user() || { name: "Visitante", email: "Sessão sem login" };
  const area = document.body.getAttribute("data-area") || "ia";

  const shellRoot = document.getElementById("app-shell");
  const navHtml = NAV_ITEMS.map(item => `
    <a class="side-link ${item.href === activePage ? "active" : ""}" href="${item.href}">
      <span class="ic">${item.icon}</span> ${item.label}
    </a>`).join("");

  shellRoot.innerHTML = `
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    <aside class="sidebar" id="sidebar">
      <div class="brand"><span class="brand-dot"></span> MINDSIDE</div>
      <div class="sidebar-status"><span class="status-pill"><span class="dot"></span>SISTEMA ONLINE</span></div>
      <nav>${navHtml}</nav>
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div style="width:40px;height:32px;flex-shrink:0;" data-slime></div>
          <div>
            <div class="name">${user ? user.name : ""}</div>
            <div class="email">${user ? user.email : ""}</div>
          </div>
        </div>
        <button class="btn btn-sm" data-logout>Nova sessão</button>
      </div>
    </aside>
    <main class="main-area">
      <div class="topbar">
        <div style="display:flex; align-items:center; gap:12px;">
          <button class="menu-toggle" id="menu-toggle" aria-label="Abrir menu" aria-controls="sidebar" aria-expanded="false">☰</button>
          <div>
            <h1>${pageTitle}</h1>
            ${pageSubtitle ? `<div class="sub">${pageSubtitle}</div>` : ""}
          </div>
        </div>
        <div class="top-actions">
          <span class="status-pill" title="Os dados ficam salvos apenas neste navegador"><span class="dot"></span>DEMO · DADOS LOCAIS</span>
          <button class="theme-toggle" data-theme-toggle>🌙</button>
        </div>
      </div>
      <div id="page-content"></div>
    </main>
  `;

  // Menu lateral: no celular/tablet vira uma gaveta. Abre pelo botão ☰ e fecha
  // tocando fora (backdrop), em qualquer link, com Esc, ou ao voltar para tela larga.
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const menuBtn = document.getElementById("menu-toggle");
  function setMenu(open) {
    sidebar.classList.toggle("open", open);
    backdrop.classList.toggle("show", open);
    document.body.classList.toggle("nav-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  }
  menuBtn.addEventListener("click", () => setMenu(!sidebar.classList.contains("open")));
  backdrop.addEventListener("click", () => setMenu(false));
  sidebar.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  window.matchMedia("(min-width: 881px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  window.MindsideTheme.init();
  initLogout();
  initSlimes();
}
