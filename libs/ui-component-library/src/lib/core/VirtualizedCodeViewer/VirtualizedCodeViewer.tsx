'use client';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { AutoSizer } from 'react-virtualized';

interface VirtualizedCodeViewerProps {
  content: string;
  fontSize: 'default' | 'small';
}

const fontSizeMap = {
  small: '0.875rem',
  default: '1rem',
};
const lineHeightMap = {
  small: '1.25rem',
  default: '1.5rem',
};

export function VirtualizedCodeViewer(props: VirtualizedCodeViewerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { content, fontSize } = props;
  const [pageWidth, setPageWidth] = useState(0);
  const [characterWidth, setCharacterWidth] = useState(0);

  useEffect(() => {
    // get the current font-family from document
    const computedStyle = window.getComputedStyle(document.body);

    const fontFamily = computedStyle.fontFamily;

    // first create a canvas element
    const canvas = document.createElement('canvas');

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const outSize = fontSizeMap[fontSize];

    // set the font size
    context.font = `${outSize} ${fontFamily}`;

    // measure the width of a single character
    const character = 'A';

    setCharacterWidth(context.measureText(character).width);
  }, [fontSize]);

  useEffect(() => {
    function handleResize() {
      if (ref.current) {
        setPageWidth(ref.current.clientWidth);
      }
    }

    window.addEventListener('resize', handleResize);

    // initial width
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const numberOfCharacters = useMemo(() => {
    return Math.floor(pageWidth / characterWidth);
  }, [pageWidth, characterWidth]);

  console.log(characterWidth);

  const numberOfLines = useMemo(() => {
    return Math.ceil(content.length / numberOfCharacters);
  }, [content, numberOfCharacters]);

  const lines = useMemo(() => {
    const linesArray: string[] = [];
    for (let i = 0; i < numberOfLines; i++) {
      const res = content.slice(
        i * numberOfCharacters,
        (i + 1) * numberOfCharacters,
      );
      linesArray.push(res);
    }
    return linesArray;
  }, [content, numberOfLines, numberOfCharacters]);

  return (
    <div className="w-full h-full" ref={ref}>
      <AutoSizer>
        {({ width, height }) => (
          <List
            width={width}
            height={height}
            itemCount={lines.length}
            itemSize={lineHeightMap[fontSize] === '1.5rem' ? 24 : 20}
          >
            {({ index, style }) => (
              <div
                key={index}
                className="font-mono"
                style={{
                  ...style,
                  fontSize: fontSizeMap[fontSize],
                  lineHeight: lineHeightMap[fontSize],
                }}
              >
                {lines[index]}
              </div>
            )}
          </List>
        )}
      </AutoSizer>
    </div>
  );
}
