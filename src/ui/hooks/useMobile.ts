import { useState, useEffect } from 'react';

interface MobileInfo {
  isMobile: boolean;
  isTablet: boolean;
  isTouchDevice: boolean;
}

export function useMobile(): MobileInfo {
  const [info, setInfo] = useState<MobileInfo>(() => compute());

  useEffect(() => {
    const onResize = () => setInfo(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return info;
}

function compute(): MobileInfo {
  const w = window.innerWidth;
  return {
    isMobile: w < 480,
    isTablet: w < 768,
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  };
}
