// Canvas PNG export of the full 9x9 Mandala grid (SPEC 4.2). Hand-drawn onto
// a <canvas> at 2x scale — no html-to-image library. Colors are resolved from
// the chart's theme by attaching a hidden probe element with the same
// data-theme attribute the chart screen uses, so the PNG always matches what
// is on screen without hard-coding theme colors here.

import { buildGridCells, GRID_SIZE, type GridCell } from '../model/grid';
import type { Chart } from '../model/types';
import { chartFileStem, downloadBlob } from './download';

const SCALE = 2;
const CELL = 96;
const CELL_GAP = 2;
const BLOCK_GAP = 8;
const PAD = 18;
const HEADER_H = 44;
const FOOTER_H = 24;
const STRIPE_W = 3;

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const PLACEHOLDER: Record<GridCell['kind'], string> = {
  goal: 'Your goal',
  pillar: 'Pillar',
  action: 'Action',
};

interface ThemeColors {
  surface: string;
  surface2: string;
  text: string;
  textMuted: string;
  textFaint: string;
  borderStrong: string;
  goalBgSolid: string;
  goalText: string;
  goalMuted: string;
  statusTodo: string;
  statusDoing: string;
  statusDone: string;
  doneBg: string;
  doneText: string;
  pillarColors: string[];
}

function readVar(cs: CSSStyleDeclaration, name: string, fallback: string): string {
  const v = cs.getPropertyValue(name).trim();
  return v || fallback;
}

/** Resolve a theme's CSS custom properties without ever attaching data-theme
 * to visible DOM (a throwaway, zero-size, off-screen probe element). */
function resolveThemeColors(themeId: string): ThemeColors {
  const probe = document.createElement('div');
  probe.setAttribute('data-theme', themeId);
  probe.style.position = 'fixed';
  probe.style.left = '-9999px';
  probe.style.top = '0';
  probe.style.width = '0';
  probe.style.height = '0';
  probe.style.opacity = '0';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const colors: ThemeColors = {
    surface: readVar(cs, '--surface', '#ffffff'),
    surface2: readVar(cs, '--surface-2', '#f5f5f5'),
    text: readVar(cs, '--text', '#1f2430'),
    textMuted: readVar(cs, '--text-muted', '#5b6270'),
    textFaint: readVar(cs, '--text-faint', '#aab0bd'),
    borderStrong: readVar(cs, '--border-strong', '#cdd2dd'),
    goalBgSolid: readVar(cs, '--goal-bg-solid', '#1c2438'),
    goalText: readVar(cs, '--goal-text', '#ffffff'),
    goalMuted: readVar(cs, '--goal-muted', '#b9c2d8'),
    statusTodo: readVar(cs, '--status-todo', '#b7bdc9'),
    statusDoing: readVar(cs, '--status-doing', '#d9860b'),
    statusDone: readVar(cs, '--status-done', '#1f9d55'),
    doneBg: readVar(cs, '--done-bg', '#eef8f1'),
    doneText: readVar(cs, '--done-text', '#237d48'),
    pillarColors: Array.from({ length: 8 }, (_, i) => readVar(cs, `--pillar-color-${i}`, '#5b63d6')),
  };
  document.body.removeChild(probe);
  return colors;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channelHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/** Mix hex color `a` at `aPct`% with hex color `b` — mirrors CSS color-mix(). */
function mix(a: string, b: string, aPct: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const t = aPct / 100;
  return `#${channelHex(ar * t + br * (1 - t))}${channelHex(ag * t + bg * (1 - t))}${channelHex(
    ab * t + bb * (1 - t),
  )}`;
}

/** Word-wrap `text` to fit `maxWidth`, up to `maxLines` lines, ellipsizing overflow. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const limit = Math.max(1, maxLines);
  const lines: string[] = [];
  let current = '';
  let i = 0;
  while (i < words.length && lines.length < limit) {
    const word = words[i];
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = '';
    } else {
      current = test;
      i++;
    }
  }
  if (current && lines.length < limit) lines.push(current);

  const truncated = i < words.length;
  if (truncated && lines.length > 0) {
    const lastIdx = lines.length - 1;
    let last = lines[lastIdx];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[lastIdx] = `${last}…`;
  }
  return lines;
}

function drawStatusGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  status: 'todo' | 'doing' | 'done',
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  if (status === 'doing') {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, 0);
    ctx.closePath();
    ctx.fill();
  } else if (status === 'done') {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.45);
    ctx.lineTo(cx + r * 0.55, cy - r * 0.4);
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  ctx.restore();
}

interface CellRect {
  x: number;
  y: number;
}

function cellRect(row: number, col: number): CellRect {
  const blockRow = Math.floor(row / 3);
  const blockCol = Math.floor(col / 3);
  const offRow = row % 3;
  const offCol = col % 3;
  const stride = 3 * CELL + 2 * CELL_GAP + BLOCK_GAP;
  const x = PAD + blockCol * stride + offCol * (CELL + CELL_GAP);
  const y = HEADER_H + PAD + blockRow * stride + offRow * (CELL + CELL_GAP);
  return { x, y };
}

/** Render the full 9x9 grid of `chart` onto a fresh canvas at 2x scale. */
export function renderChartPng(chart: Chart): HTMLCanvasElement {
  const colors = resolveThemeColors(chart.themeId);
  const gridSpan = 3 * (3 * CELL + 2 * CELL_GAP) + 2 * BLOCK_GAP;
  const width = PAD * 2 + gridSpan;
  const height = HEADER_H + PAD * 2 + gridSpan + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round(height * SCALE);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';

  // Page background.
  ctx.fillStyle = colors.surface2;
  ctx.fillRect(0, 0, width, height);

  // Header: goal (title) + export meta.
  ctx.fillStyle = colors.text;
  ctx.font = `700 19px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  const title = chart.goal.trim() || 'Untitled Mandala chart';
  const [titleLine] = wrapText(ctx, title, gridSpan - 190, 1);
  ctx.fillText(titleLine ?? title, PAD, PAD + 16);

  ctx.font = `400 11px ${FONT_STACK}`;
  ctx.fillStyle = colors.textMuted;
  ctx.textAlign = 'right';
  const dateLabel = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  ctx.fillText(`VisionSense · exported ${dateLabel}`, width - PAD, PAD + 16);
  ctx.textAlign = 'left';

  // Grout: fill the whole grid area with the seam color, then paint cells on
  // top inset by their gap — the uncovered strip is the seam, matching the
  // live grid's block/cell borders.
  ctx.fillStyle = colors.borderStrong;
  ctx.fillRect(PAD, HEADER_H + PAD, gridSpan, gridSpan);

  const cells = buildGridCells(chart);

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = cells[row * GRID_SIZE + col];
      const { x, y } = cellRect(row, col);
      const isFilled = cell.text.trim() !== '';
      const pillarColor = cell.pillarIndex !== null ? colors.pillarColors[cell.pillarIndex % 8] : null;

      // Background.
      let bg = colors.surface;
      if (cell.kind === 'goal') {
        bg = colors.goalBgSolid;
      } else if (cell.kind === 'pillar' && pillarColor) {
        bg = mix(pillarColor, colors.surface, 10);
      } else if (cell.kind === 'action' && isFilled) {
        if (cell.status === 'doing') bg = mix(colors.statusDoing, colors.surface, 14);
        else if (cell.status === 'done') bg = colors.doneBg;
      }
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, CELL, CELL);

      // Pillar-color left stripe for pillar/action cells (mirrors cell--pillar::before).
      if (pillarColor && cell.kind !== 'goal') {
        ctx.fillStyle = pillarColor;
        ctx.fillRect(x, y, STRIPE_W, CELL);
      }

      // Text.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 6, y + 6, CELL - 12, CELL - 12);
      ctx.clip();

      const isGoal = cell.kind === 'goal';
      const isPillar = cell.kind === 'pillar';
      const fontSize = isGoal ? 15 : isPillar ? 13 : 12.5;
      const weight = isGoal || isPillar ? 700 : 400;
      ctx.font = `${weight} ${fontSize}px ${FONT_STACK}`;
      ctx.textAlign = 'center';

      let textColor: string;
      if (isFilled) {
        if (isGoal) textColor = colors.goalText;
        else if (cell.kind === 'action' && cell.status === 'done') textColor = colors.doneText;
        else textColor = colors.text;
      } else {
        textColor = isGoal ? colors.goalMuted : colors.textFaint;
      }
      ctx.fillStyle = textColor;

      const label = isFilled ? cell.text.trim() : PLACEHOLDER[cell.kind];
      const maxTextWidth = CELL - 16;
      const lineHeight = fontSize + 4;
      const maxLines = Math.max(1, Math.floor((CELL - 16) / lineHeight));
      const lines = wrapText(ctx, label, maxTextWidth, Math.min(4, maxLines));
      const blockHeight = lines.length * lineHeight;
      let ty = y + CELL / 2 - blockHeight / 2 + lineHeight * 0.75;
      for (const line of lines) {
        ctx.fillText(line, x + CELL / 2, ty);
        ty += lineHeight;
      }
      ctx.restore();
      ctx.textAlign = 'left';

      // Status glyph, top-right, for filled action cells.
      if (cell.kind === 'action' && isFilled && cell.status) {
        const glyphColor =
          cell.status === 'done'
            ? colors.statusDone
            : cell.status === 'doing'
              ? colors.statusDoing
              : colors.statusTodo;
        drawStatusGlyph(ctx, x + CELL - 11, y + 11, 6, cell.status, glyphColor);
      }
    }
  }

  // Footer hint.
  ctx.font = `400 10.5px ${FONT_STACK}`;
  ctx.fillStyle = colors.textFaint;
  ctx.textAlign = 'center';
  ctx.fillText(
    '8 pillars × 8 actions, exactly — the Harada Method Mandala Chart',
    width / 2,
    HEADER_H + PAD + gridSpan + FOOTER_H / 2 + 4,
  );

  return canvas;
}

/** Render `chart` to PNG and trigger a browser download. */
export function downloadChartPng(chart: Chart): void {
  const canvas = renderChartPng(chart);
  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, `${chartFileStem(chart.goal)}.png`);
  }, 'image/png');
}
