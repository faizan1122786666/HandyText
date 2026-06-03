// import React from 'react';
// import logo from '../assets/logo.png';
// import { Globe, Mail, MessageCircle } from 'lucide-react';

// export function Footer() {
//   return (
//     <footer id="contact" className="w-full bg-slate-900 pt-16 pb-8 border-t border-slate-800">
//       <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 mb-12">
        
//         {/* Brand Col */}
//         <div className="space-y-4">
//           <div className="flex items-center">
//             <div className="w-20 h-20">
//               <img 
//                 src={logo} 
//                 alt="HandyText" 
//                 className="w-full h-full object-contain"
//                 style={{ filter: 'brightness(0) saturate(100%) invert(34%) sepia(85%) saturate(3015%) hue-rotate(216deg) brightness(90%) contrast(92%)' }}
//               />
//             </div>
//           </div>
//           <p className="text-slate-400 text-sm leading-relaxed">
//             The world's most accurate AI handwriting to text converter. Digitize your life effortlessly and securely.
//           </p>
//           <div className="flex gap-4 pt-2">
//             <a href="#" className="text-slate-400 hover:text-white transition-colors"><Globe size={20} /></a>
//             <a href="#" className="text-slate-400 hover:text-white transition-colors"><MessageCircle size={20} /></a>
//             <a href="#" className="text-slate-400 hover:text-white transition-colors"><Mail size={20} /></a>
//           </div>
//         </div>

//         {/* Product Col */}
//         <div>
//           <h4 className="text-white font-semibold mb-4">Product</h4>
//           <ul className="space-y-3 text-sm text-slate-400">
//             <li><a href="#" className="hover:text-[#4169e1] transition-colors">AI Scanner</a></li>
//             <li><a href="#" className="hover:text-[#4169e1] transition-colors">Pricing</a></li>
//             <li><a href="#" className="hover:text-[#4169e1] transition-colors">Security</a></li>
//             <li><a href="#" className="hover:text-[#4169e1] transition-colors">Integrations</a></li>
//           </ul>
//         </div>

//         {/* Company Col */}
//         <div>
//           <h4 className="text-white font-semibold mb-4">Company</h4>
//           <ul className="space-y-3 text-sm text-slate-400">
//             <li><a href="#" className="hover:text-[#4169e1] transition-colors">About Us</a></li>
//             <li><a href="#" className="hover:text-[#4169e1] transition-colors">Careers</a></li>
//             <li><a href="#" className="hover:text-[#4169e1] transition-colors">Blog</a></li>
//             <li><a href="#" className="hover:text-[#4169e1] transition-colors">Contact</a></li>
//           </ul>
//         </div>

//         {/* Legal Col */}
//         <div>
//           <h4 className="text-white font-semibold mb-4">Legal</h4>
//           <ul className="space-y-3 text-sm text-slate-400">
//             <li><a href="#" className="hover:text-[#4169e1] transition-colors">Privacy Policy</a></li>
//             <li><a href="#" className="hover:text-[#4169e1] transition-colors">Terms of Service</a></li>
//             <li><a href="#" className="hover:text-[#4169e1] transition-colors">Cookie Policy</a></li>
//           </ul>
//         </div>
//       </div>

//       <div className="max-w-7xl mx-auto px-6 border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
//         <p className="text-slate-500 text-sm">
//           &copy; {new Date().getFullYear()} HandyText AI. All rights reserved.
//         </p>
//         <div className="flex gap-6 text-sm text-slate-500">
//           <span>Made with precision</span>
//           <span>Worldwide support</span>
//         </div>
//       </div>
//     </footer>
//   );
// }











import React from 'react';
import logo from '../assets/logo.png';
import { Globe, Mail, MessageCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer id="contact" className="w-full bg-slate-900 pt-16 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 mb-12">
        
{/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="w-12 h-12">
                <img 
                  src={logo} 
                  alt="HandyText" 
                  className="w-full h-full object-contain"
                  style={{ filter: 'brightness(0) saturate(100%) invert(34%) sepia(85%) saturate(3015%) hue-rotate(216deg) brightness(90%) contrast(92%)' }}
                />
              </div>
              <span className="ml-3 text-xl font-bold text-white">HandyText</span>
            </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            The world's most accurate AI handwriting to text converter. Digitize your life effortlessly and securely.
          </p>
          <div className="flex gap-4 pt-2">
            <a href="#" className="text-slate-400 hover:text-white transition-colors"><Globe size={20} /></a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors"><MessageCircle size={20} /></a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors"><Mail size={20} /></a>
          </div>
        </div>

        {/* Product Col */}
        <div>
          <h4 className="text-white font-semibold mb-4">Product</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li><a href="#" className="hover:text-[#4169e1] transition-colors">AI Scanner</a></li>
            <li><a href="#" className="hover:text-[#4169e1] transition-colors">Pricing</a></li>
            <li><a href="#" className="hover:text-[#4169e1] transition-colors">Security</a></li>
            <li><a href="#" className="hover:text-[#4169e1] transition-colors">Integrations</a></li>
          </ul>
        </div>

        {/* Company Col */}
        <div>
          <h4 className="text-white font-semibold mb-4">Company</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li><a href="#" className="hover:text-[#4169e1] transition-colors">About Us</a></li>
            <li><a href="#" className="hover:text-[#4169e1] transition-colors">Careers</a></li>
            <li><a href="#" className="hover:text-[#4169e1] transition-colors">Blog</a></li>
            <li><a href="#" className="hover:text-[#4169e1] transition-colors">Contact</a></li>
          </ul>
        </div>

        {/* Legal Col */}
        <div>
          <h4 className="text-white font-semibold mb-4">Legal</h4>
          <ul className="space-y-3 text-sm text-slate-400">
            <li><a href="#" className="hover:text-[#4169e1] transition-colors">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-[#4169e1] transition-colors">Terms of Service</a></li>
            <li><a href="#" className="hover:text-[#4169e1] transition-colors">Cookie Policy</a></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} HandyText AI. All rights reserved.
        </p>
        <div className="flex gap-6 text-sm text-slate-500">
          <span>Made with precision</span>
          <span>Worldwide support</span>
        </div>
      </div>
    </footer>
  );
}