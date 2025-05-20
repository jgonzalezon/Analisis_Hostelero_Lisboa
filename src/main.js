/* src/main.js ------------------------------------------------------------- */
import './style.css';
import * as d3 from 'd3';

/* ── 1) Descarga única de datos ────────────────────────────────────────── */
const DATA_PROMISE = Promise.all([
  d3.json('./data/countries.geo.json'),
  d3.csv('./data/hotel_bookings_clean.csv', d => {
    d.arrivalDate = new Date(d.dia);
    d.adr         = +d.adr;
    d.stays       = +d.stays_in_weekend_nights + +d.stays_in_week_nights;
    d.is_repeated_guest = +d.is_repeated_guest;
    return d;
  })
]).then(([world, bookings]) => ({ world, bookings }));

/* ── 2) Config. de visualizaciones  (lazy-load) ───────────────────────── */
const VIS_CONFIG = [
  {
    hash   : '#choropleth',
    loader : () => import('./visuals/choropleth.js').then(m => m.initChoropleth),
    needs  : 'both'          // world + bookings
  },
  {
    hash   : '#sankey',
    loader : () => import('./visuals/sankeyFlow.js').then(m => m.initSankeyFlow),
    needs  : 'bookings'      // sólo CSV
  },
  {
    hash   : '#scatter',
    loader : () => import('./visuals/bubbleScatter.js').then(m => m.initBubbleScatter),
    needs  : 'bookings'
  }
];

/* ── 3) Bootstrap de la sección activa ─────────────────────────────────── */
async function bootstrapVisual (hash) {
  const cfg = VIS_CONFIG.find(v => v.hash === hash);
  if (!cfg || cfg.initialized) return;

  const section   = document.querySelector(hash);
  if (!section)   return;

  const initFn    = await cfg.loader();
  const { world, bookings } = await DATA_PROMISE;

  const target = section.querySelector('.viz-container');
  if (cfg.needs === 'both')      initFn(target, world, bookings);
  else if (cfg.needs === 'bookings') initFn(target, bookings);

  cfg.initialized = true;
}

/* ── 4) Eventos de carga y navegación ─────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  ['#choropleth','#sankey','#scatter'].forEach(bootstrapVisual);
});


window.addEventListener('hashchange', () => {
  bootstrapVisual(location.hash);
});