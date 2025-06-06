'use client';
import * as React from 'react';
import { default as JSONPretty } from 'react-json-pretty';
import './JSONViewer.scss';

interface JSONViewerProps {
  data: Record<string, any>;
}

export function JSONViewer(props: JSONViewerProps) {
  const { data } = props;

  return <JSONPretty data={data} />;
}
