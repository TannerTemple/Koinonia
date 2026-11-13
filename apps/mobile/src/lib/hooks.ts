import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { dayInTimezone } from "@koinonia/shared";
import { api } from "./api";
import { useUser } from "./auth";

export const useHome = () => useQuery({ queryKey: ["home"], queryFn: api.home });
export const useWeeklyReview = () => useQuery({ queryKey: ["weeklyReview"], queryFn: api.weeklyReview });
export const useContacts = (params: { archived?: boolean } = {}) =>
  useQuery({ queryKey: ["contacts", params], queryFn: () => api.contacts.list(params) });
export const useContact = (id: string | undefined) =>
  useQuery({ queryKey: ["contact", id], queryFn: () => api.contacts.get(id!), enabled: Boolean(id) });
export const useIntentions = () => useQuery({ queryKey: ["intentions"], queryFn: () => api.intentions.list() });
export const usePrayerToday = () => useQuery({ queryKey: ["prayerToday"], queryFn: api.prayer.today });

/** A mutation that refreshes everything on success (due lists, streaks and counts are all linked). */
export function useAction<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries() });
}

/** Today's calendar day in the signed-in user's timezone. */
export function useToday(): string {
  return dayInTimezone(new Date(), useUser().timezone);
}

/** Pull-to-refresh state for a set of queries. */
export function useRefresh(...refetchers: (() => Promise<unknown>)[]) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled(refetchers.map((r) => r()));
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refetchers);
  return { refreshing, onRefresh };
}
