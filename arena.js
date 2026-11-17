/* Arène 3D de Mordum Extrême : schémas animés de chaque mécanique (Three.js r128).
   Repère : sol = cadran, 12 h = là où le boss regarde au départ. Positions en mètres de jeu « schématiques ». */
(() => {
'use strict';
const R = 20, TAU = Math.PI * 2;
const COL = { r:'#ff5468', b:'#4c9bff', n:'#d8cfbf', death:'#ff3b3b', y:'#f2cf3c', safe:'#3fd77a', w:'#ffffff',
  puddle:'#c39a3a', bolt:'#fff0a0', void:'#030304', gold:'#d4a85a', purple:'#b46cff' };
const col = c => COL[c] || c;
const rad = h => h / 12 * TAU;                                   // heures du cadran → radians (sens horaire depuis le nord)
const pc = (h, d) => [Math.sin(rad(h)) * d, -Math.cos(rad(h)) * d]; // position [x, z] au cadran
const hourOf = (x, z) => ((Math.atan2(x, -z) / TAU * 12) + 12) % 12;
const PN = ['D1', 'D2', 'D3', 'S1', 'D4', 'D5', 'D6', 'S2'];
const RED = [0, 2, 5, 7];                                        // D1 D3 D5 S2 rouges, les autres bleus
const JUMP = { 3: pc(3, R + 0.8), 9: pc(9, R + 0.8) };           // points d'accroche des jumpers (grappins)
const near = (side, k, d = 17) => pc(side + (k - 1.5) * 0.45, d);  // k-ième place près d'un jumper

/* ---------- construction d'un scénario ---------- */
const lastAt = (list, t) => { let v = list[0][1]; for (const [ti, c] of list) { if (ti <= t) v = c; else break; } return v; };
function posAt(p, t) {
  let [x, z] = p.init;
  for (const s of p.segs) {
    if (t <= s.t0) break;
    const f = Math.min(1, (t - s.t0) / Math.max(1e-3, s.t1 - s.t0));
    x += (s.x - x) * f; z += (s.z - z) * f;
  }
  return [x, z];
}
function bossAt(b, t) {
  let [x, z, r] = b.init;
  for (const s of b.segs) {
    if (t <= s.t0) break;
    const f = Math.min(1, (t - s.t0) / Math.max(1e-3, s.t1 - s.t0));
    if (s.x != null) { x += (s.x - x) * f; z += (s.z - z) * f; }
    if (s.rot != null) r += (s.rot - r) * f;
  }
  return [x, z, r];
}
function build(def) {
  const S = { ...def, steps: [], fx: [], clockFn: null,
    pl: PN.map((_, i) => ({ init: pc(i * 1.5, 7), segs: [], cols: [[0, 'n']], air: [] })),
    boss: { init: [0, 0, 0], segs: [], cols: [[0, 'gold']] } };
  const A = {
    S,
    teams() { S.pl.forEach((p, i) => p.cols = [[0, RED.includes(i) ? 'r' : 'b']]); },
    ring(d, start = 0) { S.pl.forEach((p, i) => p.init = pc(start + i * 1.5, d)); },
    place(i, xz) { S.pl[i].init = xz; },
    to(i, t0, t1, xz) { S.pl[i].segs.push({ t0, t1, x: xz[0], z: xz[1] }); },
    color(i, t, c) { S.pl[i].cols.push([t, c]); S.pl[i].cols.sort((a, b) => a[0] - b[0]); },
    air(i, t0, t1) { S.pl[i].air.push([t0, t1]); },
    // Jumper = grappin sur un côté de l'arène (3 h ou 9 h) : il fait traverser jusqu'au côté opposé.
    grapple(i, t0, t1, land, key = 'A / D') {
      const from = A.at(i, t0), side = from[0] >= 0 ? 3 : 9, dst = 12 - side;
      A.fx({ type: 'text', at: i, y: 3.8, t0: t0 - 0.7, t1: t0 + 0.3, text: key, size: 40 });
      A.fx({ type: 'tether', a: i, bp: JUMP[dst], c: 'gold', t0, t1 });
      A.air(i, t0, t1); A.to(i, t0, t1, land || pc(dst, 16.5));
    },
    boss(t0, t1, o) { S.boss.segs.push({ t0, t1, x: o.p ? o.p[0] : null, z: o.p ? o.p[1] : null, rot: o.rot }); },
    bossInit(xz, rot = 0) { S.boss.init = [xz[0], xz[1], rot]; },
    bossColor(t, c) { S.boss.cols.push([t, c]); },
    fx(o) { S.fx.push(o); return o; },
    step(t, txt) { S.steps.push([t, txt]); },
    clock(f) { S.clockFn = f; },
    at(i, t) { return posAt(S.pl[i], t); },
    colorAt(i, t) { return lastAt(S.pl[i].cols, t); },
    hourOf(i, t) { const [x, z] = posAt(S.pl[i], t); return hourOf(x, z); },
  };
  def.make(A);
  S.steps.sort((a, b) => a[0] - b[0]);
  return S;
}

/* ---------- générateurs partagés ---------- */
// 4 pizzas rouge/bleu en 8 parts ; les joueurs se placent sur leur couleur. swapBefore = index de la pizza précédée de l'inversion.
function pizzas(A, times, { swapBefore = -1, d = () => 8, skip = () => false } = {}) {
  times.forEach((th, k) => {
    const off = (k % 2) * 1.5;
    if (k === swapBefore) {
      const ts = th - 3.2;
      A.fx({ type: 'text', t0: ts, t1: ts + 2, p: [0, 0], y: 7.5, text: 'Inversion des couleurs !', size: 54 });
      PN.forEach((_, i) => A.color(i, ts + 0.4, A.colorAt(i, ts) === 'r' ? 'b' : 'r'));
    }
    for (let j = 0; j < 8; j++) {
      const c = j % 2 ? 'b' : 'r', a0 = off + j * 1.5;
      A.fx({ type: 'sector', t0: th - 2.4, t1: th, mode: 'warn', a0, a1: a0 + 1.5, r: R, c });
      A.fx({ type: 'sector', t0: th, t1: th + 0.6, mode: 'hit', a0, a1: a0 + 1.5, r: R, c });
    }
    const slots = { r: 0, b: 0 };
    PN.forEach((_, i) => {
      const c = A.colorAt(i, th - 2.3);
      const j = 2 * (slots[c]++ % 4) + (c === 'r' ? 0 : 1);
      if (!skip(i, k)) A.to(i, th - 2.2, th - 0.9, pc(off + j * 1.5 + 0.75, d(i)));
    });
  });
}

// Rupture de sol : orbe verte côté `side`, trio à flaques, porteur de la croix d'éclair au boss, le reste stagger l'orbe le long du mur.
function stageBreak(A, side, first) {
  A.teams(); A.ring(7, 0.75);
  const orb = pc(side, 17.5);
  A.fx({ type: 'orb', t0: 0, t1: 12.8, path: [[0, ...orb], [12, ...orb], [12.8, 0, -1]], r: 1.4, c: 'safe', shrink: [4, 12], label: 'Orbe · jauge de stagger' });
  const trio = [1, 5, 3], cross = 0, wall = [2, 4, 6, 7];
  const trioPos = [pc(side - 0.6, 15), pc(side + 0.6, 15), pc(side + 0.9, 11)];
  trio.forEach((i, k) => {
    A.fx({ type: 'circle', at: i, t0: 0.4, t1: 8, r: 1.8, c: 'y', mode: 'warn' });
    A.to(i, 1, 4, trioPos[k]);
    A.fx({ type: 'circle', p: trioPos[k], t0: 8, t1: 13.2, r: 2, c: 'puddle', mode: 'zone', op: 0.8 });
  });
  A.fx({ type: 'text', at: cross, y: 3.4, t0: 0.4, t1: 10.8, text: '✚ Croix', size: 40 });
  A.to(cross, 1, 3, pc(side, 4));
  const wallPos = [pc(side - 1.3, 17), pc(side + 1.3, 17), pc(side - 1.0, 13), pc(side + 1.4, 13)];
  wall.forEach((i, k) => A.to(i, 1.5, 4.5, wallPos[k]));
  const cp = pc(side, 4);
  [0, 3, 6, 9].forEach(dh => {
    A.fx({ type: 'rect', p: cp, ang: side + dh, len: 24, w: 1.6, c: 'bolt', mode: 'warn', t0: 8.6, t1: 10 });
    A.fx({ type: 'rect', p: cp, ang: side + dh, len: 24, w: 1.6, c: 'bolt', mode: 'hit', t0: 10, t1: 10.8 });
  });
  PN.forEach((_, i) => A.to(i, 11.2, 12.6, pc(side + 6 + (i - 3.5) * 0.7, 6)));
  A.fx({ type: 'sector', mode: 'void', a0: side - 1.6, a1: side + 1.6, r0: 9, r: R + 0.2, t0: 13, t1: 99 });
  A.step(0, first ? 'L\'orbe verte de la mini-carte indique où le sol va casser.' : 'Même logique que la 1re rupture, de l\'autre côté.');
  A.step(1, 'Les 3 joueurs à flaque (D2, D5, S1) vont vers l\'orbe, dans la zone qui va casser.');
  A.step(2, 'D1 a la croix d\'éclair : il reste près du boss, côté orbe, et est le seul à le staggerer.');
  A.step(4, 'Les autres staggent l\'orbe le long du mur : en Extrême, elle a sa propre jauge.');
  A.step(8, 'Les flaques tombent dans la zone condamnée.');
  A.step(10, 'La croix d\'éclair part en + depuis D1 : personne n\'est sur ses lignes.');
  A.step(12, 'Le boss avale l\'orbe : tout le monde revient au centre.');
  A.step(13, 'Le sol casse et emporte les flaques.');
}

/* ---------- les scénarios ---------- */
const SCN = [
{ id: 'Jauge', group: 'Système', chip: 'Flaques', title: 'Jauge & flaques de 8 min', dur: 14, make(A) {
  A.teams(); A.ring(7);
  A.fx({ type: 'orb', t0: 0, t1: 99, path: [[0, ...pc(3, 18.5)]], r: 1, c: 'safe', label: 'Orbe verte (mini-carte)' });
  A.fx({ type: 'circle', p: pc(9, 15), t0: 0, t1: 99, r: 2.2, c: 'puddle', mode: 'zone', op: 0.8 });
  A.fx({ type: 'text', p: pc(9, 15), y: 2.2, t0: 9, t1: 99, text: 'Mal placée : reste 8 min', size: 34 });
  A.fx({ type: 'sector', t0: 0, t1: 1, mode: 'warn', a0: 0.5, a1: 2.5, r: 12, c: 'death' });
  A.fx({ type: 'sector', t0: 1, t1: 1.6, mode: 'hit', a0: 0.5, a1: 2.5, r: 12, c: 'death' });
  A.color(1, 1.6, 'r');
  A.fx({ type: 'text', at: 1, y: 3.4, t0: 1.6, t1: 5, text: 'Jauge 50 %', size: 40 });
  A.fx({ type: 'circle', at: 1, t0: 2, t1: 8, r: 2.2, c: 'y', mode: 'warn' });
  A.to(1, 2.5, 6.5, pc(3, 16.5));
  A.fx({ type: 'circle', p: pc(3, 16.5), t0: 8, t1: 11.8, r: 2.4, c: 'puddle', mode: 'zone', op: 0.8 });
  A.fx({ type: 'sector', mode: 'void', a0: 1.6, a1: 4.4, r0: 9, r: R + 0.2, t0: 11.8, t1: 99 });
  A.to(1, 9, 11, pc(1.5, 7));
  A.step(0, 'D2 se fait toucher : en Extrême, la jauge monte beaucoup plus vite.');
  A.step(1.6, 'À la moitié de la jauge, sa couleur s\'inverse et une flaque tombera ~6 s plus tard.');
  A.step(2.5, 'Il va du côté de l\'orbe verte de la mini-carte : c\'est là que le sol cassera.');
  A.step(8, 'La flaque tombe. Elle durera 8 minutes.');
  A.step(9, 'Celle de gauche, mal placée, restera jusqu\'au bout.');
  A.step(11.8, 'La 1re rupture du sol emporte toutes les flaques bien placées.');
}},
{ id: 'Jumper', group: 'Système', chip: 'Jumper', title: 'Jumper : grappin A ou D', dur: 9, make(A) {
  A.teams(); A.ring(7, 0.75);
  [0, 1, 4, 5].forEach((i, k) => A.to(i, 0.5, 2.5, near(9, k)));
  A.fx({ type: 'text', p: pc(9, 17), y: 5, t0: 2.6, t1: 4, text: 'Touche affichée : D', size: 44 });
  [0, 1, 4, 5].forEach((i, k) => A.grapple(i, 4 + k * 0.15, 6 + k * 0.15, near(3, k, 16), 'D'));
  A.step(0, 'Les jumpers sont des grappins sur les côtés de l\'arène (3 h et 9 h).');
  A.step(2.6, 'Lis la touche avant d\'appuyer : en Extrême, ce n\'est pas toujours A, parfois D.');
  A.step(4, 'Le grappin te fait traverser jusqu\'à l\'autre côté de l\'arène.');
}},
{ id: '475', group: 'Méchas', chip: '×475', title: 'Marques de foudre', dur: 17, make(A) {
  A.teams(); A.ring(4.5);
  A.fx({ type: 'rect', p: [0, 0], ang: 0, spin: 1.4, len: 21, w: 2, c: 'death', mode: 'zone', op: 0.45, t0: 0, t1: 17 });
  [[0, 1], [4, 6], [7, 11]].forEach(([i, t]) => {
    const h = i * 1.5, edge = pc(h, 18);
    A.fx({ type: 'text', at: i, y: 3.4, t0: t, t1: t + 4, text: '⚡ Marque', size: 40 });
    A.to(i, t + 0.3, t + 2.3, edge);
    [h + 1.5, h - 1.5, h + 4.5, h + 7.5].forEach(a => {
      A.fx({ type: 'rect', p: edge, ang: a, len: 16, w: 1, c: 'bolt', mode: 'warn', t0: t + 2.3, t1: t + 3 });
      A.fx({ type: 'rect', p: edge, ang: a, len: 16, w: 1, c: 'bolt', mode: 'hit', t0: t + 3, t1: t + 3.7 });
    });
    A.to(i, t + 3.9, t + 5.2, pc(h, 4.5));
  });
  A.step(0, 'Le rayon du boss tourne très vite : reste mobile près de lui.');
  A.step(1, 'Marque sur D1 : il part au bord et se tourne face à l\'extérieur.');
  A.step(3.3, 'La foudre part en X depuis lui : les 2 éclairs intérieurs passent loin du groupe.');
  A.step(6, '2e marque (D4) : même chose.');
  A.step(11, '3e marque (S2). Coller au bord le protège de l\'éclair extérieur.');
}},
{ id: '450', group: 'Méchas', chip: '×450', title: 'Quatre pizzas colorées', dur: 17, make(A) {
  A.teams(); A.ring(8, 0.75);
  pizzas(A, [3, 7, 11, 15], { swapBefore: 2 });
  A.step(0, '4 pizzas rouges et bleues : place-toi sur ta couleur.');
  A.step(7.8, 'Texte blanc : la couleur des joueurs s\'inverse. Une seule fois, à un moment aléatoire.');
  A.step(9, 'Ta nouvelle couleur reste jusqu\'à la fin de la méca.');
}},
{ id: '425', group: 'Méchas', chip: '×425', title: 'Orbes, rayon et flaque jaune', dur: 13, make(A) {
  A.teams(); A.ring(10, 0.75);
  A.fx({ type: 'circle', p: [0, 0], r: 5.5, c: 'death', mode: 'zone', op: 0.2, t0: 0, t1: 99 });
  A.fx({ type: 'text', p: pc(6, 5.5), y: 1, t0: 0, t1: 4, text: 'Cercle intérieur interdit', size: 34 });
  for (let k = 0; k < 8; k++) A.fx({ type: 'orb', t0: 1, t1: 4, path: [[1, 0, 0], [4, ...pc(k * 1.5, 20)]], r: 0.6, c: 'y' });
  A.fx({ type: 'circle', at: 2, t0: 4, t1: 99, r: 3.5, c: 'y', mode: 'zone', op: 0.22 });
  A.fx({ type: 'text', at: 2, y: 3.4, t0: 4, t1: 7, text: 'Flaque jaune', size: 40 });
  A.to(2, 5, 8, pc(4.4, 11));
  A.to(4, 5.3, 8.3, pc(5.3, 12.5));
  A.to(3, 8.6, 9.4, pc(4.4, 14.5));
  A.fx({ type: 'text', p: [0, 0], y: 7.5, t0: 8.2, t1: 9.8, text: 'Mains rassemblées !', size: 50 });
  A.fx({ type: 'rect', p: [0, 0], ang: 6, len: 21, w: 5, c: 'death', mode: 'hit', t0: 9.8, t1: 10.6 });
  A.step(0, 'Le cercle intérieur, sûr dans l\'original, remplit ta jauge : wipe.');
  A.step(1, 'Esquive d\'abord les orbes.');
  A.step(4, 'D3 a la flaque jaune : elle blesse les joueurs à portée.');
  A.step(5, 'D4 ne peut pas s\'écarter sans risquer le rayon : il suit D3.');
  A.step(8.2, 'Les mains se rassemblent : le rayon part sans aucun rectangle d\'alerte.');
  A.step(9.8, 'Rayon.');
}},
{ id: '400', group: 'Méchas', chip: '×400', title: 'Pizzas, un seul swap', dur: 17, make(A) {
  A.teams(); A.ring(8, 0.75);
  pizzas(A, [3, 7, 11, 15], { swapBefore: 1 });
  A.step(0, 'Même principe que ×450.');
  A.step(3.8, 'L\'unique inversion arrive ici avant la 2e pizza.');
  A.step(5, 'Plus aucun changement jusqu\'à la fin.');
}},
{ id: '375', group: 'Méchas', chip: '×375', title: '1re rupture de sol', dur: 16, make(A) { stageBreak(A, 3, true); } },
{ id: '325', group: 'Méchas', chip: '×325', title: 'Dôme coloré & orbes chasseuses', dur: 15, make(A) {
  A.teams(); A.ring(9);
  A.fx({ type: 'dome', p: [0, 0], r: 6, t0: 0.5, t1: 99, cols: [[0, 'y'], [2.5, 'r']] });
  PN.forEach((_, i) => A.to(i, 3, 5, pc(i * 1.5, A.colorAt(i, 0) === 'r' ? 3.5 : 12)));
  const k = { 3: 0, 9: 0 };
  PN.forEach((_, i) => {
    const side = A.at(i, 5)[0] >= 0 ? 3 : 9, n = k[side]++;
    A.to(i, 5.6, 7.2, near(side, n));
    A.fx({ type: 'orb', t0: 5.5, t1: 8.6, path: [[5.5, 0, 0], [8.4, ...near(side, n)]], r: 0.55, c: 'y' });
    const land = near(12 - side, n, 15.5);
    A.grapple(i, 7.4 + n * 0.1, 8.8 + n * 0.1, land);
    const mine = pc(12 - side + (n - 1.5) * 0.7, 10);
    A.fx({ type: 'orb', t0: 9, t1: 12.4, path: [[9, ...mine]], r: 0.5, c: A.colorAt(i, 0) });
    A.to(i, 10.5, 12.3, mine);
  });
  A.step(0.5, 'Un hémisphère jaune apparaît autour du boss.');
  A.step(2.5, 'Il devient rouge : les rouges entrent, les bleus restent dehors.');
  A.step(5.5, '8 orbes jaunes, une par joueur, te poursuivent.');
  A.step(7.4, 'Plutôt que de marcher, prends le jumper : le grappin te fait traverser l\'arène et les orbes te ratent. Une orbe qui te touche laisse une flaque de 8 min.');
  A.step(9, 'Ramasse ensuite l\'orbe de ta couleur, sinon elle laisse aussi une flaque.');
}},
{ id: '300', group: 'Méchas', chip: '×300', title: '1re Supernova', dur: 9, make(A) {
  A.teams(); A.ring(6, 0.75);
  A.fx({ type: 'text', p: [0, 0], y: 7.5, t0: 0, t1: 3.6, text: 'Supernova · pas de contre', size: 46 });
  A.fx({ type: 'circle', p: [0, 0], r: 11, c: 'death', mode: 'warn', t0: 1, t1: 4.6 });
  A.fx({ type: 'circle', p: [0, 0], r: 11, c: 'death', mode: 'hit', t0: 4.6, t1: 5.2 });
  A.fx({ type: 'ring', p: [0, 0], r0: 11, r1: 21, c: 'death', t0: 5.2, t1: 7.2 });
  PN.forEach((_, i) => {
    const side = i < 4 ? 9 : 3, n = i % 4;
    A.to(i, 1.2, 3.4, near(side, n));
    A.grapple(i, 4.3, 7.4, near(12 - side, n, 16.5));
  });
  A.step(0, 'Contrairement à l\'original, pas de contre possible.');
  A.step(1.2, 'Placez-vous près des jumpers, sur les côtés.');
  A.step(3.6, 'Prends le jumper juste avant le smash…');
  A.step(5.2, '…la traversée te fait éviter l\'impact puis l\'onde de choc.');
}},
{ id: '275', group: 'Méchas', chip: '×275', title: 'L\'enclume', dur: 16, make(A) {
  A.teams(); PN.forEach((_, i) => A.place(i, pc(3.2 + i * 0.8, 6.5)));
  [2.5, 5, 9.5, 11.5, 13.5].forEach(th => {
    A.fx({ type: 'text', p: [0, 0], y: 7.5, t0: th - 0.9, t1: th, text: 'G', size: 70 });
    A.fx({ type: 'sector', a0: -1.5, a1: 1.5, r: 16, c: 'death', mode: 'warn', t0: th - 1.2, t1: th });
    A.fx({ type: 'sector', a0: -1.5, a1: 1.5, r: 16, c: 'death', mode: 'hit', t0: th, t1: th + 0.5 });
    A.fx({ type: 'ring', p: [0, 0], r0: 2, r1: 20, c: 'y', t0: th, t1: th + 1 });
    PN.forEach((_, i) => A.fx({ type: 'text', at: i, y: 3.2, t0: th - 0.4, t1: th + 0.4, text: '🛡', size: 44 }));
  });
  A.step(0, 'Guard au moins 5 fois. Regarde le marteau tiré en arrière, pas l\'éclair.');
  A.step(2.5, '1er coup : G quand le marteau bouge.');
  A.step(5, '2e coup.');
  A.step(6.5, 'Le 3e est très lent : attends-le.');
  A.step(11.5, '4e, puis 5e. Ne reste jamais face à lui.');
  A.step(14.2, 'Si quelqu\'un rate, ça continue. Pas d\'hyper éveil ici.');
}},
{ id: '250', group: 'Méchas', chip: '×250', title: '2e rupture de sol', dur: 16, make(A) { stageBreak(A, 9, false); } },
{ id: '200', group: 'Méchas', chip: '×200', title: 'Gros orbe central', dur: 14, note: 'Schéma simplifié : la vidéo ne montre pas qui détruit quels petits orbes.', make(A) {
  A.teams();
  let kr = 0, kb = 0;
  PN.forEach((_, i) => A.place(i, A.colorAt(i, 0) === 'r' ? near(9, kr++, 12) : near(3, kb++, 12)));
  [[9, 'r'], [3, 'b']].forEach(([side, c]) => [-0.8, 0, 0.8].forEach((o, k) => {
    const a = pc(side + o, 19.5), b = pc(side + o * 0.4, 3);
    A.fx({ type: 'orb', t0: 1, t1: 6 + k * 2.4, path: [[1, ...a], [14, ...b]], r: 0.6, c, shrink: [4 + k * 2.4, 6 + k * 2.4] });
  }));
  A.fx({ type: 'orb', t0: 2.5, t1: 10.5, path: [[2.5, ...pc(12, 19.5)], [10.5, ...pc(12, 9.5)]], r: 1.6, c: 'r', shrink: [6.2, 10.5], label: 'Gros orbe : s\'il touche le boss = wipe' });
  kr = 0; kb = 0;
  PN.forEach((_, i) => {
    if (A.colorAt(i, 0) === 'r') { const n = kr++; A.to(i, 3.4, 4.6, near(9, n)); A.grapple(i, 4.9, 6.6, near(3, n, 14)); }
    else A.to(i, 4.8, 6.2, pc(12 + (kb++ - 1.5) * 0.7, 6.5));
  });
  A.step(0, 'Orbes rouges à gauche, bleus à droite.');
  A.step(2.5, 'Nouveau : un gros orbe arrive au centre. Ici, il est rouge.');
  A.step(3.4, 'Les rouges (même couleur) prennent le jumper : le grappin les fait passer de l\'autre côté.');
  A.step(5, 'Les bleus passent devant le boss pour détruire le gros orbe.');
  A.step(10.5, 'Détruisez aussi tous les petits orbes, sinon le boss gagne un bouclier.');
}},
{ id: '180', group: 'Méchas', chip: '×180', title: 'Cases de couleur', dur: 9, make(A) {
  A.teams(); A.ring(6, 0.75);
  const c4 = [-11.25, -3.75, 3.75, 11.25], tiles = { r: [], b: [] };
  c4.forEach((x, ix) => c4.forEach((z, iz) => {
    const c = (ix + iz) % 2 ? 'b' : 'r';
    tiles[c].push([x, z]);
    A.fx({ type: 'square', p: [x, z], s: 7.3, c, mode: 'zone', op: 0.3, t0: 0.5, t1: 99 });
    A.fx({ type: 'square', p: [x, z], s: 7.3, c, mode: 'hit', t0: 6, t1: 6.8 });
  }));
  for (const c of ['r', 'b']) tiles[c].sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  const k = { r: 0, b: 0 };
  PN.forEach((_, i) => { const c = A.colorAt(i, 0), [x, z] = tiles[c][k[c]++ % 4]; A.to(i, 1.5, 4, [x + (i % 2 ? 1 : -1), z]); });
  A.step(0.5, 'Le sol se découpe en cases rouges et bleues.');
  A.step(1.5, 'Va simplement sur une case de ta couleur.');
  A.step(6, 'Colonnes de foudre : sur ta couleur, tu ne prends rien.');
}},
...['160', '160b'].map((id, ci) => ({ id, group: 'Méchas', chip: ci ? '×160 cas 2' : '×160 cas 1',
  title: ci ? 'Stagger & swap blanc · cas 2' : 'Stagger & swap blanc · cas 1', dur: 13,
  note: 'Schéma simplifié tiré des consignes du simulateur affichées dans la vidéo.', make(A) {
  A.teams(); A.ring(6, 0.75); A.bossColor(0, 'r');
  A.fx({ type: 'text', p: [0, 0], y: 7.5, t0: 0, t1: 3, text: 'Stagger · Balthor +1', size: 46 });
  const blues = PN.map((_, i) => i).filter(i => A.colorAt(i, 0) === 'b');
  blues.forEach((i, k) => A.to(i, 3.4, 5.4, pc(12 + (k - 1.5) * 0.9, 4)));
  const carrier = ci ? blues[0] : 2;
  A.fx({ type: 'circle', at: carrier, t0: 6, t1: 10.5, r: 2.8, c: 'w', mode: 'zone', op: 0.35 });
  A.fx({ type: 'text', at: carrier, y: 3.4, t0: 6, t1: 8.5, text: 'Zone blanche', size: 40 });
  if (!ci) {
    A.to(carrier, 7, 9, pc(12, 6.2));
    blues.forEach((i, k) => A.to(i, 8.6, 9.6, pc(12 + (k - 1.5) * 0.5, 6.4 + (k % 2) * 0.8)));
  }
  blues.forEach(i => A.color(i, 10, 'r'));
  A.fx({ type: 'text', p: [0, 0], y: 7.5, t0: 10.3, t1: 13, text: 'Tout le monde est rouge', size: 46 });
  A.step(0, 'Stagger du boss en ignorant le marteau ; le lead lance Balthor +1 pendant le stagger.');
  A.step(3.4, 'Les couleurs différentes du boss (ici les bleus) se regroupent d\'abord au boss.');
  A.step(6, ci ? 'Cas 2 : la zone blanche tombe sur un bleu (joueur au hasard en Extrême).'
                : 'Cas 1 : la zone blanche tombe sur D3, qui a déjà la bonne couleur.');
  A.step(7, ci ? 'Comme dans l\'original, les bleus swap ensemble devant le boss.'
              : 'D3 va vers la couleur opposée la plus proche ; ceux qui doivent changer le suivent.');
  A.step(10, 'Swap.');
}})),
{ id: '140', group: 'Méchas', chip: '×140', title: 'Flaques et 4 pizzas', dur: 16, make(A) {
  A.teams(); A.ring(5, 0.75);
  const pud = [1, 5];
  pizzas(A, [2.5, 5.5, 8.5, 11.5], { d: i => pud.includes(i) ? 3.5 : 8 });
  pud.forEach((i, k) => {
    const drop = pc(3 + (k ? 0.5 : -0.5), 17);
    A.fx({ type: 'circle', at: i, t0: 0.5, t1: 13.2, r: 2, c: 'y', mode: 'warn' });
    A.to(i, 12.1, 13, drop);
    A.fx({ type: 'circle', p: drop, t0: 13.2, t1: 99, r: 2.4, c: 'puddle', mode: 'zone', op: 0.8 });
    A.to(i, 13.6, 14.6, pc(3 + (k ? 1.6 : -1.6), 11));
  });
  A.step(0.5, 'D2 et D5 reçoivent une flaque ; la pizza va tomber 4 fois.');
  A.step(1, 'Restez au centre, sur la pizza de votre couleur.');
  A.step(12.1, 'Juste avant que la flaque tombe, filez au bord droit (prochaine rupture).');
  A.step(13.2, 'Flaque posée sur le bord droit. Ensuite, esquivez-la.');
}},
{ id: 'Zigzag', group: 'Méchas', chip: 'Zigzag', title: 'Zigzag rouge & bleu', dur: 16, make(A) {
  A.teams(); A.bossInit(pc(12, 9), 6);
  const L = [pc(8, 6), pc(9, 9), pc(8.2, 12), pc(9.8, 5)], Rg = [pc(4, 6), pc(3, 9), pc(3.8, 12), pc(2.2, 5)];
  let kr = 0, kb = 0;
  PN.forEach((_, i) => A.place(i, A.colorAt(i, 0) === 'r' ? L[kr++] : Rg[kb++]));
  A.fx({ type: 'sector', a0: 6, a1: 12, r: R, c: 'r', mode: 'zone', op: 0.22, t0: 0, t1: 9 });
  A.fx({ type: 'sector', a0: 0, a1: 6, r: R, c: 'b', mode: 'zone', op: 0.22, t0: 0, t1: 9 });
  A.fx({ type: 'sector', a0: 6, a1: 12, r: R, c: 'b', mode: 'zone', op: 0.22, t0: 9, t1: 99 });
  A.fx({ type: 'sector', a0: 0, a1: 6, r: R, c: 'r', mode: 'zone', op: 0.22, t0: 9, t1: 99 });
  A.boss(2, 3, { p: pc(12, 3) }); A.boss(3.8, 4.6, { p: pc(12, 9) });
  const guard = th => PN.forEach((_, i) => A.fx({ type: 'text', at: i, y: 3.2, t0: th - 0.4, t1: th + 0.4, text: '🛡', size: 44 }));
  guard(3);
  A.fx({ type: 'sector', a0: 4, a1: 8, r: R, c: 'death', mode: 'warn', t0: 4.6, t1: 6.2 });
  A.fx({ type: 'sector', a0: 4, a1: 8, r: R, c: 'death', mode: 'hit', t0: 6.2, t1: 6.8 });
  PN.forEach((_, i) => { const [x] = A.at(i, 5); A.to(i, 5.2, 6, [x * 1.6, -6.5 - (i % 3)]); });
  PN.forEach((_, i) => A.fx({ type: 'text', at: i, y: 3.2, t0: 9, t1: 10.8, text: '★', size: 50 }));
  A.fx({ type: 'text', p: [0, 0], y: 7.5, t0: 9, t1: 10.8, text: '3e zigzag : hyper éveil', size: 46 });
  guard(12.4); guard(13.4);
  PN.forEach((_, i) => { const [x, z] = A.at(i, 14); const m = Math.hypot(x, z) || 1; A.to(i, 14.3, 15.5, [x / m * 15, z / m * 15]); });
  A.step(0, 'Sois sur ta couleur.');
  A.step(2, 'Il se rapproche : guard.');
  A.step(4.6, '2e attaque : esquive-la, elle te fait tomber de l\'arène.');
  A.step(9, '3e zigzag : pas de guard, hyper éveil (trop dur d\'être de la bonne couleur et de guard).');
  A.step(12, 'Couleur critique, puis guard deux fois.');
  A.step(14.3, 'Éloigne-toi du centre.');
}},
{ id: 'SN2', group: 'Méchas', chip: 'Supernova 2', title: '2e Supernova', dur: 12, make(A) {
  A.teams(); A.ring(6, 0.75);
  A.fx({ type: 'sector', mode: 'void', a0: -1.5, a1: 1.5, r0: 8, r: R + 0.2, t0: 0, t1: 99 });
  A.fx({ type: 'sector', mode: 'void', a0: 4.5, a1: 7.5, r0: 8, r: R + 0.2, t0: 0, t1: 99 });
  PN.forEach((_, i) => A.place(i, near(9, i % 4, 13 + (i >> 2) * 2.5)));
  A.fx({ type: 'text', p: [0, 0], y: 7.5, t0: 0, t1: 1.6, text: '1re charge', size: 50 });
  PN.forEach((_, i) => A.grapple(i, 0.8 + (i % 4) * 0.08, 2.6 + (i % 4) * 0.08, near(3, i % 4, 13 + (i >> 2) * 2.5)));
  A.boss(2.6, 3.6, { p: pc(9, 24) });
  A.fx({ type: 'circle', p: pc(9, 24), r: 9, c: 'death', mode: 'warn', t0: 2.4, t1: 3.8 });
  A.fx({ type: 'circle', p: pc(9, 24), r: 9, c: 'death', mode: 'hit', t0: 3.8, t1: 4.3 });
  A.fx({ type: 'circle', p: pc(9, 24), r: 9, c: 'puddle', mode: 'zone', op: 0.8, t0: 4.3, t1: 99 });
  A.boss(5, 6.2, { p: [0, 0] });
  A.step(0, 'L\'arène est déjà petite après les ruptures.');
  A.step(0.8, 'Dès sa 1re charge, prends le jumper : le grappin te fait traverser l\'arène.');
  A.step(2.4, 'Il frappe là où vous étiez : du côté opposé (180°), hors du terrain.');
  A.step(4.3, 'La grande flaque tombe dans le vide, pas sur l\'arène.');
  A.step(5, 'Lis bien la touche du jumper : A ou D.');
}},
{ id: 'lignes', group: 'Barre 0', chip: 'Lignes', title: 'Lignes mortelles (post-0)', dur: 15, make(A) {
  A.teams(); A.ring(7, 0.75);
  A.clock(t => { const s = Math.max(0, Math.ceil(65 - t)); return `Enrage ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; });
  const wave = (stack, tGather, tOut, angs, outs) => {
    PN.forEach((_, i) => A.to(i, tGather, tGather + 1.8, [stack[0] + ((i % 3) - 1) * 0.6, stack[1] + (Math.floor(i / 3) - 1) * 0.6]));
    angs.forEach(a => [a, a + 6].forEach(h => {
      A.fx({ type: 'rect', p: stack, ang: h, len: 26, w: 1.8, c: 'death', mode: 'warn', t0: tOut - 2.6, t1: tOut + 0.2 });
      A.fx({ type: 'rect', p: stack, ang: h, len: 26, w: 1.8, c: 'death', mode: 'hit', t0: tOut + 0.2, t1: tOut + 0.9 });
    }));
    PN.forEach((_, i) => { const h = outs[i % outs.length], o = pc(h, 4 + (i >= outs.length ? 1.6 : 0)); A.to(i, tOut, tOut + 0.6, [stack[0] + o[0], stack[1] + o[1]]); });
  };
  wave(pc(6, 8), 0, 4, [0, 2, 4], [1, 3, 5, 7, 9, 11]);
  wave(pc(9, 6), 6, 11, [1, 3, 5], [0, 2, 4, 6, 8, 10]);
  A.step(0, 'Tout le monde se regroupe.');
  A.step(1.4, 'Les lignes se dessinent sur le groupe.');
  A.step(4, 'Chrono d\'enrage à 1:01 : sortez tous en même temps.');
  A.step(6, 'On se regroupe ailleurs.');
  A.step(11, 'Chrono à 0:54 : sortez.');
  A.step(12.5, 'Le pattern se répète ensuite : tout en dégâts.');
}},
{ id: 'chain', group: 'Barre 0', chip: 'Chain beam', title: 'Chain beam (phase 3)', dur: 12, make(A) {
  A.teams(); A.ring(7, 0.75);
  A.fx({ type: 'tether', a: 2, b: 3, c: 'purple', t0: 1, t1: 99 });
  [2, 3].forEach(i => A.fx({ type: 'text', at: i, y: 3.4, t0: 1, t1: 3, text: '⛓', size: 46 }));
  A.to(2, 2, 4, pc(11.6, 5)); A.to(3, 2, 4, pc(0.4, 5));
  const six = [0, 1, 4, 5, 6, 7];
  six.forEach((i, k) => A.to(i, 2, 4.5, near(9, k % 4, k < 4 ? 17 : 14)));
  A.fx({ type: 'rect', p: [0, 0], aim: 2, len: 22, w: 3, c: 'death', mode: 'warn', t0: 3, t1: 7.4 });
  A.to(2, 6.6, 7.3, pc(2.3, 7)); A.to(3, 6.6, 7.3, pc(2.9, 8.5));
  six.forEach((i, k) => A.grapple(i, 6.6 + (k % 4) * 0.08, 8.6 + (k % 4) * 0.08, near(3, k % 4, k < 4 ? 16 : 13.5)));
  A.fx({ type: 'rect', p: [0, 0], ang: 12, spin: -2, len: 22, w: 4, c: 'death', mode: 'hit', t0: 7.4, t1: 8.8 });
  A.step(1, 'D3 et S1 sont enchaînés : ils ne peuvent pas prendre le jumper.');
  A.step(3, 'Le boss vise l\'un d\'eux avec un rayon one-shot. Ils l\'aggro au centre.');
  A.step(4, 'Les 6 autres vont à gauche, près du jumper.');
  A.step(6.6, 'Les enchaînés esquivent à droite ; les 6 autres prennent le jumper (A ou D) et traversent l\'arène.');
  A.step(7.4, 'Le rayon part du côté où il y avait le plus de monde : il ne touche plus personne.');
}},
];

/* ---------- moteur ---------- */
const $ = id => document.getElementById(id);
const canvas = $('arena');
if (!canvas) return;
const byId = Object.fromEntries(SCN.map(s => [s.id, s]));
document.querySelectorAll('[data-sim]').forEach(b => { if (!byId[b.dataset.sim]) b.remove(); });
if (!window.THREE) { $('simCap').textContent = 'Impossible de charger la 3D (Three.js bloqué ?).'; return; }

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
catch (e) { $('simCap').textContent = 'WebGL indisponible sur ce navigateur.'; return; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;const scene = new THREE.Scene();
scene.background = new THREE.Color('#07070b');
scene.fog = new THREE.Fog('#07070b', 45, 90);
const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 300);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 10; controls.maxDistance = 80;
scene.add(new THREE.HemisphereLight('#c9c2ff', '#1a1208', 0.75));
const sun = new THREE.DirectionalLight('#ffe6b8', 1.1); sun.position.set(15, 30, 10); scene.add(sun);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
const rimLight = new THREE.DirectionalLight('#8a7cff', 0.5); rimLight.position.set(-12, 14, -20); scene.add(rimLight);

function sprite(txt, size = 40, color = '#fff') {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  const font = `700 ${size}px "Golos Text","Segoe UI",sans-serif`;
  x.font = font;
  const w = Math.ceil(x.measureText(txt).width + size * 0.9), h = Math.ceil(size * 1.5);
  c.width = w; c.height = h; x.font = font;
  x.fillStyle = 'rgba(8,8,12,.72)'; x.fillRect(0, 0, w, h);
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const k = size / 40 * 1.1; s.scale.set(k * w / h, k, 1); s.renderOrder = 20;
  return s;
}

// sol en cadran
(() => {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d'), m = 512;
  const g = x.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, '#272b42'); g.addColorStop(1, '#14162a'); x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  x.strokeStyle = 'rgba(212,168,90,.22)'; x.lineWidth = 2;
  for (const r of [5, 10, 15]) { x.beginPath(); x.arc(m, m, r / R * m, 0, TAU); x.stroke(); }
  x.strokeStyle = 'rgba(255,255,255,.07)';
  for (let h = 0; h < 12; h++) { const a = rad(h); x.beginPath(); x.moveTo(m, m); x.lineTo(m + Math.sin(a) * m, m - Math.cos(a) * m); x.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const cliff = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.8, 8, 96, 1, true), new THREE.MeshStandardMaterial({ color: '#191623', side: THREE.DoubleSide, roughness: 1 }));
  cliff.position.y = -4; scene.add(cliff);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.12, 8, 128), new THREE.MeshBasicMaterial({ color: COL.gold }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.05; scene.add(rim);
})();
const dial = new THREE.Group(); scene.add(dial);
for (const h of [12, 3, 6, 9]) { const s = sprite(String(h), 64, COL.gold), [x, z] = pc(h, R + 2); s.position.set(x, 1, z); dial.add(s); }
// jumpers : un grappin sur chaque côté de l'arène
for (const h of [3, 9]) {
  const [x, z] = JUMP[h], post = new THREE.Group(); post.position.set(x, 0, z); scene.add(post);
  const gold = new THREE.MeshStandardMaterial({ color: COL.gold, emissive: COL.gold, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.8, 10), gold); pole.position.y = 1.4; post.add(pole);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 8, 24), gold); hook.position.y = 3; post.add(hook);
  const lbl = sprite('Jumper', 34, COL.gold); lbl.position.y = 4.2; post.add(lbl);
}

// boss : Mordum, géant en armure avec cornes, couronne de pointes, grosses mains et marteau
const boss = new THREE.Group(); scene.add(boss);
const bossModel = new THREE.Group(); bossModel.scale.setScalar(1.2); boss.add(bossModel);
const coreMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: COL.gold, emissiveIntensity: 1.6 });
const runeMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffcf6a', emissiveIntensity: 0.9 });
const bossUpper = new THREE.Group(), bossHands = [];
(() => {
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.6, ...o });
  const armor = M('#4a5688', { metalness: 0.5, roughness: 0.35 }), dark = M('#262033', { metalness: 0.3, roughness: 0.7 }),
        gold = M('#c9a052', { metalness: 0.9, roughness: 0.28 }), bone = M('#e6dfcf', { metalness: 0.1, roughness: 0.55 });
  const add = (parent, geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); if (r) m.rotation.set(...r); m.castShadow = true; parent.add(m); return m; };
  const lathe = pts => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const seg = (parent, a, b, r0, r1, mat) => {            // segment conique de a (rayon r0) à b (rayon r1)
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, A.distanceTo(B), 10), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    m.castShadow = true; parent.add(m); return m;
  };
  const horn = (parent, pts, r, mat) => { const n = pts.length - 1; for (let k = 0; k < n; k++) seg(parent, pts[k], pts[k + 1], r * (1 - k / n) + 0.02, r * (1 - (k + 1) / n) + 0.02, mat); };

  // robe et bas du corps
  add(bossModel, lathe([[0, 0], [2.5, 0.05], [2.3, 0.6], [1.9, 1.6], [1.45, 2.8], [1.3, 3.2], [0, 3.2]]), dark, [0, 0, 0]);
  add(bossModel, new THREE.TorusGeometry(2.42, 0.09, 8, 48), gold, [0, 0.3, 0], [Math.PI / 2, 0, 0]);
  add(bossModel, new THREE.TorusGeometry(1.92, 0.06, 8, 48), runeMat, [0, 1.6, 0], [Math.PI / 2, 0, 0]);
  bossModel.add(bossUpper);
  // torse
  add(bossUpper, lathe([[0, 3], [1.35, 3.05], [1.75, 3.8], [1.95, 4.6], [1.7, 5.4], [1.0, 5.8], [0, 5.85]]), armor, [0, 0, 0]);
  add(bossUpper, new THREE.TorusGeometry(1.36, 0.1, 8, 40), gold, [0, 3.1, 0], [Math.PI / 2, 0, 0]);
  add(bossUpper, new THREE.SphereGeometry(0.55, 20, 14), coreMat, [0, 4.5, -1.72]);
  add(bossUpper, new THREE.TorusGeometry(0.72, 0.1, 10, 32), gold, [0, 4.5, -1.68]);
  // tête, yeux, cornes
  const head = new THREE.Group(); head.position.set(0, 6.35, -0.1); bossUpper.add(head);
  add(head, new THREE.SphereGeometry(0.85, 20, 16), armor, [0, 0, 0]);
  add(head, new THREE.BoxGeometry(1.1, 0.9, 0.5), dark, [0, -0.15, -0.6]);
  add(head, new THREE.SphereGeometry(0.12, 10, 8), coreMat, [0.28, 0.05, -0.86]);
  add(head, new THREE.SphereGeometry(0.12, 10, 8), coreMat, [-0.28, 0.05, -0.86]);
  for (const s of [1, -1]) horn(head, [[0.6 * s, 0.3, 0], [1.5 * s, 0.9, 0.2], [2.1 * s, 1.9, 0.5], [2.0 * s, 3.0, 0.9], [1.6 * s, 3.7, 1.3]], 0.32, bone);
  // couronne de pointes dans le dos
  for (let k = 0; k < 9; k++) {
    const a = (k - 4) / 4 * 1.15, L = 3.4 - Math.abs(k - 4) * 0.35;
    seg(bossUpper, [Math.sin(a) * 0.6, 6 + Math.cos(a) * 0.3, 0.9], [Math.sin(a) * (0.6 + L), 6 + Math.cos(a) * L, 1.6], 0.22, 0.02, bone);
  }
  // épaules, bras, mains
  for (const s of [1, -1]) {
    const sh = [2.0 * s, 5.2, 0];
    add(bossUpper, new THREE.SphereGeometry(1.05, 18, 12, 0, TAU, 0, Math.PI * 0.6), armor, [sh[0], sh[1] - 0.1, 0]);
    add(bossUpper, new THREE.TorusGeometry(1.0, 0.07, 8, 32), gold, [sh[0], sh[1] - 0.45, 0], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 3; k++) seg(bossUpper, [sh[0] + s * (0.3 + k * 0.25), 5.7, -0.4 + k * 0.4], [sh[0] + s * (1.1 + k * 0.3), 7 - k * 0.2, -0.6 + k * 0.5], 0.18, 0.02, bone);
    const elbow = [2.9 * s, 3.7, -0.2], wrist = [3.1 * s, 2.3, -1.0];
    seg(bossUpper, sh, elbow, 0.55, 0.45, armor); seg(bossUpper, elbow, wrist, 0.45, 0.38, armor);
    add(bossUpper, new THREE.TorusGeometry(0.42, 0.08, 8, 24), gold, wrist, [Math.PI / 2, 0, 0]);
    const hand = new THREE.Group(); hand.position.set(wrist[0], wrist[1] - 0.3, wrist[2] - 0.2); bossUpper.add(hand); bossHands.push(hand);
    add(hand, new THREE.BoxGeometry(1.0, 0.45, 1.1), armor, [0, -0.2, -0.2]);
    for (let f = 0; f < 4; f++) {
      const fx = (f - 1.5) * 0.26;
      seg(hand, [fx, -0.3, -0.7], [fx * 1.2, -0.9, -1.25], 0.11, 0.07, dark);
      seg(hand, [fx * 1.2, -0.9, -1.25], [fx * 1.3, -1.35, -1.1], 0.07, 0.015, gold);
    }
    seg(hand, [-0.5 * s, -0.25, -0.3], [-0.85 * s, -0.7, -0.9], 0.1, 0.03, dark);
  }
  // marteau dans la main droite
  const hammer = new THREE.Group(); hammer.position.set(3.15, 0, -1.3); bossUpper.add(hammer);
  seg(hammer, [0, 0.2, 0], [0, 6, 0], 0.16, 0.16, dark);
  add(hammer, new THREE.BoxGeometry(2.0, 1.1, 1.1), armor, [0, 6.4, 0]);
  add(hammer, new THREE.BoxGeometry(2.08, 0.18, 1.18), gold, [0, 6.95, 0]);
  add(hammer, new THREE.BoxGeometry(2.08, 0.18, 1.18), gold, [0, 5.85, 0]);
  add(hammer, new THREE.BoxGeometry(0.3, 0.9, 1.16), runeMat, [0, 6.4, 0]);
  // flèche au sol : direction du boss
  const tri = new THREE.Mesh(new THREE.CircleGeometry(1, 3), new THREE.MeshBasicMaterial({ color: COL.gold, transparent: true, opacity: 0.85 }));
  tri.rotation.set(-Math.PI / 2, 0, Math.PI / 2); tri.position.set(0, 0.06, -3.7); boss.add(tri);
})();
function bossIdle(sec) {
  bossUpper.position.y = Math.sin(sec * 1.4) * 0.12;
  bossHands.forEach((h, k) => { h.rotation.x = Math.sin(sec * 1.4 + k) * 0.1; });
  runeMat.emissiveIntensity = 0.7 + Math.sin(sec * 2.2) * 0.3;
}

// joueurs : modèle Soldier animé (repos / course), teinté rouge ou bleu ; capsule en attendant le chargement
const players = PN.map((name, i) => {
  const g = new THREE.Group(); scene.add(g);
  const fig = new THREE.Group(); fig.scale.setScalar(1.35); g.add(fig);
  const mat = new THREE.MeshStandardMaterial({ color: '#ddd', roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.3, 14), mat); body.position.y = 0.65; fig.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10), mat); head.position.y = 1.6; fig.add(head);
  const baseMat = new THREE.MeshBasicMaterial({ color: '#ddd', transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const base = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.15, 32), baseMat); base.rotation.x = -Math.PI / 2; base.position.y = 0.06; g.add(base);
  const label = sprite(name, 34, i === 3 || i === 7 ? '#8fd3bf' : '#ece5d7'); label.position.y = 3.2; g.add(label);
  return { g, fig, mat, baseMat, label, c: null, tint: null, mixer: null, act: null };
});
function tintPlayer(P, c) {
  P.mat.color.set(col(c)); P.mat.emissive.set(col(c)).multiplyScalar(0.3); P.baseMat.color.set(col(c));
  if (P.tint) P.tint.forEach(m => { m.color.set('#ffffff').lerp(new THREE.Color(col(c)), 0.45); m.emissive.set(col(c)); m.emissiveIntensity = 0.32; });
}
// modèle chargé en arrière-plan depuis un script base64 (les .glb ne sont pas servis partout)
if (THREE.GLTFLoader && THREE.SkeletonUtils) {
  const sc = document.createElement('script'); sc.src = 'models/soldier-glb.js'; sc.async = true;
  sc.onerror = () => console.warn('soldier-glb.js introuvable');
  sc.onload = () => { try { loadSoldier(Uint8Array.from(atob(window.SOLDIER_GLB), ch => ch.charCodeAt(0)).buffer); } catch (e) { console.warn('Soldier', e); } };
  document.head.appendChild(sc);
}
function loadSoldier(bin) {
  new THREE.GLTFLoader().parse(bin, '', gl => {
    const box = new THREE.Box3().setFromObject(gl.scene), k = 2.3 / ((box.max.y - box.min.y) || 1.8);
    const clip = n => gl.animations.find(a => a.name === n);
    players.forEach(P => {
      const m = THREE.SkeletonUtils.clone(gl.scene); m.scale.setScalar(k);
      P.tint = [];
      m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.castShadow = true; o.frustumCulled = false; P.tint.push(o.material); } });
      P.g.add(m); P.fig.visible = false;
      P.mixer = new THREE.AnimationMixer(m);
      P.act = { idle: P.mixer.clipAction(clip('Idle')), run: P.mixer.clipAction(clip('Run')) };
      P.act.idle.play(); P.act.run.play(); P.act.run.setEffectiveWeight(0);
      P.mixer.update(Math.random() * 2);
      P.c = null;
    });
    if (S) apply(Math.min(t, S.dur));
  }, e => console.warn('Soldier.glb', e));
}

/* effets */
const fxRoot = new THREE.Group(); scene.add(fxRoot);
const basic = (c, op) => new THREE.MeshBasicMaterial({ color: col(c), transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
function shapeGeo(o) {
  switch (o.type) {
    case 'circle': return new THREE.CircleGeometry(o.r, 64);
    case 'sector': { const a0 = rad(o.a0), a1 = rad(o.a1), ts = Math.PI / 2 - a1, tl = a1 - a0;
      return o.r0 ? new THREE.RingGeometry(o.r0, o.r, 48, 1, ts, tl) : new THREE.CircleGeometry(o.r, 48, ts, tl); }
    case 'rect': { const g = new THREE.PlaneGeometry(o.w, o.len); g.translate(0, o.len / 2, 0); return g; }
    case 'square': return new THREE.PlaneGeometry(o.s, o.s);
  }
}
let layer = 0;
function mkFx(o) {
  const g = new THREE.Group(); g.visible = false; fxRoot.add(g);
  const y = 0.04 + (layer++ % 50) * 0.006;
  const flat = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); return m; };
  const F = { o, g };
  if (['circle', 'sector', 'rect', 'square'].includes(o.type)) {
    const mode = o.mode || 'hit';
    if (mode === 'warn') {
      F.base = flat(shapeGeo(o), basic(o.c, 0.13));
      F.fill = flat(shapeGeo(o), basic(o.c, 0.38));
      if (o.type === 'circle') flat(new THREE.RingGeometry(o.r - 0.14, o.r, 64), basic(o.c, 0.8));
    } else if (mode === 'void') F.base = flat(shapeGeo(o), basic('void', 0.96));
    else F.base = flat(shapeGeo(o), basic(o.c, mode === 'zone' ? (o.op ?? 0.3) : 0.85));
    F.mode = mode;
  } else if (o.type === 'ring') {
    F.base = flat(new THREE.RingGeometry(0.93, 1, 96), basic(o.c, 0.8));
  } else if (o.type === 'orb') {
    F.mesh = new THREE.Mesh(new THREE.SphereGeometry(o.r, 20, 14), new THREE.MeshStandardMaterial({ color: '#000', emissive: col(o.c), emissiveIntensity: 1.3 }));
    g.add(F.mesh);
    if (o.label) { F.lbl = sprite(o.label, 30); g.add(F.lbl); }
  } else if (o.type === 'dome') {
    F.mat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveIntensity: 0.7, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(new THREE.SphereGeometry(o.r, 40, 16, 0, TAU, 0, Math.PI / 2), F.mat);
    m.position.set(o.p[0], 0, o.p[1]); g.add(m);
  } else if (o.type === 'text') {
    F.spr = sprite(o.text, o.size || 40); g.add(F.spr);
  } else if (o.type === 'tether') {
    F.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1), new THREE.MeshBasicMaterial({ color: col(o.c) }));
    g.add(F.mesh);
  }
  return F;
}
let S = null, FX = [], t = 0, playing = true, speed = 1;
const plPos = (i, tt) => posAt(S.pl[i], tt);
const where = (o, tt) => o.at != null ? plPos(o.at, tt) : (o.p || [0, 0]);

function updFx(F, tt) {
  const o = F.o, on = tt >= o.t0 && tt < o.t1;
  F.g.visible = on; if (!on) return;
  const u = Math.min(1, (tt - o.t0) / Math.max(1e-3, o.t1 - o.t0));
  if (F.mode) {
    const [x, z] = where(o, tt);
    F.g.position.set(x, 0, z);
    if (o.type === 'rect') {
      let a = o.ang || 0;
      if (o.aim != null) { const [px, pz] = plPos(o.aim, tt); a = hourOf(px - x, pz - z); }
      if (o.spin) a += o.spin * (tt - o.t0);
      F.g.rotation.y = -rad(a);
    }
    if (F.mode === 'warn') {
      if (o.type === 'circle' || o.type === 'sector') F.fill.scale.set(Math.max(0.02, u), Math.max(0.02, u), 1);
      else if (o.type === 'rect') F.fill.scale.set(1, Math.max(0.02, u), 1);
      else F.fill.material.opacity = 0.1 + 0.35 * u;
    } else if (F.mode === 'hit') F.base.material.opacity = 0.9 * Math.pow(1 - u, 0.6);
  } else if (o.type === 'ring') {
    const r = o.r0 + (o.r1 - o.r0) * u, [x, z] = where(o, tt);
    F.g.position.set(x, 0, z); F.base.scale.set(r, r, 1); F.base.material.opacity = 0.85 * (1 - u);
  } else if (o.type === 'orb') {
    const P = o.path; let x = P[0][1], z = P[0][2];
    for (let k = 1; k < P.length; k++) {
      const [t0, x0, z0] = P[k - 1], [t1, x1, z1] = P[k];
      if (tt >= t1) { x = x1; z = z1; continue; }
      if (tt > t0) { const f = (tt - t0) / (t1 - t0); x = x0 + (x1 - x0) * f; z = z0 + (z1 - z0) * f; }
      break;
    }
    let s = 1; if (o.shrink && tt > o.shrink[0]) s = Math.max(0.15, 1 - (tt - o.shrink[0]) / (o.shrink[1] - o.shrink[0]));
    F.mesh.position.set(x, 1.2 + Math.sin(tt * 3) * 0.15, z); F.mesh.scale.setScalar(s);
    if (F.lbl) F.lbl.position.set(x, 1.2 + o.r + 1.1, z);
  } else if (o.type === 'dome') {
    F.mat.emissive.set(col(lastAt(o.cols, tt)));
  } else if (o.type === 'text') {
    const [x, z] = where(o, tt); F.spr.position.set(x, (o.y ?? 3) + airY(o.at, tt), z);
  } else if (o.type === 'tether') {
    const a = plPos(o.a, tt), b = o.bp || plPos(o.b, tt), ya = 1 + airY(o.a, tt), yb = o.bp ? 2.6 : 1 + airY(o.b, tt);
    const va = new THREE.Vector3(a[0], ya, a[1]), vb = new THREE.Vector3(b[0], yb, b[1]);
    F.mesh.position.copy(va).add(vb).multiplyScalar(0.5);
    F.mesh.scale.set(1, 1, Math.max(0.01, va.distanceTo(vb)));
    F.mesh.lookAt(vb);
    F.mesh.material.opacity = 1;
  }
}
function airY(i, tt) {
  if (i == null) return 0;
  for (const [a, b] of S.pl[i].air) if (tt > a && tt < b) return 3.2 * Math.sin(Math.PI * (tt - a) / (b - a));
  return 0;
}

function apply(tt) {
  const [bx, bz, br] = bossAt(S.boss, tt);
  S.pl.forEach((p, i) => {
    const P = players[i], [x, z] = posAt(p, tt), c = lastAt(p.cols, tt);
    const [px, pz] = posAt(p, Math.max(0, tt - 0.12)), dx = x - px, dz = z - pz, moving = Math.hypot(dx, dz) > 0.05;
    P.g.position.set(x, airY(i, tt), z);
    P.g.rotation.y = moving ? Math.atan2(dx, dz) : Math.atan2(bx - x, bz - z);   // court vers sa destination, sinon regarde le boss
    if (P.act) { P.act.run.setEffectiveWeight(moving ? 1 : 0); P.act.idle.setEffectiveWeight(moving ? 0 : 1); }
    if (P.c !== c) { P.c = c; tintPlayer(P, c); }
  });
  boss.position.set(bx, 0, bz); boss.rotation.y = -rad(br);
  coreMat.emissive.set(col(lastAt(S.boss.cols, tt)));
  FX.forEach(F => updFx(F, tt));
  let cur = -1; S.steps.forEach(([ts], k) => { if (ts <= tt) cur = k; });
  $('simCap').textContent = cur >= 0 ? S.steps[cur][1] : '…';
  if (cur !== apply.cur) { apply.cur = cur; [...$('steps').children].forEach((li, k) => li.classList.toggle('on', k === cur)); }
  $('scrub').value = Math.round(tt / S.dur * 1000);
  $('tLbl').textContent = tt.toFixed(1) + ' s';
  $('simClock').hidden = !S.clockFn; if (S.clockFn) $('simClock').textContent = S.clockFn(tt);
}

function load(id, fromUser) {
  const def = byId[id] || SCN[1];
  S = build(def);
  FX.forEach(F => F.g.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } }));
  fxRoot.clear(); layer = 0;
  FX = S.fx.map(mkFx);
  t = 0; apply.cur = null;
  $('simName').textContent = S.title;
  $('simGroup').textContent = S.group + (S.chip.startsWith('×') ? ' · ' + S.chip : '');
  $('simNote').textContent = S.note || '';
  $('steps').innerHTML = S.steps.map(([ts, txt]) => `<li><button type="button" data-t="${ts}"><b>${ts.toFixed(1)} s</b>${txt}</button></li>`).join('');
  document.querySelectorAll('#simChips button').forEach(b => b.classList.toggle('on', b.dataset.id === def.id));
  if (fromUser) try { history.replaceState(null, '', '#sim-' + def.id); } catch (e) {}
  apply(0);
}

// interface
$('simChips').innerHTML = [...new Set(SCN.map(s => s.group))].map(g =>
  `<div class="chipg"><span>${g}</span>${SCN.filter(s => s.group === g).map(s => `<button type="button" class="chip" data-id="${s.id}">${s.chip}</button>`).join('')}</div>`).join('');
$('simChips').addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) { load(b.dataset.id, true); setPlay(true); } });
$('steps').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) { t = +b.dataset.t; apply(t); } });
const setPlay = v => { playing = v; $('play').textContent = v ? '❚❚ Pause' : '▶ Lecture'; };
$('play').onclick = () => setPlay(!playing);
$('restart').onclick = () => { t = 0; setPlay(true); apply(t); };
$('scrub').oninput = e => { t = e.target.value / 1000 * S.dur; setPlay(false); apply(t); };
$('speed').onchange = e => { speed = +e.target.value; };
$('tglLabels').onchange = e => players.forEach(P => P.label.visible = e.target.checked);
$('tglClock').onchange = e => { dial.visible = e.target.checked; };
const CAMS = { orbit: [[0, 23, 25], [0, 1, 1]], top: [[0, 55, 0.01], [0, 0, 0]], iso: [[25, 23, 25], [0, 0, 0]], boss: [[0, 10, 15], [0, 1, -8]] };
function setCam(k) {
  const [p, tg] = CAMS[k]; camera.position.set(...p); controls.target.set(...tg); controls.update();
  document.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === k));
}
document.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => setCam(b.dataset.cam));
document.addEventListener('click', e => {
  const b = e.target.closest('[data-sim]'); if (!b) return;
  load(b.dataset.sim, true); setPlay(true);
  $('arena3d').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
let inView = true;
new IntersectionObserver(es => es.forEach(e => inView = e.isIntersecting)).observe($('stage'));
document.addEventListener('keydown', e => {
  if (!inView || e.target.closest('input,select,textarea')) return;
  const ids = SCN.map(s => s.id), k = ids.indexOf(S.id);
  if (e.key === ' ') { e.preventDefault(); setPlay(!playing); }
  else if (e.key === 'ArrowRight') { t = Math.min(S.dur, t + 0.5); apply(t); }
  else if (e.key === 'ArrowLeft') { t = Math.max(0, t - 0.5); apply(t); }
  else if (e.key === ']') { load(ids[(k + 1) % ids.length], true); }
  else if (e.key === '[') { load(ids[(k - 1 + ids.length) % ids.length], true); }
  else if (CAMS[['orbit', 'top', 'iso', 'boss'][+e.key - 1]]) setCam(['orbit', 'top', 'iso', 'boss'][+e.key - 1]);
});

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!inView || document.hidden) return;
  if (playing) { t += dt * speed; if (t > S.dur + 1) t = 0; apply(Math.min(t, S.dur)); }
  players.forEach(P => P.mixer && P.mixer.update(playing ? dt * speed : 0));
  bossIdle(now / 1000);
  resize(); controls.update(); renderer.render(scene, camera);
}
const start = (location.hash.match(/^#sim-(.+)$/) || [])[1];
load(start && byId[start] ? start : '475');
setCam('orbit');
requestAnimationFrame(frame);
window.MordumArena = { load, ids: SCN.map(s => s.id) };
})();
