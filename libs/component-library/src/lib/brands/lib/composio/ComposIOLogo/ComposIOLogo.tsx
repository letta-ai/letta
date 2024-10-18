import ComposeIOLogoSVG from './composio.svg';
import Image from 'next/image';

interface ComposeIOLogoProps {
  className?: string;
}

export function ComposIOLogo(props: ComposeIOLogoProps) {
  const { className } = props;

  return (
    <Image className={className} src={ComposeIOLogoSVG} alt="ComposeIO logo" />
  );
}
