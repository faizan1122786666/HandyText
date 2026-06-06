import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Bold, Italic, Underline, Strikethrough, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered,
  Undo2, Redo2, RemoveFormatting, Loader2, Check, Wand2, X, Rows3, Square,
  ChevronDown,
} from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../utils/cn';
import {
  buildLocalCorrections,
  mapApiCorrections,
  applyHighlights,
  stripHighlights,
} from '../utils/editorHighlights';

// One A4 page (297mm) in CSS pixels at the standard 96dpi reference.
const PAGE_HEIGHT_PX = 297 * (96 / 25.4); // ≈ 1122.52

const FONT_FAMILIES = ['Times New Roman', 'Arial', 'Calibri', 'Georgia', 'Verdana', 'Tahoma', 'Courier New'];
const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const TEXT_COLORS = ['#000000', '#374151', '#ef4444', '#2563eb', '#16a34a', '#9333ea', '#f59e0b'];
const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', 'transparent'];
const HEADINGS = [
  { label: 'Normal text', tag: 'P' },
  { label: 'Heading 1', tag: 'H1' },
  { label: 'Heading 2', tag: 'H2' },
  { label: 'Heading 3', tag: 'H3' },
];

// Gray gap drawn between auto-added pages so each A4 sheet is visually
// separated, the way pages are spaced apart in Microsoft Word.
const PAGE_GAP_PX = 28;

// Page-border line styles offered in the toolbar (mirrors Word's border menu).
const BORDER_OPTIONS = [
  { id: 'none', label: 'No border', borderStyle: 'solid', borderWidth: 0 },
  { id: 'solid', label: 'Solid', borderStyle: 'solid', borderWidth: 2 },
  { id: 'thick', label: 'Thick', borderStyle: 'solid', borderWidth: 4 },
  { id: 'double', label: 'Double', borderStyle: 'double', borderWidth: 4 },
  { id: 'dashed', label: 'Dashed', borderStyle: 'dashed', borderWidth: 2 },
  { id: 'dotted', label: 'Dotted', borderStyle: 'dotted', borderWidth: 2 },
];
const BORDER_COLOR = '#1e293b'; // slate-800
const borderOption = (id) => BORDER_OPTIONS.find((o) => o.id === id) || BORDER_OPTIONS[1];

const friendlyAiError = (message = '') => {
  if (/quota|rate.?limit|\b429\b/i.test(message)) return 'API limit exceeded.';
  return message || 'Could not load AI suggestions';
};

const escapeHtml = (value = '') =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const draftKeyFor = (id) => `handytext-document-draft-${id}`;

const readDraft = (id) => {
  try {
    return JSON.parse(localStorage.getItem(draftKeyFor(id)));
  } catch {
    return null;
  }
};

const writeDraft = (id, title, borderStyle, editor) => {
  if (!id || !editor) return;
  localStorage.setItem(draftKeyFor(id), JSON.stringify({
    title,
    borderStyle,
    edited_text: editor.innerText,
    edited_html: stripHighlights(editor.innerHTML),
    updated_at: Date.now(),
  }));
};

// Turn raw OCR text (one line per \n) into editable block HTML.
const plainToHtml = (text = '') => {
  const html = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.trim() ? `<div>${escapeHtml(line)}</div>` : '<div><br></div>'))
    .join('');
  return html || '<div><br></div>';
};

const replaceFirstTextNodeMatch = (root, oldText, newText) => {
  if (!root || !oldText) return false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue?.includes(oldText)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const textNode = walker.nextNode();
  if (!textNode) return false;

  textNode.nodeValue = textNode.nodeValue.replace(oldText, newText);
  return true;
};

export function DocumentEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const editorRef = useRef(null);
  const saveTimer = useRef(null);

  const [title, setTitle] = useState('Document');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
  const [stats, setStats] = useState({ words: 0, chars: 0 });
  const [fontFamily, setFontFamily] = useState('Times New Roman');
  const [fontSize, setFontSize] = useState(18);
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, strike: false });
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [documentHtml, setDocumentHtml] = useState('');
  const [borderStyle, setBorderStyle] = useState('solid');
  const [showBorderMenu, setShowBorderMenu] = useState(false);
  const [pageCount, setPageCount] = useState(1);

  const updateStats = useCallback(() => {
    const text = editorRef.current?.innerText || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setStats({ words, chars: text.length });
  }, []);

  // Grow the sheet into extra A4 pages automatically as the content overflows,
  // the same way a new page appears in Word once the current one fills up.
  const recalcPages = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const count = Math.max(1, Math.ceil((el.scrollHeight - 1) / PAGE_HEIGHT_PX));
    setPageCount((prev) => (prev === count ? prev : count));
  }, []);

  const refreshActive = useCallback(() => {
    try {
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strike: document.queryCommandState('strikeThrough'),
      });
    } catch {
      /* queryCommandState can throw if there is no selection */
    }
  }, []);

  const getEditorPlainText = useCallback(() => editorRef.current?.innerText || '', []);

  const fetchAiCorrections = useCallback(async (action = 'proofread') => {
    const plain = getEditorPlainText();
    if (!plain.trim()) {
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const data = await api.post(`/ai/correct/${id}?action=${action}`, { text: plain });
      let items = mapApiCorrections(data.corrections, id).filter((item) => plain.includes(item.oldText));
      if (!items.length) {
        items = mapApiCorrections(buildLocalCorrections(plain), id).filter((item) => plain.includes(item.oldText));
      }
      setSuggestions(items);
      if (items.length) {
        addToast(`${items.length} suggestion(s) found`, 'success');
      } else {
        addToast('No AI suggestions found', 'success');
      }
    } catch (err) {
      const local = mapApiCorrections(buildLocalCorrections(plain), id).filter((item) => plain.includes(item.oldText));
      setSuggestions(local);
      if (local.length) {
        addToast(`${local.length} suggestion(s) found`, 'success');
      } else if (/quota|rate.?limit|\b429\b/i.test(err?.message || '')) {
        addToast('No AI suggestions found', 'success');
      } else {
        addToast(friendlyAiError(err?.message), 'error');
      }
    } finally {
      setLoadingSuggestions(false);
    }
  }, [addToast, getEditorPlainText, id]);

  // Load the document
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get(`/upload/conversion/${id}`);
        if (cancelled) return;
        setTitle(data.original_filename || 'Document');
        setBorderStyle(data.page_border === false ? 'none' : (data.page_border_style || 'solid'));
        const draft = readDraft(id);
        if (draft?.title) setTitle(draft.title);
        if (typeof draft?.borderStyle === 'string') setBorderStyle(draft.borderStyle);

        const html = draft?.edited_html?.trim()
          ? draft.edited_html
          : data.edited_html?.trim()
          ? data.edited_html
          : plainToHtml(data.edited_text || data.extracted_text || '');
        setDocumentHtml(html);
      } catch (err) {
        if (!cancelled) addToast(err?.message || 'Could not load document', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAiCorrections, id, updateStats]);

  useEffect(() => {
    if (loading || !editorRef.current || !documentHtml) return;
    editorRef.current.innerHTML = documentHtml;
    updateStats();
    recalcPages();
    window.setTimeout(() => fetchAiCorrections('proofread'), 0);
  }, [documentHtml, fetchAiCorrections, loading, updateStats, recalcPages]);

  // Paint red wavy underlines under every pending suggestion, then keep the
  // page count in sync. Runs whenever the suggestion list changes.
  useEffect(() => {
    if (loading || !editorRef.current) return;
    applyHighlights(editorRef.current, suggestions);
    recalcPages();
  }, [suggestions, loading, recalcPages]);

  const doSave = useCallback(async ({ silent } = {}) => {
    if (!editorRef.current) return;
    setSaveState('saving');
    try {
      await api.post(`/export/${id}/save-edited`, {
        edited_text: editorRef.current.innerText,
        edited_html: stripHighlights(editorRef.current.innerHTML),
      });
      writeDraft(id, title, borderStyle, editorRef.current);
      setSaveState('saved');
      if (!silent) addToast('Document saved', 'success');
    } catch (err) {
      setSaveState('unsaved');
      if (!silent) addToast(err?.message || 'Save failed', 'error');
    }
  }, [addToast, id, borderStyle, title]);

  // Debounced auto-save while typing
  const scheduleSave = useCallback(() => {
    setSaveState('unsaved');
    writeDraft(id, title, borderStyle, editorRef.current);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave({ silent: true }), 1500);
  }, [doSave, id, borderStyle, title]);

  useEffect(() => {
    const handler = () => refreshActive();
    document.addEventListener('selectionchange', handler);
    return () => {
      document.removeEventListener('selectionchange', handler);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [refreshActive]);

  // Formatting helpers (execCommand keeps this consistent with the inline editor)
  const exec = (command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value ?? undefined);
    updateStats();
    refreshActive();
    scheduleSave();
  };

  const insertLine = () => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, '<hr style="border:0;border-top:2px solid #1f2937;margin:12px 0;" />');
    updateStats();
    scheduleSave();
  };

  // Choose the page-border line style (box around every page). Persisted
  // immediately so the PDF/DOCX export uses the same setting.
  const applyBorderStyle = (next) => {
    setBorderStyle(next);
    setShowBorderMenu(false);
    if (editorRef.current) {
      writeDraft(id, title, next, editorRef.current);
      api.post(`/export/${id}/save-edited`, {
        edited_text: editorRef.current.innerText,
        edited_html: stripHighlights(editorRef.current.innerHTML),
        page_border: next !== 'none',
        page_border_style: next,
      }).catch(() => { /* non-blocking */ });
    }
    addToast(next === 'none' ? 'Page border removed' : `Border style: ${borderOption(next).label}`, 'success');
  };

  const acceptSuggestion = (suggestion) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Replace the text in place so the surrounding rich formatting
    // (bold, colors, highlights, fonts) is fully preserved. We prefer the
    // exact highlighted mark; otherwise fall back to the first text match.
    const mark = editor.querySelector(
      `mark.ocr-error[data-suggestion-id="${CSS.escape(suggestion.id)}"]`,
    );
    if (mark) {
      mark.replaceWith(document.createTextNode(suggestion.newText));
      editor.normalize();
    } else {
      replaceFirstTextNodeMatch(editor, suggestion.oldText, suggestion.newText);
    }

    updateStats();
    scheduleSave();
    // Dropping the suggestion re-runs applyHighlights, which clears the now
    // stale mark and re-underlines whatever is still pending.
    setSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
  };

  const ignoreSuggestion = (idToIgnore) => {
    setSuggestions((prev) => prev.filter((item) => item.id !== idToIgnore));
  };

  const applyFontName = (family) => {
    setFontFamily(family);
    exec('fontName', family);
  };

  const applyFontSize = (size) => {
    setFontSize(size);
    editorRef.current?.focus();
    // execCommand fontSize only accepts 1-7; apply size 7 then rewrite to px.
    document.execCommand('fontSize', false, '7');
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((node) => {
      node.removeAttribute('size');
      node.style.fontSize = `${size}px`;
    });
    updateStats();
    scheduleSave();
  };

  const handleBack = async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    writeDraft(id, title, borderStyle, editorRef.current);
    await doSave({ silent: true });
    navigate('/uploadpage');
  };

  const ToolbarButton = ({ onClick, title: tip, icon: Icon, isActive }) => (
    <button
      type="button"
      title={tip}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'p-2 rounded-md transition-colors',
        isActive ? 'bg-blue-100 text-[#3461ff]' : 'text-slate-600 hover:bg-slate-100',
      )}
    >
      <Icon size={16} />
    </button>
  );

  const Divider = () => <div className="h-5 w-px bg-slate-200 mx-1" />;

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans">
      {/* Top bar */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <span className="text-[14px] font-bold text-slate-800 truncate">{title}</span>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <span className="text-[12px] text-slate-400 flex items-center gap-1.5">
            {saveState === 'saving' && (<><Loader2 size={13} className="animate-spin" /> Saving…</>)}
            {saveState === 'saved' && (<><Check size={13} className="text-green-500" /> Saved</>)}
            {saveState === 'unsaved' && 'Unsaved changes'}
          </span>
          <button
            type="button"
            onClick={() => doSave()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-white bg-[#3461ff] hover:bg-[#2a52d6] rounded-md transition-colors"
          >
            <Save size={15} /> Save
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-1 bg-white border-b border-slate-200 px-2 sm:px-3 py-1.5 shrink-0 overflow-x-auto">
        <ToolbarButton onClick={() => exec('undo')} title="Undo" icon={Undo2} />
        <ToolbarButton onClick={() => exec('redo')} title="Redo" icon={Redo2} />
        <Divider />

        <select
          value={fontFamily}
          onChange={(e) => applyFontName(e.target.value)}
          title="Font"
          className="h-8 px-2 text-[13px] border border-slate-200 rounded-md text-slate-700 bg-white hover:bg-slate-50 cursor-pointer max-w-[150px]"
        >
          {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={fontSize}
          onChange={(e) => applyFontSize(Number(e.target.value))}
          title="Font size"
          className="h-8 px-2 text-[13px] border border-slate-200 rounded-md text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
        >
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          onChange={(e) => { exec('formatBlock', e.target.value); e.target.selectedIndex = 0; }}
          title="Paragraph style"
          className="h-8 px-2 text-[13px] border border-slate-200 rounded-md text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
          defaultValue=""
        >
          <option value="" disabled>Style</option>
          {HEADINGS.map((h) => <option key={h.tag} value={h.tag}>{h.label}</option>)}
        </select>
        <Divider />

        <ToolbarButton onClick={() => exec('bold')} title="Bold" icon={Bold} isActive={active.bold} />
        <ToolbarButton onClick={() => exec('italic')} title="Italic" icon={Italic} isActive={active.italic} />
        <ToolbarButton onClick={() => exec('underline')} title="Underline" icon={Underline} isActive={active.underline} />
        <ToolbarButton onClick={() => exec('strikeThrough')} title="Strikethrough" icon={Strikethrough} isActive={active.strike} />
        <Divider />

        {/* Text color */}
        <div className="flex items-center gap-1 px-1" title="Text color">
          <span className="text-[11px] font-bold text-slate-400">A</span>
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec('foreColor', c)}
              className="w-4 h-4 rounded-full border border-slate-200 hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <Divider />

        {/* Highlight */}
        <div className="flex items-center gap-1 px-1" title="Highlight">
          <Highlighter size={14} className="text-slate-400" />
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec('hiliteColor', c === 'transparent' ? 'transparent' : c)}
              className={cn(
                'w-4 h-4 rounded-full border border-slate-200 hover:scale-110 transition-transform',
                c === 'transparent' && 'bg-white relative',
              )}
              style={{ backgroundColor: c === 'transparent' ? '#fff' : c }}
            >
              {c === 'transparent' && <span className="absolute inset-0 flex items-center justify-center text-[9px] text-slate-400">⊘</span>}
            </button>
          ))}
        </div>
        <Divider />

        <ToolbarButton onClick={() => exec('justifyLeft')} title="Align left" icon={AlignLeft} />
        <ToolbarButton onClick={() => exec('justifyCenter')} title="Align center" icon={AlignCenter} />
        <ToolbarButton onClick={() => exec('justifyRight')} title="Align right" icon={AlignRight} />
        <ToolbarButton onClick={() => exec('justifyFull')} title="Justify" icon={AlignJustify} />
        <Divider />

        <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Bullet list" icon={List} />
        <ToolbarButton onClick={() => exec('insertOrderedList')} title="Numbered list" icon={ListOrdered} />
        <Divider />

        <ToolbarButton onClick={insertLine} title="Insert border line" icon={Rows3} />

        {/* Page-border style picker (Word-style border options). */}
        <div className="relative">
          <button
            type="button"
            title="Page border style"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowBorderMenu((v) => !v)}
            className={cn(
              'flex items-center gap-0.5 p-2 rounded-md transition-colors',
              borderStyle !== 'none' ? 'bg-blue-100 text-[#3461ff]' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <Square size={16} />
            <ChevronDown size={12} />
          </button>
          {showBorderMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowBorderMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-40 w-48 rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl">
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Page border</p>
                {BORDER_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyBorderStyle(o.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] font-semibold transition-colors',
                      borderStyle === o.id ? 'text-[#3461ff] bg-blue-50' : 'text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="w-8 shrink-0"
                        style={o.id === 'none'
                          ? { borderTop: '2px solid transparent' }
                          : { borderTopStyle: o.borderStyle, borderTopWidth: Math.min(o.borderWidth, 3), borderTopColor: '#334155' }}
                      />
                      {o.label}
                    </span>
                    {borderStyle === o.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <Divider />

        <ToolbarButton onClick={() => exec('removeFormat')} title="Clear formatting" icon={RemoveFormatting} />
      </div>

      <div className="flex-1 min-h-0 flex flex-col xl:flex-row">
        {/* Editor sheet (A4-like page on a gray canvas, MS Word style) */}
        <div className="flex-1 overflow-auto py-4 sm:py-8 px-2 sm:px-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin" /> Loading document…
            </div>
          ) : (
            <div
              className="relative mx-auto bg-white shadow-md rounded-sm"
              style={{
                width: '210mm',
                maxWidth: '100%',
                // Grow the sheet one A4 page at a time; a fresh page appears the
                // moment text overflows the current one.
                minHeight: `${pageCount * PAGE_HEIGHT_PX}px`,
              }}
            >
              {/* Gray gap between consecutive pages, like the spacing Word puts
                  between pages. Drawn as an overlay (not flow space) so the
                  editable text stays continuous and the page count is exact. */}
              {Array.from({ length: pageCount - 1 }).map((_, i) => (
                <div
                  key={`gap-${i}`}
                  className="pointer-events-none absolute left-0 right-0 z-20 bg-slate-100"
                  style={{
                    top: `${(i + 1) * PAGE_HEIGHT_PX - PAGE_GAP_PX / 2}px`,
                    height: `${PAGE_GAP_PX}px`,
                    boxShadow:
                      'inset 0 7px 6px -7px rgba(15,23,42,.22), inset 0 -7px 6px -7px rgba(15,23,42,.22)',
                  }}
                />
              ))}

              {/* Assignment-style border, one rectangle per page, inset from the
                  page edges. The chosen line style (solid/double/dashed/…) is
                  applied here and mirrored in the PDF/DOCX export.
                  pointer-events-none keeps the editor clickable underneath. */}
              {borderStyle !== 'none' && Array.from({ length: pageCount }).map((_, i) => {
                const opt = borderOption(borderStyle);
                const topGap = i === 0 ? 0 : PAGE_GAP_PX / 2;
                const botGap = i === pageCount - 1 ? 0 : PAGE_GAP_PX / 2;
                return (
                  <div
                    key={`border-${i}`}
                    className="pointer-events-none absolute z-10"
                    style={{
                      left: 'clamp(12px, 2.5vw, 20px)',
                      right: 'clamp(12px, 2.5vw, 20px)',
                      top: `calc(${i * PAGE_HEIGHT_PX + topGap}px + clamp(12px, 2.5vw, 20px))`,
                      height: `calc(${PAGE_HEIGHT_PX - topGap - botGap}px - 2 * clamp(12px, 2.5vw, 20px))`,
                      borderStyle: opt.borderStyle,
                      borderWidth: opt.borderWidth,
                      borderColor: BORDER_COLOR,
                    }}
                  />
                );
              })}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                dir="auto"
                onInput={() => { updateStats(); scheduleSave(); recalcPages(); }}
                onKeyUp={refreshActive}
                onMouseUp={refreshActive}
                spellCheck={false}
                className="outline-none text-slate-900 leading-relaxed bg-transparent"
                style={{
                  padding: 'clamp(18px, 5vw, 25mm)',
                  fontFamily,
                  fontSize: `${fontSize}px`,
                  // Preserve the OCR layout: keep leading indentation and the
                  // inter-word spacing the layout engine produced, while still
                  // wrapping long lines like a normal document.
                  whiteSpace: 'pre-wrap',
                }}
              />
            </div>
          )}
        </div>

        <aside className="w-full xl:w-96 bg-white border-t xl:border-t-0 xl:border-l border-slate-200 flex flex-col min-h-[240px] max-h-[45vh] xl:max-h-none xl:min-h-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-slate-900">AI Suggestions</h2>
              <p className="text-[11px] text-slate-400">Review OCR fixes and grammar issues</p>
            </div>
            <button
              type="button"
              onClick={() => fetchAiCorrections('proofread')}
              disabled={loading || loadingSuggestions}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-[#3461ff] text-[12px] font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {loadingSuggestions ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              Scan
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loadingSuggestions ? (
              <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-slate-400">
                <Loader2 size={16} className="animate-spin" /> Checking document…
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.map((suggestion) => (
                <div key={suggestion.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-[12px] font-bold text-slate-500">{suggestion.reason || 'Suggested correction'}</p>
                    <button
                      type="button"
                      onClick={() => ignoreSuggestion(suggestion.id)}
                      className="text-slate-300 hover:text-slate-500"
                      title="Ignore"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2 text-[13px]">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Original</span>
                      <p className="mt-1 rounded-lg bg-white border border-red-100 px-2.5 py-2 text-slate-700">{suggestion.oldText}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Suggested</span>
                      <p className="mt-1 rounded-lg bg-white border border-emerald-100 px-2.5 py-2 text-slate-700">{suggestion.newText}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => acceptSuggestion(suggestion)}
                    className="mt-3 w-full rounded-lg bg-[#3461ff] hover:bg-[#2b51d6] text-white text-[12px] font-bold py-2 transition-colors"
                  >
                    Accept change
                  </button>
                </div>
              ))
            ) : (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center px-5">
                <Wand2 size={28} className="text-slate-300 mb-2" />
                <p className="text-[13px] font-bold text-slate-600">No suggestions yet</p>
                <p className="text-[12px] text-slate-400 mt-1">Click Scan to check OCR text for corrections.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-white border-t border-slate-200 px-3 sm:px-4 py-1.5 text-[12px] text-slate-500 shrink-0">
        <span>{stats.words} Words · {stats.chars} Characters</span>
        <span className="text-slate-400">Changes auto-save and are used when you export this document.</span>
      </footer>
    </div>
  );
}
