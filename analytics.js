// ForEvidence.ai — site-wide Google Analytics (GA4) + subscription funnel events.
//
// ─── Setup (one place, one edit) ─────────────────────────────────────────────
// 1. Create a GA4 property at https://analytics.google.com/ and copy the web
//    data stream's Measurement ID (Admin → Data streams → Web). It looks like
//    G-XXXXXXXXXX.
// 2. Paste it as GA_MEASUREMENT_ID below. That's it — every page loads this
//    file, so no per-page edits are needed. Until a real ID is set, the Google
//    script is never loaded at all (no wasted requests, no console noise).
// 3. In GA4, go to Admin → Events, find "sign_up", and toggle "Mark as key
//    event" so completed subscriptions count as a conversion.
//
// Events this file reports, in funnel order:
//   subscribe_cta_click — a visitor clicked any link into subscribe.html
//   generate_lead       — the subscribe form was submitted (lists chosen)
//   sign_up             — the visitor landed on subscribe-confirmation.html
//                         (deduped per browser session, so refreshes and
//                         bookmarks don't inflate the conversion count)
//
// Prefer Google Tag Manager? Replace the loader block below with your GTM
// container snippet and manage tags in the GTM UI instead — the dataLayer
// pushes made here are GTM-compatible as-is.
//
// Privacy note: if you expect meaningful EU/UK traffic, pair this with a
// consent banner (Google Consent Mode v2) before going live in production.
(function () {
  'use strict';
  var GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
  var configured = GA_MEASUREMENT_ID.indexOf('XXXXXXXX') === -1;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  if (configured) {
    var loader = document.createElement('script');
    loader.async = true;
    loader.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(loader);
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);
  }

  // Remember campaign parameters from the landing URL for the rest of the
  // session, so a visitor who browses around before subscribing still gets
  // attributed to the campaign that brought them in.
  try {
    var params = new URLSearchParams(window.location.search);
    var campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'];
    var campaign = {};
    campaignKeys.forEach(function (k) { if (params.get(k)) campaign[k] = params.get(k); });
    if (Object.keys(campaign).length) {
      sessionStorage.setItem('fe-attribution', JSON.stringify(campaign));
    }
  } catch (e) { /* sessionStorage unavailable (private mode etc.) — attribution is best-effort */ }

  document.addEventListener('DOMContentLoaded', function () {
    // Funnel entry: clicks on any link into the subscribe page.
    document.querySelectorAll('a[href$="subscribe.html"]').forEach(function (a) {
      a.addEventListener('click', function () {
        gtag('event', 'subscribe_cta_click', {
          link_text: a.textContent.trim(),
          page_path: window.location.pathname
        });
      });
    });

    // Subscribe form: attach attribution, require a list, carry the selection
    // through the redirect so the conversion event can report it.
    var form = document.querySelector('form[data-subscribe-form]');
    if (form) {
      var attribution = form.querySelector('input[name="attribution"]');
      if (attribution) {
        var parts = [];
        try {
          var stored = sessionStorage.getItem('fe-attribution');
          if (stored) parts.push(stored);
        } catch (e) {}
        if (document.referrer && document.referrer.indexOf(window.location.host) === -1) {
          parts.push('referrer: ' + document.referrer);
        }
        attribution.value = parts.join(' · ') || 'direct / none recorded';
      }
      form.addEventListener('submit', function (e) {
        var status = form.querySelector('.form-status');
        var lists = Array.prototype.map.call(
          form.querySelectorAll('input[name="lists"]:checked'),
          function (el) { return el.value; }
        );
        if (!lists.length) {
          e.preventDefault();
          if (status) {
            status.textContent = 'Pick at least one list so we know what to send you.';
            status.style.color = '#a8443a';
          }
          return;
        }
        if (status) { status.textContent = ''; status.style.color = ''; }
        var redirect = form.querySelector('input[name="redirect"]');
        if (redirect && redirect.value) {
          redirect.value = redirect.value.split('?')[0] + '?lists=' + encodeURIComponent(lists.join(','));
        }
        gtag('event', 'generate_lead', { lists: lists.join(',') });
      });
    }

    // Conversion: landing on the confirmation page means a subscription just
    // completed. Dedupe per session so refreshes don't count twice.
    if (/subscribe-confirmation\.html$/.test(window.location.pathname)) {
      var alreadyTracked = false;
      try { alreadyTracked = sessionStorage.getItem('fe-signup-tracked') === '1'; } catch (e) {}
      if (!alreadyTracked) {
        var lists = '';
        try { lists = new URLSearchParams(window.location.search).get('lists') || ''; } catch (e) {}
        var eventParams = { method: 'email_subscription' };
        if (lists) eventParams.lists = lists;
        gtag('event', 'sign_up', eventParams);
        try { sessionStorage.setItem('fe-signup-tracked', '1'); } catch (e) {}
      }
    }
  });
})();
