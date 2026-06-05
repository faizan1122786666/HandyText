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
