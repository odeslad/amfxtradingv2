export interface Trendline {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const HANDLE_RADIUS = 6;
const LINE_WIDTH = 1;
const LINE_COLOR = 'rgba(128,128,128,0.8)';
const HANDLE_COLOR = 'rgba(200,200,200,0.9)';
const HANDLE_SELECTED_COLOR = 'rgba(245,166,35,0.9)';

export class TrendlineManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trendlines: Trendline[] = [];
  private selectedId: string | null = null;
  private draggingHandle: 'start' | 'end' | 'line' | null = null;
  private isDrawing = false;
  private drawStart: { x: number; y: number } | null = null;
  private drawCurrent: { x: number; y: number } | null = null;
  private shiftPressed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', e => this.handleMouseUp(e));
    this.canvas.addEventListener('keydown', e => this.handleKeyDown(e));
    this.canvas.addEventListener('keyup', e => this.handleKeyUp(e));
  }

  private getMousePos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private snapToHorizontal(y: number): number {
    return y;
  }

  private handleMouseDown(e: MouseEvent) {
    const pos = this.getMousePos(e);

    if (this.isDrawing) {
      this.drawStart = pos;
      this.drawCurrent = pos;
      return;
    }

    const handle = this.getHandleAtPos(pos);
    if (handle) {
      this.selectedId = handle.id;
      this.draggingHandle = handle.handle;
      this.drawCurrent = pos;
      this.redraw();
    }
  }

  private handleMouseMove(e: MouseEvent) {
    const pos = this.getMousePos(e);
    this.shiftPressed = e.shiftKey;

    if (this.isDrawing && this.drawStart) {
      let end = pos;
      if (this.shiftPressed) {
        end = { ...pos, y: this.drawStart.y };
      }
      this.drawCurrent = end;
      this.redraw();
      return;
    }

    if (this.draggingHandle && this.selectedId) {
      const line = this.trendlines.find(l => l.id === this.selectedId);
      if (!line) return;

      if (this.draggingHandle === 'start') {
        line.x1 = pos.x;
        line.y1 = this.shiftPressed ? line.y2 : pos.y;
      } else if (this.draggingHandle === 'end') {
        line.x2 = pos.x;
        line.y2 = this.shiftPressed ? line.y1 : pos.y;
      } else if (this.draggingHandle === 'line') {
        const dx = pos.x - (this.drawCurrent?.x || 0);
        const dy = pos.y - (this.drawCurrent?.y || 0);
        line.x1 += dx;
        line.y1 += dy;
        line.x2 += dx;
        line.y2 += dy;
        this.drawCurrent = pos;
      }
      this.redraw();
    }
  }

  private handleMouseUp(e: MouseEvent) {
    if (this.isDrawing && this.drawStart && this.drawCurrent) {
      const line: Trendline = {
        id: `trendline-${Date.now()}`,
        x1: this.drawStart.x,
        y1: this.drawStart.y,
        x2: this.drawCurrent.x,
        y2: this.drawCurrent.y,
      };
      if (this.shiftPressed) {
        line.y2 = line.y1;
      }
      this.trendlines.push(line);
      this.drawStart = null;
      this.drawCurrent = null;
      this.redraw();
      return;
    }

    this.draggingHandle = null;
    this.drawCurrent = null;
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Shift') {
      this.shiftPressed = true;
      if (this.isDrawing || this.draggingHandle) {
        this.redraw();
      }
    }
    if (e.key === 'Delete' && this.selectedId) {
      this.trendlines = this.trendlines.filter(l => l.id !== this.selectedId);
      this.selectedId = null;
      this.redraw();
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    if (e.key === 'Shift') {
      this.shiftPressed = false;
      if (this.isDrawing || this.draggingHandle) {
        this.redraw();
      }
    }
  }

  private getHandleAtPos(pos: { x: number; y: number }): { id: string; handle: 'start' | 'end' | 'line' } | null {
    for (const line of this.trendlines) {
      const distStart = Math.hypot(pos.x - line.x1, pos.y - line.y1);
      const distEnd = Math.hypot(pos.x - line.x2, pos.y - line.y2);

      if (distStart < HANDLE_RADIUS * 2) {
        return { id: line.id, handle: 'start' };
      }
      if (distEnd < HANDLE_RADIUS * 2) {
        return { id: line.id, handle: 'end' };
      }

      const distLine = this.distanceToLine(pos, line);
      if (distLine < 5) {
        return { id: line.id, handle: 'line' };
      }
    }
    return null;
  }

  private distanceToLine(p: { x: number; y: number }, line: Trendline): number {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - line.x1, p.y - line.y1);

    let t = ((p.x - line.x1) * dx + (p.y - line.y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    const closestX = line.x1 + t * dx;
    const closestY = line.y1 + t * dy;
    return Math.hypot(p.x - closestX, p.y - closestY);
  }

  startDrawing() {
    this.isDrawing = true;
    this.selectedId = null;
    this.redraw();
  }

  stopDrawing() {
    this.isDrawing = false;
    this.drawStart = null;
    this.drawCurrent = null;
    this.redraw();
  }

  selectLine(pos: { x: number; y: number }) {
    const handle = this.getHandleAtPos(pos);
    if (handle) {
      this.selectedId = handle.id;
      this.draggingHandle = handle.handle;
    } else {
      this.selectedId = null;
    }
    this.redraw();
  }

  redraw() {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    for (const line of this.trendlines) {
      const isSelected = line.id === this.selectedId;
      this.drawLine(line, isSelected);
    }

    if (this.isDrawing && this.drawStart && this.drawCurrent) {
      this.drawLine(
        { id: 'preview', x1: this.drawStart.x, y1: this.drawStart.y, x2: this.drawCurrent.x, y2: this.drawCurrent.y },
        false,
        true
      );
    }
  }

  private drawLine(line: Trendline, isSelected: boolean, isPreview = false) {
    this.ctx.strokeStyle = LINE_COLOR;
    this.ctx.lineWidth = LINE_WIDTH;
    this.ctx.setLineDash([2, 2]);
    this.ctx.beginPath();
    this.ctx.moveTo(line.x1, line.y1);
    this.ctx.lineTo(line.x2, line.y2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    if (isSelected && !isPreview) {
      this.ctx.fillStyle = HANDLE_SELECTED_COLOR;
      this.ctx.beginPath();
      this.ctx.arc(line.x1, line.y1, HANDLE_RADIUS, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(line.x2, line.y2, HANDLE_RADIUS, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  getTrendlines(): Trendline[] {
    return [...this.trendlines];
  }

  setTrendlines(lines: Trendline[]) {
    this.trendlines = lines;
    this.redraw();
  }

  clear() {
    this.trendlines = [];
    this.selectedId = null;
    this.redraw();
  }

  isActive(): boolean {
    return this.isDrawing;
  }
}
