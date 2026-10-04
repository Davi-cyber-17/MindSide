let allGoals = [];

document.addEventListener("DOMContentLoaded", async () => {
  renderShell("objetivos.html", "Objetivos", "Suas metas pessoais e o progresso de cada uma.");
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="list-card card">
      <div class="head">
        <h3 class="mt-0">Todos os objetivos</h3>
        <button class="btn btn-primary" id="new-goal-btn">+ Novo objetivo</button>
      </div>
      <div id="goals-container"></div>
    </div>`;

  document.getElementById("new-goal-btn").addEventListener("click", () => openGoalModal());
  document.getElementById("goal-cancel-btn").addEventListener("click", closeGoalModal);
  document.getElementById("goal-form").addEventListener("submit", onSaveGoal);

  await loadGoals();
});

async function loadGoals() {
  const container = document.getElementById("goals-container");
  container.innerHTML = `<div class="skeleton" style="height:60px;margin-bottom:8px;"></div>`.repeat(3);
  try {
    allGoals = await Api.listGoals();
    renderGoals();
  } catch (err) {
    toast(err.message || "Erro ao carregar objetivos.", "error");
  }
}

function renderGoals() {
  const container = document.getElementById("goals-container");
  if (!allGoals.length) {
    container.innerHTML = `<div class="empty-state">Nenhum objetivo cadastrado ainda.</div>`;
    return;
  }
  container.innerHTML = allGoals.map(g => `
    <div class="item-row" style="flex-direction:column; align-items:stretch;">
      <div class="item-top">
        <div class="item-main">
          <div class="item-title">${escapeHtml(g.title)}</div>
          <div class="meta">${g.deadline ? "Prazo: " + g.deadline : "Sem prazo"} · <span class="badge badge-${g.status === 'concluido' ? 'concluida' : (g.status === 'ativo' ? 'em_andamento' : 'pendente')}">${g.status}</span></div>
        </div>
        <div class="item-actions">
          <button class="btn btn-sm" data-edit="${g.id}">Editar</button>
          <button class="btn btn-sm btn-danger" data-del="${g.id}">Excluir</button>
        </div>
      </div>
      <div style="background:var(--border); border-radius:6px; height:8px; margin-top:10px; overflow:hidden;">
        <div style="width:${g.progress}%; background:var(--red); height:100%;"></div>
      </div>
      <div class="meta" style="margin-top:4px;">${g.progress}% concluído</div>
    </div>`).join("");

  container.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openGoalModal(allGoals.find(g => g.id == btn.dataset.edit))));
  container.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", () => deleteGoal(btn.dataset.del)));
}

function openGoalModal(goal = null) {
  document.getElementById("goal-modal-title").textContent = goal ? "Editar objetivo" : "Novo objetivo";
  document.getElementById("goal-id").value = goal ? goal.id : "";
  document.getElementById("goal-title").value = goal ? goal.title : "";
  document.getElementById("goal-description").value = goal ? goal.description : "";
  document.getElementById("goal-deadline").value = goal && goal.deadline ? goal.deadline : "";
  document.getElementById("goal-progress").value = goal ? goal.progress : 0;
  document.getElementById("goal-status").value = goal ? goal.status : "ativo";
  document.getElementById("goal-modal-overlay").classList.add("open");
}
function closeGoalModal() { document.getElementById("goal-modal-overlay").classList.remove("open"); }

async function onSaveGoal(e) {
  e.preventDefault();
  const id = document.getElementById("goal-id").value;
  const payload = {
    title: document.getElementById("goal-title").value.trim(),
    description: document.getElementById("goal-description").value.trim(),
    deadline: document.getElementById("goal-deadline").value || null,
    progress: parseInt(document.getElementById("goal-progress").value) || 0,
    status: document.getElementById("goal-status").value,
  };
  try {
    if (id) { await Api.updateGoal(id, payload); toast("Objetivo atualizado.", "success"); }
    else { await Api.createGoal(payload); toast("Objetivo criado.", "success"); }
    closeGoalModal();
    await loadGoals();
  } catch (err) {
    toast(err.message || "Erro ao salvar objetivo.", "error");
  }
}

async function deleteGoal(id) {
  if (!confirm("Excluir este objetivo?")) return;
  try {
    await Api.deleteGoal(id);
    toast("Objetivo excluído.", "success");
    await loadGoals();
  } catch (err) {
    toast(err.message || "Erro ao excluir objetivo.", "error");
  }
}
