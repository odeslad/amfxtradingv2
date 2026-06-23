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
const HANDLE_COLOR = 'rgba(200,200,200,0.9)';
const HANDLE_ACTIVE_COLOR = '#f5a623';

export type TrendlineStyle = 'solid' | 'dashed' | 'dotted';

export interface TrendlineAppearance {
  color: string;
  style: TrendlineStyle;
  width: number;
}

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

    // capture phase: we decide before the chart whether to intercept
    document.addEventListener('mousedown', this.boundMouseDown, true);
    document.addEventListener('mousemove', this.boundMouseMove, true);
    document.addEventListener('mouseup', this.boundMouseUp, true);
    document.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('touchstart', this.boundTouchStart, { capture: true, passive: false });
    document.addEventListener('touchmove', this.boundTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', this.boundTouchEnd, true);

    // Horizontal scroll/zoom: use the chart event (zero cost when idle).
    chart.timeScale().subscribeVisibleLogicalRangeChange(this.boundRangeChange);
    // Vertical price-scale rescale has no event — poll via RAF but only
    // while trendlines exist so the loop is paused on an empty canvas.
    this.scheduleRaf();
  }

  // RAF loop — only active when there are trendlines to repaint on price rescale.
  private scheduleRaf() {
    cancelAnimationFrame(this.rafId);
    if (this.trendlines.length === 0) return;
    let lastY = this.series.priceToCoordinate(this.trendlines[0].price1) ?? 0;
    const tick = () => {
      const y = this.series.priceToCoordinate(this.trendlines[0]?.price1 ?? 0) ?? 0;
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
        this.scheduleRaf();
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
    const { color, style, width } = preview ? { color: HANDLE_COLOR, style: 'dashed' as TrendlineStyle, width: 1 } : this.appearance;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (style === 'dashed') ctx.setLineDash([4, 4]);
    else if (style === 'dotted') ctx.setLineDash([1, 4]);
    else ctx.setLineDash([]);
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

  // Filtered candle array (no weekends), same order as passed to lightweight-charts.
  // Index in this array == logical index used by the chart.
  private candleIndex: { time: number }[] = [];

  setCandleIndex(candles: { time: number }[]) {
    // Before updating the index, snapshot existing trendlines as absolute times
    // so we can remap their logical indices to the new array (handles loadMore prepend).
    const snapshots = this.trendlines.map(l => ({
      id: l.id,
      time1: this.logicalToTime(l.logical1),
      price1: l.price1,
      time2: this.logicalToTime(l.logical2),
      price2: l.price2,
    }));

    this.candleIndex = candles;

    // Remap logical indices using the new candle array
    for (let i = 0; i < this.trendlines.length; i++) {
      const snap = snapshots[i];
      if (snap.time1 === null || snap.time2 === null) continue;
      const logical1 = this.timeToLogical(snap.time1);
      const logical2 = this.timeToLogical(snap.time2);
      if (logical1 === null || logical2 === null) continue;
      this.trendlines[i].logical1 = logical1;
      this.trendlines[i].logical2 = logical2;
    }
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
    for (const l of this.trendlines) {
      const t1 = this.logicalToTime(l.logical1);
      const t2 = this.logicalToTime(l.logical2);
      if (t1 === null || t2 === null) continue;
      out.push({ time1: t1, price1: l.price1, time2: t2, price2: l.price2 });
    }
    return out;
  }

  loadPersisted(lines: PersistedTrendline[]) {
    this.trendlines = [];
    for (const l of lines) {
      const logical1 = this.timeToLogical(l.time1);
      const logical2 = this.timeToLogical(l.time2);
      if (logical1 === null || logical2 === null) continue;
      this.trendlines.push({
        id: `tl-${this.trendlines.length}-${l.time1}`,
        logical1, price1: l.price1, logical2, price2: l.price2,
      });
    }
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
