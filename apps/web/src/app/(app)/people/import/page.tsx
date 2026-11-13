"use client";

import { CheckCircle2, FileUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CADENCE_PRESETS, chunk, parseVCards, type ImportCandidate, type ImportResult } from "@koinonia/shared";
import { Avatar, Button, Card, EmptyState, FormError, Input, PageHeader, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";

type Row = ImportCandidate & { key: string };
const BATCH = 200;

export default function ImportPeoplePage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [people, setPeople] = useState<Row[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [cadence, setCadence] = useState("28");

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    try {
      const rows = parseVCards(await file.text())
        .map((p, i) => ({ ...p, key: `row-${i}` }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (rows.length === 0) {
        setPeople(null);
        setFileError("That file has no contacts in it. Export a vCard (.vcf) from your address book and try again.");
        return;
      }
      setPeople(rows);
      setSelected(new Set());
    } catch {
      setFileError("That file couldn't be read.");
    }
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!people || !needle) return people ?? [];
    return people.filter((p) => `${p.name} ${p.email ?? ""} ${p.phone ?? ""}`.toLowerCase().includes(needle));
  }, [people, q]);
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.key));

  // Any number of people: sent in batches the API accepts, totals added up.
  const doImport = useAction(async (): Promise<ImportResult> => {
    const chosen = (people ?? []).filter((p) => selected.has(p.key)).map(({ name, phone, email, birthday }) => ({ name, phone, email, birthday }));
    const total: ImportResult = { created: 0, skipped: 0 };
    for (const contacts of chunk(chosen, BATCH)) {
      const result = await api.contacts.import({ cadenceDays: cadence === "none" ? null : Number(cadence), contacts });
      total.created += result.created;
      total.skipped += result.skipped;
    }
    return total;
  });

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of visible) {
        if (allVisibleSelected) next.delete(p.key);
        else next.add(p.key);
      }
      return next;
    });

  if (doImport.isSuccess) {
    const { created, skipped } = doImport.data;
    return (
      <EmptyState
        icon={<CheckCircle2 className="size-6" />}
        title={`${created} ${created === 1 ? "person" : "people"} added`}
        body={skipped ? `${skipped} ${skipped === 1 ? "was" : "were"} already in your list and skipped.` : "They're in your People list now. Set a different rhythm for anyone who needs it."}
        action={
          <Link href="/people">
            <Button>See your people</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <PageHeader title="Import people" subtitle="Bring in people from your address book with a contacts file." />

      <Card className="space-y-3 p-5">
        <p className="text-sm text-muted">
          Export your contacts as a vCard (.vcf) file: in iCloud Contacts choose Select All, then Export vCard; in Google Contacts choose Export, then vCard. The file is read in your browser;
          only the people you pick are sent to Koinonia.
        </p>
        <input ref={fileInput} type="file" accept=".vcf,text/vcard,text/x-vcard" className="sr-only" aria-label="Contacts file" onChange={(e) => void readFile(e.target.files?.[0])} />
        <Button variant={people ? "secondary" : "primary"} onClick={() => fileInput.current?.click()}>
          <FileUp className="size-4" aria-hidden /> {people ? "Choose a different file" : "Choose a .vcf file"}
        </Button>
        {fileError ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {fileError}
          </p>
        ) : null}
      </Card>

      {people ? (
        <section className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
            <Input type="search" aria-label="Search the file" placeholder="Search by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select aria-label="Remind me" value={cadence} onChange={(e) => setCadence(e.target.value)}>
              {CADENCE_PRESETS.map((p) => (
                <option key={p.days} value={p.days}>
                  {p.label}
                </option>
              ))}
              <option value="none">No reminder</option>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted" role="status">
              {visible.length} {visible.length === 1 ? "contact" : "contacts"} · {selected.size} selected
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={toggleVisible} disabled={visible.length === 0}>
                {allVisibleSelected ? "Clear these" : "Select all"}
              </Button>
              <Button loading={doImport.isPending} disabled={selected.size === 0} onClick={() => doImport.mutate(undefined)}>
                {selected.size ? `Add ${selected.size} ${selected.size === 1 ? "person" : "people"}` : "Select people to add"}
              </Button>
            </div>
          </div>
          <FormError error={doImport.error} />

          {visible.length === 0 ? (
            <EmptyState title="No matches" body="Nobody in the file matches that search." />
          ) : (
            <Card className="divide-y divide-border">
              {visible.slice(0, 500).map((p) => (
                <label key={p.key} className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 hover:bg-surface-alt">
                  <input type="checkbox" className="size-5 accent-[var(--k-primary)]" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
                  <Avatar name={p.name} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block truncate text-sm text-muted">{[p.phone, p.email].filter(Boolean).join(" · ") || "No phone or email"}</span>
                  </span>
                </label>
              ))}
            </Card>
          )}
          {visible.length > 500 ? <p className="text-center text-sm text-muted">Showing the first 500. Search to narrow it down.</p> : null}
        </section>
      ) : null}
    </>
  );
}
