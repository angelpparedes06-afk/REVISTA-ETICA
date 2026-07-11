/* =====================================================================
   FOTORREVISTA ÉTICA — recorrido documental interactivo
   JavaScript puro: scroll progress, reveal-on-scroll, drawer accesible
   (con trampa de foco), parallax ligero, pausa de animaciones fuera de
   pantalla y navegación activa.
   ===================================================================== */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------
     1) INDICADOR DE PROGRESO DE LECTURA
  --------------------------------------------------------------- */
  const progressFill = document.getElementById('progressFill');
  const progressTrack = document.getElementById('progressTrack');
  function updateProgress(){
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop;
    const height = doc.scrollHeight - doc.clientHeight;
    const pct = height > 0 ? (scrollTop / height) * 100 : 0;
    progressFill.style.width = pct + '%';
    progressTrack.setAttribute('aria-valuenow', Math.round(pct));
  }

  /* ---------------------------------------------------------------
     2) NAVBAR: fondo sólido al hacer scroll
  --------------------------------------------------------------- */
  const navbar = document.getElementById('navbar');
  function updateNavbar(){
    navbar.classList.toggle('is-scrolled', window.scrollY > 40);
  }

  /* ---------------------------------------------------------------
     3) BOTÓN VOLVER ARRIBA
  --------------------------------------------------------------- */
  const toTop = document.getElementById('toTop');
  function updateToTop(){
    toTop.classList.toggle('is-visible', window.scrollY > window.innerHeight);
  }
  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });

  /* ---------------------------------------------------------------
     4) LOOP DE SCROLL (rAF, para rendimiento)
  --------------------------------------------------------------- */
  let ticking = false;
  function onScroll(){
    if (!ticking){
      window.requestAnimationFrame(() => {
        updateProgress();
        updateNavbar();
        updateToTop();
        updateActiveRoom();
        updateParallax();
        ticking = false;
      });
      ticking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // Debounce del evento resize: recalcular tras 150ms de inactividad
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onScroll, 150);
  });

  /* ---------------------------------------------------------------
     5) REVEAL ON SCROLL (IntersectionObserver)
  --------------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !prefersReducedMotion){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  /* ---------------------------------------------------------------
     6) PAUSA DE ANIMACIONES DEL HERO FUERA DE PANTALLA
     El Ken Burns del hero corre en loop infinito; lo pausamos cuando
     el usuario ya se desplazó lejos de la portada para ahorrar CPU/batería.
  --------------------------------------------------------------- */
  const heroBg = document.getElementById('heroBg');
  if ('IntersectionObserver' in window && heroBg){
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        heroBg.classList.toggle('is-offscreen', !entry.isIntersecting);
      });
    }, { threshold: 0 });
    heroObserver.observe(document.getElementById('hero'));
  }

  /* ---------------------------------------------------------------
     7) DRAWER — DIRECTORIO DE SALAS (accesible: foco atrapado,
        scroll de fondo bloqueado, foco devuelto al cerrar)
  --------------------------------------------------------------- */
  const navToggle = document.getElementById('navToggle');
  const drawer = document.getElementById('roomDrawer');
  const drawerClose = document.getElementById('drawerClose');
  const drawerScrim = document.getElementById('drawerScrim');
  const navHome = document.getElementById('navHome');
  const startTour = document.getElementById('startTour');

  function getFocusableInDrawer(){
    return Array.from(drawer.querySelectorAll('a[href], button:not([disabled])'));
  }

  function openDrawer(){
    drawer.classList.add('is-open');
    drawerScrim.classList.add('is-visible');
    drawerScrim.setAttribute('aria-hidden', 'false');
    navToggle.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    drawerClose.focus();
    document.addEventListener('keydown', trapFocus);
  }
  function closeDrawer({ returnFocus = true } = {}){
    drawer.classList.remove('is-open');
    drawerScrim.classList.remove('is-visible');
    drawerScrim.setAttribute('aria-hidden', 'true');
    navToggle.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', trapFocus);
    if (returnFocus) navToggle.focus();
  }
  function trapFocus(e){
    if (e.key === 'Escape'){
      closeDrawer();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = getFocusableInDrawer();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first){
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last){
      e.preventDefault(); first.focus();
    }
  }

  navToggle.addEventListener('click', () => {
    drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
  });
  drawerClose.addEventListener('click', () => closeDrawer());
  drawerScrim.addEventListener('click', () => closeDrawer());
  // Cierra el drawer al elegir una sala (sin devolver el foco al botón,
  // ya que el foco pasa naturalmente a la sección de destino)
  drawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => closeDrawer({ returnFocus: false }));
  });

  navHome.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });
  if (startTour){
    startTour.addEventListener('click', () => {
      const target = document.getElementById('memorial');
      if (target) target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------------------------------------------------------------
     8) SALA ACTIVA EN EL DIRECTORIO (según posición de scroll)
  --------------------------------------------------------------- */
  const rooms = Array.from(document.querySelectorAll('main section[id]'));
  const drawerLinks = Array.from(drawer.querySelectorAll('a'));

  function updateActiveRoom(){
    const scrollPos = window.scrollY + window.innerHeight * 0.4;
    let currentId = rooms[0] ? rooms[0].id : null;
    for (const room of rooms){
      if (room.offsetTop <= scrollPos){
        currentId = room.id;
      }
    }
    drawerLinks.forEach(link => {
      const isActive = link.getAttribute('href') === '#' + currentId;
      link.classList.toggle('is-active', isActive);
      if (isActive){
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  /* ---------------------------------------------------------------
     9) PARALLAX LIGERO EN SECCIONES CINEMATOGRÁFICAS
  --------------------------------------------------------------- */
  const parallaxEls = Array.from(document.querySelectorAll('.parallax'));

  function updateParallax(){
    if (prefersReducedMotion || parallaxEls.length === 0) return;
    const viewportH = window.innerHeight;
    parallaxEls.forEach(el => {
      const rect = el.parentElement.getBoundingClientRect();
      // Solo calcular si está cerca del viewport (rendimiento)
      if (rect.bottom < -viewportH || rect.top > viewportH * 2) return;
      const speed = parseFloat(el.dataset.speed || '0.2');
      const offset = rect.top * speed;
      el.style.transform = `translate3d(0, ${offset * -1}px, 0) scale(1.15)`;
    });
  }

  /* ---------------------------------------------------------------
     INICIALIZACIÓN
  --------------------------------------------------------------- */
  updateProgress();
  updateNavbar();
  updateToTop();
  updateActiveRoom();
  updateParallax();

})();
