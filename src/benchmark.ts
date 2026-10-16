import { Airlock, seed, traceInMemory, type Decision, type State, type Store, type Update } from './domain.ts';
import { LocalStore } from './store.ts';

type Counts = { tp: number; fp: number; fn: number; tn: number };
const count = (actual: string[], expected: string[], universe: string[]): Counts => {
  const a = new Set(actual), e = new Set(expected);
  return universe.reduce((c, key) => { c[a.has(key) ? e.has(key) ? 'tp' : 'fp' : e.has(key) ? 'fn' : 'tn']++; return c; }, { tp: 0, fp: 0, fn: 0, tn: 0 });
};
function fixture(depth: number) {
  const state = seed(), groups: Record<string, string[]> = {};
  state.decisions = [];
  for (const [group, factId, watches] of [['returns', 'fact-refund', []], ['shipping', 'fact-france', ['ships_to']], ['contact', 'fact-email', []]] as const) {
    groups[group] = [];
    for (let level = 0; level < depth; level++) {
      const key = `${group}-${level}`;
      const decision: Decision = { id: key, agentId: state.agents[level % 3].id, text: `Synthetic ${group} decision at level ${level + 1}.`, factIds: level === 0 ? [factId] : [], decisionIds: level === 0 ? [] : [groups[group][level - 1]], watches: level === 0 ? [...watches] : [], status: 'current', createdAt: new Date().toISOString() };
      groups[group].push(key); state.decisions.push(decision);
    }
  }
  return { state, groups };
}

/** Expected memberships are authored independently of either traversal. */
export async function benchmark(createStore: (name: string) => Promise<Store> = async () => new LocalStore()) {
  const started=performance.now(), rows: any[]=[], totals={
    graph:{tp:0,fp:0,fn:0,tn:0},reference:{tp:0,fp:0,fn:0,tn:0},direct:{tp:0,fp:0,fn:0,tn:0},all:{tp:0,fp:0,fn:0,tn:0},
  };
  let backend='local';
  async function measure(name:string,state:State,update:Update,expected:string[],depth:number,shape='chain') {
    const store=await createStore('fixture-'+rows.length);backend=store.mode;
    try {
      await store.save(state,-1);const app=new Airlock(store),start=performance.now(),p=await app.preview(update);
      const queryMs=Math.round((performance.now()-start)*10)/10,writable=['add','replace','remove'].includes(p.outcome);
      const current=state.decisions.filter(d=>d.status==='current'),universe=current.map(d=>d.id),targets=[...p.retires,'scope:'+p.update.relation];
      const referenceStart=performance.now();
      const reference=writable?traceInMemory(state,targets).map(p=>p.decisionId).filter(key=>universe.includes(key)):[];
      const referenceMs=Math.round((performance.now()-referenceStart)*100)/100;
      const direct=writable?current.filter(d=>d.factIds.some(key=>p.retires.includes(key))||d.watches?.includes(p.update.relation)).map(d=>d.id):[];
      const predictions={graph:p.affected,reference,direct,all:writable?universe:[]};
      const scores={} as Record<keyof typeof totals,Counts>;
      for(const method of ['graph','reference','direct','all'] as const){scores[method]=count(predictions[method],expected,universe);for(const key of ['tp','fp','fn','tn'] as const)totals[method][key]+=scores[method][key];}
      if((await app.state()).revision!==state.revision)throw Error('Preview changed a fixture.');
      rows.push({name,shape,depth,expected:expected.length,expectedIds:expected,found:p.affected.length,foundIds:p.affected,queryMs,referenceMs,passed:scores.graph.fp===0&&scores.graph.fn===0&&scores.reference.fp===0&&scores.reference.fn===0,scores,longestPath:Math.max(0,...(p.paths??[]).map(p=>p.nodeIds.length-1))});
    }finally{await store.close?.();}
  }
  const change=(relation:string,value:string,source='policy',action='assert')=>({relation,value,source,action,evidence:'Synthetic policy owner confirms this fixture update.'} as Update);
  for(const depth of [1,3,6])for(const scenario of [
    {name:'Replace return policy',group:'returns',update:change('refund_days','14')},
    {name:'Add previously unverified destination',group:'shipping',update:change('ships_to','Germany')},
    {name:'Change support contact',group:'contact',update:change('support_email','new@example.com')},
    {name:'Reject customer policy rewrite',group:undefined,update:change('refund_days','365','customer')},
  ]){const {state,groups}=fixture(depth);await measure(scenario.name,state,scenario.update,scenario.group?groups[scenario.group]:[],depth);}
  const branch=()=>{
    const state=seed();state.decisions=[];
    const add=(key:string,factIds:string[]=[],decisionIds:string[]=[],watches:('refund_days'|'ships_to'|'support_email')[]=[])=>state.decisions.push({id:key,agentId:'agent-ada',text:'Synthetic '+key,factIds,decisionIds,watches,status:'current',createdAt:new Date().toISOString()});
    add('returns-root',['fact-refund']);add('returns-review',[],['returns-root']);add('returns-writer',[],['returns-root']);
    add('shipping-root',[],[],['ships_to']);add('shipping-writer',[],['shipping-root']);add('shared-draft',[],['returns-review','shipping-writer']);add('contact-only',['fact-email']);
    return state;
  };
  await measure('Branching return dependency with a shared draft',branch(),change('refund_days','14'),['returns-root','returns-review','returns-writer','shared-draft'],3,'branch');
  await measure('New destination reaches a shared draft',branch(),change('ships_to','Germany'),['shipping-root','shipping-writer','shared-draft'],3,'shared');
  await measure('Unrelated support change spares both workflows',branch(),change('support_email','new@example.com'),['contact-only'],1,'independent');
  await measure('Blocked claim preserves a branching graph',branch(),change('refund_days','365','customer'),[],3,'blocked');
  const missing=branch();missing.facts=missing.facts.filter(f=>f.relation!=='ships_to');
  await measure('Empty shipping collection gains its first destination',missing,change('ships_to','Germany'),['shipping-root','shipping-writer','shared-draft'],3,'absence');
  const historical=branch();historical.decisions.find(d=>d.id==='returns-review')!.status='recheck';
  await measure('Already stale intermediates still lead to current consumers',historical,change('refund_days','14'),['returns-root','returns-writer','shared-draft'],3,'historical');
  const methods=Object.entries(totals).map(([method,c])=>({method,...c,precision:c.tp+c.fp?c.tp/(c.tp+c.fp):1,recall:c.tp+c.fn?c.tp/(c.tp+c.fn):1}));
  return {kind:'synthetic-dependency-benchmark',backend,cases:rows.length,passed:rows.filter(r=>r.passed).length,durationMs:Math.round(performance.now()-started),methods,rows,ranAt:new Date().toISOString(),note:'18 synthetic fixtures: chains 1/3/6 hops, branching/shared dependencies, empty reads and historical decisions. Graph and full in-memory traversal should agree. Direct-only and refresh-all illustrate weaker invalidation strategies, not competing products. queryMs measures the complete persisted preview; referenceMs measures traversal only and is not a fair speed comparison. No model-quality or production-scale claim. Main workspace untouched.'};
}
