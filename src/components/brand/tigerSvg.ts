/*
 * The Meritwing mark: an original, hand-built SVG of a seated white tiger with raised wings.
 * Everything is drawn from the shapes below (no clip art); the feathers are generated so both wings
 * stay identical. tigerSvg(variant) returns the full figure ("hero", the landing page) or the
 * head-and-wings crest ("nav", the header). Colours and motion are in globals.css (.mark rules).
 */

type Point = [number, number];
type Row = { from: number; to: number; count: number; cls: string; angle: (t: number) => number; length: (t: number) => number; width: (t: number) => number; inset?: number };
export type MarkVariant = "hero" | "nav";

const W = 240; // viewBox width; the figure is symmetric about x = 120
const mirrorX = (d: string) =>
  d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(W - Number(x)).toFixed(2)} ${y}`);
const r = (n: number) => +n.toFixed(2);

/* ---------- Wing: feathers hung from a curved leading edge ---------- */

const SHOULDER: Point = [100, 116];
// Leading edge: a quadratic curve from the shoulder up and out to the wing tip.
const EDGE: { p0: Point; c: Point; p1: Point } = { p0: SHOULDER, c: [70, 92], p1: [44, 8] };
const onEdge = (t: number): Point => {
  const { p0, c, p1 } = EDGE;
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
};

function feather(base: Point, angleDeg: number, length: number, width: number) {
  const a = (angleDeg * Math.PI) / 180;
  const dir = [Math.cos(a), Math.sin(a)];
  const n = [-dir[1], dir[0]];
  const tip = [base[0] + dir[0] * length, base[1] + dir[1] * length];
  const mid = (s: number) => [base[0] + dir[0] * length * 0.48 + n[0] * width * s, base[1] + dir[1] * length * 0.48 + n[1] * width * s];
  const [m1, m2] = [mid(1), mid(-1)];
  return `M${r(base[0])} ${r(base[1])} Q${r(m1[0])} ${r(m1[1])} ${r(tip[0])} ${r(tip[1])} Q${r(m2[0])} ${r(m2[1])} ${r(base[0])} ${r(base[1])}Z`;
}

function featherRow({ from, to, count, angle, length, width, inset = 0, cls }: Row, fill?: string) {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = from + ((to - from) * i) / (count - 1);
    const [x, y] = onEdge(t);
    const base: Point = [x + inset, y + inset * 0.6];
    out.push(`<path class="${cls}"${fill ? ` fill="${fill}"` : ""} d="${feather(base, angle(t), length(t), width(t))}"/>`);
  }
  return out.join("");
}

function wing(uid: string) {
  // Primaries: long, at the outer half, sweeping out to the side. Drawn longest-last so the
  // tip feathers sit on top.
  const primaries = featherRow({
    from: 0.3, to: 1, count: 12, cls: "f-pri",
    angle: (t) => 150 + t * 45,
    length: (t) => 34 + t * 30,
    width: (t) => 7 + t * 3,
  }, `url(#${uid}-pri)`);
  const secondaries = featherRow({
    from: 0.02, to: 0.5, count: 9, cls: "f-sec",
    angle: (t) => 120 + t * 50,
    length: (t) => 30 + t * 14,
    width: () => 7.5,
    inset: 2,
  }, `url(#${uid}-sec)`);
  const coverts = featherRow({
    from: 0.06, to: 0.94, count: 12, cls: "f-cov",
    angle: (t) => 130 + t * 45,
    length: (t) => 16 + t * 9,
    width: () => 5.6,
    inset: 3,
  });
  const { p0, c, p1 } = EDGE;
  // The wing's arm: a soft band along the leading edge that the feathers hang from.
  const arm = `M${p0[0] + 4} ${p0[1] + 2} Q${c[0] + 2} ${c[1] - 4} ${p1[0]} ${p1[1]} Q${c[0] - 6} ${c[1] + 8} ${p0[0] - 8} ${p0[1] + 6}Z`;
  return `${primaries}${secondaries}<path class="w-arm" d="${arm}"/>${coverts}`;
}

/* ---------- Tiger (left half written once, mirrored for the right) ---------- */

const pair = (cls: string, d: string) => `<path class="${cls}" d="${d}"/><path class="${cls}" d="${mirrorX(d)}"/>`;

const HEAD =
  "M120 48 C104 48 90 51 83 58 C77 64 75 73 75 81 C72 88 68 94 63 99 C68 101 72 102 75 103 C71 109 68 114 65 118 C71 119 76 119 81 119 C89 129 104 136 120 138 C136 136 151 129 159 119 C164 119 169 119 175 118 C172 114 169 109 165 103 C168 102 172 101 177 99 C172 94 168 88 165 81 C165 73 163 64 157 58 C150 51 136 48 120 48Z";

function tiger(variant: MarkVariant) {
  const body =
    variant === "hero"
      ? `
    <g class="t-tail">
      <path class="tail" d="M178 216 C200 216 214 202 212 182 C211 172 204 166 197 169"/>
      <path class="tail-tip" d="M197.5 169 C195 170.5 194 173 194.5 175.5"/>
      <path class="stripe-line" d="M203 208 L196 200 M210 194 L202 190"/>
    </g>
    ${pair("fur", "M54 208 C54 190 66 180 84 182 C96 184 101 196 99 208 C97 220 84 225 71 223 C61 221 54 216 54 208Z")}
    <path class="fur" d="M88 106 C74 128 71 162 77 202 L163 202 C169 162 166 128 152 106Z"/>
    <path class="bib" d="M102 116 C107 140 113 154 120 162 C127 154 133 140 138 116Z"/>
    ${pair("fur", "M83 126 C80 158 85 190 90 214 L111 214 C112.5 192 112.5 168 109 151 C105 139 95 131 83 126Z")}
    ${pair("paw", "M87 216 C87 208 95 206 101.5 206 C108 206 116 208 116 216 C116 222 109 225 101.5 225 C94 225 87 222 87 216Z")}
    ${pair("toe", "M96.5 218 L96.5 224 M101.5 218 L101.5 225 M106.5 218 L106.5 224")}
    ${pair("stripe", "M91 160 C98 158 104 159 111 162 C104 162 98 163 91 167Z")}
    ${pair("stripe", "M90 178 C97 176 103 177 111 180 C104 180 98 181 90 185Z")}
    ${pair("stripe", "M90 196 C97 194 103 195 111 198 C104 198 98 199 90 203Z")}
    ${pair("stripe", "M57 200 C63 195 70 194 77 196 C70 198 64 201 58 206Z")}
    ${pair("stripe", "M82 124 C89 129 93 136 95 146 C91 139 86 134 79 131Z")}
    ${pair("stripe", "M77 146 C83 150 86 156 87 164 C84 158 80 154 75 152Z")}`
      : "";

  return `
  <g class="t-body">${body}
  <g class="t-head" transform="translate(120 82) scale(0.84) translate(-120 -92)">
    ${pair("ear", "M85 63 C79 49 82 39 91 39 C98 39 103 45 106 52Z")}
    ${pair("ear-in", "M89 58 C86 50 88 44 92.5 44 C96.5 44 99 48 100 52Z")}
    <path class="fur head" d="${HEAD}"/>
    ${pair("stripe", "M106 57 C110 62 112 68 110 73 C108 67 104 63 99 60Z")}
    <path class="stripe" d="M120 54 C116.5 61 116.5 68 120 76 C123.5 68 123.5 61 120 54Z"/>
    ${pair("stripe", "M85 79 C93 76 102 78 110 84 C102 81 94 80 86 82.5Z")}
    ${pair("stripe", "M76 85 C84 86 90 90 95 96 C88 94 82 93 74 93Z")}
    ${pair("stripe", "M70 103 C80 103 88 107 94 113 C86 111 79 111 71 111Z")}
    <path class="muzzle" d="M120 96 C107 96 97 104 97 114 C97 124 107 131 120 131 C133 131 143 124 143 114 C143 104 133 96 120 96Z"/>
    ${pair("bridge", "M113 80 C115 90 115 98 113 104")}
    <g class="eyes">
      ${pair("eye", "M88 85 C93 81.5 102 82 109.5 88.5 C103 91.8 94 91.2 88 85Z")}
      <ellipse class="pupil" cx="99.5" cy="87.2" rx="1.4" ry="2.8"/><ellipse class="pupil" cx="140.5" cy="87.2" rx="1.4" ry="2.8"/>
      <circle class="glint" cx="101.4" cy="86" r="0.8"/><circle class="glint" cx="142.4" cy="86" r="0.8"/>
    </g>
    <path class="nose" d="M111.5 103.5 L128.5 103.5 C128.5 108 124.5 112 120 114.5 C115.5 112 111.5 108 111.5 103.5Z"/>
    <path class="mouth" d="M120 114.5 L120 119.5 M120 119.5 C117 121.8 113 122.2 109.5 120.8 M120 119.5 C123 121.8 127 122.2 130.5 120.8"/>
    ${pair("whisker-dot", "M106 116.5 h0.01 M102 113.5 h0.01 M108 112 h0.01")}
  </g></g>`;
}

/** Decorative: the wordmark beside it carries the name, so the SVG is hidden from screen readers. */
export function tigerSvg(variant: MarkVariant): string {
  const hero = variant === "hero";
  const viewBox = hero ? "-26 -18 292 258" : "-22 -12 284 136";
  const uid = hero ? "h" : "n";
  return `<svg class="mark mark--${variant}" viewBox="${viewBox}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${uid}-fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f9fc"/><stop offset="1" stop-color="#c7cfdd"/></linearGradient>
    <linearGradient id="${uid}-pri" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e8efff"/><stop offset="0.45" stop-color="#7aa5ff"/><stop offset="1" stop-color="#2f6bff"/></linearGradient>
    <linearGradient id="${uid}-sec" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f6ff"/><stop offset="1" stop-color="#8fb3ff"/></linearGradient>
    <radialGradient id="${uid}-eye" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="#bcd4ff"/><stop offset="0.55" stop-color="#4c8dff"/><stop offset="1" stop-color="#1d4ed8"/></radialGradient>
    <radialGradient id="${uid}-halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#2f6bff" stop-opacity="0.32"/><stop offset="1" stop-color="#2f6bff" stop-opacity="0"/></radialGradient>
  </defs>
  <style>
    .mark--${variant} .fur{fill:url(#${uid}-fur)}
    .mark--${variant} .eye{fill:url(#${uid}-eye)}
  </style>
  ${hero ? `<ellipse class="halo" cx="120" cy="112" rx="118" ry="108" fill="url(#${uid}-halo)"/><ellipse class="shadow" cx="120" cy="233" rx="64" ry="5.5"/>` : ""}
  <g class="float">
    <g class="wing wing-l">${wing(uid)}</g>
    <g class="wing wing-r"><g transform="translate(${W} 0) scale(-1 1)">${wing(uid)}</g></g>
    ${tiger(variant)}
  </g>
</svg>`;
}
