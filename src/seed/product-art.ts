import sharp from 'src/common/sharp';
import type { Garment } from './catalog-data';

/**
 * Flat product illustration (800×1000 PNG) in the product colour. Used by the
 * seed instead of downloading photos: no licences, no dead links. Real photos
 * can replace them later via POST /admin/products/:id/images.
 */
export async function productArt(
  garment: Garment,
  hex: string,
  label: string,
): Promise<Buffer> {
  const shade = darken(hex, 0.18);
  const ink = luminance(hex) > 0.6 ? '#3a3a3a' : '#f5f5f5';
  const shapes: Record<Garment, string> = {
    tshirt: `<path d="M250 230 L340 190 Q400 235 460 190 L550 230 L640 330 L575 385 L540 350 L540 800 L260 800 L260 350 L225 385 L160 330 Z" fill="${hex}" stroke="${shade}" stroke-width="6"/>
             <path d="M340 190 Q400 250 460 190" fill="none" stroke="${shade}" stroke-width="8"/>`,
    shirt: `<path d="M250 230 L345 185 L400 240 L455 185 L550 230 L640 330 L575 385 L540 350 L540 800 L260 800 L260 350 L225 385 L160 330 Z" fill="${hex}" stroke="${shade}" stroke-width="6"/>
            <path d="M345 185 L400 240 L455 185 L430 265 L400 240 L370 265 Z" fill="${shade}"/>
            <line x1="400" y1="240" x2="400" y2="800" stroke="${shade}" stroke-width="5"/>
            ${[300, 380, 460, 540, 620, 700].map((y) => `<circle cx="412" cy="${y}" r="7" fill="${ink}"/>`).join('')}`,
    pants: `<path d="M280 200 L520 200 L560 820 L430 820 L400 380 L370 820 L240 820 Z" fill="${hex}" stroke="${shade}" stroke-width="6"/>
            <rect x="280" y="200" width="240" height="38" fill="${shade}"/>`,
    dress: `<path d="M340 190 Q400 230 460 190 L500 300 L470 360 L620 820 L180 820 L330 360 L300 300 Z" fill="${hex}" stroke="${shade}" stroke-width="6"/>
            <path d="M320 360 Q400 390 480 360" fill="none" stroke="${shade}" stroke-width="10"/>`,
    shoe: `<path d="M170 600 Q190 470 330 470 L420 470 Q470 520 560 540 Q660 560 660 640 L660 680 L170 680 Z" fill="${hex}" stroke="${shade}" stroke-width="6"/>
           <rect x="165" y="680" width="500" height="40" rx="12" fill="${shade}"/>
           ${[360, 395, 430].map((x) => `<line x1="${x}" y1="${485 + (x - 360) / 2}" x2="${x + 35}" y2="${505 + (x - 360) / 2}" stroke="${ink}" stroke-width="6"/>`).join('')}`,
    bag: `<path d="M330 360 Q330 230 400 230 Q470 230 470 360" fill="none" stroke="${shade}" stroke-width="18"/>
          <path d="M220 360 L580 360 L620 780 L180 780 Z" fill="${hex}" stroke="${shade}" stroke-width="6"/>`,
    cap: `<path d="M220 560 Q220 330 400 330 Q580 330 580 560 Z" fill="${hex}" stroke="${shade}" stroke-width="6"/>
          <path d="M560 540 Q700 545 720 600 L560 600 Z" fill="${shade}"/>
          <circle cx="400" cy="335" r="14" fill="${shade}"/>`,
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
    <rect width="800" height="1000" fill="#f3f1ee"/>
    <ellipse cx="400" cy="870" rx="260" ry="26" fill="#000" opacity="0.07"/>
    ${shapes[garment]}
    <text x="400" y="950" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#8a8580" text-anchor="middle">${escapeXml(label)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function darken(hex: string, amount: number) {
  return `#${rgb(hex)
    .map((v) =>
      Math.round(v * (1 - amount))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
