import * as React from 'react';

const Logo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g fill="none" strokeWidth="4">
      <path d="M 53.6 20 A 25 45 0 1 0 53.6 80" stroke="#582D83" />
      <path d="M 58.6 20 A 25 45 0 1 0 58.6 80" stroke="#75308A" />
      <path d="M 63.6 20 A 25 45 0 1 0 63.6 80" stroke="#933491" />
      <path d="M 68.6 20 A 25 45 0 1 0 68.6 80" stroke="#B03898" />
      <path d="M 73.6 20 A 25 45 0 1 0 73.6 80" stroke="#D34494" />
      <path d="M 78.6 20 A 25 45 0 1 0 78.6 80" stroke="#E96684" />
      <path d="M 83.6 20 A 25 45 0 1 0 83.6 80" stroke="#F58575" />
    </g>
  </svg>
);

export default Logo;
