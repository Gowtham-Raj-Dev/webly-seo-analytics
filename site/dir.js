/* Firebase: Google login (identity) + the public site directory ("Sites on <brand>", free promotion, opt-in).
   Firestore collection directory/{host_with_underscores} = { host, name, desc, uid, at }.
   Anyone can read it; only the user who published a site can change or remove it (see firestore.rules). */
(() => {
  'use strict';
  const CFG = window.PULSE_CONFIG || {};
  let auth = null, db = null, ready = false;
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  const V = '10.12.2';
  async function init() {
    if (ready) return; ready = true;
    for (const f of ['app', 'auth', 'firestore']) await loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-${f}-compat.js`);
    firebase.initializeApp(CFG.firebase); auth = firebase.auth(); db = firebase.firestore();
  }
  const id = (host) => host.replace(/\./g, '_');
  const D = {
    init,
    /** Calls cb(user|null) now and whenever login changes. */
    async onUser(cb) { await init(); auth.onAuthStateChanged((u) => cb(u ? { uid: u.uid, name: u.displayName || u.email, email: u.email, photo: u.photoURL } : null)); },
    async signIn() { await init(); const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); await auth.signInWithPopup(p); },
    async signOut() { await init(); await auth.signOut(); },
    /** Public list for the home page. */
    async list(limit = 60) { await init(); const s = await db.collection('directory').orderBy('at', 'desc').limit(limit).get(); return s.docs.map((d) => d.data()); },
    async mine() { await init(); if (!auth.currentUser) return []; const s = await db.collection('directory').where('uid', '==', auth.currentUser.uid).get(); return s.docs.map((d) => d.data()); },
    async publish(host, name, desc) {
      await init(); if (!auth.currentUser) throw new Error('Sign in first.');
      await db.collection('directory').doc(id(host)).set({ host, name: String(name).slice(0, 60), desc: String(desc || '').slice(0, 160), uid: auth.currentUser.uid, at: Date.now() });
    },
    async unpublish(host) { await init(); await db.collection('directory').doc(id(host)).delete(); },
  };
  window.DIR = D;
})();
