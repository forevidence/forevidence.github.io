// ForEvidence.ai — minimal nav interactivity (no dependencies)
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
      var expanded = links.classList.contains('open');
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }
  // On mobile, tapping a dropdown parent expands it instead of navigating.
  document.querySelectorAll('.has-dropdown > .navlink').forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (window.matchMedia('(max-width: 900px)').matches) {
        e.preventDefault();
        el.parentElement.classList.toggle('open');
      }
    });
  });

  // Web3Forms submission — any <form class="w3f-form"> on any page gets this
  // handler automatically. Submits via fetch so the visitor stays on the page;
  // falls back to a normal POST (Web3Forms' own response page) if JS fails.
  document.querySelectorAll('.w3f-form').forEach(function (form) {
    var status = form.querySelector('.form-status');
    var submitBtn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var accessKey = form.querySelector('input[name="access_key"]');
      if (!accessKey || !accessKey.value || accessKey.value.indexOf('YOUR_') === 0) {
        if (status) {
          status.textContent = 'This form isn’t connected yet — please email us directly using the link below instead.';
          status.style.color = '#a8443a';
        }
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      if (status) { status.textContent = 'Sending…'; status.style.color = ''; }
      fetch(form.action, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      })
        .then(function (res) { return res.json(); })
        .then(function (json) {
          if (json.success) {
            form.reset();
            if (status) {
              status.textContent = 'Thanks — we’ve got it and will reply personally.';
              status.style.color = '#12a594';
            }
          } else {
            throw new Error(json.message || 'submit failed');
          }
        })
        .catch(function () {
          if (status) {
            status.textContent = 'Something went wrong sending that — please email us directly instead.';
            status.style.color = '#a8443a';
          }
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  });
})();
