/**
 * The shared people directory: who everyone is and what they look like.
 *
 * Loaded once per session and reused everywhere a face appears, so a list of
 * fifty tasks never makes fifty lookups.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { peopleDirectory } from "@/lib/account.functions";
import type { PersonCard } from "@/lib/account.server";

export function usePeople() {
  const load = useServerFn(peopleDirectory);
  const query = useQuery({
    queryKey: ["people-directory"],
    queryFn: () => load(),
    staleTime: 10 * 60 * 1000,
  });
  const people = (query.data ?? []) as PersonCard[];
  const byId = new Map(people.map((p) => [p.id, p]));
  return { people, byId, isLoading: query.isLoading };
}

export function usePerson(userId: string | null | undefined) {
  const { byId } = usePeople();
  return userId ? (byId.get(userId) ?? null) : null;
}
