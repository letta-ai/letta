import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import type { LettaLoaderProps } from '../../core/LettaLoader/LettaLoader';
import { LettaLoader } from '../../core/LettaLoader/LettaLoader';
import { useMemo } from 'react';
import type { LogoBaseProps } from '../../marketing/Logo/Logo';
import { cn } from '@letta-cloud/ui-styles';

interface LoadingEmptyStatusComponentProps {
  loadingMessage?: string[] | string;
  emptyMessage?: React.ReactNode;
  emptyAction?: React.ReactNode;
  errorMessage?: string;
  errorAction?: React.ReactNode;
  loaderVariant?: LettaLoaderProps['variant'];
  loaderFillColor?: string;
  noMinHeight?: boolean;
  className?: string;
  hideText?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  iconOverride?: React.ReactNode;
}

interface ManyMessagesVerticalComponentProps {
  messages: string[];
}

const loadingStrings = [
  'Adding Hidden Agendas',
  'Adjusting Bell Curves',
  'Aesthesizing Industrial Areas',
  'Aligning Covariance Matrices',
  'Applying Feng Shui Shaders',
  'Applying Theatre Soda Layer',
  'Asserting Packed Exemplars',
  'Attempting to Lock Back-Buffer',
  'Binding Sapling Root System',
  'Breeding Fauna',
  'Building Data Trees',
  'Bureacritizing Bureaucracies',
  'Calculating Inverse Probability',
  'Calculating Llama Expectoration',
  'Calibrating Blue Skies',
  'Charging Ozone Layer',
  'Chopping Wooders',
  'Coalescing Cloud Formations',
  'Cohorting Exemplars',
  'Collecting Meteor Particles',
  'Compounding Inert Tessellations',
  'Compressing Fish Files',
  'Computing Optimal Bin Packing',
  'Concatenating Sub-Contractors',
  'Containing Existential Buffer',
  'Debarking Ark Ramp',
  'Debunching Unionized Commercials',
  'Deciding What Message to Display Next',
  'Decomposing Singular Values',
  'Decrementing Tectonic Plates',
  'Deleting Ferry Routes',
  'Depixelating Inner Mountain',
  'Depositing Slush Funds',
  'Destabilizing Economic Indicators',
  'Determining Width of Blast Fronts',
  'Deunionizing Bulldozers',
  'Dicing Models',
  'Diluting Livestock Nutrition Variables',
  'Downloading Satellite Terrain Data',
  "Erecting Tomorrow's Cognition Machines",
  'Exposing Flash Variables to Streak System',
  'Extracting Resources',
  'Factoring Pay Scale',
  'Fixing Election Outcome Matrix',
  'Flood-Filling Ground Water',
  'Flushing Pipe Network',
  'Frontiers of Agnostic Autonomous Intelligence',
  'Gathering Particle Sources',
  'Generating Jobs',
  'Gesticulating Mimes',
  'Graphing Whale Migration',
  'Hiding Willio Webnet Mask',
  'Implementing Impeachment Routine',
  'Increasing Magmafacation',
  'Initializing Robotic Click-Path AI',
  'Inserting Sublimated Messages',
  'Integrating Curves',
  'Integrating Illumination Form Factors',
  'Integrating Population Graphs',
  'Iterating Cellular Automata',
  'Lecturing Errant Subsystems',
  'Mixing Genetic Pool',
  'Modeling Object Components',
  'Mopping Occupant Leaks',
  'Normalizing Power',
  'Obfuscating Quigley Matrix',
  'Overconstraining Dirty Industry Calculations',
  'Packaging Packers',
  'Partitioning City Grid Singularities',
  'Perturbing Matrices',
  'Polishing Water Highlights',
  'Populating Lot Templates',
  'Preparing Sprites for Random Walks',
  'Prioritizing Landmarks',
  'Projecting Law Enforcement Pastry Intake',
  'Realigning Alternate Time Frames',
  'Reconfiguring User Mental Processes',
  'Relaxing Splines',
  'Removing Road Network Speed Bumps',
  'Removing Texture Gradients',
  'Removing Vehicle Avoidance Behavior',
  'Resolving GUID Conflict',
  'Reticulating Splines',
  'Retracting Phong Shader',
  'Retrieving from Back Store',
  'Reverse Engineering Image Consultant',
  'Routing Neural Network Infrastructure',
  'Scrubbing Terrain',
  'Searching for Llamas',
  'Seeding Architecture Simulation Parameters',
  'Sequencing Particles',
  'Setting Advisor Moods',
  'Setting Inner Deity Indicators',
  'Setting Universal Physical Constants',
  'Sonically Enhancing Occupant-Free Timber',
  'Speculating Stock Market Indices',
  'Splatting Transforms',
  'Stratifying Ground Layers',
  'Sub-Sampling Water Data',
  'Synthesizing Gravity',
  'Synthesizing Wavelets',
  'Time-Compressing Simulator Clock',
  'Translating Jin Dynasty Scrolls',
  'Unable to Reveal Current Activity',
  'Weathering Buildings',
  'Yelling Timber!!!'
];

function ManyMessagesVerticalComponent(
  props: ManyMessagesVerticalComponentProps,
) {
  const { messages } = props;

  // messages should be a vertical stack of messages
  // it should only show one message at a time, it should transition between messages via translation
  // to accomplish this create a max-height container with overflow hidden
  // then have a state that tracks the current message index
  // then every 1.5s change the current message index

  // Seed index before paint to avoid animating 0 -> seed on refresh/hydration
  const [messageIndex, setMessageIndex] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const seededRef = React.useRef(false);

  React.useLayoutEffect(() => {
    if (!seededRef.current && messages.length > 0) {
      seededRef.current = true;
      setMessageIndex(Math.floor(Math.random() * messages.length));
    }
  }, [messages.length]);

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {setMounted(true)});
    return () => {cancelAnimationFrame(raf)};
  }, []);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prevIndex) => {
        if (messages.length <= 1) return prevIndex;
        const direction = Math.random() < 0.5 ? -1 : 1;
        const magnitude = Math.floor(Math.random() * 5) + 1;
        const delta = direction * magnitude;
        return Math.abs((prevIndex + delta) % messages.length);
      });
    }, 1500);

    return () => {
      clearInterval(interval);
    };
  }, [messages.length]);

  return (
    <VStack
      fullHeight
      fullWidth
      className="max-h-[25px] h-[25px] w-[350px] relative leading-[25px] overflow-hidden transition-all duration-500"
      align="center"
      justify="center"
      style={{
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
        maskImage:
          'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
      }}
    >
      <div
        className={cn(mounted && 'transition-transform duration-500 ease-in-out', 'absolute top-0')}
        style={{
          transform: `translateY(-${messageIndex * 25}px)`,
        }}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className="leading-[25px] text-sm text-lighter whitespace-pre overflow-ellipsis text-center"
          >
            {message}
          </div>
        ))}
      </div>
    </VStack>
  );
}

interface MessageRenderAreaProps {
  messages: React.ReactNode | string[];
}

function MessageRenderArea(props: MessageRenderAreaProps) {
  const { messages } = props;

  if (Array.isArray(messages)) {
    return <ManyMessagesVerticalComponent messages={messages} />;
  }

  return (
    <div
      style={{ whiteSpace: 'normal' }}
      className="max-w-[400px] text-sm text-lighter whitespace-normal	text-wrap text-center"
    >
      {messages}
    </div>
  );
}

export function LoadingEmptyStatusComponent(
  props: LoadingEmptyStatusComponentProps,
) {
  const {
    emptyMessage,
    isError,
    errorMessage,
    noMinHeight,
    errorAction,
    loaderVariant = 'spinner',
    hideText,
    loadingMessage,
    loaderFillColor,
    isLoading,
    className,
    emptyAction,
    iconOverride,
  } = props;

  const message: React.ReactNode | string[] = useMemo(() => {
    if (isLoading) {
      return loadingMessage;
    }

    if (isError) {
      return errorMessage || 'An error occurred, please contact support.';
    }

    if (emptyMessage) {
      return emptyMessage;
    }

    return;
  }, [isLoading, isError, emptyMessage, loadingMessage, errorMessage]);

  const action = useMemo(() => {
    if (isLoading) {
      return null;
    }

    if (isError) {
      return errorAction;
    }

    if (emptyAction) {
      return emptyAction;
    }

    return;
  }, [emptyAction, errorAction, isError, isLoading]);

  const stateColor: LogoBaseProps['color'] = useMemo(() => {
    if (isLoading) {
      return 'inherit';
    }

    if (isError) {
      return 'error';
    }

    return 'inherit';
  }, [isError, isLoading]);

  return (
    <VStack
      fullHeight
      fullWidth
      className={cn(noMinHeight ? '' : 'min-h-[400px]', className)}
      align="center"
      justify="center"
    >
      <VStack
        gap={loaderVariant === 'spinner' ? false : 'xlarge'}
        className="relative mt-[-50px] "
        align="center"
        justify="center"
      >
        {iconOverride ? (
          <VStack paddingBottom="medium">{iconOverride}</VStack>
        ) : (
          <LettaLoader
            fillColor={loaderFillColor}
            variant={loaderVariant}
            stopAnimation={!isLoading}
            color={stateColor}
            size="large"
          />
        )}
        {!hideText && (
          <MessageRenderArea messages={message || loadingStrings} />
        )}
        <div className="absolute top-[100%] mt-4">{action}</div>
      </VStack>
    </VStack>
  );
}
