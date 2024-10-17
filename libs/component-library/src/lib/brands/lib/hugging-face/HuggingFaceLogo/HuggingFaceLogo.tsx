import OpenAILogoSvg from './hugging-face-logo.svg';
import Image from 'next/image';

interface OpenAILogoProps {
  className?: string;
}

export function HuggingFaceLogo(props: OpenAILogoProps) {
  const { className } = props;

  return <Image className={className} src={OpenAILogoSvg} alt="OpenAI logo" />;
}
