import './style.css';
import { createARSession } from './ar.js';
import { openPhotoFlow } from './photo-flow.js';

const elements = {
  container: document.querySelector('#ar-container'),
  start: document.querySelector('#start-button'),
  stop: document.querySelector('#stop-button'),
  photo: document.querySelector('#photo-button'),
  status: document.querySelector('#status'),
  statusText: document.querySelector('#status-text'),
  lostHint: document.querySelector('#lost-hint'),
  debugInit: document.querySelector('#debug-init'),
  debugTarget: document.querySelector('#debug-target'),
  debugModel: document.querySelector('#debug-model'),
  debugError: document.querySelector('#debug-error'),
};

if (new URLSearchParams(location.search).has('debug')) {
  document.querySelector('.debug')?.removeAttribute('hidden');
}

let session = null;
let busy = false;
const hint = document.querySelector('#interaction-hint');
const prompts = ['试着摸摸他们的头吧', '拖动身体让他们转过身试试呢', '试着向平面吹一口气吧！'];
let tutorialStep = -1;
function showHint(text = '') {
  hint.textContent = text;
  hint.hidden = !text;
}

function setStatus(text, state = 'idle') {
  elements.statusText.textContent = text;
  elements.status.dataset.state = state;
}

function setRunning(running) {
  elements.start.hidden = running;
  elements.stop.hidden = !running;
}

function explainError(error) {
  const name = error?.name || '';
  const message = error?.message || String(error);
  if (name === 'NotAllowedError' || /permission|denied|禁止|拒绝/i.test(message)) {
    return '摄像头权限被拒绝。请在 Safari 网站设置中允许摄像头后重试。';
  }
  if (name === 'NotReadableError' || /could not start|not readable|占用/i.test(message)) {
    return '摄像头可能正被其他应用占用，请关闭其他相机应用后重试。';
  }
  if (name === 'NotFoundError') return '未找到可用摄像头。';
  if (/目标文件|\.mind|404/i.test(message)) return message;
  if (!window.isSecureContext) return '当前页面不是安全来源，请通过 HTTPS 打开。';
  return `AR 启动失败：${message}`;
}

const ui = {
  diagnostics(text) { document.querySelector('#debug-frames').textContent = text; },
  loading(message) {
    elements.start.textContent = message;
  },
  initializing() {
    tutorialStep = -1;
    showHint('对准学院的三个标志打开ar');
    setStatus('准备中', 'loading');
    elements.debugInit.textContent = '初始化中';
    elements.debugError.textContent = '无';
    elements.lostHint.hidden = true;
  },
  searching() {
    setStatus('寻找学院标志', 'searching');
    elements.debugInit.textContent = '已启动';
    elements.debugTarget.textContent = '否';
    elements.debugModel.textContent = '否';
  },
  found() {
    if (tutorialStep === -1) { tutorialStep = 0; showHint(prompts[0]); }
    setStatus('识别成功', 'success');
    elements.debugTarget.textContent = '是';
    elements.debugModel.textContent = '是';
    elements.lostHint.hidden = true;
    elements.photo.hidden = false;
  },
  blowDetected() {
    ui.interacted('blow');
    setStatus('检测到吹气，精灵开始旋转', 'success');
  },
  microphoneReady() {
    // Keep the minimal UI; expose microphone state only in the optional debug panel.
    elements.debugInit.textContent = '已启动（麦克风就绪）';
  },
  interacted(action) {
    if (['pat', 'turn', 'blow'][tutorialStep] !== action) return;
    tutorialStep += 1;
    showHint(prompts[tutorialStep]);
  },
  appearing() { showHint(); },
  microphoneUnavailable(error) {
    const reason = error?.name === 'NotAllowedError'
      ? '麦克风权限被拒绝，请在 Safari 网站设置中允许麦克风后重试。'
      : `麦克风不可用：${error?.message || error}`;
    elements.debugError.textContent = reason;
    console.warn('[WebAR] Microphone unavailable:', error);
  },
  lost() {
    setStatus('目标丢失', 'lost');
    elements.debugTarget.textContent = '否';
    elements.debugModel.textContent = '否';
    elements.lostHint.hidden = false;
    elements.photo.hidden = true;
  },
  stopped() {
    tutorialStep = -1;
    showHint();
    setStatus('已停止', 'idle');
    elements.debugInit.textContent = '已停止';
    elements.debugTarget.textContent = '否';
    elements.debugModel.textContent = '否';
    elements.lostHint.hidden = true;
    elements.photo.hidden = true;
  },
  error(error) {
    showHint();
    const message = explainError(error);
    console.error('[WebAR]', error);
    setStatus('摄像头不可用', 'error');
    elements.debugInit.textContent = '失败';
    elements.debugTarget.textContent = '否';
    elements.debugModel.textContent = '否';
    elements.debugError.textContent = message;
    elements.lostHint.textContent = message;
    elements.lostHint.hidden = false;
    elements.photo.hidden = true;
  },
};

async function stopAR() {
  if (!session) return;
  await session.stop();
  session = null;
  setRunning(false);
  ui.stopped();
}

elements.start.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  elements.start.disabled = true;
  ui.initializing();
  try {
    session = createARSession({ container: elements.container, ui });
    await session.start();
    setRunning(true);
    ui.searching();
  } catch (error) {
    if (session) await session.stop().catch(() => {});
    session = null;
    setRunning(false);
    ui.error(error);
  } finally {
    busy = false;
    elements.start.disabled = false;
    elements.start.textContent = '启动 AR';
  }
});

elements.stop.addEventListener('click', stopAR);
elements.photo.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  elements.photo.disabled = true;
  try {
    if (session) await session.stop({ keepMusic: true });
    openPhotoFlow();
  } finally {
    busy = false;
    elements.photo.disabled = false;
  }
});
window.addEventListener('pagehide', () => session?.stop());
