"use client";

import Image from 'next/image';
import * as React from 'react';
import { useState, useEffect } from 'react';

const Logo = ({ src, fallbackSrc, ...props }: { src: string, fallbackSrc: string, className?: string }) => {
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    setImgSrc(src);
  }, [src]);

  const handleError = () => {
    setImgSrc(fallbackSrc);
  };

  return (
    <Image
      src={imgSrc}
      alt="Application Logo"
      width={40}
      height={40}
      onError={handleError}
      unoptimized={true}
      {...props}
    />
  );
};

export default Logo;
