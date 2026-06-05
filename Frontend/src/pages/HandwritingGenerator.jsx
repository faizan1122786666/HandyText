import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, PenLine, ImagePlus, Sparkles, Download, FileDown, Loader2, X,
  Type, Palette, FileText, Check,
} from 'lucide-react';
import { API_URL } from '../utils/api';
import { getAccessToken } from '../utils/auth';
import { useToast } from '../context/ToastContext';
import { cn } from '../utils/cn';

const INK_COLORS = [
  { label: 'Blue ink', value: '#22356f' },
  { label: 'Black', value: '#1a1a1a' },
  { label: 'Royal blue', value: '#1d4ed8' },
  { label: 'Green', value: '#15803d' },
  { label: 'Red', value: '#b91c1c' },
];

// Page style options. 'custom' reveals an upload box.
const PAGE_TYPES = [
  { id: 'a4', label: 'Blank A4', hint: 'Plain white sheet' },
  { id: 'ruled', label: 'Lined page', hint: 'Ruled notebook paper' },
  { id: 'custom', label: 'Your image', hint: 'Upload your own paper' },
];

// Persist the input + generated result so the content survives a page refresh /
// navigation (so it isn't lost before the user downloads it). It is cleared on a
// fresh login — see utils/auth.setLoggedIn.
const STORAGE_KEY = 'handytext-handwriting';

const loadSaved = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const dataUrlToBlob = (dataUrl) => {
  try {
    const [meta, b64] = String(dataUrl).split(',');
    const mime = meta.match(/:(.*?);/)?.[1] || 'image/png';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch { return null; }
};

// Tiny visual mockups for the page-style picker.
function PagePreview({ type }) {
  if (type === 'ruled') {
    return (
      <div className="relative w-full h-14 rounded-md bg-white border border-slate-200 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="absolute left-0 right-0 h-px bg-blue-200" style={{ top: 8 + i * 11 }} />
        ))}
      </div>
    );
  }
  if (type === 'custom') {
    return (
      <div className="w-full h-14 rounded-md bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center">
        <ImagePlus size={18} className="text-slate-400" />
      </div>
    );
  }
  return <div className="w-full h-14 rounded-md bg-white border border-slate-200" />;
}

export function HandwritingGenerator() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const bgInputRef = useRef(null);

  const saved = useRef(loadSaved()).current || {};
  const [text, setText] = useState(saved.text || '');
  const [fonts, setFonts] = useState([{ id: 'caveat', label: 'Caveat' }]);
  const [font, setFont] = useState(saved.font || 'caveat');
  const [fontSize, setFontSize] = useState(saved.fontSize || 46);
  const [inkColor, setInkColor] = useState(saved.inkColor || INK_COLORS[0].value);
  const [pageType, setPageType] = useState(saved.pageType || 'a4');
  const [bgFile, setBgFile] = useState(null);
  const [bgPreview, setBgPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [resultDataUrl, setResultDataUrl] = useState(saved.resultDataUrl || null);
  const [resultBlob, setResultBlob] = useState(null);

  // Load available handwriting fonts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/handwriting/fonts`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data.fonts) && data.fonts.length) {
          setFonts(data.fonts);
        }
      } catch {
        /* keep default */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Rebuild the downloadable PNG blob from a restored (persisted) result.
  useEffect(() => {
    if (resultDataUrl && !resultBlob) {
      const b = dataUrlToBlob(resultDataUrl);
      if (b) setResultBlob(b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist input + settings + last result so nothing is lost on refresh.
  useEffect(() => {
    const snapshot = { text, font, fontSize, inkColor, pageType, resultDataUrl };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // localStorage quota exceeded (large image) — keep at least the text/settings.
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, resultDataUrl: null })); } catch { /* ignore */ }
    }
  }, [text, font, fontSize, inkColor, pageType, resultDataUrl]);

  const handleBgChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Please choose an image file for the background', 'error');
      return;
    }
    setBgFile(file);
    if (bgPreview) URL.revokeObjectURL(bgPreview);
    setBgPreview(URL.createObjectURL(file));
  };

  const clearBg = () => {
    if (bgPreview) URL.revokeObjectURL(bgPreview);
    setBgFile(null);
    setBgPreview(null);
    if (bgInputRef.current) bgInputRef.current.value = '';
  };

  const selectPageType = (id) => {
    setPageType(id);
    if (id !== 'custom') clearBg();
  };

  const buildFormData = (fmt) => {
    const fd = new FormData();
    fd.append('text', text);
    fd.append('font', font);
    fd.append('font_size', String(fontSize));
    fd.append('ink_color', inkColor);
    fd.append('page_type', pageType === 'ruled' ? 'ruled' : 'a4');
    fd.append('fmt', fmt);
    if (pageType === 'custom' && bgFile) fd.append('file', bgFile);
    return fd;
  };

  const requestGenerate = async (fmt) => {
    const headers = {};
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/handwriting/generate`, {
      method: 'POST',
      headers,
      body: buildFormData(fmt),
    });
    if (!res.ok) {
      let detail = 'Generation failed';
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {
        detail = res.statusText || detail;
      }
      throw new Error(detail);
    }
    return res.blob();
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      addToast('Type some text to convert into handwriting', 'info');
      return;
    }
    if (pageType === 'custom' && !bgFile) {
      addToast('Upload a background image or choose a page style', 'info');
      return;
    }
    setGenerating(true);
    try {
      const blob = await requestGenerate('png');
      setResultBlob(blob);
      const dataUrl = await blobToDataUrl(blob);
      setResultDataUrl(dataUrl);
      addToast('Handwriting generated!', 'success');
    } catch (err) {
      addToast(err?.message || 'Could not generate handwriting', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const triggerDownload = (blob, ext) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `handwriting.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    const blob = resultBlob || (resultDataUrl ? dataUrlToBlob(resultDataUrl) : null);
    if (blob) triggerDownload(blob, 'png');
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await requestGenerate('pdf');
      triggerDownload(blob, 'pdf');
    } catch (err) {
      addToast(err?.message || 'Could not export PDF', 'error');
    }
  };

  const SectionLabel = ({ icon: Icon, children }) => (
    <div className="flex items-center gap-2 mb-2.5">
      <Icon size={15} className="text-[#3461ff]" />
      <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">{children}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/convert')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#3461ff] text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
              <PenLine size={16} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-extrabold text-slate-900 leading-tight truncate">Text → Handwriting</h1>
              <p className="text-[11px] text-slate-400 font-medium leading-tight hidden sm:block">Turn typed text into realistic handwriting</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-5 gap-5 p-4 sm:p-6">
        {/* Left: input + controls */}
        <div className="xl:col-span-2 flex flex-col gap-5 min-w-0">
          {/* Text input */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <SectionLabel icon={Type}>Your text</SectionLabel>
              <p className="text-[11px] text-slate-400 -mt-1.5">Write or paste what you want converted to handwriting.</p>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type the text you want to turn into handwriting…"
              className="w-full h-44 px-4 py-3 text-[14px] leading-relaxed text-slate-800 outline-none resize-none placeholder:text-slate-400"
            />
            <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
              {text.trim() ? `${text.trim().split(/\s+/).length} words` : 'No text yet'}
            </div>
          </div>

          {/* Page style */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <SectionLabel icon={FileText}>Page style</SectionLabel>
            <div className="grid grid-cols-3 gap-2.5">
              {PAGE_TYPES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPageType(p.id)}
                  className={cn(
                    'relative text-left rounded-xl border p-2.5 transition-all',
                    pageType === p.id
                      ? 'border-[#3461ff] ring-2 ring-blue-100 bg-blue-50/40'
                      : 'border-slate-200 hover:border-slate-300 bg-white',
                  )}
                >
                  {pageType === p.id && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#3461ff] text-white flex items-center justify-center">
                      <Check size={11} />
                    </span>
                  )}
                  <PagePreview type={p.id} />
                  <p className="mt-2 text-[12px] font-bold text-slate-800 leading-tight">{p.label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{p.hint}</p>
                </button>
              ))}
            </div>

            {/* Custom upload */}
            {pageType === 'custom' && (
              <div className="mt-3">
                {bgPreview ? (
                  <div className="relative inline-block">
                    <img src={bgPreview} alt="background" className="h-24 rounded-lg border border-slate-200 object-cover" />
                    <button
                      type="button"
                      onClick={clearBg}
                      className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-0.5 shadow-sm text-slate-500 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => bgInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-[13px] text-slate-500 hover:border-[#3461ff]/40 hover:text-[#3461ff] transition-colors"
                  >
                    <ImagePlus size={16} /> Upload background image
                  </button>
                )}
                <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgChange} className="hidden" />
              </div>
            )}
          </div>

          {/* Pen settings */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col gap-5">
            <SectionLabel icon={Palette}>Pen &amp; style</SectionLabel>

            {/* Font */}
            <div>
              <label className="text-[12px] font-semibold text-slate-600">Handwriting font</label>
              <select
                value={font}
                onChange={(e) => setFont(e.target.value)}
                className="mt-1.5 w-full h-10 px-3 text-[13px] border border-slate-200 rounded-xl text-slate-700 bg-white cursor-pointer focus:border-[#3461ff] focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              >
                {fonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>

            {/* Font size */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-slate-600">Size</label>
                <span className="text-[12px] font-bold text-[#3461ff]">{fontSize}px</span>
              </div>
              <input
                type="range"
                min="28"
                max="90"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="mt-2 w-full accent-[#3461ff]"
              />
            </div>

            {/* Ink color */}
            <div>
              <label className="text-[12px] font-semibold text-slate-600">Ink color</label>
              <div className="mt-2 flex items-center gap-2.5 flex-wrap">
                {INK_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setInkColor(c.value)}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
                      inkColor === c.value ? 'border-[#3461ff] ring-2 ring-blue-100' : 'border-slate-200',
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <label className="relative w-8 h-8 rounded-full border border-slate-200 cursor-pointer overflow-hidden" title="Custom color">
                  <span className="absolute inset-0" style={{ backgroundColor: inkColor }} />
                  <input
                    type="color"
                    value={inkColor}
                    onChange={(e) => setInkColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="mt-1 flex items-center justify-center gap-2 py-3 bg-[#3461ff] hover:bg-[#2a52d6] text-white text-[14px] font-bold rounded-xl transition-colors disabled:opacity-60 shadow-sm shadow-blue-500/30"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? 'Generating…' : 'Generate handwriting'}
            </button>
          </div>
        </div>

        {/* Right: preview */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">Preview</span>
            {resultDataUrl && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                >
                  <Download size={13} /> PNG
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#3461ff] hover:bg-[#2a52d6] rounded-lg transition-colors"
                >
                  <FileDown size={13} /> PDF
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto bg-slate-100/70 p-4 sm:p-6 flex items-center justify-center">
            {generating ? (
              <div className="flex flex-col items-center gap-3 text-slate-400 text-[13px]">
                <Loader2 size={26} className="animate-spin text-[#3461ff]" />
                Generating handwriting…
              </div>
            ) : resultDataUrl ? (
              <img src={resultDataUrl} alt="Generated handwriting" className="max-w-full shadow-lg rounded-sm bg-white ring-1 ring-slate-200" />
            ) : (
              <div className="text-center text-slate-400 text-[13px] px-6 max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto mb-4">
                  <PenLine size={26} className="text-slate-300" />
                </div>
                <p className="font-semibold text-slate-500">Your handwriting will appear here</p>
                <p className="mt-1">Type your text, pick a page style, and click <span className="font-semibold text-[#3461ff]">Generate handwriting</span>.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
