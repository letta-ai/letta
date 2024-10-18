import LangChainLogoSVG from './langchain-logo.svg';
import Image from 'next/image';

interface LangChainLogoProps {
  className?: string;
}

export function LangChainLogo(props: LangChainLogoProps) {
  const { className } = props;

  return (
    <Image className={className} src={LangChainLogoSVG} alt="LangChain logo" />
  );
}
