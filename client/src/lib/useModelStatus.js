import { useEffect, useState } from 'react';
import api from './api.js';

/**
 * The state of the model connection.
 *
 * `serverConfigured` is public (the server may have a key in its environment).
 * `mine` is the signed-in user's own configuration.
 */
export function useModelStatus(user) {
  const [server, setServer] = useState(null);
  const [mine, setMine] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const status = await api.llmStatus().catch(() => null);
      if (!cancelled) setServer(status);

      if (user) {
        try {
          const res = await api.settings();
          if (!cancelled) {
            setMine({
              llm: res.llm,
              needsSetup: res.needsSetup,
              providers: res.providers,
            });
          }
        } catch {
          /* the settings request needs a valid session */
        }
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const configured = Boolean(mine?.llm?.configured) || Boolean(server?.serverConfigured);
  const ownConfigured = Boolean(mine?.llm?.configured);

  return {
    loading,
    server,
    mine,
    configured,
    ownConfigured,
    /** True when this visitor has to connect a model before building. */
    needsModel: !loading && !configured,
    needsOwnModel: !loading && Boolean(user) && !ownConfigured && !server?.serverConfigured,
  };
}

export default useModelStatus;
