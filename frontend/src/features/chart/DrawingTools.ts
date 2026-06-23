import type { IChartApi, ISeriesApi, Logical as ChartLogical } from 'lightweight-charts';

export type DrawingKind = 'line' | 'rect' | 'marker';
export type MarkerDirection = 'buy' | 'sell';

// Live drawing held in logical-index space (logical = bar position in filtered array).
interface BaseDrawing {
  id: string;
  kind: DrawingKind;
}

export interface LineDrawing extends BaseDrawing {
  kind: 'line';
  logical1: number;
  price1: number;
  logical2: number;
  price2: number;
}

export interface RectDrawing extends BaseDrawing {
  kind: 'rect';
  logical1: number;
  price1: number;
  logical2: number;
  price2: number;
}

export interface MarkerDrawing extends BaseDrawing {
  kind: 'marker';
  logical: number;
  price: number;
  direction: MarkerDirection;
}

type Drawing = LineDrawing | RectDrawing | MarkerDrawing;

// Persisted form: absolute time + price so drawings survive across sessions,
// dataset changes and timeframe switches. Reconstructed to logical on load.
interface PersistedBase {
  kind: DrawingKind;
}

export interface PersistedLine extends PersistedBase {
  kind: 'line';
  time1: number;
  price1: number;
  time2: number;
  price2: number;
}

export interface PersistedRect extends PersistedBase {
  kind: 'rect';
  time1: number;
  price1: number;
  time2: number;
  price2: number;
}

export interface PersistedMarker extends PersistedBase {
  kind: 'marker';
  time: number;
  price: number;
  direction: MarkerDirection;
}

export type PersistedDrawing = PersistedLine | PersistedRect | PersistedMarker;

const HANDLE_RADIUS = 5;
const HIT_RADIUS_MOUSE = 10;
const HIT_RADIUS_TOUCH = 22;
const HANDLE_COLOR = 'rgba(200,200,200,0.9)';
const HANDLE_ACTIVE_COLOR = '#f5a623';
const MARKER_BUY_COLOR = '#4caf84';
const MARKER_SELL_COLOR = '#e05c5c';
const MARKER_SIZE = 16;

export type TrendlineStyle = 'solid' | 'dashed' | 'dotted';

export interface TrendlineAppearance {
  color: string;
  style: TrendlineStyle;
  width: number;
}

type Handle = 'start' | 'end' | 'line' | 'point';
type Point = { x: number; y: number };
type Logical = { logical: number; price: number };

export class DrawingManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private chart: IChartApi;
  private series: ISeriesApi<'Candlestick'>;

  private drawings: Drawing[] = [];
  private selectedId: string | null = null;

  private drawKind: DrawingKind | null = null;
  private markerDirection: MarkerDirection = 'buy';
  private isDrawing = false;
  private drawStart: Logical | null = null;
  private cursorPixel: Point = { x: 0, y: 0 };

  private dragHandle: Handle | null = null;
  private dragLastLogical: Logical | null = null;

  private appearance: TrendlineAppearance = { color: '#8c8c8c', style: 'dashed', width: 1 };
  private onDone: (() => void) | null = null;
  private onSelectionChange: ((hasSelection: boolean) => void) | null = null;
  private onChange: (() => void) | null = null;
  private rafId = 0;

  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: () => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundRangeChange: () => void;

  constructor(canvas: HTMLCanvasElement, chart: IChartApi, series: ISeriesApi<'Candlestick'>) {
    this.canvas = canvas;
    this.chart = chart;
    this.series = series;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    this.boundMouseDown = e => this.onMouseDown(e);
    this.boundMouseMove = e => this.onMouseMove(e);
    this.boundMouseUp = () => this.endDrag();
    this.boundKeyDown = e => this.onKeyDown(e);
    this.boundTouchStart = e => this.onTouchStart(e);
    this.boundTouchMove = e => this.onTouchMove(e);
    this.boundTouchEnd = () => this.endDrag();
    this.boundRangeChange = () => this.redraw();

    document.addEventListener('mousedown', this.boundMouseDown, true);
    document.addEventListener('mousemove', this.boundMouseMove, true);
    document.addEventListener('mouseup', this.boundMouseUp, true);
    document.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('touchstart', this.boundTouchStart, { capture: true, passive: false });
    document.addEventListener('touchmove', this.boundTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', this.boundTouchEnd, true);

    chart.timeScale().subscribeVisibleLogicalRangeChange(this.boundRangeChange);
    this.scheduleRaf();
  }

  // RAF loop — only active when there are drawings to repaint on price rescale.
  private scheduleRaf() {
    cancelAnimationFrame(this.rafId);
    if (this.drawings.length === 0) return;
    const anchorPrice = () => {
      const d = this.drawings[0];
      if (!d) return 0;
      return d.kind === 'marker' ? d.price : d.price1;
    };
    let lastY = this.series.priceToCoordinate(anchorPrice()) ?? 0;
    const tick = () => {
      const y = this.series.priceToCoordinate(anchorPrice()) ?? 0;
      if (Math.abs(y - lastY) > 0.5) { lastY = y; this.redraw(); }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  destroy() {
    document.removeEventListener('mousedown', this.boundMouseDown, true);
    document.removeEventListener('mousemove', this.boundMouseMove, true);
    document.removeEventListener('mouseup', this.boundMouseUp, true);
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('touchstart', this.boundTouchStart, true);
    document.removeEventListener('touchmove', this.boundTouchMove, true);
    document.removeEventListener('touchend', this.boundTouchEnd, true);
    this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.boundRangeChange);
    cancelAnimationFrame(this.rafId);
  }

  // ─── chart panel bounds (exclude price/time axes) ────────────────────────

  private paneRect(): { left: number; top: number; right: number; bottom: number } {
    const priceAxisW = this.chart.priceScale('right').width();
    const timeAxisH = this.chart.timeScale().height();
    return {
      left: 0,
      top: 0,
      right: this.canvas.width - priceAxisW,
      bottom: this.canvas.height - timeAxisH,
    };
  }

  private inPane(p: Point): boolean {
    const r = this.paneRect();
    return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
  }

  private clampToPane(p: Point): Point {
    const r = this.paneRect();
    return {
      x: Math.max(r.left, Math.min(r.right, p.x)),
      y: Math.max(r.top, Math.min(r.bottom, p.y)),
    };
  }

  // ─── coordinate conversion ───────────────────────────────────────────────

  private pixelToLogical(p: Point): Logical | null {
    const logical = this.chart.timeScale().coordinateToLogical(p.x) as number | null;
    const price = this.series.coordinateToPrice(p.y);
    if (logical === null || price === null) return null;
    return { logical, price };
  }

  private logicalToPixel(l: { logical: number; price: number }): Point | null {
    const x = this.chart.timeScale().logicalToCoordinate(l.logical as ChartLogical);
    const y = this.series.priceToCoordinate(l.price);
    if (x === null || y === null) return null;
    return { x, y };
  }

  private toCanvas(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private inside(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  // ─── hit testing ─────────────────────────────────────────────────────────

  private segPixels(d: LineDrawing | RectDrawing) {
    const p1 = this.logicalToPixel({ logical: d.logical1, price: d.price1 });
    const p2 = this.logicalToPixel({ logical: d.logical2, price: d.price2 });
    if (!p1 || !p2) return null;
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }

  private hitTest(pos: Point, touch: boolean): { id: string; handle: Handle } | null {
    const r = touch ? HIT_RADIUS_TOUCH : HIT_RADIUS_MOUSE;
    for (const d of [...this.drawings].reverse()) {
      if (d.kind === 'marker') {
        const p = this.logicalToPixel({ logical: d.logical, price: d.price });
        if (p && Math.hypot(pos.x - p.x, pos.y - p.y) < r + MARKER_SIZE / 2) {
          return { id: d.id, handle: 'point' };
        }
        continue;
      }
      const px = this.segPixels(d);
      if (!px) continue;
      if (Math.hypot(pos.x - px.x1, pos.y - px.y1) < r) return { id: d.id, handle: 'start' };
      if (Math.hypot(pos.x - px.x2, pos.y - px.y2) < r) return { id: d.id, handle: 'end' };
      if (d.kind === 'rect') {
        if (this.onRectEdge(pos, px, r / 2)) return { id: d.id, handle: 'line' };
      } else if (this.distToSegment(pos, px) < r / 2) {
        return { id: d.id, handle: 'line' };
      }
    }
    return null;
  }

  private onRectEdge(p: Point, px: { x1: number; y1: number; x2: number; y2: number }, tol: number): boolean {
    const left = Math.min(px.x1, px.x2), right = Math.max(px.x1, px.x2);
    const top = Math.min(px.y1, px.y2), bottom = Math.max(px.y1, px.y2);
    const nearV = (x: number) => Math.abs(p.x - x) < tol && p.y >= top - tol && p.y <= bottom + tol;
    const nearH = (y: number) => Math.abs(p.y - y) < tol && p.x >= left - tol && p.x <= right + tol;
    return nearV(left) || nearV(right) || nearH(top) || nearH(bottom);
  }

  private distToSegment(p: Point, seg: { x1: number; y1: number; x2: number; y2: number }): number {
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - seg.x1, p.y - seg.y1);
    const t = Math.max(0, Math.min(1, ((p.x - seg.x1) * dx + (p.y - seg.y1) * dy) / len2));
    return Math.hypot(p.x - (seg.x1 + t * dx), p.y - (seg.y1 + t * dy));
  }

  // ─── pointer-down logic shared by mouse + touch ───────────────────────────

  private handleDown(clientX: number, clientY: number, shiftKey: boolean, ctrlKey: boolean, touch: boolean, target: EventTarget | null): boolean {
    if (target instanceof HTMLElement && target.closest('button')) return false;
    if (!this.inside(clientX, clientY)) return false;
    const pos = this.toCanvas(clientX, clientY);

    if (!this.inPane(pos)) {
      if (!this.isDrawing && this.selectedId !== null) {
        this.setSelected(null);
        this.redraw();
      }
      return false;
    }

    // 1) drawing mode
    if (this.isDrawing && this.drawKind) {
      const logical = this.pixelToLogical(pos);
      if (!logical) return true;

      // marker is a single-click placement
      if (this.drawKind === 'marker') {
        const m: MarkerDrawing = {
          id: `dr-${Date.now()}`,
          kind: 'marker',
          logical: logical.logical,
          price: logical.price,
          direction: this.markerDirection,
        };
        this.drawings.push(m);
        this.setSelected(m.id);
        this.finishDrawing();
        return true;
      }

      // line / rect are two-click
      if (!this.drawStart) {
        this.drawStart = logical;
        this.cursorPixel = pos;
        this.redraw();
      } else {
        const end: Logical = shiftKey && this.drawKind === 'line'
          ? { logical: logical.logical, price: this.drawStart.price }
          : logical;
        const d: LineDrawing | RectDrawing = {
          id: `dr-${Date.now()}`,
          kind: this.drawKind,
          logical1: this.drawStart.logical,
          price1: this.drawStart.price,
          logical2: end.logical,
          price2: end.price,
        };
        this.drawings.push(d);
        this.setSelected(d.id);
        this.finishDrawing();
      }
      return true;
    }

    // 2) not drawing: hit-test for select / drag
    const hit = this.hitTest(pos, touch);
    if (hit) {
      // Ctrl + drag on the body duplicates and drags the copy
      if (ctrlKey && (hit.handle === 'line' || hit.handle === 'point')) {
        const src = this.drawings.find(d => d.id === hit.id);
        if (src) {
          const copy = { ...src, id: `dr-${Date.now()}` } as Drawing;
          this.drawings.push(copy);
          this.setSelected(copy.id);
          this.dragHandle = hit.handle;
          this.dragLastLogical = this.pixelToLogical(pos);
          this.scheduleRaf();
          this.redraw();
          this.onChange?.();
          return true;
        }
      }
      this.setSelected(hit.id);
      this.dragHandle = hit.handle;
      this.dragLastLogical = this.pixelToLogical(pos);
      this.redraw();
      return true;
    }

    if (this.selectedId !== null) {
      this.setSelected(null);
      this.redraw();
    }
    return false;
  }

  private finishDrawing() {
    this.drawStart = null;
    this.isDrawing = false;
    this.drawKind = null;
    this.canvas.style.cursor = '';
    this.scheduleRaf();
    this.redraw();
    this.onDone?.();
    this.onChange?.();
  }

  private handleMove(clientX: number, clientY: number, shiftKey: boolean): boolean {
    const pos = this.clampToPane(this.toCanvas(clientX, clientY));
    this.cursorPixel = pos;

    if (this.isDrawing) {
      if (this.drawStart) this.redraw();
      return false;
    }

    if (this.dragHandle && this.selectedId) {
      const d = this.drawings.find(x => x.id === this.selectedId);
      const logical = this.pixelToLogical(pos);
      if (!d || !logical) return true;

      if (d.kind === 'marker') {
        d.logical = logical.logical;
        d.price = logical.price;
      } else if (this.dragHandle === 'start') {
        d.logical1 = logical.logical;
        d.price1 = shiftKey && d.kind === 'line' ? d.price2 : logical.price;
      } else if (this.dragHandle === 'end') {
        d.logical2 = logical.logical;
        d.price2 = shiftKey && d.kind === 'line' ? d.price1 : logical.price;
      } else if (this.dragLastLogical) {
        const dl = logical.logical - this.dragLastLogical.logical;
        const dp = logical.price - this.dragLastLogical.price;
        d.logical1 += dl;
        d.logical2 += dl;
        d.price1 += dp;
        d.price2 += dp;
      }
      this.dragLastLogical = logical;
      this.redraw();
      return true;
    }

    return false;
  }

  private endDrag() {
    const wasDragging = this.dragHandle !== null;
    this.dragHandle = null;
    this.dragLastLogical = null;
    if (wasDragging) this.onChange?.();
  }

  private setSelected(id: string | null) {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.onSelectionChange?.(id !== null);
  }

  // ─── mouse ─────────────────────────────────────────────────────────────────

  private onMouseDown(e: MouseEvent) {
    const consumed = this.handleDown(e.clientX, e.clientY, e.shiftKey, e.ctrlKey || e.metaKey, false, e.target);
    if (consumed) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isDrawing && !this.dragHandle && this.inside(e.clientX, e.clientY)) {
      const hit = this.hitTest(this.toCanvas(e.clientX, e.clientY), false);
      this.canvas.style.cursor = hit ? 'pointer' : '';
    }
    const consumed = this.handleMove(e.clientX, e.clientY, e.shiftKey);
    if (consumed) {
      e.preventDefault();
      e.stopPropagation();
    } else if (this.isDrawing && this.drawStart) {
      this.redraw();
    }
  }

  // ─── touch ───────────────────────────────────────────────────────────────

  private onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const consumed = this.handleDown(t.clientX, t.clientY, false, false, true, e.target);
    if (consumed) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private onTouchMove(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    if (!this.isDrawing && !this.dragHandle) return;
    const t = e.touches[0];
    const consumed = this.handleMove(t.clientX, t.clientY, false);
    if (consumed || this.isDrawing) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // ─── keyboard ──────────────────────────────────────────────────────────────

  private onKeyDown(e: KeyboardEvent) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedId) {
      this.deleteSelected();
    }
    if (e.key === 'Escape' && this.isDrawing) {
      this.drawStart = null;
      this.isDrawing = false;
      this.drawKind = null;
      this.canvas.style.cursor = '';
      this.redraw();
      this.onDone?.();
    }
  }

  // ─── render ──────────────────────────────────────────────────────────────

  redraw() {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    const r = this.paneRect();
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(r.left, r.top, r.right - r.left, r.bottom - r.top);
    this.ctx.clip();

    for (const d of this.drawings) {
      const selected = d.id === this.selectedId;
      if (d.kind === 'marker') {
        const p = this.logicalToPixel({ logical: d.logical, price: d.price });
        if (p) this.paintMarker(p, d.direction, selected);
      } else {
        const px = this.segPixels(d);
        if (!px) continue;
        if (d.kind === 'rect') this.paintRect(px, selected);
        else this.paintLine(px, selected);
      }
    }

    // preview while drawing
    if (this.isDrawing && this.drawKind && this.drawStart) {
      const p1 = this.logicalToPixel(this.drawStart);
      if (p1) {
        const px = { x1: p1.x, y1: p1.y, x2: this.cursorPixel.x, y2: this.cursorPixel.y };
        if (this.drawKind === 'rect') this.paintRect(px, false, true);
        else this.paintLine(px, false, true);
      }
    }

    this.ctx.restore();
  }

  private strokeStyleFor(preview: boolean) {
    return preview
      ? { color: HANDLE_COLOR, style: 'dashed' as TrendlineStyle, width: 1 }
      : this.appearance;
  }

  private applyDash(style: TrendlineStyle) {
    if (style === 'dashed') this.ctx.setLineDash([4, 4]);
    else if (style === 'dotted') this.ctx.setLineDash([1, 4]);
    else this.ctx.setLineDash([]);
  }

  private paintLine(px: { x1: number; y1: number; x2: number; y2: number }, selected: boolean, preview = false) {
    const ctx = this.ctx;
    const { color, style, width } = this.strokeStyleFor(preview);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    this.applyDash(style);
    ctx.beginPath();
    ctx.moveTo(px.x1, px.y1);
    ctx.lineTo(px.x2, px.y2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (selected || preview) {
      const handleColor = selected ? HANDLE_ACTIVE_COLOR : HANDLE_COLOR;
      this.paintHandle(px.x1, px.y1, handleColor);
      this.paintHandle(px.x2, px.y2, handleColor);
    }
  }

  private paintRect(px: { x1: number; y1: number; x2: number; y2: number }, selected: boolean, preview = false) {
    const ctx = this.ctx;
    const { color, style, width } = this.strokeStyleFor(preview);
    const x = Math.min(px.x1, px.x2);
    const y = Math.min(px.y1, px.y2);
    const w = Math.abs(px.x2 - px.x1);
    const h = Math.abs(px.y2 - px.y1);

    ctx.fillStyle = this.withAlpha(color, 0.08);
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    this.applyDash(style);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    if (selected || preview) {
      const handleColor = selected ? HANDLE_ACTIVE_COLOR : HANDLE_COLOR;
      this.paintHandle(px.x1, px.y1, handleColor);
      this.paintHandle(px.x2, px.y2, handleColor);
    }
  }

  private paintMarker(p: Point, direction: MarkerDirection, selected: boolean) {
    const ctx = this.ctx;
    const color = direction === 'buy' ? MARKER_BUY_COLOR : MARKER_SELL_COLOR;
    const s = MARKER_SIZE;
    const up = direction === 'buy';
    // arrow points toward the price: buy arrow sits below pointing up, sell above pointing down
    const tipY = up ? p.y - s : p.y + s;
    const baseY = up ? p.y : p.y;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(p.x, tipY);
    ctx.lineTo(p.x - s * 0.55, baseY);
    ctx.lineTo(p.x - s * 0.22, baseY);
    ctx.lineTo(p.x - s * 0.22, up ? p.y + s * 0.6 : p.y - s * 0.6);
    ctx.lineTo(p.x + s * 0.22, up ? p.y + s * 0.6 : p.y - s * 0.6);
    ctx.lineTo(p.x + s * 0.22, baseY);
    ctx.lineTo(p.x + s * 0.55, baseY);
    ctx.closePath();
    ctx.fill();

    if (selected) {
      ctx.strokeStyle = HANDLE_ACTIVE_COLOR;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private withAlpha(color: string, alpha: number): string {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return color;
  }

  private paintHandle(x: number, y: number, color: string) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(13,13,13,0.8)';
    ctx.fill();
  }

  // ─── public API ───────────────────────────────────────────────────────────

  startDrawing(kind: DrawingKind, onDone?: () => void, markerDirection: MarkerDirection = 'buy') {
    this.isDrawing = true;
    this.drawKind = kind;
    this.markerDirection = markerDirection;
    this.drawStart = null;
    this.onDone = onDone ?? null;
    this.setSelected(null);
    this.canvas.style.cursor = 'crosshair';
    this.redraw();
  }

  stopDrawing() {
    this.isDrawing = false;
    this.drawKind = null;
    this.drawStart = null;
    this.canvas.style.cursor = '';
    this.redraw();
  }

  deleteSelected() {
    if (!this.selectedId) return;
    this.drawings = this.drawings.filter(d => d.id !== this.selectedId);
    this.setSelected(null);
    this.scheduleRaf();
    this.redraw();
    this.onChange?.();
  }

  setOnSelectionChange(cb: (hasSelection: boolean) => void) {
    this.onSelectionChange = cb;
  }

  setOnChange(cb: () => void) {
    this.onChange = cb;
  }

  setAppearance(appearance: TrendlineAppearance) {
    this.appearance = appearance;
    this.redraw();
  }

  // ─── persistence (time/price absolute, stable across sessions) ────────────

  private candleIndex: { time: number }[] = [];

  setCandleIndex(candles: { time: number }[]) {
    const snapshots = this.drawings.map(d => this.toPersisted(d));
    this.candleIndex = candles;
    for (let i = 0; i < this.drawings.length; i++) {
      const snap = snapshots[i];
      if (!snap) continue;
      this.applyPersisted(this.drawings[i], snap);
    }
  }

  candleIndexLength(): number {
    return this.candleIndex.length;
  }

  private logicalToTime(logical: number): number | null {
    const arr = this.candleIndex;
    if (arr.length < 2) return null;
    const i = Math.floor(logical);
    const frac = logical - i;
    if (i >= 0 && i < arr.length - 1) {
      const dt = arr[i + 1].time - arr[i].time;
      return Math.round(arr[i].time + frac * dt);
    }
    const last = arr.length - 1;
    const interval = arr[last].time - arr[last - 1].time;
    if (i >= arr.length - 1) return Math.round(arr[last].time + (logical - last) * interval);
    return Math.round(arr[0].time + logical * (arr[1].time - arr[0].time));
  }

  private timeToLogical(time: number): number | null {
    const arr = this.candleIndex;
    if (arr.length < 2) return null;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].time === time) return i;
    }
    const last = arr.length - 1;
    if (time > arr[last].time) {
      const interval = arr[last].time - arr[last - 1].time;
      return last + (time - arr[last].time) / interval;
    }
    if (time < arr[0].time) {
      return (time - arr[0].time) / (arr[1].time - arr[0].time);
    }
    let lo = 0;
    let hi = arr.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].time <= time) lo = mid; else hi = mid;
    }
    const dt = arr[hi].time - arr[lo].time;
    if (dt === 0) return lo;
    return lo + (time - arr[lo].time) / dt;
  }

  private toPersisted(d: Drawing): PersistedDrawing | null {
    if (d.kind === 'marker') {
      const time = this.logicalToTime(d.logical);
      if (time === null) return null;
      return { kind: 'marker', time, price: d.price, direction: d.direction };
    }
    const t1 = this.logicalToTime(d.logical1);
    const t2 = this.logicalToTime(d.logical2);
    if (t1 === null || t2 === null) return null;
    return { kind: d.kind, time1: t1, price1: d.price1, time2: t2, price2: d.price2 };
  }

  private applyPersisted(d: Drawing, snap: PersistedDrawing) {
    if (d.kind === 'marker' && snap.kind === 'marker') {
      const logical = this.timeToLogical(snap.time);
      if (logical === null) return;
      d.logical = logical;
      d.price = snap.price;
    } else if ((d.kind === 'line' || d.kind === 'rect') && (snap.kind === 'line' || snap.kind === 'rect')) {
      const l1 = this.timeToLogical(snap.time1);
      const l2 = this.timeToLogical(snap.time2);
      if (l1 === null || l2 === null) return;
      d.logical1 = l1;
      d.price1 = snap.price1;
      d.logical2 = l2;
      d.price2 = snap.price2;
    }
  }

  getPersisted(): PersistedDrawing[] {
    const out: PersistedDrawing[] = [];
    for (const d of this.drawings) {
      const p = this.toPersisted(d);
      if (p) out.push(p);
    }
    return out;
  }

  loadPersisted(items: PersistedDrawing[]) {
    this.drawings = [];
    items.forEach((it, idx) => {
      if (it.kind === 'marker') {
        const logical = this.timeToLogical(it.time);
        if (logical === null) return;
        this.drawings.push({
          id: `dr-${idx}-${it.time}`,
          kind: 'marker',
          logical,
          price: it.price,
          direction: it.direction,
        });
      } else {
        const l1 = this.timeToLogical(it.time1);
        const l2 = this.timeToLogical(it.time2);
        if (l1 === null || l2 === null) return;
        this.drawings.push({
          id: `dr-${idx}-${it.time1}`,
          kind: it.kind,
          logical1: l1, price1: it.price1, logical2: l2, price2: it.price2,
        });
      }
    });
    this.scheduleRaf();
    this.redraw();
  }

  hasSelection(): boolean {
    return this.selectedId !== null;
  }

  isActive(): boolean {
    return this.isDrawing;
  }
}
