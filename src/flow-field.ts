/**
 * @module flow-field
 * @description Vector field generator using noise-based algorithms
 *
 * Demonstrates:
 * - Curl noise for divergence-free fields (no particle clustering)
 * - Typed arrays (Float32Array) for high-performance data storage
 * - Bilinear interpolation for smooth force sampling
 * - Interactive mouse disturbance with decay
 */

import { SimplexNoise } from './noise';
import { Vector2 } from './vector';
import type { FlowFieldConfig, Vec2 } from './types';

interface Disturbance {
  pos: Vec2;
  angle: number;
  strength: number;
  decay: number;
  radius: number;
}

export class FlowField {
  private field: Float32Array;
  private noise: SimplexNoise;
  private disturbances: Disturbance[] = [];

  cols: number;
  rows: number;

  constructor(private config: FlowFieldConfig, private width: number, private height: number) {
    this.cols = Math.ceil(width / config.cellSize);
    this.rows = Math.ceil(height / config.cellSize);
    this.config.cols = this.cols;
    this.config.rows = this.rows;
    this.field = new Float32Array(this.cols * this.rows);
    this.noise = new SimplexNoise(42);
  }

  /** Update field using simplex noise with optional curl calculation */
  update(time: number): void {
    const { noiseScale, noiseSpeed, noiseStrength, curlAmount } = this.config;
    const zOffset = time * noiseSpeed;
    const epsilon = 0.01;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const index = y * this.cols + x;
        const px = x * this.config.cellSize;
        const py = y * this.config.cellSize;

        let angle: number;

        if (curlAmount > 0) {
          // Curl noise: compute curl of noise field for divergence-free flow
          const n1 = this.noise.fbm((px + epsilon) * noiseScale + zOffset, py * noiseScale + zOffset, 3);
          const n2 = this.noise.fbm((px - epsilon) * noiseScale + zOffset, py * noiseScale + zOffset, 3);
          const n3 = this.noise.fbm(px * noiseScale + zOffset, (py + epsilon) * noiseScale + zOffset, 3);
          const n4 = this.noise.fbm(px * noiseScale + zOffset, (py - epsilon) * noiseScale + zOffset, 3);

          const curlX = (n3 - n4) / (2 * epsilon);
          const curlY = -(n1 - n2) / (2 * epsilon);
          const curlAngle = Math.atan2(curlY, curlX);

          const baseAngle = this.noise.fbm(px * noiseScale + zOffset, py * noiseScale + zOffset, 3) * Math.PI * 2;
          angle = baseAngle * (1 - curlAmount) + curlAngle * curlAmount;
        } else {
          const noiseVal = this.noise.fbm(px * noiseScale + zOffset, py * noiseScale + zOffset, 3);
          angle = noiseVal * Math.PI * 2;
        }

        angle *= noiseStrength;

        // Apply active disturbances
        for (const dist of this.disturbances) {
          const dx = px - dist.pos.x;
          const dy = py - dist.pos.y;
          const distSq = dx * dx + dy * dy;
          const radiusSq = dist.radius * dist.radius;

          if (distSq < radiusSq) {
            const influence = (1 - distSq / radiusSq) * dist.strength;
            angle += dist.angle * influence;
          }
        }

        this.field[index] = angle;
      }
    }

    // Decay and remove expired disturbances
    this.disturbances = this.disturbances.filter(d => {
      d.strength *= d.decay;
      return d.strength > 0.01;
    });
  }

  getAngleAt(x: number, y: number): number {
    const col = Math.floor(x / this.config.cellSize);
    const row = Math.floor(y / this.config.cellSize);

    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return 0;
    }

    return this.field[row * this.cols + col];
  }

  /** Bilinear interpolation for smoother forces between grid cells */
  getForceAt(pos: Vec2): Vector2 {
    const fx = pos.x / this.config.cellSize;
    const fy = pos.y / this.config.cellSize;

    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, this.cols - 1);
    const y1 = Math.min(y0 + 1, this.rows - 1);

    if (x0 < 0 || y0 < 0 || x0 >= this.cols || y0 >= this.rows) {
      return new Vector2(0, 0);
    }

    const tx = fx - x0;
    const ty = fy - y0;

    const a00 = this.field[y0 * this.cols + x0];
    const a10 = this.field[y0 * this.cols + x1];
    const a01 = this.field[y1 * this.cols + x0];
    const a11 = this.field[y1 * this.cols + x1];

    const angle = a00 * (1 - tx) * (1 - ty) + a10 * tx * (1 - ty) +
                  a01 * (1 - tx) * ty + a11 * tx * ty;

    return Vector2.fromAngle(angle);
  }

  addDisturbance(pos: Vec2, angle: number, strength: number = 1, radius: number = 100): void {
    this.disturbances.push({
      pos: { x: pos.x, y: pos.y },
      angle,
      strength,
      decay: 0.95,
      radius,
    });
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.cols = Math.ceil(width / this.config.cellSize);
    this.rows = Math.ceil(height / this.config.cellSize);
    this.config.cols = this.cols;
    this.config.rows = this.rows;
    this.field = new Float32Array(this.cols * this.rows);
  }

  getField(): Float32Array {
    return this.field;
  }

  getConfig(): FlowFieldConfig {
    return this.config;
  }

  setConfig(config: Partial<FlowFieldConfig>): void {
    Object.assign(this.config, config);
    if (config.cellSize) {
      this.resize(this.width, this.height);
    }
  }
}
