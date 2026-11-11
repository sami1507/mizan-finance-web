"use client";
import { useCallback, useRef } from "react";

/** Request identities are ephemeral, per mounted workspace; no financial browser storage. */
export function useMutationIdentity() {
  const active = useRef(false);
  const pending = useRef(new Map<string, string>());
  const begin = useCallback((fingerprint: string): string | null => {
    if (active.current) return null;
    active.current = true;
    const id = pending.current.get(fingerprint) ?? crypto.randomUUID();
    pending.current.set(fingerprint, id);
    return id;
  }, []);
  const complete = useCallback((fingerprint: string) => { pending.current.delete(fingerprint); }, []);
  const release = useCallback(() => { active.current = false; }, []);
  return { begin, complete, release };
}
