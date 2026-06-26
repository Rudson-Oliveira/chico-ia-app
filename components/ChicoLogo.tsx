import React from 'react';

interface ChicoLogoProps {
  className?: string;
}

const ChicoLogo: React.FC<ChicoLogoProps> = ({ className = "" }) => (
  <div className={`text-4xl font-extrabold ${className}`}>
    <span className="text-[var(--text-primary)]">Chico</span>
  </div>
);

export default ChicoLogo;
