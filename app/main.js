'use strict';

(() => {
  const { generateDocument } = window.PdfContent;
  const { buildPdf } = window.PdfWriter;
  const { buildZip } = window.ZipWriter;

  const MIN_COUNT = 1;
  const MAX_COUNT = 25;

  const form = document.getElementById('generate-form');
  const countInput = document.getElementById('count');
  const submitButton = document.getElementById('submit-btn');
  const submitLabel = submitButton.querySelector('.btn-label');
  const errorBox = document.getElementById('error');
  const results = document.getElementById('results');
  const resultsTitle = document.getElementById('results-title');
  const resultsSub = document.getElementById('results-sub');
  const docList = document.getElementById('doc-list');
  const zipButton = document.getElementById('download-zip');
  const chipButtons = Array.from(document.querySelectorAll('.chip'));
  const stepButtons = Array.from(document.querySelectorAll('.step'));

  const state = {
    urls: [],
    zipBlob: null,
    zipName: '',
    busy: false
  };

  function clampCount(value) {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) return MIN_COUNT;
    return Math.min(MAX_COUNT, Math.max(MIN_COUNT, number));
  }

  function syncCountUI() {
    const count = clampCount(countInput.value);
    countInput.value = String(count);
    chipButtons.forEach((chip) => {
      const active = Number(chip.dataset.count) === count;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }

  function setBusy(busy) {
    state.busy = busy;
    submitButton.disabled = busy;
    submitButton.classList.toggle('is-busy', busy);
    submitLabel.textContent = busy ? 'Writing PDFs…' : 'Generate & download';
    countInput.disabled = busy;
    stepButtons.forEach((button) => {
      button.disabled = busy;
    });
    chipButtons.forEach((button) => {
      button.disabled = busy;
    });
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function slugify(title) {
    return (
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'document'
    );
  }

  function timestamp(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return (
      `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
  }

  function releaseUrls() {
    state.urls.forEach((url) => URL.revokeObjectURL(url));
    state.urls = [];
    state.zipBlob = null;
    state.zipName = '';
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    state.urls.push(url);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function yieldToBrowser() {
    // A short timer lets the browser paint the busy state before the
    // (synchronous) PDF generation work starts.
    return new Promise((resolve) => setTimeout(resolve, 16));
  }

  function renderResults(documents, zipName) {
    docList.replaceChildren();

    documents.forEach((doc) => {
      const item = document.createElement('li');
      item.className = 'doc';

      const badge = document.createElement('span');
      badge.className = 'doc-index';
      badge.textContent = doc.index;
      badge.setAttribute('aria-hidden', 'true');

      const text = document.createElement('div');
      text.className = 'doc-text';

      const title = document.createElement('p');
      title.className = 'doc-title';
      title.textContent = doc.title;

      const meta = document.createElement('p');
      meta.className = 'doc-meta';
      meta.textContent = `${doc.wordCount} words · ${doc.filename}`;

      text.append(title, meta);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ghost small';
      button.textContent = 'Download';
      button.addEventListener('click', () => {
        saveBlob(doc.blob, doc.filename);
        showStatus(`Saved ${doc.filename}`);
      });

      item.append(badge, text, button);
      docList.appendChild(item);
    });

    resultsTitle.textContent =
      documents.length === 1 ? '1 PDF ready' : `${documents.length} PDFs ready`;

    resultsSub.textContent =
      documents.length === 1
        ? `Downloaded to your machine as ${documents[0].filename}.`
        : `Delivered as ${zipName}. Grab any single file below if you prefer.`;

    if (state.zipBlob) {
      zipButton.hidden = false;
      zipButton.textContent = 'Download ZIP again';
    } else {
      zipButton.hidden = true;
    }

    results.hidden = false;
  }

  let statusTimer = 0;
  function showStatus(message) {
    resultsSub.textContent = message;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      if (state.zipName) {
        resultsSub.textContent = `Delivered as ${state.zipName}. Grab any single file below if you prefer.`;
      }
    }, 6000);
  }

  async function handleGenerate(event) {
    event.preventDefault();
    if (state.busy) return;

    const count = clampCount(countInput.value);
    countInput.value = String(count);
    syncCountUI();
    clearError();
    setBusy(true);

    try {
      await yieldToBrowser(); // let the spinner paint before heavy work

      const now = new Date();
      const documents = [];
      const files = [];
      const usedTitles = new Set();

      for (let i = 0; i < count; i += 1) {
        let doc = generateDocument();
        for (let attempt = 0; usedTitles.has(doc.title) && attempt < 25; attempt += 1) {
          doc = generateDocument();
        }
        usedTitles.add(doc.title);

        const bytes = buildPdf(doc);
        const filename = `${String(i + 1).padStart(2, '0')}-${slugify(doc.title)}.pdf`;

        documents.push({
          index: String(i + 1).padStart(2, '0'),
          title: doc.title,
          wordCount: doc.wordCount,
          filename,
          blob: new Blob([bytes], { type: 'application/pdf' })
        });
        files.push({ name: filename, data: bytes });
      }

      releaseUrls();

      if (count === 1) {
        saveBlob(documents[0].blob, documents[0].filename);
        renderResults(documents, '');
      } else {
        const zipName = `random-pdfs-${timestamp(now)}.zip`;
        state.zipBlob = new Blob([buildZip(files, now)], { type: 'application/zip' });
        state.zipName = zipName;
        saveBlob(state.zipBlob, zipName);
        renderResults(documents, zipName);
      }
    } catch (error) {
      console.error(error);
      showError('Something went wrong while building the PDFs. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener('submit', handleGenerate);

  countInput.addEventListener('input', () => {
    if (countInput.value === '') return;
    syncCountUI();
  });

  countInput.addEventListener('blur', () => {
    countInput.value = String(clampCount(countInput.value));
    syncCountUI();
  });

  stepButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const next = clampCount(countInput.value) + Number(button.dataset.step);
      countInput.value = String(clampCount(next));
      syncCountUI();
    });
  });

  chipButtons.forEach((chip) => {
    chip.addEventListener('click', () => {
      countInput.value = chip.dataset.count;
      syncCountUI();
    });
  });

  zipButton.addEventListener('click', () => {
    if (!state.zipBlob) return;
    saveBlob(state.zipBlob, state.zipName);
    showStatus(`Saved ${state.zipName}`);
  });

  window.addEventListener('pagehide', releaseUrls);

  syncCountUI();
})();