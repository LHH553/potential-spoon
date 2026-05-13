/**
 * @module renderer
 * @description Advanced Canvas 2D renderer with post-processing pipeline
 *
 * Demonstrates:
 * - Multi-layer canvas compositing architecture
 * - Off-screen canvas for post-processing (bloom effect)
 * - Device pixel ratio (DPR) handling for retina displays
 * - Spatial partitioning for particle connection optimization
 * - Custom composite operations for artistic effects
 */

import type { Particle, RenderConfig, PostProcessConfig, Vec2 } from './types';
import type { FlowField } from './flow-field';

/** Spatial grid cell for O(n) neighbor lookup instead of O(n²) */
interface SpatialCell {
  particles: Particle[];
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private trailCanvas: HTMLCanvasElement;
  private trailCtx: CanvasRenderingContext2D;
  private bloomCanvas: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;
  private dpr: number = 1;

  // Spatial grid for connection optimization
  private grid: SpatialCell[][] = [];
  private gridCols: number = 0;
  private gridRows: number = 0;
  private readonly GRID_SIZE = 100;

  // Minimap
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;

    // Trail layer - persistent particle trails
    this.trailCanvas = document.createElement('canvas');
    const trailCtx = this.trailCanvas.getContext('2d', { alpha: false });
    if (!trailCtx) throw new Error('Failed to get trail context');
    this.trailCtx = trailCtx;

    // Bloom layer - for glow post-processing
    this.bloomCanvas = document.createElement('canvas');
    const bloomCtx = this.bloomCanvas.getContext('2d', { alpha: true });
    if (!bloomCtx) throw new Error('Failed to get bloom context');
    this.bloomCtx = bloomCtx;

    // Minimap
    this.minimapCanvas = document.createElement('canvas');
    const minimapCtx = this.minimapCanvas.getContext('2d', { alpha: true });
    if (!minimapCtx) throw new Error('Failed to get minimap context');
    this.minimapCtx = minimapCtx;

    this.resize();
    this.mountMinimap();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    // Resize all canvases
    const physicalWidth = rect.width * this.dpr;
    const physicalHeight = rect.height * this.dpr;

    for (const cvs of [this.canvas, this.trailCanvas]) {
      cvs.width = physicalWidth;
      cvs.height = physicalHeight;
    }

    this.ctx.scale(this.dpr, this.dpr);
    this.trailCtx.scale(this.dpr, this.dpr);

    // Bloom at half resolution for performance
    this.bloomCanvas.width = physicalWidth / 2;
    this.bloomCanvas.height = physicalHeight / 2;
    this.bloomCtx.scale(this.dpr / 2, this.dpr / 2);

    // Update spatial grid
    this.gridCols = Math.ceil(this.width / this.GRID_SIZE);
    this.gridRows = Math.ceil(this.height / this.GRID_SIZE);

    // Minimap
    this.minimapCanvas.width = 160;
    this.minimapCanvas.height = 100;
  }

  clear(background: string): void {
    this.ctx.fillStyle = background;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.trailCtx.fillStyle = background;
    this.trailCtx.fillRect(0, 0, this.width, this.height);
  }

  /** Main render pipeline */
  renderFrame(
    particles: ReadonlyArray<Particle>,
    renderConfig: RenderConfig,
    flowField: FlowField | null
  ): void {
    const { colorScheme, blendMode, fadeAlpha, postProcess } = renderConfig;

    // === Layer 1: Fade trails ===
    this.trailCtx.fillStyle = `rgba(${this.hexToRgb(colorScheme.background)}, ${fadeAlpha})`;
    this.trailCtx.fillRect(0, 0, this.width, this.height);

    // === Layer 2: Draw particles with blend mode ===
    this.trailCtx.globalCompositeOperation = blendMode as GlobalCompositeOperation;

    for (const p of particles) {
      if (p.alpha <= 0.01) continue;

      const alpha = p.alpha * 0.85;
      const { saturation, lightness } = colorScheme;

      // Draw trail line from previous position
      if (p.prevPos && renderConfig.glowEffect) {
        const dx = p.pos.x - p.prevPos.x;
        const dy = p.pos.y - p.prevPos.y;
        const speed = Math.sqrt(dx * dx + dy * dy);

        if (speed > 0.5) {
          this.trailCtx.strokeStyle = `hsla(${p.hue}, ${saturation}%, ${lightness}%, ${alpha * 0.6})`;
          this.trailCtx.lineWidth = p.size * 0.8;
          this.trailCtx.lineCap = 'round';
          this.trailCtx.beginPath();
          this.trailCtx.moveTo(p.prevPos.x, p.prevPos.y);
          this.trailCtx.lineTo(p.pos.x, p.pos.y);
          this.trailCtx.stroke();
        }
      }

      // Draw particle point
      this.trailCtx.fillStyle = `hsla(${p.hue}, ${saturation}%, ${lightness}%, ${alpha})`;
      this.trailCtx.beginPath();
      this.trailCtx.arc(p.pos.x, p.pos.y, p.size * (0.8 + p.energy * 0.4), 0, Math.PI * 2);
      this.trailCtx.fill();

      // Glow core for high-energy particles
      if (renderConfig.glowEffect && p.energy > 0.5) {
        this.trailCtx.fillStyle = `hsla(${p.hue}, ${saturation}%, ${Math.min(lightness + 20, 95)}%, ${alpha * p.energy * 0.5})`;
        this.trailCtx.beginPath();
        this.trailCtx.arc(p.pos.x, p.pos.y, p.size * 2, 0, Math.PI * 2);
        this.trailCtx.fill();
      }
    }

    this.trailCtx.globalCompositeOperation = 'source-over';

    // === Layer 3: Particle connections ===
    if (renderConfig.showConnections) {
      this.renderConnections(particles, colorScheme.saturation, colorScheme.lightness);
    }

    // === Composit to main canvas ===
    this.ctx.drawImage(this.trailCanvas, 0, 0, this.width, this.height);

    // === Layer 4: Post-processing ===
    if (postProcess.bloom) {
      this.applyBloom(postProcess);
    }

    if (postProcess.vignette) {
      this.applyVignette(postProcess.vignetteStrength);
    }

    // === Layer 5: Flow field debug overlay ===
    if (renderConfig.showField && flowField) {
      this.renderFlowField(flowField);
    }

    // === Layer 6: Update minimap ===
    this.updateMinimap(particles);
  }

  /** Render particle connections using spatial partitioning */
  private renderConnections(
    particles: ReadonlyArray<Particle>,
    saturation: number,
    lightness: number
  ): void {
    // Build spatial grid
    this.grid = Array.from({ length: this.gridRows }, () =>
      Array.from({ length: this.gridCols }, () => ({ particles: [] }))
    );

    for (const p of particles) {
      if (p.alpha <= 0.1) continue;
      const col = Math.floor(p.pos.x / this.GRID_SIZE);
      const row = Math.floor(p.pos.y / this.GRID_SIZE);
      if (col >= 0 && col < this.gridCols && row >= 0 && row < this.gridRows) {
        this.grid[row][col].particles.push(p);
      }
    }

    // Draw connections between nearby particles
    this.trailCtx.lineWidth = 0.5;
    const maxDist = 80;
    const maxDistSq = maxDist * maxDist;

    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const cell = this.grid[row][col];
        if (cell.particles.length === 0) continue;

        // Check current and neighboring cells
        for (let dr = 0; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr < 0 || nr >= this.gridRows || nc < 0 || nc >= this.gridCols) continue;
            if (dr === 0 && dc <= 0 && !(dr === 0 && dc === 0)) continue;

            const neighbor = this.grid[nr][nc];
            for (const p1 of cell.particles) {
              const startIdx = (nr === row && nc === col) ? cell.particles.indexOf(p1) + 1 : 0;
              const targetList = (nr === row && nc === col) ? cell.particles : neighbor.particles;

              for (let i = startIdx; i < targetList.length; i++) {
                const p2 = targetList[i];
                const dx = p1.pos.x - p2.pos.x;
                const dy = p1.pos.y - p2.pos.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < maxDistSq) {
                  const alpha = (1 - distSq / maxDistSq) * 0.3 * Math.min(p1.alpha, p2.alpha);
                  const hue = (p1.hue + p2.hue) / 2;
                  this.trailCtx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
                  this.trailCtx.beginPath();
                  this.trailCtx.moveTo(p1.pos.x, p1.pos.y);
                  this.trailCtx.lineTo(p2.pos.x, p2.pos.y);
                  this.trailCtx.stroke();
                }
              }
            }
          }
        }
      }
    }
  }

  /** Bloom post-processing using downsampled blur */
  private applyBloom(config: PostProcessConfig): void {
    const { bloomIntensity, bloomRadius } = config;

    // Draw current frame to bloom canvas at half resolution
    this.bloomCtx.clearRect(0, 0, this.width, this.height);
    this.bloomCtx.filter = `blur(${bloomRadius}px) brightness(1.5)`;
    this.bloomCtx.drawImage(this.trailCanvas, 0, 0, this.width, this.height);
    this.bloomCtx.filter = 'none';

    // Composite bloom onto main canvas
    this.ctx.globalAlpha = bloomIntensity;
    this.ctx.globalCompositeOperation = 'screen';
    this.ctx.drawImage(this.bloomCanvas, 0, 0, this.width, this.height);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
  }

  /** Vignette effect using radial gradient */
  private applyVignette(strength: number): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = Math.max(cx, cy) * 1.2;

    const gradient = this.ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${strength})`);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /** Render flow field debug vectors */
  private renderFlowField(flowField: FlowField): void {
    const config = flowField.getConfig();
    const field = flowField.getField();

    this.ctx.lineWidth = 1;

    for (let y = 0; y < config.rows; y++) {
      for (let x = 0; x < config.cols; x++) {
        const index = y * config.cols + x;
        const angle = field[index];
        const cx = x * config.cellSize + config.cellSize / 2;
        const cy = y * config.cellSize + config.cellSize / 2;
        const len = config.cellSize * 0.35;

        // Color based on angle for visualization
        const hue = ((angle / Math.PI) * 180 + 360) % 360;
        this.ctx.strokeStyle = `hsla(${hue}, 60%, 60%, 0.25)`;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        this.ctx.stroke();

        // Arrow tip
        const tipX = cx + Math.cos(angle) * len;
        const tipY = cy + Math.sin(angle) * len;
        this.ctx.fillStyle = `hsla(${hue}, 60%, 60%, 0.4)`;
        this.ctx.beginPath();
        this.ctx.arc(tipX, tipY, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  /** Minimap showing particle density */
  private updateMinimap(particles: ReadonlyArray<Particle>): void {
    const mw = 160;
    const mh = 100;
    const ctx = this.minimapCtx;

    ctx.clearRect(0, 0, mw, mh);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, mw, mh);

    const scaleX = mw / this.width;
    const scaleY = mh / this.height;

    ctx.fillStyle = 'rgba(78, 205, 196, 0.6)';
    for (let i = 0; i < particles.length; i += 4) { // Sample every 4th particle
      const p = particles[i];
      if (p.alpha > 0.1) {
        ctx.fillRect(p.pos.x * scaleX, p.pos.y * scaleY, 1, 1);
      }
    }

    // Draw to the mounted minimap element
    const minimapEl = document.querySelector('.minimap-canvas') as HTMLCanvasElement | null;
    if (minimapEl) {
      const targetCtx = minimapEl.getContext('2d');
      if (targetCtx) {
        targetCtx.clearRect(0, 0, mw, mh);
        targetCtx.drawImage(this.minimapCanvas, 0, 0);
      }
    }
  }

  private mountMinimap(): void {
    // Minimap will be rendered into the DOM element
  }

  /** Draw mouse interaction feedback */
  renderMouseFeedback(pos: Vec2 | null, radius: number, isDown: boolean): void {
    if (!pos) return;

    this.ctx.save();

    // Outer ring
    const gradient = this.ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
    gradient.addColorStop(0, 'rgba(78, 205, 196, 0)');
    gradient.addColorStop(0.7, 'rgba(78, 205, 196, 0)');
    gradient.addColorStop(1, `rgba(78, 205, 196, ${isDown ? 0.3 : 0.15})`);

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Center dot
    this.ctx.fillStyle = `rgba(78, 205, 196, ${isDown ? 0.8 : 0.4})`;
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
    this.ctx.fill();

    // Crosshair lines
    this.ctx.strokeStyle = `rgba(78, 205, 196, ${isDown ? 0.4 : 0.2})`;
    this.ctx.lineWidth = 0.5;
    this.ctx.setLineDash([4, 4]);

    this.ctx.beginPath();
    this.ctx.moveTo(pos.x - 12, pos.y);
    this.ctx.lineTo(pos.x + 12, pos.y);
    this.ctx.moveTo(pos.x, pos.y - 12);
    this.ctx.lineTo(pos.x, pos.y + 12);
    this.ctx.stroke();

    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  private hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '0, 0, 0';
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  exportImage(): string {
    return this.canvas.toDataURL('image/png');
  }
}
