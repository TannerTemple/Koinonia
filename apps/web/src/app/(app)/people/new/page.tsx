"use client";

import { useRouter } from "next/navigation";
import { dayInTimezone } from "@koinonia/shared";
import { ContactForm, EMPTY_CONTACT } from "@/components/contacts";
import { Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useAction } from "@/lib/hooks";

export default function NewPersonPage() {
  const router = useRouter();
  const user = useUser();
  const create = useAction(api.contacts.create);

  return (
    <>
      <PageHeader title="Add a person" subtitle="Who do you want to stay close to?" />
      <Card className="p-5 sm:p-6">
        <ContactForm
          initial={EMPTY_CONTACT}
          today={dayInTimezone(new Date(), user.timezone)}
          submitLabel="Add person"
          onCancel={() => router.back()}
          onSubmit={async (input) => {
            const contact = await create.mutateAsync(input);
            router.replace(`/people/${contact.id}`);
          }}
        />
      </Card>
    </>
  );
}
