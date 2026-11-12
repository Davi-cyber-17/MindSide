let allTasks = [];
let allGoals = [];
let currentFilter = "todas";
let currentPriorityFilter = "todas";
let searchQuery = "";

document.addEventListener("DOMContentLoaded", async () => {
  renderShell(
    "tarefas.html",
    "Tarefas"
  );
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="summary-strip" id="task-summary-strip">
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Tarefas ativas</div>
          <div class="val" id="sum-active">0</div>
        </div>
      </div>
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Concluídas</div>
          <div class="val" id="sum-done">0</div>
        </div>
      </div>
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Tempo de foco pendente</div>
          <div class="val" id="sum-focus-time">0 min</div>
        </div>
      </div>
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Conectadas a metas</div>
          <div class="val" id="sum-linked">0</div>
        </div>
      </div>
    </div>

    <div class="list-card card">
      <div class="head">
        <div>
          <h3 class="mt-0">Lista de tarefas</h3>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a class="btn btn-sm btn-ghost" href="assistente.html">Criar via IA</a>
          <button class="btn btn-primary" id="new-task-btn">+ Nova tarefa</button>
        </div>
      </div>

      <div class="toolbar-row">
        <div class="filter-bar" id="task-filters">
          <button class="filter-chip active" data-filter="todas">Todas</button>
          <button class="filter-chip" data-filter="pendente">Pendentes</button>
          <button class="filter-chip" data-filter="em_andamento">Em andamento</button>
          <button class="filter-chip" data-filter="concluida">Concluídas</button>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; flex:1; justify-content:flex-end;">
          <select id="priority-filter-select" class="input-control" style="width:auto; flex:1 1 170px; max-width:240px; padding:6px 30px 6px 10px; font-size:.78rem;" aria-label="Filtrar por prioridade">
            <option value="todas">Todas as prioridades</option>
            <option value="urgente">Prioridade: Urgente</option>
            <option value="alta">Prioridade: Alta</option>
            <option value="media">Prioridade: Média</option>
            <option value="baixa">Prioridade: Baixa</option>
          </select>
          <div class="search-box">
            <span class="search-icon"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="14.5" cy="9.5" r="6"/><path d="M10.2 13.8 3.5 20.5"/></svg></span>
            <input type="text" id="task-search" placeholder="Buscar tarefa ou categoria..." aria-label="Buscar tarefas">
          </div>
        </div>
      </div>

      <div id="tasks-container"></div>
    </div>`;

  document.getElementById("new-task-btn").addEventListener("click", () => openTaskModal());
  document.getElementById("task-cancel-btn").addEventListener("click", closeTaskModal);
  document.getElementById("task-form").addEventListener("submit", onSaveTask);

  document.querySelectorAll("#task-filters [data-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#task-filters [data-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  document.getElementById("priority-filter-select").addEventListener("change", (e) => {
    currentPriorityFilter = e.target.value;
    renderTasks();
  });

  document.getElementById("task-search").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderTasks();
  });

  await loadTasks();
});

async function loadTasks() {
  const container = document.getElementById("tasks-container");
  container.innerHTML = `<div class="skeleton" style="height:64px;margin-bottom:8px;"></div>`.repeat(3);
  try {
    [allTasks, allGoals] = await Promise.all([Api.listTasks(), Api.listGoals()]);
    populateGoalSelect();
    updateSummaryStrip();
    renderTasks();
  } catch (err) {
    toast(err.message || "Erro ao carregar tarefas.", "error");
  }
}

function updateSummaryStrip() {
  const active = allTasks.filter(t => t.status !== "concluida");
  const done = allTasks.filter(t => t.status === "concluida");
  const focusMin = active.reduce((acc, t) => acc + (t.duration || 30), 0);
  const linked = allTasks.filter(t => Boolean(t.goal_id));

  document.getElementById("sum-active").textContent = active.length;
  document.getElementById("sum-done").textContent = done.length;
  document.getElementById("sum-focus-time").textContent = focusMin >= 60
    ? `${Math.floor(focusMin / 60)}h ${focusMin % 60}m`
    : `${focusMin} min`;
  document.getElementById("sum-linked").textContent = linked.length;
}

function populateGoalSelect() {
  const sel = document.getElementById("task-goal-id");
  if (!sel) return;
  sel.innerHTML = `<option value="">Sem vínculo com objetivo</option>` +
    allGoals.map(g => `<option value="${g.id}">${escapeHtml(g.title)} (${g.progress}%)</option>`).join("");
}

function renderTasks() {
  const container = document.getElementById("tasks-container");
  const filtered = allTasks.filter(t => {
    if (currentFilter !== "todas" && t.status !== currentFilter) return false;
    if (currentPriorityFilter !== "todas" && t.priority !== currentPriorityFilter) return false;
    if (searchQuery) {
      const hay = `${t.title || ""} ${t.description || ""} ${t.category || ""}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state-box">
        <img class="sticker-img" src="assets/stickers/slime-focus.svg" alt="Sem tarefas">
        <div>Nenhuma tarefa encontrada para os filtros selecionados.</div>
      </div>`;
    return;
  }

  const priorityOrder = { urgente: 0, alta: 1, media: 2, baixa: 3 };
  const statusOrder = { em_andamento: 0, pendente: 1, concluida: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  const goalMap = Object.fromEntries(allGoals.map(g => [g.id, g.title]));
  const today = localTodayIso();

  container.innerHTML = sorted.map(t => {
    const isDone = t.status === "concluida";
    const goalTitle = t.goal_id && goalMap[t.goal_id] ? escapeHtml(goalMap[t.goal_id]) : "";
    const isOverdue = !isDone && t.deadline && t.deadline < today;
    return `
      <div class="item-row" style="${isDone ? 'opacity:.72; border-left-color:var(--green);' : ''}">
        <div style="min-width:0; flex:1;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="item-title" style="${isDone ? 'text-decoration:line-through; color:var(--text-dim);' : ''}">${escapeHtml(t.title)}</span>
            <span class="badge badge-${t.priority}">${t.priority}</span>
            <span class="badge badge-${t.status}">${t.status === "em_andamento" ? "em andamento" : (t.status === "concluida" ? "concluída" : "pendente")}</span>
            ${isOverdue ? `<span class="badge badge-urgente">Prazo vencido</span>` : ""}
          </div>
          ${t.description ? `<div class="item-desc">${escapeHtml(t.description)}</div>` : ""}
          <div class="meta">
            <span>${escapeHtml(t.category)}</span>
            <span>· ${t.duration || 30} min</span>
            ${t.deadline ? `<span>· Prazo: ${t.deadline}</span>` : ""}
            ${t.scheduled_date ? `<span>· Agendada: ${t.scheduled_date}${t.scheduled_time ? " às " + t.scheduled_time.slice(0,5) : ""}</span>` : ""}
            ${goalTitle ? `<span style="color:var(--green);">· ${goalTitle}</span>` : ""}
          </div>
        </div>
        <div class="item-actions">
          ${!isDone
            ? `<button class="btn btn-sm btn-approve" data-done="${t.id}" title="Marcar tarefa como concluída">✓ Concluir</button>`
            : `<button class="btn btn-sm btn-ghost" data-reopen="${t.id}" title="Reabrir tarefa">↩ Reabrir</button>`}
          <button class="btn btn-sm" data-edit="${t.id}">Editar</button>
          <button class="btn btn-sm btn-danger" data-del="${t.id}">Excluir</button>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll("[data-done]").forEach(btn =>
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await Api.updateTask(btn.dataset.done, { status: "concluida" });
        toast("Tarefa concluída! O progresso do objetivo vinculado foi recalculado.", "success");
        await loadTasks();
      } catch (err) {
        toast(err.message || "Erro ao concluir tarefa.", "error");
        btn.disabled = false;
      }
    }));

  container.querySelectorAll("[data-reopen]").forEach(btn =>
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await Api.updateTask(btn.dataset.reopen, { status: "pendente" });
        toast("Tarefa reaberta.", "info");
        await loadTasks();
      } catch (err) {
        toast(err.message || "Erro ao reabrir tarefa.", "error");
        btn.disabled = false;
      }
    }));

  container.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openTaskModal(allTasks.find(t => t.id == btn.dataset.edit))));
  container.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", () => deleteTask(btn.dataset.del)));
}

function openTaskModal(task = null) {
  const warnBox = document.getElementById("task-conflict-warning");
  if (warnBox) warnBox.style.display = "none";
  document.getElementById("task-modal-title").textContent = task ? "Editar tarefa" : "Nova tarefa";
  document.getElementById("task-id").value = task ? task.id : "";
  document.getElementById("task-title").value = task ? task.title : "";
  document.getElementById("task-description").value = task ? task.description : "";
  document.getElementById("task-priority").value = task ? task.priority : "media";
  document.getElementById("task-category").value = task ? task.category : "geral";
  document.getElementById("task-deadline").value = task && task.deadline ? task.deadline : "";
  document.getElementById("task-duration").value = task ? task.duration : 30;
  document.getElementById("task-scheduled-date").value = task && task.scheduled_date ? task.scheduled_date : "";
  document.getElementById("task-scheduled-time").value = task && task.scheduled_time ? task.scheduled_time.slice(0,5) : "";
  document.getElementById("task-goal-id").value = task && task.goal_id ? task.goal_id : "";
  document.getElementById("task-status").value = task ? task.status : "pendente";
  document.getElementById("task-modal-overlay").classList.add("open");
}
function closeTaskModal() { document.getElementById("task-modal-overlay").classList.remove("open"); }

async function onSaveTask(e) {
  e.preventDefault();
  const id = document.getElementById("task-id").value;
  const warnBox = document.getElementById("task-conflict-warning");
  if (warnBox) warnBox.style.display = "none";
  const goalVal = document.getElementById("task-goal-id").value;
  const payload = {
    title: document.getElementById("task-title").value.trim(),
    description: document.getElementById("task-description").value.trim(),
    priority: document.getElementById("task-priority").value,
    category: document.getElementById("task-category").value,
    deadline: document.getElementById("task-deadline").value || null,
    duration: parseInt(document.getElementById("task-duration").value) || 30,
    scheduled_date: document.getElementById("task-scheduled-date").value || null,
    scheduled_time: document.getElementById("task-scheduled-time").value || null,
    goal_id: goalVal ? parseInt(goalVal, 10) : null,
    status: document.getElementById("task-status").value,
  };
  try {
    if (id) { await Api.updateTask(id, payload); toast("Tarefa atualizada.", "success"); }
    else { await Api.createTask(payload); toast("Tarefa criada.", "success"); }
    closeTaskModal();
    await loadTasks();
  } catch (err) {
    if (err.status === 409 && warnBox) {
      const conflicts = (err.raw && err.raw.detail && err.raw.detail.conflicts) || [];
      warnBox.textContent = "Conflito de horário com: " + conflicts.map(c => `${c.title} (${c.start_time}–${c.end_time})`).join(", ");
      warnBox.style.display = "block";
    } else {
      toast(err.message || "Erro ao salvar tarefa.", "error");
    }
  }
}

async function deleteTask(id) {
  if (!confirm("Excluir esta tarefa?")) return;
  try {
    await Api.deleteTask(id);
    toast("Tarefa excluída.", "success");
    await loadTasks();
  } catch (err) {
    toast(err.message || "Erro ao excluir tarefa.", "error");
  }
}
