import React, { useId } from 'react';

type Props = {
  size?: number;
  pulse?: boolean;
  className?: string;
};

export function KinnLogo({ size = 36, pulse = false, className = '' }: Props) {
  const gradId = useId();

  return (
    <div
      className={`inline-flex items-center justify-center ${pulse ? 'animate-pulse' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="-76 -76 152 152"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="kinn"
        className="w-full h-full select-none pointer-events-none"
      >
        <defs>
          <linearGradient id={gradId} x1="-70" y1="0" x2="70" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <path
          d="M -65.73 -50 L -65.73 50"
          stroke={`url(#${gradId})`}
          strokeWidth="9.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M -57.34 38.11 C -51.75 15.38 -39.86 -3.85 -23.08 -17.13"
          stroke={`url(#${gradId})`}
          strokeWidth="9.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M -43.71 11.89 C -34.97 25.87 -26.22 46.50 -12.59 46.50 C -1.75 46.50 2.80 27.62 4.20 3.15 C 4.90 -10.84 17.48 -15.73 33.22 -15.73 C 50.70 -15.73 65.73 -8.04 65.73 10.14 L 65.73 49.30"
          stroke={`url(#${gradId})`}
          strokeWidth="9.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export const KLogo = KinnLogo;
export default KinnLogo;
