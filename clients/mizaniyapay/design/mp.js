// Mizaniya Pay shared drawing: the logo (redrawn as vectors from the app's profile photo until the
// original file arrives), icons and the coin pattern used as decoration.
(function () {
  const C = { navy: '#1F4E67', deep: '#183B4E', yellow: '#F8E91C', white: '#FFFFFF', ink: '#0C1527' };

  // One coin: a ribbed yellow edge under a navy face with a yellow rim.
  function coin(cx, cy, rx, ry, h, face = C.navy, rim = C.yellow) {
    const band = `M${cx - rx},${cy} A${rx},${ry} 0 0 0 ${cx + rx},${cy} L${cx + rx},${cy + h} A${rx},${ry} 0 0 1 ${cx - rx},${cy + h} Z`;
    let ribs = '';
    const n = 22;
    for (let i = 1; i < n; i++) {
      const a = Math.PI * (i / n);
      const s = Math.sin(a);
      const x = cx - rx * Math.cos(a);
      const y = cy + ry * s;
      const w = Math.max(1.5, rx * 0.07 * s);
      ribs += `<rect x="${(x - w / 2).toFixed(2)}" y="${(y + h * 0.16).toFixed(2)}" width="${w.toFixed(2)}" height="${(h * 0.66).toFixed(2)}" fill="${face}"/>`;
    }
    const sw = rx * 0.022;
    return `<path d="${band}" fill="${rim}" stroke="${rim}" stroke-width="${sw}" stroke-linejoin="round"/>${ribs}` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${face}" stroke="${rim}" stroke-width="${sw}"/>`;
  }

  // The three-coin stack, in a 474 x 384 box.
  function markInner(face, rim) {
    return coin(272, 242, 185, 98, 38, face, rim) + coin(193, 182, 185, 98, 38, face, rim) + coin(252, 102, 185, 98, 38, face, rim);
  }
  function mark({ size = 200, face = C.navy, rim = C.yellow } = {}) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 0 474 384" width="${size}" height="${size * 384 / 474}">${markInner(face, rim)}</svg>`;
  }

  // Horizontal logo: the stack, then "Mizaniya" over "Pay". tone 'light' = for light backgrounds.
  function logo({ height = 120, tone = 'light' } = {}) {
    const word = tone === 'light' ? C.navy : C.white;
    const w = 1440;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 384" height="${height}" width="${height * w / 384}">` +
      `<g transform="translate(0,2)">${markInner(C.navy, C.yellow)}</g>` +
      `<text x="540" y="196" font-family="Poppins" font-weight="600" font-size="178" fill="${word}" letter-spacing="-2">Mizaniya</text>` +
      `<text x="546" y="350" font-family="Poppins" font-weight="400" font-size="168" fill="${C.yellow}">Pay</text></svg>`;
  }

  // Line icons, 48 x 48, drawn with currentColor.
  const P = 'fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    send: `<path ${P} d="M8 24 40 8 30 40 22 27 8 24Z M22 27 40 8"/>`,
    request: `<path ${P} d="M40 24 8 40 18 8 26 21 40 24Z M26 21 8 40"/>`,
    qr: `<g ${P}><rect x="7" y="7" width="13" height="13" rx="2"/><rect x="28" y="7" width="13" height="13" rx="2"/><rect x="7" y="28" width="13" height="13" rx="2"/><path d="M28 28h5v5M41 28v13h-8M28 37v4"/></g>`,
    phone: `<g ${P}><rect x="13" y="5" width="22" height="38" rx="4"/><path d="M21 37h6"/><path d="M27 13l-5 8h6l-5 8"/></g>`,
    bill: `<g ${P}><path d="M11 6h26v36l-4.3-3-4.3 3-4.4-3-4.3 3-4.4-3-4.3 3Z"/><path d="M17 16h14M17 23h14M17 30h8"/></g>`,
    card: `<g ${P}><rect x="5" y="11" width="38" height="26" rx="4"/><path d="M5 19h38M11 30h8"/></g>`,
    shop: `<g ${P}><path d="M7 19 10 8h28l3 11"/><path d="M7 19c0 3 2.5 5 5.5 5s5.5-2 5.5-5c0 3 2.5 5 6 5s6-2 6-5c0 3 2.5 5 5.5 5S41 22 41 19"/><path d="M10 24v17h28V24M20 41V31h8v10"/></g>`,
    chart: `<g ${P}><path d="M7 7v34h34"/><path d="M14 31l8-9 6 5 11-13"/></g>`,
    shield: `<g ${P}><path d="M24 5 39 11v11c0 10-6.5 17-15 21C15.5 39 9 32 9 22V11Z"/><path d="M17 24l5 5 9-10"/></g>`,
    bolt: `<path ${P} d="M27 5 11 27h12l-3 16 17-23H25Z"/>`,
    arrow: `<path ${P} d="M8 24h32M28 12l12 12-12 12"/>`,
    check: `<path ${P} d="M10 25l9 9 19-20"/>`,
    clock: `<g ${P}><circle cx="24" cy="24" r="18"/><path d="M24 13v11l7 5"/></g>`,
    wifi: `<g ${P}><path d="M6 19c10-9 26-9 36 0M12 26c7-6 17-6 24 0M18 33c3.5-3 8.5-3 12 0"/><circle cx="24" cy="39" r="1.5" fill="currentColor"/></g>`,
  };
  function icon(name, size = 64) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}">${ICONS[name]}</svg>`;
  }

  window.MP = { C, coin, mark, logo, icon };
})();
