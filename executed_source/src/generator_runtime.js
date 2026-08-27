/* V360 Machine Health Audit Generator — real capture processing pipeline */
var REPORT_TEMPLATE = __REPORT_TEMPLATE__;

var state = {
  folders:{ideal:null,cust:null,v50:null,v50edf:null},
  thumbnailUrls:[],
  reportUrls:[],
  lastResult:null
};

function localDateInput(){
  var d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
document.getElementById('reportDate').value=localDateInput();

function esc(v){
  return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function isFiniteNumber(v){return typeof v==='number'&&isFinite(v);}
function avg(arr){var v=arr.filter(isFiniteNumber);return v.length?v.reduce(function(a,b){return a+b;},0)/v.length:null;}
function stddev(arr){var v=arr.filter(isFiniteNumber);if(!v.length)return null;var a=avg(v);return Math.sqrt(v.reduce(function(s,x){return s+Math.pow(x-a,2);},0)/v.length);}
function naturalSort(a,b){return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});}
function filePath(file){return String(file.webkitRelativePath||file.name||'').replace(/\\/g,'/');}
function fileParts(file){return filePath(file).split('/').filter(Boolean);}
function rootNameOf(files){var a=Array.from(files||[]);return a.length?(fileParts(a[0])[0]||''):'';}
function basename(file){var p=fileParts(file);return (p[p.length-1]||'').toLowerCase();}
function makeSlot(id){return {id:'D-'+id,stone:String(id),json:null,still:null,video:null,paths:[],duplicates:[]};}
function findStoneSegment(parts){
  for(var i=1;i<parts.length-1;i++){
    var m=parts[i].match(/^D-([1-6])(?:-(.+))?$/i);
    if(m)return {index:i,stone:m[1],machineSuffix:m[2]||null,segment:parts[i]};
  }
  return null;
}
function assignCaptureFile(slot,file){
  var base=basename(file),path=filePath(file); slot.paths.push(path);
  if(base==='0.json'){
    if(slot.json)slot.duplicates.push(path); else slot.json=file;
  } else if(/^still\.(jpe?g|png|webp)$/i.test(base)){
    if(!slot.still || base==='still.jpg')slot.still=file;
  } else if(base==='video.mp4'){
    if(!slot.video)slot.video=file;
  }
}

function indexReferenceFolder(files){
  var arr=Array.from(files||[]).sort(function(a,b){return naturalSort(filePath(a),filePath(b));});
  var slots={}; for(var s=1;s<=6;s++)slots[String(s)]=makeSlot(s);
  arr.forEach(function(file){var hit=findStoneSegment(fileParts(file));if(hit)assignCaptureFile(slots[hit.stone],file);});
  return {rootName:rootNameOf(arr),slots:slots,stones:Object.keys(slots).filter(function(k){return slots[k].paths.length;}).sort(),jsonStones:Object.keys(slots).filter(function(k){return !!slots[k].json;}).sort()};
}
function displayMachineName(raw){raw=String(raw||'').trim();if(!raw)return 'Machine';return /^machine\b/i.test(raw)?raw:'Machine '+raw;}
function indexCustomerFolder(files){
  var arr=Array.from(files||[]).sort(function(a,b){return naturalSort(filePath(a),filePath(b));}), root=rootNameOf(arr), map={},patterns={};
  arr.forEach(function(file){
    var parts=fileParts(file),hit=findStoneSegment(parts);if(!hit)return;
    var raw,pattern;
    if(hit.machineSuffix){raw=hit.machineSuffix;pattern='flat';}
    else {raw=hit.index>1?parts[hit.index-1]:root;pattern='nested';}
    var key=String(raw||'machine').trim();
    if(!map[key]){var slots={};for(var s=1;s<=6;s++)slots[String(s)]=makeSlot(s);map[key]={key:key,name:displayMachineName(key),slots:slots,patterns:{}};}
    map[key].patterns[pattern]=true;patterns[pattern]=true;assignCaptureFile(map[key].slots[hit.stone],file);
  });
  var machines=Object.keys(map).map(function(k){
    var m=map[k];m.stones=Object.keys(m.slots).filter(function(s){return m.slots[s].paths.length;}).sort();
    m.jsonStones=Object.keys(m.slots).filter(function(s){return !!m.slots[s].json;}).sort();return m;
  }).sort(function(a,b){return naturalSort(a.name,b.name);});
  var p=Object.keys(patterns);return {rootName:root,machines:machines,pattern:p.length>1?'mixed':(p[0]||'none')};
}

function revokeThumbnails(){state.thumbnailUrls.forEach(function(u){try{URL.revokeObjectURL(u);}catch(e){}});state.thumbnailUrls=[];}
function thumbnailUrl(file){if(!file)return null;var u=URL.createObjectURL(file);state.thumbnailUrls.push(u);return u;}
function stoneCompletenessHtml(index){
  var found=index.stones.length,json=index.jsonStones.length;
  if(found===6&&json===6)return '<span class="detection-ok">✓ 6 of 6 master stones detected, with all six 0.json files</span>';
  if(found===0)return '<span class="detection-bad">No recognizable D-1…D-6 capture folders found.</span>';
  var missing=[1,2,3,4,5,6].filter(function(s){return index.stones.indexOf(String(s))<0;}), missingJson=[1,2,3,4,5,6].filter(function(s){return index.jsonStones.indexOf(String(s))<0;});
  return '<span class="detection-warn">⚠ '+found+'/6 stone folders and '+json+'/6 usable 0.json files. '+(missing.length?'Missing folders: D-'+missing.join(', D-')+'. ':'')+(missingJson.length?'Missing 0.json: D-'+missingJson.join(', D-')+'.':'')+'</span>';
}
function renderStoneDetection(elId,pathElId,files,key){
  var arr=Array.from(files||[]),index=indexReferenceFolder(arr);state.folders[key]={rootName:index.rootName,files:arr,index:index};
  document.getElementById(pathElId).textContent=index.rootName+' ('+arr.length+' files)';document.getElementById(elId).innerHTML=stoneCompletenessHtml(index);updateNextButton();
}
function renderMachineDetection(files){
  revokeThumbnails();var arr=Array.from(files||[]),index=indexCustomerFolder(arr);state.folders.cust={rootName:index.rootName,files:arr,index:index,pattern:index.pattern};
  document.getElementById('custPath').textContent=index.rootName+' ('+arr.length+' files)';var panel=document.getElementById('custDetection');
  if(!index.machines.length){panel.innerHTML='<span class="detection-bad">No machine folders recognized. Use nested Machine/D-1/0.json or flat D-1-machine/0.json folders.</span>';updateNextButton();return;}
  var complete=index.machines.filter(function(m){return m.jsonStones.length===6;}).length;
  var html='<span class="'+(complete===index.machines.length?'detection-ok':'detection-warn')+'">✓ '+index.machines.length+' machine(s) detected ('+esc(index.pattern)+' layout), '+complete+' with all six 0.json files</span><div class="machine-grid">';
  index.machines.forEach(function(m){
    var th='<div class="thumb-strip">';for(var s=1;s<=6;s++){var slot=m.slots[String(s)],u=thumbnailUrl(slot.still);th+=u?'<img src="'+esc(u)+'" alt="D-'+s+'">':'<div class="thumb-missing" title="D-'+s+' still image not found"></div>'; }th+='</div>';
    html+='<div class="machine-chip"><div class="m-name mono">'+esc(m.name)+'</div><div class="m-stones '+(m.jsonStones.length===6?'detection-ok':'detection-warn')+'">'+m.jsonStones.length+'/6 JSON captures</div>'+th+'</div>';
  });
  panel.innerHTML=html+'</div>';updateNextButton();
}

document.getElementById('idealInput').addEventListener('change',function(e){renderStoneDetection('idealDetection','idealPath',e.target.files,'ideal');});
document.getElementById('v50Input').addEventListener('change',function(e){renderStoneDetection('v50Detection','v50Path',e.target.files,'v50');});
document.getElementById('v50edfInput').addEventListener('change',function(e){renderStoneDetection('v50edfDetection','v50edfPath',e.target.files,'v50edf');});
document.getElementById('custInput').addEventListener('change',function(e){renderMachineDetection(e.target.files);});

function updateNextButton(){
  var idealOk=state.folders.ideal&&state.folders.ideal.index.jsonStones.length===6;
  var custOk=state.folders.cust&&state.folders.cust.index.machines.length>0&&state.folders.cust.index.machines.some(function(m){return m.jsonStones.length>0;});
  document.getElementById('toStep3').disabled=!(idealOk&&custOk);
}
function goToStep(n){
  if(n===3&&document.getElementById('toStep3').disabled)return;
  document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('active');});document.getElementById('panel'+n).classList.add('active');
  document.querySelectorAll('.step-btn').forEach(function(b){var s=+b.getAttribute('data-step');b.classList.toggle('active',s===n);b.classList.toggle('done',s<n);});
}
document.getElementById('toStep2').addEventListener('click',function(){goToStep(2);});
document.getElementById('toStep1').addEventListener('click',function(){goToStep(1);});
document.getElementById('toStep2Back').addEventListener('click',function(){goToStep(2);});
document.querySelectorAll('.step-btn').forEach(function(b){b.addEventListener('click',function(){var n=+b.getAttribute('data-step');if(n<3||!document.getElementById('toStep3').disabled){if(n===3)buildReview();goToStep(n);}});});
document.getElementById('toStep3').addEventListener('click',function(){buildReview();goToStep(3);});

function customerObject(){
  var result={},fields={name:'custName',preparedBy:'preparedBy',reportDate:'reportDate',contactPerson:'contactPerson',location:'location'};
  Object.keys(fields).forEach(function(k){var v=document.getElementById(fields[k]).value;if(v&&v.trim())result[k]=v.trim();});return result;
}
function buildManifest(){
  var manifest={customer:customerObject(),generatedAt:new Date().toISOString(),folders:{}};
  ['ideal','cust','v50','v50edf'].forEach(function(k){var f=state.folders[k];if(!f)return;if(k==='cust')manifest.folders[k]={rootName:f.rootName,pattern:f.index.pattern,machines:f.index.machines.map(function(m){return {name:m.name,stonesDetected:m.stones,jsonDetected:m.jsonStones};})};else manifest.folders[k]={rootName:f.rootName,stonesDetected:f.index.stones,jsonDetected:f.index.jsonStones};});
  return manifest;
}
function buildReview(){
  var c=customerObject(),labels={name:'Customer',preparedBy:'Prepared by',reportDate:'Report date',contactPerson:'Contact person',location:'Location'},html='';
  Object.keys(labels).forEach(function(k){if(c[k])html+='<div class="review-row"><span class="rv-label">'+labels[k]+'</span><span class="rv-val">'+esc(c[k])+'</span></div>';});
  document.getElementById('reviewCustomer').innerHTML=html||'<p style="font-size:13px;color:var(--text-muted)">No customer details entered.</p>';
  var fh='';if(state.folders.ideal)fh+='<div class="review-row"><span class="rv-label">Ideal reference</span><span class="rv-val">'+esc(state.folders.ideal.rootName)+' · '+state.folders.ideal.index.jsonStones.length+'/6 JSON captures</span></div>';
  if(state.folders.cust)fh+='<div class="review-row"><span class="rv-label">Customer machines</span><span class="rv-val">'+esc(state.folders.cust.rootName)+' · '+state.folders.cust.index.machines.length+' machines</span></div>';
  if(state.folders.v50)fh+='<div class="review-row"><span class="rv-label">5.0 reference</span><span class="rv-val">'+esc(state.folders.v50.rootName)+' · '+state.folders.v50.index.jsonStones.length+'/6 JSON captures</span></div>';
  if(state.folders.v50edf)fh+='<div class="review-row"><span class="rv-label">5.0 EDF reference</span><span class="rv-val">'+esc(state.folders.v50edf.rootName)+' · '+state.folders.v50edf.index.jsonStones.length+'/6 JSON captures</span></div>';
  document.getElementById('reviewFolders').innerHTML=fh;
}

function getCI(obj,key){if(!obj||typeof obj!=='object')return undefined;if(Object.prototype.hasOwnProperty.call(obj,key))return obj[key];var target=String(key).toLowerCase(),keys=Object.keys(obj);for(var i=0;i<keys.length;i++)if(keys[i].toLowerCase()===target)return obj[keys[i]];return undefined;}
function firstDefined(){for(var i=0;i<arguments.length;i++)if(arguments[i]!==undefined&&arguments[i]!==null&&arguments[i]!=='')return arguments[i];return undefined;}
function unwrapCapture(value){
  if(typeof value==='string'){try{return unwrapCapture(JSON.parse(value));}catch(e){return null;}}
  if(Array.isArray(value)){for(var i=0;i<value.length;i++){var c=unwrapCapture(value[i]);if(c)return c;}return null;}
  if(!value||typeof value!=='object')return null;
  if(getCI(value,'visionProfile')||getCI(value,'currentProfile')||getCI(value,'OldRGB')||getCI(value,'NewRGB')||getCI(value,'TotalTime'))return value;
  var keys=['data','capture','record','result','payload'];for(var k=0;k<keys.length;k++){var nested=getCI(value,keys[k]);if(nested){var found=unwrapCapture(nested);if(found)return found;}}
  return null;
}
function toNumber(v){if(typeof v==='number'&&isFinite(v))return v;if(typeof v==='string'){var n=parseFloat(v.replace(/[^0-9.+-]/g,''));return isFinite(n)?n:null;}return null;}
function parseRgb(v){
  if(Array.isArray(v)&&v.length>=3)return v.slice(0,3).map(function(x){return clamp(Math.round(+x||0),0,255);});
  if(typeof v!=='string')return null;var m=v.match(/-?\d+(?:\.\d+)?/g);if(!m||m.length<3)return null;return m.slice(0,3).map(function(x){return clamp(Math.round(parseFloat(x)),0,255);});
}
function parseDuration(v){
  if(typeof v==='number'&&isFinite(v))return v;if(typeof v!=='string')return null;var s=v.trim();
  if(/^\d+(?:\.\d+)?$/.test(s))return parseFloat(s);var parts=s.split(':').map(Number);if(parts.some(function(x){return !isFinite(x);}))return null;
  if(parts.length===3)return parts[0]*3600+parts[1]*60+parts[2];if(parts.length===2)return parts[0]*60+parts[1];return null;
}
function normalizeImageBase64(v){if(typeof v!=='string'||v.length<100)return null;if(/^data:image\//i.test(v))return v;var cleaned=v.replace(/\s+/g,'');if(!/^[A-Za-z0-9+/=]+$/.test(cleaned))return null;return 'data:image/jpeg;base64,'+cleaned;}
function displayValue(v){if(v===undefined||v===null||v==='')return '—';if(typeof v==='boolean')return v?'True':'False';return String(v);}

var META_FIELDS=[
  {name:'Capture settings',fields:[['AV','profile','AV'],['TV','profile','TV'],['ISO','profile','ISO'],['K','profile','K'],['WB','profile','WB'],['PictureStyle','profile','pictureStyle'],['Quality','profile','quality'],['Sharpness','profile','sharpness'],['Contrast','profile','contrast'],['Saturation','profile','saturation'],['ColorTone','profile','colorTone']]},
  {name:'Frame / image settings',fields:[['Width','profile','width'],['Height','profile','height'],['ImageQuality','top','ImageQuality']]},
  {name:'Lighting / tone settings',fields:[['Gamma','top','Gamma'],['MinInputLevel','top','MinInputLevel'],['MaxInputLevel','top','MaxInputLevel'],['MinOutputLevel','top','MinOutputLevel'],['MaxOutputLevel','top','MaxOutputLevel'],['Tolerance','profile','tolerance']]},
  {name:'Machine / software',fields:[['Camera','top','Camera'],['CameraAppVersion','profile','cameraAppVersion'],['MachineName','top','MachineName'],['StoneType','profile','stoneType'],['IsFreeze','profile','isFreeze']]},
  {name:'Profile',fields:[['VisionProfile','profile','lightName']]}
];
function extractMetadata(top,profile){var flat={};META_FIELDS.forEach(function(sec){sec.fields.forEach(function(f){var source=f[1]==='profile'?profile:top;var val=getCI(source,f[2]);if(f[0]==='MachineName'&&(val===undefined||val===null))val=getCI(profile,'machineName');flat[f[0]]=displayValue(val);});});return flat;}
function equalValues(a,b){if(a==='—'&&b==='—')return true;var na=toNumber(a),nb=toNumber(b);if(na!==null&&nb!==null)return Math.abs(na-nb)<1e-9;return String(a).trim().toLowerCase()===String(b).trim().toLowerCase();}
function compareMetadata(mach,ideal){return {sections:META_FIELDS.map(function(sec){return {name:sec.name,rows:sec.fields.map(function(f){var field=f[0],mv=mach[field],iv=ideal[field];return {field:field,mach:mv,ideal:iv,mismatch:!equalValues(mv,iv)};})};})};}

async function parseCaptureFile(file){
  if(!file)return {ok:false,error:'0.json not found'};
  try{
    var text=await file.text();if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);var top=unwrapCapture(JSON.parse(text));if(!top)throw new Error('JSON does not contain a capture object');
    var vp=getCI(top,'visionProfile')||{},profile=getCI(vp,'currentProfile')||getCI(vp,'lockedProfile')||getCI(top,'currentProfile')||{};
    if(typeof profile==='string'){try{profile=JSON.parse(profile);}catch(e){profile={};}}
    var r=toNumber(getCI(profile,'R')),g=toNumber(getCI(profile,'G')),b=toNumber(getCI(profile,'B'));
    var diamond=(r!==null&&g!==null&&b!==null)?[clamp(r,0,255),clamp(g,0,255),clamp(b,0,255)]:null;
    var oldRgb=parseRgb(firstDefined(getCI(profile,'OldRGB'),getCI(top,'OldRGB'))),newRgb=parseRgb(firstDefined(getCI(profile,'NewRGB'),getCI(top,'NewRGB')));
    var sharpness=toNumber(getCI(profile,'sharpness')),contrast=toNumber(getCI(profile,'contrast'));
    return {ok:true,path:filePath(file),diamondRgb:diamond,backgroundRgb:oldRgb,oldRgb:oldRgb,newRgb:newRgb,sharpness:sharpness,contrast:contrast,totalSeconds:parseDuration(firstDefined(getCI(top,'TotalTime'),getCI(profile,'TotalTime'))),metadata:extractMetadata(top,profile),imageBase64:normalizeImageBase64(getCI(top,'image')),warnings:[].concat(diamond?[]:['R/G/B fields missing'],oldRgb?[]:['OldRGB missing'],newRgb?[]:['NewRGB missing'],sharpness!==null?[]:['sharpness missing'],contrast!==null?[]:['contrast missing'])};
  }catch(e){return {ok:false,path:filePath(file),error:e&&e.message?e.message:String(e)};}
}
function missingIdealFields(capture){
  var missing=[];
  if(!capture||!capture.ok)return ['valid capture object'];
  if(!Array.isArray(capture.diamondRgb))missing.push('R/G/B');
  if(!Array.isArray(capture.oldRgb))missing.push('OldRGB');
  if(!Array.isArray(capture.newRgb))missing.push('NewRGB');
  if(!isFiniteNumber(capture.sharpness))missing.push('sharpness');
  if(!isFiniteNumber(capture.contrast))missing.push('contrast');
  if(!isFiniteNumber(capture.totalSeconds)||capture.totalSeconds<=0)missing.push('TotalTime');
  return missing;
}

function readBlobAsDataUrl(blob){return new Promise(function(resolve,reject){var fr=new FileReader();fr.onload=function(){resolve(fr.result);};fr.onerror=function(){reject(fr.error||new Error('FileReader failed'));};fr.readAsDataURL(blob);});}
async function optimizedStill(file,budget){
  if(!file)return null;
  try{
    var bitmap=await createImageBitmap(file),maxDim=720,scale=Math.min(1,maxDim/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
    var canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;var ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,w,h);if(bitmap.close)bitmap.close();
    var blob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/jpeg',0.86);});if(!blob)throw new Error('Image conversion failed');
    if(budget.imageBytes+blob.size>budget.imageMax){budget.warnings.push('Still-image embed budget exceeded; '+filePath(file)+' was omitted.');return {name:file.name,path:filePath(file),dataUrl:null,omitted:true};}
    budget.imageBytes+=blob.size;return {name:file.name,path:filePath(file),dataUrl:await readBlobAsDataUrl(blob),bytes:blob.size};
  }catch(e){
    if(budget.imageBytes+file.size>budget.imageMax){budget.warnings.push('Still-image embed budget exceeded; '+filePath(file)+' was omitted.');return {name:file.name,path:filePath(file),dataUrl:null,omitted:true};}
    try{budget.imageBytes+=file.size;return {name:file.name,path:filePath(file),dataUrl:await readBlobAsDataUrl(file),bytes:file.size};}catch(err){budget.warnings.push('Could not embed '+filePath(file)+': '+err.message);return {name:file.name,path:filePath(file),dataUrl:null,error:err.message};}
  }
}
async function embeddedVideo(file,budget,enabled){
  if(!file)return null;var base={name:file.name,path:filePath(file),bytes:file.size,dataUrl:null};if(!enabled)return base;
  if(budget.videoBytes+file.size>budget.videoMax){budget.warnings.push('Video embed budget exceeded; '+filePath(file)+' was omitted.');base.omitted=true;return base;}
  try{budget.videoBytes+=file.size;base.dataUrl=await readBlobAsDataUrl(file);return base;}catch(e){budget.warnings.push('Could not embed video '+filePath(file)+': '+e.message);base.error=e.message;return base;}
}
async function captureAssets(slot,capture,budget,embedVideos){
  var still=await optimizedStill(slot&&slot.still,budget);
  if(!still&&capture&&capture.imageBase64){still={name:'0.json embedded image',path:capture.path+'#image',dataUrl:capture.imageBase64};}
  return {still:still,video:await embeddedVideo(slot&&slot.video,budget,embedVideos)};
}

function rgbDistance(a,b){if(!Array.isArray(a)||!Array.isArray(b))return null;return Math.sqrt(Math.pow(a[0]-b[0],2)+Math.pow(a[1]-b[1],2)+Math.pow(a[2]-b[2],2));}
function weightedScore(parts,weights){var total=0,sum=0;Object.keys(parts).forEach(function(k){var v=parts[k],w=weights[k]||0;if(isFiniteNumber(v)&&w>0){sum+=v*w;total+=w;}});return total?Math.round(clamp(sum/total,0,100)):null;}
function readCalibration(){
  function n(id,fallback){var v=parseFloat(document.getElementById(id).value);return isFinite(v)&&v>=0?v:fallback;}
  return {version:'provisional-v1.0 · 22 Aug 2026',color:{method:'Euclidean RGB',pointsPerUnit:n('colorPenalty',2.5),okDistance:3,warnDistance:8},picture:{sharpnessPenalty:n('sharpnessPenalty',12),contrastPenalty:n('contrastPenalty',8)},consistency:{meanPenalty:n('consistencyMeanPenalty',2.5),variabilityPenalty:n('consistencyVarPenalty',2)},correction:{pointsPerExcess:n('correctionPenalty',2.5),variabilityPenalty:n('correctionVarPenalty',1),okExcess:8,warnExcess:25},speed:{method:'min(100, 100 × ideal seconds / machine seconds)'},weights:{color:30,picture:20,consistency:20,speed:12,correction:18},thresholds:{healthy:80,danger:60}};
}
function scoreDistance(d,penalty){return isFiniteNumber(d)?clamp(100-d*penalty,0,100):null;}
function scorePicture(sharpDiff,contrastDiff,cal){if(!isFiniteNumber(sharpDiff)&&!isFiniteNumber(contrastDiff))return null;return clamp(100-(isFiniteNumber(sharpDiff)?sharpDiff*cal.sharpnessPenalty:0)-(isFiniteNumber(contrastDiff)?contrastDiff*cal.contrastPenalty:0),0,100);}
function scoreSpeed(machineSeconds,idealSeconds){if(!isFiniteNumber(machineSeconds)||!isFiniteNumber(idealSeconds)||machineSeconds<=0||idealSeconds<=0)return null;return clamp(100*idealSeconds/machineSeconds,0,100);}
function correctionDistance(c){return c&&Array.isArray(c.oldRgb)&&Array.isArray(c.newRgb)?rgbDistance(c.oldRgb,c.newRgb):null;}
function makeStoneData(id,mach,ideal,assets,cal){
  var dDist=rgbDistance(mach.diamondRgb,ideal.diamondRgb),bDist=rgbDistance(mach.backgroundRgb,ideal.backgroundRgb);
  var sharpDiff=isFiniteNumber(mach.sharpness)&&isFiniteNumber(ideal.sharpness)?Math.abs(mach.sharpness-ideal.sharpness):null;
  var contrastDiff=isFiniteNumber(mach.contrast)&&isFiniteNumber(ideal.contrast)?Math.abs(mach.contrast-ideal.contrast):null;
  var machCorr=correctionDistance(mach),idealCorr=correctionDistance(ideal),over=isFiniteNumber(machCorr)&&isFiniteNumber(idealCorr)?machCorr-idealCorr:null;
  var components={color:scoreDistance(dDist,cal.color.pointsPerUnit),picture:scorePicture(sharpDiff,contrastDiff,cal.picture),consistency:scoreDistance(bDist,cal.consistency.meanPenalty),correction:isFiniteNumber(over)?clamp(100-Math.max(0,over)*cal.correction.pointsPerExcess,0,100):null,speed:scoreSpeed(mach.totalSeconds,ideal.totalSeconds)};
  return {id:'D-'+id,available:true,score:weightedScore(components,cal.weights),componentScores:components,color:{diamond:{mach:mach.diamondRgb,ideal:ideal.diamondRgb,dist:dDist},bg:{mach:mach.backgroundRgb,ideal:ideal.backgroundRgb,dist:bDist}},quality:{sharpness:{mach:mach.sharpness,ideal:ideal.sharpness,diff:sharpDiff},contrast:{mach:mach.contrast,ideal:ideal.contrast,diff:contrastDiff}},correction:{mach:machCorr,ideal:idealCorr,over:over},speed:{machSeconds:mach.totalSeconds,idealSeconds:ideal.totalSeconds,score:components.speed},metadata:compareMetadata(mach.metadata,ideal.metadata),assets:{machineStill:assets.still,machineVideo:assets.video},sourcePath:mach.path,warnings:(mach.warnings||[]).slice()};
}
function aggregateMachine(id,stonesData,cal){
  var valid=stonesData.filter(function(s){return s&&s.available;});
  var color=avg(valid.map(function(s){return s.componentScores.color;})),picture=avg(valid.map(function(s){return s.componentScores.picture;})),speed=avg(valid.map(function(s){return s.componentScores.speed;}));
  var residuals=valid.filter(function(s){return Array.isArray(s.color.bg.mach)&&Array.isArray(s.color.bg.ideal);}).map(function(s){return s.color.bg.mach.map(function(v,i){return v-s.color.bg.ideal[i];});});
  var bgMean=avg(valid.map(function(s){return s.color.bg.dist;})),variability=null;
  if(residuals.length){var meanVec=[0,1,2].map(function(i){return avg(residuals.map(function(r){return r[i];}));});variability=Math.sqrt(avg(residuals.map(function(r){return Math.pow(r[0]-meanVec[0],2)+Math.pow(r[1]-meanVec[1],2)+Math.pow(r[2]-meanVec[2],2);})));}
  var consistency=isFiniteNumber(bgMean)?clamp(100-bgMean*cal.consistency.meanPenalty-(isFiniteNumber(variability)?variability*cal.consistency.variabilityPenalty:0),0,100):null;
  var overs=valid.map(function(s){return s.correction.over;}).filter(isFiniteNumber).map(function(x){return Math.max(0,x);}),meanOver=avg(overs),overStd=stddev(overs);
  var correction=isFiniteNumber(meanOver)?clamp(100-meanOver*cal.correction.pointsPerExcess-(isFiniteNumber(overStd)?overStd*cal.correction.variabilityPenalty:0),0,100):null;
  var scores={color:isFiniteNumber(color)?Math.round(color):null,picture:isFiniteNumber(picture)?Math.round(picture):null,consistency:isFiniteNumber(consistency)?Math.round(consistency):null,correction:isFiniteNumber(correction)?Math.round(correction):null,speed:isFiniteNumber(speed)?Math.round(speed):null};scores.composite=weightedScore(scores,cal.weights);
  return {scores:scores,rawMetrics:{meanDiamondDistance:avg(valid.map(function(s){return s.color.diamond.dist;})),meanBackgroundDistance:bgMean,backgroundResidualVariability:variability,meanCorrectionExcess:meanOver,correctionExcessStdDev:overStd,meanMachineSeconds:avg(valid.map(function(s){return s.speed.machSeconds;})),meanIdealSeconds:avg(valid.map(function(s){return s.speed.idealSeconds;}))}};
}
function aggregateFixes(stonesData){
  var valid=stonesData.filter(function(s){return s&&s.available;}),groups={};
  valid.forEach(function(s){(s.metadata.sections||[]).forEach(function(sec){(sec.rows||[]).forEach(function(r){if(!r.mismatch)return;var key=r.field+'|'+r.mach+'|'+r.ideal;if(!groups[key])groups[key]={field:r.field,actual:r.mach,ideal:r.ideal,count:0,total:valid.length};groups[key].count++;});});});
  return Object.keys(groups).map(function(k){return groups[k];}).sort(function(a,b){return b.count-a.count||naturalSort(a.field,b.field);});
}

function setProgress(done,total,message){var pct=total?Math.round(done/total*100):0;document.getElementById('progressFill').style.width=pct+'%';document.getElementById('progressMessage').textContent=message+' · '+pct+'%';}
function clearLog(){document.getElementById('logBox').innerHTML='';}
function logLine(type,text){var el=document.createElement('div');el.className='log-line '+(type||'');el.textContent=text;document.getElementById('logBox').appendChild(el);}
function showError(text){var e=document.getElementById('processError');e.textContent=text;e.hidden=false;}
function hideError(){document.getElementById('processError').hidden=true;}

async function processReference(folder,key,budget,embedVideos,progress){
  var result={},index=folder?folder.index:null;if(!index)return result;
  for(var s=1;s<=6;s++){
    var slot=index.slots[String(s)];if(!slot||!slot.json){progress.step(key+' D-'+s+' skipped');continue;}
    var cap=await parseCaptureFile(slot.json),assets=null;if(cap.ok)assets=await captureAssets(slot,cap,budget,embedVideos);result['D-'+s]={capture:cap,assets:assets};
    if(!cap.ok)progress.warnings.push(key+' D-'+s+': '+cap.error);else if(cap.warnings.length)progress.warnings.push(key+' D-'+s+': '+cap.warnings.join(', '));progress.step(key+' D-'+s+' read');
  }
  return result;
}
function referenceExport(refs){var out={};Object.keys(refs).forEach(function(id){var r=refs[id];if(!r||!r.capture||!r.capture.ok)return;out[id]={assets:r.assets,totalSeconds:r.capture.totalSeconds,sharpness:r.capture.sharpness,contrast:r.capture.contrast,sourcePath:r.capture.path};});return out;}

function safeJsonForScript(data){return JSON.stringify(data).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
function buildReportHtml(data){var injection='<script>window.V360_REPORT_DATA='+safeJsonForScript(data)+';</scr'+'ipt>';return REPORT_TEMPLATE.replace('<!--V360_REPORT_DATA-->',injection);}
function sanitizeFilename(v){return String(v||'Customer').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'Customer';}
function downloadBlob(blob,name){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},2000);}
function stripMedia(data){
  var clone=JSON.parse(JSON.stringify(data));
  Object.keys(clone.references||{}).forEach(function(t){Object.keys(clone.references[t]||{}).forEach(function(s){var a=clone.references[t][s].assets||{};Object.keys(a).forEach(function(k){if(a[k])delete a[k].dataUrl;});});});
  (clone.machines||[]).forEach(function(m){(m.stonesData||[]).forEach(function(sd){if(sd&&sd.assets)Object.keys(sd.assets).forEach(function(k){if(sd.assets[k])delete sd.assets[k].dataUrl;});});});return clone;
}

async function processAudit(){
  hideError();document.getElementById('resultBox').hidden=true;document.getElementById('progressBox').hidden=false;document.getElementById('generateBtn').disabled=true;clearLog();
  try{
    if(!state.folders.ideal||state.folders.ideal.index.jsonStones.length!==6)throw new Error('The ideal reference must contain valid 0.json files for all six master stones.');
    if(!state.folders.cust||!state.folders.cust.index.machines.length)throw new Error('No customer machines were detected.');
    var allowPartial=document.getElementById('allowPartial').checked,embedVideos=document.getElementById('embedVideos').checked,videoBudgetMb=clamp(parseFloat(document.getElementById('videoBudgetMb').value)||250,0,2000),cal=readCalibration();
    var budget={imageBytes:0,imageMax:80*1024*1024,videoBytes:0,videoMax:videoBudgetMb*1024*1024,warnings:[]};
    var total=6+(state.folders.v50?6:0)+(state.folders.v50edf?6:0)+state.folders.cust.index.machines.length*6,done=0,warnings=[];
    var progress={warnings:warnings,step:function(message){done++;setProgress(done,total,message);}};setProgress(0,total,'Starting capture validation');
    logLine('','Reading calibrated reference captures…');var ideal=await processReference(state.folders.ideal,'Ideal',budget,embedVideos,progress);
    var validIdeal=Object.keys(ideal).filter(function(k){return ideal[k].capture&&ideal[k].capture.ok&&!missingIdealFields(ideal[k].capture).length;});
    if(validIdeal.length!==6){
      var idealProblems=[];for(var ii=1;ii<=6;ii++){var key='D-'+ii,entry=ideal[key],missing=entry&&entry.capture?missingIdealFields(entry.capture):['0.json'];if(missing.length)idealProblems.push(key+': '+missing.join(', '));}
      throw new Error('The ideal reference is not score-ready. '+validIdeal.length+'/6 captures contain every required field. '+idealProblems.join('; '));
    }
    var v50=state.folders.v50?await processReference(state.folders.v50,'5.0',budget,embedVideos,progress):{},v50edf=state.folders.v50edf?await processReference(state.folders.v50edf,'5.0 EDF',budget,embedVideos,progress):{};
    var machines=[],excluded=[];
    for(var mi=0;mi<state.folders.cust.index.machines.length;mi++){
      var src=state.folders.cust.index.machines[mi],stonesData=[];logLine('',src.name+': processing six master stones');
      for(var s=1;s<=6;s++){
        var slot=src.slots[String(s)],ref=ideal['D-'+s];
        if(!slot||!slot.json){stonesData.push({id:'D-'+s,available:false,reason:'0.json missing'});progress.step(src.name+' D-'+s+' missing');continue;}
        var mach=await parseCaptureFile(slot.json);if(!mach.ok){stonesData.push({id:'D-'+s,available:false,reason:mach.error,sourcePath:filePath(slot.json)});warnings.push(src.name+' D-'+s+': '+mach.error);progress.step(src.name+' D-'+s+' invalid');continue;}
        var assets=await captureAssets(slot,mach,budget,embedVideos),sd=makeStoneData(s,mach,ref.capture,assets,cal);stonesData.push(sd);if(mach.warnings.length)warnings.push(src.name+' D-'+s+': '+mach.warnings.join(', '));progress.step(src.name+' D-'+s+' scored');
      }
      var matched=stonesData.filter(function(x){return x.available;}).length,missing=stonesData.filter(function(x){return !x.available;}).map(function(x){return x.id;});
      if(matched<6&&!allowPartial){excluded.push({id:src.name,matched:matched,expected:6,missing:missing,reason:'Incomplete machine; strict six-stone policy selected.'});logLine('warn',src.name+' excluded: '+matched+'/6 matched stones.');continue;}
      if(matched===0){excluded.push({id:src.name,matched:0,expected:6,missing:missing,reason:'No valid matched captures.'});logLine('error',src.name+' excluded: no valid matched captures.');continue;}
      var agg=aggregateMachine(src.name,stonesData,cal);machines.push({id:src.name,scores:agg.scores,stonesData:stonesData,coverage:{matched:matched,expected:6,partial:matched<6,missing:missing},recommendedFixes:aggregateFixes(stonesData),rawMetrics:agg.rawMetrics});logLine(matched===6?'ok':'warn',src.name+' scored '+agg.scores.composite+'/100 from '+matched+'/6 stones.');
    }
    warnings=warnings.concat(budget.warnings);
    var manifest=buildManifest(),data={schemaVersion:'1.0.0',mode:'real',generatedAt:new Date().toISOString(),customer:manifest.customer,manifest:manifest,stones:[{id:'D-1',shape:'Master stone'},{id:'D-2',shape:'Master stone'},{id:'D-3',shape:'Master stone'},{id:'D-4',shape:'Princess'},{id:'D-5',shape:'Master stone'},{id:'D-6',shape:'Master stone'}],calibration:cal,sourceSummary:{idealRoot:state.folders.ideal.rootName,customerRoot:state.folders.cust.rootName,customerPattern:state.folders.cust.index.pattern,hasV50:Object.keys(v50).length>0,hasV50Edf:Object.keys(v50edf).length>0,partialPolicy:allowPartial?'score-and-flag':'strict-exclude',videosEmbedded:embedVideos,imageBytesEmbedded:budget.imageBytes,videoBytesEmbedded:budget.videoBytes},references:{ideal:referenceExport(ideal),v50:referenceExport(v50),v50edf:referenceExport(v50edf)},machines:machines,excludedMachines:excluded,warnings:warnings};
    var html=buildReportHtml(data),customer=sanitizeFilename(data.customer.name),reportName='V360_Machine_Health_Report_'+customer+'.html';state.lastResult={data:data,manifest:manifest,html:html,reportName:reportName};
    document.getElementById('resultMachines').textContent=machines.length;document.getElementById('resultExcluded').textContent=excluded.length;document.getElementById('resultWarnings').textContent=warnings.length;document.getElementById('reportSize').textContent=(new Blob([html]).size/1024/1024).toFixed(1)+' MB standalone report';document.getElementById('resultBox').hidden=false;
    warnings.forEach(function(w){logLine('warn',w);});if(!warnings.length)logLine('ok','All required fields parsed without warnings.');setProgress(total,total,'Audit package ready');
  }catch(e){showError(e&&e.message?e.message:String(e));logLine('error',e&&e.stack?e.stack:String(e));}
  finally{document.getElementById('generateBtn').disabled=false;}
}

document.getElementById('generateBtn').addEventListener('click',processAudit);
document.getElementById('openReportBtn').addEventListener('click',function(){if(!state.lastResult)return;var u=URL.createObjectURL(new Blob([state.lastResult.html],{type:'text/html'}));state.reportUrls.push(u);var w=window.open(u,'_blank');if(!w)showError('The browser blocked the report tab. Allow pop-ups for this local file or use Download standalone report.');});
document.getElementById('downloadReportBtn').addEventListener('click',function(){if(state.lastResult)downloadBlob(new Blob([state.lastResult.html],{type:'text/html'}),state.lastResult.reportName);});
document.getElementById('downloadAuditBtn').addEventListener('click',function(){if(state.lastResult)downloadBlob(new Blob([JSON.stringify(stripMedia(state.lastResult.data),null,2)],{type:'application/json'}),'V360_Machine_Health_Audit_Data.json');});
document.getElementById('downloadManifestBtn').addEventListener('click',function(){if(state.lastResult)downloadBlob(new Blob([JSON.stringify(state.lastResult.manifest,null,2)],{type:'application/json'}),'manifest.json');});
window.addEventListener('beforeunload',function(){state.thumbnailUrls.concat(state.reportUrls).forEach(function(u){try{URL.revokeObjectURL(u);}catch(e){}});});
