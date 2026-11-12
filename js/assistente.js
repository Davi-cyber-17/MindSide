let mainSlime = null;

const EXAMPLE_PROMPTS = [
  "Tenho prova de matemática sexta-feira às 18h, preciso estudar programação para um trabalho e também quero organizar meu treino durante a semana",
  "Tenho reunião do projeto amanhã às 18h30 e preciso entregar o relatório urgente hoje",
  "Quero correr no parque sábado às 09h e estudar inglês por 45 minutos",
];

function setPipelineStep(activeStep) {
  document.querySelectorAll(".pipeline-step").forEach((el, idx) => {
    el.classList.toggle("active", idx + 1 <= activeStep);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  renderShell(
    "assistente.html",
    "Assistente"
  );
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="assistant-pipeline" aria-label="Etapas do fluxo de decisão assistida">
      <div class="pipeline-step active" id="pipe-step-1">
        <span class="step-num">1</span>
        <div>
          <div class="step-title">Você Descreve</div>
        </div>
      </div>
      <div class="pipeline-step" id="pipe-step-2">
        <span class="step-num">2</span>
        <div>
          <div class="step-title">IA Estrutura</div>
        </div>
      </div>
      <div class="pipeline-step" id="pipe-step-3">
        <span class="step-num">3</span>
        <div>
          <div class="step-title">Python Valida</div>
        </div>
      </div>
      <div class="pipeline-step" id="pipe-step-4">
        <span class="step-num">4</span>
        <div>
          <div class="step-title">Você Decide</div>
        </div>
      </div>
    </div>

    <div class="chat-wrap hud">
      <div class="chat-messages" id="chat-messages">
        <div class="msg ai">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:46px;height:38px;flex-shrink:0;" data-slime id="main-assistant-slime"></div>
              <div>
                <strong style="font-size:.94rem;">Olá! Sou o assistente do MINDSIDE.</strong>
              </div>
            </div>
          </div>
          <div class="text-secondary" style="font-size:.85rem;">
            Conte o que precisa organizar. Eu separo em propostas, verifico conflitos e aguardo sua decisão.
          </div>
        </div>
      </div>

      <div class="prompt-chips" aria-label="Exemplos rápidos para demonstração">
        <span style="font-size:.71rem; color:var(--text-dim); font-family:var(--font-mono); align-self:center;">Exemplos:</span>
        <button type="button" class="chip-btn" data-prompt-idx="0">Prova + estudo + treino</button>
        <button type="button" class="chip-btn" data-prompt-idx="1">Choque de horário</button>
        <button type="button" class="chip-btn" data-prompt-idx="2">Fim de semana</button>
      </div>

      <form class="chat-input-bar" id="chat-form">
        <input type="text" id="chat-input" aria-label="Descreva suas tarefas e compromissos" placeholder="Ex.: Prova de cálculo sexta às 18h e estudar programação por 45 min..." autocomplete="off" maxlength="5000" required>
        <button type="submit" class="btn btn-primary" id="chat-submit-btn">Analisar rotina →</button>
      </form>
    </div>`;

  document.getElementById("chat-form").addEventListener("submit", onSend);
  document.getElementById("edit-sugg-cancel").addEventListener("click", () =>
    document.getElementById("edit-sugg-overlay").classList.remove("open"));
  document.getElementById("edit-sugg-form").addEventListener("submit", onSaveEdit);

  document.querySelectorAll("[data-prompt-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.promptIdx, 10);
      const input = document.getElementById("chat-input");
      input.value = EXAMPLE_PROMPTS[idx] || "";
      input.focus();
      setPipelineStep(1);
    });
  });

  const assistantSlimeBox = document.getElementById("main-assistant-slime");
  if (assistantSlimeBox) mainSlime = new Slime(assistantSlimeBox);

  await loadExistingPendingSuggestions();
});

async function loadExistingPendingSuggestions() {
  try {
    const list = await Api.listSuggestions();
    const pending = list.filter(s => s.status === "pending" || s.status === "edited");
    if (!pending.length) return;

    setPipelineStep(4);
    let html = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
        <strong>Propostas estruturadas aguardando sua decisão (${pending.length}):</strong>
        <span class="badge badge-em_andamento">Aguardando revisão humana</span>
      </div>`;
    pending.forEach(s => {
      let data = {};
      try { data = JSON.parse(s.structured_data || "{}"); } catch {}
      html += renderSuggestionCard(s.id, data);
    });
    const msgEl = addMessage(html, "ai");
    bindSuggestionButtons(msgEl);
  } catch {
    // carga silenciosa
  }
}

function addMessage(html, cls) {
  const wrap = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  div.innerHTML = html;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div;
}

async function onSend(e) {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const submitButton = document.getElementById("chat-submit-btn");
  const text = input.value.trim();
  if (!text) return;

  submitButton.disabled = true;
  submitButton.textContent = "Validando...";
  addMessage(escapeHtml(text), "user");
  input.value = "";
  if (mainSlime) mainSlime.processing();
  setPipelineStep(3);

  const thinkingMsg = addMessage(`
    <div style="display:flex; align-items:center; gap:10px;">
      <div class="skeleton" style="width:18px; height:18px; border-radius:50%;"></div>
      <span class="text-secondary" style="font-family:var(--font-mono); font-size:.8rem;">
        Extraindo intenções na IA e executando validação de conflitos e disponibilidade em Python...
      </span>
    </div>`, "ai");

  try {
    const result = await Api.analyze(text);
    thinkingMsg.remove();
    if (mainSlime) mainSlime.respond();
    setPipelineStep(4);

    if (!result || !Array.isArray(result.suggestions) || result.suggestions.length === 0) {
      addMessage(`
        <div style="display:flex; align-items:center; gap:10px;">
          <img class="sticker-img sticker-sm" src="assets/stickers/slime-empty.svg" alt="Sem sugestões">
          <div>Não identifiquei atividades acionáveis nessa mensagem. Tente informar o título da tarefa ou o horário do compromisso.</div>
        </div>`, "ai");
      return;
    }

    let html = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
        <strong>${escapeHtml(result.reasoning_summary || "Propostas estruturadas prontas para revisão:")}</strong>
        <span class="badge badge-concluida">${result.suggestions.length} proposta(s) gerada(s)</span>
      </div>`;
    result.suggestions.forEach(s => {
      const data = s.structured_data;
      html += renderSuggestionCard(s.id, data, s.validation);
    });
    const msgEl = addMessage(html, "ai");
    bindSuggestionButtons(msgEl);
  } catch (err) {
    thinkingMsg.remove();
    if (mainSlime) mainSlime.errorState();
    addMessage(`
      <div style="display:flex; align-items:center; gap:10px; color:var(--danger);">
        <img class="sticker-img sticker-sm" src="assets/stickers/slime-conflict.svg" alt="Erro">
        <div>
          <strong>Falha ao analisar a rotina:</strong> ${escapeHtml(err.message || "Não foi possível gerar sugestões no momento.")}
        </div>
      </div>`, "ai");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Analisar rotina →";
    input.focus();
  }
}

function renderSuggestionCard(id, data, validation = null) {
  const conflicts = data.conflicts || [];
  const hasConflict = conflicts.length > 0;
  const valMsg = validation?.message
    || (hasConflict
      ? `Sobreposição com ${conflicts.length} atividade(s) da agenda.`
      : "Horário livre na agenda.");

  return `
    <div class="suggestion-card ${hasConflict ? "has-conflict" : ""}" data-sugg-id="${id}" data-sugg-title="${escapeHtml(data.title || "")}" data-sugg-type="${escapeHtml(data.type || "tarefa")}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="badge ${data.type === "compromisso" ? "badge-em_andamento" : "badge-media"}">
            ${data.type === "compromisso" ? "Compromisso" : "Tarefa"}
          </span>
          <strong style="font-size:.93rem;">${escapeHtml(data.title)}</strong>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <span class="badge badge-${data.priority || "media"}">${escapeHtml(data.priority || "media")}</span>
        </div>
      </div>

      <div class="suggestion-meta-grid">
        <span class="suggestion-meta-pill">${data.date ? escapeHtml(data.date) : "Sem data fixa"}</span>
        ${data.time ? `<span class="suggestion-meta-pill">${escapeHtml(data.time)}</span>` : ""}
        <span class="suggestion-meta-pill">${data.duration_minutes || 30} min</span>
        <span class="suggestion-meta-pill">${escapeHtml(data.category || "geral")}</span>
      </div>

      <div class="validation-pill ${hasConflict ? "warn" : ""}">
        ${escapeHtml(valMsg)}
      </div>

      ${hasConflict ? `
        <div class="conflict-warning">
          Choque com: ${conflicts.map(c => `<strong>${escapeHtml(c.title)}</strong> (${c.start_time || ""}–${c.end_time || ""})`).join(", ")}
          — sugira outro horário ou edite antes de aprovar.
        </div>` : ""}

      <div class="suggestion-actions">
        <button class="btn btn-sm btn-approve" data-approve="${id}">✓ ${hasConflict ? "Aprovar mesmo assim" : "Aprovar"}</button>
        <button class="btn btn-sm" data-edit="${id}">✎ Editar</button>
        <button class="btn btn-sm" data-regenerate="${id}" title="Pedir ao Python o próximo horário livre">↻ Sugerir outro horário</button>
        <button class="btn btn-sm btn-danger" data-reject="${id}">✕ Rejeitar</button>
      </div>
    </div>`;
}

function bindSuggestionButtons(scope) {
  scope.querySelectorAll("[data-approve]").forEach(btn =>
    btn.addEventListener("click", () => decide(btn.dataset.approve, "approve", btn)));
  scope.querySelectorAll("[data-reject]").forEach(btn =>
    btn.addEventListener("click", () => decide(btn.dataset.reject, "reject", btn)));
  scope.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openEditModal(btn.dataset.edit, btn.closest(".suggestion-card"))));
  scope.querySelectorAll("[data-regenerate]").forEach(btn =>
    btn.addEventListener("click", () => onRegenerate(btn.dataset.regenerate, btn)));
}

async function onRegenerate(id, btn) {
  const card = btn.closest(".suggestion-card");
  btn.disabled = true;
  btn.textContent = "Calculando encaixe...";
  try {
    const updated = await Api.regenerateSuggestion(id);
    const data = JSON.parse(updated.structured_data);
    const template = document.createElement("template");
    template.innerHTML = renderSuggestionCard(id, data, {
      message: `Novo encaixe livre calculado pelo Python: ${data.date} às ${data.time} (sem conflitos).`,
    });
    const newCard = template.content.firstElementChild;
    card.replaceWith(newCard);
    bindSuggestionButtons(newCard);
    toast("Novo horário livre sugerido pelo sistema!", "success");
  } catch (err) {
    toast(err.message || "Não foi possível sugerir novo horário.", "error");
    btn.disabled = false;
    btn.textContent = "↻ Sugerir outro horário";
  }
}

async function decide(id, action, btn) {
  const card = btn.closest(".suggestion-card");
  const title = card.getAttribute("data-sugg-title") || "Item";
  const type = card.getAttribute("data-sugg-type") || "tarefa";
  btn.disabled = true;
  try {
    if (action === "approve") {
      await Api.approveSuggestion(id);
      card.classList.remove("has-conflict");
      card.classList.add("is-approved");
      const targetHref = type === "compromisso" ? "compromissos.html" : "tarefas.html";
      const targetLabel = type === "compromisso" ? "Ver em Compromissos →" : "Ver em Tarefas →";
      card.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:10px; color:var(--success);">
            <img class="sticker-img sticker-sm" src="assets/stickers/slime-done.svg" alt="Aprovada">
            <div>
              <strong>✓ Ação aprovada: "${escapeHtml(title)}" foi incorporada à sua rotina!</strong>
              <div class="text-dim" style="font-size:.75rem; font-family:var(--font-mono);">Persistido no banco SQL e auditado no Histórico.</div>
            </div>
          </div>
          <a class="btn btn-xs" href="${targetHref}">${targetLabel}</a>
        </div>`;
      toast("Sugestão aprovada e salva na rotina!", "success");
    } else {
      await Api.rejectSuggestion(id);
      card.classList.remove("has-conflict");
      card.classList.add("is-rejected");
      card.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <span class="text-dim">✕ Sugestão <strong>"${escapeHtml(title)}"</strong> descartada por você (nenhum dado alterado na rotina).</span>
          <span class="badge badge-pendente">Rejeitada</span>
        </div>`;
      toast("Sugestão rejeitada.", "info");
    }
  } catch (err) {
    toast(err.message || "Erro ao processar decisão.", "error");
    btn.disabled = false;
  }
}

let currentEditCard = null;
function openEditModal(id, card) {
  currentEditCard = card;
  Api.listSuggestions().then(list => {
    const sugg = list.find(s => s.id == id);
    if (!sugg) {
      toast("Sugestão não encontrada.", "error");
      return;
    }
    const data = JSON.parse(sugg.structured_data);
    document.getElementById("edit-sugg-id").value = id;
    document.getElementById("edit-sugg-title").value = data.title || "";
    document.getElementById("edit-sugg-type").value = data.type || "tarefa";
    document.getElementById("edit-sugg-priority").value = data.priority || "media";
    document.getElementById("edit-sugg-date").value = data.date || "";
    document.getElementById("edit-sugg-time").value = data.time || "";
    document.getElementById("edit-sugg-duration").value = data.duration_minutes || 30;
    document.getElementById("edit-sugg-category").value = data.category || "geral";
    document.getElementById("edit-sugg-overlay").classList.add("open");
  }).catch(err => toast(err.message || "Não foi possível carregar a sugestão.", "error"));
}

async function onSaveEdit(e) {
  e.preventDefault();
  const id = document.getElementById("edit-sugg-id").value;
  const payload = {
    type: document.getElementById("edit-sugg-type").value,
    title: document.getElementById("edit-sugg-title").value.trim(),
    description: document.getElementById("edit-sugg-title").value.trim(),
    priority: document.getElementById("edit-sugg-priority").value,
    date: document.getElementById("edit-sugg-date").value || null,
    time: document.getElementById("edit-sugg-time").value || null,
    duration_minutes: parseInt(document.getElementById("edit-sugg-duration").value) || 30,
    category: document.getElementById("edit-sugg-category").value,
    conflicts: [],
  };
  try {
    const updated = await Api.editSuggestion(id, payload);
    const updatedData = JSON.parse(updated.structured_data);
    document.getElementById("edit-sugg-overlay").classList.remove("open");
    toast("Sugestão editada e revalidada pelo Python. Aprove quando estiver pronta.", "success");
    if (currentEditCard) {
      const template = document.createElement("template");
      template.innerHTML = renderSuggestionCard(id, updatedData);
      const updatedCard = template.content.firstElementChild;
      currentEditCard.replaceWith(updatedCard);
      bindSuggestionButtons(updatedCard);
    }
  } catch (err) {
    toast(err.message || "Erro ao editar sugestão.", "error");
  }
}
