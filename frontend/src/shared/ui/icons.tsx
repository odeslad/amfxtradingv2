interface IconProps {
  size?: number;
  color?: string;
}

export function IconChart({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="1,12 5,7 8,10 11,4 15,4" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <line x1="1" y1="14" x2="15" y2="14" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

export function IconBacktest({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="3" width="14" height="10" rx="0" stroke={color} strokeWidth="1.2" />
      <line x1="1" y1="7" x2="15" y2="7" stroke={color} strokeWidth="1.2" />
      <line x1="5" y1="3" x2="5" y2="13" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

export function IconEngine({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.2" />
      <line x1="8" y1="1" x2="8" y2="4" stroke={color} strokeWidth="1.2" />
      <line x1="8" y1="12" x2="8" y2="15" stroke={color} strokeWidth="1.2" />
      <line x1="1" y1="8" x2="4" y2="8" stroke={color} strokeWidth="1.2" />
      <line x1="12" y1="8" x2="15" y2="8" stroke={color} strokeWidth="1.2" />
      <line x1="2.93" y1="2.93" x2="4.93" y2="4.93" stroke={color} strokeWidth="1.2" />
      <line x1="11.07" y1="11.07" x2="13.07" y2="13.07" stroke={color} strokeWidth="1.2" />
      <line x1="13.07" y1="2.93" x2="11.07" y2="4.93" stroke={color} strokeWidth="1.2" />
      <line x1="4.93" y1="11.07" x2="2.93" y2="13.07" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

export function IconSignOut({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke={color} strokeWidth="1.2" strokeLinecap="square" />
      <polyline points="10,5 13,8 10,11" stroke={color} strokeWidth="1.2" strokeLinecap="square" strokeLinejoin="miter" />
      <line x1="13" y1="8" x2="6" y2="8" stroke={color} strokeWidth="1.2" strokeLinecap="square" />
    </svg>
  );
}

export function IconSettings({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="2" y1="4" x2="14" y2="4" stroke={color} strokeWidth="1.2" />
      <line x1="2" y1="8" x2="14" y2="8" stroke={color} strokeWidth="1.2" />
      <line x1="2" y1="12" x2="14" y2="12" stroke={color} strokeWidth="1.2" />
      <circle cx="5" cy="4" r="1.5" fill={color} />
      <circle cx="10" cy="8" r="1.5" fill={color} />
      <circle cx="5" cy="12" r="1.5" fill={color} />
    </svg>
  );
}

export function IconIndicators({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="1" y1="14" x2="15" y2="14" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="3" y1="14" x2="3" y2="6" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7" y1="14" x2="7" y2="2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="11" y1="14" x2="11" y2="8" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconJournal({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="1" width="10" height="14" rx="0" stroke={color} strokeWidth="1.2" />
      <line x1="5" y1="5" x2="9" y2="5" stroke={color} strokeWidth="1.2" />
      <line x1="5" y1="8" x2="9" y2="8" stroke={color} strokeWidth="1.2" />
      <line x1="5" y1="11" x2="7" y2="11" stroke={color} strokeWidth="1.2" />
      <line x1="2" y1="1" x2="2" y2="15" stroke={color} strokeWidth="2.5" strokeLinecap="square" />
    </svg>
  );
}
