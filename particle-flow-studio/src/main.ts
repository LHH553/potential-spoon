/**
 * @module main
 * @description Application orchestrator and animation loop
 *
 * Demonstrates:
 * - Composition over inheritance architecture
 * - High-precision timing with performance.now()
 * - Debounced resize handling with ResizeObserver
 * - Clean separation of update and render phases
 * - Module-level initialization pattern
 */

import { FlowField } from './flow-field';
import { ParticleSystem } from './particle-system';
import { Renderer } from './renderer';
import { UIController } from './controls';
import { PerformanceMonitor } from './performance-monitor';
import { GestureHandler } from './gesture-handler';
import { DEFAULT_STATE } from './types';
import type { AppState, Vec2 } from './types';
import './style.css';

class App {
  private renderer!: Renderer;
  private flowField!: FlowField;
  private particles!: ParticleSystem;
  private ui!: UIController;
  private perfMonitor!: PerformanceMonitor;
  private gestures!: GestureHandler;
  private state: AppState;
  private rafId: number = 0;
  private lastMousePos: Vec2 | null = null;
  private lastFrameTime: number = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.state = structuredClone(DEFAULT_STATE);
    this.init();
  }

  private init(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas element not found');

    // Initialize subsystems
    this.renderer = new Renderer(canvas);
    const { width, height } = this.renderer.getDimensions();

    this.flowField = new FlowField(this.state.flowField, width, height);
    this.particles = new ParticleSystem(
      this.state.particles,
      width,
      height,
      this.state.render.colorScheme
    );

    this.ui = new UIController(this.state);
    this.ui.onChange((newState) => this.onStateChange(newState));

    // Performance monitor
    this.perfMonitor = new PerformanceMonitor();
    const perfContainer = document.getElementById('perf-container');
    if (perfContainer) this.perfMonitor.mount(perfContainer);

    // Gesture handling for mobile
    this.gestures = new GestureHandler(canvas);
    this.setupGestures();

    // Event listeners
    this.setupEventListeners(canvas);
    this.setupResizeObserver(canvas);

    // Initial render
    this.renderer.clear(this.state.render.colorScheme.background);
    this.lastFrameTime = performance.now();

    // Start loop
    this.loop();

    // Loading complete - fade in
    document.body.classList.add('loaded');
  }

  private setupGestures(): void {
    this.gestures.on('pan', (info) => {
      this.state.mousePos = info.pos;
      this.handleMouseInteraction();
    });

    this.gestures.on('tap', (info) => {
      this.state.mousePos = info.pos;
    });

    this.gestures.on('doubletap', (info) => {
      this.particles.burst(info.pos, 80);
    });

    this.gestures.on('pinch', (info) => {
      // Pinch to adjust mouse force radius
      this.state.mouseForce = Math.max(50, Math.min(400, this.state.mouseForce * info.scale));
    });

    this.gestures.on('longpress', (info) => {
      this.state.mouseDown = true;
      this.state.mousePos = info.pos;
      setTimeout(() => { this.state.mouseDown = false; }, 1000);
    });
  }

  private setupEventListeners(canvas: HTMLCanvasElement): void {
    // Mouse events (desktop)
    canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    canvas.addEventListener('mousedown', () => { this.state.mouseDown = true; });
    canvas.addEventListener('mouseup', () => { this.state.mouseDown = false; });
    canvas.addEventListener('mouseleave', () => {
      this.state.mousePos = null;
      this.state.mouseDown = false;
    });

    // Double click for burst
    canvas.addEventListener('dblclick', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.particles.burst({ x: e.clientX - rect.left, y: e.clientY - rect.top }, 80);
    });

    // Custom events from UI
    document.addEventListener('flow-export', () => this.exportImage());
    document.addEventListener('flow-clear', () => this.clearCanvas());
    document.addEventListener('toggle-performance', () => {
      this.perfMonitor.toggle();
    });
  }

  /** Use ResizeObserver for efficient resize handling */
  private setupResizeObserver(canvas: HTMLCanvasElement): void {
    let resizeTimeout: number;

    this.resizeObserver = new ResizeObserver(() => {
      // Debounce resize for performance
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => this.handleResize(), 100);
    });

    this.resizeObserver.observe(canvas);
  }

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.renderer.getCanvas().getBoundingClientRect();
    this.state.mousePos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    this.handleMouseInteraction();
  }

  private handleMouseInteraction(): void {
    if (this.state.mousePos && this.lastMousePos) {
      const dx = this.state.mousePos.x - this.lastMousePos.x;
      const dy = this.state.mousePos.y - this.lastMousePos.y;
      const speed = Math.sqrt(dx * dx + dy * dy);

      if (speed > 2) {
        const angle = Math.atan2(dy, dx);
        this.flowField.addDisturbance(
          this.state.mousePos,
          angle,
          Math.min(speed * 0.1, 2),
          this.state.mouseForce
        );
      }
    }
    this.lastMousePos = this.state.mousePos ? { ...this.state.mousePos } : null;
  }

  private handleResize(): void {
    this.renderer.resize();
    const { width, height } = this.renderer.getDimensions();
    this.flowField.resize(width, height);
    this.particles.resize(width, height);
  }

  private onStateChange(state: AppState): void {
    this.particles.setCount(state.particles.count);
    this.particles.setColorScheme(state.render.colorScheme);
    this.particles.setConfig(state.particles);
    this.flowField.setConfig(state.flowField);
  }

  /** Main animation loop with precise timing */
  private loop(): void {
    this.rafId = requestAnimationFrame(() => this.loop());

    if (!this.state.isRunning) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Performance tracking
    this.perfMonitor.recordFrame(frameTime);
    this.perfMonitor.setParticleCount(this.particles.getParticles().length);

    // === UPDATE PHASE ===
    const updateStart = performance.now();
    this.state.time++;
    this.flowField.update(this.state.time);
    this.particles.update(
      this.flowField,
      this.state.mousePos,
      this.state.mouseDown,
      this.state.mouseForce
    );
    this.perfMonitor.recordTiming('update', performance.now() - updateStart);

    // === RENDER PHASE ===
    const renderStart = performance.now();
    this.renderer.renderFrame(
      this.particles.getParticles(),
      this.state.render,
      this.state.render.showField ? this.flowField : null
    );

    // Mouse cursor feedback
    this.renderer.renderMouseFeedback(
      this.state.mousePos,
      this.state.mouseForce,
      this.state.mouseDown
    );
    this.perfMonitor.recordTiming('render', performance.now() - renderStart);

    // Update FPS display in header
    this.updateFPSDisplay(frameTime);
  }

  private updateFPSDisplay(frameTime: number): void {
    const fpsEl = document.getElementById('fps');
    if (fpsEl) {
      const fps = frameTime > 0 ? Math.round(1000 / frameTime) : 0;
      fpsEl.textContent = `${fps} FPS`;
      fpsEl.classList.toggle('fps-low', fps < 30);
      fpsEl.classList.toggle('fps-mid', fps >= 30 && fps < 55);
    }
  }

  private exportImage(): void {
    const dataUrl = this.renderer.exportImage();
    const link = document.createElement('a');
    link.download = `flow-art-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }

  private clearCanvas(): void {
    this.renderer.clear(this.state.render.colorScheme.background);
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.perfMonitor.destroy();
    this.gestures.destroy();
  }
}

// Application bootstrap
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
