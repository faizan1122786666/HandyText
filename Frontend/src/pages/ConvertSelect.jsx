import { useNavigate } from 'react-router-dom';
import { ScanText, PenLine, ArrowRight } from 'lucide-react';

const OPTIONS = [
  {
    id: 'ocr',
    title: 'Handwritten → Digital Text',
    description: 'Upload a handwritten image and extract clean, editable digital text with OCR. Edit it and export to TXT, DOCX, or PDF.',
    icon: ScanText,
    to: '/uploadpage',
    accent: 'from-blue-500 to-indigo-500',
  },
  {
    id: 'handwriting',
    title: 'Digital Text → Handwriting',
    description: 'Type your text and turn it into realistic handwriting on a page. Use your own image as the page background and download the result.',
    icon: PenLine,
    to: '/handwriting',
    accent: 'from-violet-500 to-fuchsia-500',
  },
];

export function ConvertSelect() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10 font-sans">
      <div className="text-center mb-8 max-w-xl">
        <h1 className="text-2xl font-bold text-slate-800">Convert Text</h1>
        <p className="mt-2 text-[14px] text-slate-500">
          Choose the direction you want to convert in.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 w-full max-w-3xl">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => navigate(opt.to)}
              className="group text-left bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#3461ff]/40 transition-all p-6 flex flex-col gap-4"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${opt.accent} flex items-center justify-center text-white shadow-sm`}>
                <Icon size={24} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-800">{opt.title}</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{opt.description}</p>
              </div>
              <div className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-[#3461ff]">
                Continue
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
