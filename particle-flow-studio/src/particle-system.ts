/**
 * @module particle-system
 * @description High-performance particle system with object pooling
 *
 * Demonstrates:
 * - Object pool pattern for zero-allocation particle recycling
 * - Euler integration for physics simulation
 * - Energy-based visual properties (speed -> brightness)
 * - Configurable particle behaviors with runtime updates
 */

import { FlowField } from './flow-field';
import type { Particle, ParticleConfig, ColorScheme, Vec2 } from './types';

export class ParticleSystem {
  private particles: Particle[] = [];
  private pool: Particle[] = [];

  constructor(
    private config: ParticleConfig,
    private width: number,
    private height: number,
    private colorScheme: ColorScheme
  ) {
    this.initialize();
  }

  private initialize(): void {
    this.particles = [];
    this.pool = [];
    for (let i = 0; i < this.config.count; i++) {
      this.particles.push(this.createParticle());
    }
  }

  private createParticle(pos?: Vec2): Particle {
    const recycled = this.pool.pop();
    const [minSize, maxSize] = this.config.sizeRange;
    const [hueMin, hueMax] = this.colorScheme.hueRange;

    const particle: Particle = recycled || {
      pos: { x: 0, y: 0 },
      prevPos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      acc: { x: 0, y: 0 },
      life: 0,
      maxLife: 0,
      hue: 0,
      size: 0,
      alpha: 0,
      energy: 0,
    };

    const x = pos?.x ?? Math.random() * this.width;
    const y = pos?.y ?? Math.random() * this.height;

    particle.pos.x = x;
    particle.pos.y = y;
    particle.prevPos.x = x;
    particle.prevPos.y = y;
    particle.vel.x = (Math.random() - 0.5) * 0.5;
    particle.vel.y = (Math.random() - 0.5) * 0.5;
    particle.acc.x = 0;
    particle.acc.y = 0;
    particle.maxLife = this.config.lifespan * (0.5 + Math.random() * 0.5);
    particle.life = Math.random() * particle.maxLife;
    particle.hue = hueMin + Math.random() * (hueMax - hueMin);
    particle.size = minSize + Math.random() * (maxSize - minSize);
    particle.alpha = 1;
    particle.energy = 0;

    return particle;
  }

  update(flowField: FlowField, mousePos: Vec2 | null, mouseDown: boolean, mouseForce: number): void {
    const { maxSpeed, friction } = this.config;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Store previous position for trail rendering
      p.prevPos.x = p.pos.x;
      p.prevPos.y = p.pos.y;

      // Apply flow field force (bilinear interpolated)
      const force = flowField.getForceAt(p.pos);
      p.acc.x += force.x * 0.5;
      p.acc.y += force.y * 0.5;

      // Apply mouse interaction
      if (mousePos) {
        const dx = mousePos.x - p.pos.x;
        const dy = mousePos.y - p.pos.y;
        const distSq = dx * dx + dy * dy;
        const radius = mouseForce * mouseForce;

        if (distSq < radius && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const strength = (1 - dist / mouseForce) * 2;

          if (mouseDown) {
            // Attract towards mouse
            p.acc.x += (dx / dist) * strength;
            p.acc.y += (dy / dist) * strength;
          } else {
            // Swirl around mouse (tangential force)
            p.acc.x += (-dy / dist) * strength * 0.3;
            p.acc.y += (dx / dist) * strength * 0.3;
          }
        }
      }

      // Euler integration
      p.vel.x += p.acc.x;
      p.vel.y += p.acc.y;
      p.vel.x *= friction;
      p.vel.y *= friction;

      // Limit speed
      const speed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
      if (speed > maxSpeed) {
        p.vel.x = (p.vel.x / speed) * maxSpeed;
        p.vel.y = (p.vel.y / speed) * maxSpeed;
      }

      // Update energy based on speed (normalized 0..1)
      p.energy = Math.min(speed / maxSpeed, 1);

      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;

      // Reset acceleration
      p.acc.x = 0;
      p.acc.y = 0;

      // Update life and alpha
      p.life++;
      const lifeRatio = p.life / p.maxLife;
      p.alpha = lifeRatio < 0.1
        ? lifeRatio / 0.1
        : lifeRatio > 0.8
          ? (1 - lifeRatio) / 0.2
          : 1;

      // Reset particle if dead or out of bounds
      if (
        p.life >= p.maxLife ||
        p.pos.x < -10 || p.pos.x > this.width + 10 ||
        p.pos.y < -10 || p.pos.y > this.height + 10
      ) {
        this.resetParticle(p);
      }
    }
  }

  private resetParticle(p: Particle): void {
    const [hueMin, hueMax] = this.colorScheme.hueRange;
    const [minSize, maxSize] = this.config.sizeRange;

    const x = Math.random() * this.width;
    const y = Math.random() * this.height;

    p.pos.x = x;
    p.pos.y = y;
    p.prevPos.x = x;
    p.prevPos.y = y;
    p.vel.x = (Math.random() - 0.5) * 0.5;
    p.vel.y = (Math.random() - 0.5) * 0.5;
    p.acc.x = 0;
    p.acc.y = 0;
    p.life = 0;
    p.maxLife = this.config.lifespan * (0.5 + Math.random() * 0.5);
    p.hue = hueMin + Math.random() * (hueMax - hueMin);
    p.size = minSize + Math.random() * (maxSize - minSize);
    p.alpha = 0;
    p.energy = 0;
  }

  getParticles(): ReadonlyArray<Particle> {
    return this.particles;
  }

  getActiveCount(): number {
    return this.particles.filter(p => p.alpha > 0.01).length;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  setCount(count: number): void {
    if (count > this.particles.length) {
      for (let i = this.particles.length; i < count; i++) {
        this.particles.push(this.createParticle());
      }
    } else if (count < this.particles.length) {
      const removed = this.particles.splice(count);
      this.pool.push(...removed);
    }
    this.config.count = count;
  }

  setColorScheme(scheme: ColorScheme): void {
    this.colorScheme = scheme;
  }

  setConfig(config: Partial<ParticleConfig>): void {
    Object.assign(this.config, config);
  }

  /** Create particle burst at position (e.g., on double-click) */
  burst(pos: Vec2, count: number = 50): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length < this.config.count + 200) {
        const p = this.createParticle(pos);
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        p.vel.x = Math.cos(angle) * speed;
        p.vel.y = Math.sin(angle) * speed;
        p.energy = 1;
        this.particles.push(p);
      }
    }
  }
}
