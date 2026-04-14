/**
 * vectorize.cjs — Vectorisation multi-couches de icon128.png via potrace
 * Version validee : 3 variations d'opacite (5/10/15%), highlight en <circle>,
 * ombre sur les pixels 'other' d'origine. Aucune retouche du gap.
 */

/* eslint-env node */
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const potrace = require('potrace');

// Source haute resolution fournie par le Commanditaire (1005x1148)
// Les details fins (arrondis, gap) sont preserves car ~8x plus de pixels qu'un 128x128.
const INPUT = path.resolve(__dirname, 'icon-source-hd.png');

const buf = fs.readFileSync(INPUT);
const png = PNG.sync.read(buf);
const { width, height, data } = png;
console.log(`PNG : ${width}x${height}`);

function classify(r, g, b, a) {
  if (a < 32) return 'transparent';
  if (r > 220 && g > 220 && b > 220) return 'white';
  if (r < 90 && g < 110 && b > 60 && b < 150) return 'navy';
  // 'shadow' = zone ombragee #418FB9 (bleu intermediaire) — r=65, g=143, b=185
  // Tolerance pour antialiasing : r ~55-80, g ~130-160, b ~170-200
  if (r >= 55 && r <= 80 && g >= 125 && g <= 160 && b >= 165 && b <= 200) return 'shadow';
  // 'sky' = bleu clair #4DA8DA — plus clair que shadow
  if (r > 50 && r < 180 && g > 120 && g < 220 && b > 170) return 'sky';
  return 'other';
}

function buildClassMap() {
  const map = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      map[y * width + x] = classify(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
    }
  }

  // FLOODFILL depuis les 4 coins pour neutraliser le fond damier (fond blanc/gris opaque
  // qui represente visuellement la transparence dans le PNG HD). Tout pixel connexe aux
  // coins qui n'est ni navy ni sky est marque transparent.
  const visited = new Uint8Array(width * height);
  const queue = [];
  const seeds = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  for (const [x, y] of seeds) queue.push(x, y);
  let flooded = 0;
  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const key = y * width + x;
    if (visited[key]) continue;
    const cat = map[key];
    if (cat === 'navy' || cat === 'sky' || cat === 'shadow') continue; // barriere : ne traverse pas le bouclier
    visited[key] = 1;
    if (cat !== 'transparent') {
      map[key] = 'transparent';
      flooded++;
    }
    queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  console.log(`Floodfill fond : ${flooded} pixels reclassifies en transparent`);
  return map;
}

const classMap = buildClassMap();

function clusterWhites() {
  const whites = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (classMap[y * width + x] === 'white') whites.push({ x, y });
    }
  }
  const assigned = new Array(whites.length).fill(-1);
  const clusters = [];
  for (let i = 0; i < whites.length; i++) {
    if (assigned[i] !== -1) continue;
    const cid = clusters.length;
    const stack = [i];
    const members = [];
    while (stack.length) {
      const k = stack.pop();
      if (assigned[k] !== -1) continue;
      assigned[k] = cid;
      members.push(whites[k]);
      for (let j = 0; j < whites.length; j++) {
        if (assigned[j] !== -1) continue;
        const dx = whites[j].x - whites[k].x;
        const dy = whites[j].y - whites[k].y;
        if (dx * dx + dy * dy <= 9) stack.push(j);
      }
    }
    clusters.push(members);
  }
  return clusters.sort((a, b) => b.length - a.length);
}

function clusterBbox(members) {
  return members.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      maxX: Math.max(acc.maxX, p.x),
      minY: Math.min(acc.minY, p.y),
      maxY: Math.max(acc.maxY, p.y),
    }),
    { minX: width, maxX: 0, minY: height, maxY: 0 }
  );
}

function makeBinary(predicate) {
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const cat = classMap[y * width + x];
      const hit = predicate(cat, x, y);
      out.data[i] = hit ? 0 : 255;
      out.data[i + 1] = hit ? 0 : 255;
      out.data[i + 2] = hit ? 0 : 255;
      out.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(out);
}

function trace(pngBuf, opts = {}) {
  return new Promise((resolve, reject) => {
    potrace.trace(
      pngBuf,
      {
        turdSize: 2,
        alphaMax: 1.0,
        optCurve: true,
        optTolerance: 0.2,
        threshold: 128,
        color: '#000000',
        background: '#FFFFFF',
        ...opts,
      },
      (err, svg) => {
        if (err) return reject(err);
        const paths = [];
        const re = /<path[^>]*\sd="([^"]+)"/g;
        let m;
        while ((m = re.exec(svg))) paths.push(m[1]);
        resolve(paths);
      }
    );
  });
}

// Calcule la bounding box du bouclier (pixels navy/sky/shadow) dans la classMap.
function computeShieldBbox() {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = classMap[y * width + x];
      if (c === 'navy' || c === 'sky' || c === 'shadow') {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

async function main() {
  const whiteClusters = clusterWhites();
  const reflectCluster = whiteClusters[0];
  const highlightCluster = whiteClusters[1];
  const highlightBbox = clusterBbox(highlightCluster);
  const hcx = (highlightBbox.minX + highlightBbox.maxX + 1) / 2;
  const hcy = (highlightBbox.minY + highlightBbox.maxY + 1) / 2;
  const hrx = (highlightBbox.maxX - highlightBbox.minX + 1) / 2;
  const hry = (highlightBbox.maxY - highlightBbox.minY + 1) / 2;
  const hr = (hrx + hry) / 2;
  console.log(`Highlight : centre (${hcx}, ${hcy}), rayon ${hr.toFixed(2)}`);
  console.log(`Reflet : ${reflectCluster.length}px`);

  const highlightSet = new Set(highlightCluster.map((p) => p.y * width + p.x));

  // Pass 1 : silhouette complete -> navy
  const bin1 = makeBinary((c) => c !== 'transparent');
  const pathsSilhouette = await trace(bin1);
  console.log(`Pass 1 (silhouette) : ${pathsSilhouette.length} path(s)`);

  // Pass 2 : interieur = sky + other + shadow (on remplit tout l'interieur en sky d'abord,
  // puis la pass 4 vient superposer le shadow en #418FB9 par-dessus)
  const bin2 = makeBinary((c) => c === 'sky' || c === 'other' || c === 'shadow');
  const pathsSky = await trace(bin2);
  console.log(`Pass 2 (sky + tampon + shadow) : ${pathsSky.length} path(s)`);

  // Pass 3 : reflet blanc (sans highlight)
  const bin3 = makeBinary((c, x, y) => c === 'white' && !highlightSet.has(y * width + x));
  const pathsReflect = await trace(bin3);
  console.log(`Pass 3 (reflet) : ${pathsReflect.length} path(s)`);

  // Pass 4 : zones ombragees #418FB9 (bande droite + petit fragment sommet)
  // turdSize = 1 pour preserver meme les plus petits fragments
  const bin4 = makeBinary((c) => c === 'shadow');
  const pathsShadow = await trace(bin4, { turdSize: 1 });
  console.log(`Pass 4 (shadow #418FB9) : ${pathsShadow.length} path(s)`);

  // Ajustement viewBox pour maximiser la taille du bouclier dans la toolbar.
  // Marge 3% de chaque cote -> densite ~88%, aligne sur Bitwarden/LastPass.
  // ViewBox carre (ratio 1:1) centre sur le bouclier. Les coordonnees peuvent etre
  // negatives ou deborder du PNG source : c'est OK en SVG, les zones hors contenu
  // sont simplement transparentes.
  const bbox = computeShieldBbox();
  const bboxW = bbox.maxX - bbox.minX + 1;
  const bboxH = bbox.maxY - bbox.minY + 1;
  const marginPct = 0.03;
  const vbSize = Math.round(Math.max(bboxW, bboxH) * (1 + 2 * marginPct));
  const cxBbox = (bbox.minX + bbox.maxX) / 2;
  const cyBbox = (bbox.minY + bbox.maxY) / 2;
  const vbXFinal = Math.round(cxBbox - vbSize / 2);
  const vbYFinal = Math.round(cyBbox - vbSize / 2);
  const density = ((Math.max(bboxW, bboxH) / vbSize) * 100).toFixed(1);
  console.log(
    `Bouclier bbox (${bbox.minX},${bbox.minY})->(${bbox.maxX},${bbox.maxY}) = ${bboxW}x${bboxH}`
  );
  console.log(`ViewBox ajuste : ${vbXFinal} ${vbYFinal} ${vbSize} ${vbSize} (densite ${density}%)`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbXFinal} ${vbYFinal} ${vbSize} ${vbSize}" width="${vbSize}" height="${vbSize}">
  <!-- Sentinel Nudge logo (potrace multi-passes, source HD, viewBox maximise ~88%) -->
  <!-- Pass 1 : silhouette navy #1E3A5F -->
  ${pathsSilhouette.map((d) => `<path d="${d}" fill="#1E3A5F"/>`).join('\n  ')}
  <!-- Pass 2 : interieur sky #4DA8DA -->
  ${pathsSky.map((d) => `<path d="${d}" fill="#4DA8DA"/>`).join('\n  ')}
  <!-- Pass 4 : zones ombragees #418FB9 (bande droite + fragment sommet) -->
  ${pathsShadow.map((d) => `<path d="${d}" fill="#418FB9"/>`).join('\n  ')}
  <!-- Pass 3 : reflet courbe blanc #FFFFFF -->
  ${pathsReflect.map((d) => `<path d="${d}" fill="#FFFFFF"/>`).join('\n  ')}
  <!-- Highlight : cercle blanc -->
  <circle cx="${hcx}" cy="${hcy}" r="${hr.toFixed(2)}" fill="#FFFFFF"/>
</svg>
`;
  const out = path.resolve(__dirname, 'icon-final.svg');
  fs.writeFileSync(out, svg);
  console.log(`\nSVG final : ${out} (${svg.length} oct.)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
