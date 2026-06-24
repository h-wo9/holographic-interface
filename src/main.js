import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createUniverse } from './scene.js';

gsap.registerPlugin(ScrollTrigger);

const canvas = document.getElementById('bg-canvas');
const universe = createUniverse(canvas);

/* ---------- loader ---------- */
const loader = document.getElementById('loader');
const loaderPct = document.querySelector('.loader-pct');

function revealGroup(elements, stagger = 110, baseDelay = 0) {
  elements.forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), baseDelay + i * stagger);
  });
}

let progress = 0;
const loaderInterval = setInterval(() => {
  progress += Math.random() * 22;
  if (progress >= 100) {
    progress = 100;
    loaderPct.textContent = '100%';
    clearInterval(loaderInterval);
    setTimeout(() => {
      loader.classList.add('hidden');
      revealGroup(document.querySelectorAll('.hero [data-reveal]'), 120, 150);
    }, 300);
  } else {
    loaderPct.textContent = `${Math.floor(progress)}%`;
  }
}, 130);

/* ---------- reveal on scroll ---------- */
document.querySelectorAll('.features, .cta').forEach((section) => {
  const els = section.querySelectorAll('[data-reveal]');
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealGroup(Array.from(els));
          io.disconnect();
        }
      });
    },
    { threshold: 0.25 }
  );
  io.observe(section);
});

/* ---------- custom cursor ---------- */
const cursorDot = document.getElementById('cursor-dot');
const cursorRing = document.getElementById('cursor-ring');
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let ringX = mouseX;
let ringY = mouseY;

window.addEventListener('pointermove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
});

function animateCursor() {
  ringX += (mouseX - ringX) * 0.18;
  ringY += (mouseY - ringY) * 0.18;
  cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
  requestAnimationFrame(animateCursor);
}
animateCursor();

document.querySelectorAll('[data-hover]').forEach((el) => {
  el.addEventListener('mouseenter', () => cursorRing.classList.add('active'));
  el.addEventListener('mouseleave', () => cursorRing.classList.remove('active'));
});

/* ---------- card tilt ---------- */
document.querySelectorAll('[data-tilt]').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(800px) rotateX(${-py * 10}deg) rotateY(${px * 14}deg) translateZ(10px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});

/* ---------- showcase cinematic flythrough ---------- */
const panels = document.querySelectorAll('.showcase-panel');

ScrollTrigger.create({
  trigger: '.showcase',
  start: 'top top',
  end: 'bottom bottom',
  scrub: true,
  onUpdate(self) {
    const p = self.progress;
    const idx = Math.min(panels.length - 1, Math.floor(p * panels.length));
    panels.forEach((panel, i) => panel.classList.toggle('active', i === idx));

    universe.setCameraTarget({
      x: Math.sin(p * Math.PI * 2) * 0.6,
      y: Math.cos(p * Math.PI * 1.5) * 0.3,
      z: gsap.utils.interpolate(8, -2, p),
    });
    universe.setScrollRotation(p);
  },
});

ScrollTrigger.create({
  trigger: '#protocol',
  start: 'top center',
  onEnter: () => universe.setCameraTarget({ x: 0, y: 0, z: 9 }),
});
