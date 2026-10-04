/*
 * area-theme.js — sistema centralizado de tema por área do MINDSIDE.
 *
 * Fonte única de verdade para "qual cor pertence a qual área". Nenhum
 * outro arquivo (CSS ou JS) deve redeclarar esse mapeamento — todos os
 * componentes (sidebar, badges, cards, slime, bordas) leem a variável
 * CSS --accent-area, que este módulo (e, como primeira camada sem
 * flash, as regras :root:has(body[data-area]) em css/global.css)
 * mantém sincronizada com a área ativa.
 *
 * Prioridade de contexto (conforme especificado):
 *   1. Área explicitamente aplicada via JS (MindsideAreaTheme.apply)
 *   2. data-area do <body> (já cobre a página atual)
 *   3. Tema padrão verde ("ia")
 */
const AREA_COLOR_VAR = {
  ia: "--green",
  tarefas: "--yellow",
  compromissos: "--blue",
  agenda: "--blue",
  objetivos: "--red",
  documentos: "--orange",
  perfil: "--purple",
  configuracoes: "--purple",
  historico: "--indigo",
};

const DEFAULT_AREA = "ia";

function applyAreaTheme(area) {
  const key = AREA_COLOR_VAR[area] ? area : DEFAULT_AREA;
  const varName = AREA_COLOR_VAR[key];
  document.documentElement.style.setProperty("--accent-area", `var(${varName})`);
  document.documentElement.setAttribute("data-active-area", key);
  return key;
}

function currentArea() {
  return document.documentElement.getAttribute("data-active-area")
    || document.body.getAttribute("data-area")
    || DEFAULT_AREA;
}

// Aplica assim que o <body data-area="..."> estiver disponível. As regras
// CSS :has() já pintam a cor correta antes disso (sem flash); esta chamada
// apenas reforça a mesma fonte de verdade e permite que outras páginas ou
// scripts alterem a área dinamicamente depois, se um dia precisarem.
document.addEventListener("DOMContentLoaded", () => {
  applyAreaTheme(document.body.getAttribute("data-area") || DEFAULT_AREA);
});

window.MindsideAreaTheme = {
  AREA_COLOR_VAR,
  apply: applyAreaTheme,
  current: currentArea,
};
