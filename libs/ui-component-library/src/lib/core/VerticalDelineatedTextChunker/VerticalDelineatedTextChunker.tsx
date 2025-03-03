import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { useCallback, useId, useMemo } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { Tooltip } from '../Tooltip/Tooltip';
import { Typography } from '../Typography/Typography';

export interface VerticalBarChartChunk {
  id: string;
  label: string;
  color: string;
  size: number;
  content?: React.ReactNode;
}

interface VerticalBarChartProps {
  chunks: VerticalBarChartChunk[];
  baseId: string;
  selectedChunkId?: string | null;
  setSelectedChunkId: (chunkId: string) => void;
}

function VerticalBarChart(props: VerticalBarChartProps) {
  const { chunks, setSelectedChunkId, selectedChunkId, baseId } = props;

  const onClickBar = useCallback(
    (chunkId: string) => {
      setSelectedChunkId(chunkId);

      const scroll = document.getElementById(`${baseId}-${chunkId}-scroll`);
      if (scroll) {
        scroll.scrollIntoView({ behavior: 'smooth' });
      }
    },
    [baseId, setSelectedChunkId],
  );

  const totalSize = useMemo(() => {
    return chunks.reduce((acc, v) => {
      return v.size + acc;
    }, 0);
  }, [chunks]);

  return (
    <VStack
      padding="xxsmall"
      gap={false}
      className="min-w-[16px] cursor-pointer "
    >
      {chunks.map(({ id, color, size, label }) => {
        return (
          <Tooltip key={id} asChild content={`${label}: ${size}`}>
            <div
              onClick={() => {
                onClickBar(id);
              }}
              style={{
                opacity: !selectedChunkId || selectedChunkId === id ? 1 : 0.5,
                height: `${(size / totalSize) * 100}%`,
                backgroundColor: color,
              }}
            />
          </Tooltip>
        );
      })}
    </VStack>
  );
}

interface TextChunksProps {
  chunks: VerticalBarChartChunk[];
  baseId: string;
  selectedChunkId?: string | null;
  ref?: React.Ref<HTMLDivElement>;
}

function TextChunks(props: TextChunksProps) {
  const { chunks, baseId, ref } = props;
  return (
    <VStack ref={ref} gap={false} fullHeight overflow="auto">
      {chunks.map((c) => {
        if (c.size === 0) {
          return null;
        }

        return (
          <VStack
            borderBottom
            gap={false}
            id={`${baseId}-${c.id}-scroll`}
            className="relative border-l-[2px]"
            key={c.id}
            style={{ borderLeftColor: c.color }}
          >
            <HStack
              align="center"
              borderBottom
              color="background"
              paddingX="small"
              paddingY="xxsmall"
              justify="spaceBetween"
              className="sticky z-[2] flex w-full  top-0"
            >
              <HStack align="center">
                <div className="w-3 h-3" style={{ backgroundColor: c.color }} />
                <Typography bold variant="body2">
                  {c.label}
                </Typography>
              </HStack>
              <Typography color="lighter" variant="body2">
                {c.size} tokens
              </Typography>
            </HStack>
            <div
              style={{ borderColor: c.color }}
              className="relative border-solid p-2"
            >
              <div className="relative z-[1]">{c.content}</div>
            </div>
          </VStack>
        );
      })}
    </VStack>
  );
}

interface VerticalDelineatedTextChunkerProps {
  chunks: VerticalBarChartChunk[];
  fullHeight?: boolean;
  fullWidth?: boolean;
}

export function VerticalDelineatedTextChunker(
  props: VerticalDelineatedTextChunkerProps,
) {
  const { fullHeight, chunks, fullWidth } = props;
  const baseId = useId();
  const [selectedChunkId, setSelectedChunkId] = React.useState<string | null>(
    chunks[0].id,
  );

  const scrollRef = React.useRef<HTMLDivElement>(null);

  // setSelectedChunkId to be the first chunk id that is in the visible area
  React.useEffect(() => {
    const currentRef = scrollRef.current;

    if (currentRef) {
      currentRef.addEventListener('scroll', () => {
        if (!currentRef) {
          return;
        }

        const scrollTop = currentRef.scrollTop;
        const clientHeight = currentRef.clientHeight;
        const scrollBottom = scrollTop + clientHeight;

        const firstChunk = chunks.find((c) => {
          const chunkElement = document.getElementById(
            `${baseId}-${c.id}-scroll`,
          );
          if (!chunkElement) {
            return false;
          }

          const chunkTop = chunkElement.offsetTop;
          const chunkBottom = chunkTop + chunkElement.clientHeight;

          return chunkTop <= scrollBottom && chunkBottom >= scrollTop;
        });

        if (firstChunk) {
          setSelectedChunkId(firstChunk.id);
        }
      });
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', () => {
          return;
        });
      }
    };
  }, [chunks, baseId]);

  return (
    <HStack
      gap={false}
      overflow="hidden"
      className="min-h-[300px]"
      fullHeight={fullHeight}
      fullWidth={fullWidth}
    >
      <VerticalBarChart
        setSelectedChunkId={setSelectedChunkId}
        selectedChunkId={selectedChunkId}
        baseId={baseId}
        chunks={chunks}
      />
      <TextChunks
        ref={scrollRef}
        selectedChunkId={selectedChunkId}
        baseId={baseId}
        chunks={chunks}
      />
    </HStack>
  );
}
