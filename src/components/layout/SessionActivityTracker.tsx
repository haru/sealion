"use client";

/**
 * Reports real user input to Auth.js so the idle session timeout counts activity (spec 045).
 * Renders nothing.
 */

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

/** Minimum time between two activity reports, in milliseconds. */
export const ACTIVITY_THROTTLE_MS = 60_000;

/** DOM events that count as the user working. Passive movement and scrolling do not. */
const ACTIVITY_EVENTS = ["keydown", "pointerdown", "wheel", "touchstart"] as const;

/**
 * Sends `update({ activity: true })` at most once per {@link ACTIVITY_THROTTLE_MS} while the
 * user types, clicks, scrolls the wheel or touches the screen — including input that never
 * reaches the server, such as writing a long text. Background session refetches are not
 * reported, so an unattended tab still times out.
 *
 * When the server says the session has ended (`update` resolves to `null`) the router is
 * refreshed so the server layout can redirect to the login page.
 *
 * @returns Nothing; this component only attaches event listeners.
 */
export default function SessionActivityTracker(): null {
  const { update } = useSession();
  const router = useRouter();
  const updateRef = useRef(update);
  const lastReportedAtRef = useRef(0);

  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  useEffect(() => {
    const onActivity = () => {
      const now = Date.now();
      if (now - lastReportedAtRef.current < ACTIVITY_THROTTLE_MS) { return; }
      lastReportedAtRef.current = now;

      updateRef
        .current({ activity: true })
        .then((session) => {
          // `undefined` means Auth.js skipped the call (still loading): report again on the next input.
          if (session === undefined) { lastReportedAtRef.current = 0; }
          if (session === null) { router.refresh(); }
        })
        .catch(() => {
          // Offline or transient failure: nothing to recover, the next input retries immediately.
          lastReportedAtRef.current = 0;
        });
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }
    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity);
      }
    };
  }, [router]);

  return null;
}
