import { useNavigate } from 'react-router-dom';
import { ScanText, PenLine, ArrowRight, Sparkles, FileText, Download, ShieldCheck } from 'lucide-react';

const OPTIONS = [
  {
    id: 'ocr',
    title: 'Handwritten → Digital Text',
    description: 'Upload notes, prescriptions, whiteboards, or scanned pages and extract clean editable text with OCR.',
    icon: ScanText,
    to: '/uploadpage',
    accent: 'from-[#3461ff] to-[#2b51d6]',
    buttonClass: 'bg-[#3461ff] group-hover:bg-[#2b51d6] shadow-[#3461ff]/20 group-hover:shadow-[#3461ff]/30',
    iconBg: 'bg-blue-50',
    iconColor: 'text-[#3461ff]',
    topBar: 'from-[#3461ff] via-[#4169e1] to-[#2b51d6]',
    badge: 'OCR Scanner',
    action: 'Upload handwriting',
    highlights: ['Image and PDF upload', 'Editable text output', 'Export to TXT, DOCX, or PDF'],
  },
  {
    id: 'handwriting',
    title: 'Digital Text → Handwriting',
    description: 'Type or paste digital text and generate a realistic handwritten page with custom paper and font settings.',
    icon: PenLine,
    to: '/handwriting',
    accent: 'from-[#3461ff] to-[#2b51d6]',
    buttonClass: 'bg-[#3461ff] group-hover:bg-[#2b51d6] shadow-[#3461ff]/20 group-hover:shadow-[#3461ff]/30',
    iconBg: 'bg-blue-50',
    iconColor: 'text-[#3461ff]',
    topBar: 'from-[#3461ff] via-[#4169e1] to-[#2b51d6]',
    badge: 'Handwriting Studio',
    action: 'Create handwriting',
    highlights: ['Multiple handwriting fonts', 'Custom page backgrounds', 'Download generated output'],
  },
];

const BENEFITS = [
  { icon: Sparkles, label: 'AI-powered conversion', color: 'text-[#3461ff]', bg: 'bg-blue-50' },
  { icon: FileText, label: 'Editable results', color: 'text-cyan-700', bg: 'bg-cyan-50' },
  { icon: Download, label: 'Easy downloads', color: 'text-violet-600', bg: 'bg-violet-50' },
  { icon: ShieldCheck, label: 'Private workspace', color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

export function ConvertSelect() {
  const navigate = useNavigate();

  return (
    <div className="p-4 sm:p-6 w-full max-w-7xl mx-auto min-h-screen bg-slate-50/50 font-sans">
      <div className="w-full">
        <div className="w-full">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Choose how you want to convert</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 font-medium">
                Move between handwritten notes and digital text in either direction with the same HandyText workflow.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Ready to convert
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={benefit.label}
                  className="flex min-h-[68px] items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm shadow-slate-200/40 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#3461ff]/20 hover:shadow-md hover:shadow-slate-300/50"
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-slate-200/70 ${benefit.bg} ${benefit.color}`}>
                    <Icon size={19} />
                  </div>
                  <span className="text-sm font-bold leading-snug text-slate-800">{benefit.label}</span>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => navigate(opt.to)}
                  className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-0 text-left shadow-sm shadow-slate-200/40 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#3461ff]/30 hover:shadow-lg hover:shadow-slate-300/60 focus:outline-none focus:ring-4 focus:ring-[#3461ff]/15"
                >
                  <div className={`h-1.5 w-full bg-gradient-to-r ${opt.topBar}`} />
                  <div className="flex h-full flex-col p-5 sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 group-hover:scale-105 group-hover:ring-[#3461ff]/20 sm:h-14 sm:w-14 ${opt.iconBg} ${opt.iconColor}`}>
                        <Icon size={24} />
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {opt.badge}
                      </span>
                    </div>

                    <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">{opt.title}</h2>
                    <p className="mt-2 min-h-0 text-sm leading-6 text-slate-500 lg:min-h-[72px]">{opt.description}</p>

                    <div className="mt-5 grid gap-2">
                      {opt.highlights.map((item) => (
                        <div key={item} className="flex items-center gap-2.5 text-[13px] font-semibold text-slate-700">
                          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className={`flex w-full items-center justify-between rounded-2xl px-5 py-3.5 text-white shadow-md transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-xl ${opt.buttonClass}`}>
                        <span className="text-sm font-bold sm:text-base">{opt.action}</span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#3461ff] shadow-sm transition-all duration-300 group-hover:translate-x-1 group-hover:scale-105">
                          <ArrowRight size={21} strokeWidth={2.5} />
                        </span>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-[13px] leading-6 text-slate-600 sm:px-5">
            Choose <span className="font-semibold text-slate-800">Handwritten → Digital Text</span> when you have an image or PDF. Choose <span className="font-semibold text-slate-800">Digital Text → Handwriting</span> when you want typed text rendered as handwriting.
          </div>
        </div>
      </div>
    </div>
  );
}
