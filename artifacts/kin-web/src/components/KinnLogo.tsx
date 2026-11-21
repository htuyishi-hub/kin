import React from 'react';

type Props = {
  size?: number;
  pulse?: boolean;
  className?: string;
};

export function KinnLogo({ size = 36, pulse = false, className = '' }: Props) {
  return (
    <div
      className={`inline-flex items-center justify-center ${pulse ? 'animate-pulse' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/logo_mark_transparent.png"
        alt="Kinn Logo"
        className="w-full h-full object-contain select-none pointer-events-none"
      />
    </div>
  );
}

export const KLogo = KinnLogo;
export default KinnLogo;
