document.addEventListener("DOMContentLoaded", async () => {
  renderShell(
    "agenda.html",
    "Agenda Semanal"
  );
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="summary-strip">
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Compromissos na semana</div>
          <div class="val" id="ag-sum-appts">0</div>
        </div>
      </div>
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Tarefas alocadas</div>
          <div class="val" id="ag-sum-tasks">0</div>
        </div>
      </div>
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Janelas livres ativas</div>
          <div class="val" id="ag-sum-slots">0</div>
        </div>
      </div>
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Carga semanal</div>
          <div class="val" id="ag-sum-load">0h</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="head" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--border); flex-wrap:wrap; gap:12px;">
        <div>
          <h3 class="mt-0" id="week-label" style="font-size:1.05rem;">Semana atual</h3>
          <div class="agenda-legend" style="margin-top:6px;">
            <span><i class="legend-dot" style="background:var(--blue);"></i>Compromissos</span>
            <span><i class="legend-dot" style="background:var(--yellow);"></i>Tarefas agendadas</span>
            <span><i class="legend-dot" style="background:var(--green);"></i>Janela disponível</span>
          </div>
        </div>
        <div class="agenda-week-nav" style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-sm" id="prev-week">‹ Semana anterior</button>
          <button class="btn btn-sm btn-primary" id="today-week">Hoje</button>
          <button class="btn btn-sm" id="next-week">Próxima semana ›</button>
        </div>
      </div>
      <div class="agenda-grid" id="agenda-grid"></div>
    </div>`;

  let weekOffset = 0;
  document.getElementById("prev-week").addEventListener("click", () => { weekOffset--; renderWeek(weekOffset); });
  document.getElementById("next-week").addEventListener("click", () => { weekOffset++; renderWeek(weekOffset); });
  document.getElementById("today-week").addEventListener("click", () => { weekOffset = 0; renderWeek(weekOffset); });

  let tasks = [], appts = [], slots = [];
  try {
    [tasks, appts, slots] = await Promise.all([
      Api.listTasks(),
      Api.listAppointments(),
      Api.listAvailability(),
    ]);
  } catch (err) {
    toast(err.message || "Erro ao carregar agenda.", "error");
  }

  const WEEKDAY_LABELS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const WEEKDAY_DB = ["Domingo","Segunda","Terca","Quarta","Quinta","Sexta","Sabado"];

  function toLocalIso(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function calcDurationMin(startStr, endStr) {
    const [sh, sm] = startStr.slice(0, 5).split(":").map(Number);
    const [eh, em] = endStr.slice(0, 5).split(":").map(Number);
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }

  function renderWeek(offset) {
    const grid = document.getElementById("agenda-grid");
    const base = new Date();
    const dayOfWeek = base.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    base.setDate(base.getDate() + mondayOffset + offset * 7);

    const days = [...Array(7)].map((_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
    document.getElementById("week-label").textContent =
      `Semana de ${fmt(days[0])} a ${fmt(days[6])}`;

    const todayIso = localTodayIso();
    const weekIsos = new Set(days.map(toLocalIso));

    const weekAppts = appts.filter(a => weekIsos.has(a.date));
    const weekTasks = tasks.filter(t => t.scheduled_date && weekIsos.has(t.scheduled_date));
    const activeSlots = slots.filter(s => s.status === "Ativo");

    let totalWeekMin = 0;
    weekAppts.forEach(a => { totalWeekMin += calcDurationMin(a.start_time, a.end_time); });
    weekTasks.forEach(t => { totalWeekMin += (t.duration || 30); });

    document.getElementById("ag-sum-appts").textContent = weekAppts.length;
    document.getElementById("ag-sum-tasks").textContent = weekTasks.length;
    document.getElementById("ag-sum-slots").textContent = activeSlots.length;
    document.getElementById("ag-sum-load").textContent = totalWeekMin >= 60
      ? `${Math.floor(totalWeekMin / 60)}h ${totalWeekMin % 60}m`
      : `${totalWeekMin}m`;

    grid.innerHTML = days.map(d => {
      const iso = toLocalIso(d);
      const dbDayName = WEEKDAY_DB[d.getDay()];
      const dayAppts = appts.filter(a => a.date === iso);
      const dayTasks = tasks.filter(t => t.scheduled_date === iso);
      const daySlots = activeSlots.filter(s => s.day_of_week === dbDayName);

      // Unificar e ordenar cronologicamente todos os eventos do dia
      const unified = [
        ...dayAppts.map(a => ({
          kind: "appt",
          sortTime: a.start_time ? a.start_time.slice(0, 5) : "00:00",
          timeRange: `${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`,
          title: a.title,
          category: a.category || "geral",
          durationMin: calcDurationMin(a.start_time, a.end_time),
          done: false,
        })),
        ...dayTasks.map(t => ({
          kind: "task",
          sortTime: t.scheduled_time ? t.scheduled_time.slice(0, 5) : "23:59",
          timeRange: t.scheduled_time ? t.scheduled_time.slice(0, 5) : "Sem hora",
          title: t.title,
          category: t.category || "geral",
          durationMin: t.duration || 30,
          done: t.status === "concluida",
        })),
      ].sort((a, b) => a.sortTime.localeCompare(b.sortTime));

      const dayTotalMin = unified.reduce((acc, ev) => acc + ev.durationMin, 0);
      const loadLabel = dayTotalMin > 0
        ? (dayTotalMin >= 60 ? `${Math.floor(dayTotalMin / 60)}h${dayTotalMin % 60 ? (dayTotalMin % 60) + "m" : ""}` : `${dayTotalMin}m`)
        : "Livre";

      const availHtml = daySlots.map(s => `
        <div class="agenda-slot-pill">
          ✓ Livre: ${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}
        </div>`).join("");

      const eventsHtml = unified.length
        ? unified.map(ev => `
          <div class="agenda-event-card ${ev.kind === 'task' ? 'is-task' : ''} ${ev.done ? 'is-done' : ''}">
            <div class="agenda-event-time">
              <span>${ev.timeRange}</span>
              <span>${ev.durationMin}m</span>
            </div>
            <div class="agenda-event-title" style="${ev.done ? 'text-decoration:line-through;' : ''}">
              ${escapeHtml(ev.title)}
            </div>
          </div>`).join("")
        : `<div class="empty-state" style="padding:18px 4px; font-size:.72rem; margin:auto 0;">Sem eventos</div>`;

      const isToday = iso === todayIso;
      return `
        <div class="agenda-day-col ${isToday ? "is-today" : ""}">
          <div class="agenda-day-header">
            <span class="agenda-day-label">
              ${WEEKDAY_LABELS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}
              ${isToday ? `<span class="badge badge-concluida" style="margin-left:4px; padding:1px 5px; font-size:.58rem;">HOJE</span>` : ""}
            </span>
            <span class="agenda-day-load">${loadLabel}</span>
          </div>
          ${availHtml}
          ${eventsHtml}
        </div>`;
    }).join("");
  }

  function fmt(d) { return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }

  renderWeek(0);
});
