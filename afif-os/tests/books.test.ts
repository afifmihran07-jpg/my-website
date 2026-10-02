import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { books, readingSessions, type User } from "@/server/db/schema";
import {
  bookStats,
  createBook,
  getBook,
  listBooks,
  listReadingSessions,
  logReading,
  readingStreak,
  updateBook,
} from "@/server/services/books";
import { cleanupUser, makeUser } from "./helpers";

let user: User;

beforeAll(async () => {
  user = await makeUser("books");
});

afterAll(async () => {
  await cleanupUser(user.id);
});

describe("books", () => {
  it("creates a book without inventing progress", async () => {
    const book = await createBook({ userId: user.id, title: "Gödel, Escher, Bach", author: "Douglas Hofstadter", totalPages: 777 });

    expect(book.currentPage).toBe(0);
    expect(book.status).toBe("want_to_read");
    expect(book.finishedAt).toBeNull();

    const loaded = await getBook(user.id, book.id);
    expect(loaded?.progressPercent).toBe(0);
    expect(loaded?.pagesRead).toBe(0);
    expect(loaded?.recentPagesPerDay).toBe(0);
  });

  it("computes the page delta on the server, never trusting the client", async () => {
    const book = await createBook({ userId: user.id, title: "Deep Work", totalPages: 296 });

    const first = await logReading({ userId: user.id, bookId: book.id, pagesTo: 40, durationMinutes: 60 });
    expect(first.session.pagesFrom).toBe(0);
    expect(first.session.pagesRead).toBe(40);
    expect(first.book.currentPage).toBe(40);
    expect(first.book.status).toBe("reading");
    expect(first.book.startedAt).not.toBeNull();

    const second = await logReading({ userId: user.id, bookId: book.id, pagesTo: 100, durationMinutes: 90 });
    expect(second.session.pagesFrom).toBe(40);
    expect(second.session.pagesRead).toBe(60);
    expect(second.book.currentPage).toBe(100);
  });

  it("refuses to log a page beyond the book's length", async () => {
    const book = await createBook({ userId: user.id, title: "Short Book", totalPages: 120 });

    await expect(logReading({ userId: user.id, bookId: book.id, pagesTo: 200 })).rejects.toThrow(/120 pages/);

    // The rejected entry must not have been written.
    const forBook = await db
      .select({ id: readingSessions.id })
      .from(readingSessions)
      .where(eq(readingSessions.bookId, book.id));
    expect(forBook).toHaveLength(0);
  });

  it("marks the book finished when the last page is reached", async () => {
    const book = await createBook({ userId: user.id, title: "The Pragmatic Programmer", totalPages: 352 });

    await logReading({ userId: user.id, bookId: book.id, pagesTo: 200 });
    const done = await logReading({ userId: user.id, bookId: book.id, pagesTo: 352 });

    expect(done.book.status).toBe("completed");
    expect(done.book.finishedAt).not.toBeNull();

    // progressPercent is derived on the read path, so assert it there.
    const loaded = await getBook(user.id, book.id);
    expect(loaded?.progressPercent).toBe(100);
  });

  it("never lets reading sessions and the book marker disagree", async () => {
    const book = await createBook({ userId: user.id, title: "Consistency Check", totalPages: 500 });
    await logReading({ userId: user.id, bookId: book.id, pagesTo: 50 });
    await logReading({ userId: user.id, bookId: book.id, pagesTo: 150 });
    await logReading({ userId: user.id, bookId: book.id, pagesTo: 150 }); // no movement

    const loaded = await getBook(user.id, book.id);
    expect(loaded?.currentPage).toBe(150);
    expect(loaded?.pagesRead).toBe(150);
    expect(loaded?.sessionsCount).toBe(3);
    expect(loaded?.progressPercent).toBe(30);
  });

  it("keeps books scoped to their owner", async () => {
    const mine = await createBook({ userId: user.id, title: "Only Mine" });
    const other = await makeUser("books-other");
    try {
      expect(await getBook(other.id, mine.id)).toBeNull();
      const updated = await updateBook(other.id, mine.id, { title: "Hijacked" });
      expect(updated).toBeNull();
      const stillMine = await getBook(user.id, mine.id);
      expect(stillMine?.title).toBe("Only Mine");
    } finally {
      await cleanupUser(other.id);
    }
  });

  it("archives instead of deleting", async () => {
    const book = await createBook({ userId: user.id, title: "To Be Archived" });

    const archived = await updateBook(user.id, book.id, { archived: true });
    expect(archived?.archivedAt).not.toBeNull();

    const visible = await listBooks(user.id);
    expect(visible.some((row) => row.id === book.id)).toBe(false);

    const withArchived = await listBooks(user.id, { includeArchived: true });
    expect(withArchived.some((row) => row.id === book.id)).toBe(true);
  });

  it("reports stats from real sessions only", async () => {
    const stats = await bookStats(user.id);

    expect(stats.total).toBeGreaterThan(0);
    expect(stats.pagesRead).toBeGreaterThan(0);
    expect(stats.completed).toBeGreaterThan(0);

    // Every reported number must reconcile with the raw table.
    const raw = await db
      .select({ pages: readingSessions.pagesRead })
      .from(readingSessions)
      .where(eq(readingSessions.userId, user.id));
    expect(stats.pagesRead).toBe(raw.reduce((sum, entry) => sum + entry.pages, 0));
  });

  it("counts consecutive reading days", async () => {
    const book = await createBook({ userId: user.id, title: "Streak Book", totalPages: 1000 });
    const now = Date.now();
    for (const daysAgo of [0, 1, 2]) {
      await logReading({
        userId: user.id,
        bookId: book.id,
        pagesTo: 10 * (daysAgo + 4),
        startedAt: new Date(now - daysAgo * 86_400_000),
      });
    }

    const streak = await readingStreak(user.id);
    expect(streak.current).toBeGreaterThanOrEqual(3);
    expect(streak.longest).toBeGreaterThanOrEqual(3);
  });

  it("lists sessions newest first with the book attached", async () => {
    const sessions = await listReadingSessions(user.id);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]?.bookTitle).toBeTruthy();

    const times = sessions.map((session) => new Date(session.startedAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});
