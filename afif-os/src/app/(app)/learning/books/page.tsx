import { requireUser } from "@/server/auth/session";
import { BooksClient } from "@/components/books/BooksClient";
import { bookStats, domainOptions, listBooks, listReadingSessions, readingStreak } from "@/server/services/books";
import { serializeBook, serializeReadingSession } from "@/server/services/books-validation";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  const user = await requireUser();

  const [books, stats, domains, sessions, streak] = await Promise.all([
    listBooks(user.id),
    bookStats(user.id),
    domainOptions(user.id),
    listReadingSessions(user.id, undefined, 40),
    readingStreak(user.id),
  ]);

  return (
    <BooksClient
      books={books.map(serializeBook)}
      stats={stats}
      domains={domains}
      sessions={sessions.map(serializeReadingSession)}
      streak={streak}
      timeZone={user.timezone}
    />
  );
}
