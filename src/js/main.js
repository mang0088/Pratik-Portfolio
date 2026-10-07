/* Standalone animation controller. No frameworks or build tools required. */
(function () {
  'use strict';
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const phoneQuery = window.matchMedia('(max-width: 809px)');
  const animations = new Set();
  function animate(el, keyframes, options) {
    if (motionQuery.matches || !el.animate) return;
    const animation = el.animate(keyframes, options);
    animations.add(animation);
    animation.finished
      .then(() => animations.delete(animation))
      .catch(() => animations.delete(animation));
  }
  /* Text: word staggering (.07s), line staggering, and optional blur. */
  document.querySelectorAll('[data-text-animate]').forEach((el) => {
    if (phoneQuery.matches && el.classList.contains('hero-quote')) return;
    const kind = el.dataset.textAnimate,
      delay = Number(el.dataset.delay || 0),
      duration = Number(el.dataset.duration || 400),
      blur = Number(el.dataset.blur || 0);
    if (motionQuery.matches) return;
    const source = el.textContent.trim();
    el.setAttribute('aria-label', source);
    const pieces = kind === 'word' ? source.split(/(\s+)/) : [source];
    el.textContent = '';
    let index = 0;
    pieces.forEach((piece) => {
      if (/^\s+$/.test(piece)) {
        el.append(document.createTextNode(piece));
        return;
      }
      const token = document.createElement('span');
      token.className = kind === 'word' ? 'text-token' : 'text-line';
      token.textContent = piece;
      token.setAttribute('aria-hidden', 'true');
      el.append(token);
      animate(
        token,
        [
          { opacity: 0, transform: 'translateY(10px)', filter: 'blur(' + blur + 'px)' },
          { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' },
        ],
        {
          duration,
          delay: delay + index++ * 70,
          easing: 'cubic-bezier(.22,1,.36,1)',
          fill: 'both',
        },
      );
    });
  });
  /* Hero heading mount: 30px vertical entrance over one second. */
  const title = document.querySelector('.hero-title');
  animate(
    title,
    [
      { opacity: 0, transform: 'translateY(30px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { duration: 1000, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' },
  );
  if (phoneQuery.matches) {
    title.style.fontSize = '2rem';
    title.style.letterSpacing = '.5em';
    title.style.textAlign = 'center';
  } else {
    title.style.textAlign = 'left';
  }
  /* On-view fades: observed content cards use a 50% visibility threshold. */
  const targets = document.querySelectorAll('.reveal');
  if (!motionQuery.matches && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js');
    const halfObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            halfObserver.unobserve(entry.target);
          }
        }),
      { threshold: 0.5 },
    );
    const anyObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            anyObserver.unobserve(entry.target);
          }
        }),
      { threshold: 0 },
    );
    targets.forEach((el) =>
      (el.dataset.threshold === '0' ? anyObserver : halfObserver).observe(el),
    );
  } else {
    targets.forEach((el) => el.classList.add('is-visible'));
  }
  /* Signature reveal.
   - Auto-triggers when the Contact greeting reaches the viewport center on desktop and mobile.
   - No replay button. Clicking the signature itself still replays (handy during dev).
   - Reveal is a true 0% → 100% sweep via mask-rect width = t * (W + FEATHER),
     so at t=0 nothing is visible and at t=1 the entire glyph is painted.
   - DURATION is intentionally slow (8s) for a leisurely, hand-drawn feel. */
  (function () {
    const sig = document.getElementById('sig');
    if (!sig) return;
    const inkRect = sig.querySelector('#inkRect');
    if (!inkRect) return;
    const greeting = Array.from(document.querySelectorAll('.visitor-message p')).find((el) =>
      el.textContent.trim().startsWith('Hey there! Thank you so much'),
    );
    const W = 1740,
      FEATHER = 220,
      DURATION = 7000;
    let started = false,
      startTime = null,
      rafId = null,
      ticking = false,
      prevDist = null;
    function ease(t) {
      // Piecewise handwriting rhythm: fast through the long P flourish (0..0.30
      // of t covers the first 42% of the glyph), slower across the dense
      // "atik" letters (0.30..1.0 covers the remaining 58%). A tiny sinusoid
      // adds micro-hesitations without ever reversing direction.
      let p;
      if (t < 0.3) {
        const u = t / 0.3;
        p = 0.42 * (1 - Math.pow(1 - u, 2));
      } else {
        const u2 = (t - 0.3) / 0.7,
          eio = u2 < 0.5 ? 2 * u2 * u2 : 1 - Math.pow(-2 * u2 + 2, 2) / 2;
        p = 0.42 + eio * 0.58;
      }
      return Math.max(0, Math.min(1, p + 0.012 * Math.sin(t * Math.PI * 4.5)));
    }
    function frame(now) {
      if (startTime === null) startTime = now;
      const raw = Math.min(1, (now - startTime) / DURATION);
      const t = ease(raw);
      inkRect.setAttribute('width', String(t * (W + FEATHER)));
      if (raw < 1) rafId = requestAnimationFrame(frame);
    }
    function play() {
      if (started) return;
      started = true;
      startTime = null;
      if (rafId) cancelAnimationFrame(rafId);
      inkRect.setAttribute('width', '0');
      if (motionQuery.matches) {
        inkRect.setAttribute('width', String(W + FEATHER));
        return;
      }
      rafId = requestAnimationFrame(frame);
    }
    function replay() {
      // Allow re-triggering only via explicit click on the signature.
      if (rafId) cancelAnimationFrame(rafId);
      started = true;
      startTime = null;
      inkRect.setAttribute('width', '0');
      if (motionQuery.matches) {
        inkRect.setAttribute('width', String(W + FEATHER));
        return;
      }
      rafId = requestAnimationFrame(frame);
    }
    function check() {
      ticking = false;
      if (started) return;
      const target = greeting || sig;
      const r = target.getBoundingClientRect(),
        triggerY = window.innerHeight / 2;
      const targetCenter = (r.top + r.bottom) / 2,
        dist = targetCenter - triggerY;
      const tol = Math.max(16, Math.min(48, r.height * 0.25));
      const crossed =
        prevDist !== null && ((prevDist <= 0 && dist >= 0) || (prevDist >= 0 && dist <= 0));
      prevDist = dist;
      if (Math.abs(dist) <= tol || crossed) play();
    }
    function schedule() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(check);
      }
    }
    sig.addEventListener('click', replay);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('load', schedule, { once: true });
    schedule();
  })();
  /* Portrait tracks scroll progress continuously; control state changes independently. */
  const hero = document.getElementById('hero'),
    info = document.getElementById('content'),
    portrait = document.querySelector('.portrait'),
    portraitStage = document.querySelector('.portrait-stage'),
    scrollButton = document.querySelector('.scroll-control');
  let queued = false;
  function updatePortrait() {
    const isPhone = phoneQuery.matches,
      viewportHeight = window.innerHeight,
      stageWidth = portraitStage.clientWidth,
      gutter =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || 0,
      about = document.getElementById('about'),
      heroMain = document.querySelector('.hero-main'),
      heroQuote = document.querySelector('.hero-quote'),
      scrollPadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0,
      aboutMargin = parseFloat(getComputedStyle(about).scrollMarginTop) || 0,
      scrollRange = isPhone
        ? Math.max(1, about.offsetTop - scrollPadding - aboutMargin)
        : Math.max(hero.offsetHeight, 1),
      progress = Math.max(
        0,
        Math.min(
          1,
          isPhone
            ? window.scrollY / scrollRange
            : (window.scrollY - hero.offsetTop + scrollPadding + aboutMargin) / scrollRange,
        ),
      ),
      startHeight = viewportHeight * (isPhone ? 1.5 : 2),
      endHeight = viewportHeight * 0.9,
      height = startHeight + (endHeight - startHeight) * progress,
      left = stageWidth * 0.5 + (stageWidth - gutter - stageWidth * 0.5) * progress,
      startTop = isPhone
        ? heroQuote.getBoundingClientRect().bottom + 5 - startHeight * (282 / 1936)
        : 0,
      top = startTop * (1 - progress) + viewportHeight * 0.5 * progress,
      translateX = -50 - 50 * progress,
      translateY = -50 * progress;
    portrait.style.left = left + 'px';
    portrait.style.top = top + 'px';
    portrait.style.width = height * (528 / 1936) + 'px';
    portrait.style.height = height + 'px';
    portrait.style.transform = 'translate(' + translateX + '%, ' + translateY + '%)';
  }
  function updateScroll() {
    queued = false;
    updatePortrait();
    const boundary = info.getBoundingClientRect().top,
      past = boundary <= window.innerHeight * 0.5;
    document.body.classList.toggle('scrolled', past);
    scrollButton.textContent = past ? 'Back to Top' : 'Scroll';
    scrollButton.dataset.destination = past ? 'hero' : 'content';
    scrollButton.setAttribute(
      'aria-label',
      past ? 'Scroll back to the top' : 'Scroll to the content',
    );
  }
  function requestUpdate() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(updateScroll);
    }
  }
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  updateScroll();
  scrollButton.addEventListener('click', () =>
    document
      .getElementById(scrollButton.dataset.destination)
      .scrollIntoView({ behavior: motionQuery.matches ? 'auto' : 'smooth', block: 'start' }),
  );
  /* Menu: blurred full-screen mobile disclosure, staggered links, Escape + focus trap. */
  const toggle = document.querySelector('.menu-toggle'),
    panel = document.getElementById('mobile-menu');
  function setMenu(open, restoreFocus = true) {
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
    panel.setAttribute('aria-hidden', String(!open));
    panel.inert = !open;
    if (!open && restoreFocus) toggle.focus();
  }
  panel.inert = true;
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  panel
    .querySelectorAll('a')
    .forEach((link) => link.addEventListener('click', () => setMenu(false, false)));
  document.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('menu-open')) return;
    if (event.key === 'Escape') {
      setMenu(false);
      return;
    }
    if (event.key === 'Tab') {
      const controls = [toggle, ...panel.querySelectorAll('a,button')];
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  phoneQuery.addEventListener('change', (event) => {
    if (!event.matches) setMenu(false, false);
  });
  /* Smooth anchors (also usable without JS through native CSS scrolling). */
  document.querySelectorAll('a[href^="#"]').forEach((link) =>
    link.addEventListener('click', (event) => {
      const target = document.getElementById(link.getAttribute('href').slice(1));
      if (!target) return;
      event.preventDefault();
      setMenu(false, false);
      target.scrollIntoView({ behavior: motionQuery.matches ? 'auto' : 'smooth' });
      history.replaceState(null, '', link.getAttribute('href'));
    }),
  );
  /* Fit each display heading by measuring its longest line. No arbitrary fixed desktop size. */
  function fitDisplay(el) {
    if (phoneQuery.matches && el.classList.contains('footer-title')) {
      el.style.fontSize = 'clamp(2rem,12vw,3rem)';
      return;
    }
    if (phoneQuery.matches && el.classList.contains('hero-title')) {
      el.style.fontSize = '2rem';
      el.style.letterSpacing = '.5em';
      el.style.textAlign = 'center';
      return;
    }
    const lines = el.querySelectorAll(':scope > span');
    if (!lines.length || !el.clientWidth) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '700 100px Switzer, Arial, sans-serif';
    const widest = Math.max(
      ...Array.from(lines, (line) => ctx.measureText(line.textContent).width),
    );
    if (widest > 0) el.style.fontSize = (el.clientWidth / widest) * 100 * 0.995 + 'px';
  }
  function fitAll() {
    document.querySelectorAll('[data-fit]').forEach(fitDisplay);
  }
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(fitAll);
    document.querySelectorAll('[data-fit]').forEach((el) => ro.observe(el));
  }
  window.addEventListener('resize', fitAll, { passive: true });
  if (document.fonts) {
    document.fonts.ready.then(fitAll);
  }
  fitAll();

  /* Page exit fade for same-tab external navigation. Native downloads/mail links are preserved. */
  document.querySelectorAll('a[href]').forEach((link) =>
    link.addEventListener('click', (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === '_blank' ||
        link.hasAttribute('download')
      )
        return;
      const href = link.getAttribute('href');
      if (!/^https?:/i.test(href) || motionQuery.matches) return;
      event.preventDefault();
      document.body.classList.add('page-leaving');
      setTimeout(() => {
        window.location.href = href;
      }, 200);
    }),
  );
  window.addEventListener('pageshow', () => document.body.classList.remove('page-leaving'));
  /* Stop loops in a background tab; honor a preference change without reloading. */
  document.addEventListener('visibilitychange', () =>
    document
      .querySelectorAll('.status-dot')
      .forEach((dot) => (dot.style.visibility = document.hidden ? 'hidden' : 'visible')),
  );
  motionQuery.addEventListener('change', (event) => {
    if (event.matches) {
      animations.forEach((animation) => animation.finish());
      targets.forEach((el) => el.classList.add('is-visible'));
      document.documentElement.classList.remove('js');
    }
  });
})();
