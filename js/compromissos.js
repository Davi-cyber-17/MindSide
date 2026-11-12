let allAppts = [];
let apptSearch = "";
let apptCatFilter = "todas";

function minutesBetween(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const [sh, sm] = startStr.slice(0, 5).split(":").map(Number);
  const [eh, em] = endStr.slice(0, 5).split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

function formatDateGroupHeader(iso) {
  const today = localTodayIso();
  if (iso === today) return "Hoje (" + iso.split("-").reverse().join("/") + ")";
  const d = new Date(iso + "T12:00:00");
  const label = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return "" + label.charAt(0).toUpperCase() + label.slice(1);
}

document.addEventListener("DOMContentLoaded", async () => {
  renderShell(
    "compromissos.html",
    "Compromissos"
  );
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="summary-strip">
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Total agendado</div>
          <div class="val" id="appt-sum-total">0</div>
        </div>
      </div>
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Compromissos hoje</div>
          <div class="val" id="appt-sum-today">0</div>
        </div>
      </div>
      <div class="summary-pill-card">
        <div>
          <div class="lbl">Horas reservadas</div>
          <div class="val" id="appt-sum-hours">0h</div>
        </div>
      </div>
    </div>

    <div class="list-card card">
      <div class="head">
        <div>
          <h3 class="mt-0">Linha do tempo de compromissos</h3>
        </div>
        <button class="btn btn-primary" id="new-appt-btn">+ Novo compromisso</button>
      </div>

      <div class="toolbar-row">
        <div class="filter-bar" id="appt-cat-filters">
          <button class="filter-chip active" data-cat="todas">Todas categorias</button>
          <button class="filter-chip" data-cat="estudo">Estudo</button>
          <button class="filter-chip" data-cat="trabalho">Trabalho</button>
          <button class="filter-chip" data-cat="saude">Saúde</button>
          <button class="filter-chip" data-cat="pessoal">Pessoal</button>
          <button class="filter-chip" data-cat="geral">Geral</button>
        </div>
        <div class="search-box">
          <span class="search-icon"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="14.5" cy="9.5" r="6"/><path d="M10.2 13.8 3.5 20.5"/></svg></span>
          <input type="text" id="appt-search" placeholder="Buscar compromisso..." aria-label="Buscar compromissos">
        </div>
      </div>

      <div id="appts-container"></div>
    </div>`;

  document.getElementById("new-appt-btn").addEventListener("click", () => openApptModal());
  document.getElementById("appt-cancel-btn").addEventListener("click", closeApptModal);
  document.getElementById("appt-form").addEventListener("submit", onSaveAppt);

  document.querySelectorAll("#appt-cat-filters [data-cat]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#appt-cat-filters [data-cat]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      apptCatFilter = btn.dataset.cat;
      renderAppts();
    });
  });

  document.getElementById("appt-search").addEventListener("input", (e) => {
    apptSearch = e.target.value.trim().toLowerCase();
    renderAppts();
  });

  await loadAppts();
});

async function loadAppts() {
  const container = document.getElementById("appts-container");
  container.innerHTML = `<div class="skeleton" style="height:64px;margin-bottom:8px;"></div>`.repeat(3);
  try {
    allAppts = await Api.listAppointments();
    updateApptSummary();
    renderAppts();
  } catch (err) {
    toast(err.message || "Erro ao carregar compromissos.", "error");
  }
}

function updateApptSummary() {
  const today = localTodayIso();
  const todayCount = allAppts.filter(a => a.date === today).length;
  const totalMin = allAppts.reduce((acc, a) => acc + minutesBetween(a.start_time, a.end_time), 0);
  document.getElementById("appt-sum-total").textContent = allAppts.length;
  document.getElementById("appt-sum-today").textContent = todayCount;
  document.getElementById("appt-sum-hours").textContent = totalMin >= 60
    ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`
    : `${totalMin} min`;
}

function renderAppts() {
  const container = document.getElementById("appts-container");
  const filtered = allAppts.filter(a => {
    if (apptCatFilter !== "todas" && (a.category || "").toLowerCase() !== apptCatFilter) return false;
    if (apptSearch) {
      const hay = `${a.title || ""} ${a.description || ""} ${a.category || ""}`.toLowerCase();
      if (!hay.includes(apptSearch)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state-box">
        <img class="sticker-img" src="assets/stickers/slime-schedule.svg" alt="Sem compromissos">
        <div>Nenhum compromisso encontrado. Adicione um horário fixo ou peça ao Assistente IA.</div>
      </div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const groups = {};
  sorted.forEach(a => {
    if (!groups[a.date]) groups[a.date] = [];
    groups[a.date].push(a);
  });

  container.innerHTML = Object.entries(groups).map(([dateIso, items]) => {
    const rowsHtml = items.map(a => {
      const dur = minutesBetween(a.start_time, a.end_time);
      return `
        <div class="item-row">
          <div style="min-width:0; flex:1;">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <span class="time-badge" style="color:var(--accent-area); border-color:color-mix(in srgb, var(--accent-area) 40%, transparent);">
                ${a.start_time.slice(0,5)} – ${a.end_time.slice(0,5)}
              </span>
              <span class="item-title">${escapeHtml(a.title)}</span>
              <span class="badge badge-em_andamento">${escapeHtml(a.category || "geral")}</span>
            </div>
            ${a.description ? `<div class="item-desc">${escapeHtml(a.description)}</div>` : ""}
            <div class="meta">
              <span>Duração: ${dur} min</span>
              <span>· Status: ${escapeHtml(a.status || "Agendada")}</span>
            </div>
          </div>
          <div class="item-actions">
            <button class="btn btn-sm" data-edit="${a.id}">Editar</button>
            <button class="btn btn-sm btn-danger" data-del="${a.id}">Excluir</button>
          </div>
        </div>`;
    }).join("");

    return `
      <div style="margin-bottom:16px;">
        <div style="font-family:var(--font-mono); font-size:.75rem; color:var(--text-secondary); font-weight:600; margin-bottom:8px; padding-left:4px;">
          ${formatDateGroupHeader(dateIso)}
        </div>
        ${rowsHtml}
      </div>`;
  }).join("");

  container.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openApptModal(allAppts.find(a => a.id == btn.dataset.edit))));
  container.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", () => deleteAppt(btn.dataset.del)));
}

function openApptModal(appt = null) {
  document.getElementById("appt-conflict-warning").style.display = "none";
  document.getElementById("appt-modal-title").textContent = appt ? "Editar compromisso" : "Novo compromisso";
  document.getElementById("appt-id").value = appt ? appt.id : "";
  document.getElementById("appt-title").value = appt ? appt.title : "";
  document.getElementById("appt-description").value = appt ? appt.description : "";
  document.getElementById("appt-category").value = appt ? appt.category : "geral";
  document.getElementById("appt-date").value = appt ? appt.date : localTodayIso();
  document.getElementById("appt-start").value = appt ? appt.start_time.slice(0,5) : "14:00";
  document.getElementById("appt-end").value = appt ? appt.end_time.slice(0,5) : "15:00";
  document.getElementById("appt-modal-overlay").classList.add("open");
}
function closeApptModal() { document.getElementById("appt-modal-overlay").classList.remove("open"); }

async function onSaveAppt(e) {
  e.preventDefault();
  const id = document.getElementById("appt-id").value;
  const warnBox = document.getElementById("appt-conflict-warning");
  warnBox.style.display = "none";
  const payload = {
    title: document.getElementById("appt-title").value.trim(),
    description: document.getElementById("appt-description").value.trim(),
    category: document.getElementById("appt-category").value,
    date: document.getElementById("appt-date").value,
    start_time: document.getElementById("appt-start").value,
    end_time: document.getElementById("appt-end").value,
  };
  try {
    if (id) { await Api.updateAppointment(id, payload); toast("Compromisso atualizado.", "success"); }
    else { await Api.createAppointment(payload); toast("Compromisso criado.", "success"); }
    closeApptModal();
    await loadAppts();
  } catch (err) {
    if (err.status === 409) {
      const conflicts = (err.raw && err.raw.detail && err.raw.detail.conflicts) || [];
      warnBox.textContent = "Conflito de horário detectado pelo Python com: " + conflicts.map(c => `${c.title} (${c.start_time}–${c.end_time})`).join(", ");
      warnBox.style.display = "block";
    } else {
      toast(err.message || "Erro ao salvar compromisso.", "error");
    }
  }
}

async function deleteAppt(id) {
  if (!confirm("Excluir este compromisso?")) return;
  try {
    await Api.deleteAppointment(id);
    toast("Compromisso excluído.", "success");
    await loadAppts();
  } catch (err) {
    toast(err.message || "Erro ao excluir compromisso.", "error");
  }
}
