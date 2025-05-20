// src/visuals/choropleth.js
// -----------------------------------------------------------------------------
// Choropleth + controles (Año + 3 métricas) + Top-5 + brush
//  – Portugal en azul
//  – Visitantes / Ingresos totales / Ingresos por visita
// -----------------------------------------------------------------------------
import * as d3 from 'd3';

const PORTUGAL_COLOR = '#1e7aff';
const MAP_RATIO      = 0.58;

/* ──────────── Estado global ─────────────────────────────────────────────── */
let csv, world, YEARS, countryName;
let selectedYear, dayMin = 1, dayMax = 365;
let metric = 'total';         // 'total' | 'revenue' | 'revenuePer'
let byCountry = new Map();

/* ──────────── Init ──────────────────────────────────────────────────────── */
export function initChoropleth(container, world, csv) {

  container.classList.add('choropleth-layout');

  /* 1· Panel de controles + Top-5  ---------------------------------------- */
  const panel = document.createElement('div');
  panel.className = 'stats-panel';
  panel.innerHTML = `
    <div class="controls">
      <div class="year-select">
        Año: <select id="yearSel"></select>
      </div>
      <div class="metric-buttons">
        <button data-metric="total"      class="active">Visitantes</button>
        <button data-metric="revenue">Ingresos totales</button>
        <button data-metric="revenuePer">Ingresos/visita</button>
      </div>
    </div>
    <div class="top5">
      <h3>Top 5 países</h3>
      <ul id="topList"></ul>
    </div>`;
  container.appendChild(panel);

  /* 2· Mapa --------------------------------------------------------------- */
  const mapWrap = document.createElement('div');
  mapWrap.className = 'choro-map';
  container.appendChild(mapWrap);

  /* 3· Leyenda ------------------------------------------------------------ */
  const legendWrap = document.createElement('div');
  legendWrap.className = 'legend-wrap';
  container.appendChild(legendWrap);

  /* 4· Brush -------------------------------------------------------------- */
  const timelineWrap = document.createElement('div');
  timelineWrap.className = 'timeline-wrap';
  container.appendChild(timelineWrap);

  /* ─── Carga de datos ──────────────────────────────────────────────────── */


  countryName   = new Map(world.features.map(f => [f.id, f.properties.name]));
  YEARS         = Array.from(new Set(csv.map(d => +d.arrival_date_year))).sort();
  selectedYear  = YEARS[0];

  /* ─── Poblamos selector de Año ────────────────────────────────────────── */
  const yearSel   = panel.querySelector('#yearSel');
  const metricBtns= panel.querySelectorAll('.metric-buttons button');

  YEARS.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSel.appendChild(opt);
  });
  yearSel.value = selectedYear;

  /* ─── SVG principal (mapa + leyenda) ─────────────────────────────────── */
  const fullW = mapWrap.getBoundingClientRect().width;
  const mapH  = fullW * MAP_RATIO;

  const svg = d3.select(mapWrap).append('svg')
                .attr('viewBox', [0, 0, fullW, mapH + 60])
                .attr('preserveAspectRatio', 'xMidYMid meet');

  /* Tooltip -------------------------------------------------------------- */
  const tooltip = d3.select('body').append('div').attr('class', 'tooltip');

  /* Proyección + Países --------------------------------------------------- */
  const projection = d3.geoNaturalEarth1().fitSize([fullW, mapH], world);
  const path       = d3.geoPath(projection);

  const countries = svg.append('g')
    .selectAll('path')
    .data(world.features)
    .join('path')
      .attr('d', path)
      .attr('fill', '#eee')
      .attr('stroke', '#777')
      .attr('stroke-width', .35);

  countries
    .on('mousemove', (e,f) => {
      const r = byCountry.get(f.id) || {total:0,resort:0,city:0,revenue:0,revenuePer:0};
      tooltip.html(`
        <strong>${countryName.get(f.id)??f.id}</strong><br/>
        Total visitas: ${r.total}<br/>
        Resort: ${r.resort}<br/>
        Ciudad: ${r.city}<br/>
        Ingresos: ${r.revenue.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}<br/>
        €/visita: ${r.revenuePer.toFixed(2)}
      `)
      .style('left',`${e.pageX+12}px`)
      .style('top', `${e.pageY-28}px`)
      .style('opacity',.95);
    })
    .on('mouseout', () => tooltip.style('opacity',0));

  /* Escalas de color ------------------------------------------------------ */
  const mapColor  = d3.scaleSequential(d3.interpolateYlOrRd);
  const heatColor = d3.scaleSequential(d3.interpolateYlOrRd);

  /* Leyenda --------------------------------------------------------------- */
  const LEG_W = Math.min(480, fullW*0.75), LEG_H = 18, LEG_Y = mapH+12;
  const legendG = svg.append('g')
    .attr('class','map-legend')
    .attr('transform',`translate(${(fullW-LEG_W)/2},${LEG_Y})`);
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient')
    .attr('id','legendGrad').attr('x1','0%').attr('x2','100%')
    .attr('y1','0%').attr('y2','0%');
  grad.selectAll('stop')
    .data(d3.range(0,1.01,0.02))
    .enter().append('stop')
      .attr('offset',d=>`${d*100}%`)
      .attr('stop-color',d=>d3.interpolateYlOrRd(d));

  legendG.append('rect')
    .attr('width',LEG_W).attr('height',LEG_H)
    .attr('fill','url(#legendGrad)')
    .attr('stroke','#444').attr('stroke-width',.6);

  const legendScale = d3.scaleLinear().range([0,LEG_W]);
  const legendAxis  = legendG.append('g')
    .attr('class','legend-axis')
    .attr('transform',`translate(0,${LEG_H+6})`);

  /* Time-line + Brush ----------------------------------------------------- */
  const TL_W = fullW-80, TL_H = 14;
  const timelineSvg = d3.select(timelineWrap).append('svg')
                        .attr('width',TL_W)
                        .attr('height',TL_H+34);
  const heatG  = timelineSvg.append('g').attr('transform','translate(0,20)');
  const monthG = timelineSvg.append('g');
  const rangeLbl = timelineWrap.appendChild(document.createElement('div'));
  rangeLbl.className = 'range-label';

  const dayScale = d3.scaleLinear().domain([1,365]).range([0,TL_W]);
  const brush = d3.brushX()
    .extent([[0,20],[TL_W,20+TL_H]])
    .handleSize(8)
    .on('end', ({selection})=>{
      if(!selection) return;
      [dayMin, dayMax] = selection.map(x=> Math.round(dayScale.invert(x)));
      update();
    });

  /* ─── Funciones ───────────────────────────────────────────────────────── */
  function aggregate(year,d0,d1){
    const s=new Date(year,0,d0), e=new Date(year,0,d1);
    const sub=csv.filter(d=>d.arrivalDate>=s&&d.arrivalDate<=e);
    return d3.rollup(
      sub,
      v=>{
        const total = v.length;
        const resort= v.filter(x=>x.hotel==='Resort Hotel').length;
        const city  = v.filter(x=>x.hotel==='City Hotel').length;
        const revenue = d3.sum(v, x=>x.stays * x.adr);
        return {
          total,
          resort,
          city,
          revenue,
          revenuePer: total? revenue/total : 0
        };
      },
      d=>d.country
    );
  }

  function drawHeat(year){
    const counts = d3.rollups(
      csv.filter(d=>+d.arrival_date_year===year),
      v=>v.length,
      d=>Math.floor((d.arrivalDate-new Date(year,0,0))/864e5)
    );
    const daily = d3.range(1,366).map(day=>{
      const rec = counts.find(([k])=>k===day);
      return {day,val:rec?rec[1]:0};
    });
    heatColor.domain([0,d3.max(daily,d=>d.val)||1]);
    heatG.selectAll('rect')
      .data(daily).join('rect')
        .attr('x',d=>dayScale(d.day))
        .attr('width',Math.max(1,TL_W/365))
        .attr('height',TL_H)
        .attr('fill',d=>heatColor(d.val));

    const months=[
      {n:'Ene',d:1},{n:'Feb',d:32},{n:'Mar',d:60},{n:'Abr',d:91},
      {n:'May',d:121},{n:'Jun',d:152},{n:'Jul',d:182},{n:'Ago',d:213},
      {n:'Sep',d:244},{n:'Oct',d:274},{n:'Nov',d:305},{n:'Dic',d:335}
    ];
    monthG.selectAll('*').remove();
    monthG.selectAll('line')
      .data(months).join('line')
        .attr('x1',d=>dayScale(d.d)).attr('x2',d=>dayScale(d.d))
        .attr('y1',0).attr('y2',20+TL_H)
        .attr('stroke','#bbb').attr('stroke-width',.6);
    monthG.selectAll('text')
      .data(months).join('text')
        .attr('x',d=>dayScale(d.d)+2).attr('y',12)
        .attr('font-size','8px').text(d=>d.n);
  }

  function update(){
    byCountry = aggregate(selectedYear,dayMin,dayMax);

    const getVal = r => metric==='revenue'?r.revenue
                     : metric==='revenuePer'? r.revenuePer
                     : r.total;

    const vals = Array.from(byCountry)
      .filter(([c])=>c!=='PRT')
      .map(([,r])=>getVal(r));
    mapColor.domain([0,d3.max(vals)||1]);

    countries.transition().duration(350)
      .attr('fill',d=>{
        if(d.id==='PRT') return PORTUGAL_COLOR;
        const r = byCountry.get(d.id);
        return r? mapColor(getVal(r)) : '#eee';
      });

    /* Top-5 ------------------------------------------------------------- */
    const list = panel.querySelector('#topList');
    list.innerHTML='';
    Array.from(byCountry)
      .sort((a,b)=>getVal(b[1])-getVal(a[1]))
      .slice(0,5)
      .forEach(([c,r])=>{
        const disp = metric==='revenue'
          ? r.revenue.toLocaleString('es-ES',{style:'currency',currency:'EUR'})
          : metric==='revenuePer'
            ? r.revenuePer.toFixed(2)
            : r.total;
        list.insertAdjacentHTML('beforeend',
          `<li><span class="country">${countryName.get(c)??c}</span>
               <span class="count">${disp}</span></li>`);
      });

    /* Leyenda ----------------------------------------------------------- */
    legendScale.domain([0,d3.max(vals)||1]);
    legendAxis.call(d3.axisBottom(legendScale).ticks(4).tickSize(3))
      .selectAll('text').attr('font-size','8px');

    /* Etiqueta rango ---------------------------------------------------- */
    rangeLbl.textContent =
      `${fmt(selectedYear,dayMin)} → ${fmt(selectedYear,dayMax)}`;
  }

  /* ─── Listeners ──────────────────────────────────────────────────────── */
  yearSel.addEventListener('change', e=>{
    selectedYear = +e.target.value;
    dayMin=1; dayMax=365;
    drawHeat(selectedYear);
    update();
    timelineSvg.select('.brush').call(brush.move,[0,TL_W]);
  });

  metricBtns.forEach(btn=>{
    btn.addEventListener('click',()=>{
      metricBtns.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      metric = btn.dataset.metric;
      update();
    });
  });

  /* ─── Render inicial ─────────────────────────────────────────────────── */
  drawHeat(selectedYear);
  update();
  timelineSvg.append('g')
    .attr('class','brush')
    .call(brush)
    .call(brush.move,[0,TL_W]);

  function fmt(y,d){
    return new Date(y,0,d).toLocaleDateString('es-ES',{day:'2-digit',month:'short'});
  }
}
