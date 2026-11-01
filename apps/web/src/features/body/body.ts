import { CH } from '../../components/charts';
import { confirmBox, openModal } from '../../components/modal';
import { periodSeg, periodSince } from '../../components/period';
import { toast } from '../../components/toast';
import { emptyBox, kpi, pageHead, segBtns, setSeg } from '../../components/view';
import { $, $$, download } from '../../core/dom';
import { ACT } from '../../core/events';
import { ico } from '../../core/icons';
import { ROUTES, go, rerender } from '../../core/router';
import { S, save } from '../../core/state';
import { idb, persistStorage, storageEstimate } from '../../services/idb';
import { LG } from '../../services/logic';
import { MONTHS, fmtDay, fmtDayShort, todayKey } from '@pullup/shared/dates';
import { clamp, esc, fmtNum, round1, uid } from '@pullup/shared/util';
import type { BodyEntry, PhotoMeta, PhotoPose } from '@pullup/shared/types';
import { strToU8, zipSync } from 'fflate';

/* ================= Тело: measurements, progress photos, body charts (ЧАСТЬ 7) =================
 * Everything is stored on the device: entries in the app state, photos as JPEG blobs in IndexedDB.
 * Photos are never uploaded without a separate explicit consent. No body-fat estimation from photos. */
export const BASE_FIELDS = [
  { id: 'weight', name: 'Вес', unit: 'кг', min: 20, max: 400 }, { id: 'chest', name: 'Грудь', unit: 'см', min: 30, max: 250 },
  { id: 'waist', name: 'Талия', unit: 'см', min: 30, max: 250 }, { id: 'shoulders', name: 'Плечи', unit: 'см', min: 40, max: 250 },
  { id: 'biceps', name: 'Бицепс', unit: 'см', min: 10, max: 90 }, { id: 'forearm', name: 'Предплечье', unit: 'см', min: 10, max: 70 },
  { id: 'thigh', name: 'Бедро', unit: 'см', min: 20, max: 150 }
];
const POSES: [PhotoPose, string][] = [['front', 'FRONT'], ['side', 'SIDE'], ['back', 'BACK']];
const POSE_RU: Record<PhotoPose, string> = { front: 'спереди', side: 'сбоку', back: 'сзади' };
export const BODY = { period: '90', field: 'waist', pose: 'front' as PhotoPose, a: '', b: '' };
const allFields = () => [...BASE_FIELDS, ...(S.bodyFields || []).map(f => ({ ...f, min: 0, max: 10000, custom: true }))];
const valOf = (e: BodyEntry, id: string): number | undefined => { const v = (e as any)[id] ?? (e.custom || {})[id]; return typeof v === 'number' && isFinite(v) ? v : undefined; };
const sorted = () => [...(S.body || [])].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const series = (id: string, since = '') => sorted().filter(e => e.date >= since).map(e => ({ date: e.date, v: valOf(e, id) })).filter(p => p.v != null) as { date: string; v: number }[];
const sign = (d: number) => (d > 0 ? '+' : '') + fmtNum(round1(d));

ROUTES.body = {
  title: 'Тело',
  render(tab = 'measure') {
    const tabs = segBtns('bodyTab', [['measure', 'Замеры'], ['photos', 'Фото'], ['charts', 'Графики']], tab, 'role="tablist" aria-label="Разделы"');
    const body = tab === 'photos' ? photosView() : tab === 'charts' ? chartsView() : measureView();
    return pageHead('Тело <em>и прогресс</em>', 'Вес, обхваты и фото прогресса. Всё хранится на этом устройстве.', `<button class="btn btn-acc" data-act="bodyAdd">${ico('plus')}Добавить замеры</button>`, 'BODY TRANSFORMATION') +
      `<div class="row wrap between mb">${tabs}<button class="btn btn-sm btn-ghost" data-act="bodyExport">${ico('download')}Архив тела (ZIP)</button></div>${body}`;
  },
  mount(view) { mountThumbs(view); mountCompare(view); }
};
ACT.bodyTab = el => go(el.dataset.v === 'measure' ? '#/body' : `#/body/${el.dataset.v}`);

/* ---------- measurements ---------- */
function measureView() {
  const list = sorted(), F = allFields();
  const cards = F.map(f => {
    const s = series(f.id); if (!s.length) return '';
    const last = s[s.length - 1], prev = s[s.length - 2], first = s[0];
    return kpi(esc(f.name), `${fmtNum(last.v)}<small>${esc(f.unit)}</small>`, `${prev ? `${sign(last.v - prev.v)} к прошлому` : 'первый замер'}${s.length > 2 ? ` · ${sign(last.v - first.v)} с ${fmtDayShort(first.date)}` : ''}`, f.id === 'weight' ? 'weight' : 'ruler');
  }).filter(Boolean);
  const cols = F.filter(f => list.some(e => valOf(e, f.id) != null));
  return `${cards.length ? `<div class="kpis kpis-auto">${cards.join('')}</div>` : emptyBox('Пока нет замеров', 'Запишите вес и обхваты сегодня — через 4 недели будет с чем сравнить. Измеряйте утром, в одно и то же время, сантиметровой лентой без натяжения.', 'ruler', `<button class="btn btn-acc btn-sm" data-act="bodyAdd">${ico('plus')}Первые замеры</button>`)}
    ${list.length ? `<div class="card mt"><div class="card-head"><h3>${ico('list')}История замеров</h3><span class="hint">${list.length}</span></div>
      <div class="tbl-wrap"><table class="tbl body-tbl"><thead><tr><th>Дата</th>${cols.map(f => `<th>${esc(f.name)}, ${esc(f.unit)}</th>`).join('')}<th></th></tr></thead>
      <tbody>${[...list].reverse().map(e => `<tr><td class="nowrap">${fmtDay(e.date)}${e.note ? `<div class="tiny muted">${esc(e.note)}</div>` : ''}</td>${cols.map(f => { const v = valOf(e, f.id); return `<td>${v != null ? fmtNum(v) : '<span class="muted">—</span>'}</td>`; }).join('')}
        <td class="nowrap" style="text-align:right"><button class="btn btn-ghost btn-icon btn-sm" data-act="bodyEdit" data-id="${e.id}" aria-label="Изменить">${ico('edit')}</button><button class="btn btn-ghost btn-icon btn-sm" data-act="bodyDel" data-id="${e.id}" aria-label="Удалить">${ico('trash')}</button></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h3>${ico('sliders')}Свои параметры</h3><button class="btn btn-sm" data-act="bodyFieldAdd">${ico('plus')}Добавить</button></div>
        ${(S.bodyFields || []).length ? `<div class="stack s">${S.bodyFields.map(f => `<div class="row between small"><span>${esc(f.name)} <span class="muted">(${esc(f.unit)})</span></span><button class="btn btn-ghost btn-icon btn-sm" data-act="bodyFieldDel" data-id="${f.id}" aria-label="Удалить параметр">${ico('trash')}</button></div>`).join('')}</div>` : '<p class="small muted" style="margin:0">Например: шея, икры, обхват запястья.</p>'}</div>
      <div class="card"><div class="card-head"><h3>${ico('info')}Как измерять</h3></div><ul class="ul small tx2">
        <li>Утром, натощак, в одно и то же время — раз в 1–2 недели.</li><li>Лента прилегает к коже без натяжения; талия — на уровне пупка, на выдохе.</li>
        <li>Грудь — по самой выступающей точке; плечи — по дельтам; бицепс — в самой широкой части, рука расслаблена.</li>
        <li>Вес колеблется на 0,5–1,5 кг за день — смотрите тренд за несколько недель, а не отдельные значения.</li></ul></div>
    </div>
    <div class="note n-acc mt">${ico('shield')}<div>Замеры и фото хранятся только на этом устройстве. PULLUP PRO не оценивает процент жира по фото и не ставит медицинских выводов.</div></div>`;
}
function entryModal(e?: BodyEntry) {
  const F = allFields(), last = sorted().pop(), date = e ? e.date : todayKey();
  openModal({
    title: e ? 'Изменить замеры' : 'Новые замеры', cls: 'wide',
    body: `<div class="form-grid"><label class="field"><span>Дата</span><input class="inp" type="date" data-bf="date" value="${date}" max="${todayKey()}"></label>
      ${F.map(f => { const v = e ? valOf(e, f.id) : undefined, ph = last && valOf(last, f.id) != null ? `было ${fmtNum(valOf(last, f.id))}` : f.unit; return `<label class="field"><span>${esc(f.name)}, ${esc(f.unit)}</span><input class="inp" type="number" inputmode="decimal" step="0.1" min="0" data-bf="${f.id}" ${(f as any).custom ? 'data-custom="1"' : ''} value="${v != null ? v : ''}" placeholder="${esc(ph)}"></label>`; }).join('')}
      <label class="field" style="grid-column:1/-1"><span>Заметка</span><input class="inp" data-bf="note" maxlength="200" value="${esc(e && e.note || '')}" placeholder="Например: после отпуска"></label></div>`,
    foot: `<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-acc" data-bsave>${ico('check')}Сохранить</button>`,
    onMount(box, m) {
      $('[data-bsave]', box).addEventListener('click', () => {
        const d = ($('[data-bf="date"]', box) as HTMLInputElement).value || todayKey();
        if (d > todayKey()) return toast('Дата не может быть в будущем', 'err');
        const out: any = { custom: {} }; let n = 0, bad = '';
        for (const f of F) {
          const inp = $(`[data-bf="${f.id}"]`, box) as HTMLInputElement, raw = inp.value.trim().replace(',', '.'); if (!raw) continue;
          const v = round1(+raw); if (!isFinite(v) || v < f.min || v > f.max) { bad = f.name; break; }
          if ((f as any).custom) out.custom[f.id] = v; else out[f.id] = v; n++;
        }
        if (bad) return toast(`Проверьте значение: ${esc(bad)}`, 'err');
        if (!n) return toast('Введите хотя бы одно значение', 'err');
        const note = (($('[data-bf="note"]', box) as HTMLInputElement).value || '').trim().slice(0, 200);
        let target = e ? S.body.find(x => x.id === e.id) : S.body.find(x => x.date === d);
        if (target) { for (const f of BASE_FIELDS) delete (target as any)[f.id]; target.custom = {}; Object.assign(target, out, { date: d }); if (note) target.note = note; else delete target.note; }
        else { target = { id: uid(), date: d, ...out, ...(note ? { note } : {}) }; S.body.push(target); }
        if (!Object.keys(target.custom || {}).length) delete target.custom;
        const lw = series('weight').pop(); if (lw) S.profile.bodyweight = lw.v;
        save(); LG.checkAch(); m.close(); toast('Замеры сохранены', 'ok'); rerender();
      });
      setTimeout(() => { const i = $('[data-bf="weight"]', box) as HTMLInputElement; if (i && window.innerWidth > 900) i.focus(); }, 60);
    }
  });
}
ACT.bodyAdd = () => entryModal();
ACT.bodyEdit = el => { const e = S.body.find(x => x.id === el.dataset.id); if (e) entryModal(e); };
ACT.bodyDel = async el => {
  const e = S.body.find(x => x.id === el.dataset.id); if (!e) return;
  if (!(await confirmBox('Удалить замеры?', `Запись от ${fmtDay(e.date)} будет удалена.`, 'Удалить', true))) return;
  S.body = S.body.filter(x => x.id !== e.id); save(); toast('Запись удалена', 'info'); rerender();
};
ACT.bodyFieldAdd = () => {
  openModal({
    title: 'Свой параметр',
    body: `<div class="form-grid"><label class="field"><span>Название</span><input class="inp" data-fn maxlength="30" placeholder="Например: шея"></label><label class="field"><span>Единица</span><input class="inp" data-fu maxlength="8" value="см"></label></div>`,
    foot: `<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-acc" data-ok>Добавить</button>`,
    onMount(box, m) {
      $('[data-ok]', box).addEventListener('click', () => {
        const name = ($('[data-fn]', box) as HTMLInputElement).value.trim(), unit = ($('[data-fu]', box) as HTMLInputElement).value.trim() || 'см';
        if (!name) return toast('Введите название', 'err');
        if (allFields().some(f => f.name.toLowerCase() === name.toLowerCase())) return toast('Такой параметр уже есть', 'err');
        (S.bodyFields = S.bodyFields || []).push({ id: 'c_' + uid(), name: name.slice(0, 30), unit: unit.slice(0, 8) }); save(); m.close(); rerender();
      });
    }
  });
};
ACT.bodyFieldDel = async el => {
  const f = (S.bodyFields || []).find(x => x.id === el.dataset.id); if (!f) return;
  if (!(await confirmBox('Скрыть параметр?', `«${esc(f.name)}» исчезнет из формы и таблицы. Уже записанные значения останутся в данных и экспорте.`, 'Скрыть'))) return;
  S.bodyFields = S.bodyFields.filter(x => x.id !== f.id); save(); rerender();
};

/* ---------- photos ---------- */
const urls = new Map<string, string>();
async function photoURL(id: string, full = false): Promise<string | null> {
  const k = id + (full ? ':f' : ':t'); if (urls.has(k)) return urls.get(k)!;
  const rec: any = await idb.get('photos', id).catch(() => null); if (!rec) return null;
  const blob: Blob = full ? rec.blob : (rec.thumb || rec.blob); if (!blob) return null;
  const u = URL.createObjectURL(blob); urls.set(k, u); return u;
}
function dropURLs(id: string) { for (const k of [id + ':f', id + ':t']) { const u = urls.get(k); if (u) { URL.revokeObjectURL(u); urls.delete(k); } } }
function mountThumbs(root: ParentNode) {
  $$('img[data-photo]', root).forEach(async (img: HTMLImageElement) => {
    const u = await photoURL(img.dataset.photo, img.dataset.full === '1');
    if (u) { img.src = u; img.classList.add('ok'); } else { img.closest('.ph-slot')?.classList.add('missing'); img.alt = 'Файл не найден на этом устройстве'; }
  });
}
const byDate = () => { const m: Record<string, PhotoMeta[]> = {}; for (const p of S.photos || []) (m[p.date] = m[p.date] || []).push(p); return Object.entries(m).sort((a, b) => a[0] < b[0] ? 1 : -1); };
function photosView() {
  const groups = byDate(), total = (S.photos || []).reduce((a, p) => a + (p.size || 0), 0), cloud = S.settings.cloud && S.settings.cloud.enabled && S.settings.cloud.photos;
  return `<div class="card"><div class="card-head"><h3>${ico('camera')}Новое фото прогресса</h3><span class="hint">FRONT · SIDE · BACK</span></div>
      <div class="row wrap" style="gap:12px;align-items:flex-end"><label class="field" style="max-width:200px"><span>Дата</span><input class="inp" type="date" id="ph-date" value="${todayKey()}" max="${todayKey()}"></label>
      ${POSES.map(([p, l]) => `<label class="btn ph-up"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" data-chg="photoPick" data-pose="${p}" hidden>${ico('camera')}${l}</label>`).join('')}</div>
      <p class="tiny muted mt-s" style="margin-bottom:0">Фото уменьшается до 1600 px и сохраняется в JPEG прямо на устройстве; метаданные снимка (включая геолокацию) удаляются. ${cloud ? 'Синхронизация фото включена вами в настройках.' : 'В облако фото не загружаются.'}</p></div>
    ${groups.length ? `<div class="row wrap between mt"><div class="small muted">${(S.photos || []).length} фото · ${fmtNum(total / 1048576)} МБ</div><div class="btns"><a class="btn btn-sm" href="#/body/compare">${ico('sliders')}Сравнить BEFORE / AFTER</a></div></div>
      <div class="stack l mt">${groups.map(([d, ps]) => `<div><div class="sec-t">${fmtDay(d)}</div><div class="ph-row">${POSES.map(([p, l]) => { const x = ps.find(y => y.pose === p); return `<div class="ph-slot ${x ? '' : 'empty'}">${x ? `<button class="ph-btn" data-act="photoView" data-id="${x.id}" aria-label="Открыть фото ${l} ${fmtDay(d)}"><img data-photo="${x.id}" alt="${l} ${fmtDay(d)}" loading="lazy"></button>` : `<span class="tiny muted">нет фото</span>`}<span class="ph-l">${l}${x && x.cloud ? ` ${ico('cloud')}` : ''}</span></div>`; }).join('')}</div></div>`).join('')}</div>`
      : `<div class="mt">${emptyBox('Пока нет фото', 'Снимайте при одинаковом свете, на одном расстоянии и в одной одежде: спереди, сбоку и сзади. Тогда сравнение будет честным.', 'camera')}</div>`}
    <div class="note n-acc mt">${ico('shield')}<div><b>Приватность.</b> Фото видите только вы. Без отдельного согласия в настройках они не покидают устройство. Удалить фото можно в любой момент — открыв его.</div></div>`;
}
async function processImage(file: File): Promise<{ blob: Blob; thumb: Blob; w: number; h: number }> {
  const load = (): Promise<CanvasImageSource & { width: number; height: number }> => new Promise((res, rej) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(u); res(im as any); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Формат не поддерживается браузером')); }; im.src = u;
  });
  let src: any;
  try { src = 'createImageBitmap' in window ? await createImageBitmap(file, { imageOrientation: 'from-image' } as any) : await load(); } catch (e) { src = await load(); }
  const enc = (max: number, q: number): Promise<{ b: Blob; w: number; h: number }> => {
    const k = Math.min(1, max / Math.max(src.width, src.height)), w = Math.max(1, Math.round(src.width * k)), h = Math.max(1, Math.round(src.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
    return new Promise((res, rej) => c.toBlob(b => b ? res({ b, w, h }) : rej(new Error('Не удалось сжать фото')), 'image/jpeg', q));
  };
  const big = await enc(1600, .86), small = await enc(360, .78);
  if (src.close) src.close();
  return { blob: big.b, thumb: small.b, w: big.w, h: big.h };
}
ACT.photoPick = async el => {
  const f: File = el.files && el.files[0]; el.value = ''; if (!f) return;
  if (f.size > 40e6) return toast('Файл слишком большой (больше 40 МБ)', 'err');
  const pose = el.dataset.pose as PhotoPose, d = (($('#ph-date') as HTMLInputElement) || { value: todayKey() }).value || todayKey();
  toast('Обрабатываем фото…', 'info', 1500);
  try {
    const r = await processImage(f), id = uid();
    await idb.put('photos', id, { blob: r.blob, thumb: r.thumb });
    const old = (S.photos || []).find(p => p.date === d && p.pose === pose);
    if (old && !(await confirmBox('Заменить фото?', `Фото ${POSE_RU[pose]} за ${fmtDay(d)} уже есть. Заменить его новым?`, 'Заменить'))) { await idb.del('photos', id); return; }
    if (old) { await idb.del('photos', old.id).catch(() => { /* ignore */ }); dropURLs(old.id); S.photos = S.photos.filter(p => p.id !== old.id); }
    (S.photos = S.photos || []).push({ id, date: d, pose, w: r.w, h: r.h, size: r.blob.size, mime: 'image/jpeg' });
    save(); persistStorage().catch(() => { /* ignore */ }); LG.checkAch(); toast(`Фото ${POSE_RU[pose]} сохранено`, 'ok'); rerender();
  } catch (e: any) { console.error(e); toast(`Не удалось сохранить фото: ${esc(e.message || e)}`, 'err', 5000); }
};
ACT.photoView = async el => {
  const p = (S.photos || []).find(x => x.id === el.dataset.id); if (!p) return;
  const lbl = (POSES.find(x => x[0] === p.pose) || ['', ''])[1];
  const m = openModal({
    title: `${lbl} · ${fmtDay(p.date)}`, cls: 'wide',
    body: `<div class="ph-full"><img data-photo="${p.id}" data-full="1" alt="${lbl} ${fmtDay(p.date)}"></div><div class="tiny muted mt-s">${p.w}×${p.h} · ${fmtNum(p.size / 1024)} КБ${p.cloud ? ' · сохранено в облаке' : ' · только на этом устройстве'}</div>`,
    foot: `<button class="btn btn-danger" data-pdel>${ico('trash')}Удалить</button><a class="btn" href="#/body/compare" data-close>${ico('sliders')}Сравнить</a><button class="btn btn-ghost" data-close>Закрыть</button>`,
    onMount(box) {
      mountThumbs(box);
      $('[data-pdel]', box).addEventListener('click', async () => {
        if (!(await confirmBox('Удалить фото?', 'Фото будет удалено с этого устройства без возможности восстановления.' + (p.cloud ? ' Копия в облаке тоже будет удалена при синхронизации.' : ''), 'Удалить', true))) return;
        await idb.del('photos', p.id).catch(() => { /* ignore */ }); dropURLs(p.id);
        S.photos = S.photos.filter(x => x.id !== p.id); save(); m.close(); toast('Фото удалено', 'info'); rerender();
      });
    }
  });
};
/* ---------- BEFORE / AFTER ---------- */
ROUTES.body.renderCompare = () => '';
function compareView() {
  const ps = (S.photos || []).filter(p => p.pose === BODY.pose).sort((a, b) => a.date < b.date ? -1 : 1);
  const dates = ps.map(p => p.date);
  if (!dates.includes(BODY.a)) BODY.a = dates[0] || ''; if (!dates.includes(BODY.b) || BODY.b === BODY.a) BODY.b = dates[dates.length - 1] || '';
  const A = ps.find(p => p.date === BODY.a), B = ps.find(p => p.date === BODY.b);
  const sel = (k: 'a' | 'b') => `<select class="inp" data-chg="cmpDate" data-k="${k}" aria-label="${k === 'a' ? 'До' : 'После'}">${dates.map(d => `<option value="${d}" ${BODY[k] === d ? 'selected' : ''}>${fmtDay(d)}</option>`).join('')}</select>`;
  return `<a class="back" href="#/body/photos">${ico('left')}Фото</a>
    <div class="row wrap between mb">${segBtns('cmpPose', POSES.map(([v, l]) => [v, l]), BODY.pose)}</div>
    ${ps.length < 2 ? emptyBox('Нужно минимум два фото', `Добавьте фото ${POSE_RU[BODY.pose]} за разные даты, чтобы сравнить.`, 'camera', '<a class="btn btn-sm" href="#/body/photos">К фото</a>') : `
    <div class="grid g2"><label class="field"><span>BEFORE</span>${sel('a')}</label><label class="field"><span>AFTER</span>${sel('b')}</label></div>
    <div class="ba mt" id="ba" style="--x:50%"><img class="ba-a" data-photo="${A ? A.id : ''}" data-full="1" alt="До"><div class="ba-top"><img class="ba-b" data-photo="${B ? B.id : ''}" data-full="1" alt="После"></div>
      <span class="ba-l">BEFORE · ${A ? fmtDayShort(A.date) : ''}</span><span class="ba-r">AFTER · ${B ? fmtDayShort(B.date) : ''}</span><div class="ba-h" aria-hidden="true"></div>
      <input type="range" min="0" max="100" value="50" class="ba-range" aria-label="Положение разделителя BEFORE / AFTER"></div>
    <div class="grid g2 mt ba-side"><figure><img data-photo="${A ? A.id : ''}" alt="До"><figcaption>BEFORE · ${A ? fmtDay(A.date) : ''}</figcaption></figure><figure><img data-photo="${B ? B.id : ''}" alt="После"><figcaption>AFTER · ${B ? fmtDay(B.date) : ''}</figcaption></figure></div>
    ${bodyDiff(BODY.a, BODY.b)}`}`;
}
function bodyDiff(a: string, b: string) {
  const near = (d: string) => sorted().filter(e => e.date <= d).pop();
  const A = near(a), B = near(b); if (!A || !B || A === B) return '';
  const rows = allFields().map(f => { const x = valOf(A, f.id), y = valOf(B, f.id); return x != null && y != null ? `<tr><td>${esc(f.name)}</td><td>${fmtNum(x)}</td><td>${fmtNum(y)}</td><td><b>${sign(y - x)}</b> ${esc(f.unit)}</td></tr>` : ''; }).join('');
  return rows ? `<div class="card mt"><div class="card-head"><h3>${ico('ruler')}Замеры между датами</h3><span class="hint">${fmtDayShort(A.date)} → ${fmtDayShort(B.date)}</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>До</th><th>После</th><th>Разница</th></tr></thead><tbody>${rows}</tbody></table></div></div>` : '';
}
function mountCompare(root: ParentNode) {
  const ba = $('#ba', root as any); if (!ba) return;
  const r = $('.ba-range', ba) as HTMLInputElement; r.addEventListener('input', () => ba.style.setProperty('--x', r.value + '%'));
}
ACT.cmpPose = el => { BODY.pose = el.dataset.v; BODY.a = ''; BODY.b = ''; rerender(); };
ACT.cmpDate = el => { BODY[el.dataset.k] = el.value; rerender(); };
const _render = ROUTES.body.render;
ROUTES.body.render = (tab?: string) => tab === 'compare' ? pageHead('BEFORE <em>/ AFTER</em>', 'Сравнение фото прогресса. Перетащите разделитель.', '', 'BODY TRANSFORMATION') + compareView() : _render(tab);
ROUTES.body.title = (tab?: string) => tab === 'compare' ? 'Сравнение фото' : 'Тело';

/* ---------- charts ---------- */
function chartsView() {
  const since = periodSince(BODY.period), F = allFields().filter(f => f.id !== 'weight' && series(f.id).length);
  if (!F.some(f => f.id === BODY.field) && F.length) BODY.field = F[0].id;
  const w = series('weight', since), g = series(BODY.field, since), gf = F.find(f => f.id === BODY.field);
  const months: Record<string, BodyEntry[]> = {}; for (const e of sorted()) (months[e.date.slice(0, 7)] = months[e.date.slice(0, 7)] || []).push(e);
  const mRows = Object.entries(months).slice(-12).reverse().map(([m, es]) => {
    const cell = (id: string) => { const vs = es.map(e => valOf(e, id)).filter(v => v != null) as number[]; return vs.length ? fmtNum(round1(vs.reduce((a, b) => a + b, 0) / vs.length)) : '—'; };
    return `<tr><td class="nowrap">${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}</td><td>${cell('weight')}</td><td>${cell('waist')}</td><td>${cell('chest')}</td><td>${cell('shoulders')}</td><td>${es.length}</td></tr>`;
  }).join('');
  return `<div class="row wrap mb">${periodSeg('bodyPeriod', BODY.period)}</div>
    <div class="grid g2">
      <div class="card"><div class="card-head"><h3>${ico('weight')}Вес</h3><span class="hint">${w.length ? `${fmtNum(w[0].v)} → ${fmtNum(w[w.length - 1].v)} кг` : ''}</span></div>
        ${CH.slot({ type: 'line', labels: w.map(p => fmtDayShort(p.date)), tips: w.map(p => fmtDay(p.date)), series: [{ name: 'Вес', data: w.map(p => p.v), fmt: v => `${fmtNum(v)} кг` }], emptyText: 'Нет записей веса за период', aria: 'График веса' }, 230)}</div>
      <div class="card"><div class="card-head"><h3>${ico('ruler')}Обхваты</h3>${F.length ? segBtns('bodyField', F.map(f => [f.id, f.name]), BODY.field, 'style="flex-wrap:wrap"') : ''}</div>
        ${gf ? CH.slot({ type: 'line', labels: g.map(p => fmtDayShort(p.date)), tips: g.map(p => fmtDay(p.date)), series: [{ name: gf.name, data: g.map(p => p.v), fmt: v => `${fmtNum(v)} ${gf.unit}` }], emptyText: 'Нет замеров за период', aria: 'График обхватов' }, 230) : '<div class="chart-empty">Добавьте обхваты, чтобы увидеть динамику</div>'}</div>
    </div>
    <div class="card mt"><div class="card-head"><h3>${ico('cal')}По месяцам</h3><span class="hint">средние значения</span></div>
      ${mRows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Месяц</th><th>Вес</th><th>Талия</th><th>Грудь</th><th>Плечи</th><th>Записей</th></tr></thead><tbody>${mRows}</tbody></table></div>` : '<p class="small muted" style="margin:0">Появится после первых замеров.</p>'}</div>`;
}
ACT.bodyPeriod = el => { BODY.period = el.dataset.v; rerender(); };
ACT.bodyField = el => { BODY.field = el.dataset.v; rerender(); };

/* ---------- archive export (ZIP) ---------- */
ACT.bodyExport = async () => {
  const F = allFields(), list = sorted();
  if (!list.length && !(S.photos || []).length) return toast('Пока нечего экспортировать', 'info');
  toast('Собираем архив…', 'info', 1500);
  try {
    const csv = ['date;' + F.map(f => `${f.name} (${f.unit})`).join(';') + ';note', ...list.map(e => [e.date, ...F.map(f => { const v = valOf(e, f.id); return v != null ? String(v).replace('.', ',') : ''; }), (e.note || '').replace(/[;\n]/g, ' ')].join(';'))].join('\r\n');
    const files: Record<string, any> = {
      'measurements.csv': strToU8('\ufeff' + csv),
      'body.json': strToU8(JSON.stringify({ app: 'pullup-pro', kind: 'body-archive', exported: new Date().toISOString(), fields: F.map(f => ({ id: f.id, name: f.name, unit: f.unit })), entries: list, photos: S.photos || [] }, null, 2)),
      'README.txt': strToU8('PULLUP PRO — архив тела\r\nmeasurements.csv — замеры (разделитель ;)\r\nbody.json — замеры и описание фото\r\nphotos/ — фото прогресса (JPEG)\r\n')
    };
    let missing = 0;
    for (const p of S.photos || []) {
      const rec: any = await idb.get('photos', p.id).catch(() => null);
      if (!rec || !rec.blob) { missing++; continue; }
      files[`photos/${p.date}_${p.pose}_${p.id}.jpg`] = [new Uint8Array(await rec.blob.arrayBuffer()), { level: 0 }];
    }
    const zip = zipSync(files, { level: 6 });
    download(`pullup-pro-body-${todayKey()}.zip`, zip, 'application/zip');
    toast(`Архив сохранён${missing ? ` · ${missing} фото нет на этом устройстве` : ''}`, 'ok', 3500);
  } catch (e: any) { console.error(e); toast('Не удалось собрать архив: ' + esc(e.message || e), 'err', 5000); }
};
export async function bodyStorageInfo(): Promise<string> {
  const est = await storageEstimate(); if (!est) return '';
  return `${fmtNum(est.usage / 1048576)} МБ из ${fmtNum(est.quota / 1048576)} МБ`;
}
export const clampKg = (v: number) => clamp(round1(v), 20, 400);
