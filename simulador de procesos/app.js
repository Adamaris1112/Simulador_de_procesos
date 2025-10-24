// Simulador de Planificación - Web (Corregido)
// Este archivo soluciona el error donde la simulación se quedaba en 0 y no avanzaba.
// Ajuste: ya no se llama resetSimulation(true) al iniciar la simulación.

class Process {
  constructor(name, arrival, burst) {
    this.name = name;
    this.arrival = Number(arrival);
    this.burst = Number(burst);
    this.remaining = Number(burst);
  }
}

const state = {
  processes: [],
  gantt: [],
  time: 0,
  timer: null,
  running: false,
  algorithm: 'fcfs',
  quantum: 2,
  unitMs: 3000 // cada unidad dura 3 segundos
};

const elements = {
  form: document.getElementById('process-form'),
  name: document.getElementById('p-name'),
  arrival: document.getElementById('p-arrival'),
  burst: document.getElementById('p-burst'),
  tableBody: document.querySelector('#process-table tbody'),
  algorithm: document.getElementById('algorithm'),
  quantumLabel: document.getElementById('quantum-label'),
  quantum: document.getElementById('quantum'),
  startBtn: document.getElementById('start-btn'),
  pauseBtn: document.getElementById('pause-btn'),
  resumeBtn: document.getElementById('resume-btn'),
  resetBtn: document.getElementById('reset-btn'),
  ganttTable: document.getElementById('gantt-table'),
  results: document.getElementById('results'),
  rrQueueCard: document.getElementById('rr-queue-card'),
  rrQueue: document.getElementById('rr-queue')
};

// Renderiza tabla de procesos
function refreshProcessTable() {
  elements.tableBody.innerHTML = '';
  state.processes
    .sort((a,b)=>a.arrival - b.arrival || a.name.localeCompare(b.name))
    .forEach((p,idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td><td>${p.arrival}</td><td>${p.burst}</td><td><button data-idx='${idx}' class='del'>Eliminar</button></td>`;
      elements.tableBody.appendChild(tr);
    });
}

function showMessage(msg){
  elements.results.innerHTML = `<pre>${msg}</pre>`;
}

// Reinicia simulación (sin borrar procesos)
function resetSimulation(preserveProcesses=true){
  if(!preserveProcesses) state.processes = [];
  state.gantt = [];
  state.time = 0;
  if(state.timer) clearInterval(state.timer);
  state.timer = null;
  state.running = false;
  elements.startBtn.disabled = false;
  elements.pauseBtn.disabled = true;
  elements.resumeBtn.disabled = true;
  elements.rrQueueCard.classList.add('hidden');
  renderGantt();
  refreshProcessTable();
}

// Algoritmos
function scheduleFCFS(processes){
  const procs = processes.map(p=>({...p})).sort((a,b)=>a.arrival - b.arrival);
  const timeline = [];
  let time = 0;
  for(const p of procs){
    while(time < p.arrival){ timeline.push(null); time++; }
    for(let i=0;i<p.burst;i++){ timeline.push(p.name); time++; }
  }
  return timeline;
}

function scheduleSJF(processes){
  const procs = processes.map(p=>({...p, remaining:p.burst}));
  const timeline = [];
  let time = 0; let completed=0; const n = procs.length;
  while(completed < n){
    const arrived = procs.filter(p=>p.arrival <= time && p.remaining>0);
    if(arrived.length===0){ timeline.push(null); time++; continue; }
    arrived.sort((a,b)=>a.burst - b.burst || a.arrival - b.arrival);
    const cur = arrived[0];
    for(let i=0;i<cur.remaining;i++){ timeline.push(cur.name); time++; }
    cur.remaining=0; completed++;
  }
  return timeline;
}

function scheduleRR(processes, quantum){
  const procs = processes.map(p=>({...p, remaining:p.burst})).sort((a,b)=>a.arrival - b.arrival);
  const timeline=[]; let time=0; const queue=[]; let i=0;
  while(true){
    while(i<procs.length && procs[i].arrival<=time){ queue.push(procs[i]); i++; }
    if(queue.length===0){ if(i>=procs.length) break; timeline.push(null); time++; continue; }
    const cur=queue.shift(); const run=Math.min(quantum, cur.remaining);
    for(let t=0;t<run;t++){ timeline.push(cur.name); time++; while(i<procs.length && procs[i].arrival<=time){ queue.push(procs[i]); i++; } }
    cur.remaining-=run; if(cur.remaining>0) queue.push(cur);
  }
  return timeline;
}

// Dibuja Gantt
function renderGantt(){
  const table=elements.ganttTable;
  table.querySelector('thead').innerHTML='';
  table.querySelector('tbody').innerHTML='';
  const names=state.processes.map(p=>p.name);
  const timeline=state.gantt;
  if(names.length===0){
    table.querySelector('tbody').innerHTML='<tr><td style="color:var(--muted)">No hay procesos</td></tr>';
    return;
  }
  const thead=document.createElement('tr');
  thead.innerHTML=`<th style='width:90px'></th>`+timeline.map((_,i)=>`<th class='gantt-timehead'>${i}</th>`).join('');
  table.querySelector('thead').appendChild(thead);

  for(const name of names){
    const tr=document.createElement('tr');
    const label=`<td class='gantt-label'>${name}</td>`;
    const cells=timeline.map((slot,idx)=>{
      let cls='gantt-cell cell-idle'; let txt='';
      if(slot===name){ cls='gantt-cell cell-complete'; txt=name; }
      if(idx===state.time) cls+=' cell-current';
      return `<td class='${cls}'>${txt}</td>`;
    }).join('');
    tr.innerHTML=label+cells;
    table.querySelector('tbody').appendChild(tr);
  }
}

// Métricas
function computeMetrics(timeline){
  const procs=state.processes.map(p=>({name:p.name, arrival:p.arrival, burst:p.burst}));
  const finish={};
  for(let t=0;t<timeline.length;t++){ const n=timeline[t]; if(n==null) continue; finish[n]=t; }
  return procs.map(p=>{
    const f=finish[p.name]; const finishTime=f===undefined?null:f+1;
    const turnaround=finishTime===null?null:finishTime-p.arrival;
    const waiting=turnaround===null?null:turnaround-p.burst;
    const eff=turnaround?(p.burst/turnaround):0;
    return {name:p.name,arrival:p.arrival,burst:p.burst,finish:finishTime,turnaround,waiting,efficiency:eff};
  });
}

// Eventos
elements.form.addEventListener('submit',e=>{
  e.preventDefault();
  const name=elements.name.value.trim();
  const arr=Number(elements.arrival.value);
  const burst=Number(elements.burst.value);
  if(!name||isNaN(arr)||isNaN(burst)||burst<=0||arr<0){ alert('Verifica los datos'); return; }
  if(state.processes.some(p=>p.name===name)){ alert('Nombre ya existe'); return; }
  state.processes.push(new Process(name,arr,burst));
  elements.name.value=''; elements.arrival.value=0; elements.burst.value=1;
  refreshProcessTable(); renderGantt();
});

elements.tableBody.addEventListener('click',e=>{
  if(e.target.classList.contains('del')){
    const idx=Number(e.target.dataset.idx);
    state.processes.splice(idx,1);
    refreshProcessTable(); renderGantt();
  }
});

elements.algorithm.addEventListener('change',()=>{
  state.algorithm=elements.algorithm.value;
  if(state.algorithm==='rr'){ elements.quantumLabel.classList.remove('hidden'); elements.rrQueueCard.classList.remove('hidden'); }
  else{ elements.quantumLabel.classList.add('hidden'); elements.rrQueueCard.classList.add('hidden'); }
});

// 🔧 CORREGIDO: No reiniciamos procesos al iniciar
elements.startBtn.addEventListener('click',()=>{
  if(state.processes.length===0){ alert('Agrega procesos antes de iniciar'); return; }
  clearInterval(state.timer); state.time=0; state.running=false; state.gantt=[];
  state.algorithm=elements.algorithm.value;
  state.quantum=Number(elements.quantum.value)||1;
  if(state.algorithm==='fcfs') state.gantt=scheduleFCFS(state.processes);
  else if(state.algorithm==='sjf') state.gantt=scheduleSJF(state.processes);
  else if(state.algorithm==='rr') state.gantt=scheduleRR(state.processes,state.quantum);
  renderGantt();
  state.running=true;
  elements.startBtn.disabled=true;
  elements.pauseBtn.disabled=false;
  state.timer=setInterval(()=>tick(),state.unitMs);
});

function tick(){
  if(state.time>=state.gantt.length){
    clearInterval(state.timer); state.timer=null; state.running=false;
    elements.pauseBtn.disabled=true; elements.resumeBtn.disabled=true; elements.startBtn.disabled=false;
    const m=computeMetrics(state.gantt);
    const best=m.reduce((a,b)=>a.efficiency>b.efficiency?a:b,m[0]||null);
    let out='Tabla de métricas:\nProceso | Llegada | Burst | Fin | Retorno | Espera | Eficiencia\n';
    for(const x of m){ out+=`${x.name} | ${x.arrival} | ${x.burst} | ${x.finish} | ${x.turnaround} | ${x.waiting} | ${x.efficiency.toFixed(3)}\n`; }
    if(best) out+=`\nProceso más eficiente: ${best.name} (ef=${best.efficiency.toFixed(3)})`;
    showMessage(out); renderGantt(); return;
  }
  state.time+=1; renderGantt();
}

elements.pauseBtn.addEventListener('click',()=>{
  if(state.timer){ clearInterval(state.timer); state.timer=null; elements.pauseBtn.disabled=true; elements.resumeBtn.disabled=false; }
});

elements.resumeBtn.addEventListener('click',()=>{
  if(!state.timer&&state.running){ state.timer=setInterval(()=>tick(),state.unitMs); elements.pauseBtn.disabled=false; elements.resumeBtn.disabled=true; }
});

elements.resetBtn.addEventListener('click',()=>{ resetSimulation(true); showMessage('Simulación reiniciada.'); });

resetSimulation(false); renderGantt();
