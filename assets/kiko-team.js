/* KIKO team splash – vector KIKOs built from colored parts, flying toward the viewer. */
(function () {
  const INK = '#2a2433';
  const COLORS = {
    red:   { hi: '#f59a84', base: '#e0654f', lo: '#b4433a' },
    green: { hi: '#a7c9a9', base: '#6f9a76', lo: '#4c7254' },
    blue:  { hi: '#86bdf0', base: '#3f82c4', lo: '#285b94' }
  };
  let uid = 0;

  /* ---- textures, drawn inside a body segment of size w×h (local coords, origin top-left) ---- */
  const TEX = {
    ribs(w, h, c) { // wide horizontal rings
      let s = '';
      for (let i = 1; i <= 3; i++) {
        const y = (h / 4) * i;
        s += `<rect x="-6" y="${y - 7}" width="${w + 12}" height="14" rx="7" fill="${c.base}"/><rect x="-6" y="${y - 7}" width="${w + 12}" height="6" rx="3" fill="#fff" opacity=".22"/><rect x="-6" y="${y + 4}" width="${w + 12}" height="3" rx="1.5" fill="#000" opacity=".16"/>`;
      }
      return s;
    },
    vribs(w, h, c) { // dense vertical ribs
      let s = '';
      for (let x = 10; x < w - 4; x += 12) s += `<rect x="${x}" y="6" width="5" height="${h - 12}" rx="2.5" fill="#000" opacity=".13"/><rect x="${x - 3}" y="6" width="3" height="${h - 12}" rx="1.5" fill="#fff" opacity=".18"/>`;
      return s;
    },
    spikes(w, h, c) { // cones on the surface + sticking out of the sides
      let s = '';
      const rows = 4, cols = 5;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        const x = 16 + k * ((w - 32) / (cols - 1)) + (r % 2 ? 9 : -4), y = 16 + r * ((h - 30) / (rows - 1));
        s += `<path d="M${x - 7} ${y + 6} L${x} ${y - 9} L${x + 7} ${y + 6} Z" fill="${c.lo}" opacity=".55"/><path d="M${x - 2} ${y + 3} L${x} ${y - 7} L${x + 2} ${y + 3} Z" fill="#fff" opacity=".35"/>`;
      }
      for (let r = 0; r < 4; r++) {
        const y = 18 + r * ((h - 34) / 3);
        s += `<path d="M2 ${y - 7} L-13 ${y} L2 ${y + 7} Z" fill="${c.base}"/><path d="M${w - 2} ${y - 7} L${w + 13} ${y} L${w - 2} ${y + 7} Z" fill="${c.lo}"/>`;
      }
      return s;
    },
    bubbles(w, h, c) {
      const b = [[.18, .28, .16], [.45, .22, .12], [.74, .3, .17], [.3, .66, .19], [.62, .7, .15], [.88, .64, .1], [.1, .78, .09], [.52, .46, .09]];
      return b.map(([x, y, r]) => { const R = r * w; return `<circle cx="${x * w}" cy="${y * h}" r="${R}" fill="${c.base}"/><circle cx="${x * w}" cy="${y * h}" r="${R}" fill="#000" opacity=".1"/><circle cx="${x * w - R * .3}" cy="${y * h - R * .35}" r="${R * .45}" fill="#fff" opacity=".35"/>`; }).join('');
    },
    braid(w, h, c) {
      let s = '';
      for (let x = -h; x < w + h; x += 18) s += `<path d="M${x} 0 L${x + h} ${h}" stroke="#000" stroke-opacity=".14" stroke-width="7"/><path d="M${x + h} 0 L${x} ${h}" stroke="#fff" stroke-opacity=".2" stroke-width="5"/>`;
      return s;
    },
    dots(w, h, c) {
      let s = '';
      for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
        const x = 16 + k * ((w - 32) / 5) + (r % 2 ? 8 : 0), y = 16 + r * ((h - 30) / 3);
        s += `<circle cx="${x}" cy="${y}" r="6.5" fill="#000" opacity=".14"/><circle cx="${x - 1.5}" cy="${y - 2}" r="3" fill="#fff" opacity=".35"/>`;
      }
      return s;
    },
    plain() { return ''; }
  };

  /* ---- faces, centered at (0,0) on the head ---- */
  const FACES = {
    excited: `<path d="M-46 -12 L-26 0 L-46 12" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 -12 L26 0 L46 12" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M-15 18 Q0 44 15 18 Z" fill="${INK}"/><path d="M-8 30 Q0 38 8 30" fill="#ff8f8f"/>`,
    happy: `<path d="M-46 4 Q-36 -12 -26 4" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M26 4 Q36 -12 46 4" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M-16 20 Q0 36 16 20" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`,
    wink: `<circle cx="-36" cy="-2" r="7.5" fill="${INK}"/><path d="M26 0 Q36 -10 46 0" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M-18 18 Q0 38 18 18" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`,
    woo: `<circle cx="-34" cy="-4" r="9" fill="${INK}"/><circle cx="-31" cy="-7" r="3" fill="#fff"/><circle cx="34" cy="-4" r="9" fill="${INK}"/><circle cx="37" cy="-7" r="3" fill="#fff"/><ellipse cx="0" cy="26" rx="10" ry="13" fill="${INK}"/>`,
    bold: `<path d="M-50 -18 L-24 -10" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M50 -18 L24 -10" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><circle cx="-35" cy="3" r="7.5" fill="${INK}"/><circle cx="35" cy="3" r="7.5" fill="${INK}"/><path d="M-20 20 Q0 40 20 20 Z" fill="${INK}"/>`
  };

  /** parts: [{color, tex}] – first part is the head (gets the face). */
  function kiko(parts, face) {
    const id = 'k' + (++uid);
    const W = 200, HEAD_H = 132, BODY_H = 112, GAP = 16;
    let y = 0, defs = '', body = '';
    const used = new Set(parts.map(p => p.color));
    used.forEach(cn => {
      const c = COLORS[cn];
      defs += `<linearGradient id="${id}${cn}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.hi}"/><stop offset=".45" stop-color="${c.base}"/><stop offset="1" stop-color="${c.lo}"/></linearGradient>`;
    });
    defs += `<linearGradient id="${id}cyl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".3" stop-color="#fff" stop-opacity=".05"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".24"/></linearGradient>`;
    defs += `<linearGradient id="${id}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset=".5" stop-color="#ffc93a"/><stop offset="1" stop-color="#e09a12"/></linearGradient>`;
    // string loop on top
    body += `<path d="M-14 -4 C-30 -52 30 -52 14 -4" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`;
    parts.forEach((p, i) => {
      const c = COLORS[p.color];
      const isHead = i === 0;
      const w = isHead ? W : W - 12, h = isHead ? HEAD_H : BODY_H, rx = isHead ? 54 : 40, x = -w / 2;
      if (!isHead) { // yellow connector between parts
        body += `<rect x="-58" y="${y - GAP + 2}" width="116" height="${GAP + 4}" rx="7" fill="url(#${id}gold)"/>`;
        for (let t = -48; t <= 48; t += 16) body += `<rect x="${t - 3}" y="${y - GAP + 2}" width="6" height="${GAP + 4}" rx="2" fill="#b77b06" opacity=".35"/>`;
      }
      const clip = `${id}c${i}`;
      // clip rect is in the textured group's local coords (the group is translated to x,y)
      defs += `<clipPath id="${clip}"><rect x="0" y="0" width="${w}" height="${h}" rx="${rx}"/></clipPath>`;
      body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#${id}${p.color})"/>`;
      const tex = (TEX[p.tex] || TEX.plain)(w, h, c);
      const outside = p.tex === 'spikes' || p.tex === 'ribs'; // these stick out past the silhouette
      body += `<g transform="translate(${x} ${y})"${outside ? '' : ` clip-path="url(#${clip})"`}>${tex}</g>`;
      body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#${id}cyl)"/>`;
      body += `<ellipse cx="${x + w * .27}" cy="${y + h * .2}" rx="${w * .16}" ry="${h * .08}" fill="#fff" opacity=".35" transform="rotate(-12 ${x + w * .27} ${y + h * .2})"/>`;
      if (isHead) body += `<g transform="translate(0 ${y + h * .5})">${FACES[face] || FACES.happy}<circle cx="-62" cy="22" r="11" fill="#ff7a7a" opacity=".35"/><circle cx="62" cy="22" r="11" fill="#ff7a7a" opacity=".35"/></g>`;
      y += h + GAP;
    });
    y -= GAP;
    // trailing string with tassel
    const tail = `<path d="M0 ${y - 6} C6 ${y + 40} -26 ${y + 70} -14 ${y + 104}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><g transform="translate(-14 ${y + 104}) rotate(12)"><path d="M0 0 L-12 34 M0 0 L-4 38 M0 0 L5 37 M0 0 L13 32" stroke="#ff7a1a" stroke-width="6" stroke-linecap="round"/><circle r="8" fill="#ff8a2a"/></g>`;
    const vb = `-118 -50 236 ${y + 160}`;
    return { svg: `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${defs}</defs>${tail}${body}</svg>`, ratio: (y + 160) / 236 };
  }

  /* ---- the team ---- */
  // x/y: center position in % of the scene; s: width in scene units; r: final tilt; d: depth 0 (front) .. 1 (far)
  // x/y: center position in % of the scene; s: width in scene units; r: final tilt; d: depth 0 (front) .. 1 (far)
  // p: alternative position for portrait (phone) screens
  const TEAM = [
    { x: 50, y: 29, s: 3.4, r: -6, d: 1, face: 'happy', parts: [{ color: 'green', tex: 'plain' }], p: { x: 50, y: 30, s: 3.4 } },
    { x: 39, y: 36, s: 5.6, r: 10, d: .82, face: 'woo', parts: [{ color: 'red', tex: 'plain' }, { color: 'blue', tex: 'vribs' }], p: { x: 30, y: 33, s: 5.4 } },
    { x: 62, y: 35, s: 6, r: -14, d: .8, face: 'excited', parts: [{ color: 'blue', tex: 'plain' }, { color: 'red', tex: 'dots' }], p: { x: 71, y: 32, s: 5.8 } },
    { x: 14, y: 30, s: 8.6, r: 22, d: .58, face: 'bold', parts: [{ color: 'green', tex: 'plain' }, { color: 'red', tex: 'spikes' }], p: { x: 13, y: 41, s: 8.4 } },
    { x: 87, y: 28, s: 9, r: -24, d: .56, face: 'wink', parts: [{ color: 'blue', tex: 'plain' }, { color: 'green', tex: 'ribs' }], p: { x: 87, y: 40, s: 8.6 } },
    { x: 24, y: 56, s: 13.5, r: 13, d: .25, face: 'happy', parts: [{ color: 'blue', tex: 'plain' }, { color: 'red', tex: 'spikes' }, { color: 'green', tex: 'dots' }], p: { x: 16, y: 64, s: 11.6 } },
    { x: 77, y: 54, s: 14, r: -15, d: .22, face: 'wink', parts: [{ color: 'green', tex: 'plain' }, { color: 'blue', tex: 'braid' }, { color: 'red', tex: 'vribs' }], p: { x: 84, y: 63, s: 12 } },
    { x: 50, y: 59, s: 18.5, r: -7, d: 0, face: 'excited', parts: [{ color: 'red', tex: 'plain' }, { color: 'green', tex: 'ribs' }, { color: 'blue', tex: 'bubbles' }], leader: true, p: { x: 50, y: 58, s: 17 } }
  ];

  function speedLines(n) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (i % 3) * 0.05;
      const r1 = 18 + (i * 37 % 23), r2 = r1 + 18 + (i * 53 % 40);
      const w = 0.25 + (i % 4) * 0.18;
      s += `<line x1="${50 + Math.cos(a) * r1}" y1="${42 + Math.sin(a) * r1 * 0.8}" x2="${50 + Math.cos(a) * r2}" y2="${42 + Math.sin(a) * r2 * 0.8}" stroke="#fff" stroke-width="${w}" stroke-linecap="round" opacity="${0.12 + (i % 5) * 0.06}"/>`;
    }
    return `<svg class="kt-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${s}</svg>`;
  }

  function sparks() {
    const cols = ['#ffd23f', '#e0654f', '#6f9a76', '#3f82c4', '#fff'];
    let s = '';
    for (let i = 0; i < 26; i++) {
      const x = (i * 37.7) % 100, y = (i * 53.3 + 11) % 100, c = cols[i % cols.length], r = 2 + (i % 4);
      s += i % 3 === 0
        ? `<span class="kt-spark star" style="left:${x}%;top:${y}%;color:${c};font-size:${8 + r * 3}px">✦</span>`
        : `<span class="kt-spark" style="left:${x}%;top:${y}%;background:${c};width:${r * 2}px;height:${r * 2}px"></span>`;
    }
    return s;
  }

  function render(el) {
    const portrait = window.matchMedia && window.matchMedia('(max-aspect-ratio: 4/5)').matches;
    const kikos = TEAM.map((k0, i) => {
      const k = portrait && k0.p ? Object.assign({}, k0, k0.p) : k0;
      const { svg, ratio } = kiko(k.parts, k.face);
      const blur = k.d > .5 ? (k.d - .5) * 3 : 0;
      const delay = (1 - k.d) * 0.55 + (k.leader ? 0.12 : 0);
      return `<div class="kt-k${k.leader ? ' leader' : ''}" style="left:${k.x}%;top:${k.y}%;--w:${k.s};--ratio:${ratio.toFixed(3)};--fx:${(50 - k.x)}vw;--fy:${(42 - k.y)}vh;--r:${k.r}deg;--delay:${delay.toFixed(2)}s;--bob:${(2.6 + (i % 3) * 0.5).toFixed(1)}s;z-index:${10 - Math.round(k.d * 8)};${blur ? `filter:blur(${blur.toFixed(2)}px) saturate(${(1 - k.d * .25).toFixed(2)})` : ''}"><div class="kt-fly"><div class="kt-bob">${svg}</div></div></div>`;
    }).join('');
    el.innerHTML = `<div class="kt-sky"></div><div class="kt-rays"></div>${speedLines(56)}<div class="kt-sparks">${sparks()}</div><div class="kt-team">${kikos}</div>`;
  }

  window.KikoTeam = { render: render, kiko: kiko };
})();
