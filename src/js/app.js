const state = {
  image: null,
  imageName: 'poster',
  orientation: 'vertical',
  pages: 4,
  marginMm: 5,
  sharpness: 0,
  contrast: 100,
  saturation: 100,
  resizePercent: 100,
  uploadVersion: 0,
  processedCanvas: null,
  selectedPage: 1,
  pageOffsets: [],
  pageOffsetUndo: [],
  theme: 'dark',
  drag: {
    active: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0
  },
  editorView: null
};

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_SIDE = 12000;
let renderQueued = false;

const el = {
  fileInput: document.getElementById('fileInput'),
  heroUploadBtn: document.getElementById('heroUploadBtn'),
  resetBtn: document.getElementById('resetBtn'),
  generateBtn: document.getElementById('generateBtn'),
  pagesInput: document.getElementById('pagesInput'),
  marginInput: document.getElementById('marginInput'),
  sharpnessInput: document.getElementById('sharpnessInput'),
  contrastInput: document.getElementById('contrastInput'),
  saturationInput: document.getElementById('saturationInput'),
  resizeInput: document.getElementById('resizeInput'),
  resetResizeBtn: document.getElementById('resetResizeBtn'),
  undoPageCropBtn: document.getElementById('undoPageCropBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  marginValue: document.getElementById('marginValue'),
  sharpnessValue: document.getElementById('sharpnessValue'),
  contrastValue: document.getElementById('contrastValue'),
  saturationValue: document.getElementById('saturationValue'),
  resizeValue: document.getElementById('resizeValue'),
  previewCanvas: document.getElementById('previewCanvas'),
  previewInfo: document.getElementById('previewInfo'),
  processingInfo: document.getElementById('processingInfo'),
  pageSelector: document.getElementById('pageSelector'),
  pageEditorCanvas: document.getElementById('pageEditorCanvas'),
  pageEditorInfo: document.getElementById('pageEditorInfo'),
  pageThumbs: document.getElementById('pageThumbs'),
  runtimeAlert: document.getElementById('runtimeAlert'),
  orientationBtns: [...document.querySelectorAll('.orientation-btn')]
};

const previewCtx = el.previewCanvas.getContext('2d', { willReadFrequently: true });
const pageEditorCtx = el.pageEditorCanvas?.getContext('2d', { willReadFrequently: true });

function showRuntimeAlert(message) {
  if (!el.runtimeAlert) return;
  el.runtimeAlert.textContent = message;
  el.runtimeAlert.classList.remove('hidden');
}

function hideRuntimeAlert() {
  if (!el.runtimeAlert) return;
  el.runtimeAlert.textContent = '';
  el.runtimeAlert.classList.add('hidden');
}

async function notify(payload) {
  if (typeof Swal !== 'undefined') {
    return Swal.fire(payload);
  }
  const fallback = payload?.text || payload?.title || 'Aviso';
  window.alert(fallback);
  return null;
}

async function openExportFormatPicker(defaultFormat = 'pdf') {
  if (typeof Swal === 'undefined') {
    return { isConfirmed: false, format: null };
  }

  const formatMeta = {
    jpg: {
      icon: '🖼️',
      title: 'JPG',
      subtitle: 'Mais leve e rápido'
    },
    png: {
      icon: '🎨',
      title: 'PNG',
      subtitle: 'Qualidade máxima'
    },
    pdf: {
      icon: '📄',
      title: 'PDF',
      subtitle: 'Ideal para impressão'
    }
  };

  let selected = formatMeta[defaultFormat] ? defaultFormat : 'pdf';
  const formats = ['jpg', 'png', 'pdf'];
  const optionsHtml = formats
    .map((format) => {
      const item = formatMeta[format];
      return `
        <button type="button" class="swal-export-option" data-format="${format}" aria-pressed="false">
          <span class="swal-export-option-icon" aria-hidden="true">${item.icon}</span>
          <span class="swal-export-option-copy">
            <strong>${item.title}</strong>
            <small>${item.subtitle}</small>
          </span>
        </button>
      `;
    })
    .join('');

  const { isConfirmed, value } = await Swal.fire({
    title: 'Escolha o formato de saída',
    html: `
      <div class="swal-export-options" role="radiogroup" aria-label="Formato de saída">
        ${optionsHtml}
      </div>
      <input id="swalExportSelected" type="hidden" value="${selected}">
    `,
    confirmButtonText: 'Gerar e baixar .zip',
    cancelButtonText: 'Cancelar',
    showCancelButton: true,
    customClass: {
      popup: 'swal-export-popup',
      title: 'swal-export-title',
      htmlContainer: 'swal-export-text',
      confirmButton: 'swal-export-confirm',
      cancelButton: 'swal-export-cancel'
    },
    buttonsStyling: false,
    background: '#0f172a',
    color: '#e2e8f0',
    didOpen: (popup) => {
      const hidden = popup.querySelector('#swalExportSelected');
      const optionButtons = [...popup.querySelectorAll('.swal-export-option')];

      const syncSelectedState = (next) => {
        selected = next;
        if (hidden) hidden.value = next;
        optionButtons.forEach((btn) => {
          const active = btn.dataset.format === next;
          btn.classList.toggle('swal-export-option-active', active);
          btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      };

      optionButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const format = btn.dataset.format;
          if (!formatMeta[format]) return;
          syncSelectedState(format);
        });
      });

      syncSelectedState(selected);
    },
    preConfirm: () => {
      const popup = Swal.getPopup();
      const format = popup?.querySelector('#swalExportSelected')?.value;
      if (!format || !formatMeta[format]) {
        Swal.showValidationMessage('Selecione um formato para continuar.');
        return false;
      }
      return format;
    }
  });

  return {
    isConfirmed,
    format: value || null
  };
}

function isLibraryAvailable() {
  return {
    swal: typeof Swal !== 'undefined',
    zip: typeof JSZip !== 'undefined',
    pdf: Boolean(window.jspdf && window.jspdf.jsPDF)
  };
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  window.requestAnimationFrame(() => {
    renderQueued = false;
    renderAll();
  });
}

function updateProcessingInfo() {
  if (!el.processingInfo) return;
  const parts = [];
  if (state.sharpness > 0) parts.push(`nitidez ${state.sharpness}`);
  if (state.contrast !== 100) parts.push(`contraste ${state.contrast}%`);
  if (state.saturation !== 100) parts.push(`saturação ${state.saturation}%`);
  if (state.resizePercent !== 100) parts.push(`redimensionamento ${state.resizePercent}%`);
  parts.push(`orientação ${state.orientation}`);
  parts.push(`margem ${state.marginMm}mm`);
  el.processingInfo.textContent = `Filtros ativos: ${parts.join(' | ')}`;
}

function mmToPx(mm, dpi = 96) {
  return Math.round((mm * dpi) / 25.4);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function ensurePageOffsets() {
  const next = [];
  const undoNext = [];
  for (let i = 0; i < state.pages; i++) {
    const current = state.pageOffsets[i] || { x: 0, y: 0 };
    const currentUndo = state.pageOffsetUndo[i] || null;
    next.push({ x: Number(current.x) || 0, y: Number(current.y) || 0 });
    undoNext.push(currentUndo ? { x: Number(currentUndo.x) || 0, y: Number(currentUndo.y) || 0 } : null);
  }
  state.pageOffsets = next;
  state.pageOffsetUndo = undoNext;
  if (state.selectedPage > state.pages) {
    state.selectedPage = state.pages;
  }
  if (state.selectedPage < 1) {
    state.selectedPage = 1;
  }
}

function applyTheme(theme) {
  state.theme = theme === 'light' ? 'light' : 'dark';
  document.body.classList.toggle('theme-light', state.theme === 'light');
  try {
    localStorage.setItem('myp-theme', state.theme);
  } catch {
    // ignore storage failure
  }
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

function undoCurrentPageCrop() {
  if (!state.image) return;
  const idx = state.selectedPage - 1;
  const previous = state.pageOffsetUndo[idx];

  if (!previous) {
    notify({
      icon: 'info',
      title: 'Nada para desfazer',
      text: `A página ${state.selectedPage} ainda não possui histórico de ajuste.`
    });
    return;
  }

  const current = state.pageOffsets[idx] || { x: 0, y: 0 };
  state.pageOffsets[idx] = { x: previous.x, y: previous.y };
  state.pageOffsetUndo[idx] = { x: current.x, y: current.y };
  queueRender();
}

function updateValueBadges() {
  el.marginValue.textContent = String(state.marginMm);
  el.sharpnessValue.textContent = String(state.sharpness);
  el.contrastValue.textContent = `${state.contrast}%`;
  el.saturationValue.textContent = `${state.saturation}%`;
  el.resizeValue.textContent = `${state.resizePercent}%`;
}

function syncInputsFromState() {
  el.pagesInput.value = String(state.pages);
  el.marginInput.value = String(state.marginMm);
  el.sharpnessInput.value = String(state.sharpness);
  el.contrastInput.value = String(state.contrast);
  el.saturationInput.value = String(state.saturation);
  el.resizeInput.value = String(state.resizePercent);
  updateValueBadges();
  updateOrientationButtons();
}

function updateOrientationButtons() {
  el.orientationBtns.forEach((btn) => {
    const active = btn.dataset.orientation === state.orientation;
    btn.classList.toggle('bg-neon/30', active);
    btn.classList.toggle('bg-white/5', !active);
  });
}

function drawPlaceholder() {
  const c = el.previewCanvas;
  const dpr = window.devicePixelRatio || 1;
  const cssW = c.clientWidth || 800;
  const cssH = c.clientHeight || 320;

  c.width = Math.floor(cssW * dpr);
  c.height = Math.floor(cssH * dpr);
  previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  previewCtx.clearRect(0, 0, cssW, cssH);
  const grad = previewCtx.createLinearGradient(0, 0, cssW, cssH);
  grad.addColorStop(0, '#111827');
  grad.addColorStop(1, '#020617');
  previewCtx.fillStyle = grad;
  previewCtx.fillRect(0, 0, cssW, cssH);

  previewCtx.strokeStyle = 'rgba(148,163,184,.25)';
  previewCtx.lineWidth = 2;
  previewCtx.strokeRect(24, 24, cssW - 48, cssH - 48);

  previewCtx.fillStyle = 'rgba(148,163,184,.85)';
  previewCtx.font = '600 14px Inter,system-ui,sans-serif';
  previewCtx.textAlign = 'center';
  previewCtx.fillText('Pré-visualização do poster aparecerá aqui', cssW / 2, cssH / 2);
}

function buildProcessedCanvas() {
  if (!state.image) return null;

  try {
    const scale = state.resizePercent / 100;
    const w = Math.max(10, Math.round(state.image.width * scale));
    const h = Math.max(10, Math.round(state.image.height * scale));

    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const ctx = base.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Falha ao inicializar o contexto de desenho da imagem.');
    }

    ctx.filter = `contrast(${state.contrast}%) saturate(${state.saturation}%)`;
    ctx.drawImage(state.image, 0, 0, w, h);
    ctx.filter = 'none';

    if (state.sharpness > 0) {
      applySharpness(base, state.sharpness / 100);
    }

    const oriented = applyOrientation(base, state.orientation);
    state.processedCanvas = oriented;
    return oriented;
  } catch (error) {
    throw new Error(error?.message || 'Erro ao processar a imagem para pré-visualização.');
  }
}

function applyOrientation(canvas, orientation) {
  const portraitLike = canvas.height >= canvas.width;
  const needsRotate =
    (orientation === 'vertical' && !portraitLike) ||
    (orientation === 'horizontal' && portraitLike);

  if (!needsRotate) return canvas;

  const out = document.createElement('canvas');
  out.width = canvas.height;
  out.height = canvas.width;
  const ctx = out.getContext('2d');
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

function applySharpness(canvas, amount) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const src = ctx.getImageData(0, 0, width, height);
  const out = ctx.createImageData(width, height);

  const weight = 1 + amount * 2;
  const side = -amount * 0.5;
  const k = [0, side, 0, side, weight, side, 0, side, 0];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let ch = 0; ch < 3; ch++) {
        let sum = 0;
        let i = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + ch;
            sum += src.data[idx] * k[i++];
          }
        }
        const outIdx = (y * width + x) * 4 + ch;
        out.data[outIdx] = Math.min(255, Math.max(0, sum));
      }
      const alphaIdx = (y * width + x) * 4 + 3;
      out.data[alphaIdx] = src.data[alphaIdx];
    }
  }

  for (let i = 3; i < out.data.length; i += 4) {
    if (out.data[i] === 0) out.data[i] = src.data[i];
  }

  ctx.putImageData(out, 0, 0);
}

function computeGrid(totalPages, orientation) {
  let best = { rows: 1, cols: totalPages, score: Number.POSITIVE_INFINITY };

  for (let rows = 1; rows <= totalPages; rows++) {
    if (totalPages % rows !== 0) continue;
    const cols = totalPages / rows;

    const valid =
      (orientation === 'vertical' && rows >= cols) ||
      (orientation === 'horizontal' && cols >= rows);

    const ratioPenalty = valid ? 0 : 2;
    const shapePenalty = Math.abs(rows - cols);
    const score = ratioPenalty + shapePenalty;

    if (score < best.score) {
      best = { rows, cols, score };
    }
  }

  return { rows: best.rows, cols: best.cols };
}

function buildPageDefinitions(processed) {
  const { rows, cols } = computeGrid(state.pages, state.orientation);
  const pieceW = Math.floor(processed.width / cols);
  const pieceH = Math.floor(processed.height / rows);

  const defs = [];
  let pageIndex = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const baseX = c * pieceW;
      const baseY = r * pieceH;
      const width = c === cols - 1 ? processed.width - baseX : pieceW;
      const height = r === rows - 1 ? processed.height - baseY : pieceH;

      defs.push({
        index: pageIndex++,
        row: r,
        col: c,
        baseX,
        baseY,
        width,
        height,
        minOffsetX: -baseX,
        maxOffsetX: processed.width - width - baseX,
        minOffsetY: -baseY,
        maxOffsetY: processed.height - height - baseY
      });
    }
  }

  return defs;
}

function getAppliedOffset(def) {
  const raw = state.pageOffsets[def.index - 1] || { x: 0, y: 0 };
  return {
    x: clamp(Math.round(raw.x), def.minOffsetX, def.maxOffsetX),
    y: clamp(Math.round(raw.y), def.minOffsetY, def.maxOffsetY)
  };
}

function sourceRectFromDef(def) {
  const offset = getAppliedOffset(def);
  return {
    sx: def.baseX + offset.x,
    sy: def.baseY + offset.y,
    sw: def.width,
    sh: def.height,
    offset
  };
}

function renderPreview() {
  try {
    const c = el.previewCanvas;
    const dpr = window.devicePixelRatio || 1;
    const cssW = c.clientWidth || 800;
    const cssH = c.clientHeight || 320;

    c.width = Math.floor(cssW * dpr);
    c.height = Math.floor(cssH * dpr);
    previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    previewCtx.clearRect(0, 0, cssW, cssH);

    if (!state.image) {
      drawPlaceholder();
      updateProcessingInfo();
      return;
    }

    const processed = buildProcessedCanvas();
    if (!processed) return;

    previewCtx.fillStyle = '#020617';
    previewCtx.fillRect(0, 0, cssW, cssH);

    const pad = 14;
    const areaW = cssW - pad * 2;
    const areaH = cssH - pad * 2;
    const imageRatio = processed.width / processed.height;
    const areaRatio = areaW / areaH;

    let drawW;
    let drawH;
    if (imageRatio > areaRatio) {
      drawW = areaW;
      drawH = drawW / imageRatio;
    } else {
      drawH = areaH;
      drawW = drawH * imageRatio;
    }

    const dx = (cssW - drawW) / 2;
    const dy = (cssH - drawH) / 2;

    previewCtx.drawImage(processed, dx, dy, drawW, drawH);

    const { rows, cols } = computeGrid(state.pages, state.orientation);
    previewCtx.strokeStyle = 'rgba(6,182,212,.9)';
    previewCtx.lineWidth = 1.5;

    for (let i = 1; i < cols; i++) {
      const x = dx + (drawW / cols) * i;
      previewCtx.beginPath();
      previewCtx.moveTo(x, dy);
      previewCtx.lineTo(x, dy + drawH);
      previewCtx.stroke();
    }
    for (let i = 1; i < rows; i++) {
      const y = dy + (drawH / rows) * i;
      previewCtx.beginPath();
      previewCtx.moveTo(dx, y);
      previewCtx.lineTo(dx + drawW, y);
      previewCtx.stroke();
    }

    el.previewInfo.textContent = `${processed.width}x${processed.height}px | ${rows} x ${cols} = ${state.pages} páginas | margem ${state.marginMm}mm`;
    updateProcessingInfo();
  } catch (error) {
    el.previewInfo.textContent = `Erro de renderização: ${error?.message || 'falha inesperada'}`;
  }
}

function renderPageSelector(defs) {
  if (!el.pageSelector) return;
  el.pageSelector.innerHTML = '';

  defs.forEach((def) => {
    const btn = document.createElement('button');
    const active = def.index === state.selectedPage;
    btn.type = 'button';
    btn.textContent = `P${def.index}`;
    btn.className = `rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
      active
        ? 'border-cyan/70 bg-cyan/25 text-cyan-100'
        : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
    }`;
    btn.addEventListener('click', () => {
      state.selectedPage = def.index;
      queueRender();
    });
    el.pageSelector.appendChild(btn);
  });
}

function renderPageEditor(processed, defs) {
  if (!el.pageEditorCanvas || !pageEditorCtx) return;

  const selected = defs.find((d) => d.index === state.selectedPage) || defs[0];
  if (!selected) return;

  const c = el.pageEditorCanvas;
  const dpr = window.devicePixelRatio || 1;
  const cssW = c.clientWidth || 600;
  const cssH = c.clientHeight || 210;

  c.width = Math.floor(cssW * dpr);
  c.height = Math.floor(cssH * dpr);
  pageEditorCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pageEditorCtx.clearRect(0, 0, cssW, cssH);

  const rect = sourceRectFromDef(selected);
  const ratio = rect.sw / rect.sh;
  let drawW = cssW - 22;
  let drawH = drawW / ratio;
  if (drawH > cssH - 22) {
    drawH = cssH - 22;
    drawW = drawH * ratio;
  }

  const dx = (cssW - drawW) / 2;
  const dy = (cssH - drawH) / 2;

  pageEditorCtx.fillStyle = '#020617';
  pageEditorCtx.fillRect(0, 0, cssW, cssH);
  pageEditorCtx.drawImage(processed, rect.sx, rect.sy, rect.sw, rect.sh, dx, dy, drawW, drawH);

  pageEditorCtx.strokeStyle = 'rgba(6,182,212,.95)';
  pageEditorCtx.lineWidth = 2;
  pageEditorCtx.strokeRect(dx, dy, drawW, drawH);

  pageEditorCtx.fillStyle = 'rgba(8,11,24,.85)';
  pageEditorCtx.fillRect(dx + 8, dy + 8, Math.min(230, drawW - 16), 22);
  pageEditorCtx.fillStyle = '#cbd5e1';
  pageEditorCtx.font = '600 11px Inter,system-ui,sans-serif';
  pageEditorCtx.fillText(`Página ${selected.index} • Arraste para reposicionar`, dx + 14, dy + 23);

  if (el.pageEditorInfo) {
    el.pageEditorInfo.textContent = `Página ${selected.index}: deslocamento X ${rect.offset.x}px | Y ${rect.offset.y}px`;
  }

  state.editorView = {
    pageIndex: selected.index,
    drawX: dx,
    drawY: dy,
    drawW,
    drawH,
    cropW: rect.sw,
    cropH: rect.sh,
    limits: {
      minX: selected.minOffsetX,
      maxX: selected.maxOffsetX,
      minY: selected.minOffsetY,
      maxY: selected.maxOffsetY
    }
  };
}

function renderPageThumbs(processed, defs) {
  if (!el.pageThumbs) return;
  el.pageThumbs.innerHTML = '';

  defs.forEach((def) => {
    const rect = sourceRectFromDef(def);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `overflow-hidden rounded-lg border text-left transition ${
      def.index === state.selectedPage
        ? 'border-cyan/70 bg-cyan/10'
        : 'border-white/10 bg-white/5 hover:bg-white/10'
    }`;
    card.addEventListener('click', () => {
      state.selectedPage = def.index;
      queueRender();
    });

    const mini = document.createElement('canvas');
    mini.width = 180;
    mini.height = 110;
    mini.className = 'h-20 w-full bg-slate-950';
    const mctx = mini.getContext('2d');
    if (mctx) {
      mctx.fillStyle = '#020617';
      mctx.fillRect(0, 0, mini.width, mini.height);

      const ratio = rect.sw / rect.sh;
      let dw = mini.width;
      let dh = dw / ratio;
      if (dh > mini.height) {
        dh = mini.height;
        dw = dh * ratio;
      }
      const x = (mini.width - dw) / 2;
      const y = (mini.height - dh) / 2;
      mctx.drawImage(processed, rect.sx, rect.sy, rect.sw, rect.sh, x, y, dw, dh);
    }

    const label = document.createElement('div');
    label.className = 'px-2 py-1 text-[11px] text-slate-300';
    label.textContent = `P${def.index} • x:${rect.offset.x} y:${rect.offset.y}`;

    card.appendChild(mini);
    card.appendChild(label);
    el.pageThumbs.appendChild(card);
  });
}

function renderAll() {
  renderPreview();

  if (!state.image) {
    if (el.pageSelector) el.pageSelector.innerHTML = '';
    if (el.pageThumbs) el.pageThumbs.innerHTML = '';
    if (el.pageEditorInfo) {
      el.pageEditorInfo.textContent = 'Selecione uma página e arraste para reposicionar o crop.';
    }
    if (el.pageEditorCanvas && pageEditorCtx) {
      const c = el.pageEditorCanvas;
      const dpr = window.devicePixelRatio || 1;
      const cssW = c.clientWidth || 600;
      const cssH = c.clientHeight || 210;
      c.width = Math.floor(cssW * dpr);
      c.height = Math.floor(cssH * dpr);
      pageEditorCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pageEditorCtx.clearRect(0, 0, cssW, cssH);
      pageEditorCtx.fillStyle = '#020617';
      pageEditorCtx.fillRect(0, 0, cssW, cssH);
      pageEditorCtx.fillStyle = 'rgba(148,163,184,.85)';
      pageEditorCtx.font = '600 13px Inter,system-ui,sans-serif';
      pageEditorCtx.textAlign = 'center';
      pageEditorCtx.fillText('Sem imagem carregada', cssW / 2, cssH / 2);
    }
    return;
  }

  const processed = state.processedCanvas || buildProcessedCanvas();
  if (!processed) return;

  ensurePageOffsets();
  const defs = buildPageDefinitions(processed);
  renderPageSelector(defs);
  renderPageEditor(processed, defs);
  renderPageThumbs(processed, defs);
}

function splitIntoPages() {
  const processed = buildProcessedCanvas();
  if (!processed) {
    throw new Error('Envie uma imagem antes de gerar o poster.');
  }
  ensurePageOffsets();
  const defs = buildPageDefinitions(processed);

  const margin = mmToPx(state.marginMm);
  const output = [];

  defs.forEach((def) => {
    const rect = sourceRectFromDef(def);
    const page = document.createElement('canvas');
    page.width = rect.sw + margin * 2;
    page.height = rect.sh + margin * 2;
    const ctx = page.getContext('2d');
    if (!ctx) {
      throw new Error('Falha ao criar contexto para renderizar página do poster.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, page.width, page.height);
    ctx.drawImage(processed, rect.sx, rect.sy, rect.sw, rect.sh, margin, margin, rect.sw, rect.sh);

    output.push({
      index: def.index,
      canvas: page
    });
  });

  return output;
}

async function canvasToBlob(canvas, mimeType, quality = 0.95) {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Não foi possível converter a página.'));
      resolve(blob);
    }, mimeType, quality);
  });
}

async function exportZip(format) {
  if (!window.JSZip) {
    throw new Error('Biblioteca de compactação não carregada.');
  }

  const isPng = format === 'png';
  const pages = splitIntoPages();
  const zip = new JSZip();
  const cleanName = state.imageName.replace(/\.[^/.]+$/, '').replace(/\s+/g, '-').toLowerCase();

  if (format === 'pdf') {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) throw new Error('Biblioteca de PDF não carregada.');

    const pdfOrientation = state.orientation === 'vertical' ? 'p' : 'l';
    const pdf = new jsPDF({ orientation: pdfOrientation, unit: 'mm', format: 'a4' });

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i].canvas;
      const imgData = p.toDataURL('image/jpeg', 0.95);
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const ratio = p.width / p.height;
      let drawW = pageW;
      let drawH = drawW / ratio;
      if (drawH > pageH) {
        drawH = pageH;
        drawW = drawH * ratio;
      }
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', x, y, drawW, drawH);
    }

    const pdfBlob = pdf.output('blob');
    if (!pdfBlob) {
      throw new Error('Falha ao criar o arquivo PDF.');
    }
    zip.file(`${cleanName}-poster.pdf`, pdfBlob);
  } else {
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpg' ? 'jpg' : 'png';

    const blobs = await Promise.all(
      pages.map(async (page) => ({
        index: page.index,
        blob: await canvasToBlob(page.canvas, mime, format === 'jpg' ? 0.92 : 0.95)
      }))
    );

    blobs.forEach(({ index, blob }) => {
      zip.file(`${cleanName}-page-${String(index).padStart(2, '0')}.${ext}`, blob, {
        compression: isPng ? 'STORE' : 'DEFLATE'
      });
    });
  }

  const zipBlob = await zip.generateAsync(
    isPng
      ? { type: 'blob', compression: 'STORE' }
      : { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }
  );
  if (!zipBlob || !zipBlob.size) {
    throw new Error('Falha ao compactar os arquivos do poster.');
  }
  const fileName = `${cleanName || 'make-your-poster'}-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function handleGenerate() {
  if (!state.image) {
    await notify({ icon: 'warning', title: 'Nenhuma imagem', text: 'Faça upload de uma imagem JPG ou PNG primeiro.' });
    return;
  }

  const libs = isLibraryAvailable();
  if (!libs.swal || !libs.zip) {
    showRuntimeAlert('Dependências externas indisponíveis no momento. Recarregue a página para tentar novamente.');
    return;
  }

  const { isConfirmed, format } = await openExportFormatPicker('pdf');

  if (!isConfirmed || !format) return;

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'Gerando poster...',
      text: format === 'png'
        ? 'PNG pode levar mais tempo; estamos acelerando a compactação.'
        : 'Processando imagem e compactando arquivos.',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
      background: '#0f172a',
      color: '#e2e8f0'
    });
  }

  try {
    if (format === 'pdf' && !libs.pdf) {
      throw new Error('Formato PDF temporariamente indisponível.');
    }
    await exportZip(format);
    if (typeof Swal !== 'undefined' && Swal.isVisible()) {
      Swal.close();
    }
    await notify({
      icon: 'success',
      title: 'Download pronto!',
      text: 'Seu poster foi gerado e baixado em formato compactado.',
      background: '#0f172a',
      color: '#e2e8f0'
    });
  } catch (error) {
    if (typeof Swal !== 'undefined' && Swal.isVisible()) {
      Swal.close();
    }
    await notify({
      icon: 'error',
      title: 'Falha ao gerar poster',
      text: error.message || 'Ocorreu um erro inesperado.',
      background: '#0f172a',
      color: '#e2e8f0'
    });
  }
}

async function handleUploadChange(event) {
  try {
    const file = event.target.files?.[0];
    if (!file) return;

    const requestVersion = ++state.uploadVersion;

    const validTypes = ['image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      await notify({ icon: 'error', title: 'Formato inválido', text: 'Use somente arquivos JPG ou PNG.' });
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      await notify({
        icon: 'error',
        title: 'Arquivo muito grande',
        text: 'Use uma imagem de até 25MB para evitar travamentos no navegador.'
      });
      event.target.value = '';
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      if (requestVersion !== state.uploadVersion) {
        URL.revokeObjectURL(url);
        return;
      }

      if (img.width > MAX_IMAGE_SIDE || img.height > MAX_IMAGE_SIDE) {
        URL.revokeObjectURL(url);
        event.target.value = '';
        await notify({
          icon: 'error',
          title: 'Dimensão excessiva',
          text: `Use imagens de até ${MAX_IMAGE_SIDE}px no maior lado.`
        });
        return;
      }

      state.image = img;
      state.imageName = file.name || 'poster';
      hideRuntimeAlert();
      ensurePageOffsets();
      renderAll();
      await notify({
        icon: 'success',
        title: 'Imagem carregada',
        text: `Dimensões: ${img.width}x${img.height}px`,
        timer: 1300,
        showConfirmButton: false,
        background: '#0f172a',
        color: '#e2e8f0'
      });
      URL.revokeObjectURL(url);
    };
    img.onerror = async () => {
      if (requestVersion !== state.uploadVersion) {
        URL.revokeObjectURL(url);
        return;
      }
      URL.revokeObjectURL(url);
      await notify({ icon: 'error', title: 'Falha no upload', text: 'Não foi possível abrir esta imagem.' });
    };
    img.src = url;
  } catch (error) {
    await notify({
      icon: 'error',
      title: 'Erro ao carregar arquivo',
      text: error?.message || 'Erro inesperado no upload.'
    });
  }
}

function resetAll() {
  state.uploadVersion += 1;
  state.image = null;
  state.imageName = 'poster';
  state.orientation = 'vertical';
  state.pages = 4;
  state.marginMm = 5;
  state.sharpness = 0;
  state.contrast = 100;
  state.saturation = 100;
  state.resizePercent = 100;
  state.processedCanvas = null;
  state.selectedPage = 1;
  state.pageOffsets = [];
  state.pageOffsetUndo = [];
  state.editorView = null;
  state.drag.active = false;

  el.fileInput.value = '';
  syncInputsFromState();
  renderAll();
}

function bindEvents() {
  const triggerUpload = () => el.fileInput.click();
  el.heroUploadBtn.addEventListener('click', triggerUpload);

  el.fileInput.addEventListener('change', handleUploadChange);
  el.resetBtn.addEventListener('click', resetAll);
  el.generateBtn.addEventListener('click', handleGenerate);
  el.undoPageCropBtn?.addEventListener('click', undoCurrentPageCrop);
  el.themeToggleBtn?.addEventListener('click', toggleTheme);

  el.pagesInput.addEventListener('input', () => {
    const value = Number(el.pagesInput.value);
    state.pages = Number.isFinite(value) ? Math.min(6, Math.max(1, Math.round(value))) : 1;
    ensurePageOffsets();
    el.pagesInput.value = String(state.pages);
    queueRender();
  });

  el.marginInput.addEventListener('input', () => {
    state.marginMm = Number(el.marginInput.value);
    updateValueBadges();
    queueRender();
  });

  el.sharpnessInput.addEventListener('input', () => {
    state.sharpness = Number(el.sharpnessInput.value);
    updateValueBadges();
    queueRender();
  });

  el.contrastInput.addEventListener('input', () => {
    state.contrast = Number(el.contrastInput.value);
    updateValueBadges();
    queueRender();
  });

  el.saturationInput.addEventListener('input', () => {
    state.saturation = Number(el.saturationInput.value);
    updateValueBadges();
    queueRender();
  });

  el.resizeInput.addEventListener('input', () => {
    state.resizePercent = Number(el.resizeInput.value);
    updateValueBadges();
    queueRender();
  });

  if (el.resetResizeBtn) {
    el.resetResizeBtn.addEventListener('click', () => {
      state.resizePercent = 100;
      el.resizeInput.value = '100';
      updateValueBadges();
      queueRender();
    });
  }

  el.orientationBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.orientation = btn.dataset.orientation === 'horizontal' ? 'horizontal' : 'vertical';
      updateOrientationButtons();
      queueRender();
    });
  });

  window.addEventListener('resize', queueRender);

  if (el.pageEditorCanvas) {
    const getLocalPoint = (event) => {
      const rect = el.pageEditorCanvas.getBoundingClientRect();
      const src = event.touches?.[0] || event;
      return {
        x: src.clientX - rect.left,
        y: src.clientY - rect.top
      };
    };

    const onDragStart = (event) => {
      if (!state.image || !state.editorView) return;
      const p = getLocalPoint(event);
      const v = state.editorView;
      const inside = p.x >= v.drawX && p.x <= v.drawX + v.drawW && p.y >= v.drawY && p.y <= v.drawY + v.drawH;
      if (!inside) return;

      event.preventDefault();
      const offset = state.pageOffsets[v.pageIndex - 1] || { x: 0, y: 0 };
      state.pageOffsetUndo[v.pageIndex - 1] = { x: offset.x, y: offset.y };
      state.drag.active = true;
      state.drag.startX = p.x;
      state.drag.startY = p.y;
      state.drag.startOffsetX = offset.x;
      state.drag.startOffsetY = offset.y;
    };

    const onDragMove = (event) => {
      if (!state.drag.active || !state.editorView) return;
      event.preventDefault();

      const p = getLocalPoint(event);
      const v = state.editorView;
      const srcPerCanvasX = v.cropW / v.drawW;
      const srcPerCanvasY = v.cropH / v.drawH;

      const dx = (p.x - state.drag.startX) * srcPerCanvasX;
      const dy = (p.y - state.drag.startY) * srcPerCanvasY;

      const index = v.pageIndex - 1;
      if (!state.pageOffsets[index]) state.pageOffsets[index] = { x: 0, y: 0 };

      state.pageOffsets[index].x = clamp(
        Math.round(state.drag.startOffsetX - dx),
        v.limits.minX,
        v.limits.maxX
      );
      state.pageOffsets[index].y = clamp(
        Math.round(state.drag.startOffsetY - dy),
        v.limits.minY,
        v.limits.maxY
      );

      queueRender();
    };

    const onDragEnd = () => {
      state.drag.active = false;
    };

    el.pageEditorCanvas.addEventListener('mousedown', onDragStart);
    el.pageEditorCanvas.addEventListener('touchstart', onDragStart, { passive: false });
    window.addEventListener('mousemove', onDragMove, { passive: false });
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchend', onDragEnd);
  }
}

(function init() {
  const customStyle = document.createElement('style');
  customStyle.textContent = `
    .swal-export-popup {
      border: 1px solid rgba(148,163,184,.35);
      border-radius: 20px;
      box-shadow: 0 20px 45px rgba(2,8,23,.45);
    }
    .swal-export-title {
      font-weight: 800;
      letter-spacing: .2px;
    }
    .swal-export-text {
      color: #cbd5e1;
      font-size: 13px;
    }
    .swal2-popup.swal-export-popup .swal2-html-container {
      margin: 14px 0 12px;
    }
    .swal-export-options {
      display: grid !important;
      gap: 10px;
    }
    .swal-export-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,.28);
      background: linear-gradient(180deg, rgba(30,41,59,.6), rgba(15,23,42,.85));
      color: #e2e8f0;
      text-align: left;
      transition: transform .16s ease, border-color .2s ease, box-shadow .2s ease, background .2s ease;
      cursor: pointer;
    }
    .swal-export-option:hover {
      transform: translateY(-1px);
      border-color: rgba(34,211,238,.55);
      background: linear-gradient(180deg, rgba(30,41,59,.78), rgba(15,23,42,.95));
    }
    .swal-export-option:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px rgba(15,23,42,.95), 0 0 0 4px rgba(34,211,238,.6);
    }
    .swal-export-option.swal-export-option-active {
      border-color: rgba(56,189,248,.95);
      background: linear-gradient(180deg, rgba(6,182,212,.2), rgba(15,23,42,.95));
      box-shadow: inset 0 0 0 1px rgba(56,189,248,.45), 0 10px 22px rgba(2,8,23,.45);
    }
    .swal-export-option-icon {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,.08);
      flex: 0 0 28px;
      font-size: 15px;
    }
    .swal-export-option-copy {
      display: flex;
      flex-direction: column;
      gap: 1px;
      line-height: 1.15;
    }
    .swal-export-option-copy strong {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: .2px;
      color: #f8fafc;
    }
    .swal-export-option-copy small {
      font-size: 12px;
      color: #cbd5e1;
    }
    .swal-export-confirm {
      border: none;
      border-radius: 12px;
      padding: 10px 14px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(90deg,#7c3aed,#f43f5e);
    }
    .swal-export-cancel {
      border: 1px solid rgba(148,163,184,.35);
      border-radius: 12px;
      padding: 10px 14px;
      font-weight: 700;
      color: #e2e8f0;
      background: rgba(15,23,42,.6);
    }
    @media (max-width: 520px) {
      .swal-export-option {
        padding: 11px 12px;
      }
      .swal-export-option-copy strong {
        font-size: 13px;
      }
      .swal-export-option-copy small {
        font-size: 11px;
      }
    }
  `;
  document.head.appendChild(customStyle);

  try {
    const savedTheme = localStorage.getItem('myp-theme');
    applyTheme(savedTheme || 'dark');
  } catch {
    applyTheme('dark');
  }

  const libs = isLibraryAvailable();
  if (!libs.swal) {
    showRuntimeAlert('SweetAlert2 indisponível: mensagens serão exibidas com alerta simples do navegador.');
  }
  if (!libs.zip) {
    showRuntimeAlert('JSZip indisponível: geração de arquivos compactados está desativada até recarregar a página.');
    el.generateBtn.disabled = true;
    el.generateBtn.classList.add('cursor-not-allowed', 'opacity-60');
  }

  ensurePageOffsets();
  syncInputsFromState();
  bindEvents();
  renderAll();
})();
