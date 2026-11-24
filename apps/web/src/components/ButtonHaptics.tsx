"use client";

import { useEffect } from "react";

export function ButtonHaptics() {
  useEffect(() => {
    function vibrateOnClick(event: MouseEvent) {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const button = event.target.closest('button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], input[type="image"], summary');
      if (button && !button.closest(':disabled, [aria-disabled="true"], [data-custom-haptics]')) navigator.vibrate?.(8);
    }
    document.addEventListener("click", vibrateOnClick, true);
    return () => document.removeEventListener("click", vibrateOnClick, true);
  }, []);
  return null;
}
