import React from 'react';
import { Wifi, Battery, Signal, Smartphone } from 'lucide-react';

interface ExpoMobileFrameProps {
  children: React.ReactNode;
  isFrameActive: boolean;
}

export const ExpoMobileFrame: React.FC<ExpoMobileFrameProps> = ({
  children,
  isFrameActive,
}) => {
  if (!isFrameActive) {
    return <div className="w-full min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100/90 py-4 sm:py-8 px-2 flex flex-col items-center justify-center">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-xs">
        <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
        <span>Expo Preview (Ambiente Mobile React Native / TypeScript)</span>
      </div>

      {/* Phone chassis */}
      <div className="relative w-full max-w-[420px] h-[880px] bg-slate-800 rounded-[44px] p-3 shadow-2xl border border-slate-700 flex flex-col overflow-hidden">
        {/* Dynamic Island / Speaker Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-40 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 ml-auto mr-3 border border-slate-800" />
        </div>

        {/* Status Bar */}
        <div className="h-6 px-6 pt-1 flex items-center justify-between text-[11px] font-bold text-slate-200 select-none z-30 shrink-0">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <Signal className="w-3 h-3 text-slate-300" />
            <Wifi className="w-3 h-3 text-slate-300" />
            <Battery className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          </div>
        </div>

        {/* Inner Phone Screen Content */}
        <div className="flex-1 overflow-y-auto rounded-[32px] bg-slate-50 flex flex-col relative scrollbar-none">
          {children}
        </div>

        {/* Home Indicator Bar */}
        <div className="h-4 flex items-center justify-center shrink-0">
          <div className="w-32 h-1 bg-slate-500 rounded-full" />
        </div>
      </div>
    </div>
  );
};
