/* ===========================================================================
   Screenshot stitcher
   - "auto"  : detect the overlapping region between consecutive screenshots
               (as produced by scrolling + repeated screenshots) and merge
               them seamlessly.
   - "stack" : just place the images top-to-bottom, with an optional gap and
               background colour.
   Everything runs client-side on <canvas>; nothing is uploaded.
=========================================================================== */
(() => {
  "use strict";

  // ---- state -------------------------------------------------------------
  /** @type {{id:number,name:string,url:string,img:HTMLImageElement,w:number,h:number}[]} */
  let items = [];
  let mode = "auto";
  let seq = 0;
  let resultBlob = null;

  // ---- elements ----------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), fileInput = $("file"), thumbs = $("thumbs");
  const modeSeg = $("mode"), modeHint = $("modeHint"), stackOpts = $("stackOpts");
  const gapInput = $("gap"), bgInput = $("bg");
  const runBtn = $("run"), dlBtn = $("download"), copyBtn = $("copy"), clearBtn = $("clear");
  const stage = $("stage"), emptyEl = $("empty"), info = $("info"), toast = $("toast");

  // ---- helpers -----------------------------------------------------------
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 1800);
  };

  const loadImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({
      id: ++seq, name: file.name || `image-${seq}.png`, url, img,
      w: img.naturalWidth, h: img.naturalHeight,
    });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const loaded = [];
    for (const f of files) {
      try { loaded.push(await loadImage(f)); }
      catch { showToast(`無法載入 ${f.name}`); }
    }
    // keep upload order; sorting by name is unreliable for screenshots
    items = items.concat(loaded);
    renderThumbs();
    syncButtons();
  }

  function removeItem(id) {
    const it = items.find((i) => i.id === id);
    if (it) URL.revokeObjectURL(it.url);
    items = items.filter((i) => i.id !== id);
    renderThumbs();
    syncButtons();
  }

  // ---- thumbnails + drag-to-reorder -------------------------------------
  let dragId = null;

  function renderThumbs() {
    thumbs.innerHTML = "";
    items.forEach((it, idx) => {
      const li = document.createElement("li");
      li.className = "thumb";
      li.draggable = true;
      li.dataset.id = it.id;
      li.innerHTML = `
        <span class="grip" title="拖曳排序">⋮⋮</span>
        <span class="ord">${idx + 1}</span>
        <img src="${it.url}" alt="" />
        <span class="meta">
          <div class="n">${it.name}</div>
          <div class="d">${it.w} × ${it.h}</div>
        </span>
        <button class="x" title="移除" data-x="${it.id}">×</button>`;
      thumbs.appendChild(li);
    });
  }

  thumbs.addEventListener("click", (e) => {
    const x = e.target.closest("[data-x]");
    if (x) removeItem(Number(x.dataset.x));
  });

  thumbs.addEventListener("dragstart", (e) => {
    const li = e.target.closest(".thumb");
    if (!li) return;
    dragId = Number(li.dataset.id);
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  thumbs.addEventListener("dragend", (e) => {
    e.target.closest(".thumb")?.classList.remove("dragging");
    thumbs.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
    dragId = null;
  });
  thumbs.addEventListener("dragover", (e) => {
    e.preventDefault();
    const li = e.target.closest(".thumb");
    thumbs.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
    if (li && Number(li.dataset.id) !== dragId) li.classList.add("drop-target");
  });
  thumbs.addEventListener("drop", (e) => {
    e.preventDefault();
    const li = e.target.closest(".thumb");
    if (!li || dragId == null) return;
    const targetId = Number(li.dataset.id);
    if (targetId === dragId) return;
    const from = items.findIndex((i) => i.id === dragId);
    const to = items.findIndex((i) => i.id === targetId);
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    renderThumbs();
  });

  // ---- file input / drop zone -------------------------------------------
  drop.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); });
  // paste screenshots directly
  window.addEventListener("paste", (e) => {
    const imgs = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith("image/"));
    if (imgs.length) addFiles(imgs.map((i) => i.getAsFile()).filter(Boolean));
  });

  // ---- mode + options ----------------------------------------------------
  modeSeg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]");
    if (!b) return;
    mode = b.dataset.mode;
    modeSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    stackOpts.hidden = mode !== "stack";
    modeHint.textContent = mode === "auto"
      ? "自動偵測相鄰截圖的重疊區並對齊，適合捲動連拍的長內容。"
      : "單純由上到下堆疊，可設定間距與背景色，適合拼接不相關的圖片。";
  });

  function syncButtons() {
    const has = items.length > 0;
    runBtn.disabled = !has;
    clearBtn.disabled = !has;
    if (!has) { dlBtn.disabled = copyBtn.disabled = true; resultBlob = null; }
  }

  clearBtn.addEventListener("click", () => {
    items.forEach((i) => URL.revokeObjectURL(i.url));
    items = [];
    resultBlob = null;
    renderThumbs();
    syncButtons();
    info.hidden = true;
    stage.innerHTML = "";
    stage.appendChild(emptyEl);
    emptyEl.style.display = "";
  });

  // ---- overlap detection -------------------------------------------------
  // Scale every image to a common width, then work in that pixel space.

  const SAMPLES = 32;          // columns sampled per row for the signature
  const EDGE_IGNORE = 0.06;    // ignore 6% on each side (rounded corners / bars)
  const MATCH_THRESHOLD = 0.045; // normalised SAD below this = trusted overlap

  /** Render an image to an offscreen canvas at the target width. */
  function toCanvas(it, targetW) {
    const h = Math.round(it.h * (targetW / it.w));
    const c = document.createElement("canvas");
    c.width = targetW; c.height = h;
    c.getContext("2d").drawImage(it.img, 0, 0, targetW, h);
    return c;
  }

  /** Grayscale row signatures: Uint16 sum per (row, sample-column). */
  function rowSignatures(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h).data;
    const sig = new Float32Array(h * SAMPLES);
    const x0 = Math.floor(w * EDGE_IGNORE);
    const x1 = Math.ceil(w * (1 - EDGE_IGNORE));
    const span = Math.max(1, x1 - x0);
    for (let y = 0; y < h; y++) {
      const rowBase = y * SAMPLES;
      const pxBase = y * w * 4;
      for (let s = 0; s < SAMPLES; s++) {
        const x = x0 + Math.floor((s + 0.5) * span / SAMPLES);
        const p = pxBase + x * 4;
        // luma
        sig[rowBase + s] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      }
    }
    return sig;
  }

  /**
   * Find how many rows of `B` to skip so that it continues seamlessly after A.
   * We take a band from the bottom of A and locate it inside B.
   * Returns { skip, score } where `skip` rows at the top of B are the overlap.
   */
  function detectOverlap(sigA, hA, sigB, hB) {
    const bandH = Math.min(80, Math.floor(hA * 0.5), Math.floor(hB * 0.9));
    if (bandH < 8) return { skip: 0, score: 1 };

    const aStart = hA - bandH;                 // band = A rows [aStart, hA)
    let best = Infinity, bestYb = -1;
    const maxYb = hB - bandH;                   // B rows [yb, yb+bandH)
    const norm = bandH * SAMPLES * 255;

    for (let yb = 0; yb <= maxYb; yb++) {
      let sad = 0;
      for (let r = 0; r < bandH; r++) {
        const ab = (aStart + r) * SAMPLES;
        const bb = (yb + r) * SAMPLES;
        for (let s = 0; s < SAMPLES; s++) {
          const d = sigA[ab + s] - sigB[bb + s];
          sad += d < 0 ? -d : d;
        }
        if (sad >= best) break;                 // early out — can't beat best
      }
      if (sad < best) { best = sad; bestYb = yb; }
    }

    const score = best / norm;                  // 0 = identical
    if (bestYb < 0 || score > MATCH_THRESHOLD) return { skip: 0, score };
    // A's bottom (row hA) lines up with B row (bestYb + bandH)
    const skip = Math.min(bestYb + bandH, hB);
    return { skip, score };
  }

  // ---- generate ----------------------------------------------------------
  async function generate() {
    if (!items.length) return;
    document.body.classList.add("busy");
    runBtn.disabled = true;
    await new Promise((r) => setTimeout(r, 16)); // let the UI paint "busy"

    try {
      // common width = the most frequent original width (screenshots match)
      const freq = {};
      let targetW = items[0].w, bestC = 0;
      for (const it of items) { freq[it.w] = (freq[it.w] || 0) + 1; if (freq[it.w] > bestC) { bestC = freq[it.w]; targetW = it.w; } }

      const canvases = items.map((it) => toCanvas(it, targetW));

      let layout, totalH, seams = 0;

      if (mode === "stack") {
        const gap = Math.max(0, Number(gapInput.value) || 0);
        layout = canvases.map((c, i) => ({ canvas: c, srcY: 0, drawH: c.height, y: 0 }));
        let y = 0;
        layout.forEach((L, i) => { L.y = y; y += L.drawH + (i < layout.length - 1 ? gap : 0); });
        totalH = y;
      } else {
        // auto: sequential overlap detection
        const sigs = canvases.map((c) => rowSignatures(c.getContext("2d"), c.width, c.height));
        layout = [{ canvas: canvases[0], srcY: 0, drawH: canvases[0].height, y: 0 }];
        let y = canvases[0].height;
        for (let i = 1; i < canvases.length; i++) {
          const A = canvases[i - 1], B = canvases[i];
          const { skip, score } = detectOverlap(sigs[i - 1], A.height, sigs[i], B.height);
          if (skip > 0 && skip < B.height) seams++;
          const drawH = B.height - skip;
          layout.push({ canvas: B, srcY: skip, drawH, y });
          y += drawH;
        }
        totalH = y;
      }

      // guard against browser canvas height limits
      const MAX_H = 32767;
      if (totalH > MAX_H) {
        showToast(`長圖過高（${totalH}px），已超出瀏覽器上限`);
        return;
      }

      const out = document.createElement("canvas");
      out.width = targetW; out.height = totalH;
      const octx = out.getContext("2d");
      if (mode === "stack") {
        octx.fillStyle = bgInput.value || "#ffffff";
        octx.fillRect(0, 0, targetW, totalH);
      }
      for (const L of layout) {
        octx.drawImage(L.canvas, 0, L.srcY, L.canvas.width, L.drawH, 0, L.y, L.canvas.width, L.drawH);
      }

      // show
      stage.innerHTML = "";
      stage.appendChild(out);
      resultBlob = await new Promise((res) => out.toBlob(res, "image/png"));

      info.hidden = false;
      const overlapNote = mode === "auto"
        ? `${seams}/${items.length - 1} 個接縫偵測到重疊`
        : "垂直堆疊";
      info.innerHTML =
        `<span class="badge">${targetW} × ${totalH}</span>` +
        `<span>${items.length} 張圖片</span>` +
        `<span>${overlapNote}</span>` +
        (resultBlob ? `<span>${(resultBlob.size / 1024).toFixed(0)} KB</span>` : "");

      dlBtn.disabled = false;
      copyBtn.disabled = !window.ClipboardItem;
    } catch (err) {
      console.error(err);
      showToast("產生失敗，請重試");
    } finally {
      document.body.classList.remove("busy");
      runBtn.disabled = items.length === 0;
    }
  }

  runBtn.addEventListener("click", generate);

  // ---- download / copy ---------------------------------------------------
  dlBtn.addEventListener("click", () => {
    if (!resultBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(resultBlob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `stitched-${stamp}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });

  copyBtn.addEventListener("click", async () => {
    if (!resultBlob || !window.ClipboardItem) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": resultBlob })]);
      showToast("已複製到剪貼簿");
    } catch { showToast("複製失敗（瀏覽器不支援）"); }
  });

  syncButtons();
})();
