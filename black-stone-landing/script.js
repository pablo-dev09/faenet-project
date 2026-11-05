const hero = document.querySelector('.hero');

if (hero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const updateHero = () => {
    const progress = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
    hero.style.setProperty('--hero-shift', String(progress));
  };
  updateHero();
  window.addEventListener('scroll', updateHero, { passive: true });
}
