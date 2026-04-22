(function () {
  // Configuration is provided by the embedding page via a global `window.BMS_CONFIG` object,
  // or substituted at serve-time by replacing the `__BMS_*__` placeholders.
  // Example:
  //   <script>window.BMS_CONFIG = { apiKey: 'your-account-api-key' };</script>
  //   <script async src="https://your-tracker.example.com/bmstrk.js"></script>
  const bmsConfig = (typeof window !== 'undefined' && window.BMS_CONFIG) || {};
  const msgOpsCookie = bmsConfig.cookieName || 'bmsInfo';
  const apiKey = bmsConfig.apiKey || '__BMS_API_KEY__';
  const ingestEndpoint = bmsConfig.ingestEndpoint || '__BMS_INGEST_ENDPOINT__';
  const quizCookies = Array.isArray(bmsConfig.quizCookies) ? bmsConfig.quizCookies : [];

  var bmsInfo = bmsInfo || {};
  window.bmsInfo = bmsInfo;

  //#region cookies
  function findCookie(e) {
    for (
      var o = e + '=', t = decodeURIComponent(document.cookie.replace(/%%/g, '')).split(';'), i = 0;
      i < t.length;
      i++
    ) {
      for (var a = t[i]; ' ' == a.charAt(0); ) a = a.substring(1);

      if (0 == a.indexOf(o)) return a.substring(o.length, a.length);
    }
    return '';
  }

  function setCookie(name, value, days, props = '') {
    var expires = '';

    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = '; expires=' + date.toUTCString();
    }
    if (!props) {
      props = '; path=/';
    }

    document.cookie = name + '=' + (value || '') + expires + props;
  }
  //#endregion cookies

  async function getDataByEmail(email) {
    if (!email) return;

    var body = JSON.stringify({
      data: window.btoa(JSON.stringify({ e: email })),
    });

    var requestOptions = {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      redirect: 'follow',
      body,
    };

    try {
      const response = await fetch(ingestEndpoint, requestOptions);
      return await response.json();
    } catch (error) {
      console.log('error', error);
      return;
    }
  }

  async function init() {
    var userEmail = null;
    var bmsData = findCookie(msgOpsCookie);
    if (bmsData) {
      try {
        bmsData = JSON.parse(bmsData);
        console.log('found DATA on cookie');
        if (bmsData.email) userEmail = bmsData.email;
        if (bmsData) window.bmsInfo = bmsData;
      } catch (error) {
        bmsData = null;
        console.log('error to parse cookie');
      }
    }

    if (!userEmail) {
      quizCookies.forEach((cookie) => {
        if (!userEmail) {
          try {
            let cookieData = (findCookie(cookie) && JSON.parse(findCookie(cookie))) || {};
            if (cookieData && cookieData.email) {
              userEmail = cookieData.email;
              console.log('found email', cookieData.email);
            }
          } catch (error) {
            console.log('error to parse cookie', cookie);
          }
        }
      });
    }

    if (userEmail && (!bmsData || !bmsData.email)) {
      console.log('fetching API.....');
      let data = await getDataByEmail(userEmail);
      console.log('data', data);
      console.log('DONE fetching API');
      if (data) {
        try {
          window.bmsInfo = JSON.parse(data) || '';
        } catch (error) {
          console.log('error to parse data');
        }
      }
    }

    if (window.bmsInfo) {
      console.log('setting cookie');
      const d = new Date();
      d.setTime(d.getTime() + 1 * 60 * 60 * 1000);
      let expires = `expires=${d.toUTCString()}`;

      const cookieProps = `; SameSite=Strict; expires=${expires}; path=/; Secure`;

      setCookie(msgOpsCookie, JSON.stringify(window.bmsInfo), null, cookieProps);
    }
  }
  init();
})();
