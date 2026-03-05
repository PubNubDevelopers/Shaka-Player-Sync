/**
 * Scene 5 — The IDE Code Reveal (Typewriter)
 *
 * The title reveal fades out. A VS Code-style editor window floats in
 * and code is typed out line-by-line with a clip-path reveal that
 * simulates real typing at ~120 chars/sec.
 *
 * Timeline (absolute positions on master):
 *   21.0s       Scene 4 elements fade out (0.8s)
 *   21.3s       IDE window fades/scales in (1.0s)
 *   22.5s       Typing begins — lines reveal left-to-right sequentially
 *   ~27.5s      All code typed
 *   28.0s       Cursor blinks at end
 *   32.0s       Pad end
 */

import gsap from 'gsap';

// ─── Scene timing ────────────────────────────────────────────────────────────

const T0 = 21.0;
const T_FADEOUT_DUR = 0.8;
const T_IDE_IN = 21.3;
const T_IDE_DUR = 1.0;
const T_TYPE_START = 22.5;
const T_END = 32.0;

const CHARS_PER_SEC = 120;
const LINE_PAUSE = 0.06;     // pause between non-blank lines
const BLANK_PAUSE = 0.15;    // pause for blank lines

// ─── Code definition ─────────────────────────────────────────────────────────

interface CodeLine {
  html: string;
  chars: number;  // plain-text character count (drives typing speed)
}

const CODE: CodeLine[] = [
  {
    html: `<span class="syn-kw">import</span> shaka <span class="syn-kw">from</span> <span class="syn-str">'shaka-player'</span>;`,
    chars: 35,
  },
  {
    html: `<span class="syn-kw">import</span> PubNub <span class="syn-kw">from</span> <span class="syn-str">'pubnub'</span>;`,
    chars: 29,
  },
  {
    html: `<span class="syn-kw">import</span> { <span class="syn-type">SyncManager</span> } <span class="syn-kw">from</span> <span class="syn-str">'@pubnub/shaka-player'</span>;`,
    chars: 52,
  },
  { html: '', chars: 0 },  // blank
  {
    html: `<span class="syn-kw">const</span> video = document.<span class="syn-fn">getElementById</span>(<span class="syn-str">'video'</span>);`,
    chars: 49,
  },
  {
    html: `<span class="syn-kw">const</span> player = <span class="syn-kw">new</span> shaka.<span class="syn-type">Player</span>();`,
    chars: 35,
  },
  {
    html: `<span class="syn-kw">await</span> player.<span class="syn-fn">attach</span>(video);`,
    chars: 28,
  },
  {
    html: `<span class="syn-kw">await</span> player.<span class="syn-fn">load</span>(<span class="syn-str">'https://stream.example.com/movie.mpd'</span>);`,
    chars: 58,
  },
  { html: '', chars: 0 },  // blank
  {
    html: `<span class="syn-kw">const</span> sync = <span class="syn-kw">new</span> <span class="syn-type">SyncManager</span>(player, {`,
    chars: 39,
  },
  {
    html: `  <span class="syn-prop">publishKey</span>: <span class="syn-str">'pub-c-...'</span>,`,
    chars: 26,
  },
  {
    html: `  <span class="syn-prop">subscribeKey</span>: <span class="syn-str">'sub-c-...'</span>,`,
    chars: 28,
  },
  {
    html: `  PubNub,`,
    chars: 9,
  },
  {
    html: `});`,
    chars: 3,
  },
  { html: '', chars: 0 },  // blank
  {
    html: `sync.<span class="syn-fn">connect</span>(<span class="syn-str">'friday-movie-night'</span>);`,
    chars: 35,
  },
];

// ─── Line number helper ─────────────────────────────────────────────────────

function lineNumbers(count: number): string {
  return Array.from({ length: count }, (_, i) =>
    `<div class="ide-gutter__num">${i + 1}</div>`
  ).join('');
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SCENE BUILDER
// ═════════════════════════════════════════════════════════════════════════════

export function buildIdeRevealScene(
  tl: gsap.core.Timeline,
  container: HTMLElement,
): void {

  // ── Query scene 4 elements to fade out ─────────────────────────────────

  const titleReveal = container.querySelector('.title-reveal') as HTMLElement | null;
  const globeWrapper = container.querySelector('.globe-arc-wrapper') as HTMLElement | null;

  // ── Build IDE window DOM ───────────────────────────────────────────────

  const ide = document.createElement('div');
  ide.className = 'ide-window';

  // Title bar
  const titlebar = document.createElement('div');
  titlebar.className = 'ide-titlebar';
  titlebar.innerHTML = `
    <div class="ide-titlebar__dots">
      <span class="ide-titlebar__dot ide-titlebar__dot--red"></span>
      <span class="ide-titlebar__dot ide-titlebar__dot--yellow"></span>
      <span class="ide-titlebar__dot ide-titlebar__dot--green"></span>
    </div>
    <span class="ide-titlebar__filename">sync.ts</span>
  `;
  ide.appendChild(titlebar);

  // Editor body (gutter + code area)
  const body = document.createElement('div');
  body.className = 'ide-body';

  // Gutter with line numbers
  const gutter = document.createElement('div');
  gutter.className = 'ide-gutter';
  gutter.innerHTML = lineNumbers(CODE.length);
  body.appendChild(gutter);

  // Grab individual gutter number elements
  const gutterNums = gutter.querySelectorAll<HTMLElement>('.ide-gutter__num');

  // Code area with per-line wrappers
  const codeArea = document.createElement('div');
  codeArea.className = 'ide-code';

  const lineWrappers: HTMLElement[] = [];

  CODE.forEach((line) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'ide-code__line';

    if (line.chars === 0) {
      // Blank line
      wrapper.innerHTML = '&nbsp;';
      wrapper.classList.add('ide-code__line--blank');
    } else {
      // Inner element with fit-content width for accurate clip-path
      const inner = document.createElement('span');
      inner.className = 'ide-code__line-inner';
      inner.innerHTML = line.html;
      wrapper.appendChild(inner);
    }

    codeArea.appendChild(wrapper);
    lineWrappers.push(wrapper);
  });

  // Blinking cursor (appended after the last line's inner span)
  const cursor = document.createElement('span');
  cursor.className = 'ide-cursor';
  const lastInner = lineWrappers[lineWrappers.length - 1].querySelector('.ide-code__line-inner');
  if (lastInner) lastInner.appendChild(cursor);

  body.appendChild(codeArea);
  ide.appendChild(body);
  container.appendChild(ide);

  // ── Initial hidden states ──────────────────────────────────────────────

  gsap.set(ide, { opacity: 0, scale: 0.95 });
  gsap.set(gutter, { opacity: 0 });

  // Hide all line inners via clip-path (fully clipped from right)
  const lineInners = codeArea.querySelectorAll<HTMLElement>('.ide-code__line-inner');
  lineInners.forEach(el => {
    gsap.set(el, { clipPath: 'inset(0 100% 0 0)' });
  });

  // Hide all gutter numbers
  gutterNums.forEach(el => gsap.set(el, { opacity: 0 }));

  // ════════════════════════════════════════════════════════════════════════
  // GSAP TIMELINE
  // ════════════════════════════════════════════════════════════════════════

  // ── 21.0s — Fade out scene 4 elements ──────────────────────────────────

  if (titleReveal) {
    tl.to(titleReveal, {
      opacity: 0,
      duration: T_FADEOUT_DUR,
      ease: 'power2.inOut',
    }, T0);
  }

  if (globeWrapper) {
    tl.to(globeWrapper, {
      opacity: 0,
      duration: T_FADEOUT_DUR,
      ease: 'power2.inOut',
    }, T0);
  }

  // ── 21.3s — IDE window enters ──────────────────────────────────────────

  tl.to(ide, {
    opacity: 1,
    scale: 1,
    duration: T_IDE_DUR,
    ease: 'power2.out',
  }, T_IDE_IN);

  tl.to(gutter, {
    opacity: 1,
    duration: T_IDE_DUR,
    ease: 'power2.out',
  }, T_IDE_IN);

  // ── 22.5s — Typing begins ─────────────────────────────────────────────

  let t = T_TYPE_START;
  let innerIdx = 0;

  CODE.forEach((line, i) => {
    // Show gutter number when line starts
    tl.to(gutterNums[i], { opacity: 1, duration: 0.08 }, t);

    if (line.chars === 0) {
      // Blank line — just a pause
      t += BLANK_PAUSE;
      return;
    }

    const dur = line.chars / CHARS_PER_SEC;
    const inner = lineInners[innerIdx];
    innerIdx++;

    // Reveal line left-to-right (typewriter via clip-path)
    tl.to(inner, {
      clipPath: 'inset(0 0% 0 0)',
      duration: dur,
      ease: 'none',
    }, t);

    t += dur + LINE_PAUSE;
  });

  // ── Cursor blinks after typing completes ───────────────────────────────

  const T_CURSOR_START = Math.max(t, T_TYPE_START + 4.0);
  tl.call(() => {
    cursor.classList.add('ide-cursor--active');
  }, [], T_CURSOR_START);

  // ── Pad end ────────────────────────────────────────────────────────────

  tl.set({}, {}, T_END);
}
