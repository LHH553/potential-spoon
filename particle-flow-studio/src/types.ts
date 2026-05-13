/**
 * @module types
 * @description Core type definitions for Particle Flow Studio
 *
 * Demonstrates advanced TypeScript features:
 * - Branded types for type-safe numeric values
 * - Template literal types for CSS color strings
 * - Conditional types and mapped types
 * - Discriminated unions for state management
 * - Generic constraints with variadic tuples
 */

// ============ Branded Types ============
// Prevent accidental mixing of different numeric units
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type Radians = Brand<number, 'Radians'>;
export type Pixels = Brand<number, 'Pixels'>;
export type Normalized = Brand<number, 'Normalized'>; // 0..1

export const toRadians = (deg: number): Radians => (deg * Math.PI / 180) as Radians;
export const toPixels = (n: number): Pixels => n as Pixels;
export const toNormalized = (n: number): Normalized => Math.max(0, Math.min(1, n)) as Normalized;

// ============ Core Geometry ============
export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============ Particle Types ============
export interface Particle {
  pos: Vec2;
  prevPos: Vec2;
  vel: Vec2;
  acc: Vec2;
  life: number;
  maxLife: number;
  hue: number;
  size: number;
  alpha: number;
  energy: number;
}

// ============ Configuration Types ============
export interface FlowFieldConfig {
  cols: number;
  rows: number;
  cellSize: number;
  noiseScale: number;
  noiseSpeed: number;
  noiseStrength: number;
  curlAmount: number;
}

export interface ParticleConfig {
  count: number;
  maxSpeed: number;
  friction: number;
  lifespan: number;
  sizeRange: [number, number];
  trailLength: number;
  connectionDistance: number;
  enableConnections: boolean;
}

export interface ColorScheme {
  name: string;
  hueRange: [number, number];
  saturation: number;
  lightness: number;
  background: string;
  accentColor: string;
}

// ============ Template Literal Types for CSS ============
export type HslColor = `hsl(${number}, ${number}%, ${number}%)`;
export type HslaColor = `hsla(${number}, ${number}%, ${number}%, ${number})`;
export type HexColor = `#${string}`;
export type CSSColor = HslColor | HslaColor | HexColor | string;

// ============ Blend Modes ============
export type BlendMode = 'source-over' | 'screen' | 'lighten' | 'color-dodge' | 'overlay' | 'multiply';

// ============ Render Configuration ============
export interface PostProcessConfig {
  bloom: boolean;
  bloomIntensity: number;
  bloomRadius: number;
  vignette: boolean;
  vignetteStrength: number;
  chromatic: boolean;
  chromaticOffset: number;
}

export interface RenderConfig {
  colorScheme: ColorScheme;
  blendMode: BlendMode;
  fadeAlpha: number;
  showField: boolean;
  showConnections: boolean;
  glowEffect: boolean;
  postProcess: PostProcessConfig;
}

// ============ Performance Metrics ============
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  particleCount: number;
  updateTime: number;
  renderTime: number;
  memoryUsage: number;
  frameHistory: Float32Array;
  historyIndex: number;
}

// ============ Discriminated Union for Events ============
export type AppEvent =
  | { type: 'particle:burst'; pos: Vec2; count: number }
  | { type: 'field:disturbance'; pos: Vec2; angle: number; strength: number }
  | { type: 'config:change'; key: string; value: unknown }
  | { type: 'render:export' }
  | { type: 'render:clear' }
  | { type: 'app:pause' }
  | { type: 'app:resume' }
  | { type: 'app:resize'; width: number; height: number };

// ============ Gesture Types ============
export type GestureType = 'pan' | 'pinch' | 'rotate' | 'swipe' | 'tap' | 'doubletap';

export interface GestureState {
  type: GestureType;
  active: boolean;
  startPos: Vec2;
  currentPos: Vec2;
  delta: Vec2;
  scale: number;
  rotation: number;
  velocity: Vec2;
}

// ============ Application State ============
export interface AppState {
  isRunning: boolean;
  flowField: FlowFieldConfig;
  particles: ParticleConfig;
  render: RenderConfig;
  mousePos: Vec2 | null;
  mouseDown: boolean;
  mouseForce: number;
  time: number;
  activeTab: TabId;
  showPerformance: boolean;
  showMinimap: boolean;
}

// ============ UI Tab System (Template Literal Types) ============
export type TabId = 'presets' | 'particles' | 'field' | 'render' | 'effects';

export interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
}

export const TABS: readonly TabConfig[] = [
  { id: 'presets', label: 'Presets', icon: '◆' },
  { id: 'particles', label: 'Particles', icon: '◉' },
  { id: 'field', label: 'Flow', icon: '≋' },
  { id: 'render', label: 'Render', icon: '◐' },
  { id: 'effects', label: 'Effects', icon: '✦' },
] as const;

// ============ Color Schemes ============
export const COLOR_SCHEMES: Record<string, ColorScheme> = {
  aurora: {
    name: 'Aurora Borealis',
    hueRange: [120, 280],
    saturation: 80,
    lightness: 60,
    background: '#0a0a1a',
    accentColor: '#4ecdc4',
  },
  fire: {
    name: 'Cosmic Fire',
    hueRange: [0, 60],
    saturation: 90,
    lightness: 55,
    background: '#0d0a05',
    accentColor: '#ff6b35',
  },
  ocean: {
    name: 'Deep Ocean',
    hueRange: [180, 240],
    saturation: 70,
    lightness: 50,
    background: '#030810',
    accentColor: '#0ea5e9',
  },
  neon: {
    name: 'Neon City',
    hueRange: [280, 360],
    saturation: 100,
    lightness: 65,
    background: '#05050f',
    accentColor: '#c084fc',
  },
  monochrome: {
    name: 'Monochrome',
    hueRange: [0, 0],
    saturation: 0,
    lightness: 85,
    background: '#080808',
    accentColor: '#a0a0a0',
  },
  sunset: {
    name: 'Golden Sunset',
    hueRange: [20, 50],
    saturation: 85,
    lightness: 62,
    background: '#0a0506',
    accentColor: '#f59e0b',
  },
  matrix: {
    name: 'Digital Matrix',
    hueRange: [110, 140],
    saturation: 95,
    lightness: 50,
    background: '#010a01',
    accentColor: '#22c55e',
  },
};

// ============ Default State ============
export const DEFAULT_STATE: AppState = {
  isRunning: true,
  flowField: {
    cols: 0,
    rows: 0,
    cellSize: 20,
    noiseScale: 0.003,
    noiseSpeed: 0.0003,
    noiseStrength: 1.0,
    curlAmount: 0.5,
  },
  particles: {
    count: 3000,
    maxSpeed: 3,
    friction: 0.98,
    lifespan: 200,
    sizeRange: [0.5, 2.5],
    trailLength: 0.92,
    connectionDistance: 80,
    enableConnections: false,
  },
  render: {
    colorScheme: COLOR_SCHEMES.aurora,
    blendMode: 'screen',
    fadeAlpha: 0.03,
    showField: false,
    showConnections: false,
    glowEffect: true,
    postProcess: {
      bloom: true,
      bloomIntensity: 0.3,
      bloomRadius: 8,
      vignette: true,
      vignetteStrength: 0.3,
      chromatic: false,
      chromaticOffset: 2,
    },
  },
  mousePos: null,
  mouseDown: false,
  mouseForce: 150,
  time: 0,
  activeTab: 'presets',
  showPerformance: false,
  showMinimap: true,
};

// ============ Utility Types ============
/** Deep partial type - makes all nested properties optional */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Extract config keys that are numeric for range slider binding */
export type NumericKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

/** Event emitter type helper */
export type EventMap = {
  [E in AppEvent as E['type']]: E;
};
