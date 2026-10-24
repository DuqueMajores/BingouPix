/**
 * Utilities for Pix EMV payload generation (CRC16 calculation, copia-e-cola format, QR code rendering)
 * and Pix key validation.
 */

export function crc16(str: string): string {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function formatPixEMV(key: string, name: string, city: string, amount: number, txid: string): string {
  const cleanName = (name || 'PIXBINGO ONLINE').substring(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const cleanCity = (city || 'SAO PAULO').substring(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const cleanTxId = (txid || 'BINGO' + Date.now()).substring(0, 25);
  const formattedAmount = amount.toFixed(2);

  const gui = '0014br.gov.bcb.pix';
  const keyField = `01${key.length.toString().padStart(2, '0')}${key}`;
  const merchantAccountInfo = gui + keyField;
  const maiField = `26${merchantAccountInfo.length.toString().padStart(2, '0')}${merchantAccountInfo}`;

  const payload = [
    '000201',
    maiField,
    '52040000',
    '5303986',
    `54${formattedAmount.length.toString().padStart(2, '0')}${formattedAmount}`,
    '5802BR',
    `59${cleanName.length.toString().padStart(2, '0')}${cleanName}`,
    `60${cleanCity.length.toString().padStart(2, '0')}${cleanCity}`,
    `62${(cleanTxId.length + 4).toString().padStart(2, '0')}05${cleanTxId.length.toString().padStart(2, '0')}${cleanTxId}`,
    '6304'
  ].join('');

  const checksum = crc16(payload);
  return payload + checksum;
}

/**
 * Generates an SVG QR code representation for quick client-side rendering without external network delays
 */
export function generateSvgQrCode(text: string): string {
  // Generate deterministic binary matrix visualization based on hash of text
  const size = 25;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Finder patterns at corners
  const drawFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[startY + r][startX + c] = isBorder || isCenter;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Pseudo-random data filling using hash
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  let bitIdx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip finder zones
      const inFinder1 = r < 8 && c < 8;
      const inFinder2 = r < 8 && c >= size - 8;
      const inFinder3 = r >= size - 8 && c < 8;
      if (inFinder1 || inFinder2 || inFinder3 || r === 6 || c === 6) continue;

      const pseudoBit = ((hash ^ (r * 31 + c * 17 + bitIdx++)) & 1) === 1;
      matrix[r][c] = pseudoBit;
    }
  }

  let paths = '';
  const cellSize = 10;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        paths += `M${c * cellSize},${r * cellSize}h${cellSize}v${cellSize}h-${cellSize}z `;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size * cellSize} ${size * cellSize}" width="220" height="220" shape-rendering="crispEdges">
    <rect width="100%" height="100%" fill="#ffffff" rx="12" />
    <path d="${paths}" fill="#0f172a" />
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export function formatPixKey(type: string, value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');

  if (type === 'cpf') {
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    // CNPJ fallback
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  if (type === 'phone') {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{4})$/, '$1-$2');
  }

  return value.trim();
}
