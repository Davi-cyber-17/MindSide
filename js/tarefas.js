let allTasks = [];

document.addEventListener("DOMContentLoaded", async () => {
  renderShell("tarefas.html", "Tarefas", "Organize, priorize e acompanhe suas tarefas.");
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="list-card card">
      <div class="head">
        <h3 class="mt-0">Todas as tarefas</h3>
        <button class="btn btn-primary" id="new-task-btn">+ Nova tarefa</button>
      </div>
      <div id="tasks-container"></div>
    </div>`;

  document.getElementById("new-task-btn").addEventListener("click", () => openTaskModal());
  document.getElementById("task-cancel-btn").addEventListener("click", closeTaskModal);
  document.getElementById("task-form").addEventListener("submit", onSaveTask);

  await loadTasks();
});

async function loadTasks() {
  const container = document.getElementById("tasks-container");
  container.innerHTML = `<div class="skeleton" style="height:60px;margin-bottom:8px;"></div>`.repeat(3);
  try {
    allTasks = await Api.listTasks();
    renderTasks();
  } catch (err) {
    toast(err.message || "Erro ao carregar tarefas.", "error");
  }
}

function renderTasks() {
  const container = document.getElementById("tasks-container");
  if (!allTasks.length) {
    container.innerHTML = `<div class="empty-state">Nenhuma tarefa cadastrada ainda.</div>`;
    return;
  }
  const priorityOrder = { urgente: 0, alta: 1, media: 2, baixa: 3 };
  const sorted = [...allTasks].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  container.innerHTML = sorted.map(t => `
    <div class="item-row">
      <div class="item-main">
        <div class="item-title">${escapeHtml(t.title)}</div>
        <div class="meta">${t.category} ${t.deadline ? "· Prazo: " + t.deadline : ""} ${t.scheduled_date ? "· Agendada: " + t.scheduled_date + (t.scheduled_time ? " " + t.scheduled_time.slice(0,5) : "") : ""}</div>
      </div>
      <div class="item-actions">
        <span class="badge badge-${t.priority}">${t.priority}</span>
        <span class="badge badge-${t.status}">${t.status.replace("_"," ")}</span>
        <button class="btn btn-sm" data-edit="${t.id}">Editar</button>
        <button class="btn btn-sm btn-danger" data-del="${t.id}">Excluir</button>
      </div>
    </div>`).join("");

  container.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openTaskModal(allTasks.find(t => t.id == btn.dataset.edit))));
  container.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", () => deleteTask(btn.dataset.del)));
}

function openTaskModal(task = null) {
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
  document.getElementById("task-status").value = task ? task.status : "pendente";
  document.getElementById("task-modal-overlay").classList.add("open");
}
function closeTaskModal() { document.getElementById("task-modal-overlay").classList.remove("open"); }

async function onSaveTask(e) {
  e.preventDefault();
  const id = document.getElementById("task-id").value;
  const payload = {
    title: document.getElementById("task-title").value.trim(),
    description: document.getElementById("task-description").value.trim(),
    priority: document.getElementById("task-priority").value,
    category: document.getElementById("task-category").value,
    deadline: document.getElementById("task-deadline").value || null,
    duration: parseInt(document.getElementById("task-duration").value) || 30,
    scheduled_date: document.getElementById("task-scheduled-date").value || null,
    scheduled_time: document.getElementById("task-scheduled-time").value || null,
    status: document.getElementById("task-status").value,
  };
  try {
    if (id) { await Api.updateTask(id, payload); toast("Tarefa atualizada.", "success"); }
    else { await Api.createTask(payload); toast("Tarefa criada.", "success"); }
    closeTaskModal();
    await loadTasks();
  } catch (err) {
    toast(err.message || "Erro ao salvar tarefa.", "error");
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
