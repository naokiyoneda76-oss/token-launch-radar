// Signal model and farm-plan generator for the Nightwatch launch radar.
// All score inputs come from the sealed snapshot; tokenized protocols are comparables only.

export interface Protocol {
  slug: string; name: string; category: string | null; chains: string[]; tvl_usd: number;
  change_7d: number | null; mcap_usd: number | null; listed_at: string | null;
  gecko_id: string | null; symbol: string | null;
}
export interface Snapshot { as_of: string; source: string; floor_usd: number; protocols: Protocol[]; watchlist: string[] }
export interface Factor { peer_multiple: number; momentum: number; maturity: number; breadth: number; category_adoption: number; age_days: number | null }
export interface Row extends Protocol {
  rank: number; implied_value_usd: number; token_status: 'pre-token'; on_watchlist: boolean; factors: Factor; farm_steps: string[];
}
export interface RadarData {
  as_of: string; floor_usd: number; watchlist_size: number; rows: Row[]; live: Protocol[];
  categories: string[]; model: { peer_multiple: string; momentum: string; maturity: string; breadth: string; adoption: string };
}

const day = 86_400_000;
function ageDays(asOf: string, date: string | null): number | null {
  const a = Date.parse(asOf + 'T00:00:00Z'), b = date ? Date.parse(date + 'T00:00:00Z') : NaN;
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((a - b) / day)) : null;
}
function median(values: number[]): number {
  if (!values.length) return 0.25;
  const v = [...values].sort((a,b) => a-b), m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m-1]! + v[m]!) / 2;
}
function clamp(n:number, lo:number, hi:number):number { return Math.min(hi, Math.max(lo, n)); }

/** Farm plans use category-specific tasks, real chain labels, and explicit capital/time estimates. */
function farmSteps(p: Protocol): string[] {
  const chain = p.chains[0] || 'the protocol’s primary chain';
  const second = p.chains.find(c => c !== chain) || chain;
  const cat = (p.category || '').toLowerCase();
  const ticket = Math.max(25, Math.min(250, Math.round(p.tvl_usd / 20_000_000)));
  const templates: [RegExp, string[]][] = [
    [/lend|borrow|credit|money market/, [
      `Supply a liquid asset in the ${chain} lending market, keep utilization below 70%, and save the position receipt for later withdrawals.`,
      `Borrow a small amount against your supplied collateral on ${chain}; repay after one day and repeat only if the health factor stays above 2.0.`,
      `Compare rates on ${second}, then move a portion of the deposit there if the official app supports native markets; record both positions.`,
    ]],
    [/dex|exchange|liquid|yield|farm|vault|aggregator/, [
      `Add a balanced ${ticket} USD liquidity position on ${chain} in a deep pool; keep the LP receipt and avoid volatile pairs you cannot manage.`,
      `Make a small swap through the official ${chain} interface, then withdraw and review the fee and slippage before adding more volume.`,
      `If the protocol exposes vault deposits, test with ${ticket} USD on ${second}; claim any displayed points weekly and retain transaction records.`,
    ]],
    [/derivative|perpetual|option|trading/, [
      `Open and close a low leverage position on ${chain} with at most ${ticket} USD margin; check funding and liquidation price before signing.`,
      `Place one limit order and cancel it after execution review on ${chain}; keep exposure small and do not wash trade for volume.`,
      `Check the official campaign or points page weekly; if active, complete its real user tasks and save the points balance.`,
    ]],
    [/bridge|cross.chain|messaging/, [
      `Send a small, useful transfer between ${chain} and ${second} through the official route; confirm destination receipt before repeating.`,
      `Return a portion to ${chain} after settlement and note fees and wait time; avoid rapid round trips that add no real usage.`,
      `Check official ${chain} docs for a testnet or quest campaign; complete only live tasks with a published reward or badge.`,
    ]],
    [/chain|rollup|infrastructure|oracle|data|restaking|security/, [
      `Use the official ${chain} app or testnet for one normal transaction and record the wallet address and resulting explorer receipt.`,
      `If a public testnet is open, run its documented faucet and test flow on ${chain}; budget up to ${ticket} USD for mainnet gas only.`,
      `Review governance or official quests for ${second}; complete a proposal vote, attestation, or quest only when genuinely eligible.`,
    ]],
  ];
  const selected = templates.find(([re]) => re.test(cat))?.[1] || [
    `Use the protocol’s core product on ${chain} with a ${ticket} USD test position and keep a record of the deposit and exit.`,
    `Repeat one genuine core action on ${second} if supported; compare the official app’s fees and retain the resulting receipt.`,
    `Check official documentation and governance on ${chain} for a current points, testnet, or quest program before spending more.`,
  ];
  const capital = `Cost: $${ticket}–$${ticket*2} capital plus about $1–$8 gas.`;
  return selected.map((s, i) => `${s} ${capital} Time: ${i === 1 ? '10–20 minutes' : '15–30 minutes'} per action; revisit weekly.`);
}

/** Generate scores from category token comps, momentum, operating age, chain breadth and adoption frequency. */
export function buildRadar(snapshot: Snapshot): { board: Row[]; radar: RadarData } {
  const all = snapshot.protocols;
  const live = all.filter(p => p.mcap_usd !== null && p.mcap_usd > 0).sort((a,b) => (b.mcap_usd||0)-(a.mcap_usd||0)).slice(0,30);
  const categories = new Map<string, { total: number; token: number; ratios: number[] }>();
  for (const p of all) {
    const k = p.category || 'Unclassified', e = categories.get(k) || { total:0, token:0, ratios:[] };
    e.total++;
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) { e.token++; e.ratios.push(p.mcap_usd / p.tvl_usd); }
    categories.set(k,e);
  }
  const globalRatio = median([...categories.values()].flatMap(e=>e.ratios));
  const index = new Map(all.map(p=>[p.slug,p]));
  const chosen = new Map<string,Protocol>();
  for (const slug of snapshot.watchlist) { const p=index.get(slug); if (p && p.mcap_usd === null) chosen.set(slug,p); }
  const early = all.filter(p=>p.mcap_usd===null && p.tvl_usd<snapshot.floor_usd && p.category!=='CEX')
    .sort((a,b)=>b.tvl_usd-a.tvl_usd || a.slug.localeCompare(b.slug)).slice(0,160);
  for (const p of early) chosen.set(p.slug,p);
  const scored = [...chosen.values()].map(p=>{
    const entry=categories.get(p.category||'Unclassified')!;
    const peer = entry.ratios.length ? median(entry.ratios) : globalRatio;
    const adoption=entry.total ? entry.token/entry.total : 0;
    const age=ageDays(snapshot.as_of,p.listed_at);
    const momentum=clamp(1+(clamp(p.change_7d ?? 0,-60,120)/100)*0.35,0.72,1.42);
    const maturity=0.62+0.38*(Math.min(age ?? 365,1460)/1460);
    const breadth=1+Math.min(Math.max(p.chains.length-1,0),7)*0.035;
    const category_adoption=0.62+0.38*Math.sqrt(adoption);
    const tvlScale=Math.pow(Math.max(p.tvl_usd,1),0.94);
    const value=Math.max(1,Math.round(tvlScale*clamp(peer,0.03,8)*momentum*maturity*breadth*category_adoption));
    return {p,value,age,factors:{peer_multiple:peer,momentum,maturity,breadth,category_adoption,age_days:age}};
  }).sort((a,b)=>b.value-a.value || a.p.slug.localeCompare(b.p.slug));
  const watchSet=new Set(snapshot.watchlist);
  const board:Row[]=scored.map((s,i)=>({...s.p,rank:i+1,implied_value_usd:s.value,token_status:'pre-token',on_watchlist:watchSet.has(s.p.slug),factors:s.factors,farm_steps:farmSteps(s.p)}));
  // Integer rounding can create occasional upward ties only; sorted values retain non-increasing order.
  const radar:RadarData={as_of:snapshot.as_of,floor_usd:snapshot.floor_usd,watchlist_size:snapshot.watchlist.length,rows:board,live,categories:[...categories.keys()].sort(),
    model:{peer_multiple:'Median token mcap / TVL among tokenized peers in the category; global median fallback.',momentum:'1 + 0.35 × clamped 7d TVL change, bounded 0.72–1.42.',maturity:'0.62 + 0.38 × age/1,460 days; unknown age uses 365 days.',breadth:'1 + 0.035 for each additional chain, capped at eight chains.',adoption:'0.62 + 0.38 × square root of tokenized share in category.'}};
  return {board,radar};
}

export function dataScript(data: RadarData): string { return `window.RADAR_DATA=${JSON.stringify(data)};\n`; }

/** Gate-oriented validation before output files are written. */
export function boardIssue(rows: Row[], snapshot: Snapshot): string | null {
  const allowed=new Set(snapshot.protocols.map(p=>p.slug)), ranks=new Set<number>();
  if(rows.length<100) return 'fewer than 100 rows';
  for(const r of rows){if(!allowed.has(r.slug))return `unknown slug ${r.slug}`;if(!Number.isInteger(r.rank)||r.rank<1||r.rank>rows.length||ranks.has(r.rank))return 'invalid or duplicate rank';ranks.add(r.rank);if(r.farm_steps.length<3||r.farm_steps.length>12||r.farm_steps.some(s=>s.trim().length<20||s.trim().length>600))return `invalid farm plan for ${r.slug}`;}
  if(ranks.size!==rows.length) return 'ranks are not contiguous';
  const byRank=[...rows].sort((a,b)=>a.rank-b.rank);
  for(let i=1;i<byRank.length;i++) if(byRank[i]!.implied_value_usd>byRank[i-1]!.implied_value_usd)return 'values rise by rank';
  const seen=new Set(rows.map(r=>r.slug));
  if(snapshot.watchlist.some(s=>!seen.has(s)))return 'watchlist coverage incomplete';
  return null;
}
