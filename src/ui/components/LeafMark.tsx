/** Marca do GreenLeaf (mesmo desenho do ícone do app). */
export function LeafMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="#1F541A" />
      <g transform="rotate(-40 32 32)">
        <path d="M10 32c8-12 36-12 44 0-8 12-36 12-44 0Z" fill="#7EC86A" />
        <path d="M12 32h38" stroke="#1F541A" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Contorno de folha de mandioca (palmada, 7 lóbulos) usado como guia e ilustração. */
export function CassavaLeafOutline({ className, stroke = 'currentColor', strokeWidth = 3 }: { className?: string; stroke?: string; strokeWidth?: number }) {
  const lobes = [-125, -90 + -52, -90 - 26, -90, -90 + 26, -90 + 52, -55].map((deg, i) => {
    const len = [26, 34, 40, 44, 40, 34, 26][i];
    const w = len * 0.28;
    return (
      <ellipse
        key={i}
        cx={50 + Math.cos((deg * Math.PI) / 180) * len * 0.55}
        cy={62 + Math.sin((deg * Math.PI) / 180) * len * 0.55}
        rx={len * 0.55}
        ry={w / 2}
        transform={`rotate(${deg} ${50 + Math.cos((deg * Math.PI) / 180) * len * 0.55} ${62 + Math.sin((deg * Math.PI) / 180) * len * 0.55})`}
      />
    );
  });
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" aria-hidden="true" focusable="false">
      {lobes}
      <path d="M50 62 C52 75 54 86 56 98" strokeLinecap="round" />
    </svg>
  );
}
