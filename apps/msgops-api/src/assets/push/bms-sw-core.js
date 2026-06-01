/**
 * BMS Web-Push core service worker — TEMPLATE.
 *
 * This is the canonical source for the web-push service worker. It is NOT served
 * as-is: `AccountsService.uploadWebPushFile()` reads this file and produces a
 * self-contained per-account service worker by replacing the __BMS_* placeholders
 * with the account's own values. The generated file is uploaded to S3 and is what
 * the customer's site ultimately registers.
 *
 * Why inline (no importScripts of a shared core): there is no deploy path that
 * uploads a shared core to S3, and per-account Firebase config must be baked in so
 * register-project === send-project (otherwise FCM SenderId mismatch). Generating
 * a self-contained file per account makes the config effective immediately through
 * the existing upload path.
 *
 * Placeholders (substituted at generation time):
 *   __BMS_TRACKER_URL__      → events endpoint (e.g. https://in.bri.us/bms/events?platform=web-push)
 *   __BMS_FIREBASE_CONFIG__  → JSON object literal of the account's Firebase web config
 *                              (falls back to the platform config when the account has none)
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
