(() => {
  "use strict";
  const Core = window.V360Core;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const ui = {};
  const state = {
    config: null,
    actual: null,
    reference: null,
    timeline: new Core.SharedTimeline(1),
    zoom: 1,
    playing: false,
    raf: 0,
    lastTick: 0,
    quality: 5,
    ready: false,
    pointers: new Map(),
    pinch: null
  };

  class Dataset {
    constructor(definition, role) {
      this.definition = definition;
      this.role = role;
      this.basePath = definition.basePath.replace(/\/$/, "");
      this.metadata = null;
      this.thumbnails = [];
      this.frames = [];
      this.frameStrings = [];
      this.quality = null;
    }

    path(file) { return `${this.basePath}/${file}`; }

    async fetchJson(file) {
      const response = await fetch(this.path(file), { cache: "no-store" });
      if (!response.ok) throw new Error(`${this.role}: ${file} returned HTTP ${response.status}`);
      return response.json();
    }

    async loadMetadata(file) {
      const data = await this.fetchJson(file);
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`${this.role}: invalid 0.json`);
      this.metadata = data;
      return data;
    }

    async loadThumbnails(file) {
      const data = await this.fetchJson(file);
      if (!Array.isArray(data)) throw new Error(`${this.role}: invalid sm.json`);
      this.thumbnails = data.filter(isJpegBase64).map(toDataUrl);
      if (!this.thumbnails.length) throw new Error(`${this.role}: sm.json has no JPEG frames`);
      return this.thumbnails;
    }

    async loadQuality(quality, qualityDef, onProgress) {
      const payload = await this.fetchJson(qualityDef.file);
      const valid = Array.isArray(payload) ? payload.filter(isJpegBase64) : [];
      if (!valid.length) throw new Error(`${this.role}: ${qualityDef.file} has no JPEG frames`);
      if (qualityDef.expectedFrames && valid.length !== qualityDef.expectedFrames) {
        throw new Error(`${this.role}: expected ${qualityDef.expectedFrames} frames in ${qualityDef.file}, found ${valid.length}`);
      }
      this.frameStrings = valid;
      this.frames = await decodeFrames(valid, onProgress);
      this.quality = quality;
      return this.frames;
    }
  }

  function isJpegBase64(value) {
    return typeof value === "string" && value.length > 100 && /^\/?9j\//.test(value.trim());
  }

  function toDataUrl(value) {
    return `data:image/jpeg;base64,${value.trim()}`;
  }

  function decodeOne(value) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("JPEG frame could not be decoded"));
      image.src = toDataUrl(value);
    });
  }

  async function decodeFrames(values, onProgress) {
    const result = new Array(values.length);
    let next = 0;
    let completed = 0;
    const workerCount = Math.min(6, values.length);
    async function worker() {
      while (true) {
        const index = next++;
        if (index >= values.length) return;
        result[index] = await decodeOne(values[index]);
        completed += 1;
        onProgress?.(completed / values.length);
      }
    }
    await Promise.all(Array.from({ length: workerCount }, worker));
    return result;
  }

  function cacheUi() {
    Object.assign(ui, {
      app: $("#app"), protocolBlocker: $("#protocolBlocker"), loading: $("#loadingOverlay"),
      loadingTitle: $("#loadingTitle"), loadingDetail: $("#loadingDetail"), progress: $("#loadProgress"),
      actualCanvas: $("#actualCanvas"), referenceCanvas: $("#referenceCanvas"),
      actualLabel: $("#actualLabel"), referenceLabel: $("#referenceLabel"),
      actualMeta: $("#actualMeta"), referenceMeta: $("#referenceMeta"),
      frameStatus: $("#frameStatus"), syncStatus: $("#syncStatus"), jsonStatus: $("#jsonStatus"),
      play: $("#playBtn"), previous: $("#previousBtn"), next: $("#nextBtn"), reverse: $("#reverseBtn"),
      zoom: $("#zoomRange"), zoomValue: $("#zoomValue"), quality: $("#qualitySelect"),
      speed: $("#speedRange"), speedValue: $("#speedValue"), reset: $("#resetBtn"), fullscreen: $("#fullscreenBtn"),
      thumbnails: $("#thumbnailStrip"), thumbMode: $("#thumbMode"),
      actualPanel: $("#actualPanel"), referencePanel: $("#referencePanel"), stage: $("#compareStage")
    });
  }

  async function boot() {
    cacheUi();
    if (location.protocol === "file:") {
      ui.protocolBlocker.hidden = false;
      ui.app.setAttribute("aria-hidden", "true");
      return;
    }
    try {
      setLoading("Reading viewer-config.json", "The page is loading configuration directly from JSON.", 0.03);
      const response = await fetch("viewer-config.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`viewer-config.json returned HTTP ${response.status}`);
      state.config = await response.json();
      state.quality = Number(state.config.defaultQuality || 5);
      state.actual = new Dataset(state.config.actual, "actual");
      state.reference = new Dataset(state.config.reference, "reference");
      document.title = state.config.title;
      ui.actualLabel.textContent = state.config.actual.label;
      ui.referenceLabel.textContent = state.config.reference.label;
      populateQualityOptions();
      bindEvents();

      setLoading("Loading JSON thumbnails", "Both sm.json files are loaded together before the scrubber is enabled.", 0.08);
      await Promise.all([
        state.actual.loadMetadata(state.config.metadataFile),
        state.reference.loadMetadata(state.config.metadataFile),
        state.actual.loadThumbnails(state.config.thumbnailFile),
        state.reference.loadThumbnails(state.config.thumbnailFile)
      ]);
      renderMetadata();
      buildThumbnails();
      updateJsonStatus();
      await changeQuality(state.quality, true);
      state.ready = true;
      ui.loading.hidden = true;
      ui.syncStatus.textContent = "Synchronized · ready";
      ui.syncStatus.classList.add("ok");
      updateControls();
      drawAll();
      window.dispatchEvent(new CustomEvent("v360ready"));
    } catch (error) {
      console.error(error);
      showFatal(error);
    }
  }

  function populateQualityOptions() {
    ui.quality.innerHTML = "";
    for (const [value, def] of Object.entries(state.config.qualities)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = `${def.label} · ${def.expectedFrames} JSON frames`;
      option.selected = Number(value) === state.quality;
      ui.quality.append(option);
    }
  }

  async function changeQuality(quality, initial = false) {
    const qualityDef = state.config.qualities[String(quality)];
    if (!qualityDef) throw new Error(`Quality ${quality} is not configured`);
    pause();
    disableInteractive(true);
    const oldCount = state.timeline.count;
    const oldFrame = state.timeline.frame;
    const normalized = oldCount > 0 ? oldFrame / oldCount : 0;
    let actualProgress = 0;
    let referenceProgress = 0;
    const update = () => {
      const combined = (actualProgress + referenceProgress) / 2;
      setLoading(
        `Loading synchronized ${qualityDef.label.toLowerCase()} JSON frames`,
        `Actual ${Math.round(actualProgress * 100)}% · Reference ${Math.round(referenceProgress * 100)}%`,
        0.22 + combined * 0.73
      );
    };
    ui.loading.hidden = false;
    update();
    await Promise.all([
      state.actual.loadQuality(quality, qualityDef, p => { actualProgress = p; update(); }),
      state.reference.loadQuality(quality, qualityDef, p => { referenceProgress = p; update(); })
    ]);
    state.quality = quality;
    const masterCount = Math.max(state.actual.frames.length, state.reference.frames.length);
    state.timeline.setCount(masterCount, false);
    state.timeline.setFrame(Math.round(normalized * masterCount));
    ui.quality.value = String(quality);
    setLoading("Finalizing synchronized viewer", "Both JSON frame banks are decoded and interaction is being unlocked.", 0.99);
    drawAll();
    updateControls();
    disableInteractive(false);
    if (!initial) {
      await delay(120);
      ui.loading.hidden = true;
    }
  }

  function setLoading(title, detail, progress) {
    ui.loadingTitle.textContent = title;
    ui.loadingDetail.textContent = detail;
    ui.progress.value = Core.clamp(progress, 0, 1);
  }

  function showFatal(error) {
    ui.loading.hidden = false;
    ui.loading.classList.add("fatal");
    ui.loadingTitle.textContent = "Viewer could not start";
    ui.loadingDetail.textContent = error?.message || String(error);
    ui.progress.value = 0;
  }

  function renderMetadata() {
    ui.actualMeta.innerHTML = metadataHtml(state.actual.metadata);
    ui.referenceMeta.innerHTML = metadataHtml(state.reference.metadata);
  }

  function metadataHtml(meta) {
    const remarks = decodeURIComponentSafe(meta.remarks || "—");
    const camera = meta.Camera || meta.visionProfile?.currentProfile?.cameraAppVersion || "—";
    const machine = meta.MachineName || meta.visionProfile?.currentProfile?.machineName || "—";
    const size = `${meta.width || "?"} × ${meta.height || "?"}`;
    return [
      ["Name", remarks], ["Machine", machine], ["Camera", camera], ["Frame size", size]
    ].map(([k, v]) => `<span><b>${escapeHtml(k)}</b>${escapeHtml(String(v))}</span>`).join("");
  }

  function decodeURIComponentSafe(value) {
    try { return decodeURIComponent(decodeURIComponent(value)); } catch { return value; }
  }

  function escapeHtml(value) {
    return value.replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  }

  function buildThumbnails() {
    ui.thumbnails.innerHTML = "";
    const count = Math.min(state.actual.thumbnails.length, state.reference.thumbnails.length);
    for (let index = 0; index < count; index += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumb-item";
      button.dataset.index = String(index);
      button.setAttribute("aria-label", `Go to angle ${index + 1} of ${count}`);
      button.innerHTML = `<span class="thumb-pair"><img alt="" src="${state.actual.thumbnails[index]}"><img alt="" src="${state.reference.thumbnails[index]}"></span><span class="thumb-number">${String(index + 1).padStart(2, "0")}</span>`;
      button.addEventListener("click", () => {
        const mapped = Core.mapIndex(index, count, state.timeline.count);
        state.timeline.setFrame(mapped);
        drawAll();
      });
      ui.thumbnails.append(button);
    }
    ui.thumbMode.textContent = `${count} synchronized angles from both sm.json files`;
  }

  function bindEvents() {
    for (const canvas of [ui.actualCanvas, ui.referenceCanvas]) {
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("dblclick", () => { state.zoom = 1; updateControls(); drawAll(); });
    }
    ui.play.addEventListener("click", () => state.playing ? pause() : play());
    ui.previous.addEventListener("click", () => { pause(); state.timeline.step(-1); drawAll(); });
    ui.next.addEventListener("click", () => { pause(); state.timeline.step(1); drawAll(); });
    ui.reverse.addEventListener("click", () => { state.timeline.reverse(); updateControls(); });
    ui.zoom.addEventListener("input", () => { state.zoom = Number(ui.zoom.value); updateControls(); drawAll(); });
    ui.speed.addEventListener("input", updateControls);
    ui.quality.addEventListener("change", () => changeQuality(Number(ui.quality.value)).catch(showFatal));
    ui.reset.addEventListener("click", () => { pause(); state.zoom = 1; state.timeline.setFrame(0); drawAll(); updateControls(); });
    ui.fullscreen.addEventListener("click", toggleFullscreen);
    window.addEventListener("resize", drawAll);
    document.addEventListener("fullscreenchange", updateControls);
    document.addEventListener("keydown", event => {
      if (!state.ready || ["INPUT", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (event.key === "ArrowLeft") { pause(); state.timeline.step(-1); drawAll(); }
      if (event.key === "ArrowRight") { pause(); state.timeline.step(1); drawAll(); }
      if (event.key === " ") { event.preventDefault(); state.playing ? pause() : play(); }
    });
  }

  function onPointerDown(event) {
    if (!state.ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startFrame: state.timeline.frame });
    if (state.pointers.size === 2) {
      const points = Array.from(state.pointers.values());
      state.pinch = { distance: distance(points[0], points[1]), zoom: state.zoom };
    }
    pause();
    ui.stage.classList.add("dragging");
  }

  function onPointerMove(event) {
    const point = state.pointers.get(event.pointerId);
    if (!point) return;
    point.x = event.clientX;
    point.y = event.clientY;
    if (state.pointers.size >= 2 && state.pinch) {
      const points = Array.from(state.pointers.values()).slice(0, 2);
      const current = Math.max(1, distance(points[0], points[1]));
      state.zoom = Core.clamp(state.pinch.zoom * (current / state.pinch.distance), 0.6, 3.2);
      updateControls();
      drawAll();
      return;
    }
    const delta = point.startX - point.x;
    state.timeline.setFrame(Core.frameFromDrag(point.startFrame, delta, state.config.dragPixelsPerFrame, state.timeline.count));
    drawAll();
  }

  function onPointerUp(event) {
    state.pointers.delete(event.pointerId);
    if (state.pointers.size < 2) state.pinch = null;
    if (!state.pointers.size) ui.stage.classList.remove("dragging");
  }

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function onWheel(event) {
    if (!state.ready) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    state.zoom = Core.clamp(state.zoom * factor, 0.6, 3.2);
    updateControls();
    drawAll();
  }

  function play() {
    if (!state.ready || state.playing) return;
    state.playing = true;
    state.lastTick = performance.now();
    updateControls();
    state.raf = requestAnimationFrame(animate);
  }

  function pause() {
    state.playing = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    updateControls();
  }

  function animate(now) {
    if (!state.playing) return;
    const fps = Number(ui.speed.value || state.config.playbackFps || 10);
    if (now - state.lastTick >= 1000 / fps) {
      state.timeline.step(1);
      state.lastTick = now;
      drawAll();
    }
    state.raf = requestAnimationFrame(animate);
  }

  function drawAll() {
    if (!state.actual?.frames.length || !state.reference?.frames.length) return;
    drawDataset(ui.actualCanvas, state.actual);
    drawDataset(ui.referenceCanvas, state.reference);
    const frame = state.timeline.frame + 1;
    const angle = Math.round((state.timeline.frame / state.timeline.count) * 360) % 360;
    ui.frameStatus.textContent = `Frame ${frame} / ${state.timeline.count} · ${angle}°`;
    updateActiveThumbnail();
    ui.actualCanvas.dataset.frame = String(Core.mapIndex(state.timeline.frame, state.timeline.count, state.actual.frames.length));
    ui.referenceCanvas.dataset.frame = String(Core.mapIndex(state.timeline.frame, state.timeline.count, state.reference.frames.length));
  }

  function drawDataset(canvas, dataset) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);
    const index = Core.mapIndex(state.timeline.frame, state.timeline.count, dataset.frames.length);
    const image = dataset.frames[index];
    if (!image) return;
    const baseScale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const scale = baseScale * state.zoom;
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  }

  function updateActiveThumbnail() {
    const buttons = $$(".thumb-item", ui.thumbnails);
    if (!buttons.length) return;
    const index = Core.mapIndex(state.timeline.frame, state.timeline.count, buttons.length);
    for (const button of buttons) button.classList.toggle("active", Number(button.dataset.index) === index);
    const active = buttons[index];
    if (active && !isMostlyVisible(active, ui.thumbnails)) active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  function isMostlyVisible(element, container) {
    const a = element.getBoundingClientRect();
    const b = container.getBoundingClientRect();
    return a.left >= b.left && a.right <= b.right;
  }

  function updateControls() {
    if (!ui.play) return;
    ui.play.textContent = state.playing ? "Pause" : "Play";
    ui.play.setAttribute("aria-pressed", String(state.playing));
    ui.reverse.classList.toggle("active", state.timeline.direction < 0);
    ui.zoom.value = String(state.zoom);
    ui.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
    ui.speedValue.textContent = `${ui.speed.value} fps`;
    ui.fullscreen.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
  }

  function updateJsonStatus() {
    ui.jsonStatus.textContent = `JSON direct · sm ${state.actual.thumbnails.length}/${state.reference.thumbnails.length}`;
    ui.jsonStatus.classList.add("ok");
  }

  function disableInteractive(disabled) {
    for (const element of [ui.play, ui.previous, ui.next, ui.reverse, ui.zoom, ui.quality, ui.speed, ui.reset]) element.disabled = disabled;
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("#viewerCard").requestFullscreen();
  }

  function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  window.__V360_APP__ = {
    state,
    getSnapshot: () => ({
      ready: state.ready,
      frame: state.timeline.frame,
      count: state.timeline.count,
      actualFrame: Number(ui.actualCanvas?.dataset.frame || 0),
      referenceFrame: Number(ui.referenceCanvas?.dataset.frame || 0),
      actualThumbs: state.actual?.thumbnails.length || 0,
      referenceThumbs: state.reference?.thumbnails.length || 0,
      quality: state.quality,
      zoom: state.zoom,
      iframeCount: document.querySelectorAll("iframe").length
    }),
    setFrame: frame => { state.timeline.setFrame(frame); drawAll(); },
    step: delta => { state.timeline.step(delta); drawAll(); },
    play, pause, drawAll
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
