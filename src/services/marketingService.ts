import { supabase } from "../lib/supabase";

/**
 * Marketing & Event Tracking Service
 * Captures UTM parameters and Paywall events into Supabase.
 */

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

/**
 * Captures UTM parameters from current URL and stores them in session storage.
 */
export function captureUtmParams(): UtmParams {
  const urlParams = new URLSearchParams(window.location.search);
  const params: UtmParams = {
    utm_source: urlParams.get("utm_source") || undefined,
    utm_medium: urlParams.get("utm_medium") || undefined,
    utm_campaign: urlParams.get("utm_campaign") || undefined,
    utm_content: urlParams.get("utm_content") || undefined,
    utm_term: urlParams.get("utm_term") || undefined,
  };

  // Only store if at least one param exists
  if (Object.values(params).some(v => !!v)) {
    sessionStorage.setItem("verso_utm", JSON.stringify(params));
  }

  return params;
}

/**
 * Retrieves captured UTM params.
 */
export function getStoredUtmParams(): UtmParams {
  try {
    const stored = sessionStorage.getItem("verso_utm");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Tracks a paywall event to Supabase.
 */
export async function trackPaywallEvent(
  eventName: string,
  planId?: string,
  metadata: any = {}
) {
  // Fire and forget, don't await to avoid blocking UI
  (async () => {
    try {
      const isSupabaseConfigured = !!(import.meta as any).env?.VITE_SUPABASE_URL && !!(import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
      if (!isSupabaseConfigured) {
        if (process.env.NODE_ENV !== 'production') {
          // Log only once per session or very concisely to avoid spam
          const hasLogged = (window as any)._verso_tracking_skipped;
          if (!hasLogged) {
            console.warn("Tracking skipped: Supabase is not configured in preview mode.");
            (window as any)._verso_tracking_skipped = true;
          }
        }
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const utm = getStoredUtmParams();

      await supabase.from("paywall_events").insert({
        user_id: user?.id,
        event_name: eventName,
        plan_id: planId,
        source: "web",
        ...utm,
        metadata
      });
    } catch (err) {
      // Catch all errors to prevent crashing the app or blocking navigation
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Tracking Error (${eventName}):`, err instanceof Error ? err.message : err);
      }
    }
  })();
}
