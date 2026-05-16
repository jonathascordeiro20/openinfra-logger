(function () {
  'use strict';

  // ---------------- Code Showcase Tabs ----------------
  const tabs = document.querySelectorAll('.code-tab');
  const panes = document.querySelectorAll('.code-pane');
  const rtLabel = document.getElementById('rt-label');
  const labelMap = {
    node:   '"node.js"',
    python: '"python"',
    go:     '"go"',
    rust:   '"rust"'
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
      panes.forEach((p) => p.classList.toggle('is-active', p.dataset.pane === key));
      if (rtLabel && labelMap[key]) rtLabel.textContent = labelMap[key];
    });
  });

  // ---------------- Copy install command ----------------
  const installBtn = document.querySelector('.install');
  const copyLabel = document.getElementById('install-copy');
  if (installBtn && copyLabel) {
    installBtn.addEventListener('click', async () => {
      const cmd = installBtn.dataset.copy;
      try {
        await navigator.clipboard.writeText(cmd);
        installBtn.classList.add('is-copied');
        copyLabel.textContent = 'copied ✓';
        setTimeout(() => {
          installBtn.classList.remove('is-copied');
          copyLabel.textContent = 'copy';
        }, 1500);
      } catch (e) {
        // Fallback: select-and-copy via temporary textarea
        const ta = document.createElement('textarea');
        ta.value = cmd;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (_) {}
        document.body.removeChild(ta);
        copyLabel.textContent = 'copied ✓';
        setTimeout(() => { copyLabel.textContent = 'copy'; }, 1500);
      }
    });
  }

  // ---------------- Footer year ----------------
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------------- Smooth scroll for in-page anchors ----------------
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 64; // offset for sticky nav
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
