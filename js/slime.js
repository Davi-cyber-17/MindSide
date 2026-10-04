/*
 * Slime — mascote da IA do MINDSIDE, em pixel art real (sprite 13x11 "pixels"
 * desenhado via box-shadow, sem border-radius, sem imagem externa).
 * - a cor do slime NÃO é decidida aqui: ele herda a variável CSS
 *   --accent-area, definida centralmente por css/global.css (:root:has(...))
 *   e reforçada por js/area-theme.js — assim ele está sempre sincronizado
 *   com o resto da interface (sidebar, badges, bordas) sem duplicar o mapa.
 * - acompanha o ponteiro (olhos) com easing suave via requestAnimationFrame
 * - reage a clique/toque (squash & stretch aplicado a um wrapper interno,
 *   separado do wrapper externo que só cuida do encaixe no espaço disponível)
 * - suporta Pointer Events (mouse e touch) e respeita prefers-reduced-motion
 */

// dimensões "de desenho" do sprite (definidas em css/global.css, classe .slime)
const SLIME_DESIGN_WIDTH = 78;
const SLIME_DESIGN_HEIGHT = 66;

function buildSlimeMarkup() {
  return `
    <div class="slime" data-state="idle">
      <div class="slime-inner">
        <div class="pixel-body"></div>
        <div class="pixel-eye l"></div>
        <div class="pixel-eye r"></div>
        <div class="pixel-mouth"></div>
      </div>
    </div>`;
}

class Slime {
  constructor(container) {
    this.container = container;
    this.container.classList.add("slime-box");
    this.container.innerHTML = buildSlimeMarkup();
    this.el = this.container.querySelector(".slime");
    this.inner = this.container.querySelector(".slime-inner");
    this.eyes = this.container.querySelectorAll(".pixel-eye");
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.target = { x: 0, y: 0 };
    this.current = { x: 0, y: 0 };

    // Interação especial "10 cliques": contador isolado, não interfere em
    // nenhum outro comportamento do slime (ver bindStreakCounter()).
    this.clickStreak = 0;
    this.specialActive = false;

    this.fitToContainer();
    this.bindEvents();
    this.bindStreakCounter();
    if (!this.reducedMotion) this.loop();
  }

  // Escala o sprite (mantendo os pixels quadrados e nítidos) para caber no
  // espaço declarado pelo contêiner, mantendo-o centralizado.
  fitToContainer() {
    const rect = this.container.getBoundingClientRect();
    if (!rect.width || !rect.height) return; // contêiner ainda sem layout, mantém escala 1
    const scale = Math.min(rect.width / SLIME_DESIGN_WIDTH, rect.height / SLIME_DESIGN_HEIGHT, 1) || 1;
    this.el.style.transform = `scale(${scale})`;
  }

  bindEvents() {
    window.addEventListener("pointermove", (e) => {
      if (this.reducedMotion) return;
      const rect = this.el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(-4, Math.min(4, (e.clientX - cx) / 40));
      const dy = Math.max(-3, Math.min(3, (e.clientY - cy) / 60));
      this.target = { x: dx, y: dy };
      this.setState("looking");
    }, { passive: true });

    const react = () => {
      this.setState("clicked");
      this.inner.style.transform = "scaleX(1.18) scaleY(0.78)";
      setTimeout(() => { this.inner.style.transform = "scaleX(0.9) scaleY(1.15)"; }, 110);
      setTimeout(() => { this.inner.style.transform = ""; this.setState("happy"); }, 220);
      setTimeout(() => this.setState("idle"), 900);
    };
    this.container.addEventListener("pointerdown", react);
    this.container.addEventListener("click", react);

    window.addEventListener("resize", () => this.fitToContainer());
  }

  setState(state) {
    // Enquanto a reação especial dos 10 cliques estiver tocando, nenhum
    // outro estado (dos timers da reação normal de clique, de processing/
    // respond/error etc.) pode sobrescrevê-la no meio da animação — só o
    // próprio ciclo especial decide quando sair desse estado.
    if (this.specialActive && state !== "special-reaction") return;
    this.el.setAttribute("data-state", state);
  }

  // ---------- Interação especial: 10 cliques/toques ----------
  // Conta cliques/toques reais no slime (um por gesto, via "pointerdown" —
  // o mesmo evento que mouse e touch disparam de forma consistente) sem
  // tocar na reação normal já existente em bindEvents(). Ao chegar no
  // décimo, dispara uma animação maior e reseta sozinho ao terminar.
  bindStreakCounter() {
    this.container.addEventListener("pointerdown", () => this.registerStreakClick());
  }

  registerStreakClick() {
    // Enquanto a animação especial estiver rodando, novos cliques ainda
    // recebem a reação normal (bindEvents cuida disso), mas não contam
    // para a contagem — evita sobrepor várias reações especiais.
    if (this.specialActive) return;

    this.clickStreak += 1;
    if (this.clickStreak >= 10) {
      this.clickStreak = 10;
      this.triggerSpecialReaction();
    }
  }

  triggerSpecialReaction() {
    this.specialActive = true;
    this.setState("special-reaction");

    if (this.reducedMotion) {
      // Movimento reduzido: mantém o feedback (e o contador funcionando),
      // mas troca a deformação grande por um pulso de brilho, sem escala.
      const REDUCED_MS = 420;
      this.inner.classList.add("mega-reduced");
      setTimeout(() => {
        this.inner.classList.remove("mega-reduced");
        this.finishSpecialReaction();
      }, REDUCED_MS);
      return;
    }

    const FULL_MS = 900;
    this.inner.classList.add("mega-grow");
    setTimeout(() => {
      this.inner.classList.remove("mega-grow");
      this.finishSpecialReaction();
    }, FULL_MS);
  }

  finishSpecialReaction() {
    this.clickStreak = 0;
    this.specialActive = false;
    this.setState("idle");
  }

  loop() {
    this.current.x += (this.target.x - this.current.x) * 0.15;
    this.current.y += (this.target.y - this.current.y) * 0.15;
    this.eyes.forEach((eye) => {
      eye.style.transform = `translate(${this.current.x}px, ${this.current.y}px)`;
    });
    requestAnimationFrame(() => this.loop());
  }

  processing() { this.setState("processing"); }
  respond() { this.setState("happy"); setTimeout(() => this.setState("idle"), 1200); }
  errorState() { this.setState("error"); setTimeout(() => this.setState("idle"), 1200); }
}

function initSlimes() {
  document.querySelectorAll("[data-slime]").forEach((box) => {
    box.__slime = new Slime(box);
  });
}
document.addEventListener("DOMContentLoaded", initSlimes);
