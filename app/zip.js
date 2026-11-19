'use strict';

/**
 * Minimal ZIP writer (STORE method, no compression).
 * Keeps the app dependency-free; PDFs are already compact.
 */
(() => {
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    const time =
      (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const day =
      ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, day };
  }

  /**
   * @param {Array<{name: string, data: Uint8Array}>} files
   * @param {Date} [date]
   * @returns {Uint8Array}
   */
  function buildZip(files, date = new Date()) {
    const { time, day } = dosDateTime(date);
    const encoder = new TextEncoder();
    const entries = files.map((file) => ({
      name: encoder.encode(file.name),
      data: file.data,
      crc: crc32(file.data)
    }));

    const localSize = entries.reduce((sum, e) => sum + 30 + e.name.length + e.data.length, 0);
    const centralSize = entries.reduce((sum, e) => sum + 46 + e.name.length, 0);
    const output = new Uint8Array(localSize + centralSize + 22);
    const view = new DataView(output.buffer);
    let offset = 0;
    const centralOffsets = [];

    for (const entry of entries) {
      centralOffsets.push(offset);

      view.setUint32(offset, 0x04034b50, true);
      view.setUint16(offset + 4, 20, true); // version needed
      view.setUint16(offset + 6, 0x0800, true); // UTF-8 filename
      view.setUint16(offset + 8, 0, true); // store
      view.setUint16(offset + 10, time, true);
      view.setUint16(offset + 12, day, true);
      view.setUint32(offset + 14, entry.crc, true);
      view.setUint32(offset + 18, entry.data.length, true);
      view.setUint32(offset + 22, entry.data.length, true);
      view.setUint16(offset + 26, entry.name.length, true);
      view.setUint16(offset + 28, 0, true);
      offset += 30;

      output.set(entry.name, offset);
      offset += entry.name.length;
      output.set(entry.data, offset);
      offset += entry.data.length;
    }

    const centralStart = offset;
    entries.forEach((entry, index) => {
      view.setUint32(offset, 0x02014b50, true);
      view.setUint16(offset + 4, 20, true); // version made by
      view.setUint16(offset + 6, 20, true); // version needed
      view.setUint16(offset + 8, 0x0800, true);
      view.setUint16(offset + 10, 0, true);
      view.setUint16(offset + 12, time, true);
      view.setUint16(offset + 14, day, true);
      view.setUint32(offset + 16, entry.crc, true);
      view.setUint32(offset + 20, entry.data.length, true);
      view.setUint32(offset + 24, entry.data.length, true);
      view.setUint16(offset + 28, entry.name.length, true);
      view.setUint16(offset + 30, 0, true); // extra
      view.setUint16(offset + 32, 0, true); // comment
      view.setUint16(offset + 34, 0, true); // disk
      view.setUint16(offset + 36, 0, true); // internal attrs
      view.setUint32(offset + 38, 0, true); // external attrs
      view.setUint32(offset + 42, centralOffsets[index], true);
      offset += 46;

      output.set(entry.name, offset);
      offset += entry.name.length;
    });

    view.setUint32(offset, 0x06054b50, true);
    view.setUint16(offset + 4, 0, true);
    view.setUint16(offset + 6, 0, true);
    view.setUint16(offset + 8, entries.length, true);
    view.setUint16(offset + 10, entries.length, true);
    view.setUint32(offset + 12, offset - centralStart, true);
    view.setUint32(offset + 16, centralStart, true);
    view.setUint16(offset + 20, 0, true);

    return output;
  }

  window.ZipWriter = { buildZip, crc32 };
})();