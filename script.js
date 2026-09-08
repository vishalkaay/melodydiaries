(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const qs = (selector, context = document) => context.querySelector(selector);
  const qsa = (selector, context = document) => [...context.querySelectorAll(selector)];

  // Progressive reveal
  const reveals = qsa('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((item) => item.classList.add('in-view'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 4, 3) * 60}ms`;
      revealObserver.observe(item);
    });
  }

  // Scroll state: progress and intelligent header
  const progress = qs('.scroll-progress span');
  const header = qs('.site-header');
  let lastScroll = 0;
  let ticking = false;

  function updateScrollState() {
    const current = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? current / max : 0})`;
    if (current > lastScroll && current > 180 && !document.body.classList.contains('menu-open')) {
      header.classList.add('hidden');
    } else {
      header.classList.remove('hidden');
    }
    lastScroll = Math.max(0, current);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateScrollState);
      ticking = true;
    }
  }, { passive: true });
  updateScrollState();

  // Mobile navigation
  const menuButton = qs('.menu-toggle');
  const menu = qs('#mobile-menu');
  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    qs('span', menuButton).textContent = open ? 'Close' : 'Menu';
  };
  menuButton.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  qsa('a', menu).forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });

  // Custom cursor and magnetic controls
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion) {
    const dot = qs('.cursor-dot');
    const ring = qs('.cursor-ring');
    let pointerX = -100;
    let pointerY = -100;
    let ringX = -100;
    let ringY = -100;

    document.addEventListener('mousemove', (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      dot.style.left = `${pointerX}px`;
      dot.style.top = `${pointerY}px`;
      document.documentElement.style.setProperty('--pointer-x', `${pointerX}px`);
      document.documentElement.style.setProperty('--pointer-y', `${pointerY}px`);
    });

    function animateCursor() {
      ringX += (pointerX - ringX) * 0.16;
      ringY += (pointerY - ringY) * 0.16;
      ring.style.left = `${ringX}px`;
      ring.style.top = `${ringY}px`;
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    qsa('a, button, [data-tilt]').forEach((element) => {
      element.addEventListener('mouseenter', () => ring.classList.add('active'));
      element.addEventListener('mouseleave', () => ring.classList.remove('active'));
    });

    qsa('.magnetic').forEach((element) => {
      element.addEventListener('mousemove', (event) => {
        const bounds = element.getBoundingClientRect();
        const x = event.clientX - bounds.left - bounds.width / 2;
        const y = event.clientY - bounds.top - bounds.height / 2;
        element.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
      });
      element.addEventListener('mouseleave', () => {
        element.style.transform = '';
      });
    });

    const portrait = qs('[data-tilt]');
    portrait?.addEventListener('mousemove', (event) => {
      const bounds = portrait.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      portrait.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg)`;
    });
    portrait?.addEventListener('mouseleave', () => { portrait.style.transform = ''; });

    const hero = qs('.hero');
    hero?.addEventListener('pointermove', (event) => {
      const bounds = hero.getBoundingClientRect();
      hero.style.setProperty('--hero-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
      hero.style.setProperty('--hero-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
    });

    qsa('.project-card').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const bounds = card.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        const rotateY = ((x / bounds.width) - 0.5) * 2.2;
        const rotateX = ((y / bounds.height) - 0.5) * -2.2;
        card.style.setProperty('--mx', `${x}px`);
        card.style.setProperty('--my', `${y}px`);
        card.style.transform = `perspective(1400px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
      });
    });

    qsa('.timeline-row, .capability').forEach((row) => {
      row.addEventListener('pointermove', (event) => {
        const bounds = row.getBoundingClientRect();
        row.style.setProperty('--row-x', `${event.clientX - bounds.left}px`);
      });
    });
  }

  // Generative hero signal field
  const heroCanvas = qs('#signal-canvas');
  const heroContext = heroCanvas?.getContext('2d');
  let canvasWidth = 0;
  let canvasHeight = 0;
  let pointer = { x: 0.72, y: 0.42 };
  let frame = 0;
  let heroVisible = true;
  let looping = false;

  function sizeHeroCanvas() {
    if (!heroCanvas || !heroContext) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    const rect = heroCanvas.getBoundingClientRect();
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    heroCanvas.width = Math.floor(rect.width * ratio);
    heroCanvas.height = Math.floor(rect.height * ratio);
    heroContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function drawSignal() {
    if (!heroContext) return;
    heroContext.clearRect(0, 0, canvasWidth, canvasHeight);
    const originX = canvasWidth * pointer.x;
    const originY = canvasHeight * pointer.y;
    const radius = Math.min(canvasWidth, canvasHeight) * 0.32;

    for (let line = 0; line < 22; line += 1) {
      heroContext.beginPath();
      const phase = frame * 0.004 + line * 0.32;
      for (let step = 0; step <= 180; step += 1) {
        const angle = (step / 180) * Math.PI * 2;
        const distortion = Math.sin(angle * 4 + phase) * (8 + line * 0.65) + Math.cos(angle * 7 - phase) * 3;
        const r = radius * (0.18 + line / 29) + distortion;
        const x = originX + Math.cos(angle) * r * 1.22;
        const y = originY + Math.sin(angle) * r;
        if (step === 0) heroContext.moveTo(x, y); else heroContext.lineTo(x, y);
      }
      heroContext.closePath();
      heroContext.strokeStyle = line % 5 === 0 ? 'rgba(204,255,0,.17)' : 'rgba(255,255,255,.055)';
      heroContext.lineWidth = line % 5 === 0 ? 1 : 0.65;
      heroContext.stroke();
    }
    frame += 1;
    if (reducedMotion || !heroVisible) {
      looping = false;
      return;
    }
    requestAnimationFrame(drawSignal);
  }

  function startSignal() {
    if (looping) return;
    looping = true;
    requestAnimationFrame(drawSignal);
  }

  if (heroCanvas) {
    sizeHeroCanvas();
    window.addEventListener('resize', sizeHeroCanvas);
    qs('.hero').addEventListener('pointermove', (event) => {
      const bounds = heroCanvas.getBoundingClientRect();
      const nextX = (event.clientX - bounds.left) / bounds.width;
      const nextY = (event.clientY - bounds.top) / bounds.height;
      pointer.x += (nextX - pointer.x) * 0.08;
      pointer.y += (nextY - pointer.y) * 0.08;
    });

    if (reducedMotion) {
      drawSignal();
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        heroVisible = entries[0].isIntersecting;
        if (heroVisible) startSignal();
      }, { threshold: 0 }).observe(heroCanvas);
      startSignal();
    } else {
      startSignal();
    }
  }

  // Physics field on project card
  qsa('.mini-canvas[data-visual="field"]').forEach((canvas) => {
    const context = canvas.getContext('2d');
    const drawField = () => {
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      const cols = 14;
      const rows = 10;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = (col + 1) * rect.width / (cols + 1);
          const y = (row + 1) * rect.height / (rows + 1);
          const cx = rect.width * 0.5;
          const cy = rect.height * 0.48;
          const dx = cx - x;
          const dy = cy - y;
          const angle = Math.atan2(dy, dx) + Math.PI / 2;
          const length = 5 + Math.max(0, 16 - Math.hypot(dx, dy) * 0.03);
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
          context.strokeStyle = `rgba(255,92,53,${0.24 + row * 0.025})`;
          context.lineWidth = 1;
          context.stroke();
        }
      }
    };
    drawField();
    window.addEventListener('resize', drawField);
  });

  // Decorative audio visualization; deliberately no fake audio playback
  const waveform = qs('.waveform');
  if (waveform) {
    const bars = Array.from({ length: 42 }, (_, index) => {
      const bar = document.createElement('i');
      bar.style.setProperty('--h', `${6 + Math.abs(Math.sin(index * 1.7)) * 22}px`);
      bar.style.setProperty('--delay', `${(index % 8) * -0.09}s`);
      return bar;
    });
    waveform.append(...bars);
  }

  const playerButton = qs('.play-button');
  const trackCard = qs('.track-card');
  playerButton?.addEventListener('click', () => {
    const isPlaying = trackCard.classList.toggle('playing');
    playerButton.setAttribute('aria-pressed', String(isPlaying));
    qs('.play-icon', playerButton).textContent = isPlaying ? 'Ⅱ' : '▶';
    playerButton.setAttribute('aria-label', isPlaying ? 'Pause sample visualization' : 'Play sample visualization');
  });

  // Most-played shorts: one stage preview driven by the ledger
  const reelStage = qs('.reel-stage');
  const reelRows = qsa('.reel-list a');
  if (reelStage && reelRows.length) {
    const stageImg = qs('.stage-img', reelStage);
    const stageTitle = qs('.stage-title', reelStage);
    const stageSub = qs('.stage-sub', reelStage);
    const stageLink = qs('.stage-link', reelStage);
    let warmed = false;

    const setActive = (row) => {
      if (row.classList.contains('is-active')) return;
      reelRows.forEach((item) => item.classList.remove('is-active'));
      row.classList.add('is-active');
      stageImg.src = row.dataset.thumb;
      stageTitle.textContent = row.dataset.title;
      stageSub.textContent = row.dataset.sub;
      stageLink.href = row.href;
    };

    const warmThumbs = () => {
      if (warmed) return;
      warmed = true;
      reelRows.forEach((row) => { new Image().src = row.dataset.thumb; });
    };

    reelRows.forEach((row) => {
      row.addEventListener('mouseenter', () => setActive(row));
      row.addEventListener('focus', () => setActive(row));
    });
    qs('.reel-list').addEventListener('pointerenter', warmThumbs);
    setActive(reelRows[0]);
  }

  qs('#year').textContent = String(new Date().getFullYear());
})();
