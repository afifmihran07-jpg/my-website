import React from 'react';
import { X, Ruler } from 'lucide-react';
import { HssStarIcon } from './HssLogo';
import { DatabaseService } from '../services/dataService';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SizeGuideModal: React.FC<SizeGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const content = DatabaseService.getSiteContent(false);
  const sg = content.sizeGuide;

  const sizeTable = [
    { size: 'S', chest: '44"', length: '27.5"', shoulder: '21.5"', sleeve: '23"' },
    { size: 'M', chest: '46"', length: '28.5"', shoulder: '22.5"', sleeve: '24"' },
    { size: 'L', chest: '48"', length: '29.5"', shoulder: '23.5"', sleeve: '25"' },
    { size: 'XL', chest: '50"', length: '30.5"', shoulder: '24.5"', sleeve: '25.5"' },
    { size: 'XXL', chest: '52"', length: '31.5"', shoulder: '25.5"', sleeve: '26"' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl bg-neutral-950 border border-neutral-800 p-6 sm:p-8 space-y-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-900">
          <div className="flex items-center gap-2 text-white">
            <Ruler className="w-5 h-5 text-[#e11d48]" />
            <h3 className="font-display font-black text-lg uppercase tracking-tight">
              {sg.title || 'STREETWEAR SIZE ARCHITECTURE'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white p-1 transition-colors font-mono"
            aria-label="Close size guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Brand note */}
        <div className="p-3 bg-neutral-900/60 border border-neutral-800 text-xs font-mono text-neutral-300 flex items-start gap-2.5">
          <HssStarIcon className="w-4 h-4 text-[#e11d48] flex-shrink-0 mt-0.5" />
          <p>
            {sg.instructions ||
              'All garments cut in our signature boxy, drop-shoulder silhouette. Measurements in inches (inches). Take your standard size for an editorial oversized fit.'}
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs font-mono">
            <thead className="bg-neutral-900 text-neutral-400 uppercase">
              <tr>
                <th className="p-2.5 text-left">SIZE</th>
                <th className="p-2.5">CHEST</th>
                <th className="p-2.5">BODY LENGTH</th>
                <th className="p-2.5">SHOULDER</th>
                <th className="p-2.5">SLEEVE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {sizeTable.map(row => (
                <tr key={row.size} className="hover:bg-neutral-900/40">
                  <td className="p-2.5 text-left font-bold text-white font-tech">{row.size}</td>
                  <td className="p-2.5 text-neutral-300">{row.chest}</td>
                  <td className="p-2.5 text-neutral-300">{row.length}</td>
                  <td className="p-2.5 text-neutral-300">{row.shoulder}</td>
                  <td className="p-2.5 text-neutral-300">{row.sleeve}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Model Reference & Care Instructions */}
        <div className="space-y-2 pt-2 border-t border-neutral-900 text-xs font-sans text-neutral-400">
          <p>
            <strong className="text-white">Editorial Fit Guide:</strong>{' '}
            {sg.fitNote || 'Model is 6\'0" (183cm) wearing Size L for an oversized drape. For female wearers, size down by one size for a relaxed boyfriend fit.'}
          </p>
          <p>
            <strong className="text-white">Fabric Care:</strong>{' '}
            {sg.careNote || 'Machine wash cold with similar darks. Turn garment inside out to protect high-density prints. Lay flat or air dry. Do not iron directly onto printed graphics.'}
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-neutral-900 hover:bg-[#e11d48] text-white font-tech font-bold text-xs uppercase tracking-widest transition-colors"
        >
          CONFIRM & CLOSE
        </button>
      </div>
    </div>
  );
};
