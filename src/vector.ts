/** 2D Vector utility class with immutable operations */

import type { Vec2 } from './types';

export class Vector2 implements Vec2 {
  constructor(public x: number = 0, public y: number = 0) {}

  static from(v: Vec2): Vector2 {
    return new Vector2(v.x, v.y);
  }

  static fromAngle(angle: number, magnitude: number = 1): Vector2 {
    return new Vector2(
      Math.cos(angle) * magnitude,
      Math.sin(angle) * magnitude
    );
  }

  static distance(a: Vec2, b: Vec2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static lerp(a: Vec2, b: Vec2, t: number): Vector2 {
    return new Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  }

  add(v: Vec2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  sub(v: Vec2): Vector2 {
    return new Vector2(this.x - v.x, this.y - v.y);
  }

  mult(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  div(scalar: number): Vector2 {
    if (scalar === 0) return new Vector2(0, 0);
    return new Vector2(this.x / scalar, this.y / scalar);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2 {
    const mag = this.magnitude();
    return mag > 0 ? this.div(mag) : new Vector2(0, 0);
  }

  limit(max: number): Vector2 {
    const mag = this.magnitude();
    if (mag > max) {
      return this.normalize().mult(max);
    }
    return new Vector2(this.x, this.y);
  }

  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }
}
