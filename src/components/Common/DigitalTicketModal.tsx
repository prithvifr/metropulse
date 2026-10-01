import React, { useState } from 'react';
import { DigitalTicket } from '../../types';
import { X, Bus, CheckCircle2, Check } from 'lucide-react';

interface DigitalTicketModalProps {
  ticket: DigitalTicket | null;
  onClose: () => void;
  onValidatePass?: (ticketId: string) => void;
}

export const DigitalTicketModal: React.FC<DigitalTicketModalProps> = ({ ticket, onClose, onValidatePass }) => {
  const [isValidated, setIsValidated] = useState(false);

  if (!ticket) return null;

  const handleValidate = () => {
    setIsValidated(true);
    if (onValidatePass) onValidatePass(ticket.ticketId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Pass Header */}
        <div className="p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-[10px] uppercase font-bold tracking-widest text-blue-200">
            MetroPulse Transit Authority • E-Pass
          </div>
          <h3 className="text-xl font-black mt-1">{ticket.routeName}</h3>
          <div className="flex items-center justify-between text-xs mt-3 text-blue-100">
            <span>Pass ID: <b className="font-mono text-white">{ticket.ticketId}</b></span>
            <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full font-bold text-white uppercase text-[10px]">
              {isValidated ? 'Boarded' : ticket.status}
            </span>
          </div>
        </div>

        {/* Journey Details */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Origin Stop</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{ticket.fromStop}</div>
            </div>
            <div className="text-xl text-blue-500">→</div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Destination</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{ticket.toStop}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 py-3 border-y border-dashed border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Passenger</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{ticket.passengerName}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Fare Paid</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">${ticket.fare.toFixed(2)} USD</span>
            </div>
          </div>

          {/* QR Code Presentation */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
            {/* SVG Visual QR Code Pattern */}
            <div className="w-36 h-36 bg-white p-2.5 rounded-xl shadow-inner border border-slate-200 flex flex-col items-center justify-center relative">
              <div className="w-full h-full grid grid-cols-6 grid-rows-6 gap-1 p-1 bg-slate-100 rounded">
                <div className="col-span-2 row-span-2 bg-slate-900 rounded-sm"></div>
                <div className="col-span-2 bg-slate-900 rounded-sm"></div>
                <div className="col-span-2 row-span-2 bg-slate-900 rounded-sm"></div>
                <div className="bg-slate-900 rounded-sm"></div>
                <div className="bg-slate-900 rounded-sm"></div>
                <div className="bg-slate-900 rounded-sm"></div>
                <div className="bg-slate-900 rounded-sm"></div>
                <div className="col-span-2 row-span-2 bg-slate-900 rounded-sm"></div>
                <div className="bg-slate-900 rounded-sm"></div>
                <div className="bg-slate-900 rounded-sm"></div>
                <div className="col-span-2 bg-slate-900 rounded-sm"></div>
                <div className="bg-slate-900 rounded-sm"></div>
                <div className="col-span-2 bg-slate-900 rounded-sm"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-xs bg-white px-1.5 py-0.5 font-bold text-blue-600 shadow-sm border border-slate-200 rounded flex items-center gap-1">
                  <Bus className="w-3 h-3" /> MP
                </span>
              </div>
            </div>
            <div className="mt-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 text-center">
              Scan at Bus Fare Validator on boarding
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {!isValidated ? (
              <button
                onClick={handleValidate}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simulate Conductor Scan / Board Bus</span>
              </button>
            ) : (
              <div className="w-full py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-center rounded-xl font-bold text-xs border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>Validated for Ride • Enjoy your journey!</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
