import { useCallback, useEffect, useState } from "react";

import { fetchUserFeedbackEvents } from "../services/userFeedbackApi.js";
import {
  USER_SESSION_CHANGED_EVENT,
  getCurrentUser,
} from "../services/userAuth.js";

function createInitialState() {
  return {
    events: [],
    error: "",
    loading: true,
    skipped: "",
    user: null,
  };
}

export function usePrivateFeedbackEvents({ limit = 500 } = {}) {
  const [state, setState] = useState(createInitialState);

  const refresh = useCallback(async () => {
    try {
      setState((current) => ({
        ...current,
        error: "",
        loading: true,
      }));

      const user = await getCurrentUser();

      if (!user?.id || user.provider !== "supabase") {
        setState({
          events: [],
          error: "",
          loading: false,
          skipped: user?.provider === "local-dev"
            ? "local_dev_user"
            : "missing_supabase_user",
          user: user || null,
        });
        return;
      }

      const result = await fetchUserFeedbackEvents({ user, limit });

      setState({
        events: result.events || [],
        error: "",
        loading: false,
        skipped: result.skipped || "",
        user,
      });
    } catch (error) {
      setState({
        events: [],
        error:
          error instanceof Error
            ? error.message
            : "Could not load private feedback.",
        loading: false,
        skipped: "",
        user: null,
      });
    }
  }, [limit]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(refresh, 0);

    window.addEventListener(USER_SESSION_CHANGED_EVENT, refresh);

    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener(USER_SESSION_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return {
    ...state,
    refresh,
  };
}
