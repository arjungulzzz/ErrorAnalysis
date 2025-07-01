import * as React from 'react';

const Logo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g fill="none" strokeWidth="4">
      <ellipse cx="35" cy="50" rx="30" ry="48" stroke="#582D83" />
      <ellipse cx="40" cy="50" rx="30" ry="48" stroke="#75308A" />
      <ellipse cx="45" cy="50" rx="30" ry="48" stroke="#933491" />
      <ellipse cx="50" cy="50" rx="30" ry="48" stroke="#B03898" />
      <ellipse cx="55" cy="50" rx="30" ry="48" stroke="#D34494" />
      <ellipse cx="60" cy="50" rx="30" ry="48" stroke="#E96684" />
      <ellipse cx="65" cy="50" rx="30" ry="48" stroke="#F58575" />
    </g>
  </svg>
);

export default Logo;
