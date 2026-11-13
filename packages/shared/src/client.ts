import type {
  AdminStats,
  AdminUpdateUserInput,
  AdminUser,
  ApiErrorBody,
  AuthResponse,
  CalendarFeed,
  ChangePasswordInput,
  Contact,
  ContactDetail,
  CreateContactInput,
  CreateIntentionInput,
  CreateNoteInput,
  DeleteAccountInput,
  ForgotPasswordInput,
  Home,
  ImportContactsInput,
  ImportResult,
  Intention,
  IntentionStatus,
  Interaction,
  LoginInput,
  LogoutInput,
  Note,
  PrayerToday,
  ReachOutInput,
  ResetPasswordInput,
  RegisterDeviceInput,
  RegisterInput,
  SnoozeInput,
  UpdateContactInput,
  UpdateIntentionInput,
  UpdateMeInput,
  UpdateNoteInput,
  User,
  UserSearchResult,
  VerifyEmailInput,
  WeeklyReview,
} from "./schemas";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Returns the bearer token, if signed in. */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /**
   * Web only: the session lives in an httpOnly cookie instead of a token the page can read.
   * Requests are sent with credentials and the client header the API requires next to a cookie.
   */
  cookieSession?: boolean;
  /** Called when the API rejects the token (expired / revoked). */
  onUnauthorized?: () => void;
  fetch?: typeof fetch;
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(options: ApiClientOptions) {
  const base = options.baseUrl.replace(/\/+$/, "") + "/v1";

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const doFetch = options.fetch ?? fetch;
    const token = await options.getToken?.();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.cookieSession) headers["X-Koinonia-Client"] = "web";

    let res: Response;
    try {
      res = await doFetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        ...(options.cookieSession ? { credentials: "include" as const } : {}),
      });
    } catch {
      throw new ApiError(0, "NETWORK", "Can't reach Koinonia right now. Check your connection.");
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON error body */
    }

    if (!res.ok) {
      const err = (data as ApiErrorBody | null)?.error;
      const hadSession = Boolean(token) || (options.cookieSession && !path.startsWith("/auth/"));
      if (res.status === 401 && hadSession) options.onUnauthorized?.();
      throw new ApiError(
        res.status,
        err?.code ?? "UNKNOWN",
        err?.message ?? "Something went wrong. Please try again.",
        err?.fields,
      );
    }
    return data as T;
  }

  const get = <T>(path: string) => request<T>("GET", path);
  const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
  const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
  const put = <T>(path: string, body: unknown) => request<T>("PUT", path, body);
  const del = (path: string, body?: unknown) => request<void>("DELETE", path, body);

  return {
    auth: {
      register: (input: RegisterInput) => post<AuthResponse>("/auth/register", input),
      login: (input: LoginInput) => post<AuthResponse>("/auth/login", input),
      logout: (input: LogoutInput = {}) => post<void>("/auth/logout", input),
      /** Always succeeds, whether or not the email has an account. */
      forgotPassword: (input: ForgotPasswordInput) => post<void>("/auth/forgot-password", input),
      resetPassword: (input: ResetPasswordInput) => post<void>("/auth/reset-password", input),
      verifyEmail: (input: VerifyEmailInput) => post<void>("/auth/verify-email", input),
      resendVerification: () => post<void>("/auth/resend-verification"),
    },
    me: {
      get: () => get<User>("/me"),
      update: (input: UpdateMeInput) => patch<User>("/me", input),
      changePassword: (input: ChangePasswordInput) => post<void>("/me/password", input),
      /** Deleting the account needs the password again, not just a session. */
      delete: (input: DeleteAccountInput) => del("/me", input),
      /** Whether a calendar link exists (the link itself is only returned by createCalendarFeed). */
      calendarFeed: () => get<CalendarFeed>("/me/calendar-feed"),
      /** Makes a new link, shown once, and turns off the old one. */
      createCalendarFeed: () => post<CalendarFeed>("/me/calendar-feed"),
      removeCalendarFeed: () => del("/me/calendar-feed"),
    },
    home: () => get<Home>("/home"),
    weeklyReview: () => get<WeeklyReview>("/review/weekly"),
    contacts: {
      list: (params: { q?: string; archived?: boolean } = {}) => {
        const qs = new URLSearchParams();
        if (params.q) qs.set("q", params.q);
        if (params.archived) qs.set("archived", "true");
        const s = qs.toString();
        return get<Contact[]>(`/contacts${s ? `?${s}` : ""}`);
      },
      get: (id: string) => get<ContactDetail>(`/contacts/${id}`),
      create: (input: CreateContactInput) => post<Contact>("/contacts", input),
      update: (id: string, input: UpdateContactInput) => patch<Contact>(`/contacts/${id}`, input),
      delete: (id: string) => del(`/contacts/${id}`),
      import: (input: ImportContactsInput) => post<ImportResult>("/contacts/import", input),
      reachOut: (id: string, input: ReachOutInput = {}) =>
        post<{ contact: Contact; interaction: Interaction }>(`/contacts/${id}/reach-out`, input),
      snooze: (id: string, input: SnoozeInput) => post<Contact>(`/contacts/${id}/snooze`, input),
      deleteInteraction: (id: string) => del(`/interactions/${id}`),
    },
    notes: {
      create: (contactId: string, input: CreateNoteInput) =>
        post<Note>(`/contacts/${contactId}/notes`, input),
      update: (id: string, input: UpdateNoteInput) => patch<Note>(`/notes/${id}`, input),
      delete: (id: string) => del(`/notes/${id}`),
    },
    intentions: {
      list: (status?: IntentionStatus) =>
        get<Intention[]>(`/intentions${status ? `?status=${status}` : ""}`),
      create: (input: CreateIntentionInput) => post<Intention>("/intentions", input),
      update: (id: string, input: UpdateIntentionInput) =>
        patch<Intention>(`/intentions/${id}`, input),
      delete: (id: string) => del(`/intentions/${id}`),
      pray: (id: string) => post<Intention>(`/intentions/${id}/pray`),
      unpray: (id: string) => request<Intention>("DELETE", `/intentions/${id}/pray`),
    },
    prayer: {
      today: () => get<PrayerToday>("/prayer/today"),
      setToday: (intentionId: string) => put<PrayerToday>("/prayer/today", { intentionId }),
    },
    users: {
      search: (q: string) => get<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`),
    },
    devices: {
      register: (input: RegisterDeviceInput) => post<void>("/devices", input),
    },
    admin: {
      stats: () => get<AdminStats>("/admin/stats"),
      users: (q?: string) =>
        get<AdminUser[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
      updateUser: (id: string, input: AdminUpdateUserInput) =>
        patch<AdminUser>(`/admin/users/${id}`, input),
    },
  };
}
