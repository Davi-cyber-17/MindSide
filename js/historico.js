let allHistory = [];
let currentHistFilter = "todos";

function classifyAction(action = "") {
  const a = action.toLowerCase();
  if (a.includes("sugest") || a.includes("ia") || a.includes("analis")) {
    return { group: "ia", label: "Decisão / IA", badgeClass: "badge-concluida" };
  }
  if (a.includes("taref") || a.includes("task")) {
    return { group: "tarefas", label: "Tarefa", badgeClass: "badge-media" };
  }
  if (a.includes("compromisso") || a.includes("appt") || a.includes("agenda")) {
    return { group: "compromissos", label: "Compromisso", badgeClass: "badge-em_andamento" };
  }
  if (a.includes("objetivo") || a.includes("goal") || a.includes("meta")) {
    return { group: "objetivos", label: "Objetivo", badgeClass: "badge-urgente" };
  }
  return { group: "sistema", label: "Sistema", badgeClass: "badge-pendente" };
}

document.addEventListener("DOMContentLoaded", async () => {
  renderShell(
    "historico.html",
    "Histórico"
  );
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="card list-card">
      <div class="head">
        <div>
          <h3 class="mt-0">Linha do tempo de eventos</h3>
        </div>
        <span class="badge badge-concluida" id="hist-count-badge">0 registros</span>
      </div>

      <div class="toolbar-row">
        <div class="filter-bar" id="hist-filters">
          <button class="filter-chip active" data-filter="todos">Todos os eventos</button>
          <button class="filter-chip" data-filter="ia">IA & Sugestões</button>
          <button class="filter-chip" data-filter="tarefas">Tarefas</button>
          <button class="filter-chip" data-filter="compromissos">Compromissos</button>
          <button class="filter-chip" data-filter="objetivos">Objetivos</button>
        </div>
      </div>

      <div id="history-container"></div>
    </div>`;

  document.querySelectorAll("#hist-filters [data-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#hist-filters [data-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentHistFilter = btn.dataset.filter;
      renderHistory();
    });
  });

  const container = document.getElementById("history-container");
  container.innerHTML = `<div class="skeleton" style="height:56px;margin-bottom:8px;"></div>`.repeat(4);
  try {
    allHistory = await Api.listHistory();
    document.getElementById("hist-count-badge").textContent = `${allHistory.length} registro(s)`;
    renderHistory();
  } catch (err) {
    toast(err.message || "Erro ao carregar histórico.", "error");
  }
});

function renderHistory() {
  const container = document.getElementById("history-container");
  const filtered = allHistory.filter(h => {
    if (currentHistFilter === "todos") return true;
    return classifyAction(h.action).group === currentHistFilter;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state-box">
        <img class="sticker-img" src="assets/stickers/slime-empty.svg" alt="Sem histórico">
        <div>Nenhuma atividade registrada para este filtro ainda.</div>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(h => {
    const info = classifyAction(h.action);
    return `
      <div class="item-row">
        <div>
          <div class="item-title">${escapeHtml(h.description)}</div>
          <div class="meta">
            <span>${new Date(h.created_at).toLocaleString("pt-BR")}</span>
            <span>· Evento: ${escapeHtml(h.action.replace(/_/g, " "))}</span>
          </div>
        </div>
        <span class="badge ${info.badgeClass}">${info.label}</span>
      </div>`;
  }).join("");
}
