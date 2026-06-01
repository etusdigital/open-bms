var __defProp = Object.defineProperty,
  __defNormalProp = (e, t, r) => (t in e ? __defProp(e, t, { enumerable: !0, configurable: !0, writable: !0, value: r }) : (e[t] = r)),
  __publicField = (e, t, r) => (__defNormalProp(e, 'symbol' != typeof t ? t + '' : t, r), r),
  LogLevel;
const stringToByteArray$1 = function (r) {
    var n = [];
    let a = 0;
    for (let t = 0; t < r.length; t++) {
      let e = r.charCodeAt(t);
      e < 128
        ? (n[a++] = e)
        : (e < 2048
            ? (n[a++] = (e >> 6) | 192)
            : (55296 == (64512 & e) && t + 1 < r.length && 56320 == (64512 & r.charCodeAt(t + 1))
                ? ((e = 65536 + ((1023 & e) << 10) + (1023 & r.charCodeAt(++t))), (n[a++] = (e >> 18) | 240), (n[a++] = ((e >> 12) & 63) | 128))
                : (n[a++] = (e >> 12) | 224),
              (n[a++] = ((e >> 6) & 63) | 128)),
          (n[a++] = (63 & e) | 128));
    }
    return n;
  },
  byteArrayToString = function (e) {
    var t = [];
    let r = 0,
      n = 0;
    for (; r < e.length; ) {
      var a,
        i,
        o,
        s = e[r++];
      s < 128
        ? (t[n++] = String.fromCharCode(s))
        : 191 < s && s < 224
          ? ((a = e[r++]), (t[n++] = String.fromCharCode(((31 & s) << 6) | (63 & a))))
          : 239 < s && s < 365
            ? ((a = (((7 & s) << 18) | ((63 & e[r++]) << 12) | ((63 & e[r++]) << 6) | (63 & e[r++])) - 65536),
              (t[n++] = String.fromCharCode(55296 + (a >> 10))),
              (t[n++] = String.fromCharCode(56320 + (1023 & a))))
            : ((i = e[r++]), (o = e[r++]), (t[n++] = String.fromCharCode(((15 & s) << 12) | ((63 & i) << 6) | (63 & o))));
    }
    return t.join('');
  },
  base64 = {
    byteToCharMap_: null,
    charToByteMap_: null,
    byteToCharMapWebSafe_: null,
    charToByteMapWebSafe_: null,
    ENCODED_VALS_BASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    get ENCODED_VALS() {
      return this.ENCODED_VALS_BASE + '+/=';
    },
    get ENCODED_VALS_WEBSAFE() {
      return this.ENCODED_VALS_BASE + '-_.';
    },
    HAS_NATIVE_SUPPORT: 'function' == typeof atob,
    encodeByteArray(n, e) {
      if (!Array.isArray(n)) throw Error('encodeByteArray takes an array as a parameter');
      this.init_();
      var a = e ? this.byteToCharMapWebSafe_ : this.byteToCharMap_,
        i = [];
      for (let r = 0; r < n.length; r += 3) {
        var o = n[r],
          s = r + 1 < n.length,
          c = s ? n[r + 1] : 0,
          d = r + 2 < n.length,
          l = d ? n[r + 2] : 0;
        let e = ((15 & c) << 2) | (l >> 6),
          t = 63 & l;
        (d || ((t = 64), s) || (e = 64), i.push(a[o >> 2], a[((3 & o) << 4) | (c >> 4)], a[e], a[t]));
      }
      return i.join('');
    },
    encodeString(e, t) {
      return this.HAS_NATIVE_SUPPORT && !t ? btoa(e) : this.encodeByteArray(stringToByteArray$1(e), t);
    },
    decodeString(e, t) {
      return this.HAS_NATIVE_SUPPORT && !t ? atob(e) : byteArrayToString(this.decodeStringToByteArray(e, t));
    },
    decodeStringToByteArray(t, e) {
      this.init_();
      var r = e ? this.charToByteMapWebSafe_ : this.charToByteMap_,
        n = [];
      for (let e = 0; e < t.length; ) {
        var a = r[t.charAt(e++)],
          i = e < t.length ? r[t.charAt(e)] : 0,
          o = ++e < t.length ? r[t.charAt(e)] : 64,
          s = ++e < t.length ? r[t.charAt(e)] : 64;
        if ((++e, null == a || null == i || null == o || null == s)) throw Error();
        (n.push((a << 2) | (i >> 4)), 64 !== o && (n.push(((i << 4) & 240) | (o >> 2)), 64 !== s) && n.push(((o << 6) & 192) | s));
      }
      return n;
    },
    init_() {
      if (!this.byteToCharMap_) {
        ((this.byteToCharMap_ = {}), (this.charToByteMap_ = {}), (this.byteToCharMapWebSafe_ = {}), (this.charToByteMapWebSafe_ = {}));
        for (let e = 0; e < this.ENCODED_VALS.length; e++)
          ((this.byteToCharMap_[e] = this.ENCODED_VALS.charAt(e)),
            (this.charToByteMap_[this.byteToCharMap_[e]] = e),
            (this.byteToCharMapWebSafe_[e] = this.ENCODED_VALS_WEBSAFE.charAt(e)),
            (this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[e]] = e) >= this.ENCODED_VALS_BASE.length &&
              ((this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(e)] = e), (this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(e)] = e)));
      }
    },
  },
  base64Encode = function (e) {
    e = stringToByteArray$1(e);
    return base64.encodeByteArray(e, !0);
  },
  base64urlEncodeWithoutPadding = function (e) {
    return base64Encode(e).replace(/\./g, '');
  },
  base64Decode = function (e) {
    try {
      return base64.decodeString(e, !0);
    } catch (e) {}
    return null;
  };
function isIndexedDBAvailable() {
  try {
    return 'object' == typeof indexedDB;
  } catch (e) {
    return !1;
  }
}
function validateIndexedDBOpenable() {
  return new Promise((t, r) => {
    try {
      let e = !0;
      const n = 'validate-browser-context-for-indexeddb-analytics-module',
        a = self.indexedDB.open(n);
      ((a.onsuccess = () => {
        (a.result.close(), e || self.indexedDB.deleteDatabase(n), t(!0));
      }),
        (a.onupgradeneeded = () => {
          e = !1;
        }),
        (a.onerror = () => {
          var e;
          r((null == (e = a.error) ? void 0 : e.message) || '');
        }));
    } catch (e) {
      r(e);
    }
  });
}
function areCookiesEnabled() {
  return !('undefined' == typeof navigator || !navigator.cookieEnabled);
}
function getGlobal() {
  if ('undefined' != typeof self) return self;
  if ('undefined' != typeof window) return window;
  if ('undefined' != typeof global) return global;
  throw new Error('Unable to locate global object.');
}
const getDefaultsFromGlobal = () => getGlobal().__FIREBASE_DEFAULTS__,
  getDefaultsFromEnvVariable = () => {
    var e;
    return 'undefined' != typeof process && void 0 !== process.env && (e = {}.__FIREBASE_DEFAULTS__) ? JSON.parse(e) : void 0;
  },
  getDefaultsFromCookie = () => {
    if ('undefined' != typeof document) {
      let e;
      try {
        e = document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/);
      } catch (e) {
        return;
      }
      var t = e && base64Decode(e[1]);
      return t && JSON.parse(t);
    }
  },
  getDefaults = () => {
    try {
      return getDefaultsFromGlobal() || getDefaultsFromEnvVariable() || getDefaultsFromCookie();
    } catch (e) {}
  },
  getDefaultAppConfig = () => {
    var e;
    return null == (e = getDefaults()) ? void 0 : e.config;
  };
class Deferred {
  constructor() {
    ((this.reject = () => {}),
      (this.resolve = () => {}),
      (this.promise = new Promise((e, t) => {
        ((this.resolve = e), (this.reject = t));
      })));
  }
  wrapCallback(r) {
    return (e, t) => {
      (e ? this.reject(e) : this.resolve(t), 'function' == typeof r && (this.promise.catch(() => {}), 1 === r.length ? r(e) : r(e, t)));
    };
  }
}
const ERROR_NAME = 'FirebaseError';
class FirebaseError extends Error {
  constructor(e, t, r) {
    (super(t),
      (this.code = e),
      (this.customData = r),
      (this.name = ERROR_NAME),
      Object.setPrototypeOf(this, FirebaseError.prototype),
      Error.captureStackTrace && Error.captureStackTrace(this, ErrorFactory.prototype.create));
  }
}
class ErrorFactory {
  constructor(e, t, r) {
    ((this.service = e), (this.serviceName = t), (this.errors = r));
  }
  create(e, ...t) {
    var t = t[0] || {},
      r = this.service + '/' + e,
      e = this.errors[e],
      e = e ? replaceTemplate(e, t) : 'Error',
      e = this.serviceName + `: ${e} (${r}).`;
    return new FirebaseError(r, e, t);
  }
}
function replaceTemplate(e, n) {
  return e.replace(PATTERN, (e, t) => {
    var r = n[t];
    return null != r ? String(r) : `<${t}?>`;
  });
}
const PATTERN = /\{\$([^}]+)}/g;
function deepEqual(e, t) {
  if (e !== t) {
    var r = Object.keys(e),
      n = Object.keys(t);
    for (const o of r) {
      if (!n.includes(o)) return !1;
      var a = e[o],
        i = t[o];
      if (isObject(a) && isObject(i)) {
        if (!deepEqual(a, i)) return !1;
      } else if (a !== i) return !1;
    }
    for (const s of n) if (!r.includes(s)) return !1;
  }
  return !0;
}
function isObject(e) {
  return null !== e && 'object' == typeof e;
}
function getModularInstance(e) {
  return e && e._delegate ? e._delegate : e;
}
class Component {
  constructor(e, t, r) {
    ((this.name = e),
      (this.instanceFactory = t),
      (this.type = r),
      (this.multipleInstances = !1),
      (this.serviceProps = {}),
      (this.instantiationMode = 'LAZY'),
      (this.onInstanceCreated = null));
  }
  setInstantiationMode(e) {
    return ((this.instantiationMode = e), this);
  }
  setMultipleInstances(e) {
    return ((this.multipleInstances = e), this);
  }
  setServiceProps(e) {
    return ((this.serviceProps = e), this);
  }
  setInstanceCreatedCallback(e) {
    return ((this.onInstanceCreated = e), this);
  }
}
const DEFAULT_ENTRY_NAME$1 = '[DEFAULT]';
class Provider {
  constructor(e, t) {
    ((this.name = e),
      (this.container = t),
      (this.component = null),
      (this.instances = new Map()),
      (this.instancesDeferred = new Map()),
      (this.instancesOptions = new Map()),
      (this.onInitCallbacks = new Map()));
  }
  get(e) {
    e = this.normalizeInstanceIdentifier(e);
    if (!this.instancesDeferred.has(e)) {
      var t = new Deferred();
      if ((this.instancesDeferred.set(e, t), this.isInitialized(e) || this.shouldAutoInitialize()))
        try {
          var r = this.getOrInitializeService({ instanceIdentifier: e });
          r && t.resolve(r);
        } catch (e) {}
    }
    return this.instancesDeferred.get(e).promise;
  }
  getImmediate(t) {
    var e = this.normalizeInstanceIdentifier(null == t ? void 0 : t.identifier),
      t = null != (t = null == t ? void 0 : t.optional) && t;
    if (!this.isInitialized(e) && !this.shouldAutoInitialize()) {
      if (t) return null;
      throw Error(`Service ${this.name} is not available`);
    }
    try {
      return this.getOrInitializeService({ instanceIdentifier: e });
    } catch (e) {
      if (t) return null;
      throw e;
    }
  }
  getComponent() {
    return this.component;
  }
  setComponent(e) {
    if (e.name !== this.name) throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);
    if (this.component) throw Error(`Component for ${this.name} has already been provided`);
    if (((this.component = e), this.shouldAutoInitialize())) {
      if (isComponentEager(e))
        try {
          this.getOrInitializeService({ instanceIdentifier: DEFAULT_ENTRY_NAME$1 });
        } catch (e) {}
      for (var [t, r] of this.instancesDeferred.entries()) {
        t = this.normalizeInstanceIdentifier(t);
        try {
          var n = this.getOrInitializeService({ instanceIdentifier: t });
          r.resolve(n);
        } catch (e) {}
      }
    }
  }
  clearInstance(e = DEFAULT_ENTRY_NAME$1) {
    (this.instancesDeferred.delete(e), this.instancesOptions.delete(e), this.instances.delete(e));
  }
  async delete() {
    var e = Array.from(this.instances.values());
    await Promise.all([...e.filter((e) => 'INTERNAL' in e).map((e) => e.INTERNAL.delete()), ...e.filter((e) => '_delete' in e).map((e) => e._delete())]);
  }
  isComponentSet() {
    return null != this.component;
  }
  isInitialized(e = DEFAULT_ENTRY_NAME$1) {
    return this.instances.has(e);
  }
  getOptions(e = DEFAULT_ENTRY_NAME$1) {
    return this.instancesOptions.get(e) || {};
  }
  initialize(e = {}) {
    var { options: t = {} } = e,
      r = this.normalizeInstanceIdentifier(e.instanceIdentifier);
    if (this.isInitialized(r)) throw Error(this.name + `(${r}) has already been initialized`);
    if (!this.isComponentSet()) throw Error(`Component ${this.name} has not been registered yet`);
    var n,
      a,
      i = this.getOrInitializeService({ instanceIdentifier: r, options: t });
    for ([n, a] of this.instancesDeferred.entries()) r === this.normalizeInstanceIdentifier(n) && a.resolve(i);
    return i;
  }
  onInit(e, t) {
    t = this.normalizeInstanceIdentifier(t);
    const r = null != (n = this.onInitCallbacks.get(t)) ? n : new Set();
    (r.add(e), this.onInitCallbacks.set(t, r));
    var n = this.instances.get(t);
    return (
      n && e(n, t),
      () => {
        r.delete(e);
      }
    );
  }
  invokeOnInitCallbacks(e, t) {
    var r = this.onInitCallbacks.get(t);
    if (r)
      for (const n of r)
        try {
          n(e, t);
        } catch (e) {}
  }
  getOrInitializeService({ instanceIdentifier: e, options: t = {} }) {
    let r = this.instances.get(e);
    if (
      !r &&
      this.component &&
      ((r = this.component.instanceFactory(this.container, { instanceIdentifier: normalizeIdentifierForFactory(e), options: t })),
      this.instances.set(e, r),
      this.instancesOptions.set(e, t),
      this.invokeOnInitCallbacks(r, e),
      this.component.onInstanceCreated)
    )
      try {
        this.component.onInstanceCreated(this.container, e, r);
      } catch (e) {}
    return r || null;
  }
  normalizeInstanceIdentifier(e = DEFAULT_ENTRY_NAME$1) {
    return !this.component || this.component.multipleInstances ? e : DEFAULT_ENTRY_NAME$1;
  }
  shouldAutoInitialize() {
    return !!this.component && 'EXPLICIT' !== this.component.instantiationMode;
  }
}
function normalizeIdentifierForFactory(e) {
  return e === DEFAULT_ENTRY_NAME$1 ? void 0 : e;
}
function isComponentEager(e) {
  return 'EAGER' === e.instantiationMode;
}
class ComponentContainer {
  constructor(e) {
    ((this.name = e), (this.providers = new Map()));
  }
  addComponent(e) {
    var t = this.getProvider(e.name);
    if (t.isComponentSet()) throw new Error(`Component ${e.name} has already been registered with ` + this.name);
    t.setComponent(e);
  }
  addOrOverwriteComponent(e) {
    (this.getProvider(e.name).isComponentSet() && this.providers.delete(e.name), this.addComponent(e));
  }
  getProvider(e) {
    var t;
    return this.providers.has(e) ? this.providers.get(e) : ((t = new Provider(e, this)), this.providers.set(e, t), t);
  }
  getProviders() {
    return Array.from(this.providers.values());
  }
}
!(function (e) {
  ((e[(e.DEBUG = 0)] = 'DEBUG'),
    (e[(e.VERBOSE = 1)] = 'VERBOSE'),
    (e[(e.INFO = 2)] = 'INFO'),
    (e[(e.WARN = 3)] = 'WARN'),
    (e[(e.ERROR = 4)] = 'ERROR'),
    (e[(e.SILENT = 5)] = 'SILENT'));
})((LogLevel = LogLevel || {}));
const levelStringToEnum = { debug: LogLevel.DEBUG, verbose: LogLevel.VERBOSE, info: LogLevel.INFO, warn: LogLevel.WARN, error: LogLevel.ERROR, silent: LogLevel.SILENT },
  defaultLogLevel = LogLevel.INFO,
  ConsoleMethod = { [LogLevel.DEBUG]: 'log', [LogLevel.VERBOSE]: 'log', [LogLevel.INFO]: 'info', [LogLevel.WARN]: 'warn', [LogLevel.ERROR]: 'error' },
  defaultLogHandler = (e, t) => {
    if (!(t < e.logLevel)) {
      new Date().toISOString();
      e = ConsoleMethod[t];
      if (!e) throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`);
    }
  };
class Logger {
  constructor(e) {
    ((this.name = e), (this._logLevel = defaultLogLevel), (this._logHandler = defaultLogHandler), (this._userLogHandler = null));
  }
  get logLevel() {
    return this._logLevel;
  }
  set logLevel(e) {
    if (!(e in LogLevel)) throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);
    this._logLevel = e;
  }
  setLogLevel(e) {
    this._logLevel = 'string' == typeof e ? levelStringToEnum[e] : e;
  }
  get logHandler() {
    return this._logHandler;
  }
  set logHandler(e) {
    if ('function' != typeof e) throw new TypeError('Value assigned to `logHandler` must be a function');
    this._logHandler = e;
  }
  get userLogHandler() {
    return this._userLogHandler;
  }
  set userLogHandler(e) {
    this._userLogHandler = e;
  }
  debug(...e) {
    (this._userLogHandler && this._userLogHandler(this, LogLevel.DEBUG, ...e), this._logHandler(this, LogLevel.DEBUG, ...e));
  }
  log(...e) {
    (this._userLogHandler && this._userLogHandler(this, LogLevel.VERBOSE, ...e), this._logHandler(this, LogLevel.VERBOSE, ...e));
  }
  info(...e) {
    (this._userLogHandler && this._userLogHandler(this, LogLevel.INFO, ...e), this._logHandler(this, LogLevel.INFO, ...e));
  }
  warn(...e) {
    (this._userLogHandler && this._userLogHandler(this, LogLevel.WARN, ...e), this._logHandler(this, LogLevel.WARN, ...e));
  }
  error(...e) {
    (this._userLogHandler && this._userLogHandler(this, LogLevel.ERROR, ...e), this._logHandler(this, LogLevel.ERROR, ...e));
  }
}
const instanceOfAny = (t, e) => e.some((e) => t instanceof e);
let idbProxyableTypes, cursorAdvanceMethods;
function getIdbProxyableTypes() {
  return (idbProxyableTypes = idbProxyableTypes || [IDBDatabase, IDBObjectStore, IDBIndex, IDBCursor, IDBTransaction]);
}
function getCursorAdvanceMethods() {
  return (cursorAdvanceMethods = cursorAdvanceMethods || [IDBCursor.prototype.advance, IDBCursor.prototype.continue, IDBCursor.prototype.continuePrimaryKey]);
}
const cursorRequestMap = new WeakMap(),
  transactionDoneMap = new WeakMap(),
  transactionStoreNamesMap = new WeakMap(),
  transformCache = new WeakMap(),
  reverseTransformCache = new WeakMap();
function promisifyRequest(i) {
  var e = new Promise((e, t) => {
    const r = () => {
        (i.removeEventListener('success', n), i.removeEventListener('error', a));
      },
      n = () => {
        (e(wrap(i.result)), r());
      },
      a = () => {
        (t(i.error), r());
      };
    (i.addEventListener('success', n), i.addEventListener('error', a));
  });
  return (
    e
      .then((e) => {
        e instanceof IDBCursor && cursorRequestMap.set(e, i);
      })
      .catch(() => {}),
    reverseTransformCache.set(e, i),
    e
  );
}
function cacheDonePromiseForTransaction(i) {
  var e;
  transactionDoneMap.has(i) ||
    ((e = new Promise((e, t) => {
      const r = () => {
          (i.removeEventListener('complete', n), i.removeEventListener('error', a), i.removeEventListener('abort', a));
        },
        n = () => {
          (e(), r());
        },
        a = () => {
          (t(i.error || new DOMException('AbortError', 'AbortError')), r());
        };
      (i.addEventListener('complete', n), i.addEventListener('error', a), i.addEventListener('abort', a));
    })),
    transactionDoneMap.set(i, e));
}
let idbProxyTraps = {
  get(e, t, r) {
    if (e instanceof IDBTransaction) {
      if ('done' === t) return transactionDoneMap.get(e);
      if ('objectStoreNames' === t) return e.objectStoreNames || transactionStoreNamesMap.get(e);
      if ('store' === t) return r.objectStoreNames[1] ? void 0 : r.objectStore(r.objectStoreNames[0]);
    }
    return wrap(e[t]);
  },
  set(e, t, r) {
    return ((e[t] = r), !0);
  },
  has(e, t) {
    return (e instanceof IDBTransaction && ('done' === t || 'store' === t)) || t in e;
  },
};
function replaceTraps(e) {
  idbProxyTraps = e(idbProxyTraps);
}
function wrapFunction(r) {
  return r !== IDBDatabase.prototype.transaction || 'objectStoreNames' in IDBTransaction.prototype
    ? getCursorAdvanceMethods().includes(r)
      ? function (...e) {
          return (r.apply(unwrap(this), e), wrap(cursorRequestMap.get(this)));
        }
      : function (...e) {
          return wrap(r.apply(unwrap(this), e));
        }
    : function (e, ...t) {
        t = r.call(unwrap(this), e, ...t);
        return (transactionStoreNamesMap.set(t, e.sort ? e.sort() : [e]), wrap(t));
      };
}
function transformCachableValue(e) {
  return 'function' == typeof e
    ? wrapFunction(e)
    : (e instanceof IDBTransaction && cacheDonePromiseForTransaction(e), instanceOfAny(e, getIdbProxyableTypes()) ? new Proxy(e, idbProxyTraps) : e);
}
function wrap(e) {
  var t;
  return e instanceof IDBRequest
    ? promisifyRequest(e)
    : transformCache.has(e)
      ? transformCache.get(e)
      : ((t = transformCachableValue(e)) !== e && (transformCache.set(e, t), reverseTransformCache.set(t, e)), t);
}
const unwrap = (e) => reverseTransformCache.get(e);
function openDB(e, t, { blocked: r, upgrade: n, blocking: a, terminated: i } = {}) {
  const o = indexedDB.open(e, t);
  e = wrap(o);
  return (
    n &&
      o.addEventListener('upgradeneeded', (e) => {
        n(wrap(o.result), e.oldVersion, e.newVersion, wrap(o.transaction));
      }),
    r && o.addEventListener('blocked', () => r()),
    e
      .then((e) => {
        (i && e.addEventListener('close', () => i()), a && e.addEventListener('versionchange', () => a()));
      })
      .catch(() => {}),
    e
  );
}
function deleteDB(e, { blocked: t } = {}) {
  e = indexedDB.deleteDatabase(e);
  return (t && e.addEventListener('blocked', () => t()), wrap(e).then(() => {}));
}
const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'],
  writeMethods = ['put', 'add', 'delete', 'clear'],
  cachedMethods = new Map();
function getMethod(e, t) {
  if (e instanceof IDBDatabase && !(t in e) && 'string' == typeof t) {
    if (cachedMethods.get(t)) return cachedMethods.get(t);
    const n = t.replace(/FromIndex$/, ''),
      a = t !== n,
      i = writeMethods.includes(n);
    return n in (a ? IDBIndex : IDBObjectStore).prototype && (i || readMethods.includes(n))
      ? ((e = async function (e, ...t) {
          e = this.transaction(e, i ? 'readwrite' : 'readonly');
          let r = e.store;
          return (a && (r = r.index(t.shift())), (await Promise.all([r[n](...t), i && e.done]))[0]);
        }),
        cachedMethods.set(t, e),
        e)
      : void 0;
  }
}
replaceTraps((n) => ({ ...n, get: (e, t, r) => getMethod(e, t) || n.get(e, t, r), has: (e, t) => !!getMethod(e, t) || n.has(e, t) }));
class PlatformLoggerServiceImpl {
  constructor(e) {
    this.container = e;
  }
  getPlatformInfoString() {
    return this.container
      .getProviders()
      .map((e) => {
        return isVersionServiceProvider(e) ? (e = e.getImmediate()).library + '/' + e.version : null;
      })
      .filter((e) => e)
      .join(' ');
  }
}
function isVersionServiceProvider(e) {
  e = e.getComponent();
  return 'VERSION' === (null == e ? void 0 : e.type);
}
const name$o = '@firebase/app',
  version$1$1 = '0.9.0',
  logger = new Logger('@firebase/app'),
  name$n = '@firebase/app-compat',
  name$m = '@firebase/analytics-compat',
  name$l = '@firebase/analytics',
  name$k = '@firebase/app-check-compat',
  name$j = '@firebase/app-check',
  name$i = '@firebase/auth',
  name$h = '@firebase/auth-compat',
  name$g = '@firebase/database',
  name$f = '@firebase/database-compat',
  name$e = '@firebase/functions',
  name$d = '@firebase/functions-compat',
  name$c = '@firebase/installations',
  name$b = '@firebase/installations-compat',
  name$a = '@firebase/messaging',
  name$9 = '@firebase/messaging-compat',
  name$8 = '@firebase/performance',
  name$7 = '@firebase/performance-compat',
  name$6 = '@firebase/remote-config',
  name$5 = '@firebase/remote-config-compat',
  name$4 = '@firebase/storage',
  name$3 = '@firebase/storage-compat',
  name$2$1 = '@firebase/firestore',
  name$1$1 = '@firebase/firestore-compat',
  name$p = 'firebase',
  DEFAULT_ENTRY_NAME = '[DEFAULT]',
  PLATFORM_LOG_STRING = {
    [name$o]: 'fire-core',
    [name$n]: 'fire-core-compat',
    [name$l]: 'fire-analytics',
    [name$m]: 'fire-analytics-compat',
    [name$j]: 'fire-app-check',
    [name$k]: 'fire-app-check-compat',
    [name$i]: 'fire-auth',
    [name$h]: 'fire-auth-compat',
    [name$g]: 'fire-rtdb',
    [name$f]: 'fire-rtdb-compat',
    [name$e]: 'fire-fn',
    [name$d]: 'fire-fn-compat',
    [name$c]: 'fire-iid',
    [name$b]: 'fire-iid-compat',
    [name$a]: 'fire-fcm',
    [name$9]: 'fire-fcm-compat',
    [name$8]: 'fire-perf',
    [name$7]: 'fire-perf-compat',
    [name$6]: 'fire-rc',
    [name$5]: 'fire-rc-compat',
    [name$4]: 'fire-gcs',
    [name$3]: 'fire-gcs-compat',
    [name$2$1]: 'fire-fst',
    [name$1$1]: 'fire-fst-compat',
    'fire-js': 'fire-js',
    [name$p]: 'fire-js-all',
  },
  _apps = new Map(),
  _components = new Map();
function _addComponent(t, r) {
  try {
    t.container.addComponent(r);
  } catch (e) {
    logger.debug(`Component ${r.name} failed to register with FirebaseApp ` + t.name, e);
  }
}
function _registerComponent(e) {
  var t = e.name;
  if (_components.has(t)) return (logger.debug(`There were multiple attempts to register component ${t}.`), !1);
  _components.set(t, e);
  for (const r of _apps.values()) _addComponent(r, e);
  return !0;
}
function _getProvider(e, t) {
  var r = e.container.getProvider('heartbeat').getImmediate({ optional: !0 });
  return (r && r.triggerHeartbeat(), e.container.getProvider(t));
}
const ERRORS = {
    'no-app': "No Firebase App '{$appName}' has been created - call Firebase App.initializeApp()",
    'bad-app-name': "Illegal App name: '{$appName}",
    'duplicate-app': "Firebase App named '{$appName}' already exists with different options or config",
    'app-deleted': "Firebase App named '{$appName}' already deleted",
    'no-options': 'Need to provide options, when not being deployed to hosting via source.',
    'invalid-app-argument': 'firebase.{$appName}() takes either no argument or a Firebase App instance.',
    'invalid-log-argument': 'First argument to `onLog` must be null or a function.',
    'idb-open': 'Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.',
    'idb-get': 'Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.',
    'idb-set': 'Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.',
    'idb-delete': 'Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.',
  },
  ERROR_FACTORY$2 = new ErrorFactory('app', 'Firebase', ERRORS);
class FirebaseAppImpl {
  constructor(e, t, r) {
    ((this._isDeleted = !1),
      (this._options = Object.assign({}, e)),
      (this._config = Object.assign({}, t)),
      (this._name = t.name),
      (this._automaticDataCollectionEnabled = t.automaticDataCollectionEnabled),
      (this._container = r),
      this.container.addComponent(new Component('app', () => this, 'PUBLIC')));
  }
  get automaticDataCollectionEnabled() {
    return (this.checkDestroyed(), this._automaticDataCollectionEnabled);
  }
  set automaticDataCollectionEnabled(e) {
    (this.checkDestroyed(), (this._automaticDataCollectionEnabled = e));
  }
  get name() {
    return (this.checkDestroyed(), this._name);
  }
  get options() {
    return (this.checkDestroyed(), this._options);
  }
  get config() {
    return (this.checkDestroyed(), this._config);
  }
  get container() {
    return this._container;
  }
  get isDeleted() {
    return this._isDeleted;
  }
  set isDeleted(e) {
    this._isDeleted = e;
  }
  checkDestroyed() {
    if (this.isDeleted) throw ERROR_FACTORY$2.create('app-deleted', { appName: this._name });
  }
}
function initializeApp(e, t = {}) {
  let r = e;
  'object' != typeof t && (t = { name: t });
  ((e = Object.assign({ name: DEFAULT_ENTRY_NAME, automaticDataCollectionEnabled: !1 }, t)), (t = e.name));
  if ('string' != typeof t || !t) throw ERROR_FACTORY$2.create('bad-app-name', { appName: String(t) });
  if (!(r = r || getDefaultAppConfig())) throw ERROR_FACTORY$2.create('no-options');
  var n = _apps.get(t);
  if (n) {
    if (deepEqual(r, n.options) && deepEqual(e, n.config)) return n;
    throw ERROR_FACTORY$2.create('duplicate-app', { appName: t });
  }
  var a = new ComponentContainer(t);
  for (const i of _components.values()) a.addComponent(i);
  n = new FirebaseAppImpl(r, e, a);
  return (_apps.set(t, n), n);
}
function getApp(e = DEFAULT_ENTRY_NAME) {
  var t = _apps.get(e);
  if (!t && e === DEFAULT_ENTRY_NAME) return initializeApp();
  if (t) return t;
  throw ERROR_FACTORY$2.create('no-app', { appName: e });
}
function registerVersion(e, t, r) {
  let n = null != (a = PLATFORM_LOG_STRING[e]) ? a : e;
  r && (n += '-' + r);
  var a = n.match(/\s|\//),
    e = t.match(/\s|\//);
  a || e
    ? ((r = [`Unable to register library "${n}" with version "${t}":`]),
      a && r.push(`library name "${n}" contains illegal characters (whitespace or "/")`),
      a && e && r.push('and'),
      e && r.push(`version name "${t}" contains illegal characters (whitespace or "/")`),
      logger.warn(r.join(' ')))
    : _registerComponent(new Component(n + '-version', () => ({ library: n, version: t }), 'VERSION'));
}
const DB_NAME = 'firebase-heartbeat-database',
  DB_VERSION = 1,
  STORE_NAME = 'firebase-heartbeat-store';
let dbPromise$2 = null;
function getDbPromise$2() {
  return (dbPromise$2 =
    dbPromise$2 ||
    openDB(DB_NAME, DB_VERSION, {
      upgrade: (e, t) => {
        0 === t && e.createObjectStore(STORE_NAME);
      },
    }).catch((e) => {
      throw ERROR_FACTORY$2.create('idb-open', { originalErrorMessage: e.message });
    }));
}
async function readHeartbeatsFromIndexedDB(t) {
  try {
    return (await getDbPromise$2()).transaction(STORE_NAME).objectStore(STORE_NAME).get(computeKey(t));
  } catch (e) {
    e instanceof FirebaseError
      ? logger.warn(e.message)
      : ((t = ERROR_FACTORY$2.create('idb-get', { originalErrorMessage: null == e ? void 0 : e.message })), logger.warn(t.message));
  }
}
async function writeHeartbeatsToIndexedDB(e, t) {
  try {
    var r = (await getDbPromise$2()).transaction(STORE_NAME, 'readwrite');
    return (await r.objectStore(STORE_NAME).put(t, computeKey(e)), r.done);
  } catch (e) {
    e instanceof FirebaseError
      ? logger.warn(e.message)
      : ((t = ERROR_FACTORY$2.create('idb-set', { originalErrorMessage: null == e ? void 0 : e.message })), logger.warn(t.message));
  }
}
function computeKey(e) {
  return e.name + '!' + e.options.appId;
}
const MAX_HEADER_BYTES = 1024,
  STORED_HEARTBEAT_RETENTION_MAX_MILLIS = 2592e6;
class HeartbeatServiceImpl {
  constructor(e) {
    ((this.container = e), (this._heartbeatsCache = null));
    e = this.container.getProvider('app').getImmediate();
    ((this._storage = new HeartbeatStorageImpl(e)), (this._heartbeatsCachePromise = this._storage.read().then((e) => (this._heartbeatsCache = e))));
  }
  async triggerHeartbeat() {
    var e = this.container.getProvider('platform-logger').getImmediate().getPlatformInfoString();
    const t = getUTCDateString();
    if (
      (null === this._heartbeatsCache && (this._heartbeatsCache = await this._heartbeatsCachePromise),
      this._heartbeatsCache.lastSentHeartbeatDate !== t && !this._heartbeatsCache.heartbeats.some((e) => e.date === t))
    )
      return (
        this._heartbeatsCache.heartbeats.push({ date: t, agent: e }),
        (this._heartbeatsCache.heartbeats = this._heartbeatsCache.heartbeats.filter((e) => {
          e = new Date(e.date).valueOf();
          return Date.now() - e <= STORED_HEARTBEAT_RETENTION_MAX_MILLIS;
        })),
        this._storage.overwrite(this._heartbeatsCache)
      );
  }
  async getHeartbeatsHeader() {
    var e, t, r;
    return (
      null === this._heartbeatsCache && (await this._heartbeatsCachePromise),
      null === this._heartbeatsCache || 0 === this._heartbeatsCache.heartbeats.length
        ? ''
        : ((e = getUTCDateString()),
          ({ heartbeatsToSend: r, unsentEntries: t } = extractHeartbeatsForHeader(this._heartbeatsCache.heartbeats)),
          (r = base64urlEncodeWithoutPadding(JSON.stringify({ version: 2, heartbeats: r }))),
          (this._heartbeatsCache.lastSentHeartbeatDate = e),
          0 < t.length
            ? ((this._heartbeatsCache.heartbeats = t), await this._storage.overwrite(this._heartbeatsCache))
            : ((this._heartbeatsCache.heartbeats = []), this._storage.overwrite(this._heartbeatsCache)),
          r)
    );
  }
}
function getUTCDateString() {
  return new Date().toISOString().substring(0, 10);
}
function extractHeartbeatsForHeader(e, t = MAX_HEADER_BYTES) {
  var r = [];
  let n = e.slice();
  for (const i of e) {
    var a = r.find((e) => e.agent === i.agent);
    if (a) {
      if ((a.dates.push(i.date), countBytes(r) > t)) {
        a.dates.pop();
        break;
      }
    } else if ((r.push({ agent: i.agent, dates: [i.date] }), countBytes(r) > t)) {
      r.pop();
      break;
    }
    n = n.slice(1);
  }
  return { heartbeatsToSend: r, unsentEntries: n };
}
class HeartbeatStorageImpl {
  constructor(e) {
    ((this.app = e), (this._canUseIndexedDBPromise = this.runIndexedDBEnvironmentCheck()));
  }
  async runIndexedDBEnvironmentCheck() {
    return (
      !!isIndexedDBAvailable() &&
      validateIndexedDBOpenable()
        .then(() => !0)
        .catch(() => !1)
    );
  }
  async read() {
    return ((await this._canUseIndexedDBPromise) && (await readHeartbeatsFromIndexedDB(this.app))) || { heartbeats: [] };
  }
  async overwrite(e) {
    var t, r;
    if (await this._canUseIndexedDBPromise)
      return (
        (r = await this.read()),
        writeHeartbeatsToIndexedDB(this.app, { lastSentHeartbeatDate: null != (t = e.lastSentHeartbeatDate) ? t : r.lastSentHeartbeatDate, heartbeats: e.heartbeats })
      );
  }
  async add(e) {
    var t, r;
    if (await this._canUseIndexedDBPromise)
      return (
        (r = await this.read()),
        writeHeartbeatsToIndexedDB(this.app, {
          lastSentHeartbeatDate: null != (t = e.lastSentHeartbeatDate) ? t : r.lastSentHeartbeatDate,
          heartbeats: [...r.heartbeats, ...e.heartbeats],
        })
      );
  }
}
function countBytes(e) {
  return base64urlEncodeWithoutPadding(JSON.stringify({ version: 2, heartbeats: e })).length;
}
function registerCoreComponents(e) {
  (_registerComponent(new Component('platform-logger', (e) => new PlatformLoggerServiceImpl(e), 'PRIVATE')),
    _registerComponent(new Component('heartbeat', (e) => new HeartbeatServiceImpl(e), 'PRIVATE')),
    registerVersion(name$o, version$1$1, e),
    registerVersion(name$o, version$1$1, 'esm2017'),
    registerVersion('fire-js', ''));
}
registerCoreComponents('');
var name$2 = 'firebase',
  version$2 = '9.15.0',
  MessageType$1,
  MessageType;
registerVersion(name$2, version$2, 'app');
const name$1 = '@firebase/installations',
  version$1 = '0.6.0',
  PENDING_TIMEOUT_MS = 1e4,
  PACKAGE_VERSION = 'w:' + version$1,
  INTERNAL_AUTH_VERSION = 'FIS_v2',
  INSTALLATIONS_API_URL = 'https://firebaseinstallations.googleapis.com/v1',
  TOKEN_EXPIRATION_BUFFER = 36e5,
  SERVICE = 'installations',
  SERVICE_NAME = 'Installations',
  ERROR_DESCRIPTION_MAP = {
    'missing-app-config-values': 'Missing App configuration value: "{$valueName}"',
    'not-registered': 'Firebase Installation is not registered.',
    'installation-not-found': 'Firebase Installation not found.',
    'request-failed': '{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',
    'app-offline': 'Could not process request. Application offline.',
    'delete-pending-registration': "Can't delete installation while there is a pending registration request.",
  },
  ERROR_FACTORY$1 = new ErrorFactory(SERVICE, SERVICE_NAME, ERROR_DESCRIPTION_MAP);
function isServerError(e) {
  return e instanceof FirebaseError && e.code.includes('request-failed');
}
function getInstallationsEndpoint({ projectId: e }) {
  return INSTALLATIONS_API_URL + `/projects/${e}/installations`;
}
function extractAuthTokenInfoFromResponse(e) {
  return { token: e.token, requestStatus: 2, expiresIn: getExpiresInFromResponseExpiresIn(e.expiresIn), creationTime: Date.now() };
}
async function getErrorFromResponse(e, t) {
  t = (await t.json()).error;
  return ERROR_FACTORY$1.create('request-failed', { requestName: e, serverCode: t.code, serverMessage: t.message, serverStatus: t.status });
}
function getHeaders$1({ apiKey: e }) {
  return new Headers({ 'Content-Type': 'application/json', Accept: 'application/json', 'x-goog-api-key': e });
}
function getHeadersWithAuth(e, { refreshToken: t }) {
  e = getHeaders$1(e);
  return (e.append('Authorization', getAuthorizationHeader(t)), e);
}
async function retryIfServerError(e) {
  var t = await e();
  return 500 <= t.status && t.status < 600 ? e() : t;
}
function getExpiresInFromResponseExpiresIn(e) {
  return Number(e.replace('s', '000'));
}
function getAuthorizationHeader(e) {
  return INTERNAL_AUTH_VERSION + ' ' + e;
}
async function createInstallationRequest({ appConfig: e, heartbeatServiceProvider: t }, { fid: r }) {
  const n = getInstallationsEndpoint(e);
  var a = getHeaders$1(e),
    t = t.getImmediate({ optional: !0 }),
    t = (t && (t = await t.getHeartbeatsHeader()) && a.append('x-firebase-client', t), { fid: r, authVersion: INTERNAL_AUTH_VERSION, appId: e.appId, sdkVersion: PACKAGE_VERSION });
  const i = { method: 'POST', headers: a, body: JSON.stringify(t) };
  e = await retryIfServerError(() => fetch(n, i));
  if (e.ok) return { fid: (a = await e.json()).fid || r, registrationStatus: 2, refreshToken: a.refreshToken, authToken: extractAuthTokenInfoFromResponse(a.authToken) };
  throw await getErrorFromResponse('Create Installation', e);
}
function sleep(t) {
  return new Promise((e) => {
    setTimeout(e, t);
  });
}
function bufferToBase64UrlSafe(e) {
  return btoa(String.fromCharCode(...e))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
const VALID_FID_PATTERN = /^[cdef][\w-]{21}$/,
  INVALID_FID = '';
function generateFid() {
  try {
    var e = new Uint8Array(17),
      t = ((self.crypto || self.msCrypto).getRandomValues(e), (e[0] = 112 + (e[0] % 16)), encode(e));
    return VALID_FID_PATTERN.test(t) ? t : INVALID_FID;
  } catch (e) {
    return INVALID_FID;
  }
}
function encode(e) {
  return bufferToBase64UrlSafe(e).substr(0, 22);
}
function getKey$1(e) {
  return e.appName + '!' + e.appId;
}
const fidChangeCallbacks = new Map();
function fidChanged(e, t) {
  e = getKey$1(e);
  (callFidChangeCallbacks(e, t), broadcastFidChange(e, t));
}
function callFidChangeCallbacks(e, t) {
  e = fidChangeCallbacks.get(e);
  if (e) for (const r of e) r(t);
}
function broadcastFidChange(e, t) {
  var r = getBroadcastChannel();
  (r && r.postMessage({ key: e, fid: t }), closeBroadcastChannel());
}
let broadcastChannel = null;
function getBroadcastChannel() {
  return (
    !broadcastChannel &&
      'BroadcastChannel' in self &&
      ((broadcastChannel = new BroadcastChannel('[Firebase] FID Change')).onmessage = (e) => {
        callFidChangeCallbacks(e.data.key, e.data.fid);
      }),
    broadcastChannel
  );
}
function closeBroadcastChannel() {
  0 === fidChangeCallbacks.size && broadcastChannel && (broadcastChannel.close(), (broadcastChannel = null));
}
const DATABASE_NAME$1 = 'firebase-installations-database',
  DATABASE_VERSION$1 = 1,
  OBJECT_STORE_NAME$1 = 'firebase-installations-store';
let dbPromise$1 = null;
function getDbPromise$1() {
  return (dbPromise$1 =
    dbPromise$1 ||
    openDB(DATABASE_NAME$1, DATABASE_VERSION$1, {
      upgrade: (e, t) => {
        0 === t && e.createObjectStore(OBJECT_STORE_NAME$1);
      },
    }));
}
async function set(e, t) {
  var r = getKey$1(e),
    n = (await getDbPromise$1()).transaction(OBJECT_STORE_NAME$1, 'readwrite'),
    a = n.objectStore(OBJECT_STORE_NAME$1),
    i = await a.get(r);
  return (await a.put(t, r), await n.done, (i && i.fid === t.fid) || fidChanged(e, t.fid), t);
}
async function remove(e) {
  var e = getKey$1(e),
    t = (await getDbPromise$1()).transaction(OBJECT_STORE_NAME$1, 'readwrite');
  (await t.objectStore(OBJECT_STORE_NAME$1).delete(e), await t.done);
}
async function update(e, t) {
  var r = getKey$1(e),
    n = (await getDbPromise$1()).transaction(OBJECT_STORE_NAME$1, 'readwrite'),
    a = n.objectStore(OBJECT_STORE_NAME$1),
    i = await a.get(r),
    t = t(i);
  return (void 0 === t ? await a.delete(r) : await a.put(t, r), await n.done, !t || (i && i.fid === t.fid) || fidChanged(e, t.fid), t);
}
async function getInstallationEntry(t) {
  let r;
  var e = await update(t.appConfig, (e) => {
    ((e = updateOrCreateInstallationEntry(e)), (e = triggerRegistrationIfNecessary(t, e)));
    return ((r = e.registrationPromise), e.installationEntry);
  });
  return e.fid === INVALID_FID ? { installationEntry: await r } : { installationEntry: e, registrationPromise: r };
}
function updateOrCreateInstallationEntry(e) {
  return clearTimedOutRequest(e || { fid: generateFid(), registrationStatus: 0 });
}
function triggerRegistrationIfNecessary(e, t) {
  var r;
  return 0 === t.registrationStatus
    ? navigator.onLine
      ? { installationEntry: (r = { fid: t.fid, registrationStatus: 1, registrationTime: Date.now() }), registrationPromise: registerInstallation(e, r) }
      : { installationEntry: t, registrationPromise: Promise.reject(ERROR_FACTORY$1.create('app-offline')) }
    : 1 === t.registrationStatus
      ? { installationEntry: t, registrationPromise: waitUntilFidRegistration(e) }
      : { installationEntry: t };
}
async function registerInstallation(t, r) {
  try {
    var e = await createInstallationRequest(t, r);
    return set(t.appConfig, e);
  } catch (e) {
    throw (isServerError(e) && 409 === e.customData.serverCode ? await remove(t.appConfig) : await set(t.appConfig, { fid: r.fid, registrationStatus: 0 }), e);
  }
}
async function waitUntilFidRegistration(e) {
  let t = await updateInstallationRequest(e.appConfig);
  for (; 1 === t.registrationStatus; ) (await sleep(100), (t = await updateInstallationRequest(e.appConfig)));
  var r, n;
  return 0 === t.registrationStatus ? (({ installationEntry: r, registrationPromise: n } = await getInstallationEntry(e)), n || r) : t;
}
function updateInstallationRequest(e) {
  return update(e, (e) => {
    if (e) return clearTimedOutRequest(e);
    throw ERROR_FACTORY$1.create('installation-not-found');
  });
}
function clearTimedOutRequest(e) {
  return hasInstallationRequestTimedOut(e) ? { fid: e.fid, registrationStatus: 0 } : e;
}
function hasInstallationRequestTimedOut(e) {
  return 1 === e.registrationStatus && e.registrationTime + PENDING_TIMEOUT_MS < Date.now();
}
async function generateAuthTokenRequest({ appConfig: e, heartbeatServiceProvider: t }, r) {
  const n = getGenerateAuthTokenEndpoint(e, r);
  var r = getHeadersWithAuth(e, r),
    t = t.getImmediate({ optional: !0 }),
    t = (t && (t = await t.getHeartbeatsHeader()) && r.append('x-firebase-client', t), { installation: { sdkVersion: PACKAGE_VERSION, appId: e.appId } });
  const a = { method: 'POST', headers: r, body: JSON.stringify(t) };
  e = await retryIfServerError(() => fetch(n, a));
  if (e.ok) return extractAuthTokenInfoFromResponse(await e.json());
  throw await getErrorFromResponse('Generate Auth Token', e);
}
function getGenerateAuthTokenEndpoint(e, { fid: t }) {
  return getInstallationsEndpoint(e) + `/${t}/authTokens:generate`;
}
async function refreshAuthToken(r, n = !1) {
  let a;
  var e = await update(r.appConfig, (e) => {
    if (!isEntryRegistered(e)) throw ERROR_FACTORY$1.create('not-registered');
    var t = e.authToken;
    if (!n && isAuthTokenValid(t)) return e;
    if (1 === t.requestStatus) return ((a = waitUntilAuthTokenRequest(r, n)), e);
    if (navigator.onLine) return ((t = makeAuthTokenRequestInProgressEntry(e)), (a = fetchAuthTokenFromServer(r, t)), t);
    throw ERROR_FACTORY$1.create('app-offline');
  });
  return a ? await a : e.authToken;
}
async function waitUntilAuthTokenRequest(e, t) {
  let r = await updateAuthTokenRequest(e.appConfig);
  for (; 1 === r.authToken.requestStatus; ) (await sleep(100), (r = await updateAuthTokenRequest(e.appConfig)));
  var n = r.authToken;
  return 0 === n.requestStatus ? refreshAuthToken(e, t) : n;
}
function updateAuthTokenRequest(e) {
  return update(e, (e) => {
    if (isEntryRegistered(e)) return hasAuthTokenRequestTimedOut(e.authToken) ? Object.assign(Object.assign({}, e), { authToken: { requestStatus: 0 } }) : e;
    throw ERROR_FACTORY$1.create('not-registered');
  });
}
async function fetchAuthTokenFromServer(t, r) {
  try {
    var e = await generateAuthTokenRequest(t, r),
      n = Object.assign(Object.assign({}, r), { authToken: e });
    return (await set(t.appConfig, n), e);
  } catch (e) {
    throw (
      !isServerError(e) || (401 !== e.customData.serverCode && 404 !== e.customData.serverCode)
        ? ((n = Object.assign(Object.assign({}, r), { authToken: { requestStatus: 0 } })), await set(t.appConfig, n))
        : await remove(t.appConfig),
      e
    );
  }
}
function isEntryRegistered(e) {
  return void 0 !== e && 2 === e.registrationStatus;
}
function isAuthTokenValid(e) {
  return 2 === e.requestStatus && !isAuthTokenExpired(e);
}
function isAuthTokenExpired(e) {
  var t = Date.now();
  return t < e.creationTime || e.creationTime + e.expiresIn < t + TOKEN_EXPIRATION_BUFFER;
}
function makeAuthTokenRequestInProgressEntry(e) {
  var t = { requestStatus: 1, requestTime: Date.now() };
  return Object.assign(Object.assign({}, e), { authToken: t });
}
function hasAuthTokenRequestTimedOut(e) {
  return 1 === e.requestStatus && e.requestTime + PENDING_TIMEOUT_MS < Date.now();
}
async function getId(e) {
  var { installationEntry: t, registrationPromise: r } = await getInstallationEntry(e);
  return ((r || refreshAuthToken(e)).catch(console.error), t.fid);
}
async function getToken$2(e, t = !1) {
  (await completeInstallationRegistration(e), (e = await refreshAuthToken(e, t)));
  return e.token;
}
async function completeInstallationRegistration(e) {
  e = (await getInstallationEntry(e)).registrationPromise;
  e && (await e);
}
function extractAppConfig$1(e) {
  if (!e || !e.options) throw getMissingValueError$1('App Configuration');
  if (!e.name) throw getMissingValueError$1('App Name');
  for (const t of ['projectId', 'apiKey', 'appId']) if (!e.options[t]) throw getMissingValueError$1(t);
  return { appName: e.name, projectId: e.options.projectId, apiKey: e.options.apiKey, appId: e.options.appId };
}
function getMissingValueError$1(e) {
  return ERROR_FACTORY$1.create('missing-app-config-values', { valueName: e });
}
const INSTALLATIONS_NAME = 'installations',
  INSTALLATIONS_NAME_INTERNAL = 'installations-internal',
  publicFactory = (e) => {
    e = e.getProvider('app').getImmediate();
    return { app: e, appConfig: extractAppConfig$1(e), heartbeatServiceProvider: _getProvider(e, 'heartbeat'), _delete: () => Promise.resolve() };
  },
  internalFactory = (e) => {
    const t = _getProvider(e.getProvider('app').getImmediate(), INSTALLATIONS_NAME).getImmediate();
    return { getId: () => getId(t), getToken: (e) => getToken$2(t, e) };
  };
function registerInstallations() {
  (_registerComponent(new Component(INSTALLATIONS_NAME, publicFactory, 'PUBLIC')), _registerComponent(new Component(INSTALLATIONS_NAME_INTERNAL, internalFactory, 'PRIVATE')));
}
(registerInstallations(), registerVersion(name$1, version$1), registerVersion(name$1, version$1, 'esm2017'));
const DEFAULT_SW_PATH = '/firebase-messaging-sw.js',
  DEFAULT_SW_SCOPE = '/firebase-cloud-messaging-push-scope',
  DEFAULT_VAPID_KEY = 'BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4',
  ENDPOINT = 'https://fcmregistrations.googleapis.com/v1',
  CONSOLE_CAMPAIGN_ID = 'google.c.a.c_id',
  CONSOLE_CAMPAIGN_NAME = 'google.c.a.c_l',
  CONSOLE_CAMPAIGN_TIME = 'google.c.a.ts',
  CONSOLE_CAMPAIGN_ANALYTICS_ENABLED = 'google.c.a.e';
function arrayToBase64(e) {
  e = new Uint8Array(e);
  return btoa(String.fromCharCode(...e))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
function base64ToArray(e) {
  var e = (e + '='.repeat((4 - (e.length % 4)) % 4)).replace(/\-/g, '+').replace(/_/g, '/'),
    t = atob(e),
    r = new Uint8Array(t.length);
  for (let e = 0; e < t.length; ++e) r[e] = t.charCodeAt(e);
  return r;
}
(!(function (e) {
  ((e[(e.DATA_MESSAGE = 1)] = 'DATA_MESSAGE'), (e[(e.DISPLAY_NOTIFICATION = 3)] = 'DISPLAY_NOTIFICATION'));
})((MessageType$1 = MessageType$1 || {})),
  !(function (e) {
    ((e.PUSH_RECEIVED = 'push-received'), (e.NOTIFICATION_CLICKED = 'notification-clicked'));
  })((MessageType = MessageType || {})));
const OLD_DB_NAME = 'fcm_token_details_db',
  OLD_DB_VERSION = 5,
  OLD_OBJECT_STORE_NAME = 'fcm_token_object_Store';
async function migrateOldDatabase(i) {
  if ('databases' in indexedDB && !(await indexedDB.databases()).map((e) => e.name).includes(OLD_DB_NAME)) return null;
  let o = null;
  return (
    (
      await openDB(OLD_DB_NAME, OLD_DB_VERSION, {
        upgrade: async (e, t, r, n) => {
          var a;
          t < 2 ||
            (e.objectStoreNames.contains(OLD_OBJECT_STORE_NAME) &&
              ((n = await (e = n.objectStore(OLD_OBJECT_STORE_NAME)).index('fcmSenderId').get(i)), await e.clear(), n) &&
              (2 === t
                ? (e = n).auth &&
                  e.p256dh &&
                  e.endpoint &&
                  (o = {
                    token: e.fcmToken,
                    createTime: null != (a = e.createTime) ? a : Date.now(),
                    subscriptionOptions: {
                      auth: e.auth,
                      p256dh: e.p256dh,
                      endpoint: e.endpoint,
                      swScope: e.swScope,
                      vapidKey: 'string' == typeof e.vapidKey ? e.vapidKey : arrayToBase64(e.vapidKey),
                    },
                  })
                : 3 === t
                  ? ((a = n),
                    (o = {
                      token: a.fcmToken,
                      createTime: a.createTime,
                      subscriptionOptions: {
                        auth: arrayToBase64(a.auth),
                        p256dh: arrayToBase64(a.p256dh),
                        endpoint: a.endpoint,
                        swScope: a.swScope,
                        vapidKey: arrayToBase64(a.vapidKey),
                      },
                    }))
                  : 4 === t &&
                    ((e = n),
                    (o = {
                      token: e.fcmToken,
                      createTime: e.createTime,
                      subscriptionOptions: {
                        auth: arrayToBase64(e.auth),
                        p256dh: arrayToBase64(e.p256dh),
                        endpoint: e.endpoint,
                        swScope: e.swScope,
                        vapidKey: arrayToBase64(e.vapidKey),
                      },
                    }))));
        },
      })
    ).close(),
    await deleteDB(OLD_DB_NAME),
    await deleteDB('fcm_vapid_details_db'),
    await deleteDB('undefined'),
    checkTokenDetails(o) ? o : null
  );
}
function checkTokenDetails(e) {
  var t;
  return (
    !(!e || !e.subscriptionOptions) &&
    ((t = e.subscriptionOptions), 'number' == typeof e.createTime) &&
    0 < e.createTime &&
    'string' == typeof e.token &&
    0 < e.token.length &&
    'string' == typeof t.auth &&
    0 < t.auth.length &&
    'string' == typeof t.p256dh &&
    0 < t.p256dh.length &&
    'string' == typeof t.endpoint &&
    0 < t.endpoint.length &&
    'string' == typeof t.swScope &&
    0 < t.swScope.length &&
    'string' == typeof t.vapidKey &&
    0 < t.vapidKey.length
  );
}
const DATABASE_NAME = 'firebase-messaging-database',
  DATABASE_VERSION = 1,
  OBJECT_STORE_NAME = 'firebase-messaging-store';
let dbPromise = null;
function getDbPromise() {
  return (dbPromise =
    dbPromise ||
    openDB(DATABASE_NAME, DATABASE_VERSION, {
      upgrade: (e, t) => {
        0 === t && e.createObjectStore(OBJECT_STORE_NAME);
      },
    }));
}
async function dbGet(e) {
  var t = getKey(e),
    t = await (await getDbPromise()).transaction(OBJECT_STORE_NAME).objectStore(OBJECT_STORE_NAME).get(t);
  return t || ((t = await migrateOldDatabase(e.appConfig.senderId)) ? (await dbSet(e, t), t) : void 0);
}
async function dbSet(e, t) {
  var e = getKey(e),
    r = (await getDbPromise()).transaction(OBJECT_STORE_NAME, 'readwrite');
  return (await r.objectStore(OBJECT_STORE_NAME).put(t, e), await r.done, t);
}
async function dbRemove(e) {
  var e = getKey(e),
    t = (await getDbPromise()).transaction(OBJECT_STORE_NAME, 'readwrite');
  (await t.objectStore(OBJECT_STORE_NAME).delete(e), await t.done);
}
function getKey({ appConfig: e }) {
  return e.appId;
}
const ERROR_MAP = {
    'missing-app-config-values': 'Missing App configuration value: "{$valueName}"',
    'only-available-in-window': 'This method is available in a Window context.',
    'only-available-in-sw': 'This method is available in a service worker context.',
    'permission-default': 'The notification permission was not granted and dismissed instead.',
    'permission-blocked': 'The notification permission was not granted and blocked instead.',
    'unsupported-browser': "This browser doesn't support the API's required to use the Firebase SDK.",
    'indexed-db-unsupported': "This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)",
    'failed-service-worker-registration': 'We are unable to register the default service worker. {$browserErrorMessage}',
    'token-subscribe-failed': 'A problem occurred while subscribing the user to FCM: {$errorInfo}',
    'token-subscribe-no-token': 'FCM returned no token when subscribing the user to push.',
    'token-unsubscribe-failed': 'A problem occurred while unsubscribing the user from FCM: {$errorInfo}',
    'token-update-failed': 'A problem occurred while updating the user from FCM: {$errorInfo}',
    'token-update-no-token': 'FCM returned no token when updating the user to push.',
    'use-sw-after-get-token': 'The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.',
    'invalid-sw-registration': 'The input to useServiceWorker() must be a ServiceWorkerRegistration.',
    'invalid-bg-handler': 'The input to setBackgroundMessageHandler() must be a function.',
    'invalid-vapid-key': 'The public VAPID key must be a string.',
    'use-vapid-key-after-get-token': 'The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used.',
  },
  ERROR_FACTORY = new ErrorFactory('messaging', 'Messaging', ERROR_MAP);
async function requestGetToken(e, t) {
  var r = await getHeaders(e),
    t = getBody(t),
    r = { method: 'POST', headers: r, body: JSON.stringify(t) };
  let n;
  try {
    var a = await fetch(getEndpoint(e.appConfig), r);
    n = await a.json();
  } catch (e) {
    throw ERROR_FACTORY.create('token-subscribe-failed', { errorInfo: null == e ? void 0 : e.toString() });
  }
  if (n.error) throw ((t = n.error.message), ERROR_FACTORY.create('token-subscribe-failed', { errorInfo: t }));
  if (n.token) return n.token;
  throw ERROR_FACTORY.create('token-subscribe-no-token');
}
async function requestUpdateToken(e, t) {
  var r = await getHeaders(e),
    n = getBody(t.subscriptionOptions),
    r = { method: 'PATCH', headers: r, body: JSON.stringify(n) };
  let a;
  try {
    var i = await fetch(getEndpoint(e.appConfig) + '/' + t.token, r);
    a = await i.json();
  } catch (e) {
    throw ERROR_FACTORY.create('token-update-failed', { errorInfo: null == e ? void 0 : e.toString() });
  }
  if (a.error) throw ((n = a.error.message), ERROR_FACTORY.create('token-update-failed', { errorInfo: n }));
  if (a.token) return a.token;
  throw ERROR_FACTORY.create('token-update-no-token');
}
async function requestDeleteToken(e, t) {
  var r = { method: 'DELETE', headers: await getHeaders(e) };
  try {
    var n,
      a = await (await fetch(getEndpoint(e.appConfig) + '/' + t, r)).json();
    if (a.error) throw ((n = a.error.message), ERROR_FACTORY.create('token-unsubscribe-failed', { errorInfo: n }));
  } catch (e) {
    throw ERROR_FACTORY.create('token-unsubscribe-failed', { errorInfo: null == e ? void 0 : e.toString() });
  }
}
function getEndpoint({ projectId: e }) {
  return ENDPOINT + `/projects/${e}/registrations`;
}
async function getHeaders({ appConfig: e, installations: t }) {
  t = await t.getToken();
  return new Headers({ 'Content-Type': 'application/json', Accept: 'application/json', 'x-goog-api-key': e.apiKey, 'x-goog-firebase-installations-auth': 'FIS ' + t });
}
function getBody({ p256dh: e, auth: t, endpoint: r, vapidKey: n }) {
  r = { web: { endpoint: r, auth: t, p256dh: e } };
  return (n !== DEFAULT_VAPID_KEY && (r.web.applicationPubKey = n), r);
}
const TOKEN_EXPIRATION_MS = 6048e5;
async function getTokenInternal(e) {
  var t = await getPushSubscription(e.swRegistration, e.vapidKey),
    t = { vapidKey: e.vapidKey, swScope: e.swRegistration.scope, endpoint: t.endpoint, auth: arrayToBase64(t.getKey('auth')), p256dh: arrayToBase64(t.getKey('p256dh')) },
    r = await dbGet(e.firebaseDependencies);
  if (r) {
    if (isTokenValid(r.subscriptionOptions, t))
      return Date.now() >= r.createTime + TOKEN_EXPIRATION_MS ? updateToken(e, { token: r.token, createTime: Date.now(), subscriptionOptions: t }) : r.token;
    try {
      await requestDeleteToken(e.firebaseDependencies, r.token);
    } catch (e) {}
  }
  return getNewToken(e.firebaseDependencies, t);
}
async function deleteTokenInternal(e) {
  var t = await dbGet(e.firebaseDependencies),
    t = (t && (await requestDeleteToken(e.firebaseDependencies, t.token), await dbRemove(e.firebaseDependencies)), await e.swRegistration.pushManager.getSubscription());
  return !t || t.unsubscribe();
}
async function updateToken(t, e) {
  try {
    var r = await requestUpdateToken(t.firebaseDependencies, e),
      n = Object.assign(Object.assign({}, e), { token: r, createTime: Date.now() });
    return (await dbSet(t.firebaseDependencies, n), r);
  } catch (e) {
    throw (await deleteTokenInternal(t), e);
  }
}
async function getNewToken(e, t) {
  t = { token: await requestGetToken(e, t), createTime: Date.now(), subscriptionOptions: t };
  return (await dbSet(e, t), t.token);
}
async function getPushSubscription(e, t) {
  var r = await e.pushManager.getSubscription();
  return r || e.pushManager.subscribe({ userVisibleOnly: !0, applicationServerKey: base64ToArray(t) });
}
function isTokenValid(e, t) {
  var r = t.vapidKey === e.vapidKey,
    n = t.endpoint === e.endpoint,
    a = t.auth === e.auth,
    t = t.p256dh === e.p256dh;
  return r && n && a && t;
}
function externalizePayload(e) {
  var t = { from: e.from, collapseKey: e.collapse_key, messageId: e.fcmMessageId };
  return (propagateNotificationPayload(t, e), propagateDataPayload(t, e), propagateFcmOptions(t, e), t);
}
function propagateNotificationPayload(e, t) {
  var r;
  t.notification &&
    ((e.notification = {}),
    (r = t.notification.title) && (e.notification.title = r),
    (r = t.notification.body) && (e.notification.body = r),
    (r = t.notification.image) && (e.notification.image = r),
    (r = t.notification.icon)) &&
    (e.notification.icon = r);
}
function propagateDataPayload(e, t) {
  t.data && (e.data = t.data);
}
function propagateFcmOptions(e, t) {
  var r;
  (t.fcmOptions || (null != (r = t.notification) && r.click_action)) &&
    ((e.fcmOptions = {}),
    (r = null != (r = null == (r = t.fcmOptions) ? void 0 : r.link) ? r : null == (r = t.notification) ? void 0 : r.click_action) && (e.fcmOptions.link = r),
    (t = null == (r = t.fcmOptions) ? void 0 : r.analytics_label)) &&
    (e.fcmOptions.analyticsLabel = t);
}
function isConsoleMessage(e) {
  return 'object' == typeof e && !!e && CONSOLE_CAMPAIGN_ID in e;
}
function _mergeStrings(t, r) {
  var n = [];
  for (let e = 0; e < t.length; e++) (n.push(t.charAt(e)), e < r.length && n.push(r.charAt(e)));
  return n.join('');
}
function extractAppConfig(e) {
  if (!e || !e.options) throw getMissingValueError('App Configuration Object');
  if (!e.name) throw getMissingValueError('App Name');
  var t = e['options'];
  for (const r of ['projectId', 'apiKey', 'appId', 'messagingSenderId']) if (!t[r]) throw getMissingValueError(r);
  return { appName: e.name, projectId: t.projectId, apiKey: t.apiKey, appId: t.appId, senderId: t.messagingSenderId };
}
function getMissingValueError(e) {
  return ERROR_FACTORY.create('missing-app-config-values', { valueName: e });
}
(_mergeStrings('hts/frbslgigp.ogepscmv/ieo/eaylg', 'tp:/ieaeogn-agolai.o/1frlglgc/o'), _mergeStrings('AzSCbw63g1R0nCw85jG8', 'Iaya3yLKwmgvh7cF0q4'));
class MessagingService {
  constructor(e, t, r) {
    ((this.deliveryMetricsExportedToBigQueryEnabled = !1),
      (this.onBackgroundMessageHandler = null),
      (this.onMessageHandler = null),
      (this.logEvents = []),
      (this.isLogServiceStarted = !1));
    var n = extractAppConfig(e);
    this.firebaseDependencies = { app: e, appConfig: n, installations: t, analyticsProvider: r };
  }
  _delete() {
    return Promise.resolve();
  }
}
async function registerDefaultSw(e) {
  try {
    ((e.swRegistration = await navigator.serviceWorker.register(DEFAULT_SW_PATH, { scope: DEFAULT_SW_SCOPE })), e.swRegistration.update().catch(() => {}));
  } catch (e) {
    throw ERROR_FACTORY.create('failed-service-worker-registration', { browserErrorMessage: null == e ? void 0 : e.message });
  }
}
async function updateSwReg(e, t) {
  if ((t || e.swRegistration || (await registerDefaultSw(e)), t || !e.swRegistration)) {
    if (!(t instanceof ServiceWorkerRegistration)) throw ERROR_FACTORY.create('invalid-sw-registration');
    e.swRegistration = t;
  }
}
async function updateVapidKey(e, t) {
  t ? (e.vapidKey = t) : e.vapidKey || (e.vapidKey = DEFAULT_VAPID_KEY);
}
async function getToken$1(e, t) {
  if (!navigator) throw ERROR_FACTORY.create('only-available-in-window');
  if (('default' === Notification.permission && (await Notification.requestPermission()), 'granted' !== Notification.permission)) throw ERROR_FACTORY.create('permission-blocked');
  return (await updateVapidKey(e, null == t ? void 0 : t.vapidKey), await updateSwReg(e, null == t ? void 0 : t.serviceWorkerRegistration), getTokenInternal(e));
}
async function logToScion(e, t, r) {
  t = getEventType(t);
  (await e.firebaseDependencies.analyticsProvider.get()).logEvent(t, {
    message_id: r[CONSOLE_CAMPAIGN_ID],
    message_name: r[CONSOLE_CAMPAIGN_NAME],
    message_time: r[CONSOLE_CAMPAIGN_TIME],
    message_device_time: Math.floor(Date.now() / 1e3),
  });
}
function getEventType(e) {
  switch (e) {
    case MessageType.NOTIFICATION_CLICKED:
      return 'notification_open';
    case MessageType.PUSH_RECEIVED:
      return 'notification_foreground';
    default:
      throw new Error();
  }
}
async function messageEventListener(e, t) {
  var r,
    t = t.data;
  t.isFirebaseMessaging &&
    (e.onMessageHandler &&
      t.messageType === MessageType.PUSH_RECEIVED &&
      ('function' == typeof e.onMessageHandler ? e.onMessageHandler(externalizePayload(t)) : e.onMessageHandler.next(externalizePayload(t))),
    isConsoleMessage((r = t.data))) &&
    '1' === r[CONSOLE_CAMPAIGN_ANALYTICS_ENABLED] &&
    (await logToScion(e, t.messageType, r));
}
const name = '@firebase/messaging',
  version = '0.12.0',
  WindowMessagingFactory = (e) => {
    const t = new MessagingService(e.getProvider('app').getImmediate(), e.getProvider('installations-internal').getImmediate(), e.getProvider('analytics-internal'));
    return (navigator.serviceWorker.addEventListener('message', (e) => messageEventListener(t, e)), t);
  },
  WindowMessagingInternalFactory = (e) => {
    const t = e.getProvider('messaging').getImmediate();
    return { getToken: (e) => getToken$1(t, e) };
  };
function registerMessagingInWindow() {
  (_registerComponent(new Component('messaging', WindowMessagingFactory, 'PUBLIC')),
    _registerComponent(new Component('messaging-internal', WindowMessagingInternalFactory, 'PRIVATE')),
    registerVersion(name, version),
    registerVersion(name, version, 'esm2017'));
}
async function isWindowSupported() {
  try {
    await validateIndexedDBOpenable();
  } catch (e) {
    return !1;
  }
  return (
    'undefined' != typeof window &&
    isIndexedDBAvailable() &&
    areCookiesEnabled() &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    'fetch' in window &&
    ServiceWorkerRegistration.prototype.hasOwnProperty('showNotification') &&
    PushSubscription.prototype.hasOwnProperty('getKey')
  );
}
function onMessage$1(e, t) {
  if (navigator)
    return (
      (e.onMessageHandler = t),
      () => {
        e.onMessageHandler = null;
      }
    );
  throw ERROR_FACTORY.create('only-available-in-window');
}
function getMessagingInWindow(e = getApp()) {
  return (
    isWindowSupported().then(
      (e) => {
        if (!e) throw ERROR_FACTORY.create('unsupported-browser');
      },
      (e) => {
        throw ERROR_FACTORY.create('indexed-db-unsupported');
      },
    ),
    _getProvider(getModularInstance(e), 'messaging').getImmediate()
  );
}
async function getToken(e, t) {
  return getToken$1((e = getModularInstance(e)), t);
}
function onMessage(e, t) {
  return onMessage$1((e = getModularInstance(e)), t);
}
function bmsGetCookie(t) {
  const r = t.length + 1;
  return (
    document.cookie
      .split(';')
      .map((e) => e.trim())
      .filter((e) => e.substring(0, r) === t + '=')
      .map((e) => decodeURIComponent(e.substring(r)))[0] || ''
  );
}
function bmsParseCookie(e) {
  return '{' === e.trimStart()[0] ? JSON.parse(e) : e;
}
function bmsSetCookie(e, t, r, n = '') {
  let a = '';
  var i;
  (r && ((i = new Date()).setDate(i.getDate() + r), (a = 'expires=' + i.toUTCString())), (n = n || 'path=/'), (document.cookie = `${e}=${t || ''}; ${a}; ` + n));
}
function bmsIsObjectEmpty(e) {
  return 0 === Object.keys(e).length;
}
function bmsGetBrowserInfo() {
  const e = (function (t) {
    function e(e) {
      e = t.match(e);
      return (e && 1 < e.length && e[1]) || '';
    }
    let r = {},
      n = /tablet/i.test(t) || (/android/i.test(t) && !/mobile/i.test(t)),
      a = !n && /[^-]mobi/i.test(t);
    var i = e(/(ipod|iphone|ipad)/i).toLowerCase(),
      o = !/like android/i.test(t) && /android/i.test(t),
      s = /CrOS/.test(t),
      c = /silk/i.test(t),
      d = /sailfish/i.test(t),
      l = /tizen/i.test(t),
      u = /(web|hpw)os/i.test(t),
      p = /windows phone/i.test(t),
      h = !p && /windows/i.test(t),
      g = !i && !c && /macintosh/i.test(t),
      m = !o && !d && !l && !u && /linux/i.test(t),
      f = e(/edge\/(\d+(\.\d+)?)/i),
      b = e(/version\/(\d+(\.\d+)?)/i);
    (/opera mini/i.test(t)
      ? ((r = { name: 'Opera Mini', operamini: !0, majorVersion: e(/(?:opera mini)[\s\/](\d+(\.\d+)?)/i) || b, version: e(/(?:opera mini)\/([\d\.]+)/i) }), (a = !0), (n = !1))
      : /opera|opr/i.test(t)
        ? (r = { name: 'Opera', opera: !0, majorVersion: b || e(/(?:opera|opr)[\s\/](\d+(\.\d+)?)/i), version: e(/(?:opera|opr)\/([\d\.]+)/i) })
        : /ucbrowser/i.test(t)
          ? (r = { name: 'UC Browser', ucbrowser: !0, majorVersion: e(/(?:ucbrowser)[\s\/](\d+(\.\d+)?)/i) || b, version: e(/(?:ucbrowser)\/([\d\.]+)/i) })
          : /acheetahi/i.test(t)
            ? (r = { name: 'CM Browser', cmbrowser: !0, majorVersion: e(/(?:acheetahi)[\s\/](\d+(\.\d+)?)/i) || b, version: e(/(?:acheetahi)\/([\d\.]+)/i) })
            : /yabrowser/i.test(t)
              ? (r = { name: 'Yandex Browser', yandexbrowser: !0, version: b || e(/(?:yabrowser)[\s\/](\d+(\.\d+)?)/i) })
              : p
                ? ((r = { name: 'Windows Phone', windowsphone: !0 }), f ? ((r.msedge = !0), (r.version = f)) : ((r.msie = !0), (r.version = e(/iemobile\/(\d+(\.\d+)?)/i))))
                : /msie|trident/i.test(t)
                  ? (r = { name: 'Internet Explorer', msie: !0, version: e(/(?:msie |rv:)([\.\d]+)/i), majorVersion: e(/(?:msie |rv:)(\d+(\.\d+)?)/i) })
                  : s
                    ? (r = { name: 'Chrome', chromeos: !0, chromeBook: !0, chrome: !0, version: e(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i) })
                    : /chrome.+? edge/i.test(t)
                      ? (r = { name: 'Microsoft Edge', msedge: !0, version: f, majorVersion: e(/(?:edge)\/(\d+(\.\d+)?)/i) })
                      : /chrome|crios|crmo/i.test(t)
                        ? (r = { name: 'Chrome', chrome: !0, version: e(/(?:chrome|crios|crmo)\/([\d\.]+)/i), majorVersion: e(/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i) })
                        : i
                          ? ((r = { name: 'iphone' == i ? 'iPhone' : 'ipad' == i ? 'iPad' : 'iPod' }), b && (r.version = b))
                          : d
                            ? (r = { name: 'Sailfish', sailfish: !0, version: e(/sailfish\s?browser\/(\d+(\.\d+)?)/i) })
                            : /seamonkey\//i.test(t)
                              ? (r = { name: 'SeaMonkey', seamonkey: !0, version: e(/seamonkey\/(\d+(\.\d+)?)/i) })
                              : /firefox|iceweasel/i.test(t)
                                ? ((r = {
                                    name: 'Firefox',
                                    firefox: !0,
                                    version: e(/(?:firefox|iceweasel)[ \/]([\d\.]+)/i),
                                    majorVersion: e(/(?:firefox|iceweasel)[ \/](\d+(\.\d+)?)/i),
                                  }),
                                  /\((mobile|tablet);[^\)]*rv:[\d\.]+\)/i.test(t) && (r.firefoxos = !0))
                                : c
                                  ? (r = { name: 'Amazon Silk', silk: !0, version: e(/silk\/(\d+(\.\d+)?)/i) })
                                  : o
                                    ? (r = { name: 'Android', version: b })
                                    : /phantom/i.test(t)
                                      ? (r = { name: 'PhantomJS', phantom: !0, version: e(/phantomjs\/(\d+(\.\d+)?)/i) })
                                      : /blackberry|\bbb\d+/i.test(t) || /rim\stablet/i.test(t)
                                        ? (r = { name: 'BlackBerry', blackberry: !0, version: b || e(/blackberry[\d]+\/(\d+(\.\d+)?)/i) })
                                        : u
                                          ? ((r = { name: 'WebOS', webos: !0, version: b || e(/w(?:eb)?osbrowser\/(\d+(\.\d+)?)/i) }), /touchpad\//i.test(t) && (r.touchpad = !0))
                                          : (r = /bada/i.test(t)
                                              ? { name: 'Bada', bada: !0, version: e(/dolfin\/(\d+(\.\d+)?)/i) }
                                              : l
                                                ? { name: 'Tizen', tizen: !0, version: e(/(?:tizen\s?)?browser\/(\d+(\.\d+)?)/i) || b }
                                                : /safari/i.test(t)
                                                  ? { name: 'Safari', safari: !0, version: b }
                                                  : { name: e(/^(.*)\/(.*) /), version: ((p = t.match(/^(.*)\/(.*) /)) && 1 < p.length && p[2]) || '' }),
      !r.msedge && /(apple)?webkit/i.test(t)
        ? ((r.name = r.name || 'Webkit'), (r.webkit = !0), !r.version && b && (r.version = b))
        : !r.opera && /gecko\//i.test(t) && ((r.name = r.name || 'Gecko'), (r.gecko = !0), (r.version = r.version || e(/gecko\/(\d+(\.\d+)?)/i))),
      r.msedge || (!o && !r.silk) ? (i ? ((r[i] = !0), (r.ios = !0)) : h ? (r.windows = !0) : g ? (r.mac = !0) : m && (r.linux = !0)) : (r.android = !0));
    let v = '';
    return (
      r.windowsphone
        ? (v = e(/windows phone (?:os)?\s?(\d+(\.\d+)*)/i))
        : i
          ? (v = (v = e(/os (\d+([_\s]\d+)*) like mac os x/i)).replace(/[_\s]/g, '.'))
          : o
            ? (v = e(/android[ \/-](\d+(\.\d+)*)/i))
            : r.webos
              ? (v = e(/(?:web|hpw)os\/(\d+(\.\d+)*)/i))
              : r.blackberry
                ? (v = e(/rim\stablet\sos\s(\d+(\.\d+)*)/i))
                : r.bada
                  ? (v = e(/bada\/(\d+(\.\d+)*)/i))
                  : r.tizen
                    ? (v = e(/tizen[\/\s](\d+(\.\d+)*)/i))
                    : r.windows
                      ? (v = e(/windows nt[\/\s](\d+(\.\d+)*)/i))
                      : r.mac && (v = e(/mac os x[\/\s](\d+(_\d+)*)/i)),
      v && (r.osversion = v),
      (s = v.split('.')[0]),
      n || 'ipad' == i || (o && ('3' == s || ('4' == s && !a))) || r.silk
        ? (r.tablet = !0)
        : (a || 'iphone' == i || 'ipod' == i || o || r.blackberry || r.webos || r.bada) && (r.mobile = !0),
      r.msedge ||
      (r.msie && 10 <= r.version) ||
      (r.yandexbrowser && 15 <= r.version) ||
      (r.chrome && 20 <= r.version) ||
      (r.firefox && 20 <= r.version) ||
      (r.safari && 6 <= r.version) ||
      (r.opera && 10 <= r.version) ||
      (r.ios && r.osversion && 6 <= r.osversion.split('.')[0]) ||
      (r.blackberry && 10.1 <= r.version)
        ? (r.a = !0)
        : (r.msie && r.version < 10) ||
            (r.chrome && r.version < 20) ||
            (r.firefox && r.version < 20) ||
            (r.safari && r.version < 6) ||
            (r.opera && r.version < 10) ||
            (r.ios && r.osversion && r.osversion.split('.')[0] < 6)
          ? (r.c = !0)
          : (r.x = !0),
      r
    );
  })('undefined' != typeof navigator ? navigator.userAgent : '');
  var t = {};
  return (
    e.mobile ? (t.type = 'mobile') : e.tablet ? (t.type = 'tablet') : (t.type = 'desktop'),
    e.android
      ? (t.os = 'android')
      : e.ios
        ? (t.os = 'ios')
        : e.windows
          ? (t.os = 'windows')
          : e.mac
            ? (t.os = 'mac')
            : e.linux
              ? (t.os = 'linux')
              : e.windowsphone
                ? (t.os = 'windowsphone')
                : e.webos
                  ? (t.os = 'webos')
                  : e.blackberry
                    ? (t.os = 'blackberry')
                    : e.bada
                      ? (t.os = 'bada')
                      : e.tizen
                        ? (t.os = 'tizen')
                        : e.sailfish
                          ? (t.os = 'sailfish')
                          : e.firefoxos
                            ? (t.os = 'firefoxos')
                            : e.chromeos
                              ? (t.os = 'chromeos')
                              : (t.os = 'unknown'),
    e.osversion && (t.osVer = e.osversion),
    e.chrome
      ? (t.browser = 'chrome')
      : e.firefox
        ? (t.browser = 'firefox')
        : e.opera
          ? (t.browser = 'opera')
          : e.operamini
            ? (t.browser = 'operamini')
            : e.ucbrowser
              ? (t.browser = 'ucbrowser')
              : e.cmbrowser
                ? (t.browser = 'cmbrowser')
                : e.safari || (e.iosdevice && ('ipad' == e.iosdevice || 'ipod' == e.iosdevice || 'iphone' == e.iosdevice))
                  ? (t.browser = 'safari')
                  : e.msie
                    ? (t.browser = 'ie')
                    : e.yandexbrowser
                      ? (t.browser = 'yandexbrowser')
                      : e.msedge
                        ? (t.browser = 'edge')
                        : e.seamonkey
                          ? (t.browser = 'seamonkey')
                          : e.blackberry
                            ? (t.browser = 'blackberry')
                            : e.touchpad
                              ? (t.browser = 'touchpad')
                              : e.silk
                                ? (t.browser = 'silk')
                                : (t.browser = 'unknown'),
    e.version && (t.browserVer = e.version),
    e.majorVersion && (t.browserMajor = e.majorVersion),
    (t.language = navigator.language || ''),
    (t.engine = navigator.product || ''),
    (t.userAgent = navigator.userAgent),
    t
  );
}
registerMessagingInWindow();
class bmsPush {
  constructor(e) {
    (__publicField(this, 'apiKey', ''),
      __publicField(this, 'bmsTrkContact', window.bmsTrkContact || {}),
      __publicField(this, 'cookiesToSearch', []),
      __publicField(this, 'cookieDomain', ''),
      __publicField(this, 'firebaseConfig', {
        apiKey: 'AIzaSyDCZGtCEwcA3Cp5pD1LkapMp_Nkf8XgslE',
        authDomain: 'bms-push-49662.firebaseapp.com',
        projectId: 'bms-push-49662',
        storageBucket: 'bms-push-49662.appspot.com',
        messagingSenderId: '570410747557',
        appId: '1:570410747557:web:9a56271b512d3275876f4c',
        measurementId: 'G-H1Q2K5EDS0',
      }),
      __publicField(this, 'vapidKey', 'BPoMGU5hsce_S3F4Uicv6zfZ_fCs09kKqMvmu66MMlKR5UpTBy7DBOZxnAzgN9BfOA1sCOvsKOpHw7uHQv8iKG0'),
      __publicField(this, 'accountHash', ''),
      __publicField(this, 'webpush_settings', {}),
      __publicField(this, 'requestExternalLoad', !1),
      __publicField(this, 'eventEmitter'),
      __publicField(this, 'app', initializeApp(this.firebaseConfig)),
      __publicField(this, 'messaging', getMessagingInWindow(this.app)),
      __publicField(
        this,
        'receiveMessage',
        onMessage(this.messaging, (t) => {
          const { title: r, ...n } = t.notification || {};
          navigator.serviceWorker.ready.then((e) => {
            e.showNotification(r || '', { ...n, data: { link: null == (e = t.fcmOptions) ? void 0 : e.link, ...t.data } });
          });
          var e = t.data || {};
          ((e.event = 'delivered'), this.sendTracker(e), this.appendMessage(t));
        }),
      ),
      (this.eventEmitter = new EventEmitter()),
      e &&
        ((this.firebaseConfig = e.firebaseConfig || this.firebaseConfig),
        (this.apiKey = e.apiKey || this.apiKey),
        (this.vapidKey = e.vapidKey || this.vapidKey),
        (this.cookieDomain = e.cookieDomain || this.cookieDomain),
        (this.cookiesToSearch = e.cookiesToSearch || this.cookiesToSearch),
        (this.accountHash = e.accountHash || this.accountHash),
        (this.requestExternalLoad = e.requestExternalLoad || this.requestExternalLoad)));
  }
  async init() {
    'Notification' in window == !1 ||
      'denied' === Notification.permission ||
      ('granted' === Notification.permission && '' !== bmsGetCookie('bmsTrkPush')) ||
      ('granted' !== Notification.permission && '' !== bmsGetCookie('bmsTrkPush')) ||
      ('granted' === Notification.permission && '' === bmsGetCookie('bmsTrkPush')
        ? this.resetUI()
        : this.accountHash || this.requestExternalLoad
          ? this.accountHash &&
            (await fetch(`__BMS_TRACKER_BASE__/bms/push/${this.accountHash}.js`)
              .then((e) => {
                if (e.ok) return e.text();
                this.requestExternalLoad || this.requestPermission();
              })
              .then((script) => {
                try {
                  ((script = script.replace('importScripts("https://assets.bri.us/bms/bms-sw.js?t=" + last_updated);', '')),
                    script.includes('webpush_settings_replace.') && (script = script.replace(/webpush_settings_replace\./g, 'this.webpush_settings.')),
                    eval(script),
                    this.requestExternalLoad || (this.webpush_settings.scriptToRun && '' != this.webpush_settings.scriptToRun ? this.showHidePush(!0) : this.requestPermission()));
                } catch (error) {}
              }))
          : this.requestPermission());
  }
  requestPermission() {
    Notification.requestPermission().then((e) => {
      'granted' === e
        ? this.resetUI()
        : 'denied' === e || 'default' === e
          ? this.eventEmitter.dispatchEvent('onFailure', {
              status: 'default' === e ? 'closed' : 'denied',
              message: `Notification ${'default' === e ? 'prompt closed' : 'denied'} by user`,
            })
          : this.eventEmitter.dispatchEvent('onError', 'Unable to get permission to notify.');
    });
  }
  resetUI() {
    (this.clearMessages(),
      this.showToken('loading...'),
      'serviceWorker' in navigator &&
        navigator.serviceWorker
          .register('/sw.js')
          .then((t) => {
            let e;
            (t.installing ? (e = t.installing) : t.waiting ? (e = t.waiting) : t.active && (e = t.active),
              e &&
                ('activated' == e.state
                  ? this.activatedWorker(t)
                  : e.addEventListener('statechange', (e) => {
                      'activated' == e.target.state && this.activatedWorker(t);
                    })));
          })
          .catch(function (e) {}));
  }
  activatedWorker(e) {
    getToken(this.messaging, { vapidKey: this.vapidKey, serviceWorkerRegistration: e })
      .then((t) => {
        if (t) {
          var r = JSON.stringify({ token: t, date: new Date() });
          let e = 'SameSite=Strict; path=/; Secure';
          (this.cookieDomain && (e += '; domain=' + this.cookieDomain),
            bmsSetCookie('bmsTrkPush', r, 365, e),
            this.eventEmitter.dispatchEvent('onSuccess', { token: t, contact: this.bmsTrkContact }),
            this.sendTokenToServer(t),
            this.updateUIForPushEnabled(t));
        } else
          (this.updateUIForPushPermissionRequired(),
            this.setTokenSentToServer(!1),
            this.eventEmitter.dispatchEvent('onError', 'No registration token available. Request permission to generate one.'));
      })
      .catch((e) => {
        (this.showToken('Error retrieving registration token. '),
          this.setTokenSentToServer(!1),
          this.eventEmitter.dispatchEvent('onError', 'An error occurred while retrieving token. '));
      });
  }
  showHidePush(show) {
    var _a;
    if (show) {
      (this.isMobileDevice() && 'false' == this.webpush_settings.isMobileSameTemplate
        ? document.body.insertAdjacentHTML('beforeend', this.webpush_settings.mobileHtml)
        : document.body.insertAdjacentHTML('beforeend', this.webpush_settings.html),
        eval(this.webpush_settings.scriptToRun));
      const denyButton = document.querySelector('.bms-deny-button'),
        permissionButton = document.querySelector('.bms-permission-button');
      (null != denyButton &&
        denyButton.addEventListener('click', () => {
          var e;
          null != (e = document.querySelector('.bms-push-alert')) && e.remove();
        }),
        null != permissionButton &&
          permissionButton.addEventListener('click', () => {
            var e;
            (this.requestPermission(), null != (e = document.querySelector('.bms-push-alert')) && e.remove());
          }));
    } else null != (_a = document.querySelector('.bms-push-alert')) && _a.remove();
  }
  isMobileDevice() {
    var e = navigator.userAgent || navigator.vendor,
      e = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(e),
      t = 'ontouchstart' in window || 0 < navigator.maxTouchPoints,
      r = window.matchMedia('(max-width: 767px)').matches;
    return e || (t && r);
  }
  addEventListener(e, t) {
    this.eventEmitter.addEventListener(e, t);
  }
  removeEventListener(e, t) {
    this.eventEmitter.removeEventListener(e, t);
  }
  async sendTokenToServer(t) {
    if (!this.isTokenSentToServer()) {
      var r = window.location,
        n = bmsGetBrowserInfo();
      let e = { uuid: this.bmsTrkContact.uuid };
      if ((!e.uuid && bmsGetCookie('bmsUUID') && ((i = bmsGetCookie('bmsUUID')), (e = { uuid: i })), !e.uuid && 0 < this.cookiesToSearch.length))
        for (const o of this.cookiesToSearch) {
          var a = (bmsGetCookie(o) && bmsParseCookie(bmsGetCookie(o))) || {};
          if (a) {
            if ('object' == typeof a && null !== a) {
              e = { email: a.email };
              break;
            }
            if (a.includes('@')) {
              e = { email: a };
              break;
            }
          }
        }
      var i = JSON.stringify({
          contact: {
            ...e,
            devices: [
              {
                token: t,
                type: 'web-push',
                os: null == n ? void 0 : n.os,
                browser: null == n ? void 0 : n.browser,
                browserVersion: null == n ? void 0 : n.browserMajor,
                deviceType: null == n ? void 0 : n.type,
                resolution: window.screen.width + 'x' + window.screen.height,
                subscriptionUrl: '' + r.origin + r.pathname,
              },
            ],
          },
          type: 'web-push-subscription',
          apiKey: this.apiKey,
        }),
        t = { method: 'POST', headers: { 'api-key': this.apiKey, Accept: 'application/json', 'Content-Type': 'application/json' }, redirect: 'follow', mode: 'no-cors', body: i };
      try {
        201 === (await fetch('__BMS_TRACKER_BASE__/bms/leads/web-push', t)).status && this.setTokenSentToServer(!0);
      } catch (e) {}
    }
  }
  isTokenSentToServer() {
    return '1' === window.localStorage.getItem('bmsTrkPushToken');
  }
  setTokenSentToServer(e) {
    window.localStorage.setItem('bmsTrkPushToken', e ? '1' : '0');
  }
  showToken(e) {}
  showHideDiv(e, t) {}
  deleteFCMToken() {}
  appendMessage(e) {}
  clearMessages() {}
  updateUIForPushEnabled(e) {}
  updateUIForPushPermissionRequired() {}
  async sendTracker(e) {
    var t = new Date(),
      e = {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        redirect: 'follow',
        mode: 'no-cors',
        body: JSON.stringify([{ ...e, timestamp: t.getTime(), eventID: crypto.randomUUID() }]),
      };
    try {
      (await fetch('__BMS_TRACKER_BASE__/bms/events?platform=web-push', e)).status;
    } catch (e) {}
  }
}
class EventEmitter {
  constructor() {
    (__publicField(this, 'events', {}), (this.events = {}));
  }
  addEventListener(e, t) {
    (this.events[e] || (this.events[e] = []), this.events[e].push(t));
  }
  removeEventListener(e, t) {
    this.events[e] && (this.events[e] = this.events[e].filter((e) => e !== t));
  }
  dispatchEvent(e, t) {
    this.events[e] && this.events[e].forEach((e) => e(t));
  }
}
(async () => {
  window.bmsPush = window.bmsPush || { cmd: [] };
  var e = window.bmsTrkOptions || {};
  if (!bmsIsObjectEmpty(e) && e.startWebPush) {
    const t = new bmsPush(e);
    (window.bmsPush.cmd.forEach((e) => {
      e(t);
    }),
      (window.bmsPush.cmd.push = function (e) {
        e(t);
      }),
      (window.bmsPushLoaded = !0),
      await t.init(),
      (window.briusNotificationRequestPermission = t.requestPermission.bind(t)));
  }
})();
