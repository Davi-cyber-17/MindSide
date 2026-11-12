document.addEventListener("DOMContentLoaded", async () => {
  renderShell(
    "configuracoes.html",
    "Configurações"
  );
  await renderConfigPage();
});

async function renderConfigPage() {
  const user = Api.user() || { name: "Visitante", email: "Sessão local" };
  const isGuestEmail = user.email && user.email.startsWith("guest_") && user.email.endsWith("@example.com");
  const sessionDisplay = isGuestEmail ? "Sessão de Visitante Isolada (SQLite Local)" : (user.email || "");

  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="grid-2-equal">
      <div>
        <div class="card list-card">
          <div class="head">
            <div>
              <h3 class="mt-0">Perfil da Sessão</h3>
            </div>
          </div>
          <form id="profile-form">
            <div class="field">
              <label for="profile-name">Nome de exibição</label>
              <input type="text" id="profile-name" value="${escapeHtml(user.name || "")}" maxlength="120" required>
            </div>
            <div class="field">
              <label>Modo de persistência</label>
              <input type="text" value="${escapeHtml(sessionDisplay)}" disabled>
            </div>
            <button type="submit" class="btn btn-sm btn-primary">Salvar nome de exibição</button>
          </form>
        </div>

        <div class="card list-card">
          <div class="head">
            <div>
              <h3 class="mt-0">Janelas de Horários Disponíveis</h3>
            </div>
          </div>
          <form id="avail-form" style="margin-bottom:16px;">
            <div class="form-row">
              <div class="field">
                <label for="avail-day">Dia da semana</label>
                <select id="avail-day">
                  <option value="Segunda">Segunda-feira</option>
                  <option value="Terca">Terça-feira</option>
                  <option value="Quarta">Quarta-feira</option>
                  <option value="Quinta">Quinta-feira</option>
                  <option value="Sexta">Sexta-feira</option>
                  <option value="Sabado">Sábado</option>
                  <option value="Domingo">Domingo</option>
                </select>
              </div>
              <div class="field">
                <label for="avail-start">Intervalo (Início – Fim)</label>
                <div style="display:flex; gap:8px;">
                  <input type="time" id="avail-start" value="14:00" required>
                  <input type="time" id="avail-end" value="18:00" required>
                </div>
              </div>
            </div>
            <button type="submit" class="btn btn-sm btn-primary">+ Adicionar janela livre</button>
          </form>
          <div id="avail-container"></div>
        </div>
      </div>

      <div>
        <div class="card list-card">
          <div class="head">
            <div>
              <h3 class="mt-0">Categorias Contextuais</h3>
            </div>
          </div>
          <form id="cat-form" style="margin-bottom:16px;">
            <div class="form-row">
              <div class="field">
                <label for="cat-name">Nome da categoria</label>
                <input type="text" id="cat-name" placeholder="Ex.: Iniciação Científica" maxlength="50" required>
              </div>
              <div class="field">
                <label for="cat-type">Grupo semântico</label>
                <select id="cat-type">
                  <option value="Estudo">Estudo</option>
                  <option value="Trabalho">Trabalho</option>
                  <option value="Saude">Saúde</option>
                  <option value="Lazer">Lazer</option>
                  <option value="Pessoal">Pessoal</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>
            <button type="submit" class="btn btn-sm btn-primary">+ Criar categoria</button>
          </form>
          <div id="cat-container"></div>
        </div>

        <div class="card list-card">
          <div class="head">
            <div>
              <h3 class="mt-0">Demonstração e aparência</h3>
            </div>
          </div>
          <p class="text-secondary" style="font-size:.83rem; margin-top:0; margin-bottom:14px;">
            Carregue um cenário de demonstração ou limpe os dados da sessão.
          </p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="theme-toggle" data-theme-toggle aria-label="Mudar para tema claro"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg></button>
            <button class="btn btn-sm btn-primary" id="cfg-seed-btn">Carregar Cenário SIC</button>
            <button class="btn btn-sm btn-danger" id="cfg-reset-btn">Limpar dados da sessão</button>
          </div>
        </div>

        <div class="card list-card">
          <div class="head">
            <div>
              <h3 class="mt-0">Privacidade</h3>
            </div>
          </div>
          <p class="text-secondary" style="font-size:.82rem; margin:0; line-height:1.6;">
            Apenas o texto digitado no Assistente é enviado à IA. Validação e dados ficam no Python,
            e nenhuma sugestão altera sua rotina sem a sua aprovação.
          </p>
        </div>
      </div>
    </div>`;

  window.MindsideTheme.init();

  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("profile-name").value.trim();
    if (!name) return;
    try {
      const updated = await Api.updateProfile({ name });
      Api.setUser(updated);
      toast("Nome atualizado com sucesso!", "success");
      renderShell(
        "configuracoes.html",
        "Configurações"
      );
      await renderConfigPage();
    } catch (err) {
      toast(err.message || "Erro ao atualizar perfil.", "error");
    }
  });

  document.getElementById("avail-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await Api.createAvailability({
        day_of_week: document.getElementById("avail-day").value,
        start_time: document.getElementById("avail-start").value,
        end_time: document.getElementById("avail-end").value,
        status: "Ativo",
      });
      toast("Janela de disponibilidade adicionada!", "success");
      await loadConfigLists();
    } catch (err) {
      toast(err.message || "Erro ao cadastrar horário.", "error");
    }
  });

  document.getElementById("cat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("cat-name");
    try {
      await Api.createCategory({
        name: input.value.trim(),
        tipo_categoria: document.getElementById("cat-type").value,
      });
      input.value = "";
      toast("Categoria contextual criada!", "success");
      await loadConfigLists();
    } catch (err) {
      toast(err.message || "Erro ao criar categoria.", "error");
    }
  });

  document.getElementById("cfg-seed-btn").addEventListener("click", async () => {
    try {
      await Api.seedDemo();
      toast("Cenário de demonstração SIC carregado!", "success");
      await loadConfigLists();
    } catch (err) {
      toast(err.message || "Erro ao carregar cenário.", "error");
    }
  });

  document.getElementById("cfg-reset-btn").addEventListener("click", async () => {
    if (!confirm("Deseja limpar todas as tarefas, compromissos, objetivos e sugestões desta sessão?")) return;
    try {
      await Api.resetDemo();
      toast("Dados da sessão limpos.", "info");
      await loadConfigLists();
    } catch (err) {
      toast(err.message || "Erro ao limpar dados.", "error");
    }
  });

  await loadConfigLists();
}

async function loadConfigLists() {
  const availContainer = document.getElementById("avail-container");
  const catContainer = document.getElementById("cat-container");
  try {
    const [slots, cats] = await Promise.all([Api.listAvailability(), Api.listCategories()]);
    availContainer.innerHTML = slots.length ? slots.map(s => `
      <div class="item-row" style="padding:10px 14px;">
        <div>
          <div class="item-title">${escapeHtml(s.day_of_week)}</div>
          <div class="meta">${s.start_time.slice(0,5)} às ${s.end_time.slice(0,5)}</div>
        </div>
        <div class="item-actions">
          <span class="badge badge-concluida">Ativo</span>
          <button class="btn btn-sm btn-danger" data-del-slot="${s.id}">Remover</button>
        </div>
      </div>`).join("") : `
      <div class="empty-state-box">
        <img class="sticker-img sticker-sm" src="assets/stickers/slime-empty.svg" alt="Sem horários">
        <div>Nenhuma janela cadastrada ainda.</div>
      </div>`;

    availContainer.querySelectorAll("[data-del-slot]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await Api.deleteAvailability(btn.dataset.delSlot);
        toast("Horário removido.", "info");
        await loadConfigLists();
      });
    });

    catContainer.innerHTML = cats.map(c => `
      <div class="item-row" style="padding:10px 14px;">
        <div>
          <div class="item-title">${escapeHtml(c.name)}</div>
          <div class="meta">Grupo: ${escapeHtml(c.tipo_categoria)} · Código: ${escapeHtml(c.slug)}</div>
        </div>
        <span class="badge badge-pendente">${escapeHtml(c.tipo_categoria)}</span>
      </div>`).join("");
  } catch (err) {
    toast(err.message || "Erro ao carregar listas de configuração.", "error");
  }
}
