import * as React from 'react';

const Logo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g>
      <ellipse fill="#582D83" cx="45" cy="50" rx="20" ry="40" />
      <ellipse fill="#75308A" cx="50" cy="50" rx="20" ry="40" />
      <ellipse fill="#933491" cx="55" cy="50" rx="20" ry="40" />
      <ellipse fill="#B03898" cx="60" cy="50" rx="20" ry="40" />
      <ellipse fill="#D34494" cx="65" cy="50" rx="20" ry="40" />
      <ellipse fill="#E96684" cx="70" cy="50" rx="20" ry="40" />
      <ellipse fill="#F58575" cx="75" cy="50" rx="20" ry="40" />
    </g>
  </svg>
);

export default Logo;
