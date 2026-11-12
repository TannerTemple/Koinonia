import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-3xl font-semibold">Nothing here</h1>
      <p className="text-muted">That page doesn&rsquo;t exist.</p>
      <Link href="/" className="font-semibold text-primary underline-offset-2 hover:underline">
        Back to Today
      </Link>
    </main>
  );
}
