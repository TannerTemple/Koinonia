"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IntentionStatus } from "@koinonia/shared";
import { api } from "./api";

export const useHome = () => useQuery({ queryKey: ["home"], queryFn: api.home });
export const useContacts = (params: { q?: string; archived?: boolean } = {}) =>
  useQuery({ queryKey: ["contacts", params], queryFn: () => api.contacts.list(params) });
export const useContact = (id: string) =>
  useQuery({ queryKey: ["contact", id], queryFn: () => api.contacts.get(id) });
export const useIntentions = (status?: IntentionStatus) =>
  useQuery({ queryKey: ["intentions", status ?? "all"], queryFn: () => api.intentions.list(status) });
export const usePrayerToday = () => useQuery({ queryKey: ["prayerToday"], queryFn: api.prayer.today });

/**
 * A mutation that refreshes everything on success. Due lists, streaks and counts all
 * depend on each other, so one broad invalidation is simpler and always right.
 */
export function useAction<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
