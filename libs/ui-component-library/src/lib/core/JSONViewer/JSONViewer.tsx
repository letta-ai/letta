'use client';
import * as React from 'react';
import { default as JSONPretty } from 'react-json-pretty';
import './JSONViewer.scss';

interface JSONViewerProps {
  noWrap?: boolean;
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONViewer accepts any JSON-serializable data
}

export function JSONViewer(props: JSONViewerProps) {
  const { data, noWrap } = props;

  return <JSONPretty className={noWrap ? 'json-pretty-nowrap' : ''} data={data} />;
}
