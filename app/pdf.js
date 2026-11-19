'use strict';

/**
 * Minimal client-side PDF writer: A4 pages, Helvetica / Helvetica-Bold.
 * No dependencies, no network, no storage — returns raw bytes.
 */
(() => {
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_X = 56;
  const MARGIN_TOP = 72;
  const MARGIN_BOTTOM = 72;

  // Glyph widths (1/1000 em) for Helvetica, characters 32..126.
  const HELVETICA_WIDTHS = (
    '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 ' +
    '556 556 556 556 556 556 556 556 556 556 ' +
    '278 278 584 584 584 556 1015 ' +
    '667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 ' +
    '278 278 278 469 556 333 ' +
    '556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 ' +
    '334 260 334 584'
  )
    .split(' ')
    .map(Number);

  // Glyph widths (1/1000 em) for Helvetica-Bold, characters 32..126.
  const HELVETICA_BOLD_WIDTHS = (
    '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 ' +
    '556 556 556 556 556 556 556 556 556 556 ' +
    '333 333 584 584 584 611 975 ' +
    '722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 ' +
    '333 278 333 584 556 333 ' +
    '556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 ' +
    '389 280 389 584'
  )
    .split(' ')
    .map(Number);

  function textWidth(text, widths, fontSize) {
    let total = 0;
    for (let i = 0; i < text.length; i += 1) {
      const index = text.charCodeAt(i) - 32;
      total += index >= 0 && index < widths.length ? widths[index] : 556;
    }
    return (total / 1000) * fontSize;
  }

  function escapePdfString(text) {
    return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function wrapText(text, widths, fontSize, maxWidth) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && textWidth(candidate, widths, fontSize) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
      // Guard against a single word wider than the text column.
      while (textWidth(line, widths, fontSize) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && textWidth(line.slice(0, cut), widths, fontSize) > maxWidth) {
          cut -= 1;
        }
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }

    if (line) lines.push(line);
    return lines;
  }

  function toLatin1Bytes(text) {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) {
      bytes[i] = text.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  /**
   * @param {{title: string, paragraphs: string[]}} document
   * @returns {Uint8Array}
   */
  function buildPdf({ title, paragraphs }) {
    const pages = [];
    let current = [];
    let y = PAGE_HEIGHT - MARGIN_TOP;
    const maxWidth = PAGE_WIDTH - MARGIN_X * 2;

    const pageBreak = () => {
      pages.push(current);
      current = [];
      y = PAGE_HEIGHT - MARGIN_TOP;
    };

    const writeLine = (text, font, size, x, lineY) => {
      current.push(
        `BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${lineY.toFixed(2)} Tm (${escapePdfString(text)}) Tj ET`
      );
    };

    // Title block
    const titleSize = 24;
    const titleLeading = 30;
    for (const line of wrapText(title, HELVETICA_BOLD_WIDTHS, titleSize, maxWidth)) {
      if (y < MARGIN_BOTTOM + titleLeading) pageBreak();
      writeLine(line, 'F2', titleSize, MARGIN_X, y);
      y -= titleLeading;
    }

    y -= 18;

    // Body
    const bodySize = 11.5;
    const bodyLeading = 16.5;
    const paragraphGap = 11;

    for (const paragraph of paragraphs) {
      for (const line of wrapText(paragraph, HELVETICA_WIDTHS, bodySize, maxWidth)) {
        if (y < MARGIN_BOTTOM) pageBreak();
        writeLine(line, 'F1', bodySize, MARGIN_X, y);
        y -= bodyLeading;
      }
      y -= paragraphGap;
    }

    pages.push(current);

    // Object table
    const objects = [];
    const firstPageId = 5;
    const kids = pages.map((_, i) => `${firstPageId + i * 2} 0 R`);

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    pages.forEach((lines, index) => {
      const pageId = firstPageId + index * 2;
      const contentId = pageId + 1;
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = { stream: lines.join('\n') };
    });

    const parts = [];
    let offset = 0;
    const offsets = [];

    const push = (text) => {
      parts.push(text);
      offset += text.length; // every character is a single latin1 byte
    };

    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    for (let id = 1; id < objects.length; id += 1) {
      const object = objects[id];
      if (object === undefined) continue;

      offsets[id] = offset;
      push(`${id} 0 obj\n`);

      if (typeof object === 'string') {
        push(`${object}\n`);
      } else {
        const stream = object.stream;
        push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\n`);
      }

      push('endobj\n');
    }

    const xrefOffset = offset;
    push(`xref\n0 ${objects.length}\n`);
    push('0000000000 65535 f \n');
    for (let id = 1; id < objects.length; id += 1) {
      if (offsets[id] === undefined) {
        push('0000000000 65535 f \n');
      } else {
        push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
      }
    }
    push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    return toLatin1Bytes(parts.join(''));
  }

  window.PdfWriter = { buildPdf };
})();