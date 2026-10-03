/* Device-local drafts, isolated by GitHub Pages project path and checklist. */
(() => {
  'use strict';
  const base = 'cadet-checklists-v3:' + location.pathname.replace(/[^/]*$/, '');
  const blank = () => ({header:{},answers:{},counts:{},hazards:[],signoffs:{},remarks:'',debrief:''});
  const text = v => typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
  function normalize(raw,map) {
    const d=blank();raw=raw&&typeof raw==='object'?raw:{};
    for(const f of map.headerFields)d.header[f.id]=text(raw.header?.[f.id]);
    for(const item of map.items){const a=raw.answers?.[item.id];d.answers[item.id]={choice:['yes','no',...(item.naAllowed?['na']:[])].includes(a?.choice)?a.choice:'',comment:text(a?.comment),fields:{}};for(const f of item.extraFields||[])d.answers[item.id].fields[f.id]=text(a?.fields?.[f.id]);}
    for(const group of map.headcounts){d.counts[group.id]={};for(const f of group.fields)d.counts[group.id][f.id]=text(raw.counts?.[group.id]?.[f.id]);}
    for(const s of map.signoffs){d.signoffs[s.id]={};for(const f of s.fields){const v=text(raw.signoffs?.[s.id]?.[f.id]);d.signoffs[s.id][f.id]=f.id==='signature'?(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v)?v:''):v;}}
    d.hazards=(Array.isArray(raw.hazards)?raw.hazards:[]).slice(0,map.hazards.length).map(h=>Object.fromEntries(['step','hazard','risk','control'].map(k=>[k,text(h?.[k])])));
    d.remarks=text(raw.remarks);d.debrief=text(raw.debrief);return d;
  }
  function read(id){const raw=localStorage.getItem(base+':'+id);return raw?JSON.parse(raw):null;}
  function save(id,draft){const entry={savedAt:new Date().toISOString(),draft};localStorage.setItem(base+':'+id,JSON.stringify(entry));return entry.savedAt;}
  function selected(id){if(id)localStorage.setItem(base+':selected',id);return localStorage.getItem(base+':selected');}
  function restore(entries){const prior=entries.map(e=>({id:e.id,raw:localStorage.getItem(base+':'+e.id)}));try{for(const e of entries)save(e.id,e.draft);}catch(error){for(const e of prior)try{if(e.raw===null)localStorage.removeItem(base+':'+e.id);else localStorage.setItem(base+':'+e.id,e.raw);}catch{}throw Error('Browser storage is full or unavailable. The backup was not restored.');}}
  function migrate(map){if(map.documentId!=='chapter-13'||read(map.documentId))return;const old=sessionStorage.getItem('saic-swim-draft-v2:'+location.pathname.replace(/[^/]*$/,''))||((location.pathname==='/'||location.pathname==='/index.html')?sessionStorage.getItem('saic-swim-draft-v1'):null);if(old)save(map.documentId,normalize(JSON.parse(old),map));}
  window.CadetStorage={base,blank,normalize,read,save,selected,migrate,restore};
})();
