/* Fill the selected original PDF without adding pages. */
(() => {
  'use strict';
  const value=v=>String(v ?? '').trim();
  const validCount=v=>/^\d{1,5}$/.test(String(v??''));
  function itemComplete(item,data,map) {
    const a=data.answers?.[item.id]||{};
    if(!['yes','no',...(item.naAllowed?['na']:[])].includes(a.choice))return false;
    if(['no','na'].includes(a.choice)&&!value(a.comment))return false;
    const key=item.countGroup;
    if(key){const fields=map?.headcounts.find(g=>g.id===key)?.fields;const counts=data.counts?.[key]||{};if(fields?!fields.every(f=>validCount(counts[f.id])):!Object.keys(counts).length||!Object.values(counts).every(validCount))return false;}
    if(a.choice==='yes'&&(item.extraFields||[]).some(f=>f.required&&!value(a.fields?.[f.id])))return false;
    return !(item.requiresDebrief&&a.choice==='yes'&&!value(data.debrief));
  }
  function report(map,data) {
    const missing=[],commentMissing=[];let answered=0;
    for(const f of map.headerFields)if(!value(data.header?.[f.id]))missing.push(f.label);
    for(const item of map.items){const a=data.answers?.[item.id]||{};const valid=['yes','no',...(item.naAllowed?['na']:[])].includes(a.choice);if(valid)answered++;else missing.push(`Check ${item.number}: unanswered`);if(valid&&['no','na'].includes(a.choice)&&!value(a.comment)){commentMissing.push(item);missing.push(`Check ${item.number}: mandatory comment missing`);}}
    for(const group of map.headcounts)for(const f of group.fields)if(!validCount(data.counts?.[group.id]?.[f.id]))missing.push(`${group.id} head count: ${f.label}`);
    for(const s of map.signoffs)for(const f of s.fields)if(!value(data.signoffs?.[s.id]?.[f.id]))missing.push(`${s.title}: ${f.label}`);
    if(map.items.some(i=>i.requiresDebrief&&data.answers?.[i.id]?.choice==='yes')&&!value(data.debrief))missing.push('Debrief notes');
    for(const item of map.items)for(const f of item.extraFields||[])if(f.required&&data.answers?.[item.id]?.choice==='yes'&&!value(data.answers?.[item.id]?.fields?.[f.id]))missing.push(`Check ${item.number}: ${f.label}`);
    (data.hazards||[]).forEach((h,n)=>{if(Object.values(h).some(value))for(const f of ['step','hazard','risk','control'])if(!value(h[f]))missing.push(`Hazard ${n+1}: ${f}`);});
    const sections=[{id:'activity',title:'Activity details',done:map.headerFields.filter(f=>value(data.header?.[f.id])).length,total:map.headerFields.length},...map.sections.map(s=>({id:s.id,title:s.id==='planning'?'Planning':s.id==='conduct'?'Conduct':'Post activity',done:map.items.filter(i=>i.section===s.id&&itemComplete(i,data,map)).length,total:s.count})),{id:'hazards',title:'Hazards & risks',done:(data.hazards||[]).filter(h=>['step','hazard','risk','control'].every(f=>value(h[f]))).length,total:(data.hazards||[]).filter(h=>Object.values(h).some(value)).length,optional:true},{id:'signoff',title:'Sign-off',done:map.signoffs.reduce((n,s)=>n+s.fields.filter(f=>value(data.signoffs?.[s.id]?.[f.id])).length,0),total:map.signoffs.reduce((n,s)=>n+s.fields.length,0)}];
    return {answered,completed:map.items.filter(i=>itemComplete(i,data,map)).length,missing,commentMissing,sections,complete:missing.length===0};
  }
  async function generate(map,data,sourceBytes) {
    const {PDFDocument,StandardFonts,rgb}=PDFLib;
    if(!sourceBytes){const response=await fetch(map.sourcePdf);if(!response.ok)throw Error('Original PDF unavailable');sourceBytes=await response.arrayBuffer();}
    const pdf=await PDFDocument.load(sourceBytes),font=await pdf.embedFont(StandardFonts.Helvetica),pages=pdf.getPages();
    const ink=rgb(.04,.23,.39),info=report(map,data),overflow=[];
    const formatted=(v,id)=>id==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v.split('-').reverse().join('/'):v;
    let measureCanvas;
    function width(text,size){try{return font.widthOfTextAtSize(text,size);}catch{if(typeof document==='undefined')throw Error('Unsupported text needs a browser');measureCanvas ||= document.createElement('canvas');const ctx=measureCanvas.getContext('2d');ctx.font=`${size}px Arial, sans-serif`;return ctx.measureText(text).width;}}
    function wrap(text,size,maxWidth){const out=[];for(const paragraph of String(text).replace(/\r/g,'').split('\n')){if(!paragraph){out.push('');continue;}let current='';for(const word of paragraph.split(/\s+/)){if(width((current?current+' ':'')+word,size)<=maxWidth){current+=(current?' ':'')+word;continue;}if(current){out.push(current);current='';}if(width(word,size)<=maxWidth){current=word;continue;}for(const ch of word){if(width(current+ch,size)>maxWidth&&current){out.push(current);current='';}current+=ch;}}out.push(current);}return out;}
    async function line(page,text,x,y,size=10,color=ink){if(!text)return;try{font.encodeText(text);page.drawText(text,{x,y,size,font,color});}catch{if(typeof document==='undefined')throw Error('Unsupported text needs a browser');const canvas=document.createElement('canvas'),scale=4;canvas.width=Math.ceil(width(text,size)*scale)+8;canvas.height=Math.ceil(size*1.7*scale);const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.font=`${size}px Arial, sans-serif`;ctx.fillStyle='#0a3b63';ctx.textBaseline='alphabetic';ctx.fillText(text,1,size*1.25);const image=await pdf.embedPng(canvas.toDataURL('image/png'));page.drawImage(image,{x:x-1,y:y-size*.45,width:canvas.width/scale,height:canvas.height/scale});}}
    async function boxes(text,regions,label,anchor,{size=10,minSize=8,nowrap=false}={}) {
      text=value(text);if(!text)return;
      const leading=1.15;let lines,used=size,capacities;
      while(used>=minSize){const maxWidth=Math.min(...regions.map(r=>r.rect.width));lines=nowrap?[text]:wrap(text,used,maxWidth);capacities=regions.map(r=>Math.max(0,Math.floor((r.rect.height-used)/(used*leading))+1));if(lines.length<=capacities.reduce((a,b)=>a+b,0)&&(!nowrap||width(text,used)<=maxWidth))break;used-=.5;}
      if(used<minSize){overflow.push({label,anchor});return;}
      let n=0;for(let r=0;r<regions.length;r++){const region=regions[r];let y=region.rect.y+region.rect.height-used;for(let j=0;j<capacities[r]&&n<lines.length;j++){await line(pages[region.pageIndex],lines[n++],region.rect.x,y,used);y-=used*leading;}}
    }
    async function box(pageIndex,text,rect,label,anchor,options){await boxes(text,[{pageIndex,rect}],label,anchor,options);}
    function cross(page,center){page.drawLine({start:{x:center.x-4,y:center.y-4},end:{x:center.x+4,y:center.y+4},thickness:1.6,color:ink});page.drawLine({start:{x:center.x-4,y:center.y+4},end:{x:center.x+4,y:center.y-4},thickness:1.6,color:ink});}
    const parts=item=>[item,...(item.continuations|| (item.continuation?[item.continuation]:[]))];
    const inset=rect=>({x:rect.x+5,y:rect.y+4,width:rect.width-10,height:rect.height-8});
    function clearComment(pageIndex,rect){pages[pageIndex].drawRectangle({x:rect.x+.8,y:rect.y+.8,width:rect.width-1.6,height:rect.height-1.6,color:rgb(1,1,1)});}
    for(const f of map.headerFields)await box(f.pageIndex,formatted(value(data.header?.[f.id]),f.id),f.rect,f.label,'activity',f.id==='date'?{size:10,minSize:7.5,nowrap:true}:undefined);
    for(const item of map.items){
      const a=data.answers?.[item.id]||{};
      if(['yes','no',...(item.naAllowed?['na']:[])].includes(a.choice))for(const part of parts(item))if(part[a.choice])cross(pages[part.pageIndex],part[a.choice]);
      if(value(a.comment)){
        const regions=parts(item).filter(p=>p.commentCell).map(p=>{clearComment(p.pageIndex,p.commentCell);return {pageIndex:p.pageIndex,rect:inset(p.commentCell)};});
        const countText=item.countGroup?map.headcounts.find(g=>g.id===item.countGroup).fields.map(f=>f.label+': '+(value(data.counts?.[item.countGroup]?.[f.id])||'[not entered]')).join('\n'):'';
        const extraText=(item.extraFields||[]).filter(f=>f.inComment).map(f=>f.label+': '+(value(a.fields?.[f.id])||'[not entered]')).join('\n');
        await boxes([value(a.comment),countText,extraText].filter(Boolean).join('\n'),regions,`Comment for check ${item.number}`,'question-'+item.id,{size:10,minSize:8});
      }
      for(const f of item.extraFields||[]){if(f.inComment&&value(a.comment))continue;const v=value(a.fields?.[f.id]);if(!v)continue;if(f.eraseRect)pages[f.pageIndex].drawRectangle({...f.eraseRect,color:rgb(1,1,1)});await box(f.pageIndex,f.preservePrintedLabel===false?f.label+': '+v:v,f.rect,`Check ${item.number}: ${f.label}`,'question-'+item.id,{size:10,minSize:8});}
    }
    for(const group of map.headcounts){
      const item=map.items.find(i=>i.countGroup===group.id);if(item&&value(data.answers?.[item.id]?.comment))continue;
      for(const f of group.fields){const n=value(data.counts?.[group.id]?.[f.id]);if(!n)continue;const page=pages[f.pageIndex];if(f.eraseRect)page.drawRectangle({...f.eraseRect,color:rgb(1,1,1)});await box(f.pageIndex,n,f.rect,`${group.id}: ${f.label}`,'question-'+item?.id,{size:10,minSize:8});}
    }
    const hazards=(data.hazards||[]).filter(h=>Object.values(h).some(value));
    if(hazards.length>map.hazards.length)overflow.push({label:`Only ${map.hazards.length} hazard rows fit the original form. Remove extra rows.`,anchor:'hazards'});
    for(let n=0;n<Math.min(hazards.length,map.hazards.length);n++)for(const f of map.hazards[n].fields)await box(map.hazards[n].pageIndex,value(hazards[n][f.id]),f.rect,`Hazard ${n+1}: ${f.id}`,'hazards',{size:9,minSize:8});
    for(const s of map.signoffs)for(const f of s.fields){const v=value(data.signoffs?.[s.id]?.[f.id]);if(!v)continue;if(f.id==='signature'){const image=await pdf.embedPng(v),scale=Math.min(f.rect.width/image.width,f.rect.height/image.height);pages[f.pageIndex].drawImage(image,{x:f.rect.x+(f.rect.width-image.width*scale)/2,y:f.rect.y+(f.rect.height-image.height*scale)/2,width:image.width*scale,height:image.height*scale});}else await box(f.pageIndex,formatted(v,f.id),f.rect,`${s.title}: ${f.label}`,'signoff');}
    const remarks=[value(data.remarks),value(data.debrief)?'Debrief notes:\n'+value(data.debrief):''].filter(Boolean).join('\n\n');
    await box(map.remarks.pageIndex,remarks,map.remarks.rect,'Remarks and debrief notes','signoff',{size:10,minSize:8});
    if(overflow.length){const error=new Error('Some answers are too long for the original form.');error.name='FitError';error.fields=overflow;throw error;}
    if(!info.complete)for(let n=0;n<map.pageCount;n++)await line(pages[n],'DRAFT - unfinished entries',72,42,8,rgb(.62,.27,.08));
    if(pdf.getPageCount()!==map.pageCount)throw Error('Unexpected page count');
    pdf.setTitle('SAIC - '+map.title+(info.complete?'':' - Draft'));pdf.setSubject('Entered answers on the original '+map.pageCount+'-page form');pdf.setCreator('Cadet Checklists');
    return await pdf.save();
  }
  const api={report,itemComplete,generate};if(typeof window!=='undefined')window.SwimPDF=api;if(typeof module!=='undefined')module.exports=api;
})();


