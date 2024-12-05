import * as React from 'react';
import type {
  ImageProps,
  StaticImport,
} from 'next/dist/shared/lib/get-img-props';
import Image from 'next/image';
import { useCallback } from 'react';

interface FadeInImageProps extends ImageProps {
  src: StaticImport | string;
  alt: string;
}

export function FadeInImage(props: FadeInImageProps) {
  const { src, alt } = props;
  const [isLoaded, setIsLoaded] = React.useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      onLoad={handleLoad}
      className={`transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
