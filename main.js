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
})();
