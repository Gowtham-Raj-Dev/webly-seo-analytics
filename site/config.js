// Public config (none of these are secrets; access is enforced by Google sign-in + Firestore rules).
window.PULSE_CONFIG = {
  // Same Firebase project as admin.codelove.in (Auth for login, Firestore for the public site directory).
  firebase: {
    apiKey: 'AIzaSyDxvgBOnJBPpUNgoYk_8Dpk85ahxMrqv5I',
    authDomain: 'codelove-analytics.firebaseapp.com',
    projectId: 'codelove-analytics',
    appId: '1:698568650935:web:aa0e80d4e9a60d96765d32',
  },
  // Google OAuth web client (Analytics, Search Console, AdSense read-only). Its "Authorized JavaScript origins"
  // must include the origin this app runs on (http://localhost:5500 works today).
  clientId: '781001965138-9crgq57sfveht5kdt5frcieu4ear77l9.apps.googleusercontent.com',
  // Page-fetch proxy used by the tools (broken links, page checker, health, uptime).
  // Local: served by dev-server.js. Production: URL of the Cloudflare Worker in /worker.
  proxy: '/api/fetch',
};
