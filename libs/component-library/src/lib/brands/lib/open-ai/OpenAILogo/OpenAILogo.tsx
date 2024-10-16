import OpenAILogoSvg from './openai-logo.svg';
import Image from 'next/image';

interface OpenAILogoProps {
  className?: string;
}

export function OpenAILogo(props: OpenAILogoProps) {
  const { className } = props;

  return <Image className={className} src={OpenAILogoSvg} alt="OpenAI logo" />;
}
