(function () {
  "use strict";

  const PROGRESS_KEY = "ieltsListeningProgressV1";
  const TOTAL = 10;

  function emptyProgress() {
    return { lastTest: null, recentTests: [], scores: {}, bestScores: {}, completed: {} };
  }

  function readProgress() {
    try {
      return { ...emptyProgress(), ...(JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}) };
    } catch (error) {
      return emptyProgress();
    }
  }

  function saveProgress(progress) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function getTestNumber() {
    const fromPath = location.pathname.match(/test-(\d+)\.html/i);
    if (fromPath) return Number(fromPath[1]);

    const h1 = document.querySelector("h1");
    const fromHeading = h1 && h1.textContent.match(/test\s*(\d+)/i);
    if (fromHeading) return Number(fromHeading[1]);

    return null;
  }

  function getSectionTitle(number) {
    if (number >= 1 && number <= 20) return "Section 1";
    if (number >= 21 && number <= 40) return "Section 2";
    if (number >= 41 && number <= 60) return "Section 3";
    if (number >= 61 && number <= 80) return "Section 4";
    return "Listening Practice";
  }

  function getSectionFolder(number) {
    if (number >= 1 && number <= 20) return "section-1";
    if (number >= 21 && number <= 40) return "section-2";
    if (number >= 41 && number <= 60) return "section-3";
    if (number >= 61 && number <= 80) return "section-4";
    return "section-1";
  }

  function getRelativePath(number) {
    const match = location.pathname.match(/(section-\d+\/test-\d+\.html)$/i);
    if (match) return match[1];
    return `${getSectionFolder(number)}/test-${pad(number)}.html`;
  }


  function normaliseRecentTests(progress) {
    const recent = Array.isArray(progress.recentTests) ? progress.recentTests : [];
    if (!recent.length && progress.lastTest?.number) {
      recent.push(progress.lastTest);
    }

    return recent
      .filter(item => item && item.number)
      .map(item => {
        const number = Number(item.number);
        return {
          number,
          path: item.path || getRelativePath(number),
          sectionTitle: item.sectionTitle || getSectionTitle(number),
          openedAt: item.openedAt || 0
        };
      })
      .sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0))
      .filter((item, index, arr) => arr.findIndex(other => Number(other.number) === Number(item.number)) === index)
      .slice(0, 3);
  }

  function recordRecent(progress, number, path, sectionTitle, now = Date.now()) {
    const recentItem = {
      number,
      path: path || getRelativePath(number),
      sectionTitle: sectionTitle || getSectionTitle(number),
      openedAt: now
    };

    const previous = normaliseRecentTests(progress)
      .filter(item => Number(item.number) !== Number(number));

    progress.recentTests = [recentItem, ...previous].slice(0, 3);
    progress.lastTest = recentItem;
    return progress;
  }


  function rememberLastTest(number) {
    const progress = readProgress();
    recordRecent(progress, number, getRelativePath(number), getSectionTitle(number));
    saveProgress(progress);
  }

  function parseScoreText(text) {
    const match = String(text || "").match(/(\d+)\s*(?:out of|\/|of)\s*10/i);
    return match ? Number(match[1]) : null;
  }

  function saveScore(number, score) {
    if (score === null || Number.isNaN(score)) return;
    const key = String(number);
    const progress = readProgress();
    const now = Date.now();

    progress.scores[key] = Array.isArray(progress.scores[key]) ? progress.scores[key] : [];
    const lastAttempt = progress.scores[key][progress.scores[key].length - 1];

    // Avoid duplicate saves from repeated DOM mutation events during one submission.
    if (lastAttempt && lastAttempt.score === score && now - lastAttempt.time < 1600) {
      return;
    }

    progress.scores[key].push({ score, total: TOTAL, time: now });
    if (progress.scores[key].length > 25) progress.scores[key] = progress.scores[key].slice(-25);

    const previousBest = Number(progress.bestScores[key]);
    progress.bestScores[key] = Number.isFinite(previousBest) ? Math.max(previousBest, score) : score;
    progress.completed[key] = true;
    recordRecent(progress, number, getRelativePath(number), getSectionTitle(number), now);
    progress.lastTest.completedAt = now;
    progress.lastTest.latestScore = score;

    saveProgress(progress);
    window.dispatchEvent(new CustomEvent("ielts-score-saved", { detail: { number, score } }));
  }

  function watchScore(number) {
    const scoreBox = document.getElementById("scoreBox");
    if (!scoreBox) return;

    const evaluate = () => {
      const score = parseScoreText(scoreBox.textContent);
      if (score !== null) saveScore(number, score);
    };

    const observer = new MutationObserver(evaluate);
    observer.observe(scoreBox, { childList: true, subtree: true, characterData: true });

    document.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (/check answers/i.test(button.textContent || "")) {
        setTimeout(evaluate, 80);
        setTimeout(evaluate, 400);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const number = getTestNumber();
    if (!number) return;
    rememberLastTest(number);
    watchScore(number);
  });
})();