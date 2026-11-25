// ==UserScript==
// @name         GitHub 24-Hour Tooltips
// @namespace    https://github.com/
// @version      1.0
// @description  Konverterar AM/PM till 24-timmarsformat och tar bort/ i GitHubs tooltips
// @match        https://github.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // 1. Överskriv Intl.DateTimeFormat: tvinga 24h och ta bort tidszonsnamn
  const OrigDateTimeFormat = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function (locales, options) {
    if (options && (options.hour || options.timeStyle || options.timeZoneName)) {
      options = Object.assign({}, options);
      if (options.hour || options.timeStyle) {
        options.hour12 = false;
      }
      if (options.timeZoneName) {
        delete options.timeZoneName;
      }
    }
    return new OrigDateTimeFormat(locales, options);
  };
  Intl.DateTimeFormat.prototype = OrigDateTimeFormat.prototype;
  Intl.DateTimeFormat.supportedLocalesOf = OrigDateTimeFormat.supportedLocalesOf;

  // 2. Konvertera AM/PM till 24h och rensa bort / / etc.
  const ampmRegex = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?(?::([0-5]\d))?\s*(AM|PM)\b/gi;
  const tzRegex = /\s*(?:GMT|UTC)\s*[+-]\d{1,2}(?::\d{2})?\b/gi;

  function cleanTimestamp(str) {
    if (!str) return str;
    let updated = str;

    if (ampmRegex.test(updated)) {
      ampmRegex.lastIndex = 0;
      updated = updated.replace(ampmRegex, (_, h, m, s, period) => {
        let hour = parseInt(h, 10);
        const isPM = period.toUpperCase() === 'PM';
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;

        const hh = String(hour).padStart(2, '0');
        const mm = m !== undefined ? m : '00';
        return s !== undefined ? `${hh}:${mm}:${s}` : `${hh}:${mm}`;
      });
    }

    if (tzRegex.test(updated)) {
      tzRegex.lastIndex = 0;
      updated = updated.replace(tzRegex, '');
    }

    return updated;
  }

  function fixNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const updated = cleanTimestamp(node.nodeValue);
      if (updated !== node.nodeValue) node.nodeValue = updated;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.hasAttribute('title')) {
      const orig = node.getAttribute('title');
      const updated = cleanTimestamp(orig);
      if (updated !== orig) node.setAttribute('title', updated);
    }

    if (node.hasAttribute('aria-label')) {
      const orig = node.getAttribute('aria-label');
      const updated = cleanTimestamp(orig);
      if (updated !== orig) node.setAttribute('aria-label', updated);
    }

    if (
      node.localName === 'tool-tip' ||
      node.getAttribute('role') === 'tooltip' ||
      node.closest?.('tool-tip, [role="tooltip"]')
    ) {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let textNode;
      while ((textNode = walker.nextNode())) {
        const updated = cleanTimestamp(textNode.nodeValue);
        if (updated !== textNode.nodeValue) textNode.nodeValue = updated;
      }
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') {
        fixNode(m.target);
      } else if (m.type === 'characterData') {
        fixNode(m.target);
      } else {
        for (const added of m.addedNodes) {
          fixNode(added);
          if (added.querySelectorAll) {
            added.querySelectorAll('[title], [aria-label], tool-tip, [role="tooltip"]').forEach(fixNode);
          }
        }
      }
    }
  });

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[title], [aria-label], tool-tip, [role="tooltip"]').forEach(fixNode);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label']
    });
  });
})();
