"use client";

import { useId } from "react";

/** Siluete abstracte cuplu — integrare artistică, zero fotografii. */

export function CoupleIllustrationPulse({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 240 200"
      className={`h-full max-h-[200px] w-auto min-w-[100px] max-w-[45%] shrink-0 sm:min-w-[120px] md:max-w-[40%] ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-skin`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="50%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fce7f3" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fbcfe8" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id={`${id}-h`} cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fda4af" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-g`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse cx="120" cy="88" rx="72" ry="56" fill={`url(#${id}-h)`} opacity="0.6" />
      {/* Figuri fluide, îmbrățișare */}
      <path
        fill={`url(#${id}-skin)`}
        opacity="0.92"
        filter={`url(#${id}-g)`}
        d="M52 178c-8 0-14-6-12-22 4-42 28-58 48-62 14-3 28 4 32 22 3 14-1 28-12 38l-6 24H52z"
      />
      <ellipse cx="68" cy="48" rx="22" ry="24" fill={`url(#${id}-shine)`} />
      <path
        fill={`url(#${id}-skin)`}
        opacity="0.85"
        filter={`url(#${id}-g)`}
        d="M188 178c8 0 14-6 12-22-4-42-28-58-48-62-14-3-28 4-32 22-3 14 1 28 12 38l6 24h60z"
      />
      <ellipse cx="172" cy="48" rx="22" ry="24" fill={`url(#${id}-shine)`} opacity="0.95" />
      <path
        d="M78 72 Q120 48 162 72 Q120 92 78 72"
        fill="none"
        stroke="#fdf2f8"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M95 95 Q120 78 145 95"
        fill="none"
        stroke="#fce7f3"
        strokeWidth="1.5"
        opacity="0.4"
      />
    </svg>
  );
}

export function CoupleIllustrationFlash({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 240 200"
      className={`h-full max-h-[200px] w-auto min-w-[100px] max-w-[45%] shrink-0 sm:min-w-[120px] md:max-w-[40%] ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-e`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff3366" />
          <stop offset="50%" stopColor="#ff6b4a" />
          <stop offset="100%" stopColor="#ff9100" />
        </linearGradient>
        <linearGradient id={`${id}-core`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffe4e6" stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id={`${id}-flare`} cx="50%" cy="45%" r="40%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff6b4a" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="120" cy="82" r="48" fill={`url(#${id}-flare)`} className="animate-diebelFlare motion-reduce:animate-none" />
      {/* Linii energie */}
      <g opacity="0.35" stroke="white" strokeWidth="1.2" className="motion-reduce:hidden">
        <line x1="0" y1="160" x2="100" y2="20" />
        <line x1="40" y1="200" x2="140" y2="40" />
        <line x1="200" y1="0" x2="240" y2="80" />
      </g>
      <path
        fill={`url(#${id}-e)`}
        filter={`url(#${id}-glow)`}
        d="M48 178V88l18-12 10-36c3-12 18-14 26-6l8 42 14 10v92H48z"
        opacity="0.95"
      />
      <path
        fill={`url(#${id}-e)`}
        filter={`url(#${id}-glow)`}
        d="M192 178V88l-18-12-10-36c-3-12-18-14-26-6l-8 42-14 10v92h76z"
        opacity="0.9"
      />
      <polygon points="62,32 72,18 86,22 90,36 78,46 58,42" fill={`url(#${id}-core)`} />
      <polygon points="178,32 168,18 154,22 150,36 162,46 182,42" fill={`url(#${id}-core)`} opacity="0.9" />
      <path
        d="M88 78 L120 62 L152 78"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export function CoupleIllustrationNeon({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 240 200"
      className={`h-full max-h-[200px] w-auto min-w-[100px] max-w-[45%] shrink-0 sm:min-w-[120px] md:max-w-[40%] ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-n`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#e879f9" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <filter id={`${id}-neon`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill="none" stroke={`url(#${id}-n)`} strokeWidth="3" strokeLinejoin="round" filter={`url(#${id}-neon)`}>
        <path d="M58,172,V78,c0,-10,8,-18,18,-18,h6,c12,0,18,8,18,18,v94" opacity="0.95" />
        <circle cx="80" cy="44" r="16" />
        <path d="M182,172,V78,c0,-10,-8,-18,-18,-18,h-6,c-12,0,-18,8,-18,18,v94" opacity="0.95" />
        <circle cx="160" cy="44" r="16" />
        <path d="M96,88,Q120,68,144,88" strokeWidth="2.5" opacity="0.85" />
      </g>
      <circle cx="120" cy="96" r="6" fill="#22d3ee" opacity="0.5" className="motion-reduce:animate-none animate-diebelParticles" />
      <circle cx="108" cy="108" r="3" fill="#e879f9" opacity="0.45" className="motion-reduce:animate-none animate-diebelParticles" style={{ animationDelay: "0.4s" }} />
      <circle cx="134" cy="104" r="2.5" fill="#a855f7" opacity="0.4" className="motion-reduce:animate-none animate-diebelParticles" style={{ animationDelay: "0.8s" }} />
    </svg>
  );
}
