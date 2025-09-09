/* ──────────────────────────────────────────────────────────
   assets/leaderboard.js
   Load via docs.yml → js:  - path: assets/leaderboard.js
   (strategy: lazyOnload is fine)
   ────────────────────────────────────────────────────────── */

import yaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm';

console.log('🏁 leaderboard.js loaded on', location.pathname);

const COST_CAP = 20;

/* ---------- helpers ---------- */
const pct = (v) => Number(v).toPrecision(3) + '%';
const cost = (v) => '$' + Number(v).toFixed(2);
const ready = (cb) =>
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', cb)
    : cb();

/* ---------- main ---------- */
ready(async () => {
  //   const host = document.getElementById('letta-leaderboard');
  //   if (!host) {
  //     console.warn('LB-script: #letta-leaderboard not found - bailing out.');
  //     return;
  //   }
  /* ---- wait for the leaderboard container to appear (SPA nav safe) ---- */
  const host = await new Promise((resolve, reject) => {
    const el = document.getElementById('letta-leaderboard');
    if (el) return resolve(el); // SSR / hard refresh path

    const obs = new MutationObserver(() => {
      const found = document.getElementById('letta-leaderboard');
      if (found) {
        obs.disconnect();
        resolve(found); // CSR navigation path
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      obs.disconnect();
      reject(new Error('#letta-leaderboard never appeared'));
    }, 5000); // safety timeout
  }).catch((err) => {
    console.warn('LB-script:', err.message);
    return null;
  });
  if (!host) return; // still no luck → give up

  /* ----- figure out URL of data.yaml ----- */
  //  const path  = location.pathname.endsWith('/')
  //    ? location.pathname
  //    : location.pathname.replace(/[^/]*$/, '');          // strip file/slug
  //  const dataUrl = `${location.origin}${path}data.yaml`;
  //  const dataUrl = `${location.origin}/leaderboard/data.yaml`;   // one-liner, always right
  //  const dataUrl = `${location.origin}/assets/leaderboard.yaml`;
  //  const dataUrl = `./assets/leaderboard.yaml`;   // one-liner, always right
  //   const dataUrl = `${location.origin}/data.yaml`; // one-liner, always right
  //   const dataUrl = 'https://raw.githubusercontent.com/letta-ai/letta-leaderboard/main/data/letta_memory_leaderboard.yaml';
  const dataUrl =
    'https://cdn.jsdelivr.net/gh/letta-ai/letta-leaderboard@latest/data/letta_memory_leaderboard.yaml';

  console.log('LB-script: fetching', dataUrl);

  /* ----- fetch & parse YAML ----- */
  let rows;
  try {
    const resp = await fetch(dataUrl);
    console.log(`LB-script: status ${resp.status}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    rows = yaml.load(await resp.text());
  } catch (err) {
    console.error('LB-script: failed to load YAML →', err);
    return;
  }

  /* ----- wire up table ----- */
  const dir = Object.create(null);
  const tbody = document.getElementById('lb-body');
  const searchI = document.getElementById('lb-search');
  const headers = document.querySelectorAll('#lb-table thead th[data-key]');
  searchI.value = ''; // clear any persisted filter

  const render = () => {
    const q = searchI.value.toLowerCase();
    tbody.innerHTML = rows
      .map((r) => {
        const over = r.total_cost > COST_CAP;
        const barW = over ? '100%' : (r.total_cost / COST_CAP) * 100 + '%';
        const costCls = over ? 'cost-high' : 'cost-ok';
        const warnIcon = over
          ? `<span class="warn" title="Cost exceeds $${COST_CAP} cap - bar is clipped to full width">⚠</span>`
          : '';

        return `
           <tr class="${q && !r.model.toLowerCase().includes(q) ? 'hidden' : ''}">
             <td style="padding:8px">${r.model}</td>

             <td class="bar-cell avg metric">
               <div class="bar-viz" style="width:${r.average}%"></div>
               <span class="value">${pct(r.average)}</span>
             </td>

             <td class="bar-cell ${costCls} metric">
               <div class="bar-viz" style="width:${barW}"></div>
               <span class="value">${cost(r.total_cost)}</span>
               ${warnIcon}
             </td>
           </tr>`;
      })
      .join('');
  };

  const setIndicator = (activeKey) => {
    headers.forEach((h) => {
      h.classList.remove('asc', 'desc');
      if (h.dataset.key === activeKey) h.classList.add(dir[activeKey]);
    });
  };

  /* initial sort ↓ */
  dir.average = 'desc';
  rows.sort((a, b) => b.average - a.average);
  setIndicator('average');
  render();

  /* search */
  searchI.addEventListener('input', render);

  /* column sorting */
  headers.forEach((th) => {
    const key = th.dataset.key;
    th.addEventListener('click', () => {
      const asc = dir[key] === 'desc';
      dir[key] = asc ? 'asc' : 'desc';

      rows.sort((a, b) => {
        const va = a[key],
          vb = b[key];
        const cmp =
          typeof va === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb));
        return asc ? cmp : -cmp;
      });

      setIndicator(key);
      render();
    });
  });
});
