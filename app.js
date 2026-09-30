(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Muted clips play while on screen ---------- */
  const autoVideos = [...document.querySelectorAll('video[data-autoplay]')];
  function tryPlay(video) {
    if (reducedMotion.matches || video.dataset.userPaused === 'true' || !video.inView) return;
    if (video.closest('[hidden]')) return;
    const attempt = video.play();
    if (attempt) attempt.catch(() => {});
  }
  function autoPause(video) {
    if (video.paused) return;
    video.autoPausing = true;
    video.pause();
  }
  autoVideos.forEach(video => {
    video.muted = true;
    video.addEventListener('pause', () => {
      if (video.autoPausing) video.autoPausing = false;
      else if (!video.ended) video.dataset.userPaused = 'true';
    });
    video.addEventListener('play', () => { delete video.dataset.userPaused; });
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const video = entry.target;
        video.inView = entry.isIntersecting;
        if (entry.isIntersecting) tryPlay(video); else autoPause(video);
      });
    }, { threshold: 0.35 });
    autoVideos.forEach(video => observer.observe(video));
  }

  /* ---------- Tabs ---------- */
  document.querySelectorAll('[data-tabs]').forEach(root => {
    const tabs = [...root.querySelectorAll(':scope > .tab-list [role="tab"]')];
    const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
    function select(index, focus) {
      tabs.forEach((tab, i) => {
        const active = i === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
        if (!active) panels[i].querySelectorAll('video').forEach(autoPause);
      });
      if (focus) tabs[index].focus();
      panels[index].querySelectorAll('video[data-autoplay]').forEach(tryPlay);
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(index, false));
      tab.addEventListener('keydown', event => {
        const last = tabs.length - 1;
        let next = null;
        if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
        else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = last;
        if (next === null) return;
        event.preventDefault();
        select(next, true);
      });
    });
  });

  /* ---------- Play / restart a group of videos together ---------- */
  const labels = { play: 'Play all', pause: 'Pause all' };
  document.querySelectorAll('[data-video-group]').forEach(group => {
    const videos = [...group.querySelectorAll('video')];
    const playButton = group.querySelector('[data-play-group]');
    const restartButton = group.querySelector('[data-restart-group]');
    if (!playButton || !restartButton) return;
    const playing = () => videos.some(video => !video.paused && !video.ended);
    const update = () => { playButton.textContent = playing() ? labels.pause : labels.play; };
    playButton.addEventListener('click', async () => {
      if (playing()) videos.forEach(video => video.pause());
      else await Promise.allSettled(videos.map(video => { if (video.ended) video.currentTime = 0; return video.play(); }));
      update();
    });
    restartButton.addEventListener('click', async () => {
      videos.forEach(video => { video.currentTime = 0; });
      await Promise.allSettled(videos.map(video => video.play()));
      update();
    });
    videos.forEach(video => ['play', 'pause', 'ended'].forEach(name => video.addEventListener(name, update)));
  });

  /* ---------- Resource dropdown: opens on hover, or on tap for touch screens ---------- */
  document.querySelectorAll('.link-dropdown').forEach(dropdown => {
    const button = dropdown.querySelector('button');
    const setOpen = open => {
      dropdown.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
    };
    button.addEventListener('click', () => setOpen(!dropdown.classList.contains('is-open')));
    document.addEventListener('pointerdown', event => {
      if (!dropdown.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !dropdown.classList.contains('is-open')) return;
      setOpen(false);
      button.focus();
    });
  });

  /* ---------- Figure 1 spotlight ---------- */
  const spot = document.querySelector('.spot-figure');
  if (spot) {
    const canvas = spot.querySelector('.spot-canvas');
    const hole = spot.querySelector('.spot-hole');
    const regions = [...spot.querySelectorAll('.spot-region')];
    const callouts = [...spot.querySelectorAll('.spot-callout')];
    const controls = [...regions, ...callouts];
    let pinned = null;
    function rectFor(point) {
      const region = regions.find(item => item.dataset.point === point);
      return region ? region.dataset.rect.split(',').map(Number) : null;
    }
    function highlight(point) {
      const rect = point ? rectFor(point) : null;
      if (rect) {
        const [left, top, width, height] = rect;
        Object.assign(hole.style, { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` });
        spot.dataset.active = point;
      } else {
        delete spot.dataset.active;
      }
      callouts.forEach(button => {
        button.classList.toggle('is-active', button.dataset.point === point);
        button.setAttribute('aria-pressed', String(button.dataset.point === pinned));
      });
      regions.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.point === pinned)));
    }
    controls.forEach(control => {
      control.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') highlight(control.dataset.point); });
      control.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') highlight(pinned); });
      control.addEventListener('focus', () => highlight(control.dataset.point));
      control.addEventListener('blur', () => queueMicrotask(() => { if (!controls.includes(document.activeElement)) highlight(pinned); }));
      control.addEventListener('click', () => {
        pinned = pinned === control.dataset.point ? null : control.dataset.point;
        highlight(pinned);
      });
    });
    document.addEventListener('pointerdown', event => {
      if (!spot.contains(event.target)) { pinned = null; highlight(null); }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') { pinned = null; highlight(null); }
    });
    canvas.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') highlight(pinned); });
  }
})();
