"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";
import { askAdvisorAction } from "@/server/services/advisor-actions";
import type { Advice } from "@/server/services/advisor";
import { Alert, Button, Card, CardHeader, EmptyState } from "@/components/ui/primitives";

export function AdvisorClient({
  questions,
  history,
  denied,
  llmConfigured,
}: {
  questions: string[];
  history: Advice[];
  denied: string[];
  llmConfigured: boolean;
}) {
  const [answers, setAnswers] = React.useState<Advice[]>([]);
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const ask = async (question: string) => {
    setPending(question);
    setError(null);
    const result = await askAdvisorAction(question);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAnswers((prev) => [result.data, ...prev.filter((a) => a.question !== question)]);
  };

  return (
    <div className="space-y-4">
      <Alert variant="info" title="An advisor, not an autopilot">
        Every answer below is computed from your own records and states the evidence it used. Nothing is guessed, and
        no recommendation is made without a reason.{" "}
        {llmConfigured
          ? "A language model is configured and will be used for free-form questions."
          : "No language model is configured, so the deterministic rule engine is answering."}
      </Alert>

      {denied.length > 0 ? (
        <Alert variant="warning" title="Modules the advisor cannot see">
          <span className="capitalize">{denied.join(", ")}</span> — these are switched off in{" "}
          <Link href="/settings?tab=privacy" className="font-medium text-primary underline underline-offset-2">
            Privacy &amp; AI access
          </Link>
          . Sensitive modules stay off unless you explicitly enable them.
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="Ask" subtitle="Each question reads only the data it needs" icon={<Sparkles className="h-4 w-4" />} />
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {questions.map((question) => (
            <Button key={question} size="sm" variant="outline" onClick={() => ask(question)} loading={pending === question}>
              {question}
            </Button>
          ))}
        </div>
        {error ? (
          <div className="px-4 pb-3">
            <Alert variant="error">{error}</Alert>
          </div>
        ) : null}
      </Card>

      {answers.length > 0 ? (
        <div className="space-y-3">
          {answers.map((advice) => (
            <Card key={advice.id}>
              <CardHeader title={advice.question} subtitle={`mode: ${advice.mode} · context: ${advice.contextUsed.join(", ") || "none"}`} />
              <div className="space-y-2 px-4 py-3">
                <p className="text-sm leading-relaxed">{advice.answer}</p>
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Why</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{advice.rationale}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader title="Previous advice" subtitle="Kept so you can see how recommendations changed" icon={<ShieldCheck className="h-4 w-4" />} />
        {history.length === 0 ? (
          <EmptyState title="No advice yet" description="Ask a question above — answers are stored with their reasoning." />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((advice) => (
              <li key={advice.id} className="px-4 py-2.5">
                <p className="text-xs font-medium">{advice.question}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{advice.answer}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/80">{new Date(advice.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
