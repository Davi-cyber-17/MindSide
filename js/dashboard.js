document.addEventListener("DOMContentLoaded", async () => {
  const user = Api.user();
  renderShell("dashboard.html", `Bom dia, ${user ? user.name.split(" ")[0] : ""}`, "Aqui está o resumo do seu dia.");
  const content = document.getElementById("page-content");
  content.innerHTML = `<div class="grid-3">
      <div class="card stat-card hud"><div class="label-row"><h3>Tarefas pendentes</h3><span class="tick">TSK</span></div><div class="num skeleton" style="width:40px;height:32px;">&nbsp;</div><div class="label">aguardando conclusão</div></div>
      <div class="card stat-card hud"><div class="label-row"><h3>Compromissos hoje</h3><span class="tick">CAL</span></div><div class="num skeleton" style="width:40px;height:32px;">&nbsp;</div><div class="label">na agenda de hoje</div></div>
      <div class="card stat-card hud"><div class="label-row"><h3>Objetivos ativos</h3><span class="tick">GOL</span></div><div class="num skeleton" style="width:40px;height:32px;">&nbsp;</div><div class="label">em progresso</div></div>
    </div>
    <div class="grid-2" style="margin-top:18px;">
      <div>
        <div class="card list-card">
          <div class="head"><h3 class="mt-0">Próximos compromissos</h3><a class="btn btn-sm" href="compromissos.html">Ver todos</a></div>
          <div id="appt-list"></div>
        </div>
        <div class="card list-card">
          <div class="head"><h3 class="mt-0">Tarefas prioritárias</h3><a class="btn btn-sm" href="tarefas.html">Ver todas</a></div>
          <div id="task-list"></div>
        </div>
      </div>
      <div>
        <div class="card list-card">
          <div class="head"><h3 class="mt-0">Sugestões da IA</h3><a class="btn btn-sm" href="assistente.html">Assistente</a></div>
          <div id="sugg-list"></div>
        </div>
      </div>
    </div>`;

  try {
    const [tasks, appts, goals, suggestions] = await Promise.all([
      Api.listTasks(), Api.listAppointments(), Api.listGoals(), Api.listSuggestions()
    ]);

    const pendingTasks = tasks.filter(t => t.status !== "concluida");
    const today = localISO();
    const todayAppts = appts.filter(a => a.date === today);
    const activeGoals = goals.filter(g => g.status === "ativo");
    const pendingSuggestions = suggestions.filter(s => s.status === "pending" || s.status === "edited");

    document.querySelectorAll(".stat-card .num").forEach((el, i) => {
      const vals = [pendingTasks.length, todayAppts.length, activeGoals.length];
      el.textContent = vals[i]; el.classList.remove("skeleton");
    });

    const apptList = document.getElementById("appt-list");
    const upcoming = appts.filter(a => a.date >= today).slice(0, 5);
    apptList.innerHTML = upcoming.length ? upcoming.map(a => `
      <div class="item-row">
        <div class="item-main"><div class="item-title">${escapeHtml(a.title)}</div>
          <div class="meta">${a.date} · ${a.start_time.slice(0,5)}–${a.end_time.slice(0,5)}</div></div>
      </div>`).join("") : `<div class="empty-state">Nenhum compromisso agendado.</div>`;

    const taskList = document.getElementById("task-list");
    const priorityOrder = { urgente: 0, alta: 1, media: 2, baixa: 3 };
    const topTasks = [...pendingTasks].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 5);
    taskList.innerHTML = topTasks.length ? topTasks.map(t => `
      <div class="item-row">
        <div class="item-main"><div class="item-title">${escapeHtml(t.title)}</div>
          <div class="meta">${t.deadline ? "Prazo: " + t.deadline : "Sem prazo definido"}</div></div>
        <span class="badge badge-${t.priority}">${t.priority}</span>
      </div>`).join("") : `<div class="empty-state">Nenhuma tarefa pendente. 🎉</div>`;

    const suggList = document.getElementById("sugg-list");
    suggList.innerHTML = pendingSuggestions.length ? pendingSuggestions.slice(0, 4).map(s => `
      <div class="item-row"><div class="item-main"><div class="item-title">${escapeHtml(s.content)}</div>
        <div class="meta">Sugestão da IA · aguardando decisão</div></div></div>`).join("") +
      `<a class="btn btn-sm btn-primary" href="assistente.html" style="width:100%;text-align:center;margin-top:6px;display:block;">Revisar sugestões</a>`
      : `<div class="empty-state">Nenhuma sugestão pendente no momento.</div>`;

  } catch (err) {
    toast(err.message || "Erro ao carregar o dashboard.", "error");
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
