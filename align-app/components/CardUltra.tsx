"use client";

import { handleDetailsRequest } from "@/utils/handleDetailsRequest";

interface CardUltraProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export function CardUltra({ title, children, className = "" }: CardUltraProps) {
  return (
    <div className={`rounded-xl border border-dark-600 bg-dark-800/50 p-4 ${className}`}>
      {children}
      <button
        type="button"
        className="cu-details mt-3 px-4 py-2 rounded-lg bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 font-medium text-sm transition"
        onClick={() => handleDetailsRequest(title)}
      >
        Detalii la cerere
      </button>
    </div>
  );
}
