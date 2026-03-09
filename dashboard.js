/* ===== DASHBOARD SCRIPT ===== */

(function () {
  'use strict';

  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');

  function closeSidebar() {
    if (!sidebar || !sidebarToggle) return;
    sidebar.classList.remove('open');
    sidebarToggle.setAttribute('aria-expanded', 'false');
    sidebarToggle.setAttribute('aria-label', 'Open menu');
    if (sidebarOverlay) {
      sidebarOverlay.hidden = true;
      sidebarOverlay.classList.remove('visible');
    }
  }

  function openSidebar() {
    if (!sidebar || !sidebarToggle) return;
    sidebar.classList.add('open');
    sidebarToggle.setAttribute('aria-expanded', 'true');
    sidebarToggle.setAttribute('aria-label', 'Close menu');
    if (sidebarOverlay) {
      sidebarOverlay.hidden = false;
      sidebarOverlay.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(function () {
        sidebarOverlay.classList.add('visible');
      });
    }
  }

  /* ---- Sidebar toggle (mobile) ---- */
  if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener('click', function () {
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSidebar();
    });
  }

  /* ---- User menu dropdown ---- */
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = userDropdown.hidden;
      userDropdown.hidden = !isOpen;
      userMenuBtn.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', function () {
      userDropdown.hidden = true;
      userMenuBtn.setAttribute('aria-expanded', 'false');
    });

    userDropdown.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        userDropdown.hidden = true;
        userMenuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();
