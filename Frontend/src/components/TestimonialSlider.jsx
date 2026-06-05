import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, ArrowLeft, Quote } from 'lucide-react';


const testimonials = [
  {
    name: "Sarah Jenkins",
    role: "Product Manager",
    avatar: "SJ",
    avatarBg: "#e0e7ff",
    avatarColor: "#4338ca",
    quote:
      "HandyText completely changed how I handle my meeting notes. I just snap a photo and my handwriting is instantly converted — it saves me at least an hour every day.",
  },
  {
    name: "Dr. Mark Rivera",
    role: "General Physician",
    avatar: "MR",
    avatarBg: "#dcfce7",
    avatarColor: "#15803d",
    quote:
      "Digitizing handwritten prescriptions used to be a nightmare. Now I just upload an image and the text is ready in seconds. The accuracy is honestly impressive.",
  },
  {
    name: "Alex Lin",
    role: "Software Engineer",
    avatar: "AL",
    avatarBg: "#fef9c3",
    avatarColor: "#a16207",
    quote:
      "The Markdown export is a lifesaver for my dev workflow. I sketch out ideas on paper and HandyText turns them into structured notes I can drop straight into my docs.",
  },
  {
    name: "Emily Chen",
    role: "Research Scientist",
    avatar: "EC",
    avatarBg: "#fce7f3",
    avatarColor: "#be185d",
    quote:
      "In research, accuracy is everything. HandyText handles my dense handwritten formulas and lab notes better than any other tool I've tried. Absolutely reliable.",
  },
  {
    name: "David Park",
    role: "Legal Consultant",
    avatar: "DP",
    avatarBg: "#ede9fe",
    avatarColor: "#6d28d9",
    quote:
      "I can finally digitize my case notes without worrying about transcription errors. HandyText is now a core part of my daily legal documentation workflow.",
  },
  {
    name: "Priya Nair",
    role: "University Student",
    avatar: "PN",
    avatarBg: "#ffedd5",
    avatarColor: "#c2410c",
    quote:
      "I take all my lecture notes by hand and HandyText converts them instantly. Studying is so much easier when I can search and copy my own notes digitally.",
  },
];

// ─── Testimonial Slider ───────────────────────────────────────────────────────

export function TestimonialSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsToShow, setItemsToShow] = useState(3);

  const updateItemsToShow = useCallback(() => {
    if (window.innerWidth < 640) setItemsToShow(1);
    else if (window.innerWidth < 1024) setItemsToShow(2);
    else setItemsToShow(3);
  }, []);

  useEffect(() => {
    updateItemsToShow();
    window.addEventListener('resize', updateItemsToShow);
    return () => window.removeEventListener('resize', updateItemsToShow);
  }, [updateItemsToShow]);

  const totalDots = Math.max(1, testimonials.length - itemsToShow + 1);

  useEffect(() => {
    if (currentIndex >= totalDots) setCurrentIndex(totalDots - 1);
  }, [itemsToShow, totalDots, currentIndex]);

  const goTo = (index) =>
    setCurrentIndex(Math.max(0, Math.min(index, totalDots - 1)));

  return (
    <section id="testimonials" className="px-6 py-16 bg-white border-t border-slate-100">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="relative flex flex-col md:block mb-10 gap-6 md:min-h-[5.5rem]">
          <div className="max-w-xl text-center md:absolute md:left-1/2 md:-translate-x-1/2 md:top-0 md:w-full md:max-w-xl">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
              Loved by Professionals
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              See how HandyText is helping people digitize handwritten work and create realistic handwriting from digital text.
            </p>
          </div>

          {/* Arrow buttons - Matching Login.jsx theme */}
          <div className="flex gap-3 flex-shrink-0 self-center md:absolute md:right-0 md:bottom-0">
            <button
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all
                         bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900
                         disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              aria-label="Previous"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex >= totalDots - 1}
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all
                         bg-[#3461ff]/10 text-[#3461ff] hover:bg-[#3461ff]/20
                         disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              aria-label="Next"
            >
              <ArrowRight size={20} />
            </button>
          </div>
        </div>

        {/* Slider track */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
            style={{ transform: `translateX(-${currentIndex * (100 / itemsToShow)}%)` }}
          >
            {testimonials.map((item, index) => (
              <div
                key={index}
                className="flex-shrink-0 px-3"
                style={{ width: `${100 / itemsToShow}%` }}
              >
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-md shadow-slate-200/40 p-8 flex flex-col h-full transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-2xl hover:shadow-slate-300/70 hover:border-slate-200 cursor-pointer">

                  {/* Quote icon */}
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                    <Quote size={20} className="text-[#3461ff]" fill="currentColor" />
                  </div>

                  {/* Quote text */}
                  <p className="text-slate-600 text-[15px] leading-relaxed flex-1 mb-8 italic">
                    "{item.quote}"
                  </p>

                  {/* User info at bottom */}
                  <div className="flex items-center gap-4 pt-6 border-t border-slate-50">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: item.avatarBg, color: item.avatarColor }}
                    >
                      {item.avatar}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-slate-900 leading-tight">
                        {item.name}
                      </p>
                      <p className="text-xs text-[#3461ff] font-semibold mt-1 uppercase tracking-wider">{item.role}</p>
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dots - Matching Login.jsx theme color */}
        <div className="flex justify-center gap-2.5 mt-10">
          {Array.from({ length: totalDots }).map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`rounded-full border-none transition-all duration-300 cursor-pointer ${
                currentIndex === index
                  ? 'w-3 h-3 bg-[#3461ff] scale-110'
                  : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
              }`}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
