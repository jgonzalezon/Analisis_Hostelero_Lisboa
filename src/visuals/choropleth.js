// -----------------------------------------------------------------------------
// Choropleth “mapa + leyenda + panel + brush” (layout vertical)
//
//  • Mapa → 100 % del contenedor
//  • Leyenda justo debajo y más visible
//  • Panel Top-5 en un recuadro
//  • Brush ocupa todo el ancho (margen lateral)
//  • Portugal en azul para contrastar
// -----------------------------------------------------------------------------
import * as d3 from 'd3';

const PORTUGAL_COLOR = '#1e7aff';     // ⬅️ azul contraste
const MAP_RATIO      = 0.58;

/* ----- estado ------------------------------------------------------------ */
let selectedYear, dayMin=1, dayMax=365, byCountry=new Map();

/* ======================================================================== */
export async function initChoropleth(container) {

  /* ----- layout de elementos -------------------------------------------- */
  const mapWrap     = div('choro-map');
  const legendWrap  = div('legend-wrap');      // bajo el mapa
  const panelWrap   = div('stats-panel');      // año + top-5
  const timelineWrap= div('timeline-wrap');    // brush ancho

  function div(cls){
    const d = container.appendChild(document.createElement('div'));
    d.className = cls;
    return d;
  }

  /* ----- mapa SVG -------------------------------------------------------- */
  const fullW  = container.getBoundingClientRect().width;  // ancho tarjeta
  const mapH   = fullW * MAP_RATIO;
  const svg    = d3.select(mapWrap).append('svg')
                   .attr('viewBox',[0,0,fullW,mapH])
                   .attr('preserveAspectRatio','xMidYMid meet');

  const tooltip = d3.select('body')
                    .append('div').attr('class','tooltip');

  /* ----- cargas ---------------------------------------------------------- */
  const [world,csv] = await Promise.all([
    d3.json('./data/countries.geo.json'),
    d3.csv('./data/hotel_bookings_clean.csv',d=>{
      d.arrivalDate=new Date(d.dia);
      return d;
    })
  ]);

  const YEARS = Array.from(new Set(csv.map(d=>+d.arrival_date_year))).sort();
  selectedYear = YEARS[0];

  const countryName = new Map(world.features.map(f=>[f.id,f.properties.name]));

  /* ----------  panel (año + top-5) -------------------------------------- */
  panelWrap.innerHTML = `
    <div class="year-select">
      Año:
      <select id="yearSel"></select>
    </div>
    <div class="top5">
      <h3>Top 5 países</h3>
      <ul id="topList"></ul>
    </div>
  `;
  const yearSel = panelWrap.querySelector('#yearSel');
  YEARS.forEach(y=>yearSel.insertAdjacentHTML('beforeend',`<option>${y}</option>`));
  yearSel.value = selectedYear;

  /* ----------  timeline (heat-map + brush) ------------------------------ */
  const TL_W = fullW - 80;         // margen 40 px a cada lado
  const TL_H = 14;

  const timelineSvg = d3.select(timelineWrap).append('svg')
                        .attr('width',TL_W)
                        .attr('height',TL_H+34);  // espacio para meses

  const heatG   = timelineSvg.append('g').attr('transform','translate(0,20)');
  const monthG  = timelineSvg.append('g');
  const rangeLbl= timelineWrap.appendChild(document.createElement('div'));
  rangeLbl.className='range-label';

  const dayScale = d3.scaleLinear().domain([1,365]).range([0,TL_W]);

  const brush = d3.brushX()
                  .extent([[0,20],[TL_W,20+TL_H]])
                  .handleSize(8)
                  .on('end',brushed);

  /* ----------  proyección y path ---------------------------------------- */
  const projection = d3.geoNaturalEarth1().fitSize([fullW,mapH],world);
  const path       = d3.geoPath(projection);

  const countries = svg.append('g')
    .selectAll('path').data(world.features).join('path')
      .attr('d',path)
      .attr('fill','#eee')
      .attr('stroke','#777').attr('stroke-width',.35);

  countries
    .on('mousemove',(e,d)=>{
      const r = byCountry.get(d.id)||{total:0,resort:0,city:0};
      tooltip.html(`
        <strong>${countryName.get(d.id)??d.id}</strong><br/>
        Total: ${r.total}<br/>Resort: ${r.resort}<br/>Ciudad: ${r.city}
      `)
      .style('left',`${e.pageX+12}px`)
      .style('top', `${e.pageY-30}px`)
      .style('opacity',.95);
    })
    .on('mouseout',()=>tooltip.style('opacity',0));

  /* ----------  escalas de color ----------------------------------------- */
  const mapCol   = d3.scaleSequential(d3.interpolateYlOrRd);
  const heatCol  = d3.scaleSequential(d3.interpolateYlOrRd);


/* ----------  LEYENDA  ----------------------------- */
const LEG_W = Math.min(480, fullW * 0.75);    // hasta 480 px
const LEG_H = 18;                             // barra más ancha
const LEG_Y = mapH + 12;                      // 12 px bajo el mapa

//   1) ampliamos la altura real del SVG para que quepa la leyenda
svg.attr('viewBox', [0, 0, fullW, mapH + 60]);

const legendG = svg.append('g')
  .attr('class', 'map-legend')
  .attr('transform', `translate(${(fullW - LEG_W) / 2}, ${LEG_Y})`);

// gradiente ---------------------------------------------------------------
const defs = svg.append('defs');
const grad = defs.append('linearGradient')
  .attr('id', 'legendGrad')
  .attr('x1', '0%').attr('x2', '100%')
  .attr('y1', '0%').attr('y2', '0%');

grad.selectAll('stop')
  .data(d3.range(0, 1.01, 0.02))
  .enter().append('stop')
    .attr('offset', d => `${d * 100}%`)
    .attr('stop-color', d => d3.interpolateYlOrRd(d));

legendG.append('rect')
  .attr('width', LEG_W)
  .attr('height', LEG_H)
  .attr('fill', 'url(#legendGrad)')
  .attr('stroke', '#444')
  .attr('stroke-width', 0.6);

// escala & ejes -----------------------------------------------------------
const legendScale = d3.scaleLinear().range([0, LEG_W]);
const legendAxis  = legendG.append('g')
                           .attr('transform', `translate(0, ${LEG_H + 6})`)
                           .attr('class', 'legend-axis');

  /* ----------  helpers --------------------------------------------------- */
  const months=[
    {n:'Ene',d:1},{n:'Feb',d:32},{n:'Mar',d:60},{n:'Abr',d:91},{n:'May',d:121},
    {n:'Jun',d:152},{n:'Jul',d:182},{n:'Ago',d:213},{n:'Sep',d:244},
    {n:'Oct',d:274},{n:'Nov',d:305},{n:'Dic',d:335}
  ];

  function agg(y,d0,d1){
    const s=new Date(y,0,d0), e=new Date(y,0,d1);
    const sub=csv.filter(d=>d.arrivalDate>=s&&d.arrivalDate<=e);
    return d3.rollup(
      sub,
      v=>({total:v.length,
           resort:v.filter(x=>x.hotel==='Resort Hotel').length,
           city  :v.filter(x=>x.hotel==='City Hotel').length}),
      d=>d.country
    );
  }

  function fmtDay(y,d){
    return new Date(y,0,d).toLocaleDateString('es-ES',{day:'2-digit',month:'short'});
  }

  function drawHeat(y){
    const cts=d3.rollups(
      csv.filter(d=>+d.arrival_date_year===y),
      v=>v.length,
      d=>Math.floor((d.arrivalDate-new Date(y,0,0))/864e5)
    );
    const daily=d3.range(1,366).map(d=>{
      const r=cts.find(([k])=>k===d); return {day:d,val:r?r[1]:0};
    });
    heatCol.domain([0,d3.max(daily,d=>d.val)||1]);
    heatG.selectAll('rect')
         .data(daily)
         .join('rect')
           .attr('x',d=>dayScale(d.day))
           .attr('width',Math.max(1,TL_W/365))
           .attr('height',TL_H)
           .attr('fill',d=>heatCol(d.val));

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
    byCountry = agg(selectedYear,dayMin,dayMax);

    /* mapa */
    const vals=Array.from(byCountry).filter(([c])=>c!=='PRT').map(([,v])=>v.total);
    mapCol.domain([0,d3.max(vals)||1]);
    countries.transition().duration(350)
      .attr('fill',d=>{
        if(d.id==='PRT') return PORTUGAL_COLOR;
        const r=byCountry.get(d.id); return r?mapCol(r.total):'#eee';
      });

    /* top-5 */
    const list=panelWrap.querySelector('#topList'); list.innerHTML='';
    Array.from(byCountry).sort((a,b)=>b[1].total-a[1].total).slice(0,5)
      .forEach(([c,v])=>{
        list.insertAdjacentHTML('beforeend',
          `<li><span class="country">${countryName.get(c)??c}</span>
               <span class="count">${v.total}</span></li>`);
      });

    /* leyenda */
    const max=d3.max(vals)||1;
    legendScale.domain([0,max]);
    legendAxis.call(
      d3.axisBottom(legendScale).ticks(4).tickSize(3)
    ).selectAll('text').attr('font-size','8px');

    /* etiqueta rango */
    rangeLbl.textContent=`${fmtDay(selectedYear,dayMin)} → ${fmtDay(selectedYear,dayMax)}`;
  }

  /* ----------  eventos --------------------------------------------------- */
  yearSel.addEventListener('change',e=>{
    selectedYear=+e.target.value; dayMin=1; dayMax=365;
    timelineSvg.select('.brush')?.call(brush.move,[0,TL_W]);
    drawHeat(selectedYear); update();
  });

  function brushed({selection}){
    if(!selection) return;
    const [x0,x1]=selection;
    dayMin=Math.max(1,Math.round(dayScale.invert(x0)));
    dayMax=Math.min(365,Math.round(dayScale.invert(x1)));
    update();
  }

  /* ----------  render inicial ------------------------------------------- */
  drawHeat(selectedYear); update();
  timelineSvg.append('g').attr('class','brush')
    .call(brush).call(brush.move,[0,TL_W]);
}
