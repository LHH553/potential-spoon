/**
 * @module performance-monitor
 * @description Real-time performance monitoring and visualization
 *
 * Demonstrates:
 * - Canvas-based mini chart rendering
 * - Performance API usage (memory, timing)
 * - Ring buffer data structure
 * - RequestAnimationFrame profiling
 */

import type { PerformanceMetrics } from './types';

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private updateTimer: number = 0;
  private readonly HISTORY_SIZE = 120;
  private visible = false;

  constructor() {
    this.metrics = {
      fps: 0,
      frameTime: 0,
      particleCount: 0,
      updateTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      frameHistory: new Float32Array(this.HISTORY_SIZE),
      historyIndex: 0,
    };
  }

  mount(container: HTMLElement): void {
    const panel = document.createElement('div');
    panel.className = 'perf-panel';
    panel.innerHTML = `
      <div class="perf-header">
        <span class="perf-title">Performance</span>
        <button class="perf-close" aria-label="Close performance monitor">&times;</button>
      </div>
      <canvas class="perf-chart" width="240" height="60"></canvas>
      <div class="perf-stats">
        <div class="perf-stat">
          <span class="perf-label">FPS</span>
          <span class="perf-value" id="perf-fps">0</span>
        </div>
        <div class="perf-stat">
          <span class="perf-label">Frame</span>
          <span class="perf-value" id="perf-frame">0ms</span>
        </div>
        <div class="perf-stat">
          <span class="perf-label">Particles</span>
          <span class="perf-value" id="perf-particles">0</span>
        </div>
        <div class="perf-stat">
          <span class="perf-label">Update</span>
          <span class="perf-value" id="perf-update">0ms</span>
        </div>
        <div class="perf-stat">
          <span class="perf-label">Render</span>
          <span class="perf-value" id="perf-render">0ms</span>
        </div>
        <div class="perf-stat">
          <span class="perf-label">Memory</span>
          <span class="perf-value" id="perf-memory">-</span>
        </div>
      </div>
    `;

    container.appendChild(panel);

    this.canvas = panel.querySelector('.perf-chart');
    this.ctx = this.canvas?.getContext('2d') ?? null;

    panel.querySelector('.perf-close')?.addEventListener('click', () => {
      this.toggle(false);
    });

    this.startUpdateLoop();
  }

  toggle(show?: boolean): void {
    this.visible = show ?? !this.visible;
    const panel = document.querySelector('.perf-panel') as HTMLElement | null;
    if (panel) {
      panel.classList.toggle('visible', this.visible);
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Record frame time for the current frame */
  recordFrame(frameTime: number): void {
    this.metrics.frameTime = frameTime;
    this.metrics.fps = frameTime > 0 ? 1000 / frameTime : 0;

    // Ring buffer for frame history
    this.metrics.frameHistory[this.metrics.historyIndex] = frameTime;
    this.metrics.historyIndex = (this.metrics.historyIndex + 1) % this.HISTORY_SIZE;
  }

  /** Record subsystem timing */
  recordTiming(phase: 'update' | 'render', time: number): void {
    if (phase === 'update') this.metrics.updateTime = time;
    else this.metrics.renderTime = time;
  }

  /** Update particle count display */
  setParticleCount(count: number): void {
    this.metrics.particleCount = count;
  }

  private startUpdateLoop(): void {
    const update = () => {
      if (this.visible) {
        this.updateDisplay();
        this.renderChart();
      }
      this.updateTimer = requestAnimationFrame(update);
    };
    this.updateTimer = requestAnimationFrame(update);
  }

  private updateDisplay(): void {
    this.setText('perf-fps', `${Math.round(this.metrics.fps)}`);
    this.setText('perf-frame', `${this.metrics.frameTime.toFixed(1)}ms`);
    this.setText('perf-particles', `${this.metrics.particleCount}`);
    this.setText('perf-update', `${this.metrics.updateTime.toFixed(1)}ms`);
    this.setText('perf-render', `${this.metrics.renderTime.toFixed(1)}ms`);

    // Memory API (Chrome only)
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    if (mem) {
      const mb = (mem.usedJSHeapSize / 1048576).toFixed(1);
      this.setText('perf-memory', `${mb}MB`);
    }
  }

  private renderChart(): void {
    if (!this.ctx || !this.canvas) return;
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // 16.67ms target line (60fps)
    const targetY = height - (16.67 / 33.33) * height;
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(width, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Frame time graph
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const history = this.metrics.frameHistory;
    const startIdx = this.metrics.historyIndex;

    for (let i = 0; i < this.HISTORY_SIZE; i++) {
      const idx = (startIdx + i) % this.HISTORY_SIZE;
      const x = (i / this.HISTORY_SIZE) * width;
      const normalizedTime = Math.min(history[idx] / 33.33, 1);
      const y = height - normalizedTime * height;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();

    // Gradient fill under the line
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(78, 205, 196, 0.1)');
    gradient.addColorStop(1, 'rgba(78, 205, 196, 0)');
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  private setText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  destroy(): void {
    cancelAnimationFrame(this.updateTimer);
  }
}
