import { ImageResponse } from 'next/og';
import { cookies } from 'next/headers';
import { CookieNames } from '$web/server/cookies/types';

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

// Image generation
export default async function Icon() {
  const theme = (await cookies()).get(CookieNames.THEME);

  return new ImageResponse(
    (
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          width="32"
          height="32"
          fill={theme?.value === 'dark' ? '#000' : '#0707AB'}
        />
        <path
          d="M17.8139 14.2003H14.1866V17.8002H17.8139V14.2003Z"
          fill="white"
        />
        <path
          d="M21.4411 9.45243V7H10.5588V9.45243C10.5588 10.0864 10.0414 10.5999 9.4026 10.5999H6.93152V21.4001H9.4026C10.0414 21.4001 10.5588 21.9136 10.5588 22.5476V25H21.4411V22.5476C21.4411 21.9136 21.9585 21.4001 22.5973 21.4001H25.0684V10.5999H22.5973C21.9585 10.5999 21.4411 10.0864 21.4411 9.45243ZM21.4411 20.2521C21.4411 20.8861 20.9237 21.3996 20.2849 21.3996H11.7155C11.0767 21.3996 10.5593 20.8861 10.5593 20.2521V11.7474C10.5593 11.1134 11.0767 10.5999 11.7155 10.5999H20.2849C20.9237 10.5999 21.4411 11.1134 21.4411 11.7474V20.2521Z"
          fill="white"
        />
      </svg>
    ),
    // ImageResponse options
    {
      // For convenience, we can re-use the exported icons size metadata
      // config to also set the ImageResponse's width and height.
      ...size,
    },
  );
}
