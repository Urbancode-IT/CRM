import { BRAND_COLOR } from '../constants/brand';

export default function BrandMark({ className = 'h-9 w-9', color = BRAND_COLOR[600] }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect x="4" y="4" width="32" height="32" rx="8" fill={color} style={{ fill: color }} />
      <path
        d="M13 13.5c0-1.2.9-2.1 2.1-2.1h9.8c1.2 0 2.1.9 2.1 2.1V20c0 4.3-3.1 7.5-7.1 7.5S13 24.3 13 20v-6.5zm3.4 1.2V20c0 2.4 1.6 4.1 3.6 4.1s3.6-1.7 3.6-4.1v-5.3H16.4z"
        fill="#fff"
      />
    </svg>
  );
}
