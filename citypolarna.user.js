// ==UserScript==
// @name         Citypolarna Deluxe
// @namespace    https://citypolarna.se
// @version      1.9.8
// @description  OLED på alla sidor + färgläggning/gruppering bara på calendar.php
// @author       Jörgen
// @license      MIT
// @match        https://www.citypolarna.se/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // ── OLED-konstanter (kör på ALLA sidor) ──────────────────────────────────
  const OLED_WHITE = 180;
  const OLED_BLACK = 30;

  // ── Kalender-konstanter (kör BARA på calendar.php) ───────────────────────
  const STORAGE_KEY = 'citypolarna_grouping';
  let groupingEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';
  let savedOriginalRows = null;

  const PALETTE = {
    desktop: {
      plus: { bg: '#3a157a', date: '#290469' },
      open: { bg: '#044404', date: '#003300' },
      private: { bg: '#700404', date: '#5f0000' },
      tips: { bg: '#4A2912', date: '#391800' },
      draft: { bg: '#333333', date: '#222222' },
    },
    mobile: {
      plus: { bg: '#3a157a', date: '#290469' },
      open: { bg: '#044404', date: '#003300' },
      private: { bg: '#700404', date: '#5f0000' },
      tips: { bg: '#4A2912', date: '#391800' },
      draft: { bg: '#333333', date: '#222222' },
    },
  };

  const DATE_CLASSES = ['event_row__primary_date', 'event_row__secondary_date', 'row__date_filler', 'event_row__date'];

  // ── OLED-funktioner (kör på ALLA sidor) ───────────────────────────────────
  function isNearWhite(rgb) {
    const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    return m && [1, 2, 3].every(i => +m[i] >= OLED_WHITE);
  }
  function isNearBlack(rgb) {
    const m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    return m && [1, 2, 3].every(i => +m[i] <= OLED_BLACK);
  }
  function applyOledToNode(node) {
    if (node.nodeType !== 1) return;
    [node, ...node.querySelectorAll('*')].forEach(el => {
      const cs = getComputedStyle(el);
      if (isNearBlack(cs.backgroundColor)) {
        el.style.setProperty('background-color', '#000', 'important');
      }
      if (isNearWhite(cs.color)) {
        el.style.setProperty('color', '#fff', 'important');
      }
    });
  }

  function applyOledImmediately() {
    applyOledToNode(document.body);
  }

  // ── Kalender-funktioner (kör BARA på calendar.php) ────────────────────────
  function classifyRow(row) {
    const id = row.querySelector('td.event_row__status svg')?.id;
    if (id === 'icon_coming') return 'anmald';
    if (id === 'icon_reserv') return 'reserv';
    if (id === 'icon_unbooked') return 'intresserad';
    return 'default';
  }

  function getPalette(table) {
    const isMobile = table.classList.contains('mobile');
    const scheme = isMobile ? PALETTE.mobile : PALETTE.desktop;
    const src = table.closest('.plus_event, .private, .tips_event, .draft') || table;
    if (src.classList.contains('plus_event')) return scheme.plus;
    if (src.classList.contains('private')) return scheme.private;
    if (src.classList.contains('tips_event')) return scheme.tips;
    if (src.classList.contains('draft')) return scheme.draft;
    return scheme.open;
  }

  function colorTable(table) {
    const p = getPalette(table);
    table.style.setProperty('background-color', p.bg, 'important');
    table.querySelectorAll('tr').forEach(tr => tr.style.setProperty('background-color', p.bg, 'important'));
    table.querySelectorAll('td').forEach(td => {
      const bg = DATE_CLASSES.some(c => td.classList.contains(c)) ? p.date : p.bg;
      td.style.setProperty('background-color', bg, 'important');
    });
    table.querySelectorAll('*').forEach(el => {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg === 'rgb(151, 132, 223)' || bg === 'rgb(111, 86, 209)') {
        el.style.setProperty('background-color', p.bg, 'important');
      }
    });
  }

  function colorAllVisible() {
    document.querySelectorAll('div.event_row_table').forEach(row => {
      row.querySelectorAll('table.event_row_table').forEach(t => colorTable(t));
    });
  }

  function makeHeader(label, color, count) {
    const h = document.createElement('div');
    h.dataset.groupHeader = '1';
    h.style.cssText = 'font-weight:bold;padding:8px 12px;margin:12px 0 4px;background:' + color + ';border-radius:6px;color:#fff';
    h.textContent = label + ' (' + count + ')';
    return h;
  }

  function findMinaWrapper() {
    return document.querySelector('#my_event_list') || document.querySelector('#calendar_list_my .calendar_list_box > div') || document.querySelector('#calendar_list_my .weekview');
  }

  function applyGrouping() {
    const wrapper = findMinaWrapper();
    if (!wrapper) return;
    wrapper.querySelectorAll('[data-group-header]').forEach(h => h.remove());
    if (!groupingEnabled) {
      if (savedOriginalRows) savedOriginalRows.forEach(r => wrapper.appendChild(r));
      return;
    }
    const rows = [...wrapper.querySelectorAll(':scope > div.event_row_table')];
    if (!rows.length) return;
    if (!savedOriginalRows) savedOriginalRows = rows.slice();
    const groups = { anmald: [], reserv: [], intresserad: [], default: [] };
    rows.forEach(r => groups[classifyRow(r)].push(r));
    const fragment = document.createDocumentFragment();
    [
      { k: 'anmald', l: '✅ Anmäld', c: '#2a7a2a' },
      { k: 'reserv', l: '🟡 Reserv', c: '#CC7722' },
      { k: 'intresserad', l: '👁 Intresserad', c: '#aa0000' },
    ].forEach(item => {
      if (!groups[item.k].length) return;
      fragment.appendChild(makeHeader(item.l, item.c, groups[item.k].length));
      groups[item.k].forEach(r => fragment.appendChild(r));
    });
    groups.default.forEach(r => fragment.appendChild(r));
    wrapper.innerHTML = '';
    wrapper.appendChild(fragment);
  }

  function createToggle() {
    if (document.getElementById('cp-group-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'cp-group-toggle';
    const update = () => {
      btn.textContent = groupingEnabled ? '📋 Visa som lista' : '🗂 Visa grupperat';
    };
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;padding:8px 14px;background:#1a1a2e;color:#fff;border:1px solid #444;border-radius:8px;font-size:0.9em;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.6)';
    btn.addEventListener('mouseenter', () => { btn.style.background = '#2e2e50'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#1a1a2e'; });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      groupingEnabled = !groupingEnabled;
      localStorage.setItem(STORAGE_KEY, groupingEnabled);
      update();
      applyGrouping();
      colorAllVisible();
    });
    update();
    document.body.appendChild(btn);
  }

  // ── Huvudlogik: OLED på ALLA sidor, kalender-logik BARA på calendar.php ──
  const isCalendarPage = location.pathname.startsWith('/calendar.php');

  // OLED körs alltid (på alla sidor)
  applyOledImmediately();

  // OLED-observer för dynamiskt innehåll (på alla sidor)
  new MutationObserver(mutations => {
    const added = new Set();
    mutations.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) added.add(n); }));
    if (added.size) Promise.resolve().then(() => added.forEach(applyOledToNode));
  }).observe(document.body, { childList: true, subtree: true });

  // Kalender-logik körs BARA om vi är på calendar.php
  if (isCalendarPage) {
    createToggle();

    let runOnce = false;
    function runCalendar() {
      if (runOnce) return;
      runOnce = true;

      // Koppla bort observatörer efter första körning
      if (typeof calendarObs !== 'undefined') calendarObs.disconnect();

      colorAllVisible();
      applyGrouping();
    }

    let debounceTimer = null;
    let lastCount = 0;
    let stableFrames = 0;

    const calendarObs = new MutationObserver(() => {
      const count = document.querySelectorAll(
        'table.event_row_table.open, table.event_row_table.plus_event, table.event_row_table.private, table.event_row_table.tips_event, table.event_row_table.draft'
      ).length;
      if (count === 0) return;
      if (count !== lastCount) { lastCount = count; stableFrames = 0; return; }
      if (++stableFrames < 2) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => requestAnimationFrame(runCalendar), 100);
    });

    calendarObs.observe(document.body, { childList: true, subtree: true });

    // Fallback
    if (document.querySelector('table.event_row_table')) {
      requestAnimationFrame(runCalendar);
    }
    setTimeout(() => {
      if (document.querySelector('div.event_row_table')) runCalendar();
    }, 3000);
  }

})();
