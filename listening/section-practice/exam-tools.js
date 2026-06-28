(function () {
  "use strict";

  const scopeSelector = "main, .content, .page, body";
  let savedRange = null;
  let selectionTimer = null;
  const notes = [];

  const toolbar = document.createElement("div");
  toolbar.className = "exam-selection-toolbar";
  toolbar.innerHTML = `
    <button type="button" data-action="note">Note</button>
    <button type="button" data-action="highlight">Highlight</button>
  `;

  const popover = document.createElement("div");
  popover.className = "exam-note-popover";
  popover.innerHTML = `
    <strong>Add note</strong>
    <textarea placeholder="Write your note here..."></textarea>
    <div class="exam-note-view" hidden></div>
    <div class="exam-note-actions">
      <button type="button" class="exam-note-cancel">Cancel</button>
      <button type="button" class="exam-note-save">Save</button>
    </div>
  `;

  const drawerToggle = document.createElement("button");
  drawerToggle.type = "button";
  drawerToggle.className = "exam-note-drawer-toggle";
  drawerToggle.textContent = "Notes";

  const drawer = document.createElement("aside");
  drawer.className = "exam-note-drawer";
  drawer.innerHTML = `
    <h3>My Notes</h3>
    <div class="exam-note-list">
      <div class="exam-note-empty">No notes yet. Select text and click Note.</div>
    </div>
  `;

  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(toolbar);
    document.body.appendChild(popover);
    document.body.appendChild(drawerToggle);
    document.body.appendChild(drawer);
    bindEvents();
  });

  function bindEvents() {
    document.addEventListener("mouseup", () => scheduleToolbar(0));

    document.addEventListener("keyup", (event) => {
      if (event.key === "Escape") {
        hideToolbar();
        hidePopover();
        return;
      }
      scheduleToolbar(0);
    });

    // Mobile/tablet support:
    // Android Chrome and iPhone Safari usually trigger selectionchange/touchend after long-press,
    // not normal mouseup. Multiple delayed checks make the toolbar reliable.
    document.addEventListener("selectionchange", () => {
      scheduleToolbar(140);
      scheduleToolbar(420);
    });

    document.addEventListener("touchend", () => {
      scheduleToolbar(160);
      scheduleToolbar(480);
    }, { passive: true });

    document.addEventListener("pointerup", (event) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        scheduleToolbar(160);
        scheduleToolbar(480);
      }
    }, { passive: true });

    toolbar.addEventListener("mousedown", (event) => event.preventDefault());
    toolbar.addEventListener("touchstart", (event) => event.preventDefault(), { passive: false });

    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      runToolbarAction(button.dataset.action);
    });

    toolbar.addEventListener("touchend", (event) => {
      event.preventDefault();
      const button = event.target.closest("button");
      if (!button) return;
      runToolbarAction(button.dataset.action);
    }, { passive: false });

    popover.querySelector(".exam-note-cancel").addEventListener("click", hidePopover);
    popover.querySelector(".exam-note-save").addEventListener("click", saveNote);
    drawerToggle.addEventListener("click", () => drawer.classList.toggle("show"));

    document.addEventListener("click", (event) => {
      if (!toolbar.contains(event.target) && !popover.contains(event.target) && !event.target.closest(".exam-note-mark")) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) hideToolbar();
      }

      const mark = event.target.closest(".exam-note-mark");
      if (mark) {
        event.preventDefault();
        showExistingNote(mark);
      }
    });
  }

  function runToolbarAction(action) {
    if (action === "highlight") highlightSelection();
    if (action === "note") openNoteEditor();
  }

  function scheduleToolbar(delay) {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(showToolbarFromSelection, delay);
  }

  function showToolbarFromSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !sel.toString().trim()) return;

    if (selectionInsideInput(sel)) {
      hideToolbar();
      return;
    }

    const range = sel.getRangeAt(0);
    if (!selectionAllowed(range)) {
      hideToolbar();
      return;
    }

    savedRange = range.cloneRange();
    const rect = getVisibleRect(range);
    if (!rect) return;

    toolbar.style.display = "flex";

    // Existing CSS places toolbar at bottom on mobile.
    if (window.matchMedia("(max-width: 640px)").matches) {
      toolbar.style.left = "50%";
      toolbar.style.top = "auto";
      return;
    }

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const left = Math.max(12, Math.min(rect.left + scrollX, scrollX + window.innerWidth - toolbar.offsetWidth - 12));
    const top = Math.max(12, rect.top + scrollY - toolbar.offsetHeight - 12);

    toolbar.style.left = left + "px";
    toolbar.style.top = top + "px";
  }

  function getVisibleRect(range) {
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
    return rects[0] || range.getBoundingClientRect();
  }

  function selectionAllowed(range) {
    const container = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

    if (!container) return false;
    if (container.closest("input, textarea, select, button, audio, .exam-selection-toolbar, .exam-note-popover, .exam-note-drawer")) return false;
    return Boolean(container.closest(scopeSelector));
  }

  function selectionInsideInput(sel) {
    if (!sel.rangeCount) return false;
    const node = sel.anchorNode;
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return Boolean(el && el.closest("input, textarea, select"));
  }

  function restoreSelection() {
    if (!savedRange) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return true;
  }

  function highlightSelection() {
    if (!restoreSelection()) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    wrapRange(range, "exam-highlight");
    sel.removeAllRanges();
    hideToolbar();
  }

  function openNoteEditor() {
    if (!restoreSelection()) return;
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    if (!text) return;

    const rect = getVisibleRect(savedRange);
    popover.querySelector("strong").textContent = "Add note";
    popover.querySelector("textarea").value = "";
    popover.querySelector("textarea").hidden = false;
    popover.querySelector(".exam-note-save").hidden = false;
    popover.querySelector(".exam-note-view").hidden = true;

    showPopoverNear(rect);
    popover.querySelector("textarea").focus();
    hideToolbar();
  }

  function saveNote() {
    const textarea = popover.querySelector("textarea");
    const noteText = textarea.value.trim();
    if (!noteText || !savedRange) {
      hidePopover();
      return;
    }

    restoreSelection();
    const selectedText = window.getSelection().toString().trim();
    const mark = wrapRange(savedRange, "exam-note-mark");
    if (mark) {
      mark.dataset.note = noteText;
      mark.title = "Click to view note";
    }

    notes.push({
      selectedText,
      noteText,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    renderNotes();
    window.getSelection().removeAllRanges();
    hidePopover();
  }

  function showExistingNote(mark) {
    const noteText = mark.dataset.note || "";
    const rect = mark.getBoundingClientRect();
    popover.querySelector("strong").textContent = "Saved note";
    popover.querySelector("textarea").hidden = true;
    popover.querySelector(".exam-note-save").hidden = true;
    const view = popover.querySelector(".exam-note-view");
    view.textContent = noteText || "No note text found.";
    view.hidden = false;
    showPopoverNear(rect);
  }

  function showPopoverNear(rect) {
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    popover.style.display = "block";

    const left = Math.min(
      Math.max(12, rect.left + scrollX),
      scrollX + window.innerWidth - popover.offsetWidth - 12
    );
    const top = rect.bottom + scrollY + 10;

    popover.style.left = left + "px";
    popover.style.top = top + "px";
  }

  function hideToolbar() {
    toolbar.style.display = "none";
  }

  function hidePopover() {
    popover.style.display = "none";
  }

  function wrapRange(range, className) {
    try {
      const span = document.createElement("span");
      span.className = className;
      const content = range.extractContents();
      span.appendChild(content);
      range.insertNode(span);
      savedRange = null;
      return span;
    } catch (err) {
      try {
        document.execCommand("backColor", false, className === "exam-highlight" ? "#31b8ca" : "#fff3a3");
      } catch (e) {
        console.warn("Highlight tool could not wrap this selection.", e);
      }
      return null;
    }
  }

  function renderNotes() {
    const list = drawer.querySelector(".exam-note-list");
    if (!notes.length) {
      list.innerHTML = '<div class="exam-note-empty">No notes yet. Select text and click Note.</div>';
      return;
    }

    list.innerHTML = notes.map((item, index) => `
      <div class="exam-note-item">
        <small>${index + 1}. ${escapeHtml(item.selectedText)} • ${item.time}</small>
        <p>${escapeHtml(item.noteText)}</p>
      </div>
    `).join("");
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[ch]));
  }
})();