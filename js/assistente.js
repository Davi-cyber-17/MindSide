let mainSlime = null;

document.addEventListener("DOMContentLoaded", async () => {
  renderShell("assistente.html", "Assistente MINDSIDE", "Escreva em linguagem natural. A IA sugere, você decide.");
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="assistant-header hud card">
      <div style="width:64px;height:52px;flex-shrink:0;" data-slime id="main-assistant-slime"></div>
      <div class="assistant-header-text">
        <div style="font-weight:700; font-family:var(--font-display);">MINDSIDE</div>
        <div class="text-dim" style="font-size:.82rem;">Interpretando linguagem natural · sugestões aguardam sua aprovação</div>
      </div>
    </div>
    <div class="chat-wrap">
      <div class="chat-messages" id="chat-messages">
        <div class="msg ai">
          Olá! Me conte o que você precisa organizar — por exemplo:
          "Tenho prova de matemática sexta-feira às 18h e preciso terminar meu trabalho de programação."
        </div>
      </div>
      <form class="chat-input-bar" id="chat-form">
        <input type="text" id="chat-input" placeholder="Escreva sua necessidade..." autocomplete="off" required>
        <button type="submit" class="btn btn-primary">Enviar</button>
      </form>
    </div>`;

  document.getElementById("chat-form").addEventListener("submit", onSend);
  document.getElementById("edit-sugg-cancel").addEventListener("click", () =>
    document.getElementById("edit-sugg-overlay").classList.remove("open"));
  document.getElementById("edit-sugg-form").addEventListener("submit", onSaveEdit);

  const assistantSlimeBox = document.getElementById("main-assistant-slime");
  mainSlime = new Slime(assistantSlimeBox);
});

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
  const text = input.value.trim();
  if (!text) return;
  addMessage(escapeHtml(text), "user");
  input.value = "";
  if (mainSlime) mainSlime.processing();

  const thinkingMsg = addMessage(`<em class="text-dim">Analisando...</em>`, "ai");

  try {
    const result = await Api.analyze(text);
    thinkingMsg.remove();
    if (mainSlime) mainSlime.respond();

    let html = `<div>${escapeHtml(result.reasoning_summary || "Aqui está o que encontrei:")}</div>`;
    result.suggestions.forEach(s => {
      const data = s.structured_data;
      html += renderSuggestionCard(s.id, data);
    });
    const msgEl = addMessage(html, "ai");
    bindSuggestionButtons(msgEl);
  } catch (err) {
    thinkingMsg.remove();
    if (mainSlime) mainSlime.errorState();
    addMessage(escapeHtml(err.message || "Não foi possível gerar uma sugestão."), "ai");
  }
}

function renderSuggestionCard(id, data) {
  const conflicts = data.conflicts || [];
  return `
    <div class="suggestion-card" data-sugg-id="${id}" style="margin-top:10px;">
      <strong>${data.type === "compromisso" ? "📅 Compromisso" : "📋 Tarefa"}: ${escapeHtml(data.title)}</strong>
      <div class="meta" style="margin-top:6px;">
        ${data.date ? "Data: " + data.date + " " : ""}${data.time ? "às " + data.time + " " : ""}
        ${data.duration_minutes ? "· " + data.duration_minutes + " min " : ""}
        · Prioridade: ${data.priority} · Categoria: ${data.category}
      </div>
      ${conflicts.length ? `<div class="conflict-warning">⚠️ Conflito detectado com: ${conflicts.map(c => c.title).join(", ")}</div>` : ""}
      <div class="suggestion-actions">
        <button class="btn btn-sm btn-primary" data-approve="${id}">Aprovar</button>
        <button class="btn btn-sm" data-edit="${id}">Editar</button>
        <button class="btn btn-sm btn-danger" data-reject="${id}">Rejeitar</button>
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
}

async function decide(id, action, btn) {
  const card = btn.closest(".suggestion-card");
  btn.disabled = true;
  try {
    if (action === "approve") {
      await Api.approveSuggestion(id);
      card.innerHTML = `<span style="color:var(--success);">✅ Sugestão aprovada e aplicada.</span>`;
      toast("Sugestão aprovada!", "success");
    } else {
      await Api.rejectSuggestion(id);
      card.innerHTML = `<span class="text-dim">❌ Sugestão rejeitada.</span>`;
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
  // reconstrói os dados a partir do texto exibido não é confiável; então buscamos via API
  Api.listSuggestions().then(list => {
    const sugg = list.find(s => s.id == id);
    if (!sugg) return;
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
  });
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
    await Api.editSuggestion(id, payload);
    document.getElementById("edit-sugg-overlay").classList.remove("open");
    toast("Sugestão atualizada. Revise e aprove quando estiver pronta.", "success");
    if (currentEditCard) {
      currentEditCard.outerHTML = renderSuggestionCard(id, payload);
      bindSuggestionButtons(document.getElementById("chat-messages"));
    }
  } catch (err) {
    toast(err.message || "Erro ao editar sugestão.", "error");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
