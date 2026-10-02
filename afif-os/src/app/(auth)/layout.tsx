import { ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
          A
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          Afif<span className="text-muted-foreground"> OS</span>
        </h1>
        <p className="max-w-xs text-xs text-muted-foreground">
          One operating system for your academic, intellectual and personal growth.
        </p>
      </div>

      <div className="card w-full max-w-sm p-6">{children}</div>

      <p className="mt-6 flex max-w-sm items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
        Private by design: passwords are hashed with bcrypt, sessions are HTTP-only cookies, and every
        request is authorised on the server.
      </p>
    </main>
  );
}
