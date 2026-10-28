const $=id=>document.getElementById(id);
const clamp=n=>Math.max(1,Math.min(5,Math.round(n)));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const STAKES=['health','finance','hr','edu','gov','legal'];

const RISKS=[
{id:'R1',cat:'Fairness',fn:'Measure',title:'Biased or discriminatory outcomes',
 desc:'Outputs may treat groups of people unfairly because of skewed training data or proxy variables.',
 f:s=>(s.people||s.stakes)?{l:2+s.stakes+(s.auto==2)+(s.sens?1:0)*0,i:s.impact}:null,
 mit:['Test outcomes across demographic groups before launch and on a schedule','Remove or audit proxy features such as postcode or name','Keep a documented appeal route for affected people']},
{id:'R2',cat:'Privacy',fn:'Govern',title:'Personal data exposure or misuse',
 desc:'Personal data may leak through logs, prompts, model outputs, or be used beyond its original purpose.',
 f:s=>s.people?{l:2+(s.sens?1:0)+(s.expo>0)+(s.src=='api'),i:s.sens?Math.max(4,s.impact):3}:null,
 mit:['Minimise and anonymise data before it reaches the model','Set retention limits and restrict log access','Complete a data protection impact assessment']},
{id:'R3',cat:'Accuracy',fn:'Measure',title:'Hallucinated or incorrect output',
 desc:'The system may produce confident but wrong answers that users act on.',
 f:s=>s.gen?{l:3+(s.expo>0)+(s.auto==2),i:s.impact}:null,
 mit:['Ground answers in verified sources (retrieval with citations)','Add confidence thresholds and “I don’t know” behaviour','Run an evaluation set for factual accuracy on every release']},
{id:'R4',cat:'Security',fn:'Manage',title:'Prompt injection and adversarial inputs',
 desc:'Crafted inputs may override instructions, extract data, or trigger unintended actions.',
 f:s=>s.gen?{l:1+s.expo+s.auto+(s.expo==0?1:0),i:2+s.auto+(s.sens?1:0)}:null,
 mit:['Separate system instructions from user content and sanitise inputs','Give the model least-privilege access to tools and data','Red-team regularly and monitor for abuse patterns']},
{id:'R5',cat:'Security',fn:'Manage',title:'Data poisoning, model theft or tampering',
 desc:'Attackers may corrupt training data, steal the model, or alter it in the supply chain.',
 f:s=>({l:2+(s.expo==2)+(s.src=='open'),i:s.impact}),
 mit:['Verify provenance and checksums of data and model files','Restrict model and API access with strong authentication','Rate-limit queries to slow extraction attempts']},
{id:'R6',cat:'Human factors',fn:'Map',title:'Over-reliance and automation bias',
 desc:'People may accept the system’s output without scrutiny, especially when it is usually right.',
 f:s=>s.auto<2?{l:2+(s.auto==0?0:1)+s.stakes,i:s.impact}:null,
 mit:['Show uncertainty and reasons next to each recommendation','Train reviewers and sample their overrides','Require independent review for high-impact cases']},
{id:'R7',cat:'Transparency',fn:'Govern',title:'Lack of explainability',
 desc:'Decisions cannot be explained to users, auditors or regulators.',
 f:s=>({l:2+s.stakes+(s.src!='inhouse'),i:s.stakes?s.impact:s.impact-1}),
 mit:['Record inputs, model version and output for every decision','Use interpretable models or explanation tooling where decisions affect people','Publish plain-language documentation (model card)']},
{id:'R8',cat:'Operations',fn:'Manage',title:'Vendor dependency and outages',
 desc:'A third-party provider may change pricing, behaviour, terms or availability without notice.',
 f:s=>s.src=='api'?{l:3+(s.auto==2),i:s.impact-1}:null,
 mit:['Pin model versions and test before upgrading','Design a fallback path or secondary provider','Review the vendor’s data-use and retention terms']},
{id:'R9',cat:'Compliance',fn:'Govern',title:'Regulatory non-compliance',
 desc:'The system may fall under rules such as the EU AI Act, GDPR or sector regulation.',
 f:s=>({l:2+s.stakes+(s.sens?1:0)+(s.expo==2),i:(s.stakes||s.sens)?5:3}),
 mit:['Map the system to applicable laws and keep the mapping current','Assign an accountable owner and an approval gate','Keep technical documentation and audit trails ready']},
{id:'R10',cat:'Safety',fn:'Manage',title:'Harmful or inappropriate content',
 desc:'Generated content may be offensive, unsafe or unsuitable for vulnerable users.',
 f:s=>(s.gen&&s.expo>0)?{l:1+s.expo+(s.children?1:0)+(s.auto==2),i:s.children?5:3+(s.expo==2)}:null,
 mit:['Apply input and output content filters','Add age-appropriate settings and escalation to a human','Provide an easy way to report bad outputs']},
{id:'R11',cat:'Legal',fn:'Govern',title:'Intellectual property and licensing',
 desc:'Outputs may reproduce copyrighted material, or training data may carry licence limits.',
 f:s=>s.gen?{l:2+(s.expo>0)+(s.src!='api'),i:3}:null,
 mit:['Check licences for training data and base models','Add similarity checks for published output','Clarify ownership of generated content in your terms']},
{id:'R12',cat:'Performance',fn:'Measure',title:'Model drift and degradation',
 desc:'Accuracy may fall over time as real-world data changes from what the model learned.',
 f:s=>({l:3,i:s.impact-1}),
 mit:['Monitor accuracy and input distributions in production','Set retraining or review triggers','Keep a rollback plan for the previous model']},
{id:'R13',cat:'Safety',fn:'Manage',title:'Unchecked automated harm',
 desc:'With no human in the loop, errors can cause harm before anyone notices.',
 f:s=>(s.auto==2&&s.impact>=4)?{l:2+(s.expo>0)+(s.stakes),i:5}:null,
 mit:['Add a human checkpoint for high-impact actions','Include kill-switch and rate limits','Run staged rollouts with close monitoring']},
{id:'R14',cat:'Reputation',fn:'Manage',title:'Reputational damage',
 desc:'Public mistakes or misuse may erode trust in the organisation.',
 f:s=>s.expo>0?{l:2+(s.expo==2)+(s.gen),i:s.impact>=4?4:3}:null,
 mit:['Prepare an incident response and communications plan','Be open that users are interacting with AI','Run a limited pilot before wide release']}
];

const level=sc=>sc>=15?'Critical':sc>=10?'High':sc>=5?'Medium':'Low';
const cellClass=sc=>sc>=15?'c4':sc>=10?'c3':sc>=5?'c2':'c1';
let current=null;

function gather(){
  const data=[...document.querySelectorAll('#data input:checked')].map(x=>x.value);
  const domain=$('domain').value, desc=$('desc').value;
  const stakes=(STAKES.includes(domain)||/hire|resume|loan|credit|diagnos|patient|insurance|bail|police/i.test(desc))?1:0;
  const sens=data.some(d=>['sensitive','biometric','children'].includes(d))?1:0;
  return {name:$('name').value.trim()||'Untitled AI system',desc,domain,
    people:data.length>0,sens,children:data.includes('children')?1:0,stakes,
    auto:+document.querySelector('[name=auto]:checked').value,
    expo:+document.querySelector('[name=expo]:checked').value,
    src:$('src').value,impact:+$('impact').value,gen:$('gen').checked?1:0};
}

function assess(s){
  const out=[];
  for(const r of RISKS){
    const v=r.f(s); if(!v) continue;
    const l=clamp(v.l), i=clamp(v.i);
    out.push({...r,l,i,score:l*i,level:level(l*i)});
  }
  return out.sort((a,b)=>b.score-a.score);
}

function euHint(s){
  if(STAKES.includes(s.domain)&&(s.auto>0||s.people))return 'Operates in an area the EU AI Act often treats as high-risk (for example hiring, credit, education, essential services). Expect conformity, documentation and human-oversight duties.';
  if(s.gen&&s.expo>0)return 'Likely limited risk: expect transparency duties such as telling users they are interacting with AI or labelling generated content.';
  return 'Likely minimal risk under the EU AI Act, though privacy and security rules still apply.';
}

function render(s,rs){
  const counts={Critical:0,High:0,Medium:0,Low:0};rs.forEach(r=>counts[r.level]++);
  const top=rs[0]?rs[0].level:'Low';
  const avg=(rs.reduce((a,r)=>a+r.score,0)/rs.length).toFixed(1);
  let cells='';
  for(let i=5;i>=1;i--)for(let l=1;l<=5;l++){
    const here=rs.filter(r=>r.l==l&&r.i==i);
    cells+=`<div class="cell ${cellClass(l*i)}" title="Likelihood ${l}, impact ${i}">${here.map(r=>`<span class="chip">${r.id}</span>`).join('')}</div>`;
  }
  $('out').innerHTML=`
  <div class="summary"><div><h2>${esc(s.name)}</h2><span class="tag">${rs.length} risks identified</span></div>
    <span class="badge L-${top}">Overall: ${top}</span></div>
  <div class="stats">
    ${['Critical','High','Medium','Low'].map(k=>`<div class="stat"><b>${counts[k]}</b><span>${k}</span></div>`).join('')}
    <div class="stat"><b>${avg}</b><span>Average score (of 25)</span></div>
  </div>
  <div class="note">${esc(euHint(s))} This is a screening tool, not legal advice.</div>
  <h3>Risk matrix</h3>
  <div class="mx-wrap"><div class="mx-y">Impact</div><div class="mx">${cells}</div></div>
  <div class="mx-x">Likelihood (1 rare to 5 almost certain)</div>
  <h3>Risk register</h3>
  ${rs.map((r,n)=>`<details ${n<2?'open':''}><summary><span class="badge L-${r.level}">${r.id}</span>
    <span class="t">${esc(r.title)}</span><span class="sc">${r.l} × ${r.i} = ${r.score}</span></summary>
    <div class="body"><p>${esc(r.desc)}</p>
    <div class="tag">${r.cat} · NIST AI RMF: ${r.fn} · Rating: ${r.level}</div>
    <p><b>Mitigations</b></p><ul>${r.mit.map(m=>`<li>${esc(m)}</li>`).join('')}</ul></div></details>`).join('')}
  <div class="actions"><button type="button" id="cmd">Copy as Markdown</button><button type="button" id="ccsv">Copy as CSV</button><span id="msg" class="tag" role="status"></span></div>`;
  $('cmd').onclick=()=>copy(toMd(s,rs));
  $('ccsv').onclick=()=>copy(toCsv(rs));
}

function toMd(s,rs){
  return `# AI risk assessment: ${s.name}\n\n${s.desc?s.desc+'\n\n':''}| ID | Risk | Category | L | I | Score | Level |\n|---|---|---|---|---|---|---|\n`+
  rs.map(r=>`| ${r.id} | ${r.title} | ${r.cat} | ${r.l} | ${r.i} | ${r.score} | ${r.level} |`).join('\n')+
  '\n\n## Mitigations\n'+rs.map(r=>`\n**${r.id} ${r.title}**\n`+r.mit.map(m=>`- ${m}`).join('\n')).join('\n');
}
function toCsv(rs){
  const q=v=>`"${String(v).replace(/"/g,'""')}"`;
  return ['ID,Risk,Category,Likelihood,Impact,Score,Level,Mitigations',
    ...rs.map(r=>[r.id,r.title,r.cat,r.l,r.i,r.score,r.level,r.mit.join('; ')].map(q).join(','))].join('\n');
}
function copy(text){
  const done=ok=>{const m=$('msg');if(m)m.textContent=ok?'Copied':'Copy failed: select the text manually';};
  const fallback=()=>{try{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();
    const ok=document.execCommand('copy');t.remove();done(ok);}catch(e){done(false);}};
  try{navigator.clipboard.writeText(text).then(()=>done(true),fallback);}catch(e){fallback();}
}

$('go').onclick=()=>{const s=gather();render(s,assess(s));};
$('ex').onclick=()=>{
  $('name').value='Loan screening assistant';
  $('desc').value='Scores consumer loan applications and recommends approve or decline.';
  $('domain').value='finance';
  document.querySelectorAll('#data input').forEach(x=>x.checked=['personal','sensitive'].includes(x.value));
  document.querySelector('[name=auto][value="1"]').checked=true;
  document.querySelector('[name=expo][value="1"]').checked=true;
  $('src').value='api';$('impact').value='4';$('gen').checked=false;
  $('go').click();
};
$('theme').onclick=()=>{
  const r=document.documentElement,dark=matchMedia('(prefers-color-scheme: dark)').matches;
  const cur=r.dataset.theme||(dark?'dark':'light');
  r.dataset.theme=cur==='dark'?'light':'dark';
};
