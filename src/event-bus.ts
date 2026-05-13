/**
 * @module event-bus
 * @description Type-safe event emitter using generic constraints
 *
 * Demonstrates:
 * - Generic type inference with mapped types
 * - WeakRef for automatic listener cleanup
 * - Symbol keys for private properties
 */

type EventHandler<T = unknown> = (event: T) => void;

interface ListenerEntry<T = unknown> {
  handler: EventHandler<T>;
  once: boolean;
  context: WeakRef<object> | null;
}

export class EventBus<Events> {
  private listeners = new Map<keyof Events, Set<ListenerEntry>>();

  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>, context?: object): () => void {
    const set = this.getListeners(event);
    const entry: ListenerEntry = {
      handler: handler as EventHandler,
      once: false,
      context: context ? new WeakRef(context) : null,
    };
    set.add(entry);

    // Return unsubscribe function (closure pattern)
    return () => { set.delete(entry); };
  }

  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    const set = this.getListeners(event);
    set.add({
      handler: handler as EventHandler,
      once: true,
      context: null,
    });
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;

    const toRemove: ListenerEntry[] = [];

    for (const entry of set) {
      // Check if context is still alive (WeakRef pattern)
      if (entry.context && !entry.context.deref()) {
        toRemove.push(entry);
        continue;
      }

      entry.handler(data);

      if (entry.once) {
        toRemove.push(entry);
      }
    }

    for (const entry of toRemove) {
      set.delete(entry);
    }
  }

  off<K extends keyof Events>(event: K, handler?: EventHandler<Events[K]>): void {
    if (!handler) {
      this.listeners.delete(event);
      return;
    }

    const set = this.listeners.get(event);
    if (!set) return;

    for (const entry of set) {
      if (entry.handler === handler) {
        set.delete(entry);
        break;
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  private getListeners(event: keyof Events): Set<ListenerEntry> {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    return set;
  }
}

// Application event types
export interface AppEvents {
  'particle:burst': { pos: { x: number; y: number }; count: number };
  'field:disturbance': { pos: { x: number; y: number }; angle: number; strength: number };
  'config:change': { key: string; value: unknown };
  'render:export': void;
  'render:clear': void;
  'app:pause': void;
  'app:resume': void;
  'app:resize': { width: number; height: number };
  'perf:update': { fps: number; frameTime: number };
}

export const appBus = new EventBus<AppEvents>();
