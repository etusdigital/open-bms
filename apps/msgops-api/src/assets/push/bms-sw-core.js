/**
 * BMS Web-Push platform service worker — TEMPLATE.
 *
 * SINGLE-PROJECT model: there is ONE platform Firebase project for web-push (all
 * customer sites register under it). This file is the canonical source for the
 * shared service worker served at {BMS_ASSETS_URL}/bms/bms-sw.js.
 *
 * It is NOT served as-is: AdminFcmService regenerates it on save, substituting
 * the __BMS_*__ placeholders with the platform values configured in
 * Super-Admin → Integrations → FCM (firebaseConfig + tracker URL), then uploads
 * the result to S3 and purges the CDN cache.
 *
 * Per-account wrappers (bmspush-{hash}.js) still importScripts this core and add
 * their own opt-in/popup vars — the core stays single-project.
 *
 * Placeholders:
 *   __BMS_TRACKER_URL__      → events endpoint (web-push tracking)
 *   __BMS_FIREBASE_CONFIG__  → platform Firebase web config (JSON object literal)
 */
function sendTracker(data) {
  const currentDate = new Date();
  const body = JSON.stringify([{ ...data, timestamp: currentDate.getTime() }]);
  const requestOptions = {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    redirect: 'follow',
    mode: 'no-cors',
    body,
  };
  const apiUrl = '__BMS_TRACKER_URL__';
  fetch(apiUrl, requestOptions)
    .then(function (i) {
      if (200 !== i.status) throw void 0, new Error();
    })
    .catch(function () {});
}

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  var _a, _b;
  event.notification.close();
  const { data } = event.notification;
  const pathname = (data == null ? void 0 : data.link) || ((_b = (_a = data == null ? void 0 : data.FCM_MSG) == null ? void 0 : _a.notification) == null ? void 0 : _b.click_action);
  const payload = (data == null ? void 0 : data.FCM_MSG) ? (data == null ? void 0 : data.FCM_MSG.data) : data;
  payload.event = 'click';
  sendTracker(payload);
  if (!pathname) return;
  const url = new URL(pathname, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const hadWindowToFocus = clientsArr.some((windowClient) => (windowClient.url === url ? (windowClient.focus(), true) : false));
      if (!hadWindowToFocus) self.clients.openWindow(url).then((windowClient) => (windowClient ? windowClient.focus() : null));
    }),
  );
});

self.addEventListener('notificationclose', function (event) {
  const { data } = event.notification;
  const payload = (data == null ? void 0 : data.FCM_MSG) ? (data == null ? void 0 : data.FCM_MSG.data) : data;
  payload.event = 'close';
  sendTracker(payload);
});

if ('function' === typeof importScripts) {
  const firebaseVersion = '9.16.0';
  importScripts('https://www.gstatic.com/firebasejs/' + firebaseVersion + '/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/' + firebaseVersion + '/firebase-messaging-compat.js');
  const firebaseConfig = __BMS_FIREBASE_CONFIG__;
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(function (payload) {
    const data = payload.data;
    data.event = 'delivered';
    sendTracker(data);
  });
}
