/*********************************************************************
 * Sankey Flow – initSankeyFlow(container, bookings)
 *   · Spinner #1 : Total | Resort | Ciudad
 *   · Spinner #2 : Ambos | Nuevo | Repetido
 *   · 6 botones de categoría
 *   · Etiquetas traducidas al castellano
 *********************************************************************/
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

/* ─────────────────── Categorías (botones) ──────────────────── */
const CATS = [
  { id: 'market_segment',       label: 'Segmento de mercado' },
  { id: 'distribution_channel', label: 'Canal de distribución' },
  { id: 'deposit_type',         label: 'Tipo de depósito' },
  { id: 'reservation_status',   label: 'Estado de reserva' },
  { id: 'meal',                 label: 'Plan de comidas'      },
  { id: 'lead_band',            label: 'Antelación (franjas)' }
];

/* ─────────────────── Diccionario de etiquetas ──────────────── */
const LABELS = {
  /* reservation_status */
  'Canceled'  : 'Cancelada',
  'Check-Out' : 'Estancia completada',
  'No-Show'   : 'No presentado',

  /* destino (nuevo / repetido) */
  'Nuevo'     : 'Cliente nuevo',
  'Repetido'  : 'Cliente repetido',

  /* market_segment */
  'Direct'         : 'Directo',
  'Corporate'      : 'Corporativo',
  'Online TA'      : 'Agencia online',
  'Offline TA/TO'  : 'Agencia/offline',
  'Complementary'  : 'Complementario',
  'Groups'         : 'Grupos',
  'Undefined'      : 'Indefinido',
  'Aviation'       : 'Aerolínea',

  /* distribution_channel */
  'TA/TO'    : 'Agencia',
  'GDS'      : 'GDS',

  /* deposit_type */
  'No Deposit' : 'Sin depósito',
  'Refundable' : 'Reembolsable',
  'Non Refund' : 'No reembolsable',

  /* meal */
  'BB' : 'Solo desayuno',
  'HB' : 'Media pensión',
  'FB' : 'Pensión completa',
  'SC' : 'Sin comidas'
};

/* ─────────────────── Spinner hotel → valor CSV ─────────────── */
const HOTEL_VALUE = {
  Total  : 'Total',
  Resort : 'Resort Hotel',
  Ciudad : 'City Hotel'
};

/* ─────────────────── lead_time → banda ─────────────────────── */
const leadBand = t =>
      (t = +t) <=   7 ? '0-7 días'
    : t <=  30 ? '8-30 días'
    : t <=  90 ? '31-90 días'
    :            '≥ 91 días';

/* ===================================================================== */
export function initSankeyFlow(container, data) {
  if (!container) return;
  if (!data?.length) {
    container.textContent = 'Sin datos.'; return;
  }

  /* Añadimos banda de antelación si falta */
  data.forEach(d => { d.lead_band ??= leadBand(d.lead_time); });

  /* ───── Layout base ───── */
  const wrap  = d3.select(container).html('').append('div').attr('class','sf-wrap');
  const chart = wrap.append('div').attr('class','sf-chart');
  const pnl   = wrap.append('div').attr('class','sf-controls');

  /* === Spinner 1: Hotel ======================================== */
  pnl.append('label').text('Hotel: ');
  const hotelSel = pnl.append('select');
  hotelSel.selectAll('option')
    .data(['Total','Resort','Ciudad'])
    .join('option')
      .attr('value', d => d)
      .text(d => d);

  /* === Spinner 2: Tipo de cliente ============================== */
  pnl.append('label').style('margin-top','0.8rem').text('Cliente: ');
  const guestSel = pnl.append('select');
  guestSel.selectAll('option')
    .data(['Ambos','Nuevo','Repetido'])
    .join('option')
      .attr('value', d => d)
      .text(d => d);

  pnl.append('hr');

  /* === Botones de categoría ==================================== */
  pnl.append('p').text('Categoría:');
  const btnBox = pnl.append('div').attr('class','sf-cat-box');
  btnBox.selectAll('button')
    .data(CATS)
    .join('button')
      .text(d => d.label)
      .attr('data-cat', d => d.id)
      .on('click', function (_, d) {
        btnBox.selectAll('button').classed('active', false);
        d3.select(this).classed('active', true);
        draw(d.id, hotelSel.property('value'), guestSel.property('value'));
      })
    .filter((_, i) => i === 0)      /* primer botón activo */
      .classed('active', true);

  /* === SVG ====================================================== */
  const W = 760, H = 440;            // un poco más ancho / alto
  const svg = chart.append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('width',  '100%')
    .attr('height', H);

  const color = d3.scaleOrdinal(d3.schemeTableau10);

  /* ---------------- draw(cat, hotel, cliente) ------------------ */
  function draw(cat, hotelLabel, guestFilter) {
    /* 1 · filtro hotel */
    let rows = hotelLabel === 'Total'
      ? data
      : data.filter(r => r.hotel === HOTEL_VALUE[hotelLabel]);

    /* 2 · filtro cliente */
    if (guestFilter === 'Nuevo')
      rows = rows.filter(r => +r.is_repeated_guest === 0);
    else if (guestFilter === 'Repetido')
      rows = rows.filter(r => +r.is_repeated_guest === 1);

    /* 3 · construir links */
    const links = d3.rollups(
      rows,
      v => v.length,
      d => d[cat] ?? 'Sin datos',
      d => d.is_repeated_guest ? 'Repetido' : 'Nuevo'
    ).flatMap(([src, arr]) =>
        arr.map(([tgt, val]) => ({
          source: LABELS[src] ?? src,
          target: LABELS[tgt] ?? tgt,
          value : val
        }))
    );

    const nodes = Array.from(
      new Set(links.flatMap(l => [l.source, l.target]))
    ).map(name => ({ name }));

    const sk = sankey()
      .nodeId(d => d.name)
      .nodeWidth(18)
      .nodePadding(12)
      .extent([[0,0],[W,H]]);

    const { nodes: N, links: L } = sk({ nodes, links });

    svg.selectAll('*').remove();

    svg.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.45)
      .selectAll('path')
      .data(L)
      .join('path')
        .attr('d', sankeyLinkHorizontal())
        .attr('stroke', d => color(d.source.name))
        .attr('stroke-width', d => Math.max(1, d.width))
      .append('title')
        .text(d => `${d.source.name} → ${d.target.name}\n${d.value} reservas`);

    const node = svg.append('g')
      .selectAll('g')
      .data(N)
      .join('g')
        .attr('transform', d => `translate(${d.x0},${d.y0})`);

    node.append('rect')
        .attr('height', d => d.y1 - d.y0)
        .attr('width',  sk.nodeWidth())
        .attr('fill',  d => color(d.name));

    node.append('text')
        .attr('x', d => d.x0 < W/2 ? sk.nodeWidth()+6 : -6)
        .attr('y', d => (d.y1-d.y0)/2)
        .attr('dy','0.35em')
        .attr('text-anchor', d => d.x0 < W/2 ? 'start' : 'end')
        .attr('font-size', 11)
        .text(d => `${d.name} (${d.value})`);
  }

  /* === Listeners spinners ====================================== */
  hotelSel.on('change', () => {
    const cat = btnBox.select('button.active').attr('data-cat');
    draw(cat, hotelSel.property('value'), guestSel.property('value'));
  });

  guestSel.on('change', () => {
    const cat = btnBox.select('button.active').attr('data-cat');
    draw(cat, hotelSel.property('value'), guestSel.property('value'));
  });

  /* === Render inicial ========================================== */
  draw('market_segment', hotelSel.property('value'), guestSel.property('value'));
}
