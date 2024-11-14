import DiscordWhiteLogoSvg from './discord-mark-white.png';
import DiscordBlackLogoSvg from './discord-mark-black.svg';
import Image from 'next/image';

interface OpenAILogoProps {
  className?: string;
}

export function DiscordWhiteLogo(props: OpenAILogoProps) {
  const { className } = props;

  return (
    <Image className={className} src={DiscordWhiteLogoSvg} alt="Discord logo" />
  );
}

export function DiscordBlackLogo(props: OpenAILogoProps) {
  const { className } = props;

  return (
    <Image className={className} src={DiscordBlackLogoSvg} alt="Discord logo" />
  );
}
