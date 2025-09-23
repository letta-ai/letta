import { useEffect, useState } from 'react';
import { useCurrentUser } from '$web/client/hooks';

export function useCurrentStyles() {
  const [styles, setStyles] = useState(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return getComputedStyle(document.documentElement);
  });
  const user = useCurrentUser();

  useEffect(() => {
    if (user?.theme) {
      const rootStyles = getComputedStyle(document.documentElement);
      setStyles(rootStyles);
    }
  }, [user?.theme]);

  return styles;
}
