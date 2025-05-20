import './style.css';

// Carga perezosa de cada visualización — garantiza que
// D3 y librerías pesadas se importen solo cuando se necesitan.
const VIS_CONFIG = [
  {
    hash: '#choropleth',
    loader: () => import('./visuals/choropleth.js').then(m => m.initChoropleth)
  },
  {
    hash: '#sankey',
    loader: () => import('./visuals/sankeyFlow.js').then(m => m.initSankeyFlow)
  },
  {
    hash: '#scatter',
    loader: () => import('./visuals/bubbleScatter.js').then(m => m.initBubbleScatter)
  }
];

/**
 * Instancia la visualización cuyo contenedor se encuentre en pantalla.
 */
function bootstrapVisual(hash) {
  const config = VIS_CONFIG.find(v => v.hash === hash);
  if (!config || config.initialized) return;

  const section = document.querySelector(hash);
  if (!section) return;

  config.loader().then(init => {
    init(section.querySelector('.viz-container'));
    config.initialized = true;
  });
}

// Trigger inicial al cargar la página
window.addEventListener('DOMContentLoaded', () => {
  bootstrapVisual(location.hash || '#choropleth');
});

// Trigger cuando el usuario navega con anclas o cambia la URL
window.addEventListener('hashchange', () => {
  bootstrapVisual(location.hash);
});

// *Opcional*: observador de intersección para autoinicializar
// al hacer scroll, si prefieres la experiencia “scrollytelling”.
