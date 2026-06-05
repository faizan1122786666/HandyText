import React, { useEffect, useState } from 'react';
import { Sparkles, Eye, EyeOff, Loader2, Trash2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';

export function ApiKeyForm() {
  const { addToast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState({ configured: false, masked: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadStatus = async () => {
    try {
      const data = await api.get('/settings/gemini-key');
      setStatus(data);
    } catch (err) {
      addToast(err?.message || 'Could not load API key status', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key) {
      addToast('Please paste your API key first', 'info');
      return;
    }
    setSaving(true);
    try {
      const data = await api.post('/settings/gemini-key', { api_key: key });
      setStatus(data);
      setApiKey('');
      setShow(false);
      addToast('API key saved — it will be used for OCR and AI suggestions', 'success');
    } catch (err) {
      addToast(err?.message || 'Could not save API key', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const data = await api.delete('/settings/gemini-key');
      setStatus(data);
      addToast('API key removed', 'success');
    } catch (err) {
      addToast(err?.message || 'Could not remove API key', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-50 text-[#3461ff] flex items-center justify-center">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-slate-900">Gemini API Key</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Use your own Google Gemini key for high-accuracy OCR and AI suggestions. Stored only on this server.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-6 justify-center text-xs">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {status.configured && (
            <div className="flex items-center justify-between gap-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-[12px] font-bold text-emerald-700 min-w-0">
                <CheckCircle2 size={15} className="shrink-0" />
                <span className="truncate">Key configured: {status.masked}</span>
              </span>
              <button
                type="button"
                onClick={handleRemove}
                disabled={saving}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 size={13} /> Remove
              </button>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {status.configured ? 'Replace API key' : 'Enter API key'}
              </span>
              <div className="relative mt-1.5">
                <input
                  type={show ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your Gemini API key…"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 pr-10 text-[13px] text-slate-800 outline-none focus:border-[#3461ff] focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label={show ? 'Hide key' : 'Show key'}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#3461ff] hover:bg-[#2a52d6] text-white text-[13px] font-bold px-5 py-2.5 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              Save key
            </button>
          </form>

          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3461ff] hover:underline"
          >
            Get a free Gemini API key from Google AI Studio
            <ExternalLink size={13} />
          </a>
        </>
      )}
    </div>
  );
}
