!(function (e, t) {
  "object" == typeof exports && "undefined" != typeof module
    ? t(exports)
    : "function" == typeof define && define.amd
    ? define(["exports"], t)
    : t(((e = e || self).timeago = {}));
})(this, function (e) {
  "use strict";
  var r = ["second", "minute", "hour", "day", "week", "month", "year"];
  var a = ["秒", "分钟", "小时", "天", "周", "个月", "年"];
  function t(e, t) {
    n[e] = t;
  }
  function i(e) {
    return n[e] || n.en_US;
  }
  var n = {},
    c = [60, 60, 24, 7, 365 / 7 / 12, 12];
  function o(e) {
    return e instanceof Date
      ? e
      : !isNaN(e) || /^\d+$/.test(e)
      ? new Date(parseInt(e))
      : ((e = (e || "")
          .trim()
          .replace(/\.\d+/, "")
          .replace(/-/, "/")
          .replace(/-/, "/")
          .replace(/(\d)T(\d)/, "$1 $2")
          .replace(/Z/, " UTC")
          .replace(/([+-]\d\d):?(\d\d)/, " $1$2")),
        new Date(e));
  }
  function f(e, t) {
    for (
      var n = e < 0 ? 1 : 0, r = (e = Math.abs(e)), a = 0;
      e >= c[a] && a < c.length;
      a++
    )
      e /= c[a];
    return (
      (0 === (a *= 2) ? 9 : 1) < (e = ~~e) && (a += 1),
      t(e, a, r)[n].replace("%s", e)
    );
  }
  function d(e, t) {
    return (+(t = t ? o(t) : new Date()) - +o(e)) / 1e3;
  }
  var s = "timeago-id";
  function l(e) {
    return parseInt(e.getAttribute(s));
  }
  var p = {},
    v = function (e) {
      clearTimeout(e), delete p[e];
    };
  function h(e, t, n, r) {
    v(l(e));
    var a = r.relativeDate,
      i = r.minInterval,
      o = d(t, a);
    e.innerText = f(o, n);
    var u = setTimeout(
      function () {
        h(e, t, n, r);
      },
      Math.min(
        1e3 *
          Math.max(
            (function (e) {
              for (
                var t = 1, n = 0, r = Math.abs(e);
                e >= c[n] && n < c.length;
                n++
              )
                (e /= c[n]), (t *= c[n]);
              return (r = (r %= t) ? t - r : t), Math.ceil(r);
            })(o),
            i || 1
          ),
        2147483647
      )
    );
    (p[u] = 0),
      (function (e, t) {
        e.setAttribute(s, t);
      })(e, u);
  }
  t("en_US", function (e, t) {
    if (0 === t) return ["just now", "right now"];
    var n = r[~~(t / 2)];
    return 1 < e && (n += "s"), [e + " " + n + " ago", "in " + e + " " + n];
  }),
    t("zh_CN", function (e, t) {
      if (0 === t) return ["刚刚", "片刻后"];
      var n = a[~~(t / 2)];
      return [e + " " + n + "前", e + " " + n + "后"];
    }),
    (e.cancel = function (e) {
      e ? v(l(e)) : Object.keys(p).forEach(v);
    }),
    (e.format = function (e, t, n) {
      return f(d(e, n && n.relativeDate), i(t));
    }),
    (e.register = t),
    (e.render = function (e, t, n) {
      var r = e.length ? e : [e];
      return (
        r.forEach(function (e) {
          h(
            e,
            (function (e) {
              return e.getAttribute("datetime");
            })(e),
            i(t),
            n || {}
          );
        }),
        r
      );
    }),
    Object.defineProperty(e, "__esModule", { value: !0 });
});
export default timeago;
