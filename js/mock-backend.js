/* MINDSIDE — backend simulado no navegador (versão só frontend, modo SIC).

   Este arquivo substitui o servidor FastAPI: ele intercepta as chamadas
   fetch("/api/...") feitas pelo js/api.js e responde com os mesmos formatos,
   regras de validação, detecção de conflitos e fluxo Human-in-the-Loop do
   backend original. Os dados ficam no localStorage deste navegador.

   Deve ser carregado ANTES do js/api.js em todas as páginas.
   No primeiro acesso, o Cenário SIC 2026 já entra carregado. */
(function () {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const KEY = "mindside_static_db_v1";

  // ---------------------------------------------------------------- utilitários
  class HttpError extends Error {
    constructor(status, detail) { super(typeof detail === "string" ? detail : "http"); this.status = status; this.detail = detail; }
  }

  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayIso = () => isoDate(new Date());
  const parseDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (iso, n) => { const d = parseDate(iso); d.setDate(d.getDate() + n); return isoDate(d); };
  const weekdayIdx = (iso) => (parseDate(iso).getDay() + 6) % 7; // 0 = segunda
  const nowIso = () => new Date().toISOString();

  // Horários trafegam como "HH:MM:SS" (igual ao backend) e são comparados em minutos.
  function normTime(v) {
    if (v === null || v === undefined || v === "") return null;
    const m = String(v).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m || +m[1] > 23 || +m[2] > 59) throw new HttpError(422, "Horário inválido (use HH:MM).");
    return `${pad(+m[1])}:${m[2]}:${m[3] || "00"}`;
  }
  const normDate = (v) => {
    if (v === null || v === undefined || v === "") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new HttpError(422, "Data inválida (use AAAA-MM-DD).");
    return String(v);
  };
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const hm = (t) => t.slice(0, 5);
  const minToTime = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}:00`;
  // Igual ao backend: a hora final nunca passa de 23.
  const endMinutes = (startMin, duration) => {
    const total = startMin + duration;
    return Math.min(Math.floor(total / 60), 23) * 60 + (total % 60);
  };
  const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // ------------------------------------------------------------------ armazenamento
  let memoryStore = null;
  function loadRaw() {
    try { const r = root.localStorage.getItem(KEY); return r ? JSON.parse(r) : memoryStore; }
    catch (_) { return memoryStore; }
  }
  function saveRaw(db) {
    memoryStore = db;
    try { root.localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) { /* sem storage: mantém só em memória */ }
  }

  const DEFAULT_CATEGORIES = [
    { name: "Estudo", slug: "estudo", tipo_categoria: "Estudo", color: "#4fb2ff", description: "Provas, aulas, leituras e trabalhos acadêmicos" },
    { name: "Trabalho", slug: "trabalho", tipo_categoria: "Trabalho", color: "#f0c93a", description: "Reuniões, projetos e entregas profissionais" },
    { name: "Saúde & Treino", slug: "saude", tipo_categoria: "Saude", color: "#2be6a0", description: "Academia, corrida, consultas e bem-estar" },
    { name: "Lazer", slug: "lazer", tipo_categoria: "Lazer", color: "#ff9a4c", description: "Descanso, cultura, amigos e hobbies" },
    { name: "Pessoal", slug: "pessoal", tipo_categoria: "Pessoal", color: "#b07bff", description: "Organização doméstica e compromissos pessoais" },
    { name: "Geral", slug: "geral", tipo_categoria: "Outros", color: "#7c8ea0", description: "Atividades gerais da rotina" },
  ];

  const nextId = (db, k) => (db.seq[k] = (db.seq[k] || 0) + 1);

  function emptyDb() {
    return {
      seq: {},
      user: { id: 1, name: "Visitante", email: "visitante@demo.mindside", created_at: nowIso() },
      categories: [], slots: [], goals: [], tasks: [], appts: [],
      analyses: [], sugg: [], valid: [], dec: [], hist: [],
      seededOn: null, dirty: false, cleared: false,
    };
  }

  function ensureCategories(db) {
    if (db.categories.length) return;
    DEFAULT_CATEGORIES.forEach((c) => db.categories.push({ id: nextId(db, "cat"), ...c }));
  }

  function addHistory(db, action, description) {
    db.hist.push({ id: nextId(db, "hist"), action, description, created_at: nowIso() });
  }

  // ---------------------------------------------------------- Cenário SIC 2026
  function wipeSessionData(db) {
    db.dec = []; db.valid = []; db.sugg = []; db.analyses = [];
    db.tasks = []; db.appts = []; db.goals = []; db.slots = [];
  }

  function seedSic(db) {
    ensureCategories(db);
    wipeSessionData(db);
    const today = todayIso();
    const tomorrow = addDays(today, 1);
    const inTwo = addDays(today, 2);

    // 1. Horários disponíveis
    [["Segunda", "14:00", "18:00"], ["Quarta", "14:00", "18:00"], ["Sexta", "14:00", "20:00"]].forEach(([day, s, e]) =>
      db.slots.push({ id: nextId(db, "slot"), day_of_week: day, start_time: `${s}:00`, end_time: `${e}:00`, status: "Ativo" }));

    // 2. Objetivos
    const g1 = {
      id: nextId(db, "goal"), title: "Apresentação Final — Samsung Innovation Campus 2026",
      description: "Entregar MVP funcional do MindSide com validação Python, persistência SQL e controle humano.",
      start_date: addDays(today, -10), deadline: addDays(today, 30), progress: 50, status: "ativo",
    };
    const g2 = {
      id: nextId(db, "goal"), title: "Equilíbrio de Rotina Acadêmica e Saúde",
      description: "Conciliar estudos de programação e matemática com 3 sessões semanais de atividade física.",
      start_date: addDays(today, -5), deadline: addDays(today, 45), progress: 33, status: "ativo",
    };
    db.goals.push(g1, g2);

    // 3. Compromissos
    const mkAppt = (title, description, date, s, e, category) => {
      const a = { id: nextId(db, "appt"), title, description, date, start_time: `${s}:00`, end_time: `${e}:00`, category, category_id: null, status: "Agendada" };
      db.appts.push(a);
      return a;
    };
    mkAppt("Mentoria Técnica SENAI Anchieta — SIC", "Revisão da arquitetura Python + IA e validação de requisitos", today, "15:00", "16:30", "estudo");
    const aula = mkAppt("Aula de Cálculo e Álgebra", "Preparação para avaliação semanal", tomorrow, "18:00", "19:30", "estudo");
    mkAppt("Reunião de Alinhamento do Grupo MindSide", "Divisão do pitch e ensaio da demonstração ao vivo", inTwo, "14:00", "15:30", "trabalho");

    // 4. Tarefas vinculadas aos objetivos
    const mkTask = (o) => {
      const t = {
        id: nextId(db, "task"), description: "", priority: "media", category: "geral", category_id: null, goal_id: null,
        deadline: null, duration: 30, status: "pendente", scheduled_date: null, scheduled_time: null,
        completed_at: null, created_at: nowIso(), ...o,
      };
      db.tasks.push(t);
      return t;
    };
    mkTask({ goal_id: g1.id, title: "Validar suíte de testes automatizados (pytest)", description: "Garantir 100% dos testes passando antes da banca", priority: "urgente", category: "trabalho", deadline: today, duration: 45, status: "concluida", scheduled_date: today, scheduled_time: "10:00:00", completed_at: nowIso() });
    mkTask({ goal_id: g1.id, title: "Ensaiar demonstração de 4 minutos para a banca SIC", description: "Demonstrar criação de sugestão pela IA, conflito e aprovação humana", priority: "alta", category: "estudo", deadline: tomorrow, duration: 45, status: "em_andamento", scheduled_date: today, scheduled_time: "17:00:00" });
    mkTask({ goal_id: g2.id, title: "Treino funcional e corrida leve (40 min)", description: "Pausa ativa para reduzir sobrecarga cognitiva", priority: "media", category: "saude", deadline: tomorrow, duration: 40, status: "pendente", scheduled_date: tomorrow, scheduled_time: "16:30:00" });
    mkTask({ goal_id: g2.id, title: "Resolver lista de exercícios de programação em Python", description: "Estruturas de dados e validação com Pydantic", priority: "alta", category: "estudo", deadline: inTwo, duration: 60, status: "pendente" });

    // 5. Análise de IA + 2 sugestões pendentes (uma livre e uma com conflito)
    const analysis = {
      id: nextId(db, "analysis"), analysis_type: "Organizacao",
      request_text: "Tenho revisão da prova amanhã às 18h30 e preciso separar 45 min para revisar os slides do SIC",
      provider_used: "mindside_context_engine",
      reasoning_summary: "Identificados 1 compromisso (com alerta de sobreposição às 18:30 de amanhã) e 1 tarefa de alta prioridade.",
      processing_status: "Finalizado", started_at: nowIso(), completed_at: nowIso(),
    };
    db.analyses.push(analysis);

    const s1Data = {
      type: "tarefa", title: "Revisar slides e métricas da apresentação SIC",
      description: "Revisar slides e métricas da apresentação SIC", priority: "alta",
      date: tomorrow, time: "14:30", duration_minutes: 45, category: "estudo",
      conflicts: [], within_availability: true,
    };
    const s2Data = {
      type: "compromisso", title: "Grupo de estudo — Revisão de Cálculo",
      description: "Conflito intencional de demonstração com Aula de Cálculo e Álgebra", priority: "alta",
      date: tomorrow, time: "18:30", duration_minutes: 60, category: "estudo",
      conflicts: [{ type: "appointment", id: aula.id, title: "Aula de Cálculo e Álgebra", start_time: "18:00", end_time: "19:30" }],
      within_availability: true,
    };
    const mkSugg = (data) => {
      const s = {
        id: nextId(db, "sugg"), analysis_id: analysis.id, type: data.type, action_type: "Criar",
        content: `${data.title} — ${data.date} às ${data.time}`,
        structured_data: JSON.stringify(data), status: "pending", created_at: nowIso(), decided_at: null,
      };
      db.sugg.push(s);
      return s;
    };
    const s1 = mkSugg(s1Data);
    const s2 = mkSugg(s2Data);

    const mkValid = (sugg, conflito, message) => db.valid.push({
      id: nextId(db, "valid"), suggestion_id: sugg.id, is_valid: true, formato_valido: true, campos_validos: true,
      possui_conflito: conflito, dentro_disponibilidade: true, message, validated_at: nowIso(),
    });
    mkValid(s1, false, "Validado pelo Python: formato JSON íntegro e horário livre na agenda.");
    mkValid(s2, true, "Alerta do Python: conflito detectado com 'Aula de Cálculo e Álgebra' (18:00–19:30). Solicite novo horário ou edite antes de aprovar.");

    addHistory(db, "cenario_demo_carregado", "Cenário de demonstração do Samsung Innovation Campus 2026 carregado com sucesso.");

    db.seededOn = today; db.dirty = false; db.cleared = false;
    return { status: "ok", tasks_created: 4, appointments_created: 3, goals_created: 2, suggestions_created: 2, available_slots_created: 3 };
  }

  // Abre o banco; no primeiro acesso (ou quando o cenário não foi mexido e o dia mudou)
  // o Cenário SIC é carregado automaticamente, com datas relativas a hoje.
  function openDb() {
    let db = loadRaw();
    if (!db || !db.seq) {
      db = emptyDb();
      seedSic(db);
      saveRaw(db);
    } else if (!db.dirty && !db.cleared && db.seededOn !== todayIso()) {
      seedSic(db);
      saveRaw(db);
    }
    return db;
  }

  // ------------------------------------------------------- serviços (portados do Python)
  const VALID_PRIORITIES = ["baixa", "media", "alta", "urgente"];
  const VALID_TYPES = ["tarefa", "compromisso"];
  const VALID_CATEGORIES = ["estudo", "trabalho", "saude", "lazer", "pessoal", "geral"];

  function validateSuggestion(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return [false, "Formato de dados inválido."];
    if (!VALID_TYPES.includes(data.type)) return [false, `Tipo '${data.type}' inválido. Esperado: ${VALID_TYPES.join(", ")}.`];
    if (!data.title || typeof data.title !== "string") return [false, "Título ausente ou inválido."];
    if (data.date) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.date);
      const d = m && new Date(+m[1], +m[2] - 1, +m[3]);
      if (!m || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return [false, "Data em formato inválido (esperado AAAA-MM-DD)."];
    }
    if (data.time && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(data.time)) return [false, "Horário em formato inválido (esperado HH:MM)."];
    const dur = data.duration_minutes;
    if (dur !== null && dur !== undefined) {
      if (!Number.isInteger(dur) || dur <= 0 || dur > 24 * 60) return [false, "Duração inválida."];
    }
    if (data.priority && !VALID_PRIORITIES.includes(data.priority)) return [false, `Prioridade '${data.priority}' inválida.`];
    if (data.category && !VALID_CATEGORIES.includes(data.category)) data.category = "geral";
    return [true, "ok"];
  }

  // Conflitos entre um intervalo e compromissos + tarefas agendadas no mesmo dia.
  function findConflicts(db, day, startMin, endMin, ignoreApptId, ignoreTaskId) {
    const out = [];
    db.appts.forEach((a) => {
      if (a.date !== day || a.id === ignoreApptId) return;
      if (overlaps(startMin, endMin, toMin(a.start_time), toMin(a.end_time))) {
        out.push({ type: "appointment", id: a.id, title: a.title, start_time: hm(a.start_time), end_time: hm(a.end_time) });
      }
    });
    db.tasks.forEach((t) => {
      if (t.scheduled_date !== day || !t.scheduled_time || t.id === ignoreTaskId) return;
      const tS = toMin(t.scheduled_time);
      const tE = endMinutes(tS, t.duration || 30);
      if (overlaps(startMin, endMin, tS, tE)) {
        out.push({ type: "task", id: t.id, title: t.title, start_time: hm(t.scheduled_time), end_time: minToTime(tE).slice(0, 5) });
      }
    });
    return out;
  }
  const taskConflicts = (db, day, timeStr, duration, ignoreTaskId) => {
    const s = toMin(timeStr);
    return findConflicts(db, day, s, endMinutes(s, duration), null, ignoreTaskId);
  };

  const WEEKDAY_NAMES_PT = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"];
  function withinAvailability(db, day, startMin, endMin) {
    const name = WEEKDAY_NAMES_PT[weekdayIdx(day)];
    const slots = db.slots.filter((s) => s.day_of_week === name && s.status === "Ativo");
    if (!slots.length) return true;
    return slots.some((s) => toMin(s.start_time) <= startMin && endMin <= toMin(s.end_time));
  }

  function findNextFreeSlot(db, startDate, duration) {
    const hours = [9, 10, 14, 15, 16, 18, 19, 20];
    for (let off = 0; off < 7; off++) {
      const day = addDays(startDate, off);
      for (const h of hours) {
        const s = h * 60;
        if (!findConflicts(db, day, s, endMinutes(s, duration)).length) return [day, s];
      }
    }
    return [addDays(startDate, 1), 14 * 60];
  }

  function recalcGoalProgress(db, goalId) {
    if (!goalId) return;
    const goal = db.goals.find((g) => g.id === goalId);
    if (!goal) return;
    const linked = db.tasks.filter((t) => t.goal_id === goalId);
    if (!linked.length) return;
    const done = linked.filter((t) => t.status === "concluida").length;
    goal.progress = Math.round((done / linked.length) * 100);
    if (goal.progress === 100) goal.status = "concluido";
    else if (goal.status === "concluido" && goal.progress < 100) goal.status = "ativo";
  }

  // ---------- interpretador local de linguagem natural (_rule_based_interpret)
  const NW = "[\\p{L}\\p{N}_]"; // "caractere de palavra" com suporte a acentos
  const WEEKDAYS = {
    "segunda": 0, "segunda-feira": 0, "terca": 1, "terça": 1, "terca-feira": 1, "terça-feira": 1,
    "quarta": 2, "quarta-feira": 2, "quinta": 3, "quinta-feira": 3, "sexta": 4, "sexta-feira": 4,
    "sabado": 5, "sábado": 5, "domingo": 6,
  };
  const WEEKDAYS_SORTED = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length);
  const PRIORITY_KEYWORDS = [["urgente", "urgente"], ["urgência", "urgente"], ["muito importante", "alta"], ["importante", "alta"], ["prova", "alta"], ["prazo", "alta"], ["entrega", "alta"]];
  const CATEGORY_KEYWORDS = [
    ["prova", "estudo"], ["estudar", "estudo"], ["matéria", "estudo"], ["trabalho de", "estudo"], ["faculdade", "estudo"], ["aula", "estudo"], ["programação", "estudo"], ["matemática", "estudo"],
    ["reunião", "trabalho"], ["projeto", "trabalho"], ["trabalho", "trabalho"],
    ["treino", "saude"], ["academia", "saude"], ["corrida", "saude"], ["médico", "saude"],
    ["cinema", "lazer"], ["festa", "lazer"], ["passeio", "lazer"],
  ];

  const SPLIT_RE = new RegExp(
    "(?:[.;\\n]+|,\\s*(?=(?:preciso|quero|tenho|devo|vou|também|e\\s+também|além\\s+disso))|\\s+e\\s+(?=(?:também\\s+)?(?:preciso|quero|tenho|devo|vou|organizar|estudar|terminar|fazer|ir)))", "iu");
  const LEAD_RE = /^(?:e\s+)?(?:também\s+)?/iu;
  const strip = (s) => s.replace(/^[ ,.\-]+|[ ,.\-]+$/g, "");

  function splitClauses(text) {
    const cleaned = [];
    text.trim().split(SPLIT_RE).forEach((part) => {
      const p = strip(part.trim().replace(LEAD_RE, "").trim());
      if (p.length >= 4) cleaned.push(p);
    });
    return cleaned.length ? cleaned.slice(0, 5) : [text.trim()];
  }

  const TITLE_LEAD_RE = /^(?:eu\s+)?(?:tenho\s+que\s+|tenho\s+uma?\s+|tenho\s+|preciso\s+|quero\s+|vou\s+|devo\s+)/iu;
  const TITLE_DAY_RE = new RegExp("\\s+(?:na|no|nesta|neste)?\\s*(?:segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[aá]bado|domingo|amanh[aã]|hoje)(?!" + NW + ").*$", "iu");
  const TITLE_TIME_RE = /\s+(?:às|as)\s+\d{1,2}(?:[:h]\d{2}|h)?.*$/iu;

  function cleanClauseTitle(clause) {
    let title = clause.trim().replace(TITLE_LEAD_RE, "");
    title = title.replace(TITLE_DAY_RE, "");
    title = title.replace(TITLE_TIME_RE, "");
    title = strip(title);
    if (title.length < 3) title = clause.trim().slice(0, 120);
    return (title.charAt(0).toUpperCase() + title.slice(1)).slice(0, 120);
  }

  const TIME_RE = new RegExp("(?:às|as|(?<!" + NW + "))(\\d{1,2})\\s*(?:[:h]\\s*(\\d{2})|h(?!" + NW + "))", "u");

  function nextWeekday(baseIso, idx) {
    let ahead = (((idx - weekdayIdx(baseIso)) % 7) + 7) % 7;
    if (ahead === 0) ahead = 7;
    return addDays(baseIso, ahead);
  }

  function interpretClause(clause, today) {
    const lowered = clause.toLowerCase();
    let foundDate = null;
    for (const w of WEEKDAYS_SORTED) {
      if (lowered.includes(w)) { foundDate = nextWeekday(today, WEEKDAYS[w]); break; }
    }
    if (lowered.includes("amanhã") || lowered.includes("amanha")) foundDate = addDays(today, 1);
    if (lowered.includes("hoje")) foundDate = today;

    let foundTime = null;
    const m = TIME_RE.exec(lowered);
    if (m) {
      const hour = +m[1];
      const minute = m[2] ? +m[2] : 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) foundTime = `${pad(hour)}:${pad(minute)}`;
    }

    let priority = "media";
    for (const [kw, p] of PRIORITY_KEYWORDS) if (lowered.includes(kw)) { priority = p; break; }
    let category = "geral";
    for (const [kw, c] of CATEGORY_KEYWORDS) if (lowered.includes(kw)) { category = c; break; }

    const tipo = ((foundDate && foundTime) || lowered.includes("prova") || lowered.includes("reunião") || lowered.includes("consulta")) ? "compromisso" : "tarefa";
    return {
      type: tipo, title: cleanClauseTitle(clause), description: clause.trim(), priority,
      date: foundDate, time: foundTime,
      duration_minutes: tipo === "compromisso" ? 60 : category === "estudo" ? 45 : 30,
      category,
    };
  }

  function ruleBasedInterpret(text) {
    const today = todayIso();
    const suggestions = splitClauses(text).map((c) => interpretClause(c, today));
    const label = suggestions.length > 1 ? `${suggestions.length} itens identificados` : "1 item identificado";
    return {
      suggestions, conflicts: [], provider: "local_fallback",
      reasoning_summary: `Análise contextual concluída (${label}): extraídos compromissos, tarefas, datas, horários, prioridades e categorias para sua revisão.`,
    };
  }

  // ---------------------------------------------------------------- saídas (schemas)
  const pick = (o, keys) => { const r = {}; keys.forEach((k) => { r[k] = o[k] === undefined ? null : o[k]; }); return r; };
  const outTask = (t) => pick(t, ["id", "title", "description", "priority", "category", "category_id", "goal_id", "deadline", "duration", "status", "scheduled_date", "scheduled_time"]);
  const outAppt = (a) => pick(a, ["id", "title", "description", "date", "start_time", "end_time", "category", "category_id", "status"]);
  const outGoal = (g) => pick(g, ["id", "title", "description", "start_date", "deadline", "progress", "status"]);
  const outSugg = (s) => pick(s, ["id", "analysis_id", "type", "action_type", "content", "structured_data", "status", "created_at", "decided_at"]);
  const outValid = (v) => pick(v, ["id", "suggestion_id", "is_valid", "formato_valido", "campos_validos", "possui_conflito", "dentro_disponibilidade", "message", "validated_at"]);
  const outDec = (d) => pick(d, ["id", "suggestion_id", "decision_type", "note", "created_at"]);
  const outCat = (c) => pick(c, ["id", "name", "slug", "description", "tipo_categoria", "color"]);
  const outSlot = (s) => pick(s, ["id", "day_of_week", "start_time", "end_time", "status"]);
  const outUser = (u) => pick(u, ["id", "name", "email", "created_at"]);

  const need = (v, msg) => { if (v === null || v === undefined || String(v).trim() === "") throw new HttpError(422, msg); };
  const find = (list, id, msg) => {
    const item = list.find((x) => x.id === Number(id));
    if (!item) throw new HttpError(404, msg);
    return item;
  };

  // --------------------------------------------------------------------- rotas
  const routes = [];
  function route(method, pattern, fn, mutates) {
    routes.push({ method, re: new RegExp("^" + pattern + "/?$"), fn, mutates: mutates !== false });
  }
  const ok = (data, status = 200) => ({ status, data });

  // ---- Auth (sem servidor: o perfil é local e nenhuma senha é guardada)
  const tokenPayload = (db) => ({ access_token: "demo-local-token", token_type: "bearer", user: outUser(db.user) });
  // "Nova sessão": como no backend original (um visitante novo a cada chamada), só que aqui
  // a sessão nova já volta com o Cenário SIC limpo. No primeiro acesso nada é recriado.
  route("POST", "/api/auth/guest", ({ db }) => {
    if (db.dirty || db.cleared) {
      const fresh = emptyDb();
      seedSic(fresh);
      Object.keys(db).forEach((k) => { delete db[k]; });
      Object.assign(db, fresh);
    }
    return ok(tokenPayload(db));
  }, false);
  route("POST", "/api/auth/register", ({ db, body }) => {
    need(body.name, "Informe seu nome."); need(body.email, "Informe seu e-mail.");
    if (body.password !== body.password_confirm) throw new HttpError(400, "As senhas não coincidem.");
    if (String(body.password || "").length < 6) throw new HttpError(400, "A senha deve ter ao menos 6 caracteres.");
    db.user.name = String(body.name).trim(); db.user.email = String(body.email).trim();
    addHistory(db, "conta_criada", "Conta criada no MINDSIDE.");
    return ok(tokenPayload(db), 201);
  }, false);
  route("POST", "/api/auth/login", ({ db, body }) => {
    need(body.email, "Informe seu e-mail."); need(body.password, "Informe sua senha.");
    if (db.user.name === "Visitante") db.user.name = String(body.email).split("@")[0] || "Visitante";
    db.user.email = String(body.email).trim();
    return ok(tokenPayload(db));
  }, false);
  route("GET", "/api/auth/me", ({ db }) => ok(outUser(db.user)), false);
  route("PUT", "/api/auth/me", ({ db, body }) => {
    if (body.name && String(body.name).trim()) {
      db.user.name = String(body.name).trim().slice(0, 120);
      addHistory(db, "perfil_atualizado", `Nome do perfil atualizado para '${db.user.name}'.`);
    }
    return ok(outUser(db.user));
  }, false);

  // ---- Categorias e disponibilidade
  route("GET", "/api/categories", ({ db }) => { ensureCategories(db); return ok(db.categories.map(outCat)); }, false);
  route("POST", "/api/categories", ({ db, body }) => {
    need(body.name, "Informe o nome da categoria.");
    ensureCategories(db);
    const name = String(body.name).trim().slice(0, 50);
    const slug = (body.slug || name.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "personalizada").slice(0, 50);
    const cat = { id: nextId(db, "cat"), name, slug, description: body.description || "", tipo_categoria: body.tipo_categoria || "Outros", color: body.color || "#2be6a0" };
    db.categories.push(cat);
    addHistory(db, "categoria_criada", `Categoria '${cat.name}' criada.`);
    return ok(outCat(cat), 201);
  });
  route("DELETE", "/api/categories/(\\d+)", ({ db, params }) => {
    const cat = find(db.categories, params[0], "Categoria não encontrada.");
    db.categories = db.categories.filter((c) => c !== cat);
    return ok(null, 204);
  });

  route("GET", "/api/availability", ({ db }) => ok(db.slots.map(outSlot)), false);
  route("POST", "/api/availability", ({ db, body }) => {
    const raw = String(body.day_of_week || "").replace(/ç/g, "c").replace(/á/g, "a");
    const day = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    if (!WEEKDAY_NAMES_PT.includes(day)) throw new HttpError(400, `Dia da semana inválido (${body.day_of_week}). Use: ${[...WEEKDAY_NAMES_PT].sort().join(", ")}`);
    const start = normTime(body.start_time), end = normTime(body.end_time);
    need(start, "Informe o horário inicial."); need(end, "Informe o horário final.");
    if (start >= end) throw new HttpError(400, "O horário final deve ser posterior ao horário inicial.");
    const slot = { id: nextId(db, "slot"), day_of_week: day, start_time: start, end_time: end, status: body.status || "Ativo" };
    db.slots.push(slot);
    addHistory(db, "disponibilidade_cadastrada", `Horário disponível cadastrado: ${day} (${hm(start)}–${hm(end)}).`);
    return ok(outSlot(slot), 201);
  });
  route("DELETE", "/api/availability/(\\d+)", ({ db, params }) => {
    const slot = find(db.slots, params[0], "Horário disponível não encontrado.");
    db.slots = db.slots.filter((s) => s !== slot);
    return ok(null, 204);
  });

  // ---- Tarefas
  route("GET", "/api/tasks", ({ db }) => ok([...db.tasks].sort((a, b) => b.id - a.id).map(outTask)), false);
  route("GET", "/api/tasks/(\\d+)", ({ db, params }) => ok(outTask(find(db.tasks, params[0], "Tarefa não encontrada."))), false);
  route("POST", "/api/tasks", ({ db, body }) => {
    need(body.title, "Informe o título da tarefa.");
    const t = {
      id: 0, title: String(body.title).trim().slice(0, 200), description: body.description ?? "", priority: body.priority || "media",
      category: body.category || "geral", category_id: body.category_id ?? null, goal_id: body.goal_id ?? null,
      deadline: normDate(body.deadline), duration: body.duration || 30, status: body.status || "pendente",
      scheduled_date: normDate(body.scheduled_date), scheduled_time: normTime(body.scheduled_time),
      completed_at: null, created_at: nowIso(),
    };
    if (t.scheduled_date && t.scheduled_time) {
      const conflicts = taskConflicts(db, t.scheduled_date, t.scheduled_time, t.duration);
      if (conflicts.length) throw new HttpError(409, { message: "Conflito de horário detectado.", conflicts });
    }
    if (t.goal_id) find(db.goals, t.goal_id, "Objetivo vinculado não encontrado.");
    t.id = nextId(db, "task");
    if (t.status === "concluida") t.completed_at = nowIso();
    db.tasks.push(t);
    recalcGoalProgress(db, t.goal_id);
    addHistory(db, "tarefa_criada", `Você criou a tarefa '${t.title}'.`);
    return ok(outTask(t), 201);
  });
  route("PUT", "/api/tasks/(\\d+)", ({ db, params, body }) => {
    const task = find(db.tasks, params[0], "Tarefa não encontrada.");
    const previousGoal = task.goal_id;
    const data = {};
    ["title", "description", "priority", "category", "category_id", "goal_id", "duration", "status"].forEach((k) => { if (has(body, k)) data[k] = body[k]; });
    if (has(body, "deadline")) data.deadline = normDate(body.deadline);
    if (has(body, "scheduled_date")) data.scheduled_date = normDate(body.scheduled_date);
    if (has(body, "scheduled_time")) data.scheduled_time = normTime(body.scheduled_time);
    const sDate = has(data, "scheduled_date") ? data.scheduled_date : task.scheduled_date;
    const sTime = has(data, "scheduled_time") ? data.scheduled_time : task.scheduled_time;
    const duration = (has(data, "duration") ? data.duration : task.duration) || 30;
    if (sDate && sTime) {
      const conflicts = taskConflicts(db, sDate, sTime, duration, task.id);
      if (conflicts.length) throw new HttpError(409, { message: "Conflito de horário detectado.", conflicts });
    }
    if (data.goal_id !== undefined && data.goal_id !== null) find(db.goals, data.goal_id, "Objetivo vinculado não encontrado.");
    Object.assign(task, data);
    if (task.status === "concluida" && !task.completed_at) task.completed_at = nowIso();
    else if (task.status !== "concluida") task.completed_at = null;
    if (previousGoal && previousGoal !== task.goal_id) recalcGoalProgress(db, previousGoal);
    recalcGoalProgress(db, task.goal_id);
    addHistory(db, "tarefa_alterada", `Você alterou a tarefa '${task.title}'.`);
    return ok(outTask(task));
  });
  route("DELETE", "/api/tasks/(\\d+)", ({ db, params }) => {
    const task = find(db.tasks, params[0], "Tarefa não encontrada.");
    db.tasks = db.tasks.filter((t) => t !== task);
    addHistory(db, "tarefa_excluida", `Você excluiu a tarefa '${task.title}'.`);
    recalcGoalProgress(db, task.goal_id);
    return ok(null, 204);
  });

  // ---- Compromissos
  route("GET", "/api/appointments", ({ db }) => ok([...db.appts].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map(outAppt)), false);
  route("POST", "/api/appointments", ({ db, body }) => {
    need(body.title, "Informe o título do compromisso.");
    const date = normDate(body.date), start = normTime(body.start_time), end = normTime(body.end_time);
    need(date, "Informe a data."); need(start, "Informe o horário inicial."); need(end, "Informe o horário final.");
    if (start >= end) throw new HttpError(400, "O horário final deve ser depois do horário inicial.");
    const conflicts = findConflicts(db, date, toMin(start), toMin(end));
    if (conflicts.length) throw new HttpError(409, { message: "Conflito de horário detectado.", conflicts });
    const a = {
      id: nextId(db, "appt"), title: String(body.title).trim().slice(0, 200), description: body.description ?? "", date,
      start_time: start, end_time: end, category: body.category || "geral", category_id: body.category_id ?? null, status: body.status || "Agendada",
    };
    db.appts.push(a);
    addHistory(db, "compromisso_criado", `Você criou o compromisso '${a.title}'.`);
    return ok(outAppt(a), 201);
  });
  route("PUT", "/api/appointments/(\\d+)", ({ db, params, body }) => {
    const appt = find(db.appts, params[0], "Compromisso não encontrado.");
    const data = {};
    ["title", "description", "category", "category_id", "status"].forEach((k) => { if (has(body, k)) data[k] = body[k]; });
    if (has(body, "date")) data.date = normDate(body.date);
    if (has(body, "start_time")) data.start_time = normTime(body.start_time);
    if (has(body, "end_time")) data.end_time = normTime(body.end_time);
    const date = data.date || appt.date, start = data.start_time || appt.start_time, end = data.end_time || appt.end_time;
    if (start >= end) throw new HttpError(400, "O horário final deve ser depois do horário inicial.");
    const conflicts = findConflicts(db, date, toMin(start), toMin(end), appt.id);
    if (conflicts.length) throw new HttpError(409, { message: "Conflito de horário detectado.", conflicts });
    Object.keys(data).forEach((k) => { if (data[k] !== null || k === "category_id") appt[k] = data[k]; });
    addHistory(db, "compromisso_alterado", `Você alterou o compromisso '${appt.title}'.`);
    return ok(outAppt(appt));
  });
  route("DELETE", "/api/appointments/(\\d+)", ({ db, params }) => {
    const appt = find(db.appts, params[0], "Compromisso não encontrado.");
    db.appts = db.appts.filter((a) => a !== appt);
    addHistory(db, "compromisso_excluido", `Você excluiu o compromisso '${appt.title}'.`);
    return ok(null, 204);
  });

  // ---- Objetivos
  route("GET", "/api/goals", ({ db }) => ok([...db.goals].sort((a, b) => b.id - a.id).map(outGoal)), false);
  route("POST", "/api/goals", ({ db, body }) => {
    need(body.title, "Informe o título do objetivo.");
    const progress = body.progress === undefined || body.progress === null ? 0 : Number(body.progress);
    if (!(progress >= 0 && progress <= 100)) throw new HttpError(422, "O progresso deve ficar entre 0 e 100.");
    const g = {
      id: nextId(db, "goal"), title: String(body.title).trim().slice(0, 200), description: body.description ?? "",
      start_date: normDate(body.start_date), deadline: normDate(body.deadline), progress, status: body.status || "ativo",
    };
    db.goals.push(g);
    addHistory(db, "objetivo_criado", `Você criou o objetivo '${g.title}'.`);
    return ok(outGoal(g), 201);
  });
  route("PUT", "/api/goals/(\\d+)", ({ db, params, body }) => {
    const goal = find(db.goals, params[0], "Objetivo não encontrado.");
    ["title", "description", "status"].forEach((k) => { if (has(body, k)) goal[k] = body[k]; });
    if (has(body, "start_date")) goal.start_date = normDate(body.start_date);
    if (has(body, "deadline")) goal.deadline = normDate(body.deadline);
    if (has(body, "progress") && body.progress !== null) {
      const p = Number(body.progress);
      if (!(p >= 0 && p <= 100)) throw new HttpError(422, "O progresso deve ficar entre 0 e 100.");
      goal.progress = p;
    }
    addHistory(db, "objetivo_alterado", `Você alterou o objetivo '${goal.title}'.`);
    return ok(outGoal(goal));
  });
  route("DELETE", "/api/goals/(\\d+)", ({ db, params }) => {
    const goal = find(db.goals, params[0], "Objetivo não encontrado.");
    db.goals = db.goals.filter((g) => g !== goal);
    db.tasks.forEach((t) => { if (t.goal_id === goal.id) t.goal_id = null; }); // ON DELETE SET NULL
    addHistory(db, "objetivo_excluido", `Você excluiu o objetivo '${goal.title}'.`);
    return ok(null, 204);
  });

  // ---- Assistente (IA local + validação + sugestões pendentes)
  route("POST", "/api/ai/analyze", ({ db, body }) => {
    const text = String(body.text || "").trim();
    if (!text) throw new HttpError(400, "Escreva algo para o assistente analisar.");
    if (text.length > 5000) throw new HttpError(422, "O texto pode ter no máximo 5000 caracteres.");
    const ai = ruleBasedInterpret(text);
    if (!ai.suggestions.length) throw new HttpError(422, "Não foi possível identificar uma sugestão válida no texto.");

    const analysis = {
      id: nextId(db, "analysis"), analysis_type: ai.suggestions.length > 1 ? "Organizacao" : "Planejamento",
      request_text: text.slice(0, 500), provider_used: ai.provider, reasoning_summary: ai.reasoning_summary.slice(0, 1000),
      processing_status: "Finalizado", started_at: nowIso(), completed_at: nowIso(),
    };
    db.analyses.push(analysis);

    const created = [];
    ai.suggestions.forEach((item) => {
      const [valid] = validateSuggestion(item);
      if (!valid) return; // nunca confia cegamente na IA
      let conflicts = [], within = true;
      if (item.date && item.time) {
        const s = toMin(item.time);
        const e = endMinutes(s, item.duration_minutes || 30);
        conflicts = findConflicts(db, item.date, s, e);
        within = withinAvailability(db, item.date, s, e);
      }
      item.conflicts = conflicts; item.within_availability = within;
      let content = item.title;
      if (item.date) content += ` — ${item.date}`;
      if (item.time) content += ` às ${item.time}`;
      const sugg = {
        id: nextId(db, "sugg"), analysis_id: analysis.id, type: item.type, action_type: "Criar", content,
        structured_data: JSON.stringify(item), status: "pending", created_at: nowIso(), decided_at: null,
      };
      db.sugg.push(sugg);
      const val = {
        id: nextId(db, "valid"), suggestion_id: sugg.id, is_valid: true, formato_valido: true, campos_validos: true,
        possui_conflito: conflicts.length > 0, dentro_disponibilidade: within,
        message: conflicts.length ? `Conflito detectado com ${conflicts.length} atividade(s) na agenda.` : "Estrutura JSON, campos obrigatórios e agenda verificados pelo Python sem conflitos.",
        validated_at: nowIso(),
      };
      db.valid.push(val);
      created.push([sugg, val]);
    });
    if (!created.length) throw new HttpError(422, "A IA não retornou nenhuma sugestão válida após a validação.");

    return ok({
      analysis_id: analysis.id, provider: analysis.provider_used, reasoning_summary: ai.reasoning_summary,
      suggestions: created.map(([s, v]) => ({
        id: s.id, analysis_id: s.analysis_id, type: s.type, content: s.content, structured_data: JSON.parse(s.structured_data), status: s.status,
        validation: pick(v, ["id", "is_valid", "formato_valido", "campos_validos", "possui_conflito", "dentro_disponibilidade", "message"]),
      })),
    });
  });

  route("GET", "/api/suggestions", ({ db }) => ok([...db.sugg].sort((a, b) => b.id - a.id).map(outSugg)), false);
  route("GET", "/api/suggestions/(\\d+)/decisions", ({ db, params }) => {
    const s = find(db.sugg, params[0], "Sugestão não encontrada.");
    return ok(db.dec.filter((d) => d.suggestion_id === s.id).sort((a, b) => a.id - b.id).map(outDec));
  }, false);
  route("GET", "/api/suggestions/(\\d+)/validations", ({ db, params }) => {
    const s = find(db.sugg, params[0], "Sugestão não encontrada.");
    return ok(db.valid.filter((v) => v.suggestion_id === s.id).sort((a, b) => b.id - a.id).map(outValid));
  }, false);

  const pending = (s) => { if (s.status !== "pending" && s.status !== "edited") throw new HttpError(400, "Esta sugestão já foi decidida."); };
  const addDecision = (db, sugg, type, note) => db.dec.push({ id: nextId(db, "dec"), suggestion_id: sugg.id, decision_type: type, note: String(note).slice(0, 255), created_at: nowIso() });
  const addValidation = (db, sugg, conflito, message) => db.valid.push({
    id: nextId(db, "valid"), suggestion_id: sugg.id, is_valid: true, formato_valido: true, campos_validos: true,
    possui_conflito: conflito, dentro_disponibilidade: true, message, validated_at: nowIso(),
  });

  route("PUT", "/api/suggestions/(\\d+)", ({ db, params, body }) => {
    const sugg = find(db.sugg, params[0], "Sugestão não encontrada.");
    if (sugg.status !== "pending" && sugg.status !== "edited") throw new HttpError(400, "Apenas sugestões pendentes podem ser editadas.");
    const data = body.structured_data;
    const [valid, reason] = validateSuggestion(data);
    if (!valid) throw new HttpError(400, `Dados inválidos: ${reason}`);
    let conflicts = [];
    if (data.date && data.time) {
      const s = toMin(data.time);
      conflicts = findConflicts(db, data.date, s, endMinutes(s, data.duration_minutes || 30));
    }
    data.conflicts = conflicts;
    sugg.type = data.type;
    sugg.content = data.title + (data.date ? ` — ${data.date}` : "") + (data.time ? ` às ${data.time}` : "");
    sugg.structured_data = JSON.stringify(data);
    sugg.status = "edited";
    addDecision(db, sugg, "Editar", body.note || `Editada para '${data.title}'`);
    addValidation(db, sugg, conflicts.length > 0, "Revalidação após edição do usuário.");
    addHistory(db, "sugestao_editada", "Você editou uma sugestão da IA.");
    return ok(outSugg(sugg));
  });

  route("POST", "/api/suggestions/(\\d+)/regenerate", ({ db, params }) => {
    const sugg = find(db.sugg, params[0], "Sugestão não encontrada.");
    pending(sugg);
    const data = JSON.parse(sugg.structured_data);
    const dur = data.duration_minutes || 45;
    let baseDate = data.date || todayIso();
    let startMin;
    if (data.time) {
      let nextHour = (toMin(data.time) / 60 | 0) + 2;
      nextHour %= 20;
      if (nextHour < 8) { nextHour = 14; baseDate = addDays(baseDate, 1); }
      startMin = nextHour * 60;
      if (findConflicts(db, baseDate, startMin, endMinutes(startMin, dur)).length) [baseDate, startMin] = findNextFreeSlot(db, baseDate, dur);
    } else {
      [baseDate, startMin] = findNextFreeSlot(db, baseDate, dur);
    }
    data.date = baseDate;
    data.time = minToTime(startMin).slice(0, 5);
    data.conflicts = [];
    sugg.content = `${data.title} — ${data.date} às ${data.time}`;
    sugg.structured_data = JSON.stringify(data);
    sugg.status = "edited";
    addDecision(db, sugg, "Nova_sugestao", `Novo encaixe sugerido: ${data.date} às ${data.time}`);
    addValidation(db, sugg, false, `Novo horário livre verificado pelo Python: ${data.date} às ${data.time}.`);
    addHistory(db, "nova_sugestao_solicitada", `Você solicitou uma nova sugestão de horário para '${data.title}'.`);
    return ok(outSugg(sugg));
  });

  route("POST", "/api/suggestions/(\\d+)/approve", ({ db, params }) => {
    const sugg = find(db.sugg, params[0], "Sugestão não encontrada.");
    pending(sugg);
    const data = JSON.parse(sugg.structured_data);
    const [valid, reason] = validateSuggestion(data);
    if (!valid) throw new HttpError(400, `Não é possível aprovar: ${reason}`);
    const sDate = data.date || null;
    const sTime = data.time ? normTime(data.time) : null;

    if (data.type === "compromisso" && sDate && sTime) {
      const dur = data.duration_minutes || 60;
      const s = toMin(sTime), e = endMinutes(s, dur);
      const conflicts = findConflicts(db, sDate, s, e);
      if (conflicts.length) throw new HttpError(409, { message: "Conflito de horário detectado. Edite a sugestão.", conflicts });
      db.appts.push({
        id: nextId(db, "appt"), title: data.title, description: data.description || "", date: sDate,
        start_time: sTime, end_time: minToTime(e), category: data.category || "geral", category_id: null, status: "Agendada",
      });
    } else {
      const dur = data.duration_minutes || 30;
      if (sDate && sTime) {
        const conflicts = taskConflicts(db, sDate, sTime, dur);
        if (conflicts.length) throw new HttpError(409, { message: "Conflito de horário detectado. Edite a sugestão.", conflicts });
      }
      db.tasks.push({
        id: nextId(db, "task"), title: data.title, description: data.description || "", priority: data.priority || "media",
        category: data.category || "geral", category_id: null, goal_id: null, deadline: null, duration: dur, status: "pendente",
        scheduled_date: sDate, scheduled_time: sTime, completed_at: null, created_at: nowIso(),
      });
    }
    sugg.status = "approved"; sugg.decided_at = nowIso();
    addDecision(db, sugg, "Aprovar", `Aprovada e incorporada à rotina como ${data.type}.`);
    addHistory(db, "sugestao_aprovada", `Você aprovou a sugestão '${data.title}'.`);
    return ok(outSugg(sugg));
  });

  route("POST", "/api/suggestions/(\\d+)/reject", ({ db, params }) => {
    const sugg = find(db.sugg, params[0], "Sugestão não encontrada.");
    pending(sugg);
    sugg.status = "rejected"; sugg.decided_at = nowIso();
    addDecision(db, sugg, "Rejeitar", "Rejeitada pelo usuário.");
    addHistory(db, "sugestao_rejeitada", "Você rejeitou uma sugestão da IA.");
    return ok(outSugg(sugg));
  });

  // ---- Histórico e demonstração
  route("GET", "/api/history", ({ db }) => ok([...db.hist].sort((a, b) => b.id - a.id).slice(0, 200).map((h) => pick(h, ["id", "action", "description", "created_at"]))), false);
  route("POST", "/api/demo/seed", ({ db }) => ok(seedSic(db)), false);
  route("POST", "/api/demo/reset", ({ db }) => {
    wipeSessionData(db);
    addHistory(db, "dados_limpos", "Você limpou os dados da sessão atual.");
    db.cleared = true; db.dirty = false;
    return ok({ status: "ok" });
  }, false);
  route("GET", "/api/health", () => ok({ status: "ok", mode: "frontend-only" }), false);

  // ---------------------------------------------------------------- despacho
  async function handle(method, path, body) {
    const db = openDb();
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = path.match(r.re);
      if (!m) continue;
      try {
        const res = r.fn({ db, params: m.slice(1), body: body || {} });
        if (r.mutates) db.dirty = true;
        saveRaw(db);
        return res;
      } catch (err) {
        if (err instanceof HttpError) return { status: err.status, data: { detail: err.detail } };
        console.error("[MINDSIDE demo]", err);
        return { status: 500, data: { detail: "Erro interno na simulação do servidor." } };
      }
    }
    return { status: 404, data: { detail: "Rota não encontrada." } };
  }

  function makeResponse({ status, data }) {
    if (status === 204 || data === null) return new Response(null, { status: status === 200 ? 204 : status });
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  }

  const realFetch = typeof root.fetch === "function" ? root.fetch.bind(root) : null;
  const API_URL_RE = /^(?:https?:\/\/[^/]+)?(\/api\/[^?#]*)/;

  root.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || String(input);
    const m = API_URL_RE.exec(url);
    if (!m) return realFetch ? realFetch(input, init) : Promise.reject(new TypeError("fetch indisponível"));
    const method = String((init && init.method) || (typeof input !== "string" && input && input.method) || "GET").toUpperCase();
    let body = null;
    if (init && init.body) { try { body = JSON.parse(init.body); } catch (_) { body = null; } }
    return handle(method, m[1], body).then(makeResponse);
  };

  // Utilitário de apoio para a apresentação (console do navegador): MindsideDemo.recarregarSIC()
  root.MindsideDemo = {
    recarregarSIC() { const db = openDb(); seedSic(db); saveRaw(db); return "Cenário SIC recarregado."; },
    limparTudo() { try { root.localStorage.removeItem(KEY); } catch (_) { /* ignore */ } memoryStore = null; return "Dados locais apagados."; },
    _handle: handle,
  };
})();
