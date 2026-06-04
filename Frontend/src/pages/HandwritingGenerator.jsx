import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, PenLine, ImagePlus, Sparkles, Download, FileDown, Loader2, X,
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

export function HandwritingGenerator() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const bgInputRef = useRef(null);

  const [text, setText] = useState('');
  const [fonts, setFonts] = useState([{ id: 'caveat', label: 'Caveat' }]);
  const [font, setFont] = useState('caveat');
  const [fontSize, setFontSize] = useState(46);
  const [inkColor, setInkColor] = useState(INK_COLORS[0].value);
  const [bgFile, setBgFile] = useState(null);
  const [bgPreview, setBgPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState(null);
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

  const buildFormData = (fmt) => {
    const fd = new FormData();
    fd.append('text', text);
    fd.append('font', font);
    fd.append('font_size', String(fontSize));
    fd.append('ink_color', inkColor);
    fd.append('fmt', fmt);
    if (bgFile) fd.append('file', bgFile);
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
    setGenerating(true);
    try {
      const blob = await requestGenerate('png');
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
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
    if (resultBlob) triggerDownload(resultBlob, 'png');
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await requestGenerate('pdf');
      triggerDownload(blob, 'pdf');
    } catch (err) {
      addToast(err?.message || 'Could not export PDF', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/convert')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2 text-[14px] font-bold text-slate-800">
            <PenLine size={17} className="text-[#3461ff]" />
            Text → Handwriting
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
        {/* Left: input + controls */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Text input */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 text-[13px] font-bold text-slate-800">
              Your text
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type the text you want to turn into handwriting…"
              className="w-full h-56 p-3 text-[14px] text-slate-800 outline-none resize-none placeholder:text-slate-400"
            />
          </div>

          {/* Options */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-4">
            {/* Background image */}
            <div>
              <label className="text-[12px] font-semibold text-slate-600">Page background (your image)</label>
              {bgPreview ? (
                <div className="mt-2 relative inline-block">
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
                  className="mt-2 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-lg text-[13px] text-slate-500 hover:border-[#3461ff]/40 hover:text-[#3461ff] transition-colors"
                >
                  <ImagePlus size={16} /> Upload background image (optional)
                </button>
              )}
              <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgChange} className="hidden" />
              <p className="mt-1.5 text-[11px] text-slate-400">Leave empty to write on a blank A4 page.</p>
            </div>

            {/* Font */}
            <div>
              <label className="text-[12px] font-semibold text-slate-600">Handwriting font</label>
              <select
                value={font}
                onChange={(e) => setFont(e.target.value)}
                className="mt-1.5 w-full h-9 px-2 text-[13px] border border-slate-200 rounded-md text-slate-700 bg-white cursor-pointer"
              >
                {fonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>

            {/* Font size */}
            <div>
              <label className="text-[12px] font-semibold text-slate-600">Size: {fontSize}px</label>
              <input
                type="range"
                min="28"
                max="90"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="mt-1.5 w-full accent-[#3461ff]"
              />
            </div>

            {/* Ink color */}
            <div>
              <label className="text-[12px] font-semibold text-slate-600">Ink color</label>
              <div className="mt-1.5 flex items-center gap-2">
                {INK_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setInkColor(c.value)}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                      inkColor === c.value ? 'border-[#3461ff]' : 'border-slate-200',
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <input
                  type="color"
                  value={inkColor}
                  onChange={(e) => setInkColor(e.target.value)}
                  title="Custom color"
                  className="w-7 h-7 rounded-full border border-slate-200 cursor-pointer bg-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="mt-1 flex items-center justify-center gap-2 py-2.5 bg-[#3461ff] hover:bg-[#2a52d6] text-white text-[14px] font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? 'Generating…' : 'Generate handwriting'}
            </button>
          </div>
        </div>

        {/* Right: preview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800">Preview</span>
            {resultUrl && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
                >
                  <Download size={13} /> PNG
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold text-white bg-[#3461ff] hover:bg-[#2a52d6] rounded-md transition-colors"
                >
                  <FileDown size={13} /> PDF
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
            {generating ? (
              <div className="flex items-center gap-2 text-slate-400 text-[13px]">
                <Loader2 size={18} className="animate-spin" /> Generating handwriting…
              </div>
            ) : resultUrl ? (
              <img src={resultUrl} alt="Generated handwriting" className="max-w-full shadow-md rounded-sm bg-white" />
            ) : (
              <div className="text-center text-slate-400 text-[13px] px-6">
                <PenLine size={28} className="mx-auto mb-2 text-slate-300" />
                Type your text and click <span className="font-semibold">Generate handwriting</span> to see the result here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
