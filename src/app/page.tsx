import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Mythos</h1>
      <Link
        href="/login"
        className="rounded bg-black px-4 py-2 text-white"
      >
        Log in
      </Link>
    </main>
  );
}
