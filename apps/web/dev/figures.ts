/* QA contact sheet for the figure system: every animation as start / middle / end frames */
import '../src/styles/app.css';
import { FIG } from '../src/components/figure';
const qs = new URLSearchParams(location.search), only = qs.get('k'); if (qs.get('w')) document.documentElement.style.setProperty('--cw', qs.get('w') + 'px');
const keys = Object.keys(FIG.anims).filter(k => !only || only.split(',').includes(k));
document.getElementById('grid')!.innerHTML = keys.map(k => `<div class="card"><b>${k}</b>${FIG.frames(k)}</div>`).join('');
(window as any).__done = true;
