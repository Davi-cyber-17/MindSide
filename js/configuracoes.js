document.addEventListener("DOMContentLoaded", async () => {
  renderShell("configuracoes.html", "Configurações", "Suas preferências no MINDSIDE.");
  const user = Api.user();
  const content = document.getElementById("page-content");
  content.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="card list-card">
          <h3 class="mt-0">Perfil</h3>
          <p class="text-dim" style="font-size:.85rem;">Nome: <strong>${escapeHtml(user?.name || "")}</strong></p>
          <p class="text-dim" style="font-size:.85rem;">E-mail: <strong>${escapeHtml(user?.email || "")}</strong></p>
          <p class="text-dim" style="font-size:.8rem;">Versão demonstrativa: o perfil é apenas ilustrativo e a edição de nome/senha não está disponível.</p>
        </div>
        <div class="card list-card">
          <h3 class="mt-0">Consentimentos e privacidade</h3>
          <p class="text-dim" style="font-size:.85rem;">
            Nesta versão demonstrativa nada sai do seu navegador: tarefas, compromissos, objetivos e o
            texto do Assistente ficam salvos apenas neste dispositivo (localStorage) e nenhum serviço
            de IA externo é chamado — o Assistente usa um interpretador local baseado em regras.
          </p>
        </div>
      </div>
      <div>
        <div class="card list-card">
          <h3 class="mt-0">Aparência</h3>
          <p class="text-dim" style="font-size:.85rem; margin-bottom:12px;">Alterne entre o tema claro e escuro.</p>
          <button class="btn btn-primary" data-theme-toggle>Alternar tema</button>
        </div>
        <div class="card list-card">
          <h3 class="mt-0">Dados de demonstração</h3>
          <p class="text-dim" style="font-size:.85rem; margin-bottom:12px;">Apaga o que você criou e restaura os exemplos iniciais.</p>
          <button class="btn btn-danger" id="reset-demo">Restaurar demonstração</button>
        </div>
      </div>
    </div>`;
  window.MindsideTheme.init();
  document.getElementById("reset-demo").addEventListener("click", () => {
    if (!confirm("Restaurar os dados de demonstração? O que você criou será apagado.")) return;
    Api.resetDemo();
    toast("Demonstração restaurada.", "success");
    setTimeout(() => location.href = "dashboard.html", 600);
  });
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
