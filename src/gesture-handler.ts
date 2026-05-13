/**
 * @module gesture-handler
 * @description Multi-touch gesture recognition for mobile interaction
 *
 * Demonstrates:
 * - Touch event handling with pointer events API
 * - Gesture state machine pattern
 * - Vector math for pinch/rotate detection
 * - Passive event listeners for scroll performance
 */

import type { Vec2 } from './types';

export type GestureCallback = (state: GestureInfo) => void;

export interface GestureInfo {
  type: 'pan' | 'pinch' | 'rotate' | 'tap' | 'doubletap' | 'longpress';
  pos: Vec2;
  delta: Vec2;
  scale: number;
  rotation: number;
  velocity: Vec2;
  pointerCount: number;
}

interface PointerData {
  id: number;
  start: Vec2;
  current: Vec2;
  previous: Vec2;
  startTime: number;
}

export class GestureHandler {
  private pointers = new Map<number, PointerData>();
  private callbacks = new Map<string, GestureCallback[]>();
  private lastTapTime = 0;
  private longPressTimer: number | null = null;
  private readonly LONG_PRESS_DURATION = 500;
  private readonly DOUBLE_TAP_THRESHOLD = 300;
  private readonly TAP_DISTANCE_THRESHOLD = 10;

  constructor(private element: HTMLElement) {
    this.bindEvents();
  }

  on(gesture: GestureInfo['type'], callback: GestureCallback): () => void {
    const list = this.callbacks.get(gesture) ?? [];
    list.push(callback);
    this.callbacks.set(gesture, list);
    return () => {
      const idx = list.indexOf(callback);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  private emit(info: GestureInfo): void {
    const list = this.callbacks.get(info.type);
    if (list) {
      for (const cb of list) cb(info);
    }
  }

  private bindEvents(): void {
    const el = this.element;

    el.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: false });
    el.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: false });
    el.addEventListener('pointerup', (e) => this.onPointerUp(e));
    el.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    // Prevent default touch behavior for our canvas
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  private onPointerDown(e: PointerEvent): void {
    e.preventDefault();
    this.element.setPointerCapture(e.pointerId);

    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      start: { x: e.clientX, y: e.clientY },
      current: { x: e.clientX, y: e.clientY },
      previous: { x: e.clientX, y: e.clientY },
      startTime: performance.now(),
    });

    // Start long press detection
    this.longPressTimer = window.setTimeout(() => {
      if (this.pointers.size === 1) {
        const ptr = [...this.pointers.values()][0];
        const dist = this.distance(ptr.start, ptr.current);
        if (dist < this.TAP_DISTANCE_THRESHOLD) {
          this.emit({
            type: 'longpress',
            pos: ptr.current,
            delta: { x: 0, y: 0 },
            scale: 1,
            rotation: 0,
            velocity: { x: 0, y: 0 },
            pointerCount: 1,
          });
        }
      }
    }, this.LONG_PRESS_DURATION);
  }

  private onPointerMove(e: PointerEvent): void {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;

    ptr.previous = { ...ptr.current };
    ptr.current = { x: e.clientX, y: e.clientY };

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.pointers.size === 1) {
      // Single pointer - pan gesture
      this.emit({
        type: 'pan',
        pos: ptr.current,
        delta: {
          x: ptr.current.x - ptr.previous.x,
          y: ptr.current.y - ptr.previous.y,
        },
        scale: 1,
        rotation: 0,
        velocity: {
          x: ptr.current.x - ptr.previous.x,
          y: ptr.current.y - ptr.previous.y,
        },
        pointerCount: 1,
      });
    } else if (this.pointers.size === 2) {
      // Two pointers - pinch/rotate
      const ptrs = [...this.pointers.values()];
      const [p1, p2] = ptrs;

      const currentDist = this.distance(p1.current, p2.current);
      const prevDist = this.distance(p1.previous, p2.previous);
      const scale = prevDist > 0 ? currentDist / prevDist : 1;

      const currentAngle = Math.atan2(
        p2.current.y - p1.current.y,
        p2.current.x - p1.current.x
      );
      const prevAngle = Math.atan2(
        p2.previous.y - p1.previous.y,
        p2.previous.x - p1.previous.x
      );

      const center: Vec2 = {
        x: (p1.current.x + p2.current.x) / 2,
        y: (p1.current.y + p2.current.y) / 2,
      };

      this.emit({
        type: 'pinch',
        pos: center,
        delta: { x: 0, y: 0 },
        scale,
        rotation: currentAngle - prevAngle,
        velocity: { x: 0, y: 0 },
        pointerCount: 2,
      });

      if (Math.abs(currentAngle - prevAngle) > 0.01) {
        this.emit({
          type: 'rotate',
          pos: center,
          delta: { x: 0, y: 0 },
          scale: 1,
          rotation: currentAngle - prevAngle,
          velocity: { x: 0, y: 0 },
          pointerCount: 2,
        });
      }
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    const dist = this.distance(ptr.start, ptr.current);
    const duration = performance.now() - ptr.startTime;

    // Detect tap
    if (dist < this.TAP_DISTANCE_THRESHOLD && duration < 300) {
      const now = performance.now();
      if (now - this.lastTapTime < this.DOUBLE_TAP_THRESHOLD) {
        this.emit({
          type: 'doubletap',
          pos: ptr.current,
          delta: { x: 0, y: 0 },
          scale: 1,
          rotation: 0,
          velocity: { x: 0, y: 0 },
          pointerCount: 0,
        });
        this.lastTapTime = 0;
      } else {
        this.lastTapTime = now;
        this.emit({
          type: 'tap',
          pos: ptr.current,
          delta: { x: 0, y: 0 },
          scale: 1,
          rotation: 0,
          velocity: { x: 0, y: 0 },
          pointerCount: 0,
        });
      }
    }

    this.pointers.delete(e.pointerId);
    this.element.releasePointerCapture(e.pointerId);
  }

  private distance(a: Vec2, b: Vec2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  destroy(): void {
    this.pointers.clear();
    this.callbacks.clear();
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
  }
}
