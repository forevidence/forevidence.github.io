/* Policy Signal Daily Brief renderer.
 *
 * Security contract (see docs/policy-signal/TECHNICAL_DESIGN.md §5.4):
 * every string originating in brief data is rendered via textContent — never
 * innerHTML — and anchors are built only from URLs that parse with an https:
 * protocol. Brief data is treated as untrusted even though it is validated
 * server-side; this renderer is the last line of defense.
 */
(function () {
  "use strict";

  var DATA_DIR = "briefs/data/";
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  var KIND_LABELS = {
    appeared: "New instrument detected",
    content_changed: "Text changed",
    status_action: "Status action"
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function safeLink(url, label, className) {
    // Returns an <a> only for parseable https: URLs; otherwise plain text.
    try {
      var parsed = new URL(String(url));
      if (parsed.protocol === "https:") {
        var a = el("a", className, label);
        a.href = parsed.href;
        a.rel = "noopener noreferrer";
        a.target = "_blank";
        return a;
      }
    } catch (e) { /* fall through to plain text */ }
    return el("span", className, label);
  }

  function fetchJSON(path) {
    return fetch(path, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + path);
      return res.json();
    });
  }

  function pickDate(index) {
    var days = (index && Array.isArray(index.days)) ? index.days.slice() : [];
    days.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var requested = new URLSearchParams(window.location.search).get("date");
    if (requested && DATE_RE.test(requested)) {
      for (var i = 0; i < days.length; i++) {
        if (days[i].date === requested) return { date: requested, days: days };
      }
    }
    return { date: days.length ? days[0].date : null, days: days };
  }

  function renderTierA(item) {
    var article = el("article", "post");
    article.appendChild(el("span", "meta", "Signal · " + (KIND_LABELS[item.kind] || "Update")));
    var h = el("h3", null, null);
    h.appendChild(safeLink(item.source_url, item.jurisdiction + " — " + item.instrument_ref));
    article.appendChild(h);
    article.appendChild(el("p", "muted",
      "Event date " + item.event_date + " · automated detection, primary source linked. No analysis attached."));
    return article;
  }

  function renderTierB(item) {
    var article = el("article", "post");
    article.appendChild(el("span", "meta", "Analysis · human-approved"));
    article.appendChild(el("h3", null, item.headline));
    article.appendChild(el("p", null, item.body));
    if (Array.isArray(item.citations) && item.citations.length) {
      var cites = el("p", "muted", "Sources: ");
      item.citations.forEach(function (c, i) {
        if (i > 0) cites.appendChild(document.createTextNode(" · "));
        cites.appendChild(safeLink(c.url, c.label));
      });
      article.appendChild(cites);
    }
    return article;
  }

  function renderBrief(root, day) {
    root.textContent = "";

    var head = el("div", "brief-head");
    head.appendChild(el("h2", null, "Daily Brief — " + day.date));
    head.appendChild(el("p", "muted",
      "Published " + day.published_at + " · citations last verified " + day.last_verified_at));
    root.appendChild(head);

    if (day.notice) {
      var notice = el("p", "brief-notice", day.notice);
      root.appendChild(notice);
    }

    if (day.no_material_developments) {
      root.appendChild(el("p", "lede",
        "No material developments across tracked sources for this date."));
      root.appendChild(el("p", "muted",
        "This is a deliberate entry, not an outage: the brief publishes every day so that silence is always explicit."));
    } else {
      (day.items || []).forEach(function (item) {
        if (item && item.tier === "A") root.appendChild(renderTierA(item));
        else if (item && item.tier === "B") root.appendChild(renderTierB(item));
      });
    }

    if (Array.isArray(day.corrections) && day.corrections.length) {
      var corrHead = el("h3", null, "Corrections");
      root.appendChild(corrHead);
      day.corrections.forEach(function (c) {
        var p = el("p", "brief-correction",
          "Appended " + c.appended_at +
          (c.item_ref !== null && c.item_ref !== undefined ? " (item " + (c.item_ref + 1) + ")" : "") +
          ": " + c.note);
        root.appendChild(p);
      });
    }
  }

  function renderArchive(root, days, currentDate) {
    root.textContent = "";
    if (days.length <= 1) return;
    root.appendChild(el("h3", null, "Archive"));
    var list = el("ul", "brief-archive");
    days.forEach(function (d) {
      var li = el("li");
      if (d.date === currentDate) {
        li.appendChild(el("span", null, d.date + " (shown)"));
      } else {
        var a = el("a", null, d.date);
        a.href = "briefs.html?date=" + encodeURIComponent(d.date);
        li.appendChild(a);
      }
      li.appendChild(document.createTextNode(
        " — " + d.item_count + (d.item_count === 1 ? " item" : " items") +
        (d.has_analysis ? ", includes analysis" : "") +
        (d.corrected ? ", corrected" : "")));
      list.appendChild(li);
    });
    root.appendChild(list);
  }

  function renderError(root) {
    root.textContent = "";
    var p = el("p", "muted", "Unable to load the Daily Brief right now. The raw data archive is available at ");
    var a = el("a", null, "briefs/data/");
    a.href = DATA_DIR + "index.json";
    p.appendChild(a);
    p.appendChild(document.createTextNode("."));
    root.appendChild(p);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var briefRoot = document.getElementById("brief-root");
    var archiveRoot = document.getElementById("brief-archive-root");
    if (!briefRoot) return;

    fetchJSON(DATA_DIR + "index.json")
      .then(function (index) {
        var picked = pickDate(index);
        if (!picked.date) throw new Error("empty index");
        return fetchJSON(DATA_DIR + picked.date + ".json").then(function (day) {
          renderBrief(briefRoot, day);
          if (archiveRoot) renderArchive(archiveRoot, picked.days, picked.date);
        });
      })
      .catch(function () { renderError(briefRoot); });
  });
})();
