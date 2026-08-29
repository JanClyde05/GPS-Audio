import React from 'react';
import { X, Grid, Eye, Type, Palette, ShieldCheck, Check, Sparkles } from 'lucide-react';

interface DesignRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesignRulesModal: React.FC<DesignRulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm transition-opacity duration-200"
      />

      <div className="relative w-full max-w-2xl rounded-xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-6 sm:p-8 z-10 max-h-[85vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                System Specification
              </span>
              <span className="font-mono text-xs font-bold text-neutral-400">Bold Typography Design Theme</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-neutral-950 dark:text-white mt-1.5 uppercase">
              Bold Typography & Minimalist Design System
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-6 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
          
          {/* Section 1: Bold Typography Archetype */}
          <div className="p-4 sm:p-5 rounded-lg bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800">
            <div className="flex items-center gap-2 mb-2 text-neutral-950 dark:text-white font-black text-sm uppercase">
              <Type className="w-4 h-4 text-neutral-950 dark:text-white" />
              <h3>1. Bold Typographic Hierarchy & Character</h3>
            </div>
            <p className="mb-3 font-medium">
              High-contrast typographic weights (Bold 700 to Black 900) establishing confident structure without relying on decorative ornament or visual noise.
            </p>
            <div className="grid grid-cols-2 gap-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
              <div className="p-3 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800">
                <div className="text-[10px] text-neutral-400 uppercase font-sans font-bold">Display Scale</div>
                <div className="text-sm text-neutral-950 dark:text-white font-sans font-black mt-1">Plus Jakarta Sans 900</div>
                <div className="font-semibold text-neutral-500">Tracking -0.025em / Tight</div>
              </div>
              <div className="p-3 rounded bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800">
                <div className="text-[10px] text-neutral-400 uppercase font-sans font-bold">Telemetry Scale</div>
                <div className="text-sm text-neutral-950 dark:text-white font-mono font-bold mt-1">JetBrains Mono 700</div>
                <div className="font-semibold text-neutral-500">Tabular Figures 0-9</div>
              </div>
            </div>
          </div>

          {/* Section 2: Modular Grid System */}
          <div className="p-4 sm:p-5 rounded-lg bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800">
            <div className="flex items-center gap-2 mb-2 text-neutral-950 dark:text-white font-black text-sm uppercase">
              <Grid className="w-4 h-4 text-neutral-950 dark:text-white" />
              <h3>2. Modular 8pt Grid & Spatial Mathematics</h3>
            </div>
            <p className="mb-2 font-medium">
              All container dimensions, gutters, and paddings adhere strictly to an 8-point base unit scale (8px, 16px, 24px, 32px, 48px).
            </p>
            <ul className="list-disc pl-4 space-y-1 font-mono text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">
              <li><strong>Outer vs. Inner Padding:</strong> Container outer padding (≥20px) always equals or exceeds child spacing (8–16px).</li>
              <li><strong>Nested Corner Radius:</strong> <code className="text-neutral-950 dark:text-white font-bold">Inner Radius = Outer Radius - Padding</code> to eliminate visual collision.</li>
              <li><strong>Responsive Grid:</strong> Single-column fluid layout on mobile, transitioning to an unnested 2-column bento modular grid on desktop.</li>
            </ul>
          </div>

          {/* Section 3: Monochromatic Palette */}
          <div className="p-4 sm:p-5 rounded-lg bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800">
            <div className="flex items-center gap-2 mb-2 text-neutral-950 dark:text-white font-black text-sm uppercase">
              <Palette className="w-4 h-4 text-neutral-950 dark:text-white" />
              <h3>3. Focused Monochromatic Palette & Contrast Control</h3>
            </div>
            <p className="mb-3 font-medium">
              Eliminated artificial rainbow gradients and glow shaders. Surfaces rely on calibrated monochromatic neutrals (Slate/Zinc 50–950) with strict WCAG AA contrast (≥4.5:1).
            </p>

            <div className="grid grid-cols-4 gap-2 font-mono text-[10px] text-center">
              <div className="p-2.5 rounded bg-white text-neutral-950 border border-neutral-300 font-bold">
                Surface Base<br/><span className="text-neutral-400 font-normal">#FAFAFA</span>
              </div>
              <div className="p-2.5 rounded bg-neutral-100 text-neutral-900 border border-neutral-300 font-bold">
                Elevated Layer<br/><span className="text-neutral-500 font-normal">#F4F4F5</span>
              </div>
              <div className="p-2.5 rounded bg-neutral-900 text-neutral-100 font-bold">
                Deep Canvas<br/><span className="text-neutral-400 font-normal">#18181B</span>
              </div>
              <div className="p-2.5 rounded bg-neutral-950 text-white font-bold">
                Ink High Contrast<br/><span className="text-neutral-400 font-normal">#09090B</span>
              </div>
            </div>
          </div>

          {/* Section 4: Negative Space & Hierarchy */}
          <div className="p-4 sm:p-5 rounded-lg bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800">
            <div className="flex items-center gap-2 mb-2 text-neutral-950 dark:text-white font-black text-sm uppercase">
              <Eye className="w-4 h-4 text-neutral-950 dark:text-white" />
              <h3>4. Anti-Slop Discipline & Negative Space</h3>
            </div>
            <ul className="space-y-2 font-medium">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>No Nested Containers:</strong> Cards inside cards are strictly prohibited; hierarchy is built using subtle hair-line borders (<code className="text-[11px] font-mono font-bold">1px solid</code>) and clean typographic scale.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Zero Tacky Gimmicks:</strong> Banned glowing drop shadows, cyan-on-dark text, and arbitrary neon borders.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Single-Line Atomic Badges:</strong> Labels, chips, and telemetry metadata never wrap or truncate awkwardly inside pills.</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-black font-mono uppercase tracking-wider hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-xs"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
