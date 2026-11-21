// GTA VI Trophy Guide & Tracker: loads the official 55-trophy list and the
// platinum roadmap, renders the checklist, and saves progress in localStorage.
// Works offline from its own files; fetches only data/trophies.json and
// data/roadmap.json from the same server. ?shot=cover|roadmap|spoiler|detail
// picks a deterministic view for screenshots, and ?earned=1,2,3 seeds earned
// trophies in memory for a screenshot without touching saved progress.

const STORE_KEY = 'gta6-trophy-guide-v1';

const SOURCES = {
  'PowerPyx': 'https://www.powerpyx.com/gta-6-grand-theft-auto-vI-trophy-guide-roadmap/',
  'KeenGamer': 'https://www.keengamer.com/articles/guides/gta-6-trophy-guide-platinum-roadmap-all-55-trophies/',
  'GameMapa': 'https://gamemapa.com/en/gta-6/guides/gta-6-trophy-achievement-list/',
  'eGamers': 'https://egamers.io/gta-6-trophy-list-all-55-trophies-and-achievements-plus-the-hardest-ones/',
  'Planet GTA 6': 'https://www.planetgta6.com/en/gta-6-trophies/',
  'Insider Gaming': 'https://insider-gaming.com/complete-gta-6-trophy-list-how-to-get-all-trophies-achievements/',
  'Games.gg': 'https://games.gg/grand-theft-auto-vi/guides/complete-grand-theft-auto-6-trophy-list/',
};

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seededEarned = new Set(
  (params.get('earned') ?? '').split(',').map((s) => Number(s)).filter((n) => n > 0),
);

const els = {
  earned: document.getElementById('progressEarned'),
  fill: document.getElementById('progressFill'),
  grades: document.getElementById('progressGrades'),
  note: document.getElementById('progressNote'),
  facts: document.getElementById('roadmapFacts'),
  steps: document.getElementById('roadmapSteps'),
  warnings: document.getElementById('roadmapWarnings'),
  roadmapSources: document.getElementById('roadmapSources'),
  search: document.getElementById('search'),
  grade: document.getElementById('gradeFilter'),
  kind: document.getElementById('kindFilter'),
  earnedFilter: document.getElementById('earnedFilter'),
  spoiler: document.getElementById('spoilerToggle'),
  exportBtn: document.getElementById('exportBtn'),
  importFile: document.getElementById('importFile'),
  resetBtn: document.getElementById('resetBtn'),
  count: document.getElementById('listCount'),
  list: document.getElementById('trophyList'),
  detail: document.getElementById('detail'),
};

let trophies = [];
let roadmap = null;
let earned = loadEarned();
let selectedId = null;
let activeKind = 'all';

function loadEarned() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(ids.filter((n) => Number.isInteger(n)));
  } catch {
    return new Set();
  }
}

function saveEarned() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
  } catch {
    // Private mode or file:// without storage: progress still works in memory.
  }
}

function isEarned(t) {
  return earned.has(t.id) || seededEarned.has(t.id);
}

function isMasked(t) {
  return t.hidden && els.spoiler.checked && !isEarned(t);
}

function gradeLabel(grade) {
  return grade[0].toUpperCase() + grade.slice(1);
}

function renderProgress() {
  const got = trophies.filter(isEarned).length;
  els.earned.textContent = String(got);
  els.fill.style.width = `${Math.round((got / trophies.length) * 100)}%`;
  const byGrade = {};
  for (const t of trophies) {
    if (!isEarned(t)) continue;
    byGrade[t.grade] = (byGrade[t.grade] || 0) + 1;
  }
  const totals = {};
  for (const t of trophies) totals[t.grade] = (totals[t.grade] || 0) + 1;
  els.grades.textContent = ['platinum', 'gold', 'silver', 'bronze']
    .map((g) => `${byGrade[g] || 0}/${totals[g] || 0} ${gradeLabel(g)}`)
    .join(' · ');
  els.note.textContent = got === trophies.length
    ? 'Platinum earned — Vice Got a Price! is yours.'
    : 'Tick a trophy when it pops. Nothing leaves this browser.';
}

function sourceLink(name) {
  const url = SOURCES[name];
  if (!url) return document.createTextNode(name);
  const a = document.createElement('a');
  a.href = url;
  a.textContent = name;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function renderRoadmap() {
  if (!roadmap) return;
  els.facts.replaceChildren();
  for (const f of roadmap.facts) {
    const wrap = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = f.label;
    const dd = document.createElement('dd');
    dd.textContent = f.value;
    wrap.append(dt, dd);
    els.facts.append(wrap);
  }
  els.steps.replaceChildren();
  for (const s of roadmap.steps) {
    const li = document.createElement('li');
    const h = document.createElement('h3');
    h.textContent = s.name;
    const hours = document.createElement('p');
    hours.className = 'hours';
    hours.textContent = s.hours;
    const p = document.createElement('p');
    p.textContent = s.text;
    li.append(h, hours, p);
    els.steps.append(li);
  }
  els.warnings.replaceChildren();
  for (const w of roadmap.warnings) {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = 'Watch out: ';
    p.append(strong, document.createTextNode(w));
    els.warnings.append(p);
  }
  els.roadmapSources.replaceChildren();
  els.roadmapSources.append(document.createTextNode('Roadmap sources: '));
  roadmap.sources.forEach((name, i) => {
    if (i > 0) els.roadmapSources.append(document.createTextNode(', '));
    els.roadmapSources.append(sourceLink(name));
  });
  els.roadmapSources.append(document.createTextNode('.'));
}

function filteredTrophies() {
  const q = els.search.value.trim().toLowerCase();
  return trophies.filter((t) => {
    if (els.grade.value !== 'all' && t.grade !== els.grade.value) return false;
    if (activeKind === 'missable' && !t.missable) return false;
    if (activeKind === 'online') return false; // No online trophies in this list.
    if (activeKind !== 'all' && activeKind !== 'missable' && !t.kinds.includes(activeKind)) return false;
    if (els.earnedFilter.value === 'earned' && !isEarned(t)) return false;
    if (els.earnedFilter.value === 'remaining' && isEarned(t)) return false;
    if (q && !(t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.guide.toLowerCase().includes(q))) return false;
    return true;
  });
}

function renderList() {
  const shown = filteredTrophies();
  els.list.replaceChildren();
  for (const t of shown) {
    const li = document.createElement('li');
    if (t.id === selectedId) li.classList.add('selected');
    if (isEarned(t)) li.classList.add('earned');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = isEarned(t);
    box.setAttribute('aria-label', `Earned: ${t.name}`);
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      if (box.checked) earned.add(t.id);
      else earned.delete(t.id);
      saveEarned();
      renderAll();
    });
    const body = document.createElement('div');
    const name = document.createElement('div');
    name.className = 't-name';
    name.textContent = isMasked(t) ? 'Hidden trophy — earn it to reveal' : t.name;
    const desc = document.createElement('div');
    desc.className = 't-desc';
    desc.textContent = isMasked(t) ? 'Story trophy, hidden on PlayStation until earned.' : t.description;
    body.append(name, desc);
    const meta = document.createElement('div');
    meta.className = 't-meta';
    const badge = document.createElement('span');
    badge.className = `badge ${t.grade}`;
    badge.textContent = gradeLabel(t.grade);
    meta.append(badge);
    if (t.missable) {
      meta.append(document.createElement('br'));
      const flag = document.createElement('span');
      flag.className = 'flag';
      flag.textContent = 'Missable';
      meta.append(flag);
    } else if (t.hidden) {
      meta.append(document.createElement('br'));
      const flag = document.createElement('span');
      flag.className = 'flag hidden-flag';
      flag.textContent = 'Hidden';
      meta.append(flag);
    }
    li.append(box, body, meta);
    li.addEventListener('click', () => {
      selectedId = t.id;
      renderAll();
    });
    els.list.append(li);
  }
  const earnedShown = shown.filter(isEarned).length;
  els.count.textContent = shown.length === trophies.length
    ? `Showing all 55 trophies (${earnedShown} earned).`
    : `Showing ${shown.length} of 55 trophies (${earnedShown} earned in this view).`;
}

function renderDetail() {
  const t = trophies.find((x) => x.id === selectedId);
  els.detail.replaceChildren();
  if (!t) {
    const p = document.createElement('p');
    p.className = 'placeholder';
    p.textContent = 'Select a trophy to read its guide, its sources, and whether it can be missed.';
    els.detail.append(p);
    return;
  }
  const h = document.createElement('h3');
  h.textContent = isMasked(t) ? 'Hidden trophy' : t.name;
  const badge = document.createElement('span');
  badge.className = `badge ${t.grade}`;
  badge.textContent = gradeLabel(t.grade);
  const desc = document.createElement('p');
  desc.className = 'd-desc';
  desc.textContent = isMasked(t) ? 'Story trophy, hidden on PlayStation until earned.' : t.description;
  els.detail.append(h, badge, desc);
  if (t.count != null) {
    const c = document.createElement('p');
    c.className = 'd-count';
    c.textContent = `Target: ${t.count.toLocaleString('en-US')}`;
    els.detail.append(c);
  }
  if (t.missable) {
    const m = document.createElement('p');
    m.className = 'd-missable';
    const strong = document.createElement('strong');
    strong.textContent = 'Potentially missable. ';
    m.append(strong, document.createTextNode(t.missableNote ?? 'Do it when it appears — it may not come back.'));
    els.detail.append(m);
  }
  const guide = document.createElement('p');
  guide.className = 'd-guide';
  guide.textContent = isMasked(t) ? 'Reveal this trophy by earning it, or turn the spoiler setting off to read its guide now.' : t.guide;
  els.detail.append(guide);
  const src = document.createElement('p');
  src.className = 'd-sources';
  src.append(document.createTextNode('Sources: '));
  t.sources.forEach((name, i) => {
    if (i > 0) src.append(document.createTextNode(', '));
    src.append(sourceLink(name));
  });
  src.append(document.createTextNode('.'));
  els.detail.append(src);
  const wrap = document.createElement('div');
  wrap.className = 'd-earned';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = isEarned(t) ? '✓ Earned — undo' : 'Mark as earned';
  if (isEarned(t)) btn.classList.add('undo');
  btn.addEventListener('click', () => {
    if (earned.has(t.id)) earned.delete(t.id);
    else earned.add(t.id);
    saveEarned();
    renderAll();
  });
  wrap.append(btn);
  els.detail.append(wrap);
}

function renderAll() {
  renderProgress();
  renderList();
  renderDetail();
}

function applyShotState() {
  if (shot === 'cover') {
    selectedId = 28; // Positive Mental Attitude: the missable one, fully visible.
  } else if (shot === 'spoiler') {
    activeKind = 'story';
    els.spoiler.checked = true;
    for (const b of els.kind.querySelectorAll('button')) {
      b.classList.toggle('active', b.dataset.kind === 'story');
    }
  } else if (shot === 'detail') {
    selectedId = 17; // The Shootist: a silver with a count and sources.
  }
}

function applyShotScroll() {
  if (shot === 'cover' || shot === 'spoiler') {
    // Show the checklist with its detail panel, not the masthead: the cover
    // is the tracker at work, and the spoiler shot is the masked list.
    document.querySelector('.tracker').scrollIntoView();
  } else if (shot === 'roadmap') {
    document.getElementById('roadmap').scrollIntoView();
  } else if (shot === 'detail') {
    els.detail.scrollIntoView({ block: 'center' });
  }
}

async function init() {
  const [trophyDoc, roadmapDoc] = await Promise.all([
    (await fetch('data/trophies.json')).json(),
    (await fetch('data/roadmap.json')).json(),
  ]);
  trophies = trophyDoc.trophies;
  roadmap = roadmapDoc;
  renderRoadmap();
  applyShotState();
  renderAll();
  applyShotScroll();
  // Signals screenshot tooling that the guide has rendered.
  window.__shotReady = true;
}

els.search.addEventListener('input', renderAll);
els.grade.addEventListener('change', renderAll);
els.earnedFilter.addEventListener('change', renderAll);
els.spoiler.addEventListener('change', renderAll);
els.kind.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-kind]');
  if (!btn) return;
  activeKind = btn.dataset.kind;
  for (const b of els.kind.querySelectorAll('button')) {
    b.classList.toggle('active', b === btn);
  }
  renderAll();
});
els.exportBtn.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ game: 'Grand Theft Auto VI', earned: [...earned].sort((x, y) => x - y) }, null, 2)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
els.importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = new Set(Array.isArray(data) ? data : data.earned);
    const known = new Set(trophies.map((t) => t.id));
    earned = new Set([...ids].filter((n) => known.has(n)));
    saveEarned();
    renderAll();
  } catch {
    els.note.textContent = 'That file could not be imported — it is not a progress export from this guide.';
  }
  e.target.value = '';
});
els.resetBtn.addEventListener('click', () => {
  earned = new Set();
  saveEarned();
  renderAll();
});

init();
