let allGoals = [];
let allTasks = [];

document.addEventListener("DOMContentLoaded", async () => {
  renderShell(
    "objetivos.html",
    "Objetivos"
  );
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="summary-strip">
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Objetivos ativos</div>
          <div class="val" id="goal-sum-active">0</div>
        </div>
      </div>
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Progresso médio</div>
          <div class="val" id="goal-sum-avg">0%</div>
        </div>
      </div>
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Tarefas vinculadas</div>
          <div class="val" id="goal-sum-tasks">0</div>
        </div>
      </div>
    </div>

    <div class="list-card card">
      <div class="head">
        <div>
          <h3 class="mt-0">Suas metas e planos de ação</h3>
        </div>
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
  container.innerHTML = `<div class="skeleton" style="height:110px;margin-bottom:12px;"></div>`.repeat(2);
  try {
    [allGoals, allTasks] = await Promise.all([Api.listGoals(), Api.listTasks()]);
    updateGoalSummary();
    renderGoals();
  } catch (err) {
    toast(err.message || "Erro ao carregar objetivos.", "error");
  }
}

function updateGoalSummary() {
  const active = allGoals.filter(g => g.status === "ativo");
  const avg = active.length
    ? Math.round(active.reduce((acc, g) => acc + (g.progress || 0), 0) / active.length)
    : 0;
  const linkedTasks = allTasks.filter(t => Boolean(t.goal_id));

  document.getElementById("goal-sum-active").textContent = active.length;
  document.getElementById("goal-sum-avg").textContent = `${avg}%`;
  document.getElementById("goal-sum-tasks").textContent = linkedTasks.length;
}

function renderGoals() {
  const container = document.getElementById("goals-container");
  if (!allGoals.length) {
    container.innerHTML = `
      <div class="empty-state-box">
        <img class="sticker-img" src="assets/stickers/slime-goal.svg" alt="Sem objetivos">
        <div>Nenhum objetivo cadastrado ainda. Crie uma meta e conecte tarefas a ela!</div>
      </div>`;
    return;
  }

  container.innerHTML = allGoals.map(g => {
    const linked = allTasks.filter(t => t.goal_id === g.id);
    const doneCount = linked.filter(t => t.status === "concluida").length;
    const linkedSummary = linked.length
      ? `${doneCount} de ${linked.length} tarefa(s) vinculada(s) concluída(s)`
      : "Nenhuma tarefa vinculada — adicione uma abaixo";

    const linkedTasksHtml = linked.length ? `
      <div class="goal-linked-tasks">
        <div style="font-family:var(--font-mono); font-size:.7rem; color:var(--text-dim); margin-bottom:2px;">
          TAREFAS CONECTADAS A ESTE OBJETIVO:
        </div>
        ${linked.map(t => {
          const isDone = t.status === "concluida";
          return `
            <div class="goal-task-chip">
              <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                <span class="badge badge-${t.priority}">${t.priority}</span>
                <span style="${isDone ? 'text-decoration:line-through; color:var(--text-dim);' : 'font-weight:500;'}">
                  ${escapeHtml(t.title)}
                </span>
              </div>
              <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                <span class="badge ${isDone ? 'badge-concluida' : 'badge-pendente'}">${isDone ? "Concluída" : "Pendente"}</span>
                <button class="btn btn-xs ${isDone ? 'btn-ghost' : 'btn-approve'}" data-toggle-task="${t.id}" data-next-status="${isDone ? 'pendente' : 'concluida'}">
                  ${isDone ? "↩ Reabrir" : "✓ Concluir"}
                </button>
              </div>
            </div>`;
        }).join("")}
      </div>` : "";

    return `
      <div class="goal-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
          <div style="min-width:0; flex:1;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="item-title" style="font-size:1.02rem;">${escapeHtml(g.title)}</span>
              <span class="badge badge-${g.status === 'concluido' ? 'concluida' : (g.status === 'ativo' ? 'em_andamento' : 'pendente')}">${g.status}</span>
            </div>
            ${g.description ? `<div class="item-desc">${escapeHtml(g.description)}</div>` : ""}
            <div class="meta" style="margin-top:6px;">
              <span>${g.deadline ? "Prazo: " + g.deadline : "Sem prazo fixo"}</span>
              <span>· ${linkedSummary}</span>
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <span class="time-badge" style="font-size:.86rem; color:var(--red); border-color:rgba(255,93,118,.4);">
              ${g.progress || 0}% concluído
            </span>
            <button class="btn btn-sm" data-edit="${g.id}">Editar</button>
            <button class="btn btn-sm btn-danger" data-del="${g.id}">Excluir</button>
          </div>
        </div>

        <div class="goal-progress-track">
          <div class="goal-progress-fill" style="width:${g.progress || 0}%;"></div>
        </div>

        ${linkedTasksHtml}

        <form class="quick-link-task-form" data-goal-id="${g.id}" style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
          <input type="text" class="input-control" name="quickTitle" placeholder="+ Nova tarefa vinculada a este objetivo..." style="flex:1; min-width:200px; padding:7px 11px; font-size:.8rem;" required>
          <button type="submit" class="btn btn-sm">+ Vincular tarefa</button>
        </form>
      </div>`;
  }).join("");

  container.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openGoalModal(allGoals.find(g => g.id == btn.dataset.edit))));
  container.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", () => deleteGoal(btn.dataset.del)));

  container.querySelectorAll("[data-toggle-task]").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await Api.updateTask(btn.dataset.toggleTask, { status: btn.dataset.nextStatus });
        toast("Status da tarefa atualizado e progresso recalculado!", "success");
        await loadGoals();
      } catch (err) {
        toast(err.message || "Erro ao atualizar tarefa.", "error");
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll(".quick-link-task-form").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const goalId = parseInt(form.dataset.goalId, 10);
      const input = form.querySelector('input[name="quickTitle"]');
      const title = input.value.trim();
      if (!title) return;
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await Api.createTask({
          title,
          description: "",
          priority: "alta",
          category: "estudo",
          duration: 30,
          goal_id: goalId,
          status: "pendente",
        });
        toast("Tarefa criada e vinculada ao objetivo!", "success");
        await loadGoals();
      } catch (err) {
        toast(err.message || "Erro ao criar tarefa vinculada.", "error");
        btn.disabled = false;
      }
    });
  });
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
