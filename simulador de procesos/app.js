// Clase que representa un proceso
class Process {
  constructor(name, arrival, burst) {
    this.name = name;                 // Nombre del proceso
    this.arrival = Number(arrival);   // Tiempo de llegada
    this.burst = Number(burst);       // Tiempo de ejecución (burst time)
    this.remaining = Number(burst);   // Tiempo restante para completar el proceso (para RR)
  }
}

// Estado global de la simulación
const state = {
  processes: [],       // Lista de procesos
  gantt: [],           // Línea de tiempo de ejecución (Gantt)
  time: 0,             // Tiempo actual de la simulación
  timer: null,         // Referencia al setInterval
  running: false,      // Indica si la simulación está corriendo
  algorithm: 'fcfs',   // Algoritmo de planificación seleccionado
  quantum: 3,          // Quantum para Round Robin
  unitMs: 3000         // Duración de cada "tick" en ms
};

// Elementos del DOM usados en la simulación
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

// Función para refrescar la tabla de procesos
function refreshProcessTable() {
  elements.tableBody.innerHTML = '';
  // Ordena los procesos por llegada y nombre
  state.processes
    .sort((a,b)=>a.arrival - b.arrival || a.name.localeCompare(b.name))
    .forEach((p,idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td><td>${p.arrival}</td><td>${p.burst}</td><td><button data-idx='${idx}' class='del'>Eliminar</button></td>`;
      elements.tableBody.appendChild(tr);
    });
}

// Mostrar mensajes en el área de resultados
function showMessage(msg){
  elements.results.innerHTML = `<pre>${msg}</pre>`;
}

// Reiniciar la simulación
function resetSimulation(preserveProcesses=true){
  if(!preserveProcesses) state.processes = []; // Elimina procesos si no se preservan
  state.gantt = [];
  state.time = 0;
  if(state.timer) clearInterval(state.timer);
  state.timer = null;
  state.running = false;
  // Ajusta botones y visibilidad
  elements.startBtn.disabled = false;
  elements.pauseBtn.disabled = true;
  elements.resumeBtn.disabled = true;
  elements.rrQueueCard.classList.add('hidden');
  renderGantt();
  refreshProcessTable();
}

// Algoritmo First-Come, First-Served (FCFS)
function scheduleFCFS(processes){
  const procs = processes.map(p=>({...p})).sort((a,b)=>a.arrival - b.arrival);
  const timeline = [];
  let time = 0;
  for(const p of procs){
    // Tiempo muerto si el proceso aún no llega
    while(time < p.arrival){ timeline.push(null); time++; }
    // Ejecuta el proceso completo
    for(let i=0;i<p.burst;i++){ timeline.push(p.name); time++; }
  }
  return timeline;
}

// Algoritmo Shortest Job First (SJF)
function scheduleSJF(processes){
  const procs = processes.map(p=>({...p, remaining:p.burst}));
  const timeline = [];
  let time = 0; let completed=0; const n = procs.length;
  while(completed < n){
    // Procesos que han llegado
    const arrived = procs.filter(p=>p.arrival <= time && p.remaining>0);
    if(arrived.length===0){ timeline.push(null); time++; continue; }
    // Escoge el proceso con menor burst
    arrived.sort((a,b)=>a.burst - b.burst || a.arrival - b.arrival);
    const cur = arrived[0];
    for(let i=0;i<cur.remaining;i++){ timeline.push(cur.name); time++; }
    cur.remaining=0; completed++;
  }
  return timeline;
}

// Algoritmo Round Robin (RR)
function scheduleRR(processes, quantum){
  const procs = processes.map(p=>({...p, remaining:p.burst})).sort((a,b)=>a.arrival - b.arrival);
  const timeline=[]; let time=0; const queue=[]; let i=0;
  while(true){
    // Añade procesos que han llegado al queue
    while(i<procs.length && procs[i].arrival<=time){ queue.push(procs[i]); i++; }
    if(queue.length===0){ if(i>=procs.length) break; timeline.push(null); time++; continue; }
    const cur=queue.shift(); 
    const run=Math.min(quantum, cur.remaining);
    for(let t=0;t<run;t++){ 
      timeline.push(cur.name); 
      time++; 
      while(i<procs.length && procs[i].arrival<=time){ queue.push(procs[i]); i++; }
    }
    cur.remaining-=run; 
    if(cur.remaining>0) queue.push(cur);
  }
  return timeline;
}

// Renderizar la tabla de Gantt en el DOM
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
  // Encabezado de tiempos
  const thead=document.createElement('tr');
  thead.innerHTML=`<th style='width:90px'></th>`+timeline.map((_,i)=>`<th class='gantt-timehead'>${i}</th>`).join('');
  table.querySelector('thead').appendChild(thead);

  // Filas de procesos
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

// Calcular métricas: tiempo de finalización, retorno, espera y eficiencia
function computeMetrics(timeline){
  const procs=state.processes.map(p=>({name:p.name, arrival:p.arrival, burst:p.burst}));
  const finish={};
  for(let t=0;t<timeline.length;t++){ 
    const n=timeline[t]; 
    if(n==null) continue; 
    finish[n]=t; // Último tiempo donde el proceso se ejecutó
  }
  return procs.map(p=>{
    const f=finish[p.name]; 
    const finishTime=f===undefined?null:f+1;
    const turnaround=finishTime===null?null:finishTime-p.arrival;
    const waiting=turnaround===null?null:turnaround-p.burst;
    const eff=turnaround?(p.burst/turnaround):0;
    return {name:p.name,arrival:p.arrival,burst:p.burst,finish:finishTime,turnaround,waiting,efficiency:eff};
  });
}

// Agregar un proceso desde el formulario
elements.form.addEventListener('submit',e=>{
  e.preventDefault();
  const name=elements.name.value.trim();
  const arr=Number(elements.arrival.value);
  const burst=Number(elements.burst.value);
  // Validaciones básicas
  if(!name||isNaN(arr)||isNaN(burst)||burst<=0||arr<0){ alert('Verifica los datos'); return; }
  if(state.processes.some(p=>p.name===name)){ alert('Nombre ya existe'); return; }
  state.processes.push(new Process(name,arr,burst));
  elements.name.value=''; elements.arrival.value=0; elements.burst.value=1;
  refreshProcessTable(); renderGantt();
});

// Eliminar un proceso desde la tabla
elements.tableBody.addEventListener('click',e=>{
  if(e.target.classList.contains('del')){
    const idx=Number(e.target.dataset.idx);
    state.processes.splice(idx,1);
    refreshProcessTable(); renderGantt();
  }
});

// Cambiar algoritmo de planificación
elements.algorithm.addEventListener('change',()=>{
  state.algorithm=elements.algorithm.value;
  if(state.algorithm==='rr'){ 
    elements.quantumLabel.classList.remove('hidden'); 
    elements.rrQueueCard.classList.remove('hidden'); 
  } else { 
    elements.quantumLabel.classList.add('hidden'); 
    elements.rrQueueCard.classList.add('hidden'); 
  }
});

// Iniciar simulación
elements.startBtn.addEventListener('click',()=>{
  if(state.processes.length===0){ alert('Agrega procesos antes de iniciar'); return; }
  clearInterval(state.timer); state.time=0; state.running=false; state.gantt=[];
  state.algorithm=elements.algorithm.value;
  state.quantum=Number(elements.quantum.value)||1;
  // Ejecuta el algoritmo seleccionado
  if(state.algorithm==='fcfs') state.gantt=scheduleFCFS(state.processes);
  else if(state.algorithm==='sjf') state.gantt=scheduleSJF(state.processes);
  else if(state.algorithm==='rr') state.gantt=scheduleRR(state.processes,state.quantum);
  renderGantt();
  state.running=true;
  elements.startBtn.disabled=true;
  elements.pauseBtn.disabled=false;
  // Inicia el timer de simulación
  state.timer=setInterval(()=>tick(),state.unitMs);
});

// Función que avanza un "tick" de la simulación
function tick(){
  if(state.time>=state.gantt.length){
    // Simulación finalizada
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

// Pausar simulación
elements.pauseBtn.addEventListener('click',()=>{
  if(state.timer){ 
    clearInterval(state.timer); 
    state.timer=null; 
    elements.pauseBtn.disabled=true; 
    elements.resumeBtn.disabled=false; 
  }
});

// Reanudar simulación
elements.resumeBtn.addEventListener('click',()=>{
  if(!state.timer&&state.running){ 
    state.timer=setInterval(()=>tick(),state.unitMs); 
    elements.pauseBtn.disabled=false; 
    elements.resumeBtn.disabled=true; 
  }
});

// Reiniciar simulación
elements.resetBtn.addEventListener('click',()=>{ 
  resetSimulation(true); 
  showMessage('Simulación reiniciada.'); 
});

// Inicializa la simulación al cargar
resetSimulation(false); 
renderGantt();
