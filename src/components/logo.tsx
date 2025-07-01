import * as React from 'react';

const Logo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g fill="none" strokeWidth="4">
      {/* The paths below are arcs of ellipses to create the 'C' shape of the logo */}
      <path d="M 56.21 83.94 A 30 48 0 1 1 56.21 16.06" stroke="#582D83" />
      <path d="M 61.21 83.94 A 30 48 0 1 1 61.21 16.06" stroke="#75308A" />
      <path d="M 66.21 83.94 A 30 48 0 1 1 66.21 16.06" stroke="#933491" />
      <path d="M 71.21 83.94 A 30 48 0 1 1 71.21 16.06" stroke="#B03898" />
      <path d="M 76.21 83.94 A 30 48 0 1 1 76.21 16.06" stroke="#D34494" />
      <path d="M 81.21 83.94 A 30 48 0 1 1 81.21 16.06" stroke="#E96684" />
      <path d="M 86.21 83.94 A 30 48 0 1 1 86.21 16.06" stroke="#F58575" />
    </g>
  </svg>
);

export default Logo;
