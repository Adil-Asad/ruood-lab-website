/**
 * RUŌOD Lab — the whole of the site's JavaScript.
 *
 * Two jobs, and neither of them is rendering content: the mobile navigation
 * toggle, and marking the current page in the nav. Every word on every page is
 * in the HTML, so the site is complete with this file blocked, failed or
 * disabled — the stylesheet's `.no-js` rules leave the menu permanently open in
 * that case, which is why the <html> element starts with that class and the
 * inline script at the top of <body> removes it.
 *
 * No framework, no polyfills, no third-party request.
 */

(function () {
  'use strict';

  // ── Mobile navigation ─────────────────────────────────────────────────────
  //
  // `aria-expanded` on the button is the single source of truth for the open
  // state; the class on the nav follows it. Nothing here runs on desktop — the
  // stylesheet shows the nav unconditionally above 900px, and the button is
  // hidden, so a stale `is-open` class cannot affect it.

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.classList.toggle('is-open', open);
    };

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Following a link inside the menu should not leave it open behind the
    // new page, and an in-page anchor would otherwise scroll under the panel.
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    // Escape closes it and returns focus to the control that opened it, so a
    // keyboard user is never left inside a panel they cannot dismiss.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    // A click outside the header dismisses it, matching the app's own dialogs.
    document.addEventListener('click', function (event) {
      if (
        toggle.getAttribute('aria-expanded') === 'true' &&
        !event.target.closest('.site-header')
      ) {
        setOpen(false);
      }
    });
  }

  // ── Current page ──────────────────────────────────────────────────────────
  //
  // The pages ship with `aria-current` already set on their own link, so this
  // only corrects the case where a path is reached with or without its trailing
  // slash. It never adds a second current link.

  var path = window.location.pathname.replace(/\/+$/, '') || '/lab';
  var links = document.querySelectorAll('.site-nav a[href]');

  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href');
    if (!href || href.charAt(0) !== '/') continue;
    if (href.replace(/\/+$/, '') === path && !links[i].classList.contains('btn')) {
      links[i].setAttribute('aria-current', 'page');
    } else {
      links[i].removeAttribute('aria-current');
    }
  }
})();
