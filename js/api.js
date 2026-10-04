/* MINDSIDE — VERSÃO DEMONSTRATIVA (100% estática)
   ------------------------------------------------------------------
   Esta versão não usa servidor: todos os dados ficam no localStorage do
   navegador de quem visita o site. Este arquivo substitui o cliente HTTP
   original mantendo exatamente a mesma interface (Api.listTasks(), etc.),
   então as demais telas funcionam sem alteração.

   Também reimplementa em JavaScript as regras que viviam no backend Python:
   validação, detecção de conflitos e o interpretador de linguagem natural
   baseado em regras (sem IA externa). */

const Api = (() => {
  const DB_KEY = "mindside_demo_db";
  const TOKEN_KEY = "mindside_token";
  const USER_KEY = "mindside_user";

  /* ---------- armazenamento (com fallback em memória) ---------- */
  let memoryStore = {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return memoryStore[k] ?? null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { memoryStore[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch { delete memoryStore[k]; } },
  };

  /* ---------- utilidades de data/hora (sempre no fuso local) ---------- */
  const pad = n => String(n).padStart(2, "0");
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
  const toMin = t => { const [h, m] = String(t).split(":"); return parseInt(h, 10) * 60 + parseInt(m || 0, 10); };
  const fromMin = m => { m = Math.min(m, 23 * 60 + 59); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const normTime = t => {
    if (!t) return null;
    const p = String(t).split(":");
    return `${pad(parseInt(p[0], 10))}:${pad(parseInt(p[1] || 0, 10))}:00`;
  };
  const nowIso = () => new Date().toISOString();
  const fail = (status, message, extra) => ({ status, message, raw: extra ? { detail: extra } : { detail: message } });
  const blank = v => (v === "" || v === undefined ? null : v);

  /* ---------- "banco de dados" ---------- */
  function seed(name, email) {
    const t0 = Date.now();
    const ago = min => new Date(t0 - min * 60000).toISOString();
    const db = {
      seq: { task: 1, appt: 1, goal: 1, sugg: 1, hist: 1 },
      user: { id: 1, name, email, created_at: nowIso() },
      tasks: [], appointments: [], goals: [], suggestions: [], history: [],
    };
    const T = (p) => db.tasks.push({ id: db.seq.task++, description: "", priority: "media", category: "geral",
      deadline: null, duration: 30, status: "pendente", scheduled_date: null, scheduled_time: null, created_at: nowIso(), ...p });
    const A = (p) => db.appointments.push({ id: db.seq.appt++, description: "", category: "geral", created_at: nowIso(), ...p });
    const G = (p) => db.goals.push({ id: db.seq.goal++, description: "", deadline: null, progress: 0, status: "ativo", created_at: nowIso(), ...p });

    T({ title: "Terminar trabalho de programação", description: "Finalizar e enviar o projeto da disciplina.", priority: "alta", category: "estudo", deadline: addDays(3), duration: 120, status: "em_andamento", scheduled_date: addDays(1), scheduled_time: "19:00:00" });
    T({ title: "Revisar matéria de matemática", priority: "urgente", category: "estudo", deadline: addDays(2), duration: 90, scheduled_date: addDays(2), scheduled_time: "14:00:00" });
    T({ title: "Enviar relatório semanal", priority: "media", category: "trabalho", deadline: addDays(4), duration: 45 });
    T({ title: "Treino de corrida", priority: "baixa", category: "saude", duration: 40, status: "concluida" });

    A({ title: "Prova de matemática", description: "Capítulos 4 a 7.", date: addDays(3), start_time: "08:00:00", end_time: "10:00:00", category: "estudo" });
    A({ title: "Aula de programação", date: addDays(0), start_time: "16:00:00", end_time: "17:30:00", category: "estudo" });
    A({ title: "Reunião de projeto", date: addDays(1), start_time: "10:00:00", end_time: "11:00:00", category: "trabalho" });
    A({ title: "Consulta médica", date: addDays(5), start_time: "09:30:00", end_time: "10:30:00", category: "saude" });
    A({ title: "Cinema com amigos", date: addDays(6), start_time: "20:00:00", end_time: "22:30:00", category: "lazer" });

    G({ title: "Passar em todas as matérias do semestre", description: "Manter as notas acima da média.", deadline: addDays(90), progress: 45 });
    G({ title: "Correr 5 km sem parar", deadline: addDays(45), progress: 70 });
    G({ title: "Aprender inglês intermediário", progress: 20, status: "pausado" });

    [
      ["conta_criada", "Conta de demonstração criada no MINDSIDE.", 240],
      ["tarefa_criada", "Você criou a tarefa 'Terminar trabalho de programação'.", 180],
      ["compromisso_criado", "Você criou o compromisso 'Prova de matemática'.", 120],
      ["objetivo_criado", "Você criou o objetivo 'Correr 5 km sem parar'.", 60],
    ].forEach(([action, description, m]) => db.history.push({ id: db.seq.hist++, action, description, created_at: ago(m) }));
    return db;
  }

  function loadDb() {
    try {
      const raw = store.get(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* dados corrompidos: recria abaixo */ }
    return null;
  }
  function saveDb(db) { store.set(DB_KEY, JSON.stringify(db)); }

  function startSession(name, email) {
    const db = seed(name, email);
    saveDb(db);
    store.set(TOKEN_KEY, "demo-token");
    store.set(USER_KEY, JSON.stringify(db.user));
    return db;
  }

  function db() {
    let d = loadDb();
    if (!d) d = startSession("Visitante", "demo@mindside.app");
    return d;
  }
  function log(d, action, description) {
    d.history.unshift({ id: d.seq.hist++, action, description, created_at: nowIso() });
    d.history = d.history.slice(0, 200);
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  const findById = (list, id) => list.find(x => x.id === Number(id));

  /* ---------- conflitos de horário ---------- */
  const overlaps = (sa, ea, sb, eb) => sa < eb && sb < ea;

  function checkConflict(d, day, startMin, endMin, ignoreApptId = null) {
    const out = [];
    d.appointments.filter(a => a.date === day && a.id !== ignoreApptId).forEach(a => {
      if (overlaps(startMin, endMin, toMin(a.start_time), toMin(a.end_time)))
        out.push({ type: "appointment", id: a.id, title: a.title, start_time: a.start_time.slice(0, 5), end_time: a.end_time.slice(0, 5) });
    });
    d.tasks.filter(t => t.scheduled_date === day && t.scheduled_time).forEach(t => {
      const s = toMin(t.scheduled_time), e = s + (t.duration || 30);
      if (overlaps(startMin, endMin, s, e))
        out.push({ type: "task", id: t.id, title: t.title, start_time: t.scheduled_time.slice(0, 5), end_time: fromMin(e) });
    });
    return out;
  }

  /* ---------- validação das sugestões ---------- */
  const VALID_PRIORITIES = ["baixa", "media", "alta", "urgente"];
  const VALID_TYPES = ["tarefa", "compromisso"];
  const VALID_CATEGORIES = ["estudo", "trabalho", "saude", "lazer", "pessoal", "geral"];

  function validateSuggestion(data) {
    if (!data || typeof data !== "object") return [false, "Formato de dados inválido."];
    if (!VALID_TYPES.includes(data.type)) return [false, `Tipo '${data.type}' inválido.`];
    if (!data.title || typeof data.title !== "string") return [false, "Título ausente ou inválido."];
    if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return [false, "Data em formato inválido (esperado AAAA-MM-DD)."];
    if (data.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)) return [false, "Horário em formato inválido (esperado HH:MM)."];
    const dur = data.duration_minutes;
    if (dur !== null && dur !== undefined && (!Number.isInteger(dur) || dur <= 0 || dur > 1440)) return [false, "Duração inválida."];
    if (data.priority && !VALID_PRIORITIES.includes(data.priority)) return [false, `Prioridade '${data.priority}' inválida.`];
    if (data.category && !VALID_CATEGORIES.includes(data.category)) data.category = "geral";
    return [true, "ok"];
  }

  /* ---------- interpretador de linguagem natural (por regras) ---------- */
  const WEEKDAYS = {
    "segunda": 0, "segunda-feira": 0, "terca": 1, "terça": 1, "terca-feira": 1, "terça-feira": 1,
    "quarta": 2, "quarta-feira": 2, "quinta": 3, "quinta-feira": 3, "sexta": 4, "sexta-feira": 4,
    "sabado": 5, "sábado": 5, "domingo": 6,
  };
  const PRIORITY_KEYWORDS = [["urgente", "urgente"], ["urgência", "urgente"], ["muito importante", "alta"],
    ["importante", "alta"], ["prova", "alta"], ["prazo", "alta"]];
  const CATEGORY_KEYWORDS = [["prova", "estudo"], ["estudar", "estudo"], ["matéria", "estudo"], ["trabalho de", "estudo"],
    ["faculdade", "estudo"], ["aula", "estudo"], ["reunião", "trabalho"], ["projeto", "trabalho"], ["trabalho", "trabalho"],
    ["treino", "saude"], ["academia", "saude"], ["corrida", "saude"], ["médico", "saude"],
    ["cinema", "lazer"], ["festa", "lazer"], ["passeio", "lazer"]];

  function interpret(text) {
    const lowered = text.toLowerCase();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let foundDate = null;

    for (const [word, idx] of Object.entries(WEEKDAYS)) {
      if (lowered.includes(word)) {
        const todayIdx = (today.getDay() + 6) % 7; // segunda = 0
        let ahead = (idx - todayIdx + 7) % 7; if (ahead === 0) ahead = 7;
        const d = new Date(today); d.setDate(d.getDate() + ahead);
        foundDate = isoDate(d);
        break;
      }
    }
    if (lowered.includes("amanhã") || lowered.includes("amanha")) foundDate = addDays(1);
    if (lowered.includes("hoje")) foundDate = isoDate(today);

    let foundTime = null;
    const m = lowered.match(/(\d{1,2})[:h](\d{2})?/);
    if (m) {
      const h = parseInt(m[1], 10), mi = m[2] ? parseInt(m[2], 10) : 0;
      if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) foundTime = `${pad(h)}:${pad(mi)}`;
    }

    let priority = "media";
    for (const [kw, p] of PRIORITY_KEYWORDS) if (lowered.includes(kw)) { priority = p; break; }
    let category = "geral";
    for (const [kw, c] of CATEGORY_KEYWORDS) if (lowered.includes(kw)) { category = c; break; }

    const tipo = ((foundDate && foundTime) || lowered.includes("prova") || lowered.includes("reunião")) ? "compromisso" : "tarefa";
    let title = text.trim().split(".")[0].slice(0, 120);
    if (title.length < 3) title = text.trim().slice(0, 120);

    return {
      suggestions: [{
        type: tipo, title, description: text.trim(), priority,
        date: foundDate, time: foundTime, duration_minutes: tipo === "compromisso" ? 60 : 30, category,
      }],
      reasoning_summary: "Modo demonstração: sugestão gerada localmente, no seu navegador, a partir de palavras-chave, datas e horários identificados no texto.",
    };
  }

  /* ---------- helpers de saída ---------- */
  const suggOut = s => ({ id: s.id, type: s.type, content: s.content, structured_data: s.structured_data, status: s.status, created_at: s.created_at });
  const later = (v) => Promise.resolve(clone(v)); // mantém a interface assíncrona

  function endFor(startTime, durationMin) {
    return fromMin(toMin(startTime) + durationMin) + ":00";
  }

  /* ================= API pública ================= */
  return {
    token() { return store.get(TOKEN_KEY); },
    setToken(t) { store.set(TOKEN_KEY, t); },
    clearToken() {
      // "Nova sessão" = reinicia a demonstração com os dados de exemplo.
      store.del(TOKEN_KEY); store.del(USER_KEY); store.del(DB_KEY);
    },
    setUser(u) { store.set(USER_KEY, JSON.stringify(u)); },
    user() {
      try { return JSON.parse(store.get(USER_KEY) || "null"); } catch { return null; }
    },
    async ensureGuestSession() { db(); return this.token(); },
    resetDemo() { this.clearToken(); db(); },

    // ---- Auth (simulada) ----
    async register({ name, email, password, password_confirm }) {
      if (!name || !email) throw fail(400, "Preencha nome e e-mail.");
      if (password !== password_confirm) throw fail(400, "As senhas não coincidem.");
      if ((password || "").length < 6) throw fail(400, "A senha deve ter ao menos 6 caracteres.");
      const d = startSession(name, email);
      return { access_token: "demo-token", token_type: "bearer", user: clone(d.user) };
    },
    async login({ email }) {
      // Demonstração: qualquer credencial entra. Mantém os dados existentes, se houver.
      let d = loadDb();
      const nome = (email || "Visitante").split("@")[0];
      const displayName = nome.charAt(0).toUpperCase() + nome.slice(1);
      if (!d) d = startSession(displayName, email || "demo@mindside.app");
      else { d.user.name = displayName; d.user.email = email || d.user.email; saveDb(d); }
      store.set(TOKEN_KEY, "demo-token");
      store.set(USER_KEY, JSON.stringify(d.user));
      return { access_token: "demo-token", token_type: "bearer", user: clone(d.user) };
    },
    async me() { return later(db().user); },

    // ---- Tasks ----
    async listTasks() {
      return later([...db().tasks].sort((a, b) => b.id - a.id));
    },
    async createTask(p) {
      const d = db();
      if (!p.title) throw fail(422, "Título obrigatório.");
      const task = {
        id: d.seq.task++, title: p.title, description: p.description || "", priority: p.priority || "media",
        category: p.category || "geral", deadline: blank(p.deadline) || null, duration: p.duration || 30,
        status: p.status || "pendente", scheduled_date: blank(p.scheduled_date) || null,
        scheduled_time: normTime(p.scheduled_time), created_at: nowIso(),
      };
      d.tasks.push(task);
      log(d, "tarefa_criada", `Você criou a tarefa '${task.title}'.`);
      saveDb(d); return later(task);
    },
    async updateTask(id, p) {
      const d = db(); const task = findById(d.tasks, id);
      if (!task) throw fail(404, "Tarefa não encontrada.");
      Object.keys(p).forEach(k => { task[k] = (k === "scheduled_time") ? normTime(p[k]) : (k === "deadline" || k === "scheduled_date") ? (blank(p[k]) || null) : p[k]; });
      log(d, "tarefa_alterada", `Você alterou a tarefa '${task.title}'.`);
      saveDb(d); return later(task);
    },
    async deleteTask(id) {
      const d = db(); const task = findById(d.tasks, id);
      if (!task) throw fail(404, "Tarefa não encontrada.");
      d.tasks = d.tasks.filter(t => t.id !== task.id);
      log(d, "tarefa_excluida", `Você excluiu a tarefa '${task.title}'.`);
      saveDb(d); return null;
    },

    // ---- Appointments ----
    async listAppointments() {
      return later([...db().appointments].sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time)));
    },
    async createAppointment(p) {
      const d = db();
      if (!p.title || !p.date || !p.start_time || !p.end_time) throw fail(422, "Preencha título, data e horários.");
      const s = normTime(p.start_time), e = normTime(p.end_time);
      if (toMin(s) >= toMin(e)) throw fail(400, "O horário final deve ser depois do horário inicial.");
      const conflicts = checkConflict(d, p.date, toMin(s), toMin(e));
      if (conflicts.length) throw fail(409, "Conflito de horário detectado.", { message: "Conflito de horário detectado.", conflicts });
      const appt = { id: d.seq.appt++, title: p.title, description: p.description || "", date: p.date,
        start_time: s, end_time: e, category: p.category || "geral", created_at: nowIso() };
      d.appointments.push(appt);
      log(d, "compromisso_criado", `Você criou o compromisso '${appt.title}'.`);
      saveDb(d); return later(appt);
    },
    async updateAppointment(id, p) {
      const d = db(); const appt = findById(d.appointments, id);
      if (!appt) throw fail(404, "Compromisso não encontrado.");
      const data = { ...p };
      if (data.start_time) data.start_time = normTime(data.start_time);
      if (data.end_time) data.end_time = normTime(data.end_time);
      const date = data.date || appt.date, s = data.start_time || appt.start_time, e = data.end_time || appt.end_time;
      if (toMin(s) >= toMin(e)) throw fail(400, "O horário final deve ser depois do horário inicial.");
      const conflicts = checkConflict(d, date, toMin(s), toMin(e), appt.id);
      if (conflicts.length) throw fail(409, "Conflito de horário detectado.", { message: "Conflito de horário detectado.", conflicts });
      Object.assign(appt, data);
      log(d, "compromisso_alterado", `Você alterou o compromisso '${appt.title}'.`);
      saveDb(d); return later(appt);
    },
    async deleteAppointment(id) {
      const d = db(); const appt = findById(d.appointments, id);
      if (!appt) throw fail(404, "Compromisso não encontrado.");
      d.appointments = d.appointments.filter(a => a.id !== appt.id);
      log(d, "compromisso_excluido", `Você excluiu o compromisso '${appt.title}'.`);
      saveDb(d); return null;
    },

    // ---- Goals ----
    async listGoals() {
      return later([...db().goals].sort((a, b) => b.id - a.id));
    },
    async createGoal(p) {
      const d = db();
      if (!p.title) throw fail(422, "Título obrigatório.");
      const goal = { id: d.seq.goal++, title: p.title, description: p.description || "", deadline: blank(p.deadline) || null,
        progress: p.progress ?? 0, status: p.status || "ativo", created_at: nowIso() };
      d.goals.push(goal);
      log(d, "objetivo_criado", `Você criou o objetivo '${goal.title}'.`);
      saveDb(d); return later(goal);
    },
    async updateGoal(id, p) {
      const d = db(); const goal = findById(d.goals, id);
      if (!goal) throw fail(404, "Objetivo não encontrado.");
      Object.keys(p).forEach(k => { goal[k] = (k === "deadline") ? (blank(p[k]) || null) : p[k]; });
      log(d, "objetivo_alterado", `Você alterou o objetivo '${goal.title}'.`);
      saveDb(d); return later(goal);
    },
    async deleteGoal(id) {
      const d = db(); const goal = findById(d.goals, id);
      if (!goal) throw fail(404, "Objetivo não encontrado.");
      d.goals = d.goals.filter(g => g.id !== goal.id);
      log(d, "objetivo_excluido", `Você excluiu o objetivo '${goal.title}'.`);
      saveDb(d); return null;
    },

    // ---- AI / Suggestions ----
    async analyze(text) {
      const d = db();
      if (!text || !text.trim()) throw fail(400, "Escreva algo para o assistente analisar.");
      await new Promise(r => setTimeout(r, 600)); // simula o "pensando" da IA
      const result = interpret(text);
      const created = [];
      for (const item of result.suggestions) {
        const [ok] = validateSuggestion(item);
        if (!ok) continue;
        item.conflicts = [];
        if (item.date && item.time) {
          const s = toMin(item.time);
          item.conflicts = checkConflict(d, item.date, s, s + (item.duration_minutes || 30));
        }
        let content = item.title;
        if (item.date) content += ` — ${item.date}`;
        if (item.time) content += ` às ${item.time}`;
        const sugg = { id: d.seq.sugg++, type: item.type, content, structured_data: item, status: "pending", created_at: nowIso(), decided_at: null };
        d.suggestions.push(sugg);
        created.push(sugg);
      }
      if (!created.length) throw fail(422, "Não foi possível identificar uma sugestão válida no texto.");
      saveDb(d);
      return clone({ reasoning_summary: result.reasoning_summary, suggestions: created.map(s => ({ id: s.id, type: s.type, content: s.content, structured_data: s.structured_data, status: s.status })) });
    },
    async listSuggestions() {
      // O formato original devolve structured_data como texto JSON.
      return later([...db().suggestions].sort((a, b) => b.id - a.id).map(s => ({ ...suggOut(s), structured_data: JSON.stringify(s.structured_data) })));
    },
    async editSuggestion(id, structured_data) {
      const d = db(); const s = findById(d.suggestions, id);
      if (!s) throw fail(404, "Sugestão não encontrada.");
      if (s.status !== "pending") throw fail(400, "Apenas sugestões pendentes podem ser editadas.");
      const [ok, reason] = validateSuggestion(structured_data);
      if (!ok) throw fail(400, `Dados inválidos: ${reason}`);
      s.structured_data = structured_data; s.status = "edited";
      log(d, "sugestao_editada", "Você editou uma sugestão da IA.");
      saveDb(d); return later({ ...suggOut(s), structured_data: JSON.stringify(s.structured_data) });
    },
    async approveSuggestion(id) {
      const d = db(); const s = findById(d.suggestions, id);
      if (!s) throw fail(404, "Sugestão não encontrada.");
      if (!["pending", "edited"].includes(s.status)) throw fail(400, "Esta sugestão já foi decidida.");
      const data = s.structured_data;
      const [ok, reason] = validateSuggestion(data);
      if (!ok) throw fail(400, `Não é possível aprovar: ${reason}`);
      const time = data.time ? `${data.time}:00` : null;

      if (s.type === "compromisso" && data.date && time) {
        const dur = data.duration_minutes || 60;
        const end = endFor(time, dur);
        const conflicts = checkConflict(d, data.date, toMin(time), toMin(end));
        if (conflicts.length) throw fail(409, "Conflito de horário detectado. Edite a sugestão.", { message: "Conflito de horário detectado. Edite a sugestão.", conflicts });
        d.appointments.push({ id: d.seq.appt++, title: data.title, description: data.description || "", date: data.date,
          start_time: time, end_time: end, category: data.category || "geral", created_at: nowIso() });
      } else {
        d.tasks.push({ id: d.seq.task++, title: data.title, description: data.description || "", priority: data.priority || "media",
          category: data.category || "geral", deadline: null, duration: data.duration_minutes || 30, status: "pendente",
          scheduled_date: data.date || null, scheduled_time: time, created_at: nowIso() });
      }
      s.status = "approved"; s.decided_at = nowIso();
      log(d, "sugestao_aprovada", `Você aprovou a sugestão '${data.title}'.`);
      saveDb(d); return later({ ...suggOut(s), structured_data: JSON.stringify(s.structured_data) });
    },
    async rejectSuggestion(id) {
      const d = db(); const s = findById(d.suggestions, id);
      if (!s) throw fail(404, "Sugestão não encontrada.");
      if (!["pending", "edited"].includes(s.status)) throw fail(400, "Esta sugestão já foi decidida.");
      s.status = "rejected"; s.decided_at = nowIso();
      log(d, "sugestao_rejeitada", "Você rejeitou uma sugestão da IA.");
      saveDb(d); return later({ ...suggOut(s), structured_data: JSON.stringify(s.structured_data) });
    },

    // ---- History ----
    async listHistory() { return later(db().history.slice(0, 200)); },
  };
})();
