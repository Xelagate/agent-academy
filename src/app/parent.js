// Parent gate for the Seeker build: a one-time wallet sign-in before the child's game,
// plus a small parent area. Talks to the game only through the DOM.
import {
  registerMwa,
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  SolanaMobileWalletAdapterWalletName,
} from '@solana-mobile/wallet-standard-mobile';
import { getWallets } from '@wallet-standard/app';

const KEY = 'agentAcademy.parent';
// The game’s own progress store (demo/engine.js); the parent area only reads its question jar.
const PROGRESS_KEY = 'agent-creatures-progress';
const APP_URL = location.origin + location.pathname.replace(/[^/]*$/, '');

try {
  registerMwa({
    appIdentity: { name: 'Hintville', uri: APP_URL, icon: 'icons/icon-192.png' },
    authorizationCache: createDefaultAuthorizationCache(),
    chains: ['solana:mainnet'],
    chainSelector: createDefaultChainSelector(),
    onWalletNotFound: createDefaultWalletNotFoundHandler(),
  });
} catch {
  // file:// pages have no origin; the gate still works, only the wallet is missing.
}

// Only a Seeker has a wallet built in (Seed Vault); on any other phone or browser the wallet gate is
// a dead end. Chrome on Android hides the model in the user agent ("K"), so ask the client hints too.
const onSeeker = (async () => {
  if (/\bSeeker\b/.test(navigator.userAgent)) return true;
  try {
    return (await navigator.userAgentData?.getHighEntropyValues(['model']))?.model === 'Seeker';
  } catch {
    return false;
  }
})();

function readParent() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function writeParent(address) {
  try { address ? localStorage.setItem(KEY, address) : localStorage.removeItem(KEY); } catch {}
}

function mwa() {
  return getWallets().get().find((w) => w.name === SolanaMobileWalletAdapterWalletName);
}

// Sign In With Solana where the wallet supports it, plain connect otherwise. Returns the address.
async function signIn() {
  const wallet = mwa();
  if (!wallet) throw new Error('no-wallet');
  const siws = wallet.features['solana:signIn'];
  if (siws) {
    const [result] = await siws.signIn({ domain: location.host, statement: 'Sign in as the parent on Hintville' });
    return result.account.address;
  }
  const { accounts } = await wallet.features['standard:connect'].connect();
  return accounts[0].address;
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const game = document.querySelector('.wrap');

function showGate() {
  if (document.getElementById('aa-gate')) return; // already up — never stack a second one
  const gate = el(`
    <div class="aa-gate" id="aa-gate" role="dialog" aria-modal="true" aria-labelledby="aa-gate-title">
      <div class="aa-gate__card">
        <h1 id="aa-gate-title">Make this Seeker a phone your child learns on</h1>
        <p>One sign-in with your wallet, once. Nothing is paid and no transaction is sent.</p>
        <button type="button" id="aa-connect">Connect wallet</button>
        <p class="aa-gate__error" id="aa-gate-error" role="alert" hidden></p>
        <button type="button" class="aa-link" id="aa-look">Just look around</button>
      </div>
    </div>`);
  const connect = gate.querySelector('#aa-connect');
  const error = gate.querySelector('#aa-gate-error');

  connect.addEventListener('click', async () => {
    connect.disabled = true;
    error.hidden = true;
    try {
      writeParent(await signIn());
      hideGate(gate);
    } catch (e) {
      error.textContent = e.message === 'no-wallet'
        ? 'No Solana wallet on this device. You can still look around.'
        : 'Sign-in didn’t finish. Try again when you’re ready.';
      error.hidden = false;
      connect.textContent = 'Try again';
      connect.disabled = false;
    }
  });
  gate.querySelector('#aa-look').addEventListener('click', () => hideGate(gate));

  game.inert = true;
  parentsButton.inert = true;
  document.body.append(gate);
  connect.focus();
}

function hideGate(gate) {
  game.inert = false;
  parentsButton.inert = false;
  gate.classList.add('aa-gate--leaving');
  setTimeout(() => gate.remove(), 200);
}

function shortAddress(a) {
  return a.slice(0, 4) + '…' + a.slice(-4);
}

const sheet = el(`
  <dialog class="aa-sheet" id="aa-sheet" aria-labelledby="aa-sheet-title">
    <h2 id="aa-sheet-title">Parents</h2>
    <p class="aa-sheet__wallet"></p>
    <button type="button" id="aa-account"></button>
    <section class="aa-jar">
      <h3>Questions to talk about</h3>
      <ul class="aa-jar__list"></ul>
    </section>
    <button type="button" class="aa-link" id="aa-close">Close</button>
  </dialog>`);

async function openSheet() {
  const seeker = await onSeeker;
  sheet.querySelector('.aa-sheet__wallet').hidden = !seeker;
  sheet.querySelector('#aa-account').hidden = !seeker;
  const parent = readParent();
  sheet.querySelector('.aa-sheet__wallet').innerHTML = parent
    ? 'Signed in as <code id="aa-address"></code>'
    : 'No parent signed in on this device.';
  if (parent) sheet.querySelector('#aa-address').textContent = shortAddress(parent);
  sheet.querySelector('#aa-account').textContent = parent ? 'Disconnect' : 'Connect wallet';
  let jar = [];
  try { jar = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}').jar || []; } catch {}
  const items = jar.length ? jar.map((j) => j.text) : ['No questions yet.'];
  sheet.querySelector('.aa-jar__list').replaceChildren(...items.map((text) => Object.assign(document.createElement('li'), { textContent: text })));
  sheet.showModal();
}

sheet.querySelector('#aa-account').addEventListener('click', () => {
  if (readParent()) {
    writeParent(null);
    try { mwa()?.features['standard:disconnect']?.disconnect(); } catch {}
  }
  sheet.close();
  showGate();
});
sheet.querySelector('#aa-close').addEventListener('click', () => sheet.close());

const parentsButton = el('<button type="button" class="aa-parents-btn" id="aa-parents">Parents</button>');
parentsButton.addEventListener('click', openSheet);
document.body.append(parentsButton, sheet);

onSeeker.then((seeker) => { if (seeker && !readParent()) showGate(); });
