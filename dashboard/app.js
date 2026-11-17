(() => {
  'use strict';
  const D = window.RADAR_DATA;
  if (!D || !Array.isArray(D.rows)) return;
  const $ = s => document.querySelector(s);
  const money = n => n == null ? '—' : '$' + new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n);
  const pct = n => n == null ? 'n/r' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let mode='all', sort='rank', direction=1, category='', query='', selected=null;

  $('#as-of').textContent=D.as_of;
  $('#row-count').textContent=D.rows.length;
  $('#stat-targets').textContent=D.rows.length;
  $('#stat-watch').textContent=D.watchlist_size;
  $('#stat-early').textContent=D.rows.filter(r=>r.tvl_usd<D.floor_usd).length;
  $('#stat-live').textContent=D.live.length;
  $('#factor-list').innerHTML=Object.entries(D.model).map(([k,v])=>`<div class="factor"><span>${esc(k.replaceAll('_',' ').toUpperCase())}</span><p>${esc(v)}</p></div>`).join('');
  const catSelect=$('#category');
  D.categories.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;catSelect.append(o);});
  const comps=$('#comps');
  comps.innerHTML=D.live.map(p=>`<div class="comp"><b>${esc(p.name)}</b><small>${esc(p.category||'Unclassified')} · ${money(p.tvl_usd)} TVL</small><strong>${money(p.mcap_usd)} mcap</strong></div>`).join('');

  function filtered(){
    return D.rows.filter(r=>{
      if(mode==='watch'&&!r.on_watchlist)return false;
      if(mode==='early'&&r.tvl_usd>=D.floor_usd)return false;
      if(category&&r.category!==category)return false;
      if(query&&!`${r.name} ${r.slug} ${r.category||''} ${r.chains.join(' ')}`.toLowerCase().includes(query))return false;
      return true;
    }).sort((a,b)=>{
      const av=a[sort]??-Infinity,bv=b[sort]??-Infinity;
      if(typeof av==='string')return av.localeCompare(bv)*direction;
      return (av-bv)*direction;
    });
  }
  function render(){
    const rows=filtered();
    $('#visible-count').textContent=`· ${rows.length}`;
    $('#range-label').textContent=`${rows.length} RECORD${rows.length===1?'':'S'} / ${D.rows.length}`;
    $('#empty').classList.toggle('hidden',rows.length>0);
    $('#rows').innerHTML=rows.map(r=>{
      const c=r.change_7d, width=c==null?0:Math.max(4,Math.min(100,Math.abs(c)*2));
      return `<tr data-slug="${esc(r.slug)}"><td><span class="rank ${r.rank<=3?'top':''}">${String(r.rank).padStart(2,'0')}</span></td><td><div class="protocol"><span class="token-icon">${esc(r.name.slice(0,1).toUpperCase())}</span><span><span class="pname">${esc(r.name)} ${r.on_watchlist?'<i class="watch-tag">FLOOR</i>':''}</span><span class="slug">${esc(r.slug)}</span></span></div></td><td><span class="category-tag">${esc(r.category||'Unclassified')}</span><span class="chains"> · ${esc(r.chains.slice(0,2).join(' / '))}</span></td><td class="money">${money(r.tvl_usd)}</td><td><span class="change ${c==null?'na':c>=0?'pos':'neg'}">${pct(c)}</span><span class="bar"><i style="width:${width}%"></i></span></td><td class="value">${money(r.implied_value_usd)}</td><td class="open-row">↗</td></tr>`;
    }).join('');
    $('#rows').querySelectorAll('tr').forEach(tr=>tr.addEventListener('click',()=>openDetail(tr.dataset.slug)));
  }
  function openDetail(slug){
    const r=D.rows.find(x=>x.slug===slug); if(!r)return; selected=r;
    const f=r.factors;
    const factors=[['Peer multiple',f.peer_multiple,8],['7d momentum',f.momentum,1.5],['Operating age',f.maturity,1],['Chain breadth',f.breadth,1.25],['Category adoption',f.category_adoption,1]];
    $('#detail').innerHTML=`<div class="detail-rank">RADAR TARGET / RANK ${String(r.rank).padStart(2,'0')}</div><h2 class="detail-title">${esc(r.name)}</h2><div class="detail-slug">${esc(r.slug)}</div><div class="detail-tags">${r.on_watchlist?'<span>WATCHLIST FLOOR</span>':''}<span>${esc(r.category||'Unclassified')}</span><span>NO TOKEN RECORDED</span><span>${esc(r.chains.join(' · ')||'Chain n/r')}</span></div><div class="detail-value"><small>MODELLED IMPLIED VALUE · SNAPSHOT CLAIM</small><strong>${money(r.implied_value_usd)}</strong></div><div class="metrics"><div class="metric"><small>TVL</small><b>${money(r.tvl_usd)}</b></div><div class="metric"><small>7D TVL CHANGE</small><b>${pct(r.change_7d)}</b></div><div class="metric"><small>TRACKED SINCE</small><b>${esc(r.listed_at||'Date n/r')}</b></div><div class="metric"><small>CHAIN COUNT</small><b>${r.chains.length}</b></div></div><section class="detail-section"><h3>MODEL FACTORS / MULTIPLIERS</h3>${factors.map(([label,v,max])=>`<div class="factor-row"><span>${label}</span><span class="factor-track"><i style="width:${Math.max(4,Math.min(100,(Number(v)/Number(max))*100))}%"></i></span><b>${Number(v).toFixed(2)}×</b></div>`).join('')}<p class="model-note">Peer multiple ${Number(f.peer_multiple).toFixed(2)}× · age ${f.age_days==null?'unknown':f.age_days+' days'}. Value is TVL^0.94 × category peer multiple × momentum × maturity × breadth × adoption.</p></section><section class="detail-section"><h3>FIELD PLAN / COST + TIME INCLUDED</h3>${r.farm_steps.map((s,i)=>`<div class="step"><b>STEP 0${i+1}</b>${esc(s)}</div>`).join('')}</section><p class="model-note">This record reports no token in the sealed snapshot. Confirm the current contract, campaign and risks through official channels before using funds.</p>`;
    $('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');$('#shade').classList.remove('hidden');document.body.style.overflow='hidden';
  }
  function close(){ $('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#shade').classList.add('hidden');document.body.style.overflow=''; }
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render();}));
  document.querySelectorAll('[data-sort]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.sort;if(sort===key)direction*=-1;else{sort=key;direction=key==='rank'?1:-1;}render();}));
  catSelect.addEventListener('change',()=>{category=catSelect.value;render();});
  $('#search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render();});
  $('#close').addEventListener('click',close);$('#shade').addEventListener('click',close);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  $('#toggle-comps').addEventListener('click',e=>{const opening=comps.classList.contains('hidden');comps.classList.toggle('hidden');e.currentTarget.innerHTML=opening?'Hide comparables <span>−</span>':'Show comparables <span>＋</span>';});
  render();
})();
