/* ForEvidence Weekly Briefing renderer.
 *
 * Security contract — identical to briefs.js: every string originating in
 * briefing data is rendered via textContent, never innerHTML, and anchors are
 * built only from URLs that parse with an https: protocol. Briefing data is
 * treated as untrusted even though it is reviewed before publication; this
 * renderer is the last line of defense.
 *
 * One script, three mount points (a page uses whichever elements it has):
 *   #weekly-root               current/selected edition (weekly-briefing.html)
 *   #weekly-archive-root       recent editions + link to full archive
 *   #weekly-archive-page-root  full archive grouped by month
 *   [data-latest-weekly]       latest-edition date line (insights.html card)
 *
 * Editorial gate: this renderer reads weekly-briefing/data/index.json only.
 * Drafts staged in weekly-briefing/data/pending/ are never fetched and cannot
 * appear on the site until an explicit publish step adds them to that index.
 */
(function () {
  "use strict";

  var DATA_DIR = "weekly-briefing/data/";
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var RECENT_LIMIT = 8;

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];

  function friendlyDate(iso) {
    if (!DATE_RE.test(iso)) return iso;
    var y = iso.slice(0, 4), m = parseInt(iso.slice(5, 7), 10), d = parseInt(iso.slice(8, 10), 10);
    if (!m || m > 12) return iso;
    return MONTHS[m - 1] + " " + d + ", " + y;
  }

  function monthKey(iso) {
    var m = parseInt(iso.slice(5, 7), 10);
    return MONTHS[m - 1] + " " + iso.slice(0, 4);
  }

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

  function sortedEditions(index) {
    var eds = (index && Array.isArray(index.editions)) ? index.editions.slice() : [];
    eds.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return eds;
  }

  function pickDate(editions) {
    var requested = new URLSearchParams(window.location.search).get("date");
    if (requested && DATE_RE.test(requested)) {
      for (var i = 0; i < editions.length; i++) {
        if (editions[i].date === requested) return requested;
      }
    }
    return editions.length ? editions[0].date : null;
  }

  function editionSummary(d) {
    return d.item_count + (d.item_count === 1 ? " item" : " items") +
      (d.has_analysis ? ", with analysis" : "") +
      (d.corrected ? ", corrected" : "");
  }

  function renderItem(item) {
    var article = el("article", "post");
    article.appendChild(el("h4", null, item.headline));
    if (item.summary) article.appendChild(el("p", null, item.summary));
    if (item.why_it_matters) {
      var w = el("p", null, null);
      w.appendChild(el("strong", null, "Why it matters: "));
      w.appendChild(document.createTextNode(String(item.why_it_matters)));
      article.appendChild(w);
    }
    if (Array.isArray(item.sources) && item.sources.length) {
      var cites = el("p", "muted", "Sources: ");
      item.sources.forEach(function (s, i) {
        if (i > 0) cites.appendChild(document.createTextNode(" · "));
        cites.appendChild(safeLink(s.url, s.title || s.url));
      });
      article.appendChild(cites);
    }
    return article;
  }

  function renderSection(section) {
    var wrap = el("section", "weekly-section");
    wrap.appendChild(el("h3", null, section.title));
    (section.items || []).forEach(function (item) {
      if (item) wrap.appendChild(renderItem(item));
    });
    return wrap;
  }

  function renderEdition(root, edition) {
    root.textContent = "";

    var head = el("div", "brief-head");
    head.appendChild(el("h2", null, "Weekly Briefing — week of " + friendlyDate(edition.date)));
    if (edition.published_at) {
      head.appendChild(el("p", "muted", "Published " + edition.published_at));
    }
    root.appendChild(head);

    if (edition.notice) root.appendChild(el("p", "brief-notice", edition.notice));
    if (edition.standfirst) root.appendChild(el("p", "lede", edition.standfirst));

    (edition.sections || []).forEach(function (section) {
      if (section) root.appendChild(renderSection(section));
    });

    if (Array.isArray(edition.corrections) && edition.corrections.length) {
      root.appendChild(el("h3", null, "Corrections"));
      edition.corrections.forEach(function (c) {
        root.appendChild(el("p", "brief-correction",
          "Appended " + c.appended_at + ": " + c.note));
      });
    }
  }

  function archiveEntry(d, currentDate) {
    var li = el("li");
    if (d.date === currentDate) {
      li.appendChild(el("strong", null, friendlyDate(d.date) + " (shown)"));
    } else {
      var a = el("a", null, friendlyDate(d.date));
      a.href = "weekly-briefing.html?date=" + encodeURIComponent(d.date);
      li.appendChild(a);
    }
    li.appendChild(document.createTextNode(" — " + editionSummary(d)));
    return li;
  }

  function renderRecent(root, editions, currentDate) {
    root.textContent = "";
    if (editions.length <= 1) return;
    root.appendChild(el("h3", null, "Recent editions"));
    var list = el("ul", "brief-archive");
    editions.slice(0, RECENT_LIMIT).forEach(function (d) {
      list.appendChild(archiveEntry(d, currentDate));
    });
    root.appendChild(list);
    var p = el("p", null, null);
    var a = el("a", null, "Browse the full archive (" + editions.length +
      (editions.length === 1 ? " edition" : " editions") + ") →");
    a.href = "weekly-briefing-archive.html";
    p.appendChild(a);
    root.appendChild(p);
  }

  function renderFullArchive(root, editions) {
    root.textContent = "";
    if (!editions.length) {
      root.appendChild(el("p", "muted", "No editions published yet."));
      return;
    }
    var currentMonth = null;
    var list = null;
    editions.forEach(function (d) {
      var mk = monthKey(d.date);
      if (mk !== currentMonth) {
        currentMonth = mk;
        root.appendChild(el("h3", null, mk));
        list = el("ul", "brief-archive");
        root.appendChild(list);
      }
      list.appendChild(archiveEntry(d, null));
    });
  }

  function renderLatestLine(nodes, editions) {
    if (!editions.length) return;
    var latest = editions[0];
    var text = "Latest edition: " + friendlyDate(latest.date) + " · " + editionSummary(latest);
    nodes.forEach(function (n) { n.textContent = text; });
  }

  function renderEmpty(root) {
    root.textContent = "";
    root.appendChild(el("p", "lede", "No editions published yet."));
    root.appendChild(el("p", "muted",
      "The Weekly Briefing publishes on Friday evenings. Each edition is reviewed before it appears here."));
  }

  function renderError(root) {
    root.textContent = "";
    var p = el("p", "muted", "Unable to load the Weekly Briefing right now. The raw data archive is available at ");
    var a = el("a", null, "weekly-briefing/data/");
    a.href = DATA_DIR + "index.json";
    p.appendChild(a);
    p.appendChild(document.createTextNode("."));
    root.appendChild(p);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var weeklyRoot = document.getElementById("weekly-root");
    var recentRoot = document.getElementById("weekly-archive-root");
    var archivePageRoot = document.getElementById("weekly-archive-page-root");
    var latestNodes = Array.prototype.slice.call(
      document.querySelectorAll("[data-latest-weekly]"));
    if (!weeklyRoot && !archivePageRoot && !latestNodes.length) return;

    fetchJSON(DATA_DIR + "index.json")
      .then(function (index) {
        var editions = sortedEditions(index);
        renderLatestLine(latestNodes, editions);
        if (archivePageRoot) renderFullArchive(archivePageRoot, editions);
        if (weeklyRoot) {
          var date = pickDate(editions);
          if (!date) { renderEmpty(weeklyRoot); return; }
          return fetchJSON(DATA_DIR + date + ".json").then(function (edition) {
            renderEdition(weeklyRoot, edition);
            if (recentRoot) renderRecent(recentRoot, editions, date);
          });
        }
      })
      .catch(function (err) {
        // Note: do not guard on childNodes here — these roots contain a
        // "Loading…" placeholder, so a childNodes check would suppress the
        // error state and leave the placeholder up permanently.
        if (window && window.console) console.error("Weekly Briefing:", err);
        if (weeklyRoot) renderError(weeklyRoot);
        if (archivePageRoot) renderError(archivePageRoot);
      });
  });
})();
