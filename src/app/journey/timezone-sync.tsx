"use client";

import { useEffect } from "react";
import { setProfileTimezone } from "./actions";

// Renders nothing; on mount, captures the browser's IANA timezone once and
// persists it for users onboarded before the timezone field existed.
export function TimezoneSync() {
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      setProfileTimezone(timezone);
    }
  }, []);

  return null;
}
