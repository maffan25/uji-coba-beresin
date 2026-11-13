/* perf2.js v3.4 — dimuat PERTAMA. Cache formatter Intl: toLocale*String membuat formatter baru tiap panggilan (lambat, terutama di HP). */
(function () {
  'use strict';
  if (window.__bsPerf2) return; window.__bsPerf2 = 1;
  var DT = Intl.DateTimeFormat, NF = Intl.NumberFormat, dc = Object.create(null), nc = Object.create(null), dn = 0, nn = 0;
  var oDate = Date.prototype.toLocaleDateString, oStr = Date.prototype.toLocaleString, oTime = Date.prototype.toLocaleTimeString, oNum = Number.prototype.toLocaleString;
  function k(l, o) { var s; try { s = o == null ? '' : JSON.stringify(o); } catch (e) { return null; } return (Array.isArray(l) ? l.join(',') : String(l == null ? '' : l)) + '|' + s; }
  function has(o, a) { for (var i = 0; i < a.length; i++) if (o[a[i]] !== undefined) return true; return false; }
  function eff(o, req, def) {                       // ToDateTimeOptions (spesifikasi ECMA-402)
    o = o == null ? {} : Object(o); var need = true;
    if ((req === 'date' || req === 'any') && has(o, ['weekday', 'year', 'month', 'day'])) need = false;
    if ((req === 'time' || req === 'any') && has(o, ['dayPeriod', 'hour', 'minute', 'second', 'fractionalSecondDigits'])) need = false;
    if (o.dateStyle !== undefined || o.timeStyle !== undefined) need = false;
    if (!need) return o;
    var r = {}; for (var x in o) r[x] = o[x];
    if (def === 'date' || def === 'all') { r.year = 'numeric'; r.month = 'numeric'; r.day = 'numeric'; }
    if (def === 'time' || def === 'all') { r.hour = 'numeric'; r.minute = 'numeric'; r.second = 'numeric'; }
    return r;
  }
  function mkDate(orig, req, def, tag) {
    return function (l, o) {
      var t = +this; if (t !== t) return 'Invalid Date';
      if (o != null && typeof o !== 'object') return orig.call(this, l, o);
      var key = k(l, o); if (key === null) return orig.call(this, l, o); key = tag + key;
      var f = dc[key];
      try {
        if (!f) { if (++dn > 400) { dc = Object.create(null); dn = 0; } f = dc[key] = new DT(l, eff(o, req, def)); }
        return f.format(t);
      } catch (e) { return orig.call(this, l, o); }
    };
  }
  Date.prototype.toLocaleDateString = mkDate(oDate, 'date', 'date', 'd');
  Date.prototype.toLocaleString = mkDate(oStr, 'any', 'all', 's');
  Date.prototype.toLocaleTimeString = mkDate(oTime, 'time', 'time', 't');
  Number.prototype.toLocaleString = function (l, o) {
    var key = k(l, o); if (key === null) return oNum.call(this, l, o);
    var f = nc[key];
    try { if (!f) { if (++nn > 300) { nc = Object.create(null); nn = 0; } f = nc[key] = new NF(l, o); } return f.format(+this); }
    catch (e) { return oNum.call(this, l, o); }
  };
})();
