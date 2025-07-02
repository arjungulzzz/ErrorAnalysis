import Image from 'next/image';
import * as React from 'react';

const Logo = (props: { className?: string }) => (
  <Image
    src="/favicon.ico"
    alt="Application Logo"
    width={40}
    height={40}
    {...props}
  />
);

export default Logo;
