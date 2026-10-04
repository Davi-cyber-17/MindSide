document.addEventListener("DOMContentLoaded", async () => {
  renderShell("historico.html", "Histórico", "Tudo o que aconteceu na sua conta, em ordem cronológica.");
  const content = document.getElementById("page-content");
  content.innerHTML = `<div class="card list-card"><div id="history-container"></div></div>`;

  const container = document.getElementById("history-container");
  container.innerHTML = `<div class="skeleton" style="height:50px;margin-bottom:8px;"></div>`.repeat(5);
  try {
    const history = await Api.listHistory();
    if (!history.length) {
      container.innerHTML = `<div class="empty-state">Nenhuma atividade registrada ainda.</div>`;
      return;
    }
    container.innerHTML = history.map(h => `
      <div class="item-row">
        <div class="item-main">
          <div class="item-title">${escapeHtml(h.description)}</div>
          <div class="meta">${new Date(h.created_at).toLocaleString("pt-BR")}</div>
        </div>
        <span class="badge badge-pendente">${h.action.replace(/_/g, " ")}</span>
      </div>`).join("");
  } catch (err) {
    toast(err.message || "Erro ao carregar histórico.", "error");
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
