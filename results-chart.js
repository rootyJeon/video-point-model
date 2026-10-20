(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // Series colors, checked with the dataviz palette validator (light mode, white surface):
  // every mark clears 3:1 contrast; the worst adjacent pair is ΔE 16.8 under protan/deutan
  // simulation and ΔE 20.2 in normal vision, also for the General splits where X-WAM is absent.
  const MODELS = [
    { id: 'hv', name: 'HV-1.5', color: '#0a71b1' },
    { id: 'wan', name: 'Wan2.2-5B', color: '#d56a10' },
    { id: 'xwam', name: 'X-WAM', color: '#6652d3' },
    { id: 'cosmos', name: 'Cosmos3-Nano', color: '#b12b6e' },
    { id: 'v', name: 'VPM (V)', color: '#7da127' },
    { id: 'vt', name: 'VPM (V+T)', color: '#1c6316', ours: true }
  ];
  const METRICS = [
    { label: 'FVD', dir: 'down', digits: 2 },
    { label: 'PSNR', dir: 'up', digits: 2 },
    { label: 'MEt3R', dir: 'down', digits: 3 },
    { label: 'δ3D avg', base: 'δ', sup: '3D', sub: 'avg', dir: 'up', digits: 2 }
  ];
  // Final paper Table 2 (MEt3R = cross-view MEt3R), values in METRICS order. A model missing from a split did not report it.
  const SPLITS = [
    { title: 'Simulation / General', sub: '500 clips', values: {
      hv: [115.63, 11.45, 0.061, 23.10], wan: [205.73, 10.43, 0.076, 18.00], cosmos: [167.02, 10.99, 0.062, 22.12],
      v: [101.37, 16.95, 0.057, 28.71], vt: [81.92, 19.16, 0.050, 36.80] } },
    { title: 'Simulation / Robot', sub: '500 clips', values: {
      hv: [98.34, 20.21, 0.023, 41.62], wan: [315.13, 15.84, 0.108, 29.51], xwam: [203.83, 19.97, 0.038, 38.80],
      cosmos: [104.74, 20.05, 0.040, 39.03], v: [78.52, 21.41, 0.022, 43.62], vt: [67.35, 22.08, 0.016, 50.05] } },
    { title: 'Real world / General', sub: '100 clips', values: {
      hv: [105.83, 20.00, 0.014, 21.35], wan: [115.52, 16.97, 0.030, 16.82], cosmos: [66.24, 20.89, 0.015, 20.47],
      v: [62.85, 20.96, 0.010, 26.54], vt: [56.48, 22.10, 0.007, 33.92] } },
    { title: 'Real world / Robot', sub: '100 clips', values: {
      hv: [426.76, 16.04, 0.102, 36.17], wan: [550.55, 14.58, 0.159, 29.65], xwam: [492.31, 17.63, 0.091, 50.86],
      cosmos: [326.11, 16.37, 0.099, 41.50], v: [296.83, 18.42, 0.074, 50.83], vt: [255.19, 20.57, 0.064, 64.75] } }
  ];

  // Paper Table 5, success rate (%); null = not reported.
  const BENCHES = [
    { setting: 'Simulation', title: 'LIBERO', sub: '4 suites / 20 trials per task' },
    { setting: 'Simulation', title: 'LIBERO-Plus', sub: 'zero-shot / 10,030 tasks' },
    { setting: 'Simulation', title: 'RoboCasa', sub: '24 tasks' },
    { setting: 'Real world', title: 'PnP Banana', sub: '24 trials' },
    { setting: 'Real world', title: 'PnP Cup', sub: '24 trials' },
    { setting: 'Real world', title: 'PnP Cube', sub: '24 trials' }
  ];
  const TONES = { base: '#b3b3b3', va: '#7da127', vta: '#1c6316' };
  const METHODS = [
    { name: 'π0.5', base: 'π', sub: '0.5', tone: 'base', v: [96.8, 68.0, 62.1, 41.7, 47.9, 12.5] },
    { name: 'GR00T N1.5', tone: 'base', v: [86.6, 66.4, 65.6, null, null, null] },
    { name: 'GR00T N1.7', tone: 'base', v: [null, null, 70.0, 31.3, 27.1, 4.2] },
    { name: 'Cosmos3-Nano', tone: 'base', v: [96.8, 81.6, 72.0, 50.0, 54.2, 41.7] },
    { name: 'DreamZero', tone: 'base', v: [null, null, null, 54.2, 68.8, 45.8] },
    { name: 'X-WAM', tone: 'base', v: [null, null, 73.8, 14.6, 27.1, 4.2] },
    { name: 'VPM (V+A)', tone: 'va', v: [96.8, 82.0, 73.4, 58.3, 64.6, 43.8] },
    { name: 'VPM (V+T+A)', tone: 'vta', ours: true, v: [97.2, 84.6, 76.2, 79.2, 70.8, 54.2] }
  ];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function svg(tag, attributes) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
  const arrow = metric => (metric.dir === 'down' ? '↓' : '↑');

  // "π0.5" and "δ3D avg" keep their sub/superscripts without using innerHTML.
  function richText(item) {
    const fragment = document.createDocumentFragment();
    if (!item.base) {
      fragment.append(item.name || item.label);
      return fragment;
    }
    fragment.append(item.base);
    if (item.sup) fragment.append(el('sup', '', item.sup));
    if (item.sub) fragment.append(el('sub', '', item.sub));
    return fragment;
  }
  function metricText(metric) {
    const fragment = richText(metric);
    fragment.append(` ${arrow(metric)}`);
    return fragment;
  }

  function createTip(host) {
    const tip = el('div', 'chart-tip');
    tip.setAttribute('aria-hidden', 'true');
    host.append(tip);
    return tip;
  }
  function showTip(tip, host, x, y, { color, value, name, context }) {
    const head = el('div', 'tip-value');
    const key = el('span', 'tip-key');
    key.style.background = color;
    head.append(key, el('strong', '', value));
    const nameLine = el('div', 'tip-name');
    nameLine.append(name);
    const contextLine = el('div', 'tip-context');
    contextLine.append(context);
    tip.replaceChildren(head, nameLine, contextLine);
    tip.classList.add('is-visible');
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.max(half, Math.min(host.clientWidth - half, x))}px`;
    tip.style.top = `${y}px`;
  }

  function onReveal(target, callback) {
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      callback();
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      callback();
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(target);
  }

  function hiddenTable(caption, head, rows) {
    // Tables ignore narrow widths, so the visually hidden wrapper does the clipping.
    const wrapper = el('div', 'results-chart-sr-only');
    const table = el('table');
    table.append(el('caption', '', caption));
    const headRow = el('tr');
    head.forEach(label => headRow.append(el('th', '', label)));
    table.append(headRow);
    rows.forEach(cells => {
      const row = el('tr');
      cells.forEach((cell, i) => row.append(el(i === 0 ? 'th' : 'td', '', cell)));
      table.append(row);
    });
    wrapper.append(table);
    return wrapper;
  }

  /* ---------- VP-WorldBench: one radar per split ---------- */
  function mountRadarGroup(root) {
    const legend = el('ul', 'chart-legend');
    legend.setAttribute('aria-label', 'Models');
    const grid = el('div', 'radar-grid');
    const note = el('p', 'chart-foot', 'Each axis is min–max normalized across the models in its split, so the outer ring marks the best score; ↓ and ↑ show whether lower or higher raw values are better. Hover a point to read its value. X-WAM does not report the General splits.');
    root.replaceChildren(legend, grid, note);

    const charts = [];
    const legendItems = MODELS.map(model => {
      const item = el('li', model.ours ? 'is-ours' : '');
      item.tabIndex = 0;
      item.dataset.id = model.id;
      const key = el('span', 'legend-line');
      key.style.setProperty('--c', model.color);
      item.append(key, el('span', '', model.name));
      item.addEventListener('pointerenter', () => focus(model.id));
      item.addEventListener('pointerleave', () => focus(null));
      item.addEventListener('focus', () => focus(model.id));
      item.addEventListener('blur', () => focus(null));
      legend.append(item);
      return item;
    });
    function focus(id) {
      charts.forEach(chart => chart.focus(id));
      legendItems.forEach(item => item.classList.toggle('is-dim', Boolean(id) && item.dataset.id !== id));
    }
    SPLITS.forEach(split => charts.push(createRadar(grid, split, focus)));
    document.addEventListener('pointerdown', event => {
      if (!root.contains(event.target)) focus(null);
    });
    onReveal(grid, () => charts.forEach(chart => chart.reveal()));
  }

  function createRadar(grid, split, focusAll) {
    const card = el('figure', 'radar-card');
    const caption = el('figcaption', 'radar-title');
    caption.append(el('strong', '', split.title), el('span', '', split.sub));
    const plot = el('div', 'radar-plot');
    const tip = createTip(plot);
    const models = MODELS.filter(model => split.values[model.id]);
    card.append(caption, plot, hiddenTable(
      `VP-WorldBench, ${split.title}`,
      ['Model', ...METRICS.map(metric => `${metric.label} ${arrow(metric)}`)],
      models.map(model => [model.name, ...split.values[model.id].map((value, i) => value.toFixed(METRICS[i].digits))])
    ));
    grid.append(card);

    // Min–max per axis within this split; the worst model sits on the inner floor ring.
    const floor = 0.18;
    const radii = {};
    models.forEach(model => { radii[model.id] = []; });
    METRICS.forEach((metric, i) => {
      const column = models.map(model => split.values[model.id][i]);
      const low = Math.min(...column);
      const high = Math.max(...column);
      models.forEach(model => {
        const value = split.values[model.id][i];
        const t = high === low ? 1 : metric.dir === 'down' ? (high - value) / (high - low) : (value - low) / (high - low);
        radii[model.id].push(floor + (1 - floor) * t);
      });
    });

    let focused = null;
    let drawnWidth = 0;
    function setFocus(id) {
      focused = id;
      if (id) plot.dataset.focus = id; else delete plot.dataset.focus;
      plot.querySelectorAll('.radar-series').forEach(group => group.classList.toggle('is-focus', group.dataset.id === id));
      if (!id) tip.classList.remove('is-visible');
    }

    function draw() {
      const available = Math.round(plot.clientWidth);
      if (!available || available === drawnWidth) return;
      drawnWidth = available;
      const W = Math.min(available, 440);
      const compact = W < 360;
      const R = Math.max(62, Math.min(136, W / 2 - (compact ? 60 : 74)));
      const pad = compact ? 26 : 30;
      const H = Math.round(2 * R + 2 * pad);
      const cx = W / 2;
      const cy = H / 2;
      const angle = i => -Math.PI / 2 + (i * Math.PI) / 2;
      const point = (i, r) => [cx + r * R * Math.cos(angle(i)), cy + r * R * Math.sin(angle(i))];
      const fmt = pair => pair.map(n => n.toFixed(1)).join(',');

      const root = svg('svg', {
        class: 'radar-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
        'aria-label': `${split.title}: FVD, PSNR, MEt3R and δ3D avg for each model`
      });
      [0.25, 0.5, 0.75, 1].forEach(ring => {
        root.append(svg('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: (ring * R).toFixed(1), class: ring === 1 ? 'radar-ring is-outer' : 'radar-ring' }));
      });
      METRICS.forEach((metric, i) => {
        const [x, y] = point(i, 1);
        root.append(svg('line', { x1: cx, y1: cy, x2: x.toFixed(1), y2: y.toFixed(1), class: 'radar-spoke' }));
        const a = angle(i);
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const gap = compact ? 9 : 12;
        const text = svg('text', {
          x: (cx + (R + gap) * cos).toFixed(1),
          y: (cy + (R + gap) * sin + (sin < -0.5 ? -2 : sin > 0.5 ? 12 : 4)).toFixed(1),
          'text-anchor': Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end',
          class: 'radar-axis-label'
        });
        if (metric.base) {
          text.append(document.createTextNode(metric.base));
          const sup = svg('tspan', { dy: -5, class: 'script' });
          sup.textContent = metric.sup;
          const sub = svg('tspan', { dy: 8, class: 'script' });
          sub.textContent = metric.sub;
          const dir = svg('tspan', { dy: -3, class: 'dir' });
          dir.textContent = ` ${arrow(metric)}`;
          text.append(sup, sub, dir);
        } else {
          text.append(document.createTextNode(metric.label));
          const dir = svg('tspan', { class: 'dir' });
          dir.textContent = ` ${arrow(metric)}`;
          text.append(dir);
        }
        root.append(text);
      });

      const order = [...models].sort((a, b) => Number(Boolean(a.ours)) - Number(Boolean(b.ours)));
      order.forEach((model, rank) => {
        const group = svg('g', { class: 'radar-series' });
        group.dataset.id = model.id;
        group.style.transformOrigin = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
        group.style.transitionDelay = `${rank * 60}ms`;
        if (focused === model.id) group.classList.add('is-focus');
        const points = radii[model.id].map((r, i) => point(i, r));
        group.append(svg('path', {
          d: `M${points.map(fmt).join('L')}Z`, class: 'radar-area',
          fill: model.color, 'fill-opacity': model.ours ? 0.1 : 0, stroke: model.color, 'stroke-width': 2
        }));
        points.forEach(([x, y]) => group.append(svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 4, fill: model.color, class: 'radar-dot' })));
        root.append(group);
      });
      order.forEach(model => radii[model.id].forEach((r, i) => {
        const [x, y] = point(i, r);
        const hit = svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 12, class: 'radar-hit' });
        const show = () => {
          focusAll(model.id);
          const metric = METRICS[i];
          const box = root.getBoundingClientRect();
          const host = plot.getBoundingClientRect();
          showTip(tip, plot, box.left - host.left + x, box.top - host.top + y, {
            color: model.color,
            value: split.values[model.id][i].toFixed(metric.digits),
            name: model.name,
            context: metricText(metric)
          });
        };
        hit.addEventListener('pointerenter', show);
        hit.addEventListener('pointerdown', show);
        hit.addEventListener('pointerleave', () => focusAll(null));
        root.append(hit);
      }));

      plot.querySelector('svg')?.remove();
      plot.append(root);
    }

    draw();
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(plot);
    else window.addEventListener('resize', draw);
    return { focus: setFocus, reveal: () => plot.classList.add('is-revealed') };
  }

  /* ---------- Robot manipulation: bar charts ---------- */
  function mountBars(root) {
    const legend = el('ul', 'chart-legend');
    legend.setAttribute('aria-label', 'Methods');
    [['Baselines', 'base'], ['VPM (V+A)', 'va'], ['VPM (V+T+A)', 'vta']].forEach(([label, tone]) => {
      const item = el('li', tone === 'vta' ? 'is-ours' : '');
      const key = el('span', 'legend-rect');
      key.style.background = TONES[tone];
      item.append(key, el('span', '', label));
      legend.append(item);
    });
    root.replaceChildren(legend);

    ['Simulation', 'Real world'].forEach(setting => {
      const block = el('div', 'bar-setting');
      block.append(el('p', 'bar-setting-title', setting));
      const panels = el('div', 'bar-panels');
      BENCHES.forEach((bench, b) => {
        if (bench.setting !== setting) return;
        const rows = METHODS.filter(method => method.v[b] !== null);
        const best = Math.max(...rows.map(method => method.v[b]));
        const figure = el('figure', 'bar-panel');
        const caption = el('figcaption');
        caption.append(el('strong', '', bench.title), el('span', '', bench.sub));
        const list = el('ul', 'bar-rows');
        const tip = createTip(figure);
        rows.forEach((method, r) => {
          const value = method.v[b];
          const row = el('li', 'bar-row');
          if (method.ours) row.classList.add('is-ours');
          if (value === best) row.classList.add('is-best');
          const label = el('span', 'bar-label');
          label.append(richText(method));
          const track = el('span', 'bar-track');
          track.style.setProperty('--v', value);
          const fill = el('span', 'bar-fill');
          fill.style.background = TONES[method.tone];
          fill.style.transitionDelay = `${r * 45}ms`;
          const number = el('span', 'bar-value', value.toFixed(1));
          number.style.transitionDelay = `${r * 45}ms`;
          track.append(fill, number);
          row.append(label, track);
          row.addEventListener('pointerenter', () => {
            const box = fill.getBoundingClientRect();
            const host = figure.getBoundingClientRect();
            showTip(tip, figure, box.right - host.left, box.top - host.top, {
              color: TONES[method.tone],
              value: `${value.toFixed(1)}%`,
              name: richText(method),
              context: `${bench.title} success rate`
            });
          });
          row.addEventListener('pointerleave', () => tip.classList.remove('is-visible'));
          list.append(row);
        });
        figure.append(caption, list);
        panels.append(figure);
      });
      block.append(panels);
      root.append(block);
    });

    root.append(hiddenTable(
      'Robot manipulation success rate (%)',
      ['Method', ...BENCHES.map(bench => `${bench.setting} ${bench.title}`)],
      METHODS.map(method => [method.name, ...method.v.map(value => (value === null ? 'not reported' : value.toFixed(1)))])
    ));
    onReveal(root, () => root.classList.add('is-revealed'));
  }

  document.querySelectorAll('[data-radar-group]').forEach(mountRadarGroup);
  document.querySelectorAll('[data-bars]').forEach(mountBars);
})();
