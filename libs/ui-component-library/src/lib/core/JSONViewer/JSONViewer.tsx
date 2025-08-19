'use client';
import * as React from 'react';
import { default as JSONPretty } from 'react-json-pretty';
import './JSONViewer.scss';

interface JSONViewerProps {
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONViewer accepts any JSON-serializable data
}

export function JSONViewer(props: JSONViewerProps) {
  const { data } = props;

  return <JSONPretty data={data} />;
}
