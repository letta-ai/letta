import CrewAIPNG from './crewai.png';
import Image from 'next/image';

interface CrewAILogoProps {
  className?: string;
}

export function CrewAILogo(props: CrewAILogoProps) {
  const { className } = props;

  return <Image className={className} src={CrewAIPNG} alt="ComposeIO logo" />;
}
