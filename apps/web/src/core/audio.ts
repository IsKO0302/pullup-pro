import { S } from './state';

/* ---------- sound & vibration ---------- */
export const AUD = {
  ctx: null,
  ensure() {
    if (!this.ctx) { const AC = window.AudioContext || (window as any).webkitAudioContext; if (AC) { try { this.ctx = new AC(); } catch (e) { } } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => { });
    return this.ctx;
  },
  tone(freq, dur, vol = .22, type = 'sine', delay = 0) {
    if (!S.profile.sound) return;
    const c = this.ensure(); if (!c) return;
    const t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .012); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + .03);
  },
  tick() { this.tone(740, .1, .2, 'sine'); },
  go() { this.tone(988, .16, .26, 'square'); this.tone(1318, .3, .22, 'square', .14); },
  done() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, .22, .2, 'triangle', i * .11)); },
  tap() { this.tone(520, .05, .08, 'sine'); },
  warn() { this.tone(330, .25, .25, 'sawtooth'); this.tone(262, .35, .22, 'sawtooth', .22); }
};
/** optional native haptics (Telegram Mini App); falls back to the Vibration API */
let haptic: ((p: number | number[]) => boolean) | null = null;
export const setHaptic = (fn: typeof haptic) => { haptic = fn; };
export const buzz = p => { if (!S.profile.vibrate) return; if (haptic && haptic(p)) return; if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { } } };
