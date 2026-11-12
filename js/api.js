/* Cliente central da API do MINDSIDE. Nenhuma outra parte do frontend
   deve montar URLs ou headers manualmente — tudo passa por aqui. */
const API_BASE = (() => {
  // Permite rodar o frontend servido separadamente do backend em dev.
  if (window.MINDSIDE_API_BASE) return window.MINDSIDE_API_BASE;
  return "http://localhost:8000";
})();

const Api = {
  token() { return localStorage.getItem("mindside_token"); },

  setToken(t) { localStorage.setItem("mindside_token", t); },

  clearToken() { localStorage.removeItem("mindside_token"); localStorage.removeItem("mindside_user"); },

  setUser(u) { localStorage.setItem("mindside_user", JSON.stringify(u)); },

  user() {
    try { return JSON.parse(localStorage.getItem("mindside_user") || "null"); }
    catch { return null; }
  },

  async ensureGuestSession() {
    if (this.token()) return this.token();

    let resp;
    try {
      resp = await fetch(`${API_BASE}/api/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      throw { status: 0, message: "Não foi possível conectar ao servidor do MINDSIDE. Verifique se o backend está rodando." };
    }

    let data = null;
    try { data = await resp.json(); } catch { /* sem corpo */ }

    if (!resp.ok || !data?.access_token) {
      const detail = data && data.detail ? data.detail : "Não foi possível iniciar a sessão de visitante.";
      throw { status: resp.status, message: typeof detail === "string" ? detail : JSON.stringify(detail), raw: data };
    }

    this.setToken(data.access_token);
    this.setUser(data.user);
    return data.access_token;
  },

  async request(path, { method = "GET", body = null, auth = true } = {}) {
    if (auth) await this.ensureGuestSession();

    const doRequest = async () => {
      const headers = { "Content-Type": "application/json" };
      if (auth && this.token()) headers["Authorization"] = `Bearer ${this.token()}`;

      try {
        return await fetch(`${API_BASE}${path}`, {
          method, headers, body: body ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        throw { status: 0, message: "Não foi possível conectar ao servidor do MINDSIDE. Verifique se o backend está rodando." };
      }
    };

    let resp = await doRequest();

    // Se uma sessão de visitante expirar, cria outra automaticamente.
    if (resp.status === 401 && auth) {
      this.clearToken();
      await this.ensureGuestSession();
      resp = await doRequest();
    }

    if (resp.status === 204) return null;

    let data = null;
    try { data = await resp.json(); } catch { /* sem corpo */ }

    if (!resp.ok) {
      const detail = data && data.detail ? data.detail : "Ocorreu um erro.";
      const message = typeof detail === "string" ? detail : (detail.message || JSON.stringify(detail));
      throw { status: resp.status, message, raw: data };
    }
    return data;
  },

  // ---- Auth ----
  register(payload) { return this.request("/api/auth/register", { method: "POST", body: payload, auth: false }); },
  login(payload) { return this.request("/api/auth/login", { method: "POST", body: payload, auth: false }); },
  me() { return this.request("/api/auth/me"); },
  updateProfile(payload) { return this.request("/api/auth/me", { method: "PUT", body: payload }); },

  // ---- Categories & Availability ----
  listCategories() { return this.request("/api/categories"); },
  createCategory(p) { return this.request("/api/categories", { method: "POST", body: p }); },
  deleteCategory(id) { return this.request(`/api/categories/${id}`, { method: "DELETE" }); },
  listAvailability() { return this.request("/api/availability"); },
  createAvailability(p) { return this.request("/api/availability", { method: "POST", body: p }); },
  deleteAvailability(id) { return this.request(`/api/availability/${id}`, { method: "DELETE" }); },

  // ---- Tasks ----
  listTasks() { return this.request("/api/tasks"); },
  createTask(p) { return this.request("/api/tasks", { method: "POST", body: p }); },
  updateTask(id, p) { return this.request(`/api/tasks/${id}`, { method: "PUT", body: p }); },
  deleteTask(id) { return this.request(`/api/tasks/${id}`, { method: "DELETE" }); },

  // ---- Appointments ----
  listAppointments() { return this.request("/api/appointments"); },
  createAppointment(p) { return this.request("/api/appointments", { method: "POST", body: p }); },
  updateAppointment(id, p) { return this.request(`/api/appointments/${id}`, { method: "PUT", body: p }); },
  deleteAppointment(id) { return this.request(`/api/appointments/${id}`, { method: "DELETE" }); },

  // ---- Goals ----
  listGoals() { return this.request("/api/goals"); },
  createGoal(p) { return this.request("/api/goals", { method: "POST", body: p }); },
  updateGoal(id, p) { return this.request(`/api/goals/${id}`, { method: "PUT", body: p }); },
  deleteGoal(id) { return this.request(`/api/goals/${id}`, { method: "DELETE" }); },

  // ---- AI / Suggestions ----
  analyze(text) { return this.request("/api/ai/analyze", { method: "POST", body: { text } }); },
  listSuggestions() { return this.request("/api/suggestions"); },
  editSuggestion(id, structured_data, note = "") { return this.request(`/api/suggestions/${id}`, { method: "PUT", body: { structured_data, note } }); },
  regenerateSuggestion(id) { return this.request(`/api/suggestions/${id}/regenerate`, { method: "POST" }); },
  approveSuggestion(id) { return this.request(`/api/suggestions/${id}/approve`, { method: "POST" }); },
  rejectSuggestion(id) { return this.request(`/api/suggestions/${id}/reject`, { method: "POST" }); },
  listSuggestionDecisions(id) { return this.request(`/api/suggestions/${id}/decisions`); },
  listSuggestionValidations(id) { return this.request(`/api/suggestions/${id}/validations`); },

  // ---- Demo & History ----
  seedDemo() { return this.request("/api/demo/seed", { method: "POST" }); },
  resetDemo() { return this.request("/api/demo/reset", { method: "POST" }); },
  listHistory() { return this.request("/api/history"); },
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function localTodayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

window.escapeHtml = escapeHtml;
window.localTodayIso = localTodayIso;
