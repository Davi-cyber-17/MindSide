document.addEventListener("DOMContentLoaded", async () => {
  const user = Api.user();
  renderShell(
    "dashboard.html",
    `Olá, ${user && user.name ? user.name.split(" ")[0] : "Visitante"}`
  );
  await loadDashboard();
});

function formatPtDate(iso) {
  if (!iso) return "";
  const today = localTodayIso();
  if (iso === today) return "Hoje";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

function detectAppointmentOverlaps(appts) {
  const overlaps = [];
  const byDate = {};
  appts.forEach(a => {
    if (!byDate[a.date]) byDate[a.date] = [];
    byDate[a.date].push(a);
  });
  Object.values(byDate).forEach(list => {
    const sorted = [...list].sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].start_time < sorted[i].end_time) {
          overlaps.push({ a: sorted[i], b: sorted[j], date: sorted[i].date });
        }
      }
    }
  });
  return overlaps;
}

async function loadDashboard() {
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="demo-banner hud" id="daily-brief-banner">
      <div style="display:flex; align-items:center; gap:14px;">
        <img class="sticker-img" id="daily-brief-sticker" src="assets/stickers/slime-focus.svg" alt="Mascote MindSide Foco">
        <div>
          <div style="font-weight:700; font-family:var(--font-display); font-size:1rem;" id="brief-headline">
            Carregando...
          </div>
          <div class="text-secondary" style="font-size:.82rem; margin-top:2px;" id="brief-subtext"></div>
        </div>
      </div>
      <div class="demo-banner-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-sm" id="seed-demo-btn" title="Popular com dados de demonstração do SIC 2026">Carregar Cenário SIC</button>
        <a class="btn btn-sm btn-primary" href="assistente.html">Planejar com Assistente</a>
      </div>
    </div>

    <div id="conflict-banner-slot"></div>

    <div class="grid-4">
      <div class="card stat-card hud" style="--accent-area: var(--blue);">
        <div class="label-row"><h3>Compromissos hoje</h3></div>
        <div class="num skeleton" id="stat-appts-num" style="width:48px;height:32px;">&nbsp;</div>
        <div class="label" id="stat-appts-sub">verificando agenda...</div>
        <div class="stat-micro-bar"><div id="bar-appts" style="width:0%; background:var(--blue);"></div></div>
      </div>
      <div class="card stat-card hud" style="--accent-area: var(--yellow);">
        <div class="label-row"><h3>Tarefas pendentes</h3></div>
        <div class="num skeleton" id="stat-tasks-num" style="width:48px;height:32px;">&nbsp;</div>
        <div class="label" id="stat-tasks-sub">verificando tarefas...</div>
        <div class="stat-micro-bar"><div id="bar-tasks" style="width:0%; background:var(--yellow);"></div></div>
      </div>
      <div class="card stat-card hud" style="--accent-area: var(--red);">
        <div class="label-row"><h3>Progresso de metas</h3></div>
        <div class="num skeleton" id="stat-goals-num" style="width:48px;height:32px;">&nbsp;</div>
        <div class="label" id="stat-goals-sub">verificando objetivos...</div>
        <div class="stat-micro-bar"><div id="bar-goals" style="width:0%; background:var(--red);"></div></div>
      </div>
      <div class="card stat-card hud" style="--accent-area: var(--green);">
        <div class="label-row"><h3>Sugestões da IA</h3></div>
        <div class="num skeleton" id="stat-sugg-num" style="width:48px;height:32px;">&nbsp;</div>
        <div class="label" id="stat-sugg-sub">aguardando decisão</div>
        <div class="stat-micro-bar"><div id="bar-sugg" style="width:0%; background:var(--green);"></div></div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:18px;">
      <div class="card list-card" style="margin-bottom:0;">
        <div class="head">
          <div>
            <h3 class="mt-0"><img src="assets/stickers/slime-schedule.svg" alt="" style="width:24px;height:24px;border-radius:6px;"> Próximos compromissos</h3>
          </div>
          <div style="display:flex; gap:6px;">
            <a class="btn btn-sm btn-ghost" href="agenda.html">Ver semana</a>
            <a class="btn btn-sm" href="compromissos.html">Gerenciar</a>
          </div>
        </div>
        <div id="appt-list"></div>
      </div>

      <div class="card list-card" style="margin-bottom:0;">
        <div class="head">
          <div>
            <h3 class="mt-0"><img src="assets/stickers/slime-idea.svg" alt="" style="width:24px;height:24px;border-radius:6px;"> Sugestões da IA</h3>
          </div>
          <a class="btn btn-sm" href="assistente.html">Abrir chat</a>
        </div>
        <div id="sugg-list"></div>
      </div>

      <div class="card list-card" style="margin-bottom:0;">
        <div class="head">
          <div>
            <h3 class="mt-0"><img src="assets/stickers/slime-focus.svg" alt="" style="width:24px;height:24px;border-radius:6px;"> Tarefas prioritárias</h3>
          </div>
          <a class="btn btn-sm" href="tarefas.html">Ver todas</a>
        </div>
        <div id="task-list"></div>
      </div>

      <div class="card list-card" style="margin-bottom:0;">
        <div class="head">
          <div>
            <h3 class="mt-0"><img src="assets/stickers/slime-done.svg" alt="" style="width:24px;height:24px;border-radius:6px;"> Janelas de disponibilidade</h3>
          </div>
          <a class="btn btn-sm" href="configuracoes.html">Configurar</a>
        </div>
        <div id="avail-list"></div>
      </div>

      <div class="card list-card" style="grid-column: 1 / -1; margin-bottom:0;">
        <div class="head">
          <div>
            <h3 class="mt-0"><img src="assets/stickers/slime-goal.svg" alt="" style="width:24px;height:24px;border-radius:6px;"> Objetivos ativos</h3>
          </div>
          <a class="btn btn-sm" href="objetivos.html">Gerenciar metas</a>
        </div>
        <div id="goal-list"></div>
      </div>
    </div>`;

  document.getElementById("seed-demo-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Carregando...";
    try {
      await Api.seedDemo();
      toast("Cenário de demonstração SIC 2026 carregado com sucesso!", "success");
      await loadDashboard();
    } catch (err) {
      toast(err.message || "Não foi possível carregar o cenário.", "error");
      btn.disabled = false;
      btn.textContent = "Carregar Cenário SIC";
    }
  });

  try {
    const [tasks, appts, goals, suggestions, slots] = await Promise.all([
      Api.listTasks(),
      Api.listAppointments(),
      Api.listGoals(),
      Api.listSuggestions(),
      Api.listAvailability(),
    ]);

    const today = localTodayIso();
    const pendingTasks = tasks.filter(t => t.status !== "concluida");
    const doneTasks = tasks.filter(t => t.status === "concluida");
    const todayAppts = appts.filter(a => a.date === today).sort((a, b) => a.start_time.localeCompare(b.start_time));
    const activeGoals = goals.filter(g => g.status === "ativo");
    const pendingSuggestions = suggestions.filter(s => s.status === "pending" || s.status === "edited");
    const goalMap = Object.fromEntries(goals.map(g => [g.id, g.title]));

    // Identificar conflitos em sugestões pendentes ou sobreposições na agenda
    const conflictedSuggestions = pendingSuggestions.filter(s => {
      try {
        const d = JSON.parse(s.structured_data || "{}");
        return d.conflicts && d.conflicts.length > 0;
      } catch { return false; }
    });
    const apptOverlaps = detectAppointmentOverlaps(appts);
    const totalConflicts = conflictedSuggestions.length + apptOverlaps.length;

    // 1. Atualizar Resumo do Dia no topo
    const briefHeadline = document.getElementById("brief-headline");
    const briefSubtext = document.getElementById("brief-subtext");
    const briefStickerEl = document.getElementById("daily-brief-sticker");
    if (briefStickerEl) {
      const nextVariant = totalConflicts > 0
        ? "conflict"
        : (pendingSuggestions.length > 0 ? "idea" : (tasks.length > 0 && pendingTasks.length === 0 ? "done" : "focus"));
      briefStickerEl.src = `assets/stickers/slime-${nextVariant}.svg`;
    }
    if (tasks.length === 0 && appts.length === 0 && goals.length === 0) {
      briefHeadline.textContent = "Sua rotina ainda está vazia";
      briefSubtext.textContent = "Comece pelo Assistente ou carregue o Cenário SIC.";
    } else {
      const focusMin = pendingTasks.reduce((acc, t) => acc + (t.duration || 30), 0);
      briefHeadline.textContent = `Resumo do Dia: ${todayAppts.length} compromisso(s) hoje · ${pendingTasks.length} tarefa(s) prioritária(s) (${focusMin} min de foco)`;
      briefSubtext.textContent = pendingSuggestions.length
        ? `${pendingSuggestions.length} sugestão(ões) da IA aguardando sua aprovação (${totalConflicts ? totalConflicts + " com conflito" : "sem conflitos"}).`
        : `${doneTasks.length} de ${tasks.length} tarefa(s) concluída(s).`;
    }

    // 2. Renderizar Banner de Conflitos se houver
    const conflictSlot = document.getElementById("conflict-banner-slot");
    if (totalConflicts > 0) {
      const conflictDetails = conflictedSuggestions.map(s => {
        const d = JSON.parse(s.structured_data || "{}");
        const cNames = (d.conflicts || []).map(c => `${c.title} (${c.start_time}–${c.end_time})`).join(", ");
        return `"${d.title}" conflita com ${cNames}`;
      });
      apptOverlaps.forEach(ov => {
        conflictDetails.push(`"${ov.a.title}" sobrepõe "${ov.b.title}" em ${formatPtDate(ov.date)}`);
      });
      conflictSlot.innerHTML = `
        <div class="conflict-alert-banner">
          <div style="display:flex; align-items:center; gap:12px;">
            <img class="sticker-img sticker-sm" src="assets/stickers/slime-conflict.svg" alt="Alerta de conflito">
            <div>
              <div style="font-weight:700; color:var(--danger); font-size:.9rem;">
                ${totalConflicts} conflito(s) de horário
              </div>
              <div class="text-secondary" style="font-size:.79rem; font-family:var(--font-mono); margin-top:2px;">
                ${escapeHtml(conflictDetails.join(" · "))}
              </div>
            </div>
          </div>
          <a class="btn btn-sm btn-danger" href="assistente.html">Resolver no Assistente →</a>
        </div>`;
    } else {
      conflictSlot.innerHTML = "";
    }

    // 3. Atualizar os 4 KPI Cards
    const avgGoal = activeGoals.length
      ? Math.round(activeGoals.reduce((acc, g) => acc + (g.progress || 0), 0) / activeGoals.length)
      : 0;
    const taskCompletionPct = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

    const kpiNums = [
      { id: "stat-appts-num", val: todayAppts.length },
      { id: "stat-tasks-num", val: pendingTasks.length },
      { id: "stat-goals-num", val: `${avgGoal}%` },
      { id: "stat-sugg-num", val: pendingSuggestions.length },
    ];
    kpiNums.forEach(k => {
      const el = document.getElementById(k.id);
      if (el) { el.textContent = k.val; el.classList.remove("skeleton"); el.style.width = "auto"; el.style.height = "auto"; }
    });

    document.getElementById("stat-appts-sub").textContent = todayAppts.length
      ? `Próximo às ${todayAppts[0].start_time.slice(0, 5)} (${appts.length} na semana)`
      : `${appts.length} compromisso(s) agendado(s)`;
    document.getElementById("stat-tasks-sub").textContent = `${doneTasks.length} concluída(s) de ${tasks.length} (${taskCompletionPct}%)`;
    document.getElementById("stat-goals-sub").textContent = activeGoals.length
      ? `${activeGoals.length} objetivo(s) ativo(s)`
      : "nenhum objetivo ativo";
    document.getElementById("stat-sugg-sub").textContent = totalConflicts > 0
      ? `${totalConflicts} com alerta de conflito`
      : (pendingSuggestions.length ? "✓ Sem conflitos" : "nenhuma revisão pendente");

    document.getElementById("bar-appts").style.width = `${Math.min(100, todayAppts.length * 35)}%`;
    document.getElementById("bar-tasks").style.width = `${taskCompletionPct}%`;
    document.getElementById("bar-goals").style.width = `${avgGoal}%`;
    document.getElementById("bar-sugg").style.width = pendingSuggestions.length ? "100%" : "0%";

    // 4. Próximos Compromissos
    const apptList = document.getElementById("appt-list");
    const upcoming = appts
      .filter(a => a.date >= today)
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
      .slice(0, 5);
    apptList.innerHTML = upcoming.length ? upcoming.map(a => `
      <div class="item-row" style="--accent-area: var(--blue);">
        <div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="time-badge">${formatPtDate(a.date)} · ${a.start_time.slice(0,5)}–${a.end_time.slice(0,5)}</span>
            <span class="item-title">${escapeHtml(a.title)}</span>
          </div>
          <div class="meta">
            <span>Categoria: ${escapeHtml(a.category)}</span>
            ${a.description ? `<span>· ${escapeHtml(a.description)}</span>` : ""}
          </div>
        </div>
        <span class="badge ${a.date === today ? "badge-concluida" : "badge-em_andamento"}">${a.date === today ? "Hoje" : "Agendado"}</span>
      </div>`).join("") : `
      <div class="empty-state-box">
        <img class="sticker-img" src="assets/stickers/slime-schedule.svg" alt="Sem compromissos">
        <div>Nenhum compromisso próximo.</div>
        <a class="btn btn-sm" href="compromissos.html">+ Agendar compromisso</a>
      </div>`;

    // 5. Tarefas Prioritárias
    const taskList = document.getElementById("task-list");
    const priorityOrder = { urgente: 0, alta: 1, media: 2, baixa: 3 };
    const topTasks = [...pendingTasks].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 5);
    taskList.innerHTML = topTasks.length ? topTasks.map(t => {
      const goalLabel = t.goal_id && goalMap[t.goal_id] ? `${escapeHtml(goalMap[t.goal_id])}` : "";
      return `
      <div class="item-row" style="--accent-area: var(--yellow);">
        <div>
          <div class="item-title">${escapeHtml(t.title)}</div>
          <div class="meta">
            <span>${escapeHtml(t.category)}</span>
            <span>· ${t.duration || 30} min</span>
            ${t.deadline ? `<span>· Prazo: ${formatPtDate(t.deadline)}</span>` : ""}
            ${goalLabel ? `<span style="color:var(--accent);">${goalLabel}</span>` : ""}
          </div>
        </div>
        <div class="item-actions">
          <span class="badge badge-${t.priority}">${t.priority}</span>
          <button class="btn btn-sm btn-approve" data-quick-done="${t.id}" title="Marcar tarefa como concluída">✓ Concluir</button>
        </div>
      </div>`;
    }).join("") : `
      <div class="empty-state-box">
        <img class="sticker-img" src="assets/stickers/slime-done.svg" alt="Tudo em dia">
        <div>Nenhuma tarefa pendente.</div>
      </div>`;

    taskList.querySelectorAll("[data-quick-done]").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await Api.updateTask(btn.dataset.quickDone, { status: "concluida" });
          toast("Tarefa concluída! O progresso da sua meta foi atualizado.", "success");
          await loadDashboard();
        } catch (err) {
          toast(err.message || "Erro ao concluir tarefa.", "error");
          btn.disabled = false;
        }
      });
    });

    // 6. Progresso dos Objetivos Ativos (Agora visível diretamente no Dashboard!)
    const goalList = document.getElementById("goal-list");
    goalList.innerHTML = activeGoals.length ? activeGoals.map(g => {
      const linked = tasks.filter(t => t.goal_id === g.id);
      const doneCount = linked.filter(t => t.status === "concluida").length;
      return `
        <div class="goal-card" style="padding:14px 16px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div>
              <div class="item-title">${escapeHtml(g.title)}</div>
              <div class="meta">
                <span>${linked.length ? `${doneCount}/${linked.length} tarefas concluídas` : "Sem tarefas vinculadas"}</span>
                ${g.deadline ? `<span>· Prazo: ${formatPtDate(g.deadline)}</span>` : ""}
              </div>
            </div>
            <span class="time-badge" style="color:var(--red); border-color:rgba(255,93,118,.35);">${g.progress || 0}%</span>
          </div>
          <div class="goal-progress-track" style="margin-top:8px; height:7px;">
            <div class="goal-progress-fill" style="width:${g.progress || 0}%;"></div>
          </div>
        </div>`;
    }).join("") : `
      <div class="empty-state-box">
        <img class="sticker-img" src="assets/stickers/slime-goal.svg" alt="Sem objetivos">
        <div>Nenhum objetivo ativo no momento.</div>
        <a class="btn btn-sm" href="objetivos.html">+ Criar objetivo</a>
      </div>`;

    // 7. Sugestões da IA Aguardando Decisão (Com aprovação/rejeição rápida no próprio Dashboard)
    const suggList = document.getElementById("sugg-list");
    suggList.innerHTML = pendingSuggestions.length ? pendingSuggestions.slice(0, 4).map(s => {
      let parsed = {};
      try { parsed = JSON.parse(s.structured_data || "{}"); } catch {}
      const conflicts = parsed.conflicts || [];
      const hasConflict = conflicts.length > 0;
      return `
        <div class="suggestion-card ${hasConflict ? "has-conflict" : ""}" style="margin-top:0; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div class="item-title">${escapeHtml(parsed.title || s.content)}</div>
            <span class="badge ${hasConflict ? "badge-urgente" : "badge-concluida"}">${hasConflict ? "Conflito" : "Validada"}</span>
          </div>
          <div class="suggestion-meta-grid">
            ${parsed.date ? `<span class="suggestion-meta-pill">${formatPtDate(parsed.date)}${parsed.time ? " às " + escapeHtml(parsed.time) : ""}</span>` : ""}
            <span class="suggestion-meta-pill">${parsed.duration_minutes || 30} min</span>
            <span class="suggestion-meta-pill">${escapeHtml(parsed.category || "geral")}</span>
          </div>
          ${hasConflict ? `<div class="conflict-warning">Choque com: ${conflicts.map(c => `${escapeHtml(c.title)} (${c.start_time}–${c.end_time})`).join(", ")}</div>` : ""}
          <div class="suggestion-actions">
            <button class="btn btn-xs btn-approve" data-dash-approve="${s.id}">✓ Aprovar</button>
            <a class="btn btn-xs" href="assistente.html">✎ Editar / Revisar</a>
            <button class="btn btn-xs btn-danger" data-dash-reject="${s.id}">✕ Rejeitar</button>
          </div>
        </div>`;
    }).join("") : `
      <div class="empty-state-box">
        <img class="sticker-img" src="assets/stickers/slime-idea.svg" alt="Sem sugestões pendentes">
        <div>Nenhuma sugestão pendente.</div>
        <a class="btn btn-sm btn-primary" href="assistente.html">Abrir Assistente</a>
      </div>`;

    suggList.querySelectorAll("[data-dash-approve]").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await Api.approveSuggestion(btn.dataset.dashApprove);
          toast("Sugestão aprovada e incorporada à sua rotina!", "success");
          await loadDashboard();
        } catch (err) {
          toast(err.message || "Erro ao aprovar sugestão.", "error");
          btn.disabled = false;
        }
      });
    });

    suggList.querySelectorAll("[data-dash-reject]").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await Api.rejectSuggestion(btn.dataset.dashReject);
          toast("Sugestão rejeitada.", "info");
          await loadDashboard();
        } catch (err) {
          toast(err.message || "Erro ao rejeitar sugestão.", "error");
          btn.disabled = false;
        }
      });
    });

    // 8. Janelas de Disponibilidade
    const availList = document.getElementById("avail-list");
    availList.innerHTML = slots.length ? slots.map(sl => `
      <div class="item-row" style="padding:10px 13px;">
        <div>
          <div class="item-title" style="font-size:.84rem;">${escapeHtml(sl.day_of_week)}</div>
          <div class="meta">${sl.start_time.slice(0,5)} às ${sl.end_time.slice(0,5)}</div>
        </div>
        <span class="badge badge-concluida">Livre</span>
      </div>`).join("") : `
      <div class="empty-state-box">
        <img class="sticker-img sticker-sm" src="assets/stickers/slime-empty.svg" alt="Sem janelas">
        <div>Nenhuma janela livre cadastrada.</div>
        <a class="btn btn-sm" href="configuracoes.html">Configurar horários</a>
      </div>`;

  } catch (err) {
    toast(err.message || "Erro ao carregar o dashboard.", "error");
  }
}
