/* Guarda de autenticação para páginas internas + lógica das telas de login/cadastro. */
function requireAuth() {
  // O MINDSIDE agora funciona em modo visitante: nenhuma página interna
  // exige login. A API cria automaticamente uma sessão isolada no navegador.
  return true;
}

function initLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;
  const errorBox = document.getElementById("form-error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.style.display = "none";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Entrando...";
    try {
      const data = await Api.login({ email, password });
      Api.setToken(data.access_token);
      Api.setUser(data.user);
      location.href = "dashboard.html";
    } catch (err) {
      errorBox.textContent = err.message || "Não foi possível entrar.";
      errorBox.style.display = "block";
    } finally {
      btn.disabled = false; btn.textContent = "Entrar";
    }
  });
}

function initRegisterForm() {
  const form = document.getElementById("register-form");
  if (!form) return;
  const errorBox = document.getElementById("form-error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.style.display = "none";
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const password_confirm = document.getElementById("password_confirm").value;
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Criando conta...";
    try {
      const data = await Api.register({ name, email, password, password_confirm });
      Api.setToken(data.access_token);
      Api.setUser(data.user);
      location.href = "dashboard.html";
    } catch (err) {
      errorBox.textContent = err.message || "Não foi possível criar a conta.";
      errorBox.style.display = "block";
    } finally {
      btn.disabled = false; btn.textContent = "Criar conta";
    }
  });
}

function initLogout() {
  const btn = document.querySelector("[data-logout]");
  if (btn) btn.addEventListener("click", () => {
    Api.clearToken();
    // Em vez de obrigar login, a próxima ação cria uma nova sessão de visitante.
    location.href = "dashboard.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initLoginForm();
  initRegisterForm();
  initLogout();
});
