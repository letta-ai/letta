import React from 'react';
import './SpinnerPrimitive.scss';

interface SpinnerPrimitiveProps {
  className?: string;
}

export function SpinnerPrimitive(props: SpinnerPrimitiveProps) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <radialGradient
        id="a12"
        cx=".66"
        fx=".66"
        cy=".3125"
        fy=".3125"
        gradientTransform="scale(1.5)"
      >
        <stop offset="0" stopColor="currentColor"></stop>
        <stop offset=".3" stopColor="currentColor"></stop>
        <stop offset=".6" stopColor="currentColor"></stop>
        <stop offset=".8" stopColor="currentColor"></stop>
        <stop offset="1" stopColor="currentColor"></stop>
      </radialGradient>
      <circle
        fill="none"
        stroke="url(#a12)"
        strokeWidth="15"
        strokeLinecap="round"
        strokeDasharray="200 1000"
        strokeDashoffset="0"
        cx="100"
        cy="100"
        r="70"
        // @ts-expect-error - this is a valid attribute
        transformOrigin="center"
      >
        <animateTransform
          type="rotate"
          attributeName="transform"
          calcMode="spline"
          dur="0.75"
          values="360;0"
          keyTimes="0;1"
          keySplines="0 0 1 1"
          repeatCount="indefinite"
        ></animateTransform>
      </circle>
    </svg>
  );
}
