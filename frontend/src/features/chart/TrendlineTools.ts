import type { IChartApi, ISeriesApi, Logical as ChartLogical } from 'lightweight-charts';

export interface Trendline {
  id: string;
  logical1: number;
  price1: number;
  logical2: number;
  price2: number;
}

// Stored in BD using absolute time + price so lines survive across sessions and
// dataset changes. Reconstructed to logical indices on load.
export interface PersistedTrendline {
  time1: number;
  price1: number;
  time2: number;
  price2: number;
}

const HANDLE_RADIUS = 5;
const HIT_RADIUS_MOUSE = 10;
const HIT_RADIUS_TOUCH = 22;
const LINE_COLOR = 'rgba(140,140,140,0.85)';
const HANDLE_COLOR = 'rgba(200,200,200,0.9)';
const HANDLE_ACTIVE_COLOR = '#f5a623';

type Handle = 'start' | 'end' | 'line';
type Point = { x: number; y: number };
type Logical = { logical: number; price: number };

export class TrendlineManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private chart: IChartApi;
  private series: ISeriesApi<'Candlestick'>;

  private trendlines: Trendline[] = [];
  private selectedId: string | null = null;

  private isDrawing = false;
  private drawStart: Logical | null = null;
  private cursorPixel: Point = { x: 0, y: 0 };

  private dragHandle: Handle | null = null;
  private dragLastLogical: Logical | null = null;

  private onDone: (() => void) | null = null;
  private onSelectionChange: ((hasSelection: boolean) => void) | null = null;
  private onChange: (() => void) | null = null;
  private rafId = 0;
  private lastSignature = '';

  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: () => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;

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

    // capture phase: we decide before the chart whether to intercept
    document.addEventListener('mousedown', this.boundMouseDown, true);
    document.addEventListener('mousemove', this.boundMouseMove, true);
    document.addEventListener('mouseup', this.boundMouseUp, true);
    document.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('touchstart', this.boundTouchStart, { capture: true, passive: false });
    document.addEventListener('touchmove', this.boundTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', this.boundTouchEnd, true);

    // redraw whenever the chart viewport changes (horizontal scroll/zoom OR
    // vertical price-scale rescale). There is no price-scale event in v4, so we
    // poll the projected pixel position each frame and repaint only on change.
    const tick = () => {
      const sig = this.viewportSignature();
      if (sig !== this.lastSignature) {
        this.lastSignature = sig;
        this.redraw();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private viewportSignature(): string {
    // sample projected pixels of all endpoints; cheap and reflects any rescale
    let sig = `${this.canvas.width}x${this.canvas.height}`;
    for (const line of this.trendlines) {
      const p1 = this.logicalToPixel({ logical: line.logical1, price: line.price1 });
      const p2 = this.logicalToPixel({ logical: line.logical2, price: line.price2 });
      sig += `|${p1 ? `${p1.x | 0},${p1.y | 0}` : 'n'};${p2 ? `${p2.x | 0},${p2.y | 0}` : 'n'}`;
    }
    return sig;
  }

  destroy() {
    document.removeEventListener('mousedown', this.boundMouseDown, true);
    document.removeEventListener('mousemove', this.boundMouseMove, true);
    document.removeEventListener('mouseup', this.boundMouseUp, true);
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('touchstart', this.boundTouchStart, true);
    document.removeEventListener('touchmove', this.boundTouchMove, true);
    document.removeEventListener('touchend', this.boundTouchEnd, true);
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

  private pixelLine(line: Trendline) {
    const p1 = this.logicalToPixel({ logical: line.logical1, price: line.price1 });
    const p2 = this.logicalToPixel({ logical: line.logical2, price: line.price2 });
    if (!p1 || !p2) return null;
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }

  private hitTest(pos: Point, touch: boolean): { id: string; handle: Handle } | null {
    const r = touch ? HIT_RADIUS_TOUCH : HIT_RADIUS_MOUSE;
    for (const line of [...this.trendlines].reverse()) {
      const px = this.pixelLine(line);
      if (!px) continue;
      if (Math.hypot(pos.x - px.x1, pos.y - px.y1) < r) return { id: line.id, handle: 'start' };
      if (Math.hypot(pos.x - px.x2, pos.y - px.y2) < r) return { id: line.id, handle: 'end' };
      if (this.distToSegment(pos, px) < r / 2) return { id: line.id, handle: 'line' };
    }
    return null;
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
  // returns true if we consumed the event (chart must NOT receive it)

  private handleDown(clientX: number, clientY: number, shiftKey: boolean, touch: boolean, target: EventTarget | null): boolean {
    // ignore interactions with UI controls overlaid on the chart (e.g. delete button)
    if (target instanceof HTMLElement && target.closest('button')) return false;
    if (!this.inside(clientX, clientY)) return false;
    const pos = this.toCanvas(clientX, clientY);

    // never start/place points over the price or time axes
    if (!this.inPane(pos)) {
      if (!this.isDrawing && this.selectedId !== null) {
        this.setSelected(null);
        this.redraw();
      }
      return false;
    }

    // 1) drawing mode: place points
    if (this.isDrawing) {
      const logical = this.pixelToLogical(pos);
      if (!logical) return true;

      if (!this.drawStart) {
        this.drawStart = logical;
        this.cursorPixel = pos;
        this.redraw();
      } else {
        const end: Logical = shiftKey
          ? { logical: logical.logical, price: this.drawStart.price }
          : logical;
        const line: Trendline = {
          id: `tl-${Date.now()}`,
          logical1: this.drawStart.logical,
          price1: this.drawStart.price,
          logical2: end.logical,
          price2: end.price,
        };
        this.trendlines.push(line);
        this.setSelected(line.id);
        this.drawStart = null;
        this.isDrawing = false;
        this.redraw();
        this.onDone?.();
        this.onChange?.();
      }
      return true;
    }

    // 2) not drawing: hit-test for select / drag
    const hit = this.hitTest(pos, touch);
    if (hit) {
      this.setSelected(hit.id);
      this.dragHandle = hit.handle;
      this.dragLastLogical = this.pixelToLogical(pos);
      this.redraw();
      return true;
    }

    // 3) tapped empty space: deselect, let the chart handle it (zoom/scroll)
    if (this.selectedId !== null) {
      this.setSelected(null);
      this.redraw();
    }
    return false;
  }

  private handleMove(clientX: number, clientY: number, shiftKey: boolean): boolean {
    const pos = this.clampToPane(this.toCanvas(clientX, clientY));
    this.cursorPixel = pos;

    // drawing preview
    if (this.isDrawing) {
      if (this.drawStart) this.redraw();
      return false;
    }

    // active drag
    if (this.dragHandle && this.selectedId) {
      const line = this.trendlines.find(l => l.id === this.selectedId);
      const logical = this.pixelToLogical(pos);
      if (!line || !logical) return true;

      if (this.dragHandle === 'start') {
        line.logical1 = logical.logical;
        line.price1 = shiftKey ? line.price2 : logical.price;
      } else if (this.dragHandle === 'end') {
        line.logical2 = logical.logical;
        line.price2 = shiftKey ? line.price1 : logical.price;
      } else if (this.dragLastLogical) {
        const dl = logical.logical - this.dragLastLogical.logical;
        const dp = logical.price - this.dragLastLogical.price;
        line.logical1 += dl;
        line.logical2 += dl;
        line.price1 += dp;
        line.price2 += dp;
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
    const consumed = this.handleDown(e.clientX, e.clientY, e.shiftKey, false, e.target);
    if (consumed) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private onMouseMove(e: MouseEvent) {
    // update cursor when hovering a line (desktop affordance)
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
    if (e.touches.length !== 1) return; // let pinch-zoom through
    const t = e.touches[0];
    const consumed = this.handleDown(t.clientX, t.clientY, false, true, e.target);
    if (consumed) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private onTouchMove(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    if (!this.isDrawing && !this.dragHandle) return; // not interacting → chart scrolls
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
      this.redraw();
      this.onDone?.();
    }
  }

  // ─── render ──────────────────────────────────────────────────────────────

  redraw() {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    // clip everything to the chart pane so lines never paint over the axes
    const r = this.paneRect();
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(r.left, r.top, r.right - r.left, r.bottom - r.top);
    this.ctx.clip();

    for (const line of this.trendlines) {
      const px = this.pixelLine(line);
      if (!px) continue;
      this.paintLine(px, line.id === this.selectedId);
    }

    if (this.isDrawing && this.drawStart) {
      const p1 = this.logicalToPixel(this.drawStart);
      if (p1) {
        this.paintLine({ x1: p1.x, y1: p1.y, x2: this.cursorPixel.x, y2: this.cursorPixel.y }, false, true);
      }
    }

    this.ctx.restore();
  }

  private paintLine(px: { x1: number; y1: number; x2: number; y2: number }, selected: boolean, preview = false) {
    const ctx = this.ctx;
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px.x1, px.y1);
    ctx.lineTo(px.x2, px.y2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (selected || preview) {
      const color = selected ? HANDLE_ACTIVE_COLOR : HANDLE_COLOR;
      this.paintHandle(px.x1, px.y1, color);
      this.paintHandle(px.x2, px.y2, color);
    }
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

  startDrawing(onDone?: () => void) {
    this.isDrawing = true;
    this.drawStart = null;
    this.onDone = onDone ?? null;
    this.setSelected(null);
    this.canvas.style.cursor = 'crosshair';
    this.redraw();
  }

  stopDrawing() {
    this.isDrawing = false;
    this.drawStart = null;
    this.canvas.style.cursor = '';
    this.redraw();
  }

  deleteSelected() {
    if (!this.selectedId) return;
    this.trendlines = this.trendlines.filter(l => l.id !== this.selectedId);
    this.setSelected(null);
    this.redraw();
    this.onChange?.();
  }

  setOnSelectionChange(cb: (hasSelection: boolean) => void) {
    this.onSelectionChange = cb;
  }

  setOnChange(cb: () => void) {
    this.onChange = cb;
  }

  // ─── persistence (time/price absolute, stable across sessions) ────────────

  // Filtered candle array (no weekends), same order as passed to lightweight-charts.
  // Index in this array == logical index used by the chart.
  private candleIndex: { time: number }[] = [];

  setCandleIndex(candles: { time: number }[]) {
    this.candleIndex = candles;
  }

  candleIndexLength(): number {
    return this.candleIndex.length;
  }

  // logical (float) → unix time, extrapolating beyond last bar if needed.
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

  // unix time → logical (float), interpolating between nearest candles.
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

  getPersisted(): PersistedTrendline[] {
    const out: PersistedTrendline[] = [];
    console.log('[getPersisted] trendlines:', this.trendlines.length, 'candleIndex:', this.candleIndex.length);
    for (const l of this.trendlines) {
      const t1 = this.logicalToTime(l.logical1);
      const t2 = this.logicalToTime(l.logical2);
      console.log('[getPersisted] logical1:', l.logical1, '→ t1:', t1, '| logical2:', l.logical2, '→ t2:', t2);
      if (t1 === null || t2 === null) continue;
      out.push({ time1: t1, price1: l.price1, time2: t2, price2: l.price2 });
    }
    return out;
  }

  loadPersisted(lines: PersistedTrendline[]) {
    this.trendlines = [];
    console.log('[load] candleIndex.length:', this.candleIndex.length, 'lines:', lines.length);
    for (const l of lines) {
      const logical1 = this.timeToLogical(l.time1);
      const logical2 = this.timeToLogical(l.time2);
      console.log('[load] time1:', l.time1, '→ logical1:', logical1, '| time2:', l.time2, '→ logical2:', logical2);
      if (logical1 === null || logical2 === null) continue;
      this.trendlines.push({
        id: `tl-${this.trendlines.length}-${l.time1}`,
        logical1, price1: l.price1, logical2, price2: l.price2,
      });
    }
    console.log('[load] trendlines loaded:', this.trendlines.length);
    this.redraw();
  }

  hasSelection(): boolean {
    return this.selectedId !== null;
  }

  isActive(): boolean {
    return this.isDrawing;
  }
}
