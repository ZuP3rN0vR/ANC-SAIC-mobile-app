(() => {
  'use strict';
  let catalog=[], activeId, observer;const maps=new Map();
  let map, draft, lastFile, lastUrl, signatureKey, penDown = false, ink = false;
  const empty = () => CadetStorage.normalize({},map);
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get = p => p.split('.').reduce((v,k) => v?.[k], draft) ?? '';
  const set = (p,v) => {const keys=p.split('.');let target=draft;keys.slice(0,-1).forEach(k=>target=target[k] ||= {});target[keys.at(-1)]=v;};
  const input = (path,label,type='text',wide=false,placeholder='') => `<label class="field ${wide?'full mobile-full':''}"><span>${escape(label)}</span><input type="${type}" data-path="${path}" value="${escape(get(path))}" ${type==='number'?'min="0" max="99999" step="1" inputmode="numeric"':''} ${type==='text'?'autocomplete="off"':''} placeholder="${escape(placeholder)}"></label>`;
  async function getMap(id){if(maps.has(id))return maps.get(id);const entry=catalog.find(c=>c.id===id);if(!entry)throw Error('Unknown checklist');const response=await fetch(entry.map);if(!response.ok)throw Error('Checklist unavailable');const result=await response.json();maps.set(id,result);return result;}
  function savedStatus(message,error=false){const el=document.getElementById('saveStatus');el.textContent=message;el.classList.toggle('error',error);}
  async function loadChecklist(id,scroll=true){
    const select=document.getElementById('checklistSelect');select.disabled=true;
    try{
      const next=await getMap(id);let saved;
      try{CadetStorage.migrate(next);saved=CadetStorage.read(id);}catch{savedStatus('Browser saving is unavailable. Download a backup before leaving.',true);}
      map=next;activeId=id;draft=CadetStorage.normalize(saved?.draft,map);render();clearPdf();update();observeSections();
      try{CadetStorage.selected(id);}catch{}
      const url=new URL(location.href);url.searchParams.set('checklist',id);if(scroll)url.hash='';history.replaceState(null,'',url);
      if(saved?.savedAt)savedStatus('Saved on this device · '+new Date(saved.savedAt).toLocaleString());else if(!document.getElementById('saveStatus').classList.contains('error'))savedStatus('Ready · your changes will save automatically');
      select.value=id;if(scroll)window.scrollTo({top:0,behavior:'instant'});
    }finally{select.disabled=false;}
  }
  async function init(){
    const response=await fetch('catalog.json');if(!response.ok)throw Error('Library unavailable');catalog=await response.json();
    const select=document.getElementById('checklistSelect');select.innerHTML=catalog.map(c=>`<option value="${escape(c.id)}">${String(c.chapter).padStart(2,'0')} · ${escape(c.title)}</option>`).join('');
    let savedId;try{savedId=CadetStorage.selected();}catch{}
    const wanted=new URL(location.href).searchParams.get('checklist')||savedId||'chapter-13';
    await loadChecklist(catalog.some(c=>c.id===wanted)?wanted:'chapter-13',false);wire();observeSections();
    window.SwimChecklist={get map(){return map},get draft(){return draft},get catalog(){return catalog},report:()=>SwimPDF.report(map,draft)};
  }
  function render() {
    document.getElementById('checklistTitle').textContent=map.title;document.title=map.title+' · Cadet checklists';
    document.getElementById('documentTag').textContent='SAIC · Chapter '+String(map.chapter).padStart(2,'0');
    document.getElementById('chapterLabel').textContent='ACTIVITY CHECKLIST / '+String(map.chapter).padStart(2,'0');
    document.querySelectorAll('.original-link,.source-pdf').forEach(a=>a.href=map.sourcePdf);
    document.getElementById('pagePromise').textContent='Export keeps the original '+map.pageCount+' pages.';
    document.getElementById('sourceGuidance').textContent=map.introduction||'This checklist complements ANP4914. Refer to the original form for the activity-specific guidance and references.';
    document.querySelector('.overview nav').innerHTML=[{id:'activity',title:'Activity details'},...map.sections.map(x=>({id:x.id,title:x.id==='planning'?'Planning':x.id==='conduct'?'Conduct':x.id==='post'?'Post activity':x.title})),{id:'hazards',title:'Hazards & risks'},{id:'signoff',title:'Sign-off'}].map((x,n)=>`<a href="#${x.id}" class="navlink"><span>${String(n+1).padStart(2,'0')}</span>${escape(x.title)}<b data-nav-count="${x.id}"></b></a>`).join('');
    document.getElementById('activityFields').innerHTML=map.headerFields.map(f=>input('header.'+f.id,f.label,f.id==='date'?'date':'text',['location','unit'].includes(f.id),f.id==='location'?'Activity location':'')).join('');
    document.getElementById('checklistSections').innerHTML=map.sections.map((section,index)=>{
      let category='';const rows=map.items.filter(i=>i.section===section.id).map(item=>{
        const a=draft.answers[item.id] || {};let html='';if(category!==item.category){category=item.category;html+=`<div class="group-label">${escape(category)}</div>`;}
        const required=['no','na'].includes(a.choice);const title=section.id==='post'?'Post activity':section.id==='planning'?'Activity planning':'Activity conduct';
        html+=`<article class="question ${required&&!a.comment?.trim()?'needs-comment':''}" id="question-${item.id}"><div class="question-top"><span class="question-number">${String(item.number).padStart(2,'0')}</span><h3 class="question-title" id="label-${item.id}">${escape(item.label)}</h3></div><div class="choice-group" role="group" aria-labelledby="label-${item.id}">${['yes','no',...(item.naAllowed?['na']:[])].map(c=>`<button type="button" class="choice ${c}" data-item="${item.id}" data-choice="${c}" aria-pressed="${a.choice===c}">${c==='na'?'N/A':c[0].toUpperCase()+c.slice(1)}</button>`).join('')}</div><details class="question-detail" ${required||a.comment?'open':''}><summary>${item.guidance?'Guidance & comment':'Add a comment'}<span class="comment-required ${required?'required':''}">${required?' · required':''}</span></summary>${item.guidance?`<p>${escape(item.guidance)}</p>`:''}<label class="field"><span>Comment <span class="optional-label">${required?'(required for '+(a.choice==='na'?'N/A':'No')+')':'(optional)'}</span></span><textarea rows="3" data-path="answers.${item.id}.comment" aria-label="Comment for check ${item.number}" ${required?'aria-required="true"':''} placeholder="Record details or explain your answer…">${escape(a.comment)}</textarea></label></details><p class="alert" ${a.choice==='no'?'':'hidden'}>Reassess the HRA or Standing Risk Profile before commencing; residual risk must be acceptable.</p>${item.countGroup?counts(item.countGroup):''}${extraFields(item)}${item.requiresDebrief?`<div class="question-detail"><label class="field"><span>Debrief notes <span class="required">${a.choice==='yes'?'(required when completed)':''}</span></span><textarea rows="4" data-path="debrief" aria-label="Debrief notes" placeholder="Included in the original form’s Remarks box.">${escape(draft.debrief)}</textarea></label></div>`:''}</article>`;
        return html;
      }).join('');
      return `<section class="panel" id="${section.id}"><div class="section-heading"><div><div class="eyebrow">0${index+2} / ${section.id==='post'?'AFTER THE ACTIVITY':section.id==='planning'?'BEFORE THE ACTIVITY':'DURING THE ACTIVITY'}</div><h2>${section.id==='post'?'Post activity':section.id==='planning'?'Activity planning':'Activity conduct'}</h2></div><span class="section-counter" data-section="${section.id}">0 / ${section.count}</span></div>${rows}</section>`;
    }).join('');
    renderHazards();
    document.getElementById('signoffFields').innerHTML=map.signoffs.map(s=>`<div class="signoff-block"><h3>${escape(s.title)}</h3><div class="field-grid">${s.fields.filter(f=>f.id!=='signature').map(f=>input(`signoffs.${s.id}.${f.id}`,f.label,f.id==='date'?'date':'text',f.id==='name')).join('')}<div class="field full"><span>Signature</span><div class="signature-box" id="signature-${s.id}">${signatureMarkup(s.id)}</div></div></div></div>`).join('');
    document.getElementById('remarks').value=draft.remarks || '';
  }
  function counts(key) {return `<div class="counts"><p>Confirmed numbers${key.startsWith('completion')?' at completion':key.startsWith('commencement')?' for this head count':''}</p><div class="count-grid">${map.headcounts.find(c=>c.id===key).fields.map(f=>input(`counts.${key}.${f.id}`,f.label,'number')).join('')}</div></div>`;}
  function extraFields(item){return (item.extraFields||[]).length?`<div class="extra-fields">${item.extraFields.map(f=>input(`answers.${item.id}.fields.${f.id}`,f.label+(f.required?' (required for Yes)':''),f.type||'text')).join('')}</div>`:'';}
  function signatureMarkup(key) {const data=draft.signoffs[key]?.signature;return `${data?`<img src="${data}" alt="Drawn signature"><button type="button" class="signature-delete" data-delete-signature="${key}">Remove</button>`:''}<button type="button" class="text-button" data-signature="${key}">${data?'Draw again':'Draw signature'}</button>`;}
  function renderHazards() {
    document.getElementById('addHazard').disabled=draft.hazards.length>=map.hazards.length;
    document.getElementById('addHazard').textContent=draft.hazards.length>=map.hazards.length?'All '+map.hazards.length+' hazard rows added':'+ Add a hazard';
    document.getElementById('hazardRows').innerHTML=draft.hazards.map((h,n)=>`<div class="hazard-row"><div class="hazard-top"><h3>Hazard ${n+1}</h3><button class="text-button remove-hazard" type="button" data-remove-hazard="${n}" aria-label="Remove hazard ${n+1}">Remove</button></div><div class="field-grid">${input(`hazards.${n}.step`,'Step', 'text',true,'Activity step or stage')}${['hazard','risk','control'].map(f=>`<label class="field full"><span>${f==='control'?'Control measure':f[0].toUpperCase()+f.slice(1)}</span><textarea rows="2" data-path="hazards.${n}.${f}">${escape(h[f])}</textarea></label>`).join('')}</div></div>`).join('');
  }
  function clearPdf(){lastFile=null;if(lastUrl){URL.revokeObjectURL(lastUrl);lastUrl=null;}document.getElementById('sharePdf').hidden=true;document.getElementById('openPdf').hidden=true;document.getElementById('exportStatus').textContent='';}
  function persist(){let saved=false;try{const date=CadetStorage.save(activeId,draft);savedStatus('Saved on this device · '+new Date(date).toLocaleTimeString());saved=true;}catch{savedStatus('Progress could not be saved. Download a backup before leaving.',true);}clearPdf();update();return saved;}
  function observeSections(){observer?.disconnect();observer=new IntersectionObserver(entries=>{entries.filter(e=>e.isIntersecting).forEach(e=>document.querySelectorAll('.navlink').forEach(a=>a.classList.toggle('active',a.hash==='#'+e.target.id)));},{rootMargin:'-10% 0px -65% 0px'});document.querySelectorAll('main>section, #checklistSections>section').forEach(s=>observer.observe(s));}
  async function backup(){
    const status=document.getElementById('backupStatus');try{
      const entries=[];for(const c of catalog){let entry;try{entry=CadetStorage.read(c.id);}catch{}if(c.id===activeId)entry={draft,savedAt:new Date().toISOString()};if(entry)entries.push({id:c.id,title:c.title,...entry});}
      const payload={format:'cadet-checklists-backup',version:1,createdAt:new Date().toISOString(),checklists:entries};
      const file=new File([JSON.stringify(payload,null,2)],'Cadet-Checklist-Progress-'+new Date().toISOString().slice(0,10)+'.json',{type:'application/json'});
      const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();
      status.textContent='Backup ready: '+entries.length+' checklist drafts. Save the downloaded file to keep your progress.';
      const share=document.getElementById('shareBackup');share.hidden=!(navigator.canShare&&navigator.canShare({files:[file]}));share.onclick=async()=>{try{await navigator.share({files:[file],title:'Checklist progress backup'});}catch(e){if(e.name!=='AbortError')status.textContent='Use the downloaded backup file.';}};
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){status.textContent='Backup could not be created. Your entries are still here.';console.error(e);}
  }
  async function restore(file){
    const status=document.getElementById('backupStatus');if(!file)return;try{
      if(file.size>15*1024*1024)throw Error('This file is too large to be a checklist backup.');
      const payload=JSON.parse(await file.text());if(payload.format!=='cadet-checklists-backup'||payload.version!==1||!Array.isArray(payload.checklists))throw Error('Choose a Cadet Checklist progress backup (.json).');
      const seen=new Set(),entries=[];
      for(const entry of payload.checklists){if(!catalog.some(c=>c.id===entry.id)||seen.has(entry.id))throw Error('This backup contains an unknown or duplicate checklist.');seen.add(entry.id);const m=await getMap(entry.id);entries.push({id:entry.id,draft:CadetStorage.normalize(entry.draft,m)});}
      if(!entries.length)throw Error('This backup contains no saved drafts.');
      if(!confirm('Restore '+entries.length+' checklist drafts? This replaces the saved progress for those checklists on this device.'))return;
      CadetStorage.restore(entries);
      await loadChecklist(activeId,false);status.textContent='Restored '+entries.length+' checklist drafts on this device.';
    }catch(e){status.textContent=e.message||'That backup could not be restored.';}
    finally{document.getElementById('restoreFile').value='';}
  }
  function update() {
    const report=SwimPDF.report(map,draft);const answered=report.completed;
    document.getElementById('progressCount').textContent=`${answered} / ${map.items.length}`;
    document.getElementById('progressBar').style.width=`${answered/map.items.length*100}%`;
    document.getElementById('progressDescription').textContent=answered===0?'Ready when you are':answered===map.items.length?'All checks complete':`${map.items.length-answered} checks remaining`;
    document.getElementById('bottomProgress').textContent=`${answered} of ${map.items.length} complete`;
    document.getElementById('bottomState').textContent=report.complete?'All form entries supplied':`${report.commentMissing.length?report.commentMissing.length+' required comments missing':'Draft · in progress'}`;
    map.sections.forEach(s=>{const el=document.querySelector(`[data-section="${s.id}"]`);const section=report.sections.find(x=>x.id===s.id);el.textContent=`${section.done} / ${section.total}`;});
    report.sections.forEach(s=>{const badge=document.querySelector(`[data-nav-count="${s.id}"]`);if(!badge)return;badge.textContent=s.optional&&s.total===0?'—':`${s.done}/${s.total}`;});
    const sectionLink=s=>`<a class="progress-row ${s.done===s.total?'is-complete':''}" href="#${s.id}"><span>${escape(s.title)}<small>${s.optional&&s.total===0?'No hazards recorded':s.done===s.total?'Complete':`${s.total-s.done} remaining`}</small></span><strong>${s.optional&&s.total===0?'—':`${s.done}/${s.total}`}</strong></a>`;
    document.getElementById('progressSections').innerHTML=report.sections.map(sectionLink).join('');
    const unfinished=report.sections.filter(s=>s.done<s.total);
    document.getElementById('unfinishedSections').innerHTML=unfinished.length?unfinished.map(sectionLink).join(''):'<p class="all-done">All sections are complete. Review your form, then export it.</p>';
    document.querySelectorAll('.export-button').forEach(b=>b.textContent=report.complete?'Export PDF':'Export draft PDF');
    document.getElementById('exportSummary').textContent=report.complete?'All form entries are supplied. Review your answers and sign-offs before using the document.':'You can export now. The PDF is marked as a draft while entries remain unfinished.';
    document.getElementById('missingSummary').innerHTML=report.commentMissing.length?`${report.commentMissing.length} mandatory ${report.commentMissing.length===1?'comment is':'comments are'} missing. <a href="#question-${report.commentMissing[0].id}">Go to first missing comment</a>`:report.missing.length?`${report.missing.length} ${report.missing.length===1?'entry remains':'entries remain'} unfinished.`:'';
  }
  function wire() {
    document.getElementById('checklistSelect').onchange=async e=>{const old=activeId;try{await loadChecklist(e.target.value);}catch(error){e.target.value=old;savedStatus('That checklist could not load. Your current entries are still here.',true);console.error(error);}};
    document.getElementById('saveProgress').onclick=persist;
    document.getElementById('backupProgress').onclick=backup;
    document.getElementById('restoreProgress').onclick=()=>document.getElementById('restoreFile').click();
    document.getElementById('restoreFile').onchange=e=>restore(e.target.files[0]);
    window.addEventListener('storage',async event=>{if(event.key===CadetStorage.base+':'+activeId)try{await loadChecklist(activeId,false);}catch{}});
    document.addEventListener('input',event=>{const path=event.target.dataset.path;if(!path)return;set(path,event.target.value);const q=event.target.closest('.question');if(q){const id=q.id.replace('question-','');const a=draft.answers[id]||{};q.classList.toggle('needs-comment',['no','na'].includes(a.choice)&&!a.comment?.trim());}persist();});
    document.addEventListener('click',event=>{
      const choice=event.target.closest('[data-choice]');if(choice){const id=choice.dataset.item;const a=draft.answers[id] ||= {};a.choice=a.choice===choice.dataset.choice?'':choice.dataset.choice;const q=choice.closest('.question');q.querySelectorAll('[data-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.choice===a.choice)));const required=['no','na'].includes(a.choice);const details=q.querySelector('details');if(required)details.open=true;q.querySelector('.comment-required').textContent=required?' · required':'';q.querySelector('.comment-required').classList.toggle('required',required);q.querySelector('.optional-label').textContent=required?`(required for ${a.choice==='na'?'N/A':'No'})`:'(optional)';q.querySelector('textarea').setAttribute('aria-required',String(required));q.querySelector('.alert').hidden=a.choice!=='no';q.classList.toggle('needs-comment',required&&!a.comment?.trim());persist();}
      const sign=event.target.closest('[data-signature]');if(sign)openSignature(sign.dataset.signature);
      const removeSign=event.target.closest('[data-delete-signature]');if(removeSign){draft.signoffs[removeSign.dataset.deleteSignature].signature='';document.getElementById('signature-'+removeSign.dataset.deleteSignature).innerHTML=signatureMarkup(removeSign.dataset.deleteSignature);persist();}
      const remove=event.target.closest('[data-remove-hazard]');if(remove){draft.hazards.splice(Number(remove.dataset.removeHazard),1);renderHazards();persist();}
    });
    document.getElementById('addHazard').onclick=()=>{if(draft.hazards.length>=map.hazards.length)return;draft.hazards.push({step:'',hazard:'',risk:'',control:''});renderHazards();persist();document.querySelector('#hazardRows .hazard-row:last-child input').focus();};
    document.getElementById('showProgress').onclick=()=>document.getElementById('progressDialog').showModal();
    document.getElementById('mobileProgress').onclick=()=>document.getElementById('progressDialog').showModal();
    document.getElementById('progressDialog').addEventListener('click',event=>{if(event.target.closest('a[href^="#"]'))document.getElementById('progressDialog').close();});
    document.getElementById('newForm').onclick=()=>{if(!confirm('Clear the saved '+map.title+' checklist? Download a backup or export it first to keep a copy. Other checklists will keep their progress.'))return;draft=empty();render();persist();window.scrollTo({top:0,behavior:'smooth'});};
    document.querySelectorAll('.export-button').forEach(b=>b.onclick=exportPdf);
    document.getElementById('sharePdf').onclick=async()=>{if(!lastFile)return;try{await navigator.share({files:[lastFile],title:'SAIC '+map.title});}catch(error){if(error.name!=='AbortError')document.getElementById('exportStatus').textContent='Sharing is unavailable here. Use Open PDF, then your browser’s Share or Download option.';}};
    const canvas=document.getElementById('signatureCanvas'), ctx=canvas.getContext('2d');ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#17364c';
    const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};
    canvas.onpointerdown=e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);penDown=true;const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.1,p.y+.1);ctx.stroke();ink=true;};
    canvas.onpointermove=e=>{if(!penDown)return;e.preventDefault();const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();};
    canvas.onpointerup=canvas.onpointercancel=()=>{penDown=false;};
    document.getElementById('clearSignature').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ink=false;};
    document.getElementById('saveSignature').onclick=()=>{if(!ink)return;const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let x1=canvas.width,y1=canvas.height,x2=0,y2=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]){x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y);}const crop=document.createElement('canvas');crop.width=x2-x1+13;crop.height=y2-y1+13;crop.getContext('2d').drawImage(canvas,x1-6,y1-6,crop.width,crop.height,0,0,crop.width,crop.height);draft.signoffs[signatureKey] ||= {};draft.signoffs[signatureKey].signature=crop.toDataURL('image/png');document.getElementById('signature-'+signatureKey).innerHTML=signatureMarkup(signatureKey);document.getElementById('signatureDialog').close();persist();};

  }
  function openSignature(key) {signatureKey=key;const canvas=document.getElementById('signatureCanvas');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);ink=false;document.getElementById('signatureTitle').textContent=map.signoffs.find(s=>s.id===key)?.title||'Draw your signature';document.getElementById('signatureDialog').showModal();}
  async function exportPdf() {
    const buttons=[...document.querySelectorAll('.export-button')];buttons.forEach(b=>{b.disabled=true;b.textContent='Preparing PDF…';});
    const status=document.getElementById('exportStatus');status.textContent='Preparing your original form with the entered answers…';
    try {
      const selectedMap=map,selectedId=activeId,snapshot=JSON.stringify(draft),frozen=JSON.parse(snapshot);const result=await SwimPDF.generate(selectedMap,frozen);if(activeId!==selectedId||JSON.stringify(draft)!==snapshot){const stale=new Error('Entries changed during export');stale.name='StaleExport';throw stale;}const prefix=(SwimPDF.report(map,frozen).complete?'':'DRAFT-')+'SAIC-'+String(map.chapter).padStart(2,'0')+'-'+map.title.replace(/[^a-zA-Z0-9 -]/g,'').replace(/ +/g,'-');const filename=[prefix,frozen.header.date||'',String(frozen.header.unit||'').replace(/[^a-zA-Z0-9 -]/g,'').trim().slice(0,45)].filter(Boolean).join('-')+'.pdf';
      lastFile=new File([result],filename,{type:'application/pdf'});if(lastUrl)URL.revokeObjectURL(lastUrl);lastUrl=URL.createObjectURL(lastFile);
      const open=document.getElementById('openPdf');open.href=lastUrl;open.hidden=false;const share=document.getElementById('sharePdf');share.hidden=!(navigator.canShare&&navigator.share&&navigator.canShare({files:[lastFile]}));
      const download=document.createElement('a');download.href=lastUrl;download.download=filename;document.body.append(download);download.click();download.remove();
      status.textContent='Your PDF is ready. If it didn’t download, tap Open PDF. On iPhone, use Share PDF or the PDF viewer’s Share button to save it to Files.';
      document.getElementById('exportArea').scrollIntoView({behavior:'smooth',block:'center'});
    }catch(error){if(error.name==='StaleExport'){status.textContent='Your entries changed while the PDF was being prepared. Export again to include your latest answers.';}else if(error.name==='FitError'){status.innerHTML='<strong>Shorten these entries to fit the original form:</strong><ul>'+error.fields.map(f=>`<li><a href="#${escape(f.anchor)}">${escape(f.label)}</a></li>`).join('')+'</ul>Your entries are still here. No extra pages will be added.';}else{status.textContent='The PDF could not be created. Your entries are still here. Please try again.';console.error(error);}document.getElementById('exportArea').scrollIntoView({behavior:'smooth'});}
    finally{buttons.forEach(b=>b.disabled=false);update();}
  }
  init().catch(error=>{console.error(error);document.getElementById('loadError').hidden=false;});
})();





