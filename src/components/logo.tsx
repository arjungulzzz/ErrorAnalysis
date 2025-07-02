import Image from 'next/image';
import * as React from 'react';

const Logo = ({ src, ...props }: { src: string, className?: string }) => (
  <Image
    src={src}
    alt="Application Logo"
    width={40}
    height={40}
    {...props}
  />
);

export default Logo;
