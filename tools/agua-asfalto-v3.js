// ================================================================
// 🌊🏙️ AGUA & ASFALTO v3.0 - Visualización dinámica
// Hackatón Perú | JRC × GHSL × Sentinel-1 × HydroSHEDS × CHIRPS
// ================================================================
// Prototipo Google Earth Engine Code Editor (JavaScript).
// AHORA porta esta lógica a Python en `apps/api/gee/` para
// servirla desde Azure Functions. Este archivo queda como
// HERRAMIENTA INTERNA DE CALIBRACIÓN: pegar en
// https://code.earthengine.google.com/ para validar visualmente
// parámetros y resultados del IVC antes de promover cambios al
// backend Python.
// ================================================================

// ----------------------------------------------------------------
// 1. ÁREAS DE ESTUDIO
// ----------------------------------------------------------------
var peru = ee.FeatureCollection("FAO/GAUL/2015/level0")
            .filter(ee.Filter.eq('ADM0_NAME', 'Peru'));
var depts = ee.FeatureCollection("FAO/GAUL/2015/level1")
             .filter(ee.Filter.eq('ADM0_NAME', 'Peru'));
var dists = ee.FeatureCollection("FAO/GAUL/2015/level2")
             .filter(ee.Filter.eq('ADM0_NAME', 'Peru'));

Map.setOptions('HYBRID');
Map.centerObject(peru, 5);
Map.style().set('cursor', 'crosshair');

// ----------------------------------------------------------------
// 2. DATASETS
// ----------------------------------------------------------------
var gswYearly = ee.ImageCollection("JRC/GSW1_4/YearlyHistory");
var gswAll    = ee.Image("JRC/GSW1_4/GlobalSurfaceWater");
var ghsl      = ee.ImageCollection("JRC/GHSL/P2023A/GHS_BUILT_S");
var ghslPop   = ee.ImageCollection("JRC/GHSL/P2023A/GHS_POP");
var esa       = ee.ImageCollection("ESA/WorldCover/v200").first();
var dem       = ee.Image("USGS/SRTMGL1_003");
var s1        = ee.ImageCollection("COPERNICUS/S1_GRD");
var chirps    = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY");
var rivers    = ee.FeatureCollection("WWF/HydroSHEDS/v1/FreeFlowingRivers");

var slope = ee.Terrain.slope(dem);

var enosFuertes = {
  1983: 'El Niño fuerte', 1998: 'El Niño extraordinario',
  2017: 'El Niño Costero', 2023: 'El Niño Costero',
  1989: 'La Niña', 2000: 'La Niña',
  2011: 'La Niña', 2021: 'La Niña triple'
};

var R = {}; // resultados globales

// ----------------------------------------------------------------
// 3. PALETAS - rampas dinámicas que cuentan historias
// ----------------------------------------------------------------
var PAL = {
  // Agua: blanco → cian → azul profundo (intensidad de presencia)
  aguaFreq: ['#f7fbff','#deebf7','#9ecae1','#4292c6','#08519c','#08306b'],
  aguaMax:  ['#c6dbef','#9ecae1'],
  aguaPerm: ['#08306b'],
  // Urbano: amarillo (viejo) → naranja → rojo oscuro (nuevo)
  urbanoTemporal: ['#fff7bc','#fee391','#fec44f','#fe9929','#ec7014',
                   '#cc4c02','#993404','#662506'],
  // Vulnerabilidad: verde → amarillo → rojo (semáforo)
  ivc: ['#1a9850','#91cf60','#fee08b','#fc8d59','#d73027','#a50026'],
  // Intersección: contornos
  riesgoFill: '#ff0066',
  riesgoEdge: '#660033'
};

// Años GHSL disponibles para el gradiente urbano
var GHSL_YEARS = [1975,1980,1985,1990,1995,2000,2005,2010,2015,2020,2025,2030];

// ----------------------------------------------------------------
// 4. UI - PANEL PRINCIPAL CON TABS
// ----------------------------------------------------------------
var panel = ui.Panel({
  style: {width: '400px', padding: '12px', position: 'top-right',
          backgroundColor: 'white'}
});

panel.add(ui.Label({
  value: '🌊 AGUA & ASFALTO v3',
  style: {fontWeight: 'bold', fontSize: '20px', margin: '0',
          color: '#08306b'}
}));
panel.add(ui.Label({
  value: 'Visualización dinámica de vulnerabilidad urbana',
  style: {fontSize: '12px', color: '#555', margin: '0 0 8px 0',
          fontStyle: 'italic'}
}));

var tabs = ['🎯 Zona', '⚙️ Parámetros', '👁️ Capas', '🚀 Acciones'];
var tabContent = {};
var tabBar = ui.Panel([], ui.Panel.Layout.flow('horizontal'),
  {margin: '4px 0', stretch: 'horizontal'});
panel.add(tabBar);
var tabPanel = ui.Panel({style: {stretch: 'horizontal'}});
panel.add(tabPanel);

function setTab(name) {
  tabBar.clear();
  tabs.forEach(function(t) {
    var active = (t === name);
    tabBar.add(ui.Button({
      label: t,
      onClick: function() { setTab(t); },
      style: {
        margin: '0 2px', fontSize: '11px',
        backgroundColor: active ? '#08306b' : '#e8e8e8',
        color: active ? 'white' : '#222'
      }
    }));
  });
  tabPanel.clear();
  if (tabContent[name]) tabPanel.add(tabContent[name]);
}

// ===== TAB 1: ZONA =====
tabContent['🎯 Zona'] = ui.Panel();
tabContent['🎯 Zona'].add(ui.Label('📍 Selección de zona',
  {fontWeight:'bold', fontSize:'13px', margin:'6px 0 4px 0'}));

var ambitoSelect = ui.Select({
  items: ['Todo Perú','Por departamento','Por distrito','Casos emblemáticos'],
  value: 'Casos emblemáticos',
  style: {stretch: 'horizontal'}
});
tabContent['🎯 Zona'].add(ambitoSelect);

var subPanel = ui.Panel();
tabContent['🎯 Zona'].add(subPanel);

var deptList = ['Lima','La Libertad','Piura','Lambayeque','Ica','Arequipa',
                'Cusco','Loreto','Ucayali','San Martín','Tumbes','Áncash',
                'Cajamarca','Junín','Puno','Tacna','Madre de Dios',
                'Ayacucho','Apurímac','Huancavelica','Huánuco','Pasco',
                'Amazonas','Moquegua'];

var casosEmblematicos = {
  'Chosica - Quebrada Pedregal': [-76.69, -11.93, 13],
  'Catacaos (Piura) - El Niño 2017': [-80.68, -5.27, 12],
  'Punta Hermosa - Huayco 2017': [-76.83, -12.33, 13],
  'Trujillo / Río Moche': [-78.97, -8.18, 11],
  'Tumbes - Río Tumbes': [-80.45, -3.57, 11],
  'Iquitos - Amazonía': [-73.25, -3.75, 11],
  'Pucallpa - Río Ucayali': [-74.55, -8.39, 11],
  'Ica - Río Ica': [-75.73, -14.07, 12],
  'Mala / Cañete': [-76.63, -12.66, 11],
  'Lima Norte - Comas/Carabayllo': [-77.05, -11.90, 12],
  'San Juan de Lurigancho': [-76.97, -11.99, 12]
};

var deptSelect = ui.Select({items: deptList, value: 'Lima',
  style: {stretch: 'horizontal'}});
var distSelect = ui.Select({items: ['(cargando...)'],
  value: '(cargando...)', style: {stretch: 'horizontal'}});
var casoSelect = ui.Select({items: Object.keys(casosEmblematicos),
  value: 'Chosica - Quebrada Pedregal',
  style: {stretch: 'horizontal'}});

function setAmbito(v) {
  subPanel.clear();
  if (v === 'Por departamento') {
    subPanel.add(ui.Label('Departamento:', {fontSize:'11px'}));
    subPanel.add(deptSelect);
  } else if (v === 'Por distrito') {
    subPanel.add(ui.Label('Departamento:', {fontSize:'11px'}));
    subPanel.add(deptSelect);
    subPanel.add(ui.Label('Distrito:', {fontSize:'11px'}));
    subPanel.add(distSelect);
    cargarDistritos(deptSelect.getValue());
  } else if (v === 'Casos emblemáticos') {
    subPanel.add(ui.Label('Caso:', {fontSize:'11px'}));
    subPanel.add(casoSelect);
  }
}
ambitoSelect.onChange(setAmbito);
setAmbito('Casos emblemáticos');

function cargarDistritos(dept) {
  var d = dists.filter(ee.Filter.eq('ADM1_NAME', dept));
  d.aggregate_array('ADM2_NAME').evaluate(function(arr) {
    if (arr && arr.length) {
      distSelect.items().reset(arr.sort());
      distSelect.setValue(arr[0]);
    }
  });
}
deptSelect.onChange(cargarDistritos);

// ===== TAB 2: PARÁMETROS =====
tabContent['⚙️ Parámetros'] = ui.Panel();
var pCol = tabContent['⚙️ Parámetros'];

pCol.add(ui.Label('🌊 Agua histórica (JRC)',
  {fontWeight:'bold', fontSize:'13px', margin:'6px 0 4px 0'}));

var years = []; for (var y=1984; y<=2021; y++) years.push(String(y));
var waterStart = ui.Select({items: years, value: '1984'});
var waterEnd = ui.Select({items: years, value: '2021'});
pCol.add(ui.Panel([ui.Label('Desde:'), waterStart,
                    ui.Label('Hasta:'), waterEnd],
                   ui.Panel.Layout.flow('horizontal')));

pCol.add(ui.Label('Umbral "agua recurrente" (años mínimos):',
  {fontSize:'11px', margin:'6px 0 0 0'}));
var freqLbl = ui.Label('3 años (estacional/recurrente)');
var freqSld = ui.Slider({min:1, max:20, value:3, step:1,
  style:{stretch:'horizontal'},
  onChange: function(v){
    var t = v + ' año(s)';
    if (v == 1) t += '  (ocasional)';
    else if (v <= 3) t += '  (estacional/recurrente)';
    else if (v <= 8) t += '  (frecuente)';
    else t += '  (semi-permanente)';
    freqLbl.setValue(t);
  }
});
pCol.add(freqSld); pCol.add(freqLbl);

pCol.add(ui.Label('🏙️ Urbano (GHSL temporal)',
  {fontWeight:'bold', fontSize:'13px', margin:'10px 0 4px 0'}));
var ghslYearsStr = GHSL_YEARS.map(String);
var urbStart = ui.Select({items: ghslYearsStr, value: '1990'});
var urbEnd = ui.Select({items: ghslYearsStr, value: '2020'});
pCol.add(ui.Panel([ui.Label('Inicio:'), urbStart,
                    ui.Label('Fin:'), urbEnd],
                   ui.Panel.Layout.flow('horizontal')));

pCol.add(ui.Label('Umbral construido (m²/píxel 100m):',
  {fontSize:'11px', margin:'6px 0 0 0'}));
var thrLbl = ui.Label('500 m² (sensible a invasiones)');
var thrSld = ui.Slider({min:100, max:5000, value:500, step:100,
  style:{stretch:'horizontal'},
  onChange: function(v){
    var t = v + ' m²';
    if (v <= 500) t += '  (sensible a invasiones)';
    else if (v <= 2000) t += '  (urbano disperso)';
    else t += '  (urbano consolidado)';
    thrLbl.setValue(t);
  }
});
pCol.add(thrSld); pCol.add(thrLbl);

pCol.add(ui.Label('⛰️ Terreno y proximidad',
  {fontWeight:'bold', fontSize:'13px', margin:'10px 0 4px 0'}));
pCol.add(ui.Label('Pendiente máxima:', {fontSize:'11px'}));
var slopeLbl = ui.Label('15° (llanuras + laderas)');
var slopeSld = ui.Slider({min:2, max:45, value:15, step:1,
  style:{stretch:'horizontal'},
  onChange: function(v){
    var t = v + '°';
    if (v <= 5) t += '  (solo llanuras)';
    else if (v <= 15) t += '  (llanuras + laderas)';
    else t += '  (incluye quebradas)';
    slopeLbl.setValue(t);
  }
});
pCol.add(slopeSld); pCol.add(slopeLbl);

pCol.add(ui.Label('Buffer cercanía a agua (m):',
  {fontSize:'11px', margin:'6px 0 0 0'}));
var bufLbl = ui.Label('200 m');
var bufSld = ui.Slider({min:0, max:1000, value:200, step:50,
  style:{stretch:'horizontal'},
  onChange: function(v){ bufLbl.setValue(v + ' m'); }
});
pCol.add(bufSld); pCol.add(bufLbl);

// ===== TAB 3: CAPAS =====
tabContent['👁️ Capas'] = ui.Panel();
var lCol = tabContent['👁️ Capas'];

lCol.add(ui.Label('🌊 Capas de agua',
  {fontWeight:'bold', fontSize:'13px', margin:'6px 0 4px 0',
   color:'#08306b'}));
var chk = {
  aguaMax: ui.Checkbox('💧 Extensión MÁXIMA histórica (sombra)', true),
  aguaFreq: ui.Checkbox('🌊 Intensidad: años con agua (rampa)', true),
  aguaRec: ui.Checkbox('💠 Agua recurrente destacada', true),
};
['aguaMax','aguaFreq','aguaRec'].forEach(function(k){ lCol.add(chk[k]); });

lCol.add(ui.Label('🏙️ Capas urbanas',
  {fontWeight:'bold', fontSize:'13px', margin:'10px 0 4px 0',
   color:'#cc4c02'}));
chk.urbTemporal = ui.Checkbox('🏗️ Año de aparición urbana (rampa)', true);
chk.urbExpansion = ui.Checkbox('🆕 Expansión Inicio→Fin (resaltada)', true);
lCol.add(chk.urbTemporal); lCol.add(chk.urbExpansion);

lCol.add(ui.Label('🚨 Riesgo (intersecciones)',
  {fontWeight:'bold', fontSize:'13px', margin:'10px 0 4px 0',
   color:'#b30000'}));
chk.riesgoNuevo = ui.Checkbox('🚨 Polígonos de RIESGO ALTO (con borde)', true);
chk.riesgoAntiguo = ui.Checkbox('⚠️ Polígonos de riesgo medio (con borde)', true);
chk.ivc = ui.Checkbox('🎯 Índice de Vulnerabilidad (semáforo)', false);
lCol.add(chk.riesgoNuevo); lCol.add(chk.riesgoAntiguo); lCol.add(chk.ivc);

lCol.add(ui.Label('📦 Capas auxiliares',
  {fontWeight:'bold', fontSize:'13px', margin:'10px 0 4px 0'}));
chk.poblacion = ui.Checkbox('👥 Densidad poblacional', false);
chk.rios = ui.Checkbox('🏞️ Red hidrográfica', false);
chk.pendiente = ui.Checkbox('⛰️ Pendiente', false);
chk.esa = ui.Checkbox('🛰️ ESA WorldCover 2021', false);
chk.s1Pre = ui.Checkbox('📡 Sentinel-1 pre-evento', false);
chk.s1Post = ui.Checkbox('📡 Sentinel-1 post-evento', false);
['poblacion','rios','pendiente','esa','s1Pre','s1Post'].forEach(function(k){
  lCol.add(chk[k]);
});

lCol.add(ui.Label('Evento Sentinel-1:',
  {fontSize:'11px', margin:'8px 0 2px 0', fontWeight:'bold'}));
var eventoSelect = ui.Select({
  items: ['El Niño Costero Marzo 2017','El Niño Costero Marzo 2023'],
  value: 'El Niño Costero Marzo 2017',
  style:{stretch:'horizontal'}
});
lCol.add(eventoSelect);

// ===== TAB 4: ACCIONES =====
tabContent['🚀 Acciones'] = ui.Panel();
var aCol = tabContent['🚀 Acciones'];

var status = ui.Label('Listo para iniciar.',
  {color:'#08306b', margin:'6px 0', fontSize:'12px', fontWeight:'bold'});
aCol.add(status);

function makeBtn(label, fn, bgColor) {
  return ui.Button({
    label: label,
    onClick: fn,
    style: {
      stretch: 'horizontal',
      margin: '4px 0',
      backgroundColor: bgColor,
      color: 'white',
      padding: '8px',
      fontSize: '12px',
      fontWeight: 'bold'
    }
  });
}

aCol.add(ui.Label('▶ Principal',
  {fontWeight:'bold', fontSize:'12px', margin:'8px 0 2px 0', color:'#08306b'}));
aCol.add(makeBtn('▶ ACTUALIZAR ANÁLISIS', function(){ actualizar(); }, '#08306b'));

aCol.add(ui.Label('Análisis avanzado',
  {fontWeight:'bold', fontSize:'12px', margin:'10px 0 2px 0', color:'#08306b'}));
aCol.add(makeBtn('🎞️ Animación temporal', generarAnimacion, '#2171b5'));
aCol.add(makeBtn('🏆 Ranking de distritos', rankingDistritos, '#a50f15'));
aCol.add(makeBtn('🌧️ Lluvias CHIRPS + ENSO', graficoLluvias, '#08519c'));
aCol.add(makeBtn('📡 Inundación Sentinel-1', detectarInundacionS1, '#6a51a3'));
aCol.add(makeBtn('🔄 Comparador antes/después', activarComparador, '#238b45'));

aCol.add(ui.Label('Exportar',
  {fontWeight:'bold', fontSize:'12px', margin:'10px 0 2px 0', color:'#08306b'}));
aCol.add(makeBtn('⬇ Raster categórico (TIF)', exportarRaster, '#4d4d4d'));
aCol.add(makeBtn('⬇ Polígonos riesgo (GeoJSON)', exportarVector, '#4d4d4d'));
aCol.add(makeBtn('⬇ CSV por distrito', exportarEstadisticasDistrito, '#4d4d4d'));

setTab('🎯 Zona');
ui.root.add(panel);

// ----------------------------------------------------------------
// 5. UTILIDADES DE ÁREA
// ----------------------------------------------------------------
function obtenerAOI() {
  var v = ambitoSelect.getValue();
  if (v === 'Todo Perú') return peru.geometry();
  if (v === 'Por departamento')
    return depts.filter(ee.Filter.eq('ADM1_NAME', deptSelect.getValue()))
                .geometry();
  if (v === 'Por distrito')
    return dists.filter(ee.Filter.and(
             ee.Filter.eq('ADM1_NAME', deptSelect.getValue()),
             ee.Filter.eq('ADM2_NAME', distSelect.getValue())))
                .geometry();
  if (v === 'Casos emblemáticos') {
    var c = casosEmblematicos[casoSelect.getValue()];
    return ee.Geometry.Point([c[0], c[1]]).buffer(15000);
  }
  return peru.geometry();
}

function centrarAOI() {
  var v = ambitoSelect.getValue();
  if (v === 'Casos emblemáticos') {
    var c = casosEmblematicos[casoSelect.getValue()];
    Map.setCenter(c[0], c[1], c[2]);
  } else if (v === 'Por departamento') {
    Map.centerObject(depts.filter(ee.Filter.eq('ADM1_NAME',
      deptSelect.getValue())), 8);
  } else if (v === 'Por distrito') {
    Map.centerObject(dists.filter(ee.Filter.and(
      ee.Filter.eq('ADM1_NAME', deptSelect.getValue()),
      ee.Filter.eq('ADM2_NAME', distSelect.getValue()))), 11);
  } else {
    Map.centerObject(peru, 5);
  }
}

// ----------------------------------------------------------------
// 6. NÚCLEO: AÑO DE PRIMERA URBANIZACIÓN (rampa temporal)
// ----------------------------------------------------------------
function calcularUrbanoTemporal(aoi, thr, yStart, yEnd) {
  var imgs = GHSL_YEARS.filter(function(y){ return y >= yStart && y <= yEnd; })
    .map(function(y) {
      var built = ghsl.filter(ee.Filter.calendarRange(y,y,'year'))
                      .first().select('built_surface').gte(thr);
      return built.multiply(ee.Image.constant(y))
                  .updateMask(built)
                  .rename('year_built')
                  .toInt();
    });
  return ee.ImageCollection(imgs).min().clip(aoi).rename('year_built');
}

// ----------------------------------------------------------------
// 7. ANÁLISIS PRINCIPAL
// ----------------------------------------------------------------
function actualizar() {
  Map.layers().reset();
  status.setValue('⏳ Procesando análisis...');
  var aoi = obtenerAOI();
  Map.addLayer(peru.style({color:'yellow', fillColor:'00000000', width:1}),
               {}, 'Perú');

  var yWs = parseInt(waterStart.getValue(),10);
  var yWe = parseInt(waterEnd.getValue(),10);
  var yUs = parseInt(urbStart.getValue(),10);
  var yUe = parseInt(urbEnd.getValue(),10);
  var thr = thrSld.getValue();
  var minY = freqSld.getValue();
  var slpMax = slopeSld.getValue();
  var bufDist = bufSld.getValue();

  var aguaFreqRaw = gswYearly
    .filter(ee.Filter.calendarRange(yWs, yWe, 'year'))
    .map(function(img){ return img.select('waterClass').gte(2).rename('w'); })
    .sum().clip(aoi);

  var totalYears = yWe - yWs + 1;
  var aguaFreq = aguaFreqRaw.updateMask(aguaFreqRaw.gte(1));
  var aguaRecurrente = aguaFreqRaw.gte(minY);
  var aguaMaxExt = gswAll.select('max_extent').clip(aoi);

  var aguaBase = aguaRecurrente.unmask(0);
  var bufferAgua;
  if (bufDist > 0) {
    var dist = aguaBase.fastDistanceTransform(256).sqrt()
                       .multiply(ee.Image.pixelArea().sqrt());
    bufferAgua = dist.lte(bufDist).clip(aoi);
  } else {
    bufferAgua = aguaBase;
  }

  var urbanoTemporal = calcularUrbanoTemporal(aoi, thr, yUs, yUe);

  var ghslA = ghsl.filter(ee.Filter.calendarRange(yUs,yUs,'year'))
                  .first().select('built_surface').clip(aoi);
  var ghslB = ghsl.filter(ee.Filter.calendarRange(yUe,yUe,'year'))
                  .first().select('built_surface').clip(aoi);
  var urbAntes = ghslA.gte(thr);
  var urbDespues = ghslB.gte(thr);
  var urbNuevo = urbDespues.and(urbAntes.not());

  var slopeMask = slope.lte(slpMax);

  var riesgoNuevo = urbNuevo.and(bufferAgua).and(slopeMask);
  var riesgoAntiguo = urbAntes.and(bufferAgua).and(slopeMask);

  var riesgoNuevoVec = riesgoNuevo.selfMask().reduceToVectors({
    geometry: aoi, scale: 100, eightConnected: true,
    maxPixels: 1e10, geometryType: 'polygon', bestEffort: true
  });
  var riesgoAntiguoVec = riesgoAntiguo.selfMask().reduceToVectors({
    geometry: aoi, scale: 100, eightConnected: true,
    maxPixels: 1e10, geometryType: 'polygon', bestEffort: true
  });

  var popImg = ghslPop.filter(ee.Filter.calendarRange(yUe,yUe,'year')).first();
  if (!popImg) popImg = ghslPop.filter(ee.Filter.calendarRange(2020,2020,'year')).first();
  popImg = ee.Image(popImg).select('population_count').clip(aoi);

  // ===== IVC: fórmula canónica reutilizada por AHORA =====
  var nAgua = aguaFreqRaw.divide(totalYears);
  var nSlope = ee.Image(1).subtract(slope.divide(30).clamp(0,1));
  var nBuffer = bufferAgua.toFloat();
  var nBuilt = ghslB.divide(5000).clamp(0,1);
  var nPop = popImg.unmask(0).divide(50).clamp(0,1);

  var ivc = nAgua.multiply(0.30)
    .add(nSlope.multiply(0.20))
    .add(nBuffer.multiply(0.20))
    .add(nBuilt.multiply(0.15))
    .add(nPop.multiply(0.15))
    .multiply(100).clip(aoi).rename('ivc');

  R.aoi = aoi;
  R.aguaFreq = aguaFreqRaw;
  R.aguaRecurrente = aguaRecurrente;
  R.aguaMaxExt = aguaMaxExt;
  R.bufferAgua = bufferAgua;
  R.urbanoTemporal = urbanoTemporal;
  R.urbAntes = urbAntes;
  R.urbDespues = urbDespues;
  R.urbNuevo = urbNuevo;
  R.riesgoNuevo = riesgoNuevo;
  R.riesgoAntiguo = riesgoAntiguo;
  R.riesgoNuevoVec = riesgoNuevoVec;
  R.riesgoAntiguoVec = riesgoAntiguoVec;
  R.pop = popImg;
  R.ivc = ivc;
  R.yWs = yWs; R.yWe = yWe; R.yUs = yUs; R.yUe = yUe;
  R.totalYears = totalYears;
  R.minY = minY;

  if (chk.aguaMax.getValue())
    Map.addLayer(aguaMaxExt.updateMask(aguaMaxExt),
      {palette: PAL.aguaMax}, '💧 Extensión máx. histórica', true, 0.45);

  if (chk.aguaFreq.getValue())
    Map.addLayer(aguaFreq,
      {min: 1, max: Math.max(2, totalYears * 0.6),
       palette: PAL.aguaFreq},
      '🌊 Intensidad agua (años con presencia)', true, 0.85);

  if (chk.aguaRec.getValue())
    Map.addLayer(aguaRecurrente.updateMask(aguaRecurrente),
      {palette: PAL.aguaPerm},
      '💠 Agua recurrente (≥' + minY + ' años)', true, 0.9);

  if (chk.rios.getValue())
    Map.addLayer(rivers.filterBounds(aoi).style({color:'cyan', width:1.5}),
                 {}, '🏞️ Red hidrográfica');

  if (chk.pendiente.getValue())
    Map.addLayer(slope.clip(aoi),
      {min:0, max:45,
       palette:['#1a9850','#fee08b','#d73027']},
      '⛰️ Pendiente (°)', false, 0.5);

  if (chk.urbTemporal.getValue())
    Map.addLayer(urbanoTemporal,
      {min: yUs, max: yUe, palette: PAL.urbanoTemporal},
      '🏗️ Año de aparición urbana (' + yUs + '→' + yUe + ')',
      true, 0.85);

  if (chk.urbExpansion.getValue())
    Map.addLayer(urbNuevo.updateMask(urbNuevo),
      {palette:['#cc4c02']}, '🆕 Expansión ' + yUs + '→' + yUe,
      false, 0.7);

  if (chk.esa.getValue()) {
    var esaUrb = esa.eq(50).clip(aoi);
    Map.addLayer(esaUrb.updateMask(esaUrb),
      {palette:['#fa0000']}, '🛰️ ESA Urbano 2021', false);
  }

  if (chk.poblacion.getValue())
    Map.addLayer(popImg.updateMask(popImg.gt(1)),
      {min:1, max:100,
       palette:['#ffffcc','#fd8d3c','#bd0026','#67000d']},
      '👥 Densidad poblacional', false, 0.7);

  if (chk.ivc.getValue())
    Map.addLayer(ivc.updateMask(ivc.gt(15)),
      {min:15, max:80, palette: PAL.ivc},
      '🎯 Índice de Vulnerabilidad Compuesto', false, 0.7);

  if (chk.riesgoAntiguo.getValue())
    Map.addLayer(riesgoAntiguoVec.style({
      color: '#cc4c02', fillColor: 'fdae6b80', width: 1.5
    }), {}, '⚠️ Polígonos: urb. antiguo sobre agua');

  if (chk.riesgoNuevo.getValue())
    Map.addLayer(riesgoNuevoVec.style({
      color: PAL.riesgoEdge, fillColor: 'ff006688', width: 2.5
    }), {}, '🚨 POLÍGONOS DE RIESGO ALTO');

  centrarAOI();
  agregarLeyenda();
  calcularEstadisticas(aoi);
}

// ----------------------------------------------------------------
// 8. ESTADÍSTICAS
// ----------------------------------------------------------------
var statsPanel = ui.Panel({
  style: {position: 'bottom-left', width: '440px', padding: '10px',
          backgroundColor: 'white'}
});
Map.add(statsPanel);

function calcularEstadisticas(aoi) {
  statsPanel.clear();
  statsPanel.add(ui.Label('📊 Resumen del análisis',
    {fontWeight:'bold', fontSize:'14px', color:'#08306b'}));
  statsPanel.add(ui.Label('Calculando...', {color:'gray'}));

  var pxArea = ee.Image.pixelArea();

  var stackSum = R.riesgoNuevo.multiply(pxArea).rename('area_rNuevo')
    .addBands(R.riesgoAntiguo.multiply(pxArea).rename('area_rAntiguo'))
    .addBands(R.urbDespues.multiply(pxArea).rename('area_urb'))
    .addBands(R.urbNuevo.multiply(pxArea).rename('area_exp'))
    .addBands(R.pop.updateMask(R.riesgoNuevo).rename('pop_rNuevo'))
    .addBands(R.pop.updateMask(R.riesgoNuevo.or(R.riesgoAntiguo))
              .rename('pop_total'));

  var stackMean = R.ivc.updateMask(R.urbDespues).rename('ivc_urbano');

  var redSum = stackSum.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi, scale: 100, maxPixels: 1e13, bestEffort: true
  });
  var redMean = stackMean.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi, scale: 100, maxPixels: 1e13, bestEffort: true
  });

  redSum.combine(redMean).evaluate(function(d, error) {
    statsPanel.clear();
    statsPanel.add(ui.Label('📊 Resumen del análisis',
      {fontWeight:'bold', fontSize:'14px', color:'#08306b'}));

    if (error) {
      statsPanel.add(ui.Label('⚠ Error: ' + error,
        {color:'red', fontSize:'11px'}));
      status.setValue('⚠ ' + error);
      return;
    }
    if (!d) {
      statsPanel.add(ui.Label('⚠ Sin datos.', {color:'orange'}));
      return;
    }

    var v = function(k) {
      return (d[k] === null || d[k] === undefined) ? 0 : d[k];
    };
    var fmt = function(n) {
      return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    var haRN  = v('area_rNuevo')   / 10000;
    var haRA  = v('area_rAntiguo') / 10000;
    var haUrb = v('area_urb')      / 10000;
    var haExp = v('area_exp')      / 10000;
    var popN  = v('pop_rNuevo');
    var popT  = v('pop_total');
    var ivcM  = v('ivc_urbano');
    var pct = haExp > 0 ? (haRN / haExp * 100) : 0;

    var hacer = function(txt, color, size, bold) {
      return ui.Label(txt, {
        color: color || '#333', margin: '2px 0',
        fontSize: size || '12px',
        fontWeight: bold ? 'bold' : 'normal'
      });
    };

    statsPanel.add(hacer('🏗️ Expansión urbana total: ' +
                          haExp.toFixed(1) + ' ha',
                          '#cc4c02', '12px', true));
    statsPanel.add(hacer('   sobre/cerca de agua: ' + haRN.toFixed(1) +
                          ' ha (' + pct.toFixed(1) + '%)',
                          '#b30000', '11px'));
    statsPanel.add(hacer('⚠️ Urb. antiguo en zona de agua: ' +
                          haRA.toFixed(1) + ' ha', '#cc4c02'));
    statsPanel.add(hacer('👥 Pob. en RIESGO ALTO: ' + fmt(popN) + ' hab.',
                          '#b30000', '14px', true));
    statsPanel.add(hacer('👥 Pob. total expuesta: ' + fmt(popT) + ' hab.',
                          '#08306b', '13px'));
    statsPanel.add(hacer('🎯 IVC promedio (zona urbana): ' +
                          (ivcM ? ivcM.toFixed(1) : '0.0') + '/100',
                          '#6a51a3', '12px'));
    statsPanel.add(hacer('🌆 Área urbana total: ' + haUrb.toFixed(1) + ' ha',
                          '#525252', '11px'));

    if (pct > 5)
      statsPanel.add(hacer('🚨 ALERTA: ' + pct.toFixed(1) +
        '% de la nueva ocupación en zona inundable',
        '#b30000', '12px', true));

    status.setValue('✔ Listo. ' + fmt(popN) + ' hab. en riesgo alto.');
  });
}

// ----------------------------------------------------------------
// 9. LEYENDA
// ----------------------------------------------------------------
var legend = ui.Panel({style: {position:'bottom-right', padding:'10px',
                                backgroundColor:'white', width:'260px'}});
Map.add(legend);

function makeColorBar(palette, label, minV, maxV) {
  var pal = palette.join(',');
  var thumb = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0)
             .multiply((maxV-minV)/100).add(minV).int(),
    params: {bbox:[0,0,100,1], dimensions:'200x12',
             format:'png', min:minV, max:maxV, palette: palette},
    style: {stretch:'horizontal', margin:'2px 0'}
  });
  var labels = ui.Panel([
    ui.Label(String(minV), {margin:'0', fontSize:'10px'}),
    ui.Label(label, {margin:'0', fontSize:'10px',
                     textAlign:'center', stretch:'horizontal'}),
    ui.Label(String(maxV), {margin:'0', fontSize:'10px'})
  ], ui.Panel.Layout.flow('horizontal'), {stretch:'horizontal'});
  return ui.Panel([thumb, labels]);
}

function agregarLeyenda() {
  legend.clear();
  legend.add(ui.Label('📖 Leyenda dinámica',
    {fontWeight:'bold', fontSize:'13px', color:'#08306b'}));

  legend.add(ui.Label('🌊 Intensidad agua (años):',
    {fontSize:'11px', fontWeight:'bold', margin:'6px 0 0 0',
     color:'#08306b'}));
  legend.add(makeColorBar(PAL.aguaFreq, 'frecuencia',
                          1, Math.max(2, R.totalYears || 38)));

  legend.add(ui.Label('🏗️ Año de aparición urbana:',
    {fontSize:'11px', fontWeight:'bold', margin:'8px 0 0 0',
     color:'#cc4c02'}));
  legend.add(makeColorBar(PAL.urbanoTemporal, 'viejo→nuevo',
                          R.yUs || 1990, R.yUe || 2020));

  legend.add(ui.Label('🚨 Intersecciones:',
    {fontSize:'11px', fontWeight:'bold', margin:'8px 0 4px 0',
     color:'#b30000'}));
  var items = [
    ['#ff0066', '🚨 Riesgo ALTO (nuevo)', PAL.riesgoEdge],
    ['#fdae6b', '⚠️ Riesgo medio (antiguo)', '#cc4c02'],
    ['#c6dbef', '💧 Extensión máx. agua', '#9ecae1']
  ];
  items.forEach(function(it) {
    var c = ui.Label('', {backgroundColor: it[0], padding:'6px',
                           margin:'1px 6px 1px 0',
                           border: '2px solid ' + it[2]});
    var l = ui.Label(it[1], {margin:'2px 0', fontSize:'10px'});
    legend.add(ui.Panel([c,l], ui.Panel.Layout.flow('horizontal')));
  });
}

// ----------------------------------------------------------------
// 10. INSPECTOR de punto
// ----------------------------------------------------------------
var inspector = ui.Panel({
  style: {position:'middle-left', width:'440px', backgroundColor:'white',
          padding:'10px', shown:false, maxHeight:'520px'}
});
Map.add(inspector);

Map.onClick(function(coords) {
  inspector.style().set('shown', true);
  inspector.clear();

  var header = ui.Panel([
    ui.Label('🔍 Inspector de punto',
      {fontWeight:'bold', fontSize:'14px', color:'#08306b'}),
    ui.Button('✕', function(){ inspector.style().set('shown', false); },
      false, {padding:'2px 6px'})
  ], ui.Panel.Layout.flow('horizontal'),
     {stretch:'horizontal'});
  inspector.add(header);

  inspector.add(ui.Label('Lat: ' + coords.lat.toFixed(4) +
                          '  Lon: ' + coords.lon.toFixed(4),
                          {fontSize:'11px', color:'gray'}));

  var pt = ee.Geometry.Point([coords.lon, coords.lat]);
  var ptBuf = pt.buffer(200);

  if (R.ivc) {
    var stack = R.ivc.rename('ivc')
      .addBands(slope.rename('pend'))
      .addBands(R.pop.unmask(0).rename('pop'))
      .addBands(R.aguaFreq.unmask(0).rename('aguaY'))
      .addBands(R.urbanoTemporal.unmask(0).rename('urbY'));

    stack.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: ptBuf, scale: 30, maxPixels: 1e6, bestEffort: true
    }).evaluate(function(r, err) {
      if (err || !r) return;

      var ivcVal = (r.ivc !== null && r.ivc !== undefined) ?
                    r.ivc.toFixed(1) : 'N/D';
      var penVal = (r.pend !== null && r.pend !== undefined) ?
                    r.pend.toFixed(1) : 'N/D';
      var popVal = (r.pop !== null && r.pop !== undefined) ?
                    r.pop.toFixed(1) : '0';
      var aguaVal = (r.aguaY !== null && r.aguaY !== undefined) ?
                     Math.round(r.aguaY) : 0;
      var urbVal = (r.urbY && r.urbY > 0) ?
                    Math.round(r.urbY) : 'No urbanizado';

      var box = ui.Panel({
        style: {backgroundColor:'#f5f5f5', padding:'8px', margin:'6px 0'}
      });
      box.add(ui.Label('🎯 IVC: ' + ivcVal + '/100',
        {fontWeight:'bold', fontSize:'12px', color:'#6a51a3'}));
      box.add(ui.Label('🌊 Agua histórica: ' + aguaVal + ' año(s)',
        {fontSize:'11px', color:'#08519c'}));
      box.add(ui.Label('🏗️ Año aparición urbana: ' + urbVal,
        {fontSize:'11px', color:'#cc4c02'}));
      box.add(ui.Label('⛰️ Pendiente: ' + penVal + '°',
        {fontSize:'11px'}));
      box.add(ui.Label('👥 Población: ' + popVal + ' hab',
        {fontSize:'11px'}));
      inspector.add(box);
    });
  }

  try {
    var c1 = ui.Chart.image.series({
      imageCollection: gswYearly.select('waterClass')
        .map(function(img){
          return img.unmask(1).copyProperties(img, ['system:time_start']);
        }),
      region: ptBuf, reducer: ee.Reducer.mode(),
      scale: 30, xProperty: 'system:time_start'
    }).setOptions({
      title:'🌊 Clase JRC (0=NoObs 1=NoAgua 2=Estac 3=Perm)',
      hAxis:{title:'Año'},
      vAxis:{title:'Clase', viewWindow:{min:-0.5,max:3.5}},
      height:150, colors:['#08519c'], lineWidth:2, pointSize:4,
      interpolateNulls: true
    });
    inspector.add(c1);
  } catch (e) {}

  try {
    var c2 = ui.Chart.image.series({
      imageCollection: ghsl.select('built_surface'),
      region: ptBuf, reducer: ee.Reducer.mean(), scale: 100
    }).setOptions({
      title:'🏗️ Superficie construida (m²/píxel 100m)',
      hAxis:{title:'Año'}, vAxis:{title:'m²'},
      height:150, colors:['#cc4c02'], lineWidth:2, pointSize:4
    });
    inspector.add(c2);
  } catch (e) {}

  try {
    var c3 = ui.Chart.image.series({
      imageCollection: ghslPop.select('population_count'),
      region: ptBuf, reducer: ee.Reducer.mean(), scale: 100
    }).setOptions({
      title:'👥 Población (hab/píxel 100m)',
      hAxis:{title:'Año'}, vAxis:{title:'hab'},
      height:150, colors:['#67000d'], lineWidth:2, pointSize:4
    });
    inspector.add(c3);
  } catch (e) {}
});

// ----------------------------------------------------------------
// 11. ANIMACIÓN
// ----------------------------------------------------------------
function generarAnimacion() {
  var aoi = obtenerAOI();
  status.setValue('🎞️ Generando animación...');

  var animYears = [1990,1995,2000,2005,2010,2015,2020];
  var thr = thrSld.getValue();

  var frames = ee.ImageCollection(animYears.map(function(yr) {
    var aguaY = gswYearly
      .filter(ee.Filter.calendarRange(1984, yr, 'year'))
      .map(function(img){ return img.select('waterClass').gte(2).rename('w'); })
      .sum();
    var urbY = ghsl.filter(ee.Filter.calendarRange(yr, yr, 'year'))
                  .first().select('built_surface').gte(thr);
    var rgb = ee.Image.rgb(
      urbY.multiply(255),
      aguaY.gt(0).and(urbY.not()).multiply(50),
      aguaY.gt(0).multiply(255)
    ).clip(aoi);
    return rgb.set('label', String(yr));
  }));

  print('🎞️ ANIMACIÓN 1990-2020 (rojo=urbano, azul=agua):');
  print(ui.Thumbnail({
    image: frames,
    params: {region: aoi, framesPerSecond: 1.5,
             crs: 'EPSG:3857', dimensions: 600}
  }));
  status.setValue('✔ Animación en Console.');
}

// ----------------------------------------------------------------
// 12. RANKING DISTRITOS
// ----------------------------------------------------------------
function rankingDistritos() {
  if (!R.riesgoNuevo) { actualizar(); return; }
  status.setValue('🏆 Calculando ranking...');

  var v = ambitoSelect.getValue();
  var aoiFC;
  if (v === 'Por departamento' || v === 'Por distrito') {
    aoiFC = dists.filter(ee.Filter.eq('ADM1_NAME', deptSelect.getValue()));
  } else {
    aoiFC = dists.filter(ee.Filter.eq('ADM1_NAME', 'Lima'));
  }

  var pxArea = ee.Image.pixelArea();
  var stack = R.riesgoNuevo.multiply(pxArea).rename('area_riesgo')
    .addBands(R.pop.updateMask(R.riesgoNuevo).rename('pop_riesgo'));

  var stats = stack.reduceRegions({
    collection: aoiFC, reducer: ee.Reducer.sum(), scale: 100
  });

  print(ui.Chart.feature.byFeature({
    features: stats.sort('pop_riesgo', false).limit(15),
    xProperty: 'ADM2_NAME', yProperties: ['pop_riesgo']
  }).setChartType('ColumnChart').setOptions({
    title:'🏆 Top 15 distritos: población en riesgo',
    hAxis:{title:'Distrito', slantedText:true, slantedTextAngle:45},
    vAxis:{title:'Personas'}, colors:['#b30000'],
    legend:{position:'none'}, height:350
  }));

  print(ui.Chart.feature.byFeature({
    features: stats.sort('area_riesgo', false).limit(15),
    xProperty: 'ADM2_NAME', yProperties: ['area_riesgo']
  }).setChartType('ColumnChart').setOptions({
    title:'🏆 Top 15 distritos: área de invasión sobre agua',
    hAxis:{title:'Distrito', slantedText:true, slantedTextAngle:45},
    vAxis:{title:'m²'}, colors:['#cc4c02'],
    legend:{position:'none'}, height:350
  }));

  status.setValue('✔ Rankings en Console.');
}

// ----------------------------------------------------------------
// 13. LLUVIAS CHIRPS + ENSO
// ----------------------------------------------------------------
function graficoLluvias() {
  var aoi = obtenerAOI();
  status.setValue('🌧️ Generando serie...');

  var chirpsAnual = ee.ImageCollection(
    ee.List.sequence(1981, 2024).map(function(y) {
      y = ee.Number(y);
      var ini = ee.Date.fromYMD(y, 1, 1);
      var fin = ini.advance(1, 'year');
      return chirps.filterDate(ini, fin).sum()
                   .set('system:time_start', ini.millis())
                   .set('year', y);
    })
  );

  print(ui.Chart.image.series({
    imageCollection: chirpsAnual,
    region: aoi, reducer: ee.Reducer.mean(),
    scale: 5000, xProperty: 'system:time_start'
  }).setOptions({
    title:'🌧️ Lluvia anual CHIRPS + eventos ENSO',
    hAxis:{title:'Año'}, vAxis:{title:'mm/año'},
    colors:['#08519c'], lineWidth:2, pointSize:3, height:300
  }));

  print('📌 Eventos ENSO fuertes en Perú:');
  Object.keys(enosFuertes).forEach(function(k){
    print('  ' + k + ' → ' + enosFuertes[k]);
  });

  status.setValue('✔ Serie de lluvias en Console.');
}

// ----------------------------------------------------------------
// 14. SENTINEL-1
// ----------------------------------------------------------------
function detectarInundacionS1() {
  var aoi = obtenerAOI();
  var ev = eventoSelect.getValue();
  status.setValue('📡 Procesando Sentinel-1...');

  var pre, post, postLbl;
  if (ev === 'El Niño Costero Marzo 2017') {
    pre = ['2016-12-01','2017-01-31'];
    post = ['2017-03-10','2017-03-31'];
    postLbl = 'Mar 2017';
  } else {
    pre = ['2022-11-01','2023-01-15'];
    post = ['2023-03-01','2023-04-15'];
    postLbl = 'Mar 2023';
  }

  var s1Col = s1
    .filter(ee.Filter.eq('instrumentMode','IW'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation','VH'))
    .filter(ee.Filter.eq('orbitProperties_pass','DESCENDING'))
    .filterBounds(aoi).select('VH');

  var preImg = s1Col.filterDate(pre[0], pre[1]).median().clip(aoi);
  var postImg = s1Col.filterDate(post[0], post[1]).median().clip(aoi);
  var dif = preImg.subtract(postImg);
  var inundacion = postImg.lt(-17).and(dif.gt(3));

  if (chk.s1Pre.getValue())
    Map.addLayer(preImg, {min:-25,max:0,palette:['black','white']},
                 '📡 S1 pre-evento', false);
  if (chk.s1Post.getValue())
    Map.addLayer(postImg, {min:-25,max:0,palette:['black','white']},
                 '📡 S1 post-evento', false);

  Map.addLayer(inundacion.updateMask(inundacion),
               {palette:['#00ffff']}, '💧 Inundación SAR ' + postLbl);

  if (R.urbDespues) {
    var inundUrbano = inundacion.and(R.urbDespues);
    Map.addLayer(inundUrbano.updateMask(inundUrbano),
                 {palette:['#ff00ff']},
                 '🚨 ÁREA URBANA INUNDADA ' + postLbl);

    var area = inundUrbano.multiply(ee.Image.pixelArea()).rename('a')
      .reduceRegion({reducer:ee.Reducer.sum(), geometry:aoi,
                     scale:30, maxPixels:1e10, bestEffort:true});
    area.evaluate(function(r){
      var ha = (r && r.a ? r.a/10000 : 0).toFixed(1);
      status.setValue('✔ Inundación urbana: ' + ha + ' ha');
    });
  } else {
    status.setValue('✔ S1 procesado. Corre Actualizar para cruzar.');
  }
}

// ----------------------------------------------------------------
// 15. COMPARADOR ANTES/DESPUÉS
// ----------------------------------------------------------------
function activarComparador() {
  status.setValue('🔄 Activando comparador...');

  var yUs = parseInt(urbStart.getValue(),10);
  var yUe = parseInt(urbEnd.getValue(),10);
  var thr = thrSld.getValue();
  var aoi = obtenerAOI();

  var leftMap = ui.Map();
  var rightMap = ui.Map();
  leftMap.setOptions('HYBRID'); rightMap.setOptions('HYBRID');

  var ghslA = ghsl.filter(ee.Filter.calendarRange(yUs,yUs,'year'))
                  .first().select('built_surface').gte(thr);
  var ghslB = ghsl.filter(ee.Filter.calendarRange(yUe,yUe,'year'))
                  .first().select('built_surface').gte(thr);

  leftMap.addLayer(ghslA.updateMask(ghslA).clip(aoi),
    {palette:['#fec44f']}, 'Urbano ' + yUs);
  rightMap.addLayer(ghslB.updateMask(ghslB).clip(aoi),
    {palette:['#b30000']}, 'Urbano ' + yUe);

  if (R.aguaRecurrente) {
    leftMap.addLayer(R.aguaRecurrente.updateMask(R.aguaRecurrente),
      {palette:['#08306b']}, 'Agua', true, 0.6);
    rightMap.addLayer(R.aguaRecurrente.updateMask(R.aguaRecurrente),
      {palette:['#08306b']}, 'Agua', true, 0.6);
  }

  ui.Map.Linker([leftMap, rightMap]);

  var splitPanel = ui.SplitPanel({
    firstPanel: leftMap, secondPanel: rightMap,
    wipe: true, style:{stretch:'both'}
  });

  ui.root.widgets().reset([splitPanel, panel]);
  leftMap.centerObject(aoi, 12);

  status.setValue('✔ Comparador activo. Arrastra la barra central.');
}

// ----------------------------------------------------------------
// 16. EXPORTACIONES
// ----------------------------------------------------------------
function exportarRaster() {
  if (!R.urbAntes) { status.setValue('⚠ Corre Actualizar primero.'); return; }

  var categoria = ee.Image(0)
    .where(R.urbAntes, 1)
    .where(R.riesgoAntiguo, 2)
    .where(R.urbNuevo, 3)
    .where(R.riesgoNuevo, 4)
    .selfMask().toByte().clip(R.aoi);

  Export.image.toDrive({
    image: categoria, description:'Mapa_Riesgo_AguaUrbano',
    folder:'GEE_Hackaton', region:R.aoi, scale:100,
    maxPixels:1e13, fileFormat:'GeoTIFF'
  });
  status.setValue('🚀 Tarea raster creada.');
}

function exportarVector() {
  if (!R.riesgoNuevoVec) { status.setValue('⚠ Corre Actualizar primero.'); return; }
  Export.table.toDrive({
    collection: R.riesgoNuevoVec,
    description: 'Poligonos_Riesgo_Nuevo',
    folder: 'GEE_Hackaton', fileFormat: 'GeoJSON'
  });
  status.setValue('🚀 Tarea vectorial creada.');
}

function exportarEstadisticasDistrito() {
  if (!R.riesgoNuevo) { status.setValue('⚠ Corre Actualizar primero.'); return; }

  var pxArea = ee.Image.pixelArea();
  var stack = R.riesgoNuevo.multiply(pxArea).rename('area_riesgo_nuevo')
    .addBands(R.riesgoAntiguo.multiply(pxArea).rename('area_riesgo_antiguo'))
    .addBands(R.pop.updateMask(R.riesgoNuevo).rename('pop_riesgo_nuevo'));

  var stats = stack.reduceRegions({
    collection: dists, reducer: ee.Reducer.sum(), scale: 100
  });

  Export.table.toDrive({
    collection: stats, description:'Estadisticas_Distrito',
    folder:'GEE_Hackaton', fileFormat:'CSV'
  });
  status.setValue('🚀 Tarea CSV creada.');
}

// ----------------------------------------------------------------
// 17. INICIO
// ----------------------------------------------------------------
actualizar();
