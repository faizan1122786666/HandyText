import React from 'react';

export function Logo({ className = "w-12 h-12", color = "#4169e1" }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Background Shape */}
        <rect width="100" height="100" rx="28" fill="url(#logoGradient)" />
        
        {/* Stylized 'H' that looks like a pen and text */}
        <path 
          d="M30 30V70M30 50H70M70 30V70" 
          stroke="white" 
          strokeWidth="10" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        
        {/* Pen Tip Detail */}
        <path 
          d="M25 25L35 35M65 65L75 75" 
          stroke="white" 
          strokeWidth="4" 
          strokeLinecap="round" 
          opacity="0.6"
        />

        {/* AI Sparkles */}
        <circle cx="75" cy="25" r="4" fill="white" className="animate-pulse">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="85" cy="35" r="2.5" fill="white">
          <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
