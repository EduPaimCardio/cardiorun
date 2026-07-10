// ---------- Estado / Config persistente ----------
const store = {
  total: parseInt(localStorage.getItem('total')) || 45,   // minutos
  walk:  parseInt(localStorage.getItem('walk'))  || 120,  // segundos
  run:   parseInt(localStorage.getItem('run'))   || 60    // segundos
};

const el = id => document.getElementById(id);

function fmt(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function renderConfig() {
  el('totalVal').textContent = store.total;
  el('walkVal').textContent = fmt(store.walk);
  el('runVal').textContent = fmt(store.run);
}
renderConfig();

// ---------- Steppers ----------
document.querySelectorAll('.stepper button').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    const delta = parseInt(btn.dataset.delta);
    if (tool === 'total') {
      store.total = Math.max(1, store.total + delta);
    } else {
      store[tool] = Math.max(30, store[tool] + delta); // mínimo 30s
    }
    localStorage.setItem(tool, store[tool]);
    renderConfig();
  });
});

// ---------- Áudio (bips) ----------
let audioCtx;
function beep(times = 5) {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  let t = audioCtx.currentTime;
  for (let i = 0; i < times; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    osc.connect(gain).connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.16);
    t += 0.3; // intervalo entre bips
  }
}

// ---------- Flash luminoso (4 segundos) ----------
function flash() {
  const f = el('flash');
  f.classList.remove('active');
  void f.offsetWidth; // reinicia animação
  f.classList.add('active');
  setTimeout(() => f.classList.remove('active'), 4000);
}

function alertPhase() {
  beep(5);
  flash();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
}

// ---------- Treino ----------
let running = false;
let tickId = null;
let totalRemaining = 0;   // segundos
let phase = 'walk';       // 'walk' | 'run'
let phaseRemaining = 0;

function startWorkout() {
  running = true;
  totalRemaining = store.total * 60;
  phase = 'walk';
  phaseRemaining = store.walk;

  el('config').classList.add('hidden');
  el('running').classList.remove('hidden');

  // desbloqueia áudio no gesto do usuário
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  // mantém tela acesa se suportado
  if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(()=>{});

  updateUI();
  tickId = setInterval(tick, 1000);
}

function tick() {
  totalRemaining--;
  phaseRemaining--;

  if (totalRemaining <= 0) { finish(); return; }

  if (phaseRemaining <= 0) {
    // troca de fase
    alertPhase();
    if (phase === 'walk') {
      phase = 'run';
      phaseRemaining = store.run;
    } else {
      phase = 'walk';
      phaseRemaining = store.walk;
    }
  }
  updateUI();
}

function updateUI() {
  const isRun = phase === 'run';
  el('phaseBanner').textContent = isRun ? 'CORRIDA' : 'CAMINHADA';
  el('phaseBanner').classList.toggle('run', isRun);
  el('phaseLabel').textContent = isRun ? 'Corrida' : 'Caminhada';
  document.querySelector('.run-tool.primary').classList.toggle('run', isRun);

  el('phaseTimer').textContent = fmt(Math.max(0, phaseRemaining));
  el('totalTimer').textContent = fmt(Math.max(0, totalRemaining));
}

function finish() {
  clearInterval(tickId);
  running = false;
  beep(8); // sinal final mais longo
  flash();
  el('running').classList.add('hidden');
  el('config').classList.remove('hidden');
}

el('startBtn').addEventListener('click', startWorkout);

// ---------- Parar com duplo toque (5s) ----------
let firstStopTime = 0;
el('stopBtn').addEventListener('click', () => {
  const now = Date.now();
  if (now - firstStopTime <= 5000 && firstStopTime !== 0) {
    // segundo toque válido → para
    firstStopTime = 0;
    el('stopHint').textContent = '';
    clearInterval(tickId);
    running = false;
    el('running').classList.add('hidden');
    el('config').classList.remove('hidden');
  } else {
    // primeiro toque
    firstStopTime = now;
    el('stopHint').textContent = 'Toque novamente em até 5s para parar';
    setTimeout(() => {
      if (Date.now() - firstStopTime >= 5000) {
        firstStopTime = 0;
        el('stopHint').textContent = '';
      }
    }, 5100);
  }
});
