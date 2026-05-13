/**
 * @module controls
 * @description Tabbed UI control panel with rich interactions
 *
 * Demonstrates:
 * - Event delegation pattern for efficient DOM event handling
 * - Data attribute driven UI binding
 * - Programmatic DOM manipulation with type safety
 * - Observer pattern for state synchronization
 * - CSS class-based animation triggers
 */

import type { AppState, BlendMode, TabId } from './types';
import { COLOR_SCHEMES, TABS } from './types';

type StateChangeCallback = (state: AppState) => void;

export class UIController {
  private callbacks: StateChangeCallback[] = [];

  constructor(private state: AppState) {
    this.bindTabs();
    this.bindControls();
    this.setupPresets();
    this.setupKeyboardShortcuts();
    this.showTab('presets');
  }

  onChange(cb: StateChangeCallback): void {
    this.callbacks.push(cb);
  }

  private emit(): void {
    for (const cb of this.callbacks) {
      cb(this.state);
    }
  }

  // ============ Tab System ============
  private bindTabs(): void {
    const tabBar = document.querySelector('.tab-bar');
    if (!tabBar) return;

    // Event delegation - single listener for all tab buttons
    tabBar.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tab]');
      if (!btn) return;

      const tabId = btn.dataset.tab as TabId;
      this.showTab(tabId);
    });
  }

  private showTab(id: TabId): void {
    this.state.activeTab = id;

    // Update tab buttons
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === id);
    });

    // Update tab panels with animation
    document.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => {
      const isActive = panel.dataset.panel === id;
      if (isActive) {
        panel.classList.remove('hidden');
        panel.classList.add('entering');
        requestAnimationFrame(() => {
          panel.classList.remove('entering');
        });
      } else {
        panel.classList.add('hidden');
      }
    });
  }

  // ============ Control Bindings ============
  private bindControls(): void {
    // Particle count
    this.bindRange('particle-count', (v) => {
      this.state.particles.count = v;
      this.updateLabel('particle-count-val', v.toString());
    });

    // Particle speed
    this.bindRange('particle-speed', (v) => {
      this.state.particles.maxSpeed = v;
      this.updateLabel('particle-speed-val', v.toFixed(1));
    });

    // Particle size
    this.bindRange('particle-size', (v) => {
      this.state.particles.sizeRange = [v * 0.3, v];
      this.updateLabel('particle-size-val', v.toFixed(1));
    });

    // Lifespan
    this.bindRange('particle-life', (v) => {
      this.state.particles.lifespan = v;
      this.updateLabel('particle-life-val', v.toString());
    });

    // Friction
    this.bindRange('particle-friction', (v) => {
      this.state.particles.friction = v;
      this.updateLabel('particle-friction-val', v.toFixed(3));
    });

    // Noise scale
    this.bindRange('noise-scale', (v) => {
      this.state.flowField.noiseScale = v;
      this.updateLabel('noise-scale-val', v.toFixed(4));
    });

    // Noise speed
    this.bindRange('noise-speed', (v) => {
      this.state.flowField.noiseSpeed = v;
      this.updateLabel('noise-speed-val', v.toFixed(4));
    });

    // Turbulence
    this.bindRange('turbulence', (v) => {
      this.state.flowField.noiseStrength = v;
      this.updateLabel('turbulence-val', v.toFixed(1));
    });

    // Curl noise amount
    this.bindRange('curl-amount', (v) => {
      this.state.flowField.curlAmount = v;
      this.updateLabel('curl-amount-val', v.toFixed(2));
    });

    // Trail length (fade alpha)
    this.bindRange('trail-length', (v) => {
      this.state.render.fadeAlpha = v;
      this.updateLabel('trail-length-val', v.toFixed(3));
    });

    // Mouse force
    this.bindRange('mouse-force', (v) => {
      this.state.mouseForce = v;
      this.updateLabel('mouse-force-val', v.toString());
    });

    // Bloom intensity
    this.bindRange('bloom-intensity', (v) => {
      this.state.render.postProcess.bloomIntensity = v;
      this.updateLabel('bloom-intensity-val', v.toFixed(2));
    });

    // Bloom radius
    this.bindRange('bloom-radius', (v) => {
      this.state.render.postProcess.bloomRadius = v;
      this.updateLabel('bloom-radius-val', v.toString());
    });

    // Vignette strength
    this.bindRange('vignette-strength', (v) => {
      this.state.render.postProcess.vignetteStrength = v;
      this.updateLabel('vignette-strength-val', v.toFixed(2));
    });

    // Color scheme
    const schemeSelect = document.getElementById('color-scheme') as HTMLSelectElement | null;
    if (schemeSelect) {
      schemeSelect.addEventListener('change', () => {
        const scheme = COLOR_SCHEMES[schemeSelect.value];
        if (scheme) {
          this.state.render.colorScheme = scheme;
          this.updateAccentColor(scheme.accentColor);
          this.emit();
        }
      });
    }

    // Blend mode
    const blendSelect = document.getElementById('blend-mode') as HTMLSelectElement | null;
    if (blendSelect) {
      blendSelect.addEventListener('change', () => {
        this.state.render.blendMode = blendSelect.value as BlendMode;
        this.emit();
      });
    }

    // Toggles
    this.bindToggle('show-field', (v) => { this.state.render.showField = v; });
    this.bindToggle('show-connections', (v) => {
      this.state.render.showConnections = v;
      this.state.particles.enableConnections = v;
    });
    this.bindToggle('show-glow', (v) => { this.state.render.glowEffect = v; });
    this.bindToggle('enable-bloom', (v) => { this.state.render.postProcess.bloom = v; });
    this.bindToggle('enable-vignette', (v) => { this.state.render.postProcess.vignette = v; });

    // Play/Pause
    const playBtn = document.getElementById('play-pause');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.state.isRunning = !this.state.isRunning;
        playBtn.innerHTML = this.state.isRunning
          ? '<span class="btn-icon">⏸</span> Pause'
          : '<span class="btn-icon">▶</span> Play';
        playBtn.classList.toggle('paused', !this.state.isRunning);
        this.emit();
      });
    }

    // Export
    document.getElementById('export-btn')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('flow-export'));
      this.showToast('Image exported successfully');
    });

    // Clear
    document.getElementById('clear-btn')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('flow-clear'));
    });

    // Performance toggle
    document.getElementById('perf-toggle')?.addEventListener('click', () => {
      this.state.showPerformance = !this.state.showPerformance;
      document.dispatchEvent(new CustomEvent('toggle-performance'));
    });

    // Panel toggle for mobile
    const toggleBtn = document.getElementById('panel-toggle');
    const panel = document.getElementById('control-panel');
    if (toggleBtn && panel) {
      toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('collapsed');
        toggleBtn.classList.toggle('active');
      });
    }
  }

  // ============ Presets ============
  private setupPresets(): void {
    const presetBtns = document.querySelectorAll<HTMLButtonElement>('[data-preset]');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        if (preset) {
          this.applyPreset(preset);
          // Animate button
          btn.classList.add('activated');
          setTimeout(() => btn.classList.remove('activated'), 600);
        }
      });
    });
  }

  private applyPreset(name: string): void {
    switch (name) {
      case 'calm':
        Object.assign(this.state.particles, { maxSpeed: 1.5, count: 2000, lifespan: 300, friction: 0.99 });
        Object.assign(this.state.flowField, { noiseScale: 0.002, noiseSpeed: 0.0001, noiseStrength: 0.8, curlAmount: 0.7 });
        Object.assign(this.state.render, { fadeAlpha: 0.01, colorScheme: COLOR_SCHEMES.ocean, blendMode: 'screen' as BlendMode });
        break;
      case 'storm':
        Object.assign(this.state.particles, { maxSpeed: 5, count: 5000, lifespan: 120, friction: 0.96 });
        Object.assign(this.state.flowField, { noiseScale: 0.005, noiseSpeed: 0.001, noiseStrength: 2.0, curlAmount: 0.2 });
        Object.assign(this.state.render, { fadeAlpha: 0.05, colorScheme: COLOR_SCHEMES.fire, blendMode: 'color-dodge' as BlendMode });
        break;
      case 'galaxy':
        Object.assign(this.state.particles, { maxSpeed: 2, count: 4000, lifespan: 250, friction: 0.985 });
        Object.assign(this.state.flowField, { noiseScale: 0.004, noiseSpeed: 0.0002, noiseStrength: 1.5, curlAmount: 0.9 });
        Object.assign(this.state.render, { fadeAlpha: 0.015, colorScheme: COLOR_SCHEMES.neon, blendMode: 'screen' as BlendMode });
        break;
      case 'minimal':
        Object.assign(this.state.particles, { maxSpeed: 2, count: 1000, lifespan: 200, friction: 0.98 });
        Object.assign(this.state.flowField, { noiseScale: 0.003, noiseSpeed: 0.0002, noiseStrength: 1.0, curlAmount: 0.5 });
        Object.assign(this.state.render, { fadeAlpha: 0.02, colorScheme: COLOR_SCHEMES.monochrome, blendMode: 'lighten' as BlendMode });
        break;
      case 'nebula':
        Object.assign(this.state.particles, { maxSpeed: 1.8, count: 6000, lifespan: 350, friction: 0.99 });
        Object.assign(this.state.flowField, { noiseScale: 0.0025, noiseSpeed: 0.00015, noiseStrength: 1.2, curlAmount: 0.8 });
        Object.assign(this.state.render, { fadeAlpha: 0.008, colorScheme: COLOR_SCHEMES.aurora, blendMode: 'screen' as BlendMode });
        break;
      case 'electric':
        Object.assign(this.state.particles, { maxSpeed: 6, count: 3000, lifespan: 80, friction: 0.94 });
        Object.assign(this.state.flowField, { noiseScale: 0.008, noiseSpeed: 0.002, noiseStrength: 2.5, curlAmount: 0.1 });
        Object.assign(this.state.render, { fadeAlpha: 0.08, colorScheme: COLOR_SCHEMES.matrix, blendMode: 'color-dodge' as BlendMode });
        break;
    }

    this.updateAccentColor(this.state.render.colorScheme.accentColor);
    this.syncUIValues();
    this.emit();
  }

  // ============ Keyboard Shortcuts ============
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          this.state.isRunning = !this.state.isRunning;
          this.emit();
          break;
        case 'c':
          document.dispatchEvent(new CustomEvent('flow-clear'));
          break;
        case 'e':
          document.dispatchEvent(new CustomEvent('flow-export'));
          break;
        case 'f':
          this.state.render.showField = !this.state.render.showField;
          this.emit();
          break;
        case 'p':
          this.state.showPerformance = !this.state.showPerformance;
          document.dispatchEvent(new CustomEvent('toggle-performance'));
          break;
        case '1': case '2': case '3': case '4': case '5':
          this.showTab(TABS[parseInt(e.key) - 1]?.id ?? 'presets');
          break;
      }
    });
  }

  // ============ Helpers ============
  private syncUIValues(): void {
    this.setRange('particle-count', this.state.particles.count);
    this.setRange('particle-speed', this.state.particles.maxSpeed);
    this.setRange('particle-size', this.state.particles.sizeRange[1]);
    this.setRange('particle-life', this.state.particles.lifespan);
    this.setRange('particle-friction', this.state.particles.friction);
    this.setRange('noise-scale', this.state.flowField.noiseScale);
    this.setRange('noise-speed', this.state.flowField.noiseSpeed);
    this.setRange('turbulence', this.state.flowField.noiseStrength);
    this.setRange('curl-amount', this.state.flowField.curlAmount);
    this.setRange('trail-length', this.state.render.fadeAlpha);
    this.setRange('mouse-force', this.state.mouseForce);
    this.setRange('bloom-intensity', this.state.render.postProcess.bloomIntensity);
    this.setRange('bloom-radius', this.state.render.postProcess.bloomRadius);
    this.setRange('vignette-strength', this.state.render.postProcess.vignetteStrength);

    this.updateLabel('particle-count-val', this.state.particles.count.toString());
    this.updateLabel('particle-speed-val', this.state.particles.maxSpeed.toFixed(1));
    this.updateLabel('particle-size-val', this.state.particles.sizeRange[1].toFixed(1));
    this.updateLabel('particle-life-val', this.state.particles.lifespan.toString());
    this.updateLabel('particle-friction-val', this.state.particles.friction.toFixed(3));
    this.updateLabel('noise-scale-val', this.state.flowField.noiseScale.toFixed(4));
    this.updateLabel('noise-speed-val', this.state.flowField.noiseSpeed.toFixed(4));
    this.updateLabel('turbulence-val', this.state.flowField.noiseStrength.toFixed(1));
    this.updateLabel('curl-amount-val', this.state.flowField.curlAmount.toFixed(2));
    this.updateLabel('trail-length-val', this.state.render.fadeAlpha.toFixed(3));
    this.updateLabel('mouse-force-val', this.state.mouseForce.toString());
    this.updateLabel('bloom-intensity-val', this.state.render.postProcess.bloomIntensity.toFixed(2));
    this.updateLabel('bloom-radius-val', this.state.render.postProcess.bloomRadius.toString());
    this.updateLabel('vignette-strength-val', this.state.render.postProcess.vignetteStrength.toFixed(2));

    const schemeSelect = document.getElementById('color-scheme') as HTMLSelectElement | null;
    if (schemeSelect) {
      const entry = Object.entries(COLOR_SCHEMES).find(([, v]) => v === this.state.render.colorScheme);
      if (entry) schemeSelect.value = entry[0];
    }
  }

  private bindRange(id: string, handler: (value: number) => void): void {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;

    el.addEventListener('input', () => {
      handler(parseFloat(el.value));
      this.emit();
    });
  }

  private bindToggle(id: string, handler: (value: boolean) => void): void {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;

    el.addEventListener('change', () => {
      handler(el.checked);
      this.emit();
    });
  }

  private setRange(id: string, value: number): void {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = value.toString();
  }

  private updateLabel(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  private updateAccentColor(color: string): void {
    document.documentElement.style.setProperty('--color-accent-dynamic', color);
  }

  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}
