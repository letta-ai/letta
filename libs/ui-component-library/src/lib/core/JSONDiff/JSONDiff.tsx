import * as React from 'react';
import { Differ, Viewer } from 'json-diff-kit';
import { useMemo } from 'react';

import './JSONDiff.scss';
interface JSONDiffProps {
  currentState: any;
  nextState: any;
  hideUnchangedLines?: boolean;
  showLineNumbers?: boolean;
}

const differ = new Differ({
  detectCircular: true, // default `true`
  maxDepth: Infinity, // default `Infinity`
  showModifications: true, // default `true`
  arrayDiffMethod: 'normal', // default `"normal"`, but `"lcs"` may be more useful
});

export function useJSONDiff(currentState: object, nextState: object) {
  return useMemo(() => {
    return differ.diff(currentState, nextState);
  }, [currentState, nextState]);
}

export function JSONDiff(props: JSONDiffProps) {
  const { currentState, nextState, showLineNumbers, hideUnchangedLines } =
    props;

  const diff = useJSONDiff(currentState, nextState);

  return (
    <div onClick={(e) => e.stopPropagation()} className="contents" >
      <Viewer
        diff={diff}
        indent={4}
        lineNumbers={showLineNumbers}
        hideUnchangedLines={hideUnchangedLines}
        highlightInlineDiff={true}
        inlineDiffOptions={{
          mode: 'word',
          wordSeparator: ' ',
        }}
      />
    </div>
  );
}
