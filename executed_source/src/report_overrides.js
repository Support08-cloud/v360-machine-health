/* =========================
   REAL CAPTURE DATA OVERRIDES
   ========================= */
var reportData = window.V360_REPORT_DATA || {
  schemaVersion:'1.0', mode:'empty', customer:{}, generatedAt:null,
  machines:[], stones:[
    {id:'D-1',shape:'Master stone'},{id:'D-2',shape:'Master stone'},{id:'D-3',shape:'Master stone'},
    {id:'D-4',shape:'Princess'},{id:'D-5',shape:'Master stone'},{id:'D-6',shape:'Master stone'}
  ], warnings:[], excludedMachines:[], sourceSummary:{}, calibration:{}
};
machines = Array.isArray(reportData.machines) ? reportData.machines : [];
stones = Array.isArray(reportData.stones) && reportData.stones.length ? reportData.stones : stones;

function isScore(v){ return typeof v === 'number' && isFinite(v); }
function clampScore(v){ return Math.max(0, Math.min(100, Math.round(v))); }
function finiteValues(arr){ return arr.filter(function(v){ return typeof v === 'number' && isFinite(v); }); }
function averageValues(arr){ var v=finiteValues(arr); return v.length ? v.reduce(function(a,b){return a+b;},0)/v.length : null; }
function safeText(v){ return v === null || typeof v === 'undefined' || v === '' ? '—' : String(v); }
function esc(v){
  return safeText(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function scoreText(v){ return isScore(v) ? String(Math.round(v)) : 'N/A'; }
function fmtOne(v){ return typeof v === 'number' && isFinite(v) ? v.toFixed(1) : '—'; }
function fmtSeconds(v){
  if(typeof v !== 'number' || !isFinite(v)) return '—';
  var total=Math.max(0,Math.round(v)), h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60;
  return (h ? h+':' + String(m).padStart(2,'0') : m) + ':' + String(s).padStart(2,'0');
}
function fmtRgb(v){ return Array.isArray(v) && v.length>=3 ? v.slice(0,3).map(function(x){return Math.round(x);}).join(',') : '—'; }
function getStoneData(m, i){
  if(!m || !Array.isArray(m.stonesData)) return null;
  return m.stonesData[i] || m.stonesData.filter(function(s){ return s && s.id === stones[i].id; })[0] || null;
}
function metricValue(m,key){ return m && m.scores ? m.scores[key] : null; }
function weightedCompositeFor(values){
  var total=0, sum=0;
  ['color','picture','consistency','speed','correction'].forEach(function(k){
    var v=values[k], w=weights[k] || 0;
    if(isScore(v) && w>0){ sum += v*w; total += w; }
  });
  return total ? clampScore(sum/total) : null;
}

recomputeComposite = function(){
  machines.forEach(function(m){ m.scores.composite = weightedCompositeFor(m.scores || {}); });
};

animatedNumber = function(el,key,to){
  if(!isScore(to)){
    el.textContent='N/A';
    el.classList.add('metric-na');
    lastValues[key]=to;
    return;
  }
  el.classList.remove('metric-na');
  var from=isScore(lastValues[key]) ? lastValues[key] : to;
  lastValues[key]=to;
  if(from===to){ el.textContent=Math.round(to); return; }
  var start=null,duration=450;
  function step(ts){
    if(!start) start=ts;
    var p=Math.min((ts-start)/duration,1), eased=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+(to-from)*eased);
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
};

statusFor = function(v){ return !isScore(v) ? 'unknown' : (v>=thresholds.healthy?'success':(v>=thresholds.danger?'warning':'danger')); };
statusLabel = function(s){ return s==='success'?t('statusHealthy'):(s==='warning'?t('statusWarning'):(s==='danger'?t('statusDanger'):t('statusUnknown'))); };
fmtDelta = function(d){ if(!isScore(d)) return '—'; d=Math.round(d); return (d>0?'+':'')+d; };
deltaClass = function(d){ return !isScore(d)?'delta-neutral':(d>=0?'delta-ok':(d>=-15?'delta-warn':'delta-bad')); };

verdictClass = function(d){
  if(!isScore(d)) return 'unknown';
  var c=(reportData.calibration && reportData.calibration.color) || {};
  var ok=isScore(c.okDistance)?c.okDistance:3, warn=isScore(c.warnDistance)?c.warnDistance:8;
  return d<ok?'ok':(d<warn?'warn':'bad');
};
verdictWord = function(d){ var c=verdictClass(d); return c==='ok'?t('vOk'):(c==='warn'?t('vWarn'):(c==='bad'?t('vBad'):t('vUnknown'))); };
qualityVerdictClass = function(d){ return !isScore(d)?'unknown':(d===0?'ok':(d===1?'warn':'bad')); };
qualityVerdictWord = function(d){ var c=qualityVerdictClass(d); return c==='ok'?t('qOk'):(c==='warn'?t('qWarn'):(c==='bad'?t('qBad'):t('vUnknown'))); };
correctionVerdictClass = function(d){
  if(!isScore(d)) return 'unknown';
  var c=(reportData.calibration && reportData.calibration.correction) || {};
  var ok=isScore(c.okExcess)?c.okExcess:8, warn=isScore(c.warnExcess)?c.warnExcess:25;
  return d<ok?'ok':(d<warn?'warn':'bad');
};
correctionVerdictWord = function(d){ var c=correctionVerdictClass(d); return c==='ok'?t('cOk'):(c==='warn'?t('cWarn'):(c==='bad'?t('cBad'):t('vUnknown'))); };

stoneColorData = function(m,stoneIndex){
  var sd=getStoneData(m,stoneIndex);
  return sd && sd.color ? sd.color : {diamond:{mach:null,ideal:null,dist:null},bg:{mach:null,ideal:null,dist:null}};
};
stoneQualityData = function(m,stoneIndex){
  var sd=getStoneData(m,stoneIndex);
  return sd && sd.quality ? sd.quality : {sharpness:{mach:null,ideal:null,diff:null},contrast:{mach:null,ideal:null,diff:null}};
};
stoneCorrectionData = function(m,stoneIndex){
  var sd=getStoneData(m,stoneIndex);
  return sd && sd.correction ? sd.correction : {mach:null,ideal:null,over:null};
};

function buildCustomerLine(){
  var c=reportData.customer || {}, parts=[];
  if(c.name) parts.push(c.name);
  if(c.preparedBy) parts.push((state.lang==='gu'?'તૈયાર કરનાર ':'prepared by ')+c.preparedBy);
  if(c.reportDate){
    var dt=new Date(c.reportDate+'T00:00:00');
    parts.push(isNaN(dt.getTime())?c.reportDate:dt.toLocaleDateString(state.lang==='gu'?'gu-IN':'en-GB',{day:'numeric',month:'short',year:'numeric'}));
  }
  if(c.location) parts.push(c.location);
  return parts.join(' · ') || (state.lang==='gu'?'V360 મશીન ઓડિટ':'V360 machine audit');
}
function reportModeLabel(){
  var partial=machines.some(function(m){return m.coverage && m.coverage.partial;});
  if(reportData.mode==='empty') return state.lang==='gu'?'ડેટા લોડ નથી':'no audit data loaded';
  if(partial) return state.lang==='gu'?'વાસ્તવિક ડેટા · આંશિક':'real data · partial';
  return state.lang==='gu'?'વાસ્તવિક કેપ્ચર ડેટા':'real capture data';
}
function buildFleetHint(){
  var excluded=(reportData.excludedMachines||[]).length;
  var base=state.lang==='gu' ? machines.length+' મશીનનું વિશ્લેષણ થયું.' : machines.length+' machine'+(machines.length===1?'':'s')+' analyzed.';
  if(excluded) base += state.lang==='gu' ? ' '+excluded+' અધૂરા/અમાન્ય મશીન સ્કોરિંગમાંથી બહાર રાખ્યા.' : ' '+excluded+' incomplete or invalid machine'+(excluded===1?' was':'s were')+' excluded from scoring.';
  return base;
}
function buildDisclosure(){
  var cal=reportData.calibration || {}, version=cal.version || 'provisional';
  if(state.lang==='gu'){
    return 'સ્કોર '+version+' નોર્મલાઇઝેશનનો ઉપયોગ કરે છે. આ વાસ્તવિક કેપ્ચર ફીલ્ડ્સ પરથી ગણાય છે, પરંતુ સર્વિસ થ્રેશોલ્ડને જાણીતા સ્વસ્થ અને ખામીવાળા મશીનોના મોટા કેલિબ્રેશન સેટ સામે માન્ય કરવાનું બાકી છે.';
  }
  return 'Scores use the '+version+' normalization profile. They are computed from real capture fields, but the service thresholds still require validation against a larger calibration set of known-healthy and known-faulty machines.';
}
function applyReportHeader(){
  var sub=document.getElementById('reportSubtitle'); if(sub) sub.textContent=buildCustomerLine();
  var tag=document.getElementById('dataTag'); if(tag) tag.textContent=reportModeLabel();
  var hint=document.getElementById('fleetHint'); if(hint) hint.textContent=buildFleetHint();
  var disclosure=document.getElementById('reportDisclosure'); if(disclosure) disclosure.textContent=buildDisclosure();
  var printBtn=document.getElementById('printBtn'); if(printBtn) printBtn.textContent=state.lang==='gu'?'પ્રિન્ટ / PDF':'Print / PDF';
  var dataBtn=document.getElementById('downloadDataBtn'); if(dataBtn) dataBtn.textContent=state.lang==='gu'?'ઓડિટ JSON':'Audit JSON';
  document.title=(reportData.customer && reportData.customer.name ? reportData.customer.name+' · ' : '')+'Machine Health Audit · V360';
}

applyStaticTranslations = function(){
  document.querySelectorAll('[data-i18n]').forEach(function(el){ el.textContent=t(el.getAttribute('data-i18n')); });
  var isDark=document.documentElement.getAttribute('data-theme')==='dark';
  document.getElementById('themeToggle').textContent=isDark?t('lightMode'):t('darkMode');
  document.getElementById('langToggle').textContent=state.lang==='gu'?'English':LANG.gu.langName;
  applyReportHeader();
};

applyVisibilityToPage = function(){
  var hasUpgrades=!!(reportData.sourceSummary && (reportData.sourceSummary.hasV50 || reportData.sourceSummary.hasV50Edf));
  if(!hasUpgrades) visibility.upgradeBand=false;
  document.getElementById('settingsToggle').hidden=!visibility.backendSettings;
  document.documentElement.setAttribute('data-audience',state.audience);
  document.documentElement.setAttribute('data-upgrade-band',visibility.upgradeBand?'shown':'hidden');
  var up=document.getElementById('visUpgradeBand');
  if(up){ up.checked=visibility.upgradeBand; up.disabled=!hasUpgrades; }
};

renderSummary = function(){
  var key=state.metric;
  var vals=finiteValues(machines.map(function(m){return metricValue(m,key);}));
  var avg=vals.length?Math.round(averageValues(vals)):null;
  var counts={success:0,warning:0,danger:0,unknown:0};
  machines.forEach(function(m){counts[statusFor(metricValue(m,key))]++;});
  animatedNumber(document.getElementById('summaryAvg'),'summary:'+key,avg);
  var avgDelta=document.getElementById('summaryDelta');
  avgDelta.textContent=isScore(avg)?fmtDelta(avg-100)+' '+t('vsIdealSuffix'):'—';
  avgDelta.className='delta mono '+deltaClass(isScore(avg)?avg-100:null);
  document.getElementById('summaryMetricLabel').textContent=metricLabel(key)+' '+t('acrossAllSuffix').replace('{n}',machines.length);
  document.getElementById('summaryDist').innerHTML=
    '<span class="dist-item"><span class="dist-dot" style="background:var(--success)"></span>'+counts.success+' '+esc(t('statusHealthy'))+'</span>'+
    '<span class="dist-item"><span class="dist-dot" style="background:var(--warning)"></span>'+counts.warning+' '+esc(t('statusWarning'))+'</span>'+
    '<span class="dist-item"><span class="dist-dot" style="background:var(--danger)"></span>'+counts.danger+' '+esc(t('statusDanger'))+'</span>'+
    (counts.unknown?'<span class="dist-item"><span class="dist-dot" style="background:var(--unknown)"></span>'+counts.unknown+' '+esc(t('statusUnknown'))+'</span>':'');

  var sorted=machines.slice().sort(function(a,b){
    var av=metricValue(a,key),bv=metricValue(b,key);
    if(!isScore(av)&&!isScore(bv)) return a.id.localeCompare(b.id);
    if(!isScore(av)) return 1; if(!isScore(bv)) return -1; return bv-av;
  });
  var rankList=document.getElementById('rankList'); rankList.innerHTML='';
  sorted.forEach(function(m){
    var v=metricValue(m,key),s=statusFor(v),vsFleet=isScore(v)&&isScore(avg)?v-avg:null;
    var row=document.createElement('div'); row.className='rank-row';
    row.innerHTML='<span class="rank-id mono">'+esc(m.id)+'</span>'+
      '<div class="rank-track"><div class="rank-fill" style="width:'+(isScore(v)?v:0)+'%;background:var(--'+s+')"></div>'+
      (isScore(avg)?'<div class="rank-avg-line" style="left:'+avg+'%" title="'+esc(t('fleetAvgTooltip'))+'"></div>':'')+'</div>'+
      '<span class="rank-score mono">'+scoreText(v)+'</span>'+
      '<span class="delta mono '+deltaClass(vsFleet)+'" title="'+esc(t('vsFleetTooltip'))+'">'+fmtDelta(vsFleet)+'</span>';
    row.onclick=function(){openDetail(m.id);}; rankList.appendChild(row);
  });

  var finiteSorted=sorted.filter(function(m){return isScore(metricValue(m,key));});
  var conclusion='';
  if(!finiteSorted.length){
    conclusion=state.lang==='gu'?'આ માપ માટે પૂરતો માન્ય ડેટા મળ્યો નથી. સોર્સ 0.json ફાઇલ અને જરૂરી ફીલ્ડ તપાસો.':'There is not enough valid data to score this measure. Check the source 0.json files and required fields.';
  } else {
    var best=finiteSorted[0],worst=finiteSorted[finiteSorted.length-1],laggards=counts.warning+counts.danger;
    if(state.lang==='gu'){
      conclusion='ફ્લીટ સરેરાશ '+metricLabel(key)+' પર '+avg+'/100 છે. '+counts.success+' સ્વસ્થ, '+counts.warning+' ને ધ્યાન જરૂરી અને '+counts.danger+' મશીન સર્વિસ શ્રેણીમાં છે. '+worst.id+' આ માપ પર આદર્શથી સૌથી દૂર છે.';
      if((reportData.excludedMachines||[]).length) conclusion+=' અધૂરા ડેટાવાળા '+reportData.excludedMachines.length+' મશીન આ સરેરાશમાં સામેલ નથી.';
    } else {
      conclusion='Fleet average is '+avg+'/100 for '+metricLabel(key)+'. '+counts.success+' are healthy, '+counts.warning+' need attention, and '+counts.danger+' fall in the service band. '+worst.id+' is furthest from the ideal reference on this measure.';
      if((reportData.excludedMachines||[]).length) conclusion+=' '+reportData.excludedMachines.length+' machine'+(reportData.excludedMachines.length===1?' with incomplete data is':'s with incomplete data are')+' excluded from this average.';
      if(laggards && best) conclusion+=' '+best.id+' is the strongest internal benchmark for the corrective pass.';
    }
  }
  document.getElementById('conclusionText').textContent=conclusion;
};

renderFleet = function(){
  var grid=document.getElementById('fleetGrid'); grid.innerHTML='';
  if(!machines.length){ grid.innerHTML='<div class="empty-report">'+esc(state.lang==='gu'?'આ રિપોર્ટમાં કોઈ સ્કોર કરેલું મશીન નથી.':'No scored machines are present in this report.')+'</div>'; return; }
  machines.forEach(function(m,i){
    var v=metricValue(m,state.metric),s=statusFor(v),card=document.createElement('div');
    card.className='m-card'; card.style.setProperty('--status','var(--'+s+')'); card.style.animationDelay=(i*45)+'ms';
    var dots=stones.map(function(st,si){
      var sd=getStoneData(m,si),sv=sd&&sd.available?sd.score:null,ss=statusFor(sv);
      return '<span class="dot" style="background:var(--'+ss+')" title="'+esc(st.id+' · '+scoreText(sv))+'"></span>';
    }).join('');
    var cov=m.coverage||{matched:stones.length,expected:stones.length,partial:false};
    var covHtml='<span class="coverage-chip '+(cov.partial?'partial':'')+'">'+esc(cov.matched+'/'+cov.expected+' stones')+'</span>';
    card.innerHTML='<div class="facet"></div><p class="ref-code">ref. '+esc(m.id.replace(/\s+/g,'-').toLowerCase())+'</p>'+
      '<p class="m-id mono">'+esc(m.id)+covHtml+'</p><span class="badge badge-'+s+'">'+esc(statusLabel(s))+'</span>'+
      '<div class="m-score mono"><span class="m-score-num">0</span><span class="unit">/100</span><span class="delta '+deltaClass(isScore(v)?v-100:null)+'" title="vs ideal">'+fmtDelta(isScore(v)?v-100:null)+'</span></div>'+
      '<div class="m-score-badge-wrap"><span class="m-score-badge-num mono">0</span></div><p class="m-metric">'+esc(metricLabel(state.metric))+'</p>'+
      '<div class="mini-stones">'+dots+'</div>';
    card.onclick=function(){openDetail(m.id);}; grid.appendChild(card);
    animatedNumber(card.querySelector('.m-score-num'),'machine:'+m.id+':'+state.metric,v);
    animatedNumber(card.querySelector('.m-score-badge-num'),'machine-badge:'+m.id+':'+state.metric,v);
  });
};

buildRecommendedFix = function(m){
  var fixes=Array.isArray(m.recommendedFixes)?m.recommendedFixes:[];
  if(!fixes.length){
    return {clean:true,text:state.lang==='gu'?'કોઈ પુનરાવર્તિત સેટિંગ મિસમેચ મળ્યો નથી — ઉપલબ્ધ સેટિંગ્સ આદર્શ સંદર્ભ સાથે મેળ ખાય છે.':'no repeated configuration mismatch was found; available settings match the ideal reference.'};
  }
  var selected=fixes.slice(0,6);
  if(state.lang==='gu'){
    return {clean:false,text:'આ સુધારો: '+selected.map(function(f){return f.field+' ('+safeText(f.actual)+' → '+safeText(f.ideal)+', '+f.count+'/'+f.total+' સ્ટોન)';}).join(' અને ')+'.'};
  }
  return {clean:false,text:'adjust '+selected.map(function(f){return f.field+' ('+safeText(f.actual)+' → '+safeText(f.ideal)+', seen on '+f.count+'/'+f.total+' stones)';}).join('; ')+'.'};
};

buildMachineDiagnosis = function(m){
  var subs=[
    {key:'color',label:t('mlColor'),v:m.scores.color},{key:'picture',label:t('mlPicture'),v:m.scores.picture},
    {key:'consistency',label:t('mlConsistency'),v:m.scores.consistency},{key:'correction',label:t('mlCorrection'),v:m.scores.correction},
    {key:'speed',label:t('mlSpeed'),v:m.scores.speed}
  ].filter(function(x){return isScore(x.v);}).sort(function(a,b){return a.v-b.v;});
  var cov=m.coverage||{matched:stones.length,expected:stones.length,partial:false};
  if(!subs.length) return state.lang==='gu'?'સ્કોર કરવા માટે પૂરતા માન્ય ફીલ્ડ મળ્યા નથી.':'Not enough valid capture fields were available to build a diagnosis.';
  var weakest=subs[0],strongest=subs[subs.length-1],diamond=[],bg=[];
  stones.forEach(function(st,i){var cd=stoneColorData(m,i); if(isScore(cd.diamond.dist)) diamond.push({id:st.id,dist:cd.diamond.dist}); if(isScore(cd.bg.dist)) bg.push({id:st.id,dist:cd.bg.dist});});
  var avgD=averageValues(diamond.map(function(x){return x.dist;})),avgB=averageValues(bg.map(function(x){return x.dist;}));
  var worstD=diamond.slice().sort(function(a,b){return b.dist-a.dist;})[0]||null;
  var envIssue=isScore(avgD)&&isScore(avgB)&&avgB>avgD&&avgB>=5;
  var status=statusFor(m.scores.composite),gap=strongest.v-weakest.v,below=isScore(m.scores.composite)?Math.max(0,Math.round(thresholds.healthy-m.scores.composite)):null;
  var coverageNote=cov.partial?(state.lang==='gu'?' નોંધ: આ નિદાન '+cov.matched+'/'+cov.expected+' ઉપલબ્ધ સ્ટોન પર આધારિત છે.':' Note: this diagnosis is based on '+cov.matched+'/'+cov.expected+' available stones.') : '';
  if(state.lang==='gu'){
    var g=m.id+' કુલ '+scoreText(m.scores.composite)+'/100 સ્કોર કરે છે. સૌથી નબળું ક્ષેત્ર '+weakest.label+' ('+Math.round(weakest.v)+') છે, જે સૌથી મજબૂત ક્ષેત્ર '+strongest.label+' કરતાં '+Math.round(gap)+' પોઈન્ટ પાછળ છે. ';
    if(status!=='success'&&isScore(below)) g+=below+' પોઈન્ટ સ્વસ્થ રેખાથી નીચે છે. ';
    if(envIssue) g+='બેકગ્રાઉન્ડ ડ્રિફ્ટ (સરેરાશ Δ'+fmtOne(avgB)+') ડાયમંડ ડ્રિફ્ટ (Δ'+fmtOne(avgD)+') કરતાં વધારે છે, તેથી લાઇટિંગ/બેકડ્રોપ તપાસ પ્રથમ કરો.';
    else if(worstD) g+=worstD.id+' માં સૌથી મોટો ડાયમંડ તફાવત (Δ'+fmtOne(worstD.dist)+') છે અને બેકગ્રાઉન્ડ તુલનાત્મક રીતે સ્થિર છે, તેથી ડાયમંડ-સાઇડ કેલિબ્રેશન તપાસો.';
    return g+coverageNote;
  }
  var text=m.id+' scores '+scoreText(m.scores.composite)+'/100 overall. Its weakest area is '+weakest.label+' at '+Math.round(weakest.v)+'/100, '+Math.round(gap)+' points behind '+strongest.label+'. ';
  if(status!=='success'&&isScore(below)) text+=below+' points separate it from the healthy line. ';
  if(envIssue) text+='Background drift (average Δ'+fmtOne(avgB)+') exceeds diamond drift (Δ'+fmtOne(avgD)+'), so inspect lighting and backdrop stability first.';
  else if(worstD) text+=worstD.id+' has the widest diamond gap (Δ'+fmtOne(worstD.dist)+') while the background is comparatively steady, pointing to diamond-side calibration.';
  return text+coverageNote;
};

buildMetadataTable = function(m,stoneIndex){
  var sd=getStoneData(m,stoneIndex);
  return sd && sd.metadata && Array.isArray(sd.metadata.sections) ? sd.metadata.sections : [];
};
buildMetadataHtml = function(m,stoneIndex){
  var sections=buildMetadataTable(m,stoneIndex),html='';
  if(!sections.length) return '<div class="stone-unavailable">'+esc(state.lang==='gu'?'આ સ્ટોન માટે મેટાડેટા ઉપલબ્ધ નથી.':'No technical metadata is available for this stone.')+'</div>';
  sections.forEach(function(sec){
    html+='<p class="meta-section-title">'+esc(metaSectionLabel(sec.name))+'</p><div class="meta-table">'+
      '<div class="meta-head"></div><div class="meta-head">'+esc(t('thisMachine'))+'</div><div class="meta-head">'+esc(t('idealReference'))+'</div>';
    (sec.rows||[]).forEach(function(r){var mm=r.mismatch?' meta-mismatch':''; html+='<div class="meta-field'+mm+'">'+esc(r.field)+'</div><div class="meta-val mono'+mm+'">'+esc(r.mach)+'</div><div class="meta-val mono">'+esc(r.ideal)+'</div>';});
    html+='</div>';
  });
  return html;
};

function mediaCard(asset,label,isVideo,notice){
  var media='';
  if(asset && asset.dataUrl){
    media=isVideo?'<video controls preload="metadata" src="'+esc(asset.dataUrl)+'"></video>':'<img src="'+esc(asset.dataUrl)+'" alt="'+esc(label)+'">';
  } else {
    media='<div class="media-missing">'+esc(notice || (state.lang==='gu'?'મીડિયા ઉપલબ્ધ નથી':'Media not available'))+'</div>';
  }
  return '<figure class="media-card">'+media+'<figcaption class="media-caption"><span>'+esc(label)+'</span><span class="media-filename" title="'+esc(asset&&asset.path?asset.path:'')+'">'+esc(asset&&asset.name?asset.name:'')+'</span></figcaption></figure>';
}
function getReferenceEntry(tier,stoneId){
  var refs=reportData && reportData.references ? reportData.references : {};
  var group=refs && refs[tier] ? refs[tier] : {};
  return group && stoneId ? (group[stoneId] || null) : null;
}
function buildCompareHtml(sd){
  var a=sd&&sd.assets?sd.assets:{}, ideal=getReferenceEntry('ideal',sd&&sd.id), ia=ideal&&ideal.assets?ideal.assets:{};
  var full=state.compareMode==='full',mv=full&&a.machineVideo&&a.machineVideo.dataUrl,iv=full&&ia.video&&ia.video.dataUrl;
  var machineAsset=mv?a.machineVideo:a.machineStill, idealAsset=iv?ia.video:ia.still;
  var machineNotice=full&&!mv?(state.lang==='gu'?'વિડિયો એમ્બેડ નથી; થંબનેલ બતાવ્યું છે.':'Video was not embedded; showing the still image.') : null;
  var idealNotice=full&&!iv?(state.lang==='gu'?'સંદર્ભ વિડિયો એમ્બેડ નથી; થંબનેલ બતાવ્યું છે.':'Reference video was not embedded; showing the still image.') : null;
  return '<div class="compare real-media '+(full?'full':'')+'">'+mediaCard(machineAsset,t('thisMachine'),!!mv,machineNotice)+mediaCard(idealAsset,t('idealReference'),!!iv,idealNotice)+'</div>';
}
function buildUpgradeHtml(sd){
  if(!visibility.upgradeBand || !sd) return '';
  var cards=[];
  [['v50','5.0'],['v50edf','5.0 EDF']].forEach(function(pair){
    var u=getReferenceEntry(pair[0],sd.id);
    if(!u) return;
    var img=u.assets&&u.assets.still&&u.assets.still.dataUrl?'<img src="'+esc(u.assets.still.dataUrl)+'" alt="'+pair[1]+'">':'<div class="media-missing" style="min-height:58px">—</div>';
    var meta=[]; if(u.totalSeconds!=null) meta.push(fmtSeconds(u.totalSeconds)); if(u.sharpness!=null) meta.push('sharpness '+u.sharpness);
    cards.push('<div class="upgrade-preview">'+img+'<div><div class="upgrade-name">'+pair[1]+'</div><div class="upgrade-meta">'+esc(meta.join(' · ') || (state.lang==='gu'?'સંદર્ભ કેપ્ચર':'reference capture'))+'</div></div></div>');
  });
  return cards.length?'<div class="upgrade-band real-upgrades"><span class="upgrade-label">'+esc(t('upgradeUnlocks'))+'</span>'+cards.join('')+'</div>':'';
}

renderDetail = function(){
  var m=machines.filter(function(x){return x.id===state.activeMachine;})[0]; if(!m) return;
  document.getElementById('detailTitle').textContent=m.id;
  var v=metricValue(m,state.metric),s=statusFor(v),badge=document.getElementById('detailBadge');
  badge.className='badge badge-'+s; badge.textContent=statusLabel(s)+' · '+scoreText(v)+'/100 '+metricLabel(state.metric);
  var dEl=document.getElementById('detailDelta'); dEl.textContent=isScore(v)?fmtDelta(v-100)+' '+t('vsIdealSuffix'):'—'; dEl.className='delta mono '+deltaClass(isScore(v)?v-100:null);
  document.getElementById('diagnosisText').textContent=buildMachineDiagnosis(m);
  var fixEl=document.getElementById('diagnosisFix'),fix=buildRecommendedFix(m);
  fixEl.innerHTML='<span class="fix-label">'+esc(t('recommendedLabel'))+'</span> '+esc(fix.text); fixEl.className='diagnosis-fix '+(fix.clean?'fix-clean':'fix-action');
  var list=document.getElementById('stoneList'); list.innerHTML='';
  stones.forEach(function(st,i){
    var sd=getStoneData(m,i),available=sd&&sd.available,sv=available?sd.score:null,ss=statusFor(sv);
    var head='<div class="stone-row-head"><div class="stone-id"><span class="mono">'+esc(st.id)+'</span><span class="shape">'+esc(st.shape||'')+'</span></div><div class="stone-score mono" style="color:var(--'+ss+')"><span class="stone-score-num">0</span><span class="delta '+deltaClass(isScore(sv)?sv-100:null)+'" title="vs ideal">'+fmtDelta(isScore(sv)?sv-100:null)+'</span></div></div>';
    var content='';
    if(!available){
      content='<div class="stone-unavailable">'+esc(state.lang==='gu'?'આ મશીન અથવા આદર્શ સંદર્ભ માટે મેળ ખાતું માન્ય 0.json મળ્યું નથી.':'No matching valid 0.json was found for this machine and the ideal reference.')+'</div>';
    } else {
      var cd=stoneColorData(m,i),qd=stoneQualityData(m,i),xd=stoneCorrectionData(m,i);
      var dHsl=Array.isArray(cd.diamond.mach)?rgbToHsl(cd.diamond.mach[0],cd.diamond.mach[1],cd.diamond.mach[2]):null;
      var diHsl=Array.isArray(cd.diamond.ideal)?rgbToHsl(cd.diamond.ideal[0],cd.diamond.ideal[1],cd.diamond.ideal[2]):null;
      var bHsl=Array.isArray(cd.bg.mach)?rgbToHsl(cd.bg.mach[0],cd.bg.mach[1],cd.bg.mach[2]):null;
      var biHsl=Array.isArray(cd.bg.ideal)?rgbToHsl(cd.bg.ideal[0],cd.bg.ideal[1],cd.bg.ideal[2]):null;
      var dClass=verdictClass(cd.diamond.dist),bClass=verdictClass(cd.bg.dist),shClass=qualityVerdictClass(qd.sharpness.diff),coClass=qualityVerdictClass(qd.contrast.diff);
      content+=buildCompareHtml(sd);
      if(visibility.stoneTables){
        function hslLine(h){return h?'<span class="ct-hsl">L'+h.l+' S'+h.s+' H'+h.h+'</span>':'';}
        content+='<div class="color-table"><div class="ct-head"></div><div class="ct-head">'+esc(t('thisMachine'))+'</div><div class="ct-head">'+esc(t('idealReference'))+'</div><div class="ct-head">'+esc(t('colDifference'))+'</div>'+
          '<div class="ct-rowlabel">'+esc(t('rowDiamond'))+'</div><div class="ct-cell mono">'+fmtRgb(cd.diamond.mach)+hslLine(dHsl)+'</div><div class="ct-cell mono">'+fmtRgb(cd.diamond.ideal)+hslLine(diHsl)+'</div><div class="ct-cell ct-diff '+dClass+'">Δ'+fmtOne(cd.diamond.dist)+' · '+esc(verdictWord(cd.diamond.dist))+'</div>'+
          '<div class="ct-rowlabel">'+esc(t('rowBackground'))+'</div><div class="ct-cell mono">'+fmtRgb(cd.bg.mach)+hslLine(bHsl)+'</div><div class="ct-cell mono">'+fmtRgb(cd.bg.ideal)+hslLine(biHsl)+'</div><div class="ct-cell ct-diff '+bClass+'">Δ'+fmtOne(cd.bg.dist)+' · '+esc(verdictWord(cd.bg.dist))+'</div>'+
          '<div class="ct-rowlabel ct-section">'+esc(t('rowSharpness'))+'</div><div class="ct-cell ct-section mono">'+esc(qd.sharpness.mach)+'</div><div class="ct-cell ct-section mono">'+esc(qd.sharpness.ideal)+'</div><div class="ct-cell ct-section ct-diff '+shClass+'">Δ'+safeText(qd.sharpness.diff)+' · '+esc(qualityVerdictWord(qd.sharpness.diff))+'</div>'+
          '<div class="ct-rowlabel">'+esc(t('rowContrast'))+'</div><div class="ct-cell mono">'+esc(qd.contrast.mach)+'</div><div class="ct-cell mono">'+esc(qd.contrast.ideal)+'</div><div class="ct-cell ct-diff '+coClass+'">Δ'+safeText(qd.contrast.diff)+' · '+esc(qualityVerdictWord(qd.contrast.diff))+'</div>'+
          '<div class="ct-rowlabel ct-section">'+esc(t('rowCorrection'))+'</div><div class="ct-cell ct-section mono">'+fmtOne(xd.mach)+'</div><div class="ct-cell ct-section mono">'+fmtOne(xd.ideal)+'</div><div class="ct-cell ct-section ct-diff '+correctionVerdictClass(xd.over)+'">'+(isScore(xd.over)&&xd.over>=0?'+':'')+fmtOne(xd.over)+' · '+esc(correctionVerdictWord(xd.over))+'</div></div>';
        var note;
        if(state.lang==='gu') note=bClass==='bad'?'બેકગ્રાઉન્ડ તફાવત મોટો છે; કલર ચુકાદા પહેલાં લાઇટિંગ અને બેકડ્રોપ સ્થિરતા તપાસો.':'બેકગ્રાઉન્ડ તુલનાત્મક રીતે સ્થિર છે, તેથી ડાયમંડનો તફાવત મશીન કલર કેલિબ્રેશન સાથે વધુ સંબંધિત છે.';
        else note=bClass==='bad'?'Background drift is substantial; verify lighting and backdrop stability before treating the diamond delta as a pure color-calibration fault.':'Background is comparatively stable, so the diamond delta is more likely to reflect machine color calibration.';
        content+='<p class="color-note">'+esc(note)+'</p>';
      }
      content+=buildUpgradeHtml(sd);
      if(visibility.metadata) content+='<button class="metadata-toggle stone-metadata-toggle" type="button">'+esc(visibility.metadataOpen?t('hideMetadata'):t('showMetadata'))+'</button><div class="metadata-panel"'+(visibility.metadataOpen?'':' hidden')+'>'+buildMetadataHtml(m,i)+'</div>';
      if(sd.sourcePath) content+='<p class="capture-source mono">'+esc(sd.sourcePath)+'</p>';
    }
    var row=document.createElement('div'); row.className='stone-row'; row.style.animation='cardIn .4s ease backwards'; row.style.animationDelay=(i*40)+'ms'; row.innerHTML=head+content; list.appendChild(row);
    animatedNumber(row.querySelector('.stone-score-num'),'stone:'+m.id+':'+st.id,sv);
  });
};

/* Add translation keys used only by the real-data layer. */
LANG.en.statusUnknown='insufficient data'; LANG.gu.statusUnknown='અપૂરતો ડેટા';
LANG.en.vUnknown='not available'; LANG.gu.vUnknown='ઉપલબ્ધ નથી';

/* Real-report actions. */
var printBtn=document.getElementById('printBtn'); if(printBtn) printBtn.addEventListener('click',function(){window.print();});
var dataBtn=document.getElementById('downloadDataBtn'); if(dataBtn) dataBtn.addEventListener('click',function(){
  var clone=JSON.parse(JSON.stringify(reportData));
  Object.keys(clone.references||{}).forEach(function(tier){
    Object.keys(clone.references[tier]||{}).forEach(function(stoneId){
      var assets=clone.references[tier][stoneId]&&clone.references[tier][stoneId].assets;
      if(assets) Object.keys(assets).forEach(function(k){if(assets[k]) delete assets[k].dataUrl;});
    });
  });
  (clone.machines||[]).forEach(function(m){(m.stonesData||[]).forEach(function(sd){
    if(sd&&sd.assets){Object.keys(sd.assets).forEach(function(k){if(sd.assets[k]) delete sd.assets[k].dataUrl;});}
  });});
  var blob=new Blob([JSON.stringify(clone,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='V360_Machine_Health_Audit_Data.json'; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
});
