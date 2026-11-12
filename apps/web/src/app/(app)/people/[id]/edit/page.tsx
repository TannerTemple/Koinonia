"use client";

import { useParams, useRouter } from "next/navigation";
import { ContactForm, contactToForm } from "@/components/contacts";
import { Button, Card, ErrorState, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction, useContact } from "@/lib/hooks";

export default function EditPersonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: contact, error, isPending, refetch } = useContact(id);
  const update = useAction((input: Parameters<typeof api.contacts.update>[1]) => api.contacts.update(id, input));
  const remove = useAction(() => api.contacts.delete(id));

  if (isPending) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader title={`Edit ${contact.name}`} />
      <Card className="p-5 sm:p-6">
        <ContactForm
          initial={contactToForm(contact)}
          today=""
          submitLabel="Save changes"
          showLastContacted={false}
          onCancel={() => router.back()}
          onSubmit={async (input) => {
            await update.mutateAsync(input);
            router.replace(`/people/${id}`);
          }}
        />
      </Card>

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="font-semibold">{contact.archived ? "Archived" : "Take a break from reminders"}</p>
          <p className="text-sm text-muted">Archiving hides them from Today and People but keeps notes and history.</p>
        </div>
        <Button
          variant="secondary"
          loading={update.isPending}
          onClick={() => update.mutate({ archived: !contact.archived }, { onSuccess: () => router.replace(contact.archived ? `/people/${id}` : "/people") })}
        >
          {contact.archived ? "Restore" : "Archive"}
        </Button>
      </Card>
      <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 border-danger/30 p-5">
        <div>
          <p className="font-semibold">Delete {contact.name}</p>
          <p className="text-sm text-muted">Removes their notes and history too. Intentions stay on your prayer list.</p>
        </div>
        <Button
          variant="danger"
          loading={remove.isPending}
          onClick={() => {
            if (window.confirm(`Delete ${contact.name} and all their notes? This can't be undone.`)) {
              remove.mutate(undefined, { onSuccess: () => router.replace("/people") });
            }
          }}
        >
          Delete
        </Button>
      </Card>
    </>
  );
}
