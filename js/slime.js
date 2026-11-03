/*
 * Slime — mascote interativo padrão do MINDSIDE (Novo Modelo Pixel Art Limpo).
 * - Renderiza apenas o personagem slime em pixel art (sem moldura externa e
 *   sem ícones sobrepostos), herdando a cor temática via --accent-area.
 * - Acompanha o ponteiro (olhos) com easing suave via requestAnimationFrame.
 * - Reage a clique/toque (squash & stretch) e possui reação especial aos 10 cliques.
 * - Suporta Pointer Events (mouse e touch) e respeita prefers-reduced-motion.
 */

function buildSlimeMarkup() {
  return `
    <div class="slime" data-state="idle">
      <div class="slime-inner">
        <svg class="slime-svg" viewBox="0 0 48 40" width="100%" height="100%" role="img" aria-label="Mascote MindSide">
          <!-- Corpo Principal Pixel Art (Novo Modelo Limpo, sem moldura e sem acessórios) -->
          <g class="slime-body-group">
            <path class="slime-body-fill" d="M12 6 H36 V10 H40 V14 H44 V32 H40 V36 H8 V32 H4 V14 H8 V10 H12 Z"/>
            <path class="slime-body-top" d="M12 6 H36 V10 H12 Z M8 10 H12 V14 H8 Z"/>
            <path class="slime-body-shadow" d="M8 32 H40 V36 H8 Z"/>
            <rect class="slime-body-shine" x="12" y="10" width="6" height="4" fill="#ffffff" opacity="0.85"/>
          </g>

          <!-- Olhos e Expressões Faciais (acompanham o cursor) -->
          <g class="slime-face" data-slime-eyes>
            <!-- Olhos padrão -->
            <g class="slime-eyes-default">
              <rect x="15" y="18" width="5" height="5" fill="#04070a"/>
              <rect x="28" y="18" width="5" height="5" fill="#04070a"/>
              <rect x="16" y="18.8" width="1.6" height="1.6" fill="#ffffff"/>
              <rect x="29" y="18.8" width="1.6" height="1.6" fill="#ffffff"/>
            </g>

            <!-- Olhos felizes (^ ^) no clique / aprovação -->
            <g class="slime-eyes-happy">
              <path d="M14 21.5 L17.5 18 L21 21.5" stroke="#04070a" stroke-width="2.5" stroke-linecap="square" fill="none"/>
              <path d="M27 21.5 L30.5 18 L34 21.5" stroke="#04070a" stroke-width="2.5" stroke-linecap="square" fill="none"/>
            </g>

            <!-- Boca padrão e variações de expressão -->
            <rect class="slime-mouth-default" x="20" y="26.5" width="8" height="2.8" fill="#04070a"/>
            <g class="slime-mouth-happy">
              <path d="M18 25 H30 V29.5 H18 Z" fill="#04070a"/>
              <rect class="slime-tongue" x="20.5" y="27.2" width="7" height="2.2"/>
            </g>
            <path class="slime-mouth-conflict" d="M17 28.5 L20.5 26 L24 28.5 L27.5 26 L31 28.5" stroke="#04070a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <rect class="slime-mouth-gasp" x="19" y="23.5" width="10" height="7" rx="1.5" fill="#04070a"/>
          </g>
        </svg>
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
    this.eyes = this.container.querySelectorAll("[data-slime-eyes]");
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.target = { x: 0, y: 0 };
    this.current = { x: 0, y: 0 };

    // Interação especial "10 cliques": contador isolado
    this.clickStreak = 0;
    this.specialActive = false;

    this.fitToContainer();
    this.bindEvents();
    this.bindStreakCounter();
    if (!this.reducedMotion) this.loop();
  }

  fitToContainer() {
    if (!this.el) return;
    this.el.style.transform = "";
  }

  setVariant() {
    // Mantido por compatibilidade; o slime padrão permanece sempre limpo.
  }

  bindEvents() {
    window.addEventListener("pointermove", (e) => {
      if (this.reducedMotion) return;
      const rect = this.el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(-3.2, Math.min(3.2, (e.clientX - cx) / 45));
      const dy = Math.max(-2.4, Math.min(2.4, (e.clientY - cy) / 65));
      this.target = { x: dx, y: dy };
      if (this.el.getAttribute("data-state") === "idle") {
        this.setState("looking");
      }
    }, { passive: true });

    const react = () => {
      this.setState("clicked");
      this.inner.style.transform = "scaleX(1.16) scaleY(0.80)";
      setTimeout(() => { this.inner.style.transform = "scaleX(0.90) scaleY(1.14)"; }, 110);
      setTimeout(() => { this.inner.style.transform = ""; this.setState("happy"); }, 220);
      setTimeout(() => this.setState("idle"), 900);
    };
    this.container.addEventListener("pointerdown", react);

    window.addEventListener("resize", () => this.fitToContainer());
  }

  setState(state) {
    if (this.specialActive && state !== "special-reaction") return;
    this.el.setAttribute("data-state", state);
  }

  bindStreakCounter() {
    this.container.addEventListener("pointerdown", () => this.registerStreakClick());
  }

  registerStreakClick() {
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
