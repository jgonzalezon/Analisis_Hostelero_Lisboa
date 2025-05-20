// src/visuals/bubbleScatter.js
// -----------------------------------------------------------------------------
// Bubble scatter: lead_time (en buckets de N días) vs tasa de cancelación
//  · X = bucket de N días (configurable de 1 a 30)
//  · Y = tasa de cancelación (%)
//  · radio = número de reservas
//  · color = tipo de hotel (Ciudad vs Resort)
//  · incluye leyenda y control deslizante
// -----------------------------------------------------------------------------
import * as d3 from 'd3';

export function initBubbleScatter(container, data) {
  if (!container) return;
  if (!data?.length) {
    container.textContent = 'Sin datos.';
    return;
  }
  container.innerHTML = '';

  // dimensiones base
  const { width: cw } = container.getBoundingClientRect();
  const margin = { top: 40, right: 160, bottom: 50, left: 60 };
  const width  = cw - margin.left - margin.right;
  const height = (cw * 0.6) - margin.top - margin.bottom;

  // contenedor para slider + valor
  const ctrl = d3.select(container)
    .append('div')
      .style('display', 'flex')
      .style('justify-content', 'flex-end')
      .style('align-items', 'center')
      .style('gap', '0.5rem')
      .style('margin-bottom', '0.25rem');

  ctrl.append('label')
      .text('Bucket X días:')
      .style('font-size', '0.9rem');

  const slider = ctrl.append('input')
      .attr('type', 'range')
      .attr('min', 1)
      .attr('max', 30)
      .attr('value', 5)
      .style('width', '140px');

  const sliderVal = ctrl.append('span')
      .text('5 días')
      .style('font-size', '0.9rem')
      .style('font-weight', '600');

  // SVG principal
  const svg = d3.select(container)
    .append('svg')
      .attr('viewBox', [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
      .attr('preserveAspectRatio', 'xMidYMid meet')
    .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

  // tooltip
  const tooltip = d3.select('body')
    .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);

  // configuración de colores
  const hotelTypes  = ['City Hotel','Resort Hotel'];
  const hotelLabels = { 'City Hotel':'Ciudad','Resort Hotel':'Resort' };
  const color = d3.scaleOrdinal()
    .domain(hotelTypes)
    .range(['#006d77','#e63946']);

  // EPS para rótulos
  const pad = 0.5;

  // función de redibujo
  function draw(nDays) {
    sliderVal.text(`${nDays} día${nDays>1?'s':''}`);

    // bucketizar
    data.forEach(d => {
      d.lead = Math.floor(+d.lead_time / nDays) * nDays;
    });

    // agregación [bucket][hotel]
    const agg = d3.rollup(
      data,
      v => {
        const total    = v.length;
        const canceled = v.filter(d=>d.reservation_status==='Canceled').length;
        return {
          total,
          cancelRate: total? canceled/total : 0
        };
      },
      d => d.lead,
      d => d.hotel
    );

    // flatten a array de puntos
    const points = [];
    for (const [lead, mapHotel] of agg) {
      for (const [hotel, m] of mapHotel) {
        points.push({
          lead,
          hotel,
          total: m.total,
          cancelRate: m.cancelRate
        });
      }
    }

    // escalas
    const x = d3.scaleLinear()
      .domain(d3.extent(points, d=>d.lead))
      .nice()
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(points, d=>d.cancelRate)])
      .nice()
      .range([height, 0]);

    const r = d3.scaleSqrt()
      .domain([0, d3.max(points, d=>d.total)])
      .range([2, 20]);

    // limpiar y ejes
    svg.selectAll('*').remove();

    const xAxis = d3.axisBottom(x)
      .ticks(Math.min(10, Math.ceil(width/60)))
      .tickFormat(d => `${d}–${d + (nDays-1)}d`);

    const yAxis = d3.axisLeft(y)
      .ticks(6)
      .tickFormat(d3.format('.0%'));

    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
      .append('text')
        .attr('x', width/2)
        .attr('y', 40)
        .attr('fill', '#333')
        .attr('text-anchor', 'middle')
        .text(`Antelación (intervalos de ${nDays} días)`);

    svg.append('g')
        .call(yAxis)
      .append('text')
        .attr('x', -margin.left + 4)
        .attr('y', -10)
        .attr('fill', '#333')
        .attr('text-anchor', 'start')
        .text('Tasa de cancelación');

    // burbujas
    svg.append('g')
      .selectAll('circle')
      .data(points)
      .join('circle')
        .attr('cx', d=> x(d.lead))
        .attr('cy', d=> y(d.cancelRate))
        .attr('r',  d=> r(d.total))
        .attr('fill', d=> color(d.hotel))
        .attr('opacity', 0.75)
      .on('mouseover', (ev,d) => {
        tooltip
          .html(`
            <strong>${d.lead}–${d.lead + nDays - 1} días</strong><br/>
            Hotel: ${hotelLabels[d.hotel]}<br/>
            Tasa cancel.: ${(d.cancelRate*100).toFixed(1)}%<br/>
            Reservas: ${d.total.toLocaleString()}
          `)
          .style('left', `${ev.pageX+10}px`)
          .style('top',  `${ev.pageY-28}px`)
          .style('opacity', 1);
      })
      .on('mousemove', ev => {
        tooltip
          .style('left', `${ev.pageX+10}px`)
          .style('top',  `${ev.pageY-28}px`);
      })
      .on('mouseout', () => tooltip.style('opacity', 0));

    // leyenda
    const legend = svg.append('g')
      .attr('transform', `translate(${width+20}, 0)`);

    hotelTypes.forEach((ht,i) => {
      const y0 = i*24;
      legend.append('rect')
        .attr('x', 0).attr('y', y0)
        .attr('width', 16).attr('height', 16)
        .attr('fill', color(ht));
      legend.append('text')
        .attr('x', 24).attr('y', y0+12)
        .attr('font-size', '0.9rem')
        .text(hotelLabels[ht]);
    });
  }

  // primera llamada
  draw(+slider.property('value'));

  // evento slider
  slider.on('input', () => {
    draw(+slider.property('value'));
  });
}
