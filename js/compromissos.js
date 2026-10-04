let allAppts = [];

document.addEventListener("DOMContentLoaded", async () => {
  renderShell("compromissos.html", "Compromissos", "Seus compromissos, com verificação automática de conflitos.");
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="list-card card">
      <div class="head">
        <h3 class="mt-0">Todos os compromissos</h3>
        <button class="btn btn-primary" id="new-appt-btn">+ Novo compromisso</button>
      </div>
      <div id="appts-container"></div>
    </div>`;

  document.getElementById("new-appt-btn").addEventListener("click", () => openApptModal());
  document.getElementById("appt-cancel-btn").addEventListener("click", closeApptModal);
  document.getElementById("appt-form").addEventListener("submit", onSaveAppt);

  await loadAppts();
});

async function loadAppts() {
  const container = document.getElementById("appts-container");
  container.innerHTML = `<div class="skeleton" style="height:60px;margin-bottom:8px;"></div>`.repeat(3);
  try {
    allAppts = await Api.listAppointments();
    renderAppts();
  } catch (err) {
    toast(err.message || "Erro ao carregar compromissos.", "error");
  }
}

function renderAppts() {
  const container = document.getElementById("appts-container");
  if (!allAppts.length) {
    container.innerHTML = `<div class="empty-state">Nenhum compromisso cadastrado ainda.</div>`;
    return;
  }
  const sorted = [...allAppts].sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  container.innerHTML = sorted.map(a => `
    <div class="item-row">
      <div class="item-main">
        <div class="item-title">${escapeHtml(a.title)}</div>
        <div class="meta">${a.date} · ${a.start_time.slice(0,5)}–${a.end_time.slice(0,5)} · ${a.category}</div>
      </div>
      <div class="item-actions">
        <button class="btn btn-sm" data-edit="${a.id}">Editar</button>
        <button class="btn btn-sm btn-danger" data-del="${a.id}">Excluir</button>
      </div>
    </div>`).join("");

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
  document.getElementById("appt-date").value = appt ? appt.date : "";
  document.getElementById("appt-start").value = appt ? appt.start_time.slice(0,5) : "";
  document.getElementById("appt-end").value = appt ? appt.end_time.slice(0,5) : "";
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
      warnBox.textContent = "Conflito de horário com: " + conflicts.map(c => `${c.title} (${c.start_time}-${c.end_time})`).join(", ");
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
