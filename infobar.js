// Barra info — plugin per Fontra
// Un pannello fluttuante in basso al centro del canvas, come l'info box di Glyphs:
// nome e Unicode, trasformazioni della selezione, side bearing con il kerning
// verso i glifi vicini, gruppi di kerning. Tutti i valori sono modificabili.

const TAG = "fontra-infobar";
const STORAGE_KEY = "fontra-plugin-infobar-settings";
const DEFAULTS = { ref: "bl", collapsed: false, offsetX: 0, offsetY: 0 };

// Punti di riferimento (come la griglia 3×3 di Glyphs)
const REFS = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];
const REF_LABELS = {
  tl: "in alto a sinistra", tc: "in alto al centro", tr: "in alto a destra",
  ml: "al centro a sinistra", mc: "al centro", mr: "al centro a destra",
  bl: "in basso a sinistra", bc: "in basso al centro", br: "in basso a destra",
};

const TEXT_FIELDS = new Set(["kernL", "kernR"]);

// ---------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // impostazioni valide solo per questa sessione
  }
}

function fmt(v) {
  if (v === undefined || v === null || !Number.isFinite(v)) return "";
  const r = Math.round(v * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}

// Valuta un'espressione aritmetica semplice (es. "120+15", "590/2", "(30+40)*2").
// Se l'espressione inizia con un operatore ("+20", "*2", "/2"), lo applica al valore attuale.
// "-20" resta un numero negativo; per sottrarre al valore attuale scrivi "--20".
export function evaluateInput(text, current) {
  let s = String(text).trim().replace(/,/g, ".");
  if (!s) return null;
  if (current !== undefined && current !== null && Number.isFinite(current)) {
    if (/^[+*/]/.test(s)) s = `(${current})${s}`;
    else if (s.startsWith("--")) s = `(${current})-${s.slice(2)}`;
  }
  if (!/^[-+*/().\d\s]+$/.test(s)) return null;
  try {
    const v = Function(`"use strict"; return (${s});`)();
    return Number.isFinite(v) ? v : null;
  } catch (e) {
    return null;
  }
}

function parseSelection(selection) {
  const result = { point: [], component: [], anchor: [] };
  for (const item of selection || []) {
    const [tp, index] = String(item).split("/");
    const i = parseInt(index, 10);
    if (!Number.isFinite(i)) continue;
    if (tp === "point") result.point.push(i);
    else if (tp === "component" || tp === "componentOrigin" || tp === "componentTCenter") {
      if (!result.component.includes(i)) result.component.push(i);
    } else if (tp === "anchor") result.anchor.push(i);
  }
  return result;
}

// Punti on-curve selezionati + le loro maniglie non selezionate:
// quando sposti un nodo, le maniglie lo seguono (come trascinando).
function pointsToTransform(path, pointIndices) {
  const selected = new Set(pointIndices);
  const result = new Set(pointIndices);
  for (const i of pointIndices) {
    const p = path.getPoint(i);
    if (!p || p.type) continue;
    let ci, cpi;
    try {
      [ci, cpi] = path.getContourAndPointIndex(i);
    } catch (e) {
      continue;
    }
    const n = path.getNumPointsOfContour(ci);
    const closed = path.contourInfo[ci].isClosed;
    for (const delta of [-1, 1]) {
      let j = cpi + delta;
      if (closed) j = (j + n) % n;
      else if (j < 0 || j >= n) continue;
      const abs = path.getAbsolutePointIndex(ci, j);
      const q = path.getPoint(abs);
      if (q?.type && !selected.has(abs)) result.add(abs);
    }
  }
  return [...result];
}

function boundsOfPoints(points) {
  if (!points.length) return null;
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const p of points) {
    xMin = Math.min(xMin, p.x);
    yMin = Math.min(yMin, p.y);
    xMax = Math.max(xMax, p.x);
    yMax = Math.max(yMax, p.y);
  }
  return { xMin, yMin, xMax, yMax };
}

function unionBounds(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    xMin: Math.min(a.xMin, b.xMin),
    yMin: Math.min(a.yMin, b.yMin),
    xMax: Math.max(a.xMax, b.xMax),
    yMax: Math.max(a.yMax, b.yMax),
  };
}

function refPoint(b, ref) {
  const x = ref[1] === "l" ? b.xMin : ref[1] === "r" ? b.xMax : (b.xMin + b.xMax) / 2;
  const y = ref[0] === "b" ? b.yMin : ref[0] === "t" ? b.yMax : (b.yMin + b.yMax) / 2;
  return { x, y };
}

// Rettangolo della selezione in un glifo statico (punti selezionati + ancore)
function selectionBoundsForGlyph(glyph, sel) {
  const pts = [];
  for (const i of sel.point) {
    const p = glyph.path.getPoint(i);
    if (p) pts.push(p);
  }
  for (const i of sel.anchor) {
    const a = glyph.anchors?.[i];
    if (a) pts.push(a);
  }
  return boundsOfPoints(pts);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// ---------------------------------------------------------------------------
// Interfaccia
// ---------------------------------------------------------------------------

const CSS = `
  :host {
    position: absolute;
    left: 50%;
    bottom: 18px;
    z-index: 3;
    transform: translateX(-50%);
    pointer-events: auto;
    font-family: fontra-ui-regular, -apple-system, system-ui, sans-serif;
    font-size: 12px;
    color: var(--ui-element-foreground-color, #222);
    user-select: none;
  }
  :host([hidden]) { display: none; }
  .box {
    width: 340px;
    box-sizing: border-box;
    padding: 6px 10px 10px;
    border-radius: 12px;
    background: var(--ui-element-background-color, #fff);
    box-shadow: 0 4px 16px #0003, 0 0 0 0.5px #0003;
  }
  [hidden] { display: none !important; }

  /* Intestazione: maniglia · nome + Unicode · riduci */
  .header {
    display: grid;
    grid-template-columns: 24px 1fr 24px;
    align-items: center;
    min-height: 24px;
  }
  .grip {
    cursor: grab;
    opacity: 0.4;
    font-size: 13px;
    letter-spacing: -2px;
    line-height: 1;
    padding: 4px 2px;
  }
  .grip:active { cursor: grabbing; }
  .title {
    text-align: center;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .name { font-weight: bold; font-size: 13px; }
  .uni { opacity: 0.55; font-size: 11px; margin-left: 6px; font-variant-numeric: tabular-nums; }
  .collapse {
    border: none; background: transparent; color: inherit;
    opacity: 0.45; cursor: pointer; font-size: 14px; padding: 0; justify-self: end;
    width: 22px; height: 22px; border-radius: 5px;
  }
  .collapse:hover, .grip:hover { opacity: 0.85; }
  .collapsed .section { display: none; }

  .section {
    border-top: 1px solid #8883;
    margin-top: 8px;
    padding-top: 8px;
  }

  /* Trasformazioni */
  .transform {
    display: grid;
    grid-template-columns: 30px 14px 1fr 14px 1fr;
    grid-auto-rows: 24px;
    gap: 4px 4px;
    align-items: center;
  }
  .ref {
    grid-row: span 2;
    display: grid;
    grid-template-columns: repeat(3, 7px);
    grid-template-rows: repeat(3, 7px);
    gap: 2px;
    align-self: center;
  }
  .ref button {
    width: 7px; height: 7px; padding: 0;
    border: 1px solid currentColor;
    border-radius: 2px;
    background: transparent;
    opacity: 0.4;
    cursor: pointer;
  }
  .ref button.active { background: currentColor; opacity: 0.9; }
  .ref.off { visibility: hidden; }
  .lbl { opacity: 0.55; font-size: 11px; text-align: right; }
  .delta {
    grid-column: 2 / -1;
    opacity: 0.6;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  /* Metriche: kerning ◀ | LSB | larghezza | RSB | kerning ▶, poi i gruppi */
  .metrics {
    display: grid;
    grid-template-columns: 1fr 1.15fr 1.3fr 1.15fr 1fr;
    gap: 2px 4px;
    align-items: center;
  }
  .cap {
    font-size: 10px;
    opacity: 0.55;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cap.kern { color: #3b82f6; opacity: 0.9; }
  .gap { height: 4px; grid-column: 1 / -1; }
  .span2a { grid-column: 1 / span 2; }
  .span2b { grid-column: 4 / span 2; }

  input {
    font: inherit;
    font-variant-numeric: tabular-nums;
    width: 100%;
    min-width: 0;
    height: 24px;
    box-sizing: border-box;
    padding: 3px 5px;
    border-radius: 5px;
    border: 1px solid transparent;
    background: var(--text-input-background-color, #f0f0f0);
    color: var(--text-input-foreground-color, inherit);
    text-align: center;
    outline: none;
    user-select: text;
  }
  input.kern { color: #3b82f6; }
  input.text { text-align: center; }
  input:focus { border-color: #3b82f6; }
  input:disabled { opacity: 0.35; }
  input.error { border-color: #e03131; }
  input::placeholder { color: inherit; opacity: 0.35; }
`;

class InfoBarElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <div class="box">
        <div class="header">
          <div class="grip" title="Trascina per spostare · doppio clic per rimettere al centro">⋮⋮</div>
          <div class="title"><span class="name" id="name"></span><span class="uni" id="uni"></span></div>
          <button class="collapse" id="collapse" title="Riduci / espandi">–</button>
        </div>

        <div class="section transform" id="sel">
          <div class="ref" title="Punto di riferimento per X/Y e per il ridimensionamento">
            ${REFS.map((r) => `<button data-ref="${r}" title="Riferimento ${REF_LABELS[r]}"></button>`).join("")}
          </div>
          <span class="lbl">X</span><input data-field="x" title="Posizione orizzontale" />
          <span class="lbl">Y</span><input data-field="y" title="Posizione verticale" />
          <span class="lbl" id="w-label">W</span><input data-field="w" title="Larghezza della selezione" />
          <span class="lbl" id="h-label">H</span><input data-field="h" title="Altezza della selezione" />
          <span class="delta" id="delta"></span>
        </div>

        <div class="section metrics" id="metrics">
          <span class="cap kern" id="cap-prev">◀</span>
          <span class="cap">LSB</span>
          <span class="cap">Larghezza</span>
          <span class="cap">RSB</span>
          <span class="cap kern" id="cap-next">▶</span>

          <input class="kern" data-field="kernPrev" title="Kerning con il glifo precedente" />
          <input data-field="lsb" title="Side bearing sinistro" />
          <input data-field="width" title="Larghezza di avanzamento" />
          <input data-field="rsb" title="Side bearing destro" />
          <input class="kern" data-field="kernNext" title="Kerning con il glifo successivo" />

          <div class="gap"></div>
          <span class="cap span2a">Gruppo kerning sx</span>
          <span></span>
          <span class="cap span2b">Gruppo kerning dx</span>
          <input class="text span2a" data-field="kernL" title="Gruppo di kerning del lato sinistro del glifo" />
          <span></span>
          <input class="text span2b" data-field="kernR" title="Gruppo di kerning del lato destro del glifo" />
        </div>
      </div>
    `;
  }

  $(sel) {
    return this.shadowRoot.querySelector(sel);
  }

  input(field) {
    return this.shadowRoot.querySelector(`input[data-field="${field}"]`);
  }
}

if (!customElements.get(TAG)) {
  customElements.define(TAG, InfoBarElement);
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

class InfoBarPlugin {
  constructor(editor) {
    this.editor = editor;
    this.sc = editor.sceneController;
    this.fontController = editor.fontController;
    this.settings = loadSettings();
    this.values = {};
    this.kernInfo = {};

    this.el = document.createElement(TAG);
    this.el.classList.add("cleanable-overlay"); // si nasconde con la "vista pulita" di Fontra
    const container = document.querySelector(".main-container") || document.body;
    container.appendChild(this.el);

    this.setupInputs();
    this.setupDrag();
    this.applyLayoutSettings();

    const update = () => this.scheduleUpdate();
    this.sc.sceneSettingsController.addKeyListener(
      [
        "selectedGlyph",
        "selectedGlyphName",
        "selection",
        "positionedLines",
        "fontLocationSourceMapped",
        "glyphLocation",
        "editLayerName",
        "editingLayers",
      ],
      update
    );
    this.sc.addCurrentGlyphChangeListener(update);
    // Ogni modifica al kerning (anche un annulla) deve svuotare le cache del
    // kerning, altrimenti valori e gruppi mostrati restano quelli vecchi.
    this.fontController.addChangeListener(
      { kerning: null },
      () => {
        try {
          this.kerningController?.clearCaches();
        } catch (e) {
          // ignora
        }
        this.refreshKerningController();
      },
      true,
      true
    );
    this.refreshKerningController();
    this.scheduleUpdate();
  }

  // Fontra ricrea il controller del kerning se cambiano assi o sorgenti
  refreshKerningController() {
    this.fontController.getKerningController("kern").then(
      (kc) => {
        this.kerningController = kc;
        this.scheduleUpdate();
      },
      () => {}
    );
  }

  // Aggiunge una modifica al kerning alla cronologia del glifo corrente,
  // così ⌘Z / Ctrl+Z la annulla come le altre modifiche al glifo.
  pushUndo(glyphName, changes, label) {
    if (!changes?.hasChange || !glyphName) return;
    const selection = new Set(this.sc.selection);
    this.fontController.pushUndoRecordForGlyph(glyphName, changes.change, changes.rollbackChange, {
      label,
      undoSelection: selection,
      redoSelection: selection,
    });
  }

  // --- layout ---------------------------------------------------------------

  applyLayoutSettings() {
    const { offsetX, offsetY, collapsed, ref } = this.settings;
    this.el.style.transform = `translate(calc(-50% + ${offsetX}px), ${offsetY}px)`;
    this.el.$(".box").classList.toggle("collapsed", !!collapsed);
    this.el.$("#collapse").textContent = collapsed ? "+" : "–";
    for (const b of this.el.shadowRoot.querySelectorAll(".ref button")) {
      b.classList.toggle("active", b.dataset.ref === ref);
    }
  }

  setSetting(key, value) {
    this.settings = { ...this.settings, [key]: value };
    saveSettings(this.settings);
    this.applyLayoutSettings();
  }

  setupDrag() {
    const grip = this.el.$(".grip");
    let start = null;
    grip.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      grip.setPointerCapture(event.pointerId);
      start = { x: event.clientX, y: event.clientY, ox: this.settings.offsetX, oy: this.settings.offsetY };
    });
    grip.addEventListener("pointermove", (event) => {
      if (!start) return;
      this.settings.offsetX = start.ox + event.clientX - start.x;
      this.settings.offsetY = Math.min(0, start.oy + event.clientY - start.y);
      this.applyLayoutSettings();
    });
    const end = () => {
      if (!start) return;
      start = null;
      saveSettings(this.settings);
    };
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    grip.addEventListener("dblclick", () => {
      this.setSetting("offsetX", 0);
      this.setSetting("offsetY", 0);
    });
    this.el.$("#collapse").addEventListener("click", () => {
      this.setSetting("collapsed", !this.settings.collapsed);
    });
    for (const b of this.el.shadowRoot.querySelectorAll(".ref button")) {
      b.addEventListener("click", () => {
        this.setSetting("ref", b.dataset.ref);
        this.scheduleUpdate();
      });
    }
  }

  setupInputs() {
    for (const input of this.el.shadowRoot.querySelectorAll("input[data-field]")) {
      const field = input.dataset.field;
      const isText = TEXT_FIELDS.has(field);
      // Al clic seleziona tutto il valore, così si può riscriverlo subito (come in Glyphs)
      input.addEventListener("focus", () => {
        input.dataset.original = input.value;
        input.dataset.justFocused = "1";
        input.select();
      });
      input.addEventListener("mouseup", (event) => {
        if (input.dataset.justFocused) {
          event.preventDefault();
          input.select();
        }
        delete input.dataset.justFocused;
      });
      input.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          await this.commit(field, input.value);
          this.returnFocusToCanvas();
        } else if (event.key === "Escape") {
          event.preventDefault();
          input.value = input.dataset.original ?? "";
          input.classList.remove("error");
          this.returnFocusToCanvas();
        } else if (!isText && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          event.preventDefault();
          const step = (event.shiftKey ? 10 : 1) * (event.key === "ArrowUp" ? 1 : -1);
          let current = this.values[field];
          if (!Number.isFinite(current) && (field === "kernPrev" || field === "kernNext")) {
            current = 0; // nessun kerning finora: si parte da 0
          }
          if (Number.isFinite(current)) {
            const ok = await this.commit(field, String(current + step));
            if (ok !== false) {
              this.values[field] = current + step;
              input.value = fmt(current + step);
              input.dataset.original = input.value;
            }
            input.select();
          }
        }
        event.stopPropagation();
      });
      input.addEventListener("change", () => {
        if (input.value !== input.dataset.original) this.commit(field, input.value);
      });
      input.addEventListener("blur", () => {
        input.classList.remove("error");
        this.scheduleUpdate();
      });
    }
  }

  returnFocusToCanvas() {
    const active = this.el.shadowRoot.activeElement;
    if (active) {
      active.dataset.original = active.value;
      active.blur();
    }
    document.querySelector("#edit-canvas")?.focus();
  }

  // --- lettura dello stato ------------------------------------------------------

  scheduleUpdate() {
    if (this._pending) return;
    this._pending = true;
    requestAnimationFrame(() => {
      this._pending = false;
      try {
        this.update();
      } catch (e) {
        console.error("[Barra info]", e);
      }
    });
  }

  getContext() {
    const positioned = this.sc.sceneModel.getSelectedPositionedGlyph();
    const glyph = positioned?.glyph; // StaticGlyphController
    if (!glyph) return null;
    const selectedGlyph = this.sc.sceneModel.selectedGlyph;
    const isEditing = !!selectedGlyph?.isEditing;
    const sel = isEditing ? parseSelection(this.sc.selection) : { point: [], component: [], anchor: [] };
    return { positioned, glyph, instance: glyph.instance, isEditing, sel, glyphName: glyph.name, selectedGlyph };
  }

  // Glifi vicini nella riga di testo, per il kerning
  getNeighbors(ctx) {
    const { lineIndex, glyphIndex } = ctx.selectedGlyph || {};
    const glyphs = this.sc.sceneModel.positionedLines?.[lineIndex]?.glyphs;
    if (!glyphs) return { prev: null, next: null };
    return {
      prev: glyphIndex > 0 ? glyphs[glyphIndex - 1]?.glyphName ?? null : null,
      next: glyphs[glyphIndex + 1]?.glyphName ?? null,
    };
  }

  getSourceIdentifier() {
    try {
      return this.fontController.fontSourcesInstancer.getSourceIdentifierForLocation(
        this.sc.sceneSettings.fontLocationSourceMapped,
        false
      );
    } catch (e) {
      return undefined;
    }
  }

  getKernValue(leftGlyph, rightGlyph) {
    const kc = this.kerningController;
    if (!kc || !leftGlyph || !rightGlyph) return null;
    try {
      return kc.getGlyphPairValue(
        leftGlyph,
        rightGlyph,
        this.sc.sceneSettings.fontLocationSourceMapped,
        this.getSourceIdentifier()
      );
    } catch (e) {
      return null;
    }
  }

  update() {
    const ctx = this.getContext();
    if (!ctx) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;
    const { glyph, instance, sel, glyphName } = ctx;
    const values = {};

    // Nome e Unicode
    this.el.$("#name").textContent = glyphName || "";
    this.el.$(".title").title = glyphName || "";
    const codePoints = this.fontController.glyphMap?.[glyphName] || [];
    this.el.$("#uni").textContent = codePoints
      .map((cp) => "U+" + cp.toString(16).toUpperCase().padStart(4, "0"))
      .join(" ");

    // Trasformazioni della selezione
    const hasSelection = sel.point.length + sel.component.length + sel.anchor.length > 0;
    let delta = "";
    if (hasSelection) {
      let b = selectionBoundsForGlyph(instance, sel);
      for (const ci of sel.component) {
        const cb = glyph.components?.[ci]?.bounds;
        if (cb) b = unionBounds(b, cb);
      }
      if (b) {
        const single = sel.point.length + sel.anchor.length === 1 && !sel.component.length;
        if (single) {
          const p = sel.point.length ? instance.path.getPoint(sel.point[0]) : instance.anchors[sel.anchor[0]];
          values.x = p.x;
          values.y = p.y;
          if (sel.point.length && p.type) delta = this.handleDelta(instance.path, sel.point[0]);
        } else {
          const r = refPoint(b, this.settings.ref);
          values.x = r.x;
          values.y = r.y;
          values.w = b.xMax - b.xMin;
          values.h = b.yMax - b.yMin;
        }
      }
    }
    const showSel = hasSelection && values.x !== undefined;
    this.el.$("#sel").hidden = !showSel;
    const showWH = showSel && values.w !== undefined;
    for (const f of ["w", "h"]) {
      this.el.input(f).hidden = !showWH;
      this.el.$(`#${f}-label`).hidden = !showWH;
      // con componenti selezionati il ridimensionamento non è supportato
      this.el.input(f).disabled = sel.component.length > 0;
    }
    this.el.$(".ref").classList.toggle("off", !showWH);
    this.el.$("#delta").textContent = delta;
    this.el.$("#delta").hidden = !delta;

    // Metriche
    values.lsb = glyph.leftMargin;
    values.rsb = glyph.rightMargin;
    values.width = instance?.xAdvance;

    // Kerning con i vicini
    const kc = this.kerningController;
    const { prev, next } = this.getNeighbors(ctx);
    this.kernInfo = { prev, next };
    values.kernPrev = this.getKernValue(prev, glyphName);
    values.kernNext = this.getKernValue(glyphName, next);
    this.el.$("#cap-prev").textContent = prev ? `◀ ${prev}` : "◀";
    this.el.$("#cap-prev").title = prev ? `Kerning ${prev} ${glyphName}` : "Nessun glifo a sinistra";
    this.el.$("#cap-next").textContent = next ? `${next} ▶` : "▶";
    this.el.$("#cap-next").title = next ? `Kerning ${glyphName} ${next}` : "Nessun glifo a destra";

    // Gruppi di kerning
    values.kernL = kc?.rightPairGroupMapping?.[glyphName] || "";
    values.kernR = kc?.leftPairGroupMapping?.[glyphName] || "";

    this.values = values;
    for (const input of this.el.shadowRoot.querySelectorAll("input[data-field]")) {
      const field = input.dataset.field;
      if (field === "kernPrev") {
        input.disabled = !kc || !prev;
        input.placeholder = prev ? "0" : "";
      } else if (field === "kernNext") {
        input.disabled = !kc || !next;
        input.placeholder = next ? "0" : "";
      } else if (field === "lsb" || field === "rsb") {
        input.disabled = values[field] === undefined;
      } else if (TEXT_FIELDS.has(field)) {
        input.disabled = !kc;
      }
      if (this.el.shadowRoot.activeElement === input) continue; // non disturbare chi scrive
      const v = values[field];
      input.value = typeof v === "string" ? v : fmt(v);
      input.dataset.original = input.value;
    }
  }

  handleDelta(path, pointIndex) {
    try {
      const p = path.getPoint(pointIndex);
      const [ci, cpi] = path.getContourAndPointIndex(pointIndex);
      const n = path.getNumPointsOfContour(ci);
      const closed = path.contourInfo[ci].isClosed;
      const nodes = [];
      for (const d of [-1, 1]) {
        let j = cpi + d;
        if (closed) j = (j + n) % n;
        else if (j < 0 || j >= n) continue;
        const q = path.getContourPoint(ci, j);
        if (!q.type) nodes.push(q);
      }
      if (nodes.length !== 1) return "";
      return `Maniglia: Δx ${fmt(p.x - nodes[0].x)}  Δy ${fmt(p.y - nodes[0].y)}`;
    } catch (e) {
      return "";
    }
  }

  // --- modifiche -----------------------------------------------------------------

  flashError(input, message) {
    input.classList.add("error");
    if (message) {
      const oldTitle = input.title;
      input.title = message;
      setTimeout(() => {
        input.title = oldTitle;
      }, 4000);
    }
  }

  async commit(field, text) {
    const input = this.el.input(field);
    if (TEXT_FIELDS.has(field)) {
      return this.commitKernGroup(field, text, input);
    }
    if (field === "kernPrev" || field === "kernNext") {
      return this.commitKernValue(field, text, input);
    }
    const current = this.values[field];
    const value = evaluateInput(text, current);
    if (value === null) {
      this.flashError(input);
      return false;
    }
    input.classList.remove("error");
    if (Number.isFinite(current) && Math.abs(value - current) < 1e-9) return true;
    try {
      if (["x", "y", "w", "h"].includes(field)) {
        await this.commitSelection(field, value);
      } else {
        await this.commitMetrics(field, value);
      }
    } catch (e) {
      console.error("[Barra info]", e);
      this.flashError(input);
      return false;
    }
    this.scheduleUpdate();
    return true;
  }

  async commitSelection(field, value) {
    const ctx = this.getContext();
    if (!ctx) return;
    const { sel } = ctx;
    const current = this.values[field];
    if (!Number.isFinite(current)) return;
    const ref = this.settings.ref;

    if (field === "x" || field === "y") {
      const dx = field === "x" ? value - current : 0;
      const dy = field === "y" ? value - current : 0;
      await this.sc.editLayersAndRecordChanges((layerGlyphs) => {
        for (const lg of Object.values(layerGlyphs)) {
          for (const i of pointsToTransform(lg.path, sel.point)) {
            const [x, y] = lg.path.getPointPosition(i);
            lg.path.setPointPosition(i, x + dx, y + dy);
          }
          for (const i of sel.anchor) {
            const a = lg.anchors[i];
            if (!a) continue;
            a.x += dx;
            a.y += dy;
          }
          for (const i of sel.component) {
            const c = lg.components[i];
            if (!c) continue;
            c.transformation.translateX += dx;
            c.transformation.translateY += dy;
          }
        }
        return "Sposta selezione";
      }, this);
      return;
    }

    // W / H: ridimensiona dal punto di riferimento
    if (sel.component.length || current <= 1e-9 || value < 0) return;
    const factor = value / current;
    await this.sc.editLayersAndRecordChanges((layerGlyphs) => {
      for (const lg of Object.values(layerGlyphs)) {
        const b = selectionBoundsForGlyph(lg, sel);
        if (!b) continue;
        const r = refPoint(b, ref);
        const sx = field === "w" ? factor : 1;
        const sy = field === "h" ? factor : 1;
        for (const i of pointsToTransform(lg.path, sel.point)) {
          const [x, y] = lg.path.getPointPosition(i);
          lg.path.setPointPosition(i, r.x + (x - r.x) * sx, r.y + (y - r.y) * sy);
        }
        for (const i of sel.anchor) {
          const a = lg.anchors[i];
          if (!a) continue;
          a.x = r.x + (a.x - r.x) * sx;
          a.y = r.y + (a.y - r.y) * sy;
        }
      }
      return field === "w" ? "Cambia larghezza selezione" : "Cambia altezza selezione";
    }, this);
  }

  async commitMetrics(field, value) {
    const current = this.values[field];
    if (!Number.isFinite(current)) return;
    const delta = value - current;
    // Come nel pannello di Fontra: la differenza viene applicata a tutti i
    // master in modifica, ognuno a partire dal proprio valore.
    await this.sc.editLayersAndRecordChanges((layerGlyphs) => {
      for (const lg of Object.values(layerGlyphs)) {
        if (field === "lsb") {
          const d = Math.max(delta, -lg.xAdvance);
          lg.move(d, 0);
          lg.xAdvance += d;
        } else {
          lg.xAdvance = Math.max(0, lg.xAdvance + delta);
        }
      }
      return field === "lsb" ? "Cambia LSB" : field === "rsb" ? "Cambia RSB" : "Cambia larghezza";
    }, this);
  }

  // Kerning tra il glifo corrente e il vicino. Come lo strumento Metriche di
  // Fontra, il valore vale per il master su cui ti trovi e usa la coppia già
  // esistente (glifo o gruppo); se non c'è, quella tra i gruppi, se esistono.
  async commitKernValue(field, text, input) {
    const kc = this.kerningController;
    const ctx = this.getContext();
    if (!kc || !ctx) return false;
    const { prev, next } = this.kernInfo;
    const leftGlyph = field === "kernPrev" ? prev : ctx.glyphName;
    const rightGlyph = field === "kernPrev" ? ctx.glyphName : next;
    if (!leftGlyph || !rightGlyph) return false;

    const sourceIdentifier = this.getSourceIdentifier();
    if (!sourceIdentifier) {
      this.flashError(input, "Il kerning si modifica solo sulla posizione di un master: spostati su un master.");
      return false;
    }

    const trimmed = String(text).trim();
    let value;
    if (trimmed === "") {
      value = null; // campo vuoto = nessun kerning per questo master
    } else {
      const current = this.values[field];
      value = evaluateInput(trimmed, Number.isFinite(current) ? current : 0);
      if (value === null) {
        this.flashError(input);
        return false;
      }
      value = Math.round(value);
    }
    const current = this.values[field];
    if ((current ?? null) === value) return true;
    input.classList.remove("error");

    try {
      const tableChanges = await this.ensureKerningTable();
      const { leftName, rightName } = kc.getPairNames(leftGlyph, rightGlyph, sourceIdentifier);
      const label = `Kerning ${leftName} ${rightName}`;
      const editContext = kc.getEditContext([{ leftName, rightName, sourceIdentifier }]);
      const changes = await editContext.edit([value], label);
      this.pushUndo(ctx.glyphName, tableChanges ? tableChanges.concat(changes) : changes, label);
    } catch (e) {
      console.error("[Barra info]", e);
      this.flashError(input);
      return false;
    }
    this.scheduleUpdate();
    return true;
  }

  // Un font senza kerning non ha ancora la tabella "kern": la creiamo vuota,
  // altrimenti Fontra non riesce a salvare i gruppi.
  async ensureKerningTable() {
    const kerning = await this.fontController.getKerning();
    if (kerning?.kern) return null;
    const changes = await this.fontController.performEdit("Crea tabella di kerning", "kerning", (root) => {
      if (!root.kerning.kern) {
        root.kerning.kern = { sourceIdentifiers: [], groupsSide1: {}, groupsSide2: {}, values: {} };
      }
    });
    this.kerningController?.clearCaches();
    return changes;
  }

  // Stessa logica di Fontra (KerningController._editGroup), ma restituisce le
  // modifiche così possono finire nella cronologia di annullamento.
  async editGroup(glyphName, newGroupName, groupsProperty) {
    const changes = await this.fontController.performEdit(
      `Gruppo kerning ${newGroupName || "(nessuno)"}`,
      "kerning",
      (root) => {
        const groups = root.kerning.kern[groupsProperty];
        for (const groupName of Object.keys(groups)) {
          if (groupName === newGroupName) continue;
          const group = groups[groupName];
          if (group.includes(glyphName)) {
            groups[groupName] = group.filter((name) => name !== glyphName);
            if (!groups[groupName].length) delete groups[groupName];
          }
        }
        if (newGroupName) {
          const group = groups[newGroupName];
          if (group) {
            if (!group.includes(glyphName)) {
              const index = group.findIndex((name) => glyphName < name);
              if (index >= 0) group.splice(index, 0, glyphName);
              else group.push(glyphName);
            }
          } else {
            groups[newGroupName] = [glyphName];
          }
        }
      }
    );
    this.kerningController?.clearCaches();
    return changes;
  }

  async commitKernGroup(field, text, input) {
    const kc = this.kerningController;
    const ctx = this.getContext();
    if (!kc || !ctx) return false;
    const name = String(text).trim();
    if (name === (this.values[field] || "")) return true;
    if (name && !/^[A-Za-z0-9_.\-]+$/.test(name)) {
      this.flashError(input, "Nome di gruppo non valido: usa lettere, numeri, punto, trattino e trattino basso.");
      return false;
    }
    input.classList.remove("error");
    try {
      const tableChanges = await this.ensureKerningTable();
      // Lato sinistro del glifo = gruppi "side 2", lato destro = "side 1" (come in Fontra)
      const changes = await this.editGroup(ctx.glyphName, name, field === "kernL" ? "groupsSide2" : "groupsSide1");
      const label = `Gruppo kerning ${field === "kernL" ? "sinistro" : "destro"}`;
      this.pushUndo(ctx.glyphName, tableChanges ? tableChanges.concat(changes) : changes, label);
    } catch (e) {
      console.error("[Barra info]", e);
      this.flashError(input);
      return false;
    }
    this.scheduleUpdate();
    return true;
  }
}

// Punto d'ingresso chiamato da Fontra: module[plugin.json.function](editor, pluginPath)
export function start(editor, pluginPath) {
  if (editor.__infoBarPlugin) return;
  editor.__infoBarPlugin = new InfoBarPlugin(editor);
}
