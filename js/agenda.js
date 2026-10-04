document.addEventListener("DOMContentLoaded", async () => {
  renderShell("agenda.html", "Agenda", "Visualize sua semana: compromissos e tarefas agendadas.");
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="card">
      <div class="head agenda-head">
        <h3 class="mt-0" id="week-label">Semana atual</h3>
        <div class="agenda-controls">
          <button class="btn btn-sm" id="prev-week">‹ Anterior</button>
          <button class="btn btn-sm" id="today-week">Hoje</button>
          <button class="btn btn-sm" id="next-week">Próxima ›</button>
        </div>
      </div>
      <div class="agenda-grid" id="agenda-grid"></div>
    </div>`;

  let weekOffset = 0;
  document.getElementById("prev-week").addEventListener("click", () => { weekOffset--; renderWeek(weekOffset); });
  document.getElementById("next-week").addEventListener("click", () => { weekOffset++; renderWeek(weekOffset); });
  document.getElementById("today-week").addEventListener("click", () => { weekOffset = 0; renderWeek(weekOffset); });

  let tasks = [], appts = [];
  try {
    [tasks, appts] = await Promise.all([Api.listTasks(), Api.listAppointments()]);
  } catch (err) {
    toast(err.message || "Erro ao carregar agenda.", "error");
  }

  function renderWeek(offset) {
    const grid = document.getElementById("agenda-grid");
    const base = new Date();
    base.setDate(base.getDate() - ((base.getDay() + 6) % 7) + offset * 7); // segunda-feira da semana
    const days = [...Array(7)].map((_, i) => {
      const d = new Date(base); d.setDate(base.getDate() + i); return d;
    });
    document.getElementById("week-label").textContent =
      `${fmt(days[0])} — ${fmt(days[6])}`;

    grid.innerHTML = days.map(d => {
      const iso = localISO(d);
      const dayAppts = appts.filter(a => a.date === iso);
      const dayTasks = tasks.filter(t => t.scheduled_date === iso);
      const items = [
        ...dayAppts.map(a => `<div class="item-row agenda-item">
              <div class="item-main"><div class="item-title">${escapeHtml(a.title)}</div>
              <div class="meta">${a.start_time.slice(0,5)}–${a.end_time.slice(0,5)}</div></div></div>`),
        ...dayTasks.map(t => `<div class="item-row agenda-item is-task">
              <div class="item-main"><div class="item-title">${escapeHtml(t.title)}</div>
              <div class="meta">${t.scheduled_time ? t.scheduled_time.slice(0,5) : "sem hora"}</div></div></div>`),
      ];
      const isToday = iso === localISO();
      return `<div class="agenda-day-col" style="${isToday ? "border:1px solid var(--accent);" : ""}">
          <div class="agenda-day-label">${WEEKDAY_LABELS[d.getDay()]} ${d.getDate()}</div>
          ${items.length ? items.join("") : '<div class="empty-state" style="padding:8px 0;font-size:.7rem;">Livre</div>'}
        </div>`;
    }).join("");
  }

  const WEEKDAY_LABELS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  function fmt(d) { return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }

  renderWeek(0);
});
