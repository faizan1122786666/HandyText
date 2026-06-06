/** Escape text for safe HTML insertion in the editor. */
export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Find non-overlapping suggestion matches in plain text. */
export function findSuggestionMatches(text, suggestions) {
  const matches = [];

  for (const suggestion of suggestions) {
    const needle = suggestion.oldText;
    if (!needle) continue;

    let start = 0;
    while (start < text.length) {
      const index = text.indexOf(needle, start);
      if (index === -1) break;
      matches.push({
        start: index,
        end: index + needle.length,
        suggestion,
      });
      start = index + needle.length;
    }
  }

  matches.sort((a, b) => a.start - b.start || b.end - a.end - (a.end - a.start));

  const filtered = [];
  let lastEnd = 0;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      filtered.push(match);
      lastEnd = match.end;
    }
  }

  return filtered;
}

/** Build editor HTML with red underlines for pending suggestions. */
export function buildHighlightedHtml(text, suggestions, activeSuggestionId = null) {
  if (!text) return '';
  if (!suggestions?.length) {
    // Preserve line breaks with <br> tags
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  const matches = findSuggestionMatches(text, suggestions);
  if (!matches.length) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  let html = '';
  let cursor = 0;

  for (const match of matches) {
    if (match.start > cursor) {
      const segment = escapeHtml(text.slice(cursor, match.start));
      html += segment.replace(/\n/g, '<br>');
    }

    const { suggestion } = match;
    const isActive = activeSuggestionId === suggestion.id;
    const title = `Suggested: ${suggestion.newText}${suggestion.reason ? ` (${suggestion.reason})` : ''}`;

    const highlightedSegment = escapeHtml(text.slice(match.start, match.end));
    html += `<mark class="ocr-error${isActive ? ' ocr-error-active' : ''}" data-suggestion-id="${suggestion.id}" data-suggestion-start="${match.start}" title="${escapeHtml(title)}">${highlightedSegment}</mark>`;

    cursor = match.end;
  }

  if (cursor < text.length) {
    const segment = escapeHtml(text.slice(cursor));
    html += segment.replace(/\n/g, '<br>');
  }

  return html;
}

/** Simple local checks when AI returns nothing (extra spaces, etc.). */
export function buildLocalCorrections(text) {
  const corrections = [];
  if (!text) return corrections;

  const doubleSpace = / {2,}/g;
  let match;
  while ((match = doubleSpace.exec(text)) !== null) {
    corrections.push({
      old_text: match[0],
      new_text: ' ',
      reason: 'Extra space',
    });
  }

  return corrections;
}

export function mapApiCorrections(corrections, conversionId) {
  return (corrections || []).map((c, index) => ({
    id: `${conversionId}-${index}-${c.old_text}`,
    oldText: c.old_text,
    newText: c.new_text,
    reason: c.reason,
    color: 'bg-red-500',
  }));
}

/* ------------------------------------------------------------------ *
 * Inline red-underline highlights for the rich (contentEditable)
 * document editor. These wrap matched error text in <mark class="ocr-error">
 * spans WITHOUT touching the surrounding formatting (bold, colors,
 * highlights, fonts), so accepting a suggestion never wipes styling.
 * ------------------------------------------------------------------ */

/** Collect every text node under `root` that is not already inside a highlight. */
function collectTextNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      // Skip text already wrapped in an error mark.
      if (node.parentElement?.closest('mark.ocr-error')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

/** Current caret offset (in characters) within the editor, or null if the
 *  selection is not inside the editor. Used to keep the cursor steady while
 *  we add/remove highlight wrappers. */
export function getEditorCaretOffset(editor) {
  const sel = window.getSelection();
  if (!editor || !sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.endContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(editor);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

/** Restore the caret to a character offset previously captured. */
export function setEditorCaretOffset(editor, offset) {
  if (!editor || offset == null) return;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
  let remaining = offset;
  let node;
  while ((node = walker.nextNode())) {
    const len = node.nodeValue.length;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= len;
  }
}

/** Unwrap every highlight mark under `root`, leaving the plain text behind. */
export function clearHighlights(root) {
  if (!root) return;
  root.querySelectorAll('mark.ocr-error').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

/** Wrap each pending suggestion's text in a red-underline mark, preserving the
 *  existing rich formatting and the user's caret position. */
export function applyHighlights(editor, suggestions) {
  if (!editor) return;
  const caret = getEditorCaretOffset(editor);
  clearHighlights(editor);

  const needles = (suggestions || []).filter((s) => s.oldText);
  if (needles.length) {
    for (const textNode of collectTextNodes(editor)) {
      let node = textNode;
      while (node && node.nodeValue) {
        let best = null;
        for (const suggestion of needles) {
          const index = node.nodeValue.indexOf(suggestion.oldText);
          if (index !== -1 && (!best || index < best.index)) best = { index, suggestion };
        }
        if (!best) break;

        const { index, suggestion } = best;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + suggestion.oldText.length);

        const mark = document.createElement('mark');
        mark.className = 'ocr-error';
        mark.setAttribute('data-suggestion-id', suggestion.id);
        mark.title = `Suggested: ${suggestion.newText}${suggestion.reason ? ` (${suggestion.reason})` : ''}`;
        range.surroundContents(mark);

        // Continue searching in the text that follows the new mark.
        node = mark.nextSibling && mark.nextSibling.nodeType === Node.TEXT_NODE ? mark.nextSibling : null;
      }
    }
  }

  setEditorCaretOffset(editor, caret);
}

/** Strip highlight marks out of an HTML string before persisting/exporting,
 *  so saved documents never carry the red-underline styling. */
export function stripHighlights(html = '') {
  return html.replace(/<mark[^>]*class="ocr-error"[^>]*>([\s\S]*?)<\/mark>/g, '$1');
}
