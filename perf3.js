/* perf3.js v4.5 — dimuat setelah perf2.js, sebelum app.js.
   window.__morph(el, html): pengganti `el.innerHTML = html` yang hanya mengubah bagian yang BERBEDA.
   Elemen yang tidak berubah (header, logo, deretan tab, kolom cari, gambar) tetap objek yang sama, sehingga:
   - deretan tab tidak melompat ke awal / tab yang baru diketuk tidak hilang dari layar,
   - tidak ada ikon/logo yang dibuat ulang lalu "muncul belakangan" (glitch seperti refresh),
   - fokus, kursor, posisi gulir, dan animasi tekan→pegas pada tombol tidak terputus,
   - jumlah node yang dibuat, di-style, dan dipindai ulang oleh pengamat DOM jauh lebih sedikit (lebih cepat). */
(function () {
  'use strict';
  if (window.__morph) return;

  /* elemen yang isinya dikelola skrip lain (ikon 3D, logo, nama merek): isi dibiarkan, atribut tetap disamakan */
  var KEEP = '[data-bi],svg.lv,svg.bi,[data-bn],[data-bt],.fn-logo,.ac-ind,.ac-brand,.ac-side-foot,.ac-ico';
  var KEEP_ATTR = { 'data-bi': 1, 'data-bsb': 1, 'data-sf': 1, 'data-wx': 1 };
  /* properti gaya inline yang diatur skrip (carousel, merek) — jangan dihapus walau tidak ada di templat */
  var KEEP_STYLE = { 'transform': 1, 'z-index': 1, 'opacity': 1, 'pointer-events': 1, 'filter': 1, 'background': 1, 'background-image': 1, 'background-color': 1, '--edge': 1, 'will-change': 1 };
  var OPAQUE = { SCRIPT: 1, STYLE: 1, CANVAS: 1, VIDEO: 1, AUDIO: 1, IFRAME: 1, OBJECT: 1 };
  var KEYATTR = ['data-id', 'data-t', 'data-v', 'data-d', 'data-i', 'data-k', 'data-a', 'data-act', 'data-e', 'data-s', 'data-f', 'data-do', 'data-x', 'data-go', 'data-chg', 'data-in'];

  function keyOf(n) {
    if (n.nodeType !== 1) return null;
    if (n.id) return '#' + n.id;
    var k = '', a, v;
    for (var i = 0; i < KEYATTR.length; i++) { a = KEYATTR[i]; v = n.getAttribute(a); if (v !== null) k += a + '=' + v + ';'; }
    return k ? n.nodeName + '|' + k : null;
  }
  function compatible(a, b) { return a.nodeType === b.nodeType && a.nodeName === b.nodeName; }

  function syncStyle(o, n) {
    var os = o.style, ns = n.style, seen = {}, i, p, v, pr, rm = [];
    for (i = 0; i < ns.length; i++) {
      p = ns[i]; seen[p] = 1; v = ns.getPropertyValue(p); pr = ns.getPropertyPriority(p);
      if (os.getPropertyValue(p) !== v || os.getPropertyPriority(p) !== pr) os.setProperty(p, v, pr);
    }
    for (i = 0; i < os.length; i++) { p = os[i]; if (!seen[p] && !KEEP_STYLE[p]) rm.push(p); }
    for (i = 0; i < rm.length; i++) os.removeProperty(rm[i]);
  }
  function syncAttrs(o, n) {
    var i, a, name, rm = [];
    for (i = 0; i < n.attributes.length; i++) {
      a = n.attributes[i]; name = a.name;
      if (name === 'style') { if (o.getAttribute('style') !== a.value) syncStyle(o, n); continue; }
      if (o.getAttribute(name) !== a.value) o.setAttribute(name, a.value);
    }
    for (i = 0; i < o.attributes.length; i++) {
      name = o.attributes[i].name;
      if (KEEP_ATTR[name] || name === 'style') continue;
      if (!n.hasAttribute(name)) rm.push(name);
    }
    for (i = 0; i < rm.length; i++) o.removeAttribute(rm[i]);
    if (!n.hasAttribute('style') && o.hasAttribute('style')) syncStyle(o, n);
  }

  function patch(o, n) {
    if (o.nodeType !== 1) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; return o; }
    if (o.isEqualNode(n)) return o;
    var tag = o.nodeName;
    if (OPAQUE[tag]) { o.parentNode.replaceChild(n, o); return n; }
    syncAttrs(o, n);
    var focused = o === document.activeElement;
    if (tag === 'INPUT') {
      var t = (o.type || '').toLowerCase();
      if (t === 'checkbox' || t === 'radio') { if (o.checked !== n.checked) o.checked = n.checked; }
      else if (!focused) { var nv = n.getAttribute('value') || ''; if (o.value !== nv) o.value = nv; }
      return o;
    }
    if (tag === 'TEXTAREA') { if (!focused && o.value !== n.value) o.value = n.value; return o; }
    if (o.matches(KEEP)) return o;
    if (tag === 'svg' && o.querySelector('svg.lv') && n.querySelector('use')) return o;
    syncChildren(o, n);
    if (tag === 'SELECT' && !focused && o.selectedIndex !== n.selectedIndex) o.selectedIndex = n.selectedIndex;
    return o;
  }

  function syncChildren(o, n) {
    var oc = Array.prototype.slice.call(o.childNodes), nc = Array.prototype.slice.call(n.childNodes);
    var map = Object.create(null), used = new Set(), res = [], pos = 0, i, k, m, arr, nn, cand;
    for (i = 0; i < oc.length; i++) { k = keyOf(oc[i]); if (k) (map[k] || (map[k] = [])).push(oc[i]); }
    for (i = 0; i < nc.length; i++) {
      nn = nc[i]; k = keyOf(nn); m = null;
      if (k) { arr = map[k]; if (arr && arr.length) m = arr.shift(); }
      else {
        while (pos < oc.length && (used.has(oc[pos]) || keyOf(oc[pos]))) pos++;
        cand = oc[pos];
        if (cand && compatible(cand, nn)) { m = cand; pos++; }
      }
      if (m && !compatible(m, nn)) m = null;
      if (m) { used.add(m); res.push(patch(m, nn)); } else res.push(nn);
    }
    var cur = o.firstChild;
    for (i = 0; i < res.length; i++) {
      if (res[i] === cur) cur = cur.nextSibling; else o.insertBefore(res[i], cur);
    }
    for (i = 0; i < oc.length; i++) if (!used.has(oc[i]) && oc[i].parentNode === o) o.removeChild(oc[i]);
  }

  /* pastikan tab aktif terlihat penuh di deretan tab yang bisa digeser (tanpa menggulirkan halaman lain) */
  function reveal(root) {
    var navs = root.querySelectorAll ? root.querySelectorAll('nav,.ad-menu,.ac-tabs,.pj-tabs') : [];
    for (var i = 0; i < navs.length; i++) {
      var nav = navs[i];
      if (nav.scrollWidth <= nav.clientWidth + 1) continue;
      var a = nav.querySelector('[aria-current="true"],[aria-current="page"],[aria-selected="true"],[aria-pressed="true"]');
      if (!a) continue;
      var l = a.offsetLeft, r = l + a.offsetWidth, v0 = nav.scrollLeft, v1 = v0 + nav.clientWidth, to = null;
      if (l < v0 + 8) to = Math.max(0, l - 16); else if (r > v1 - 8) to = r - nav.clientWidth + 16;
      if (to !== null) nav.scrollTo ? nav.scrollTo({ left: to, behavior: 'smooth' }) : (nav.scrollLeft = to);
    }
  }

  window.__morph = function (el, html) {
    var t = document.createElement('template');
    t.innerHTML = html;
    syncChildren(el, t.content);
    return el;
  };
  window.__morphReveal = reveal;
})();
