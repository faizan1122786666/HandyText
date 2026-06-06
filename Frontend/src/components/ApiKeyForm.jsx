import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Eye, EyeOff, Loader2, Trash2, ExternalLink, CheckCircle2, Cpu, ChevronDown } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';

function ProviderKeyRow({ provider, onSaved }) {
  const { addToast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key) {
      addToast('Please paste your API key first', 'info');
      return;
    }
    setSaving(true);
    try {
      const data = await api.post('/settings/ai/key', { provider: provider.id, api_key: key });
      setApiKey('');
      setShow(false);
      addToast(`${provider.label} key saved`, 'success');
      onSaved?.(data);
    } catch (err) {
      addToast(err?.message || 'Could not save API key', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const data = await api.delete(`/settings/ai/key/${provider.id}`);
      addToast(`${provider.label} key removed`, 'success');
      onSaved?.(data);
    } catch (err) {
      addToast(err?.message || 'Could not remove API key', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="flex items-center gap-2 text-[13px] font-extrabold text-slate-800 min-w-0">
          <span className="truncate">{provider.label}</span>
          {provider.configured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <CheckCircle2 size={11} /> {provider.masked}
            </span>
          )}
        </span>
        {provider.configured && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={saving}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={12} /> Remove
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider.configured ? 'Replace API key…' : `Paste your ${provider.label} key…`}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-[12px] text-slate-800 outline-none focus:border-[#3461ff] focus:ring-2 focus:ring-blue-100 transition-all"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            aria-label={show ? 'Hide key' : 'Show key'}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#3461ff] hover:bg-[#2a52d6] text-white text-[12px] font-bold px-3.5 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
        </button>
      </form>

      <a
        href={provider.key_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#3461ff] hover:underline"
      >
        Get a {provider.label} key
        <ExternalLink size={11} />
      </a>
    </div>
  );
}

export function ApiKeyForm() {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingModel, setSavingModel] = useState(false);

  const loadSettings = async () => {
    try {
      const res = await api.get('/settings/ai');
      setData(res);
    } catch (err) {
      addToast(err?.message || 'Could not load AI settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providerById = useMemo(() => {
    const map = {};
    (data?.providers || []).forEach((p) => { map[p.id] = p; });
    return map;
  }, [data]);

  const selectedModel = useMemo(
    () => (data?.models || []).find((m) => m.id === data?.selected_model),
    [data]
  );

  const selectedProvider = selectedModel ? providerById[selectedModel.provider] : null;
  const selectedNeedsKey = selectedProvider && !selectedProvider.configured;

  const handleModelChange = async (modelId) => {
    setSavingModel(true);
    try {
      const res = await api.post('/settings/ai/model', { model: modelId });
      setData(res);
      addToast('Active model updated', 'success');
    } catch (err) {
      addToast(err?.message || 'Could not update model', 'error');
    } finally {
      setSavingModel(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-50 text-[#3461ff] flex items-center justify-center">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-slate-900">AI Models &amp; API Keys</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Pick the model used for OCR and AI suggestions, and add the matching provider key. Keys are stored only on this server.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-6 justify-center text-xs">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !data ? (
        <p className="text-xs text-slate-500 py-4">Could not load AI settings.</p>
      ) : (
        <>
          {/* Model selector */}
          <label className="block mb-5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Cpu size={13} /> Active model
            </span>
            <div className="relative mt-1.5">
              <select
                value={data.selected_model}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={savingModel}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 pr-10 text-[13px] font-semibold text-slate-800 outline-none focus:border-[#3461ff] focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-60"
              >
                {(data.providers || []).map((prov) => {
                  const models = (data.models || []).filter((m) => m.provider === prov.id);
                  if (!models.length) return null;
                  return (
                    <optgroup key={prov.id} label={prov.label}>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {savingModel ? <Loader2 size={15} className="animate-spin" /> : <ChevronDown size={16} />}
              </span>
            </div>
            {selectedProvider && (
              selectedNeedsKey ? (
                <span className="mt-1.5 inline-block text-[11px] font-semibold text-amber-600">
                  Add a {selectedProvider.label} key below to use this model.
                </span>
              ) : (
                <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle2 size={12} /> {selectedProvider.label} key configured — ready to use.
                </span>
              )
            )}
          </label>

          {/* Per-provider keys */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Provider API keys
            </span>
            {(data.providers || []).map((prov) => (
              <ProviderKeyRow key={prov.id} provider={prov} onSaved={setData} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
