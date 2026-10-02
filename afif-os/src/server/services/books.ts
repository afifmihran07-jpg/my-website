import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { books, polymathDomains, readingSessions, type Book } from "@/server/db/schema";
import { calendarDaysUntil } from "@/server/services/projects";

export type BookStatus = Book["status"];

export type BookWithStats = Book & {
  sessionsCount: number;
  totalSeconds: number;
  pagesRead: number;
  domainName: string | null;
  /** derived on the server so the client can never invent progress */
  progressPercent: number | null;
  /** pages/day over the last 14 days of logged reading — real data only */
  recentPagesPerDay: number;
  /** days until targetFinishDate; negative = overdue */
  daysToTarget: number | null;
  /** pages/day needed to hit the target date, or null when not computable */
  requiredPagesPerDay: number | null;
};

const MS_PER_DAY = 86_400_000;

export async function listBooks(
  userId: string,
  filter: { status?: BookStatus | "all"; includeArchived?: boolean } = {},
): Promise<BookWithStats[]> {
  const conditions = [eq(books.userId, userId)];
  if (!filter.includeArchived) conditions.push(isNull(books.archivedAt));
  if (filter.status && filter.status !== "all") conditions.push(eq(books.status, filter.status));

  const rows = await db
    .select({
      book: books,
      domainName: polymathDomains.name,
      sessionsCount: sql<number>`(select count(*) from ${readingSessions} where ${readingSessions.bookId} = ${books.id})`,
      totalSeconds: sql<number>`coalesce((select sum(${readingSessions.durationSeconds}) from ${readingSessions} where ${readingSessions.bookId} = ${books.id}), 0)`,
      pagesRead: sql<number>`coalesce((select sum(${readingSessions.pagesRead}) from ${readingSessions} where ${readingSessions.bookId} = ${books.id}), 0)`,
      recentPages: sql<number>`coalesce((select sum(${readingSessions.pagesRead}) from ${readingSessions} where ${readingSessions.bookId} = ${books.id} and ${readingSessions.startedAt} >= now() - interval '14 days'), 0)`,
    })
    .from(books)
    .leftJoin(polymathDomains, eq(polymathDomains.id, books.domainId))
    .where(and(...conditions))
    .orderBy(desc(books.updatedAt));

  return rows.map(({ book, domainName, sessionsCount, totalSeconds, pagesRead, recentPages }) =>
    decorate(book, { domainName, sessionsCount, totalSeconds, pagesRead, recentPages }),
  );
}

export async function getBook(userId: string, bookId: string): Promise<BookWithStats | null> {
  const [row] = await db
    .select({
      book: books,
      domainName: polymathDomains.name,
      sessionsCount: sql<number>`(select count(*) from ${readingSessions} where ${readingSessions.bookId} = ${books.id})`,
      totalSeconds: sql<number>`coalesce((select sum(${readingSessions.durationSeconds}) from ${readingSessions} where ${readingSessions.bookId} = ${books.id}), 0)`,
      pagesRead: sql<number>`coalesce((select sum(${readingSessions.pagesRead}) from ${readingSessions} where ${readingSessions.bookId} = ${books.id}), 0)`,
      recentPages: sql<number>`coalesce((select sum(${readingSessions.pagesRead}) from ${readingSessions} where ${readingSessions.bookId} = ${books.id} and ${readingSessions.startedAt} >= now() - interval '14 days'), 0)`,
    })
    .from(books)
    .leftJoin(polymathDomains, eq(polymathDomains.id, books.domainId))
    .where(and(eq(books.userId, userId), eq(books.id, bookId)))
    .limit(1);

  if (!row) return null;
  return decorate(row.book, {
    domainName: row.domainName,
    sessionsCount: row.sessionsCount,
    totalSeconds: row.totalSeconds,
    pagesRead: row.pagesRead,
    recentPages: row.recentPages,
  });
}

function decorate(
  book: Book,
  stats: { domainName: string | null; sessionsCount: number; totalSeconds: number; pagesRead: number; recentPages: number },
): BookWithStats {
  const progressPercent =
    book.totalPages && book.totalPages > 0
      ? Math.min(100, Math.round((Math.min(book.currentPage, book.totalPages) / book.totalPages) * 100))
      : null;

  let daysToTarget: number | null = null;
  let requiredPagesPerDay: number | null = null;
  if (book.targetFinishDate) {
    daysToTarget = calendarDaysUntil(book.targetFinishDate);
    const remaining = Math.max(0, (book.totalPages ?? book.currentPage) - book.currentPage);
    requiredPagesPerDay = daysToTarget !== null && daysToTarget > 0 ? Math.ceil(remaining / daysToTarget) : null;
  }

  return {
    ...book,
    domainName: stats.domainName,
    sessionsCount: Number(stats.sessionsCount),
    totalSeconds: Number(stats.totalSeconds),
    pagesRead: Number(stats.pagesRead),
    progressPercent,
    recentPagesPerDay: Math.round((Number(stats.recentPages) / 14) * 10) / 10,
    daysToTarget,
    requiredPagesPerDay,
  };
}

export type CreateBookInput = {
  userId: string;
  title: string;
  author?: string | null;
  totalPages?: number | null;
  status?: BookStatus;
  targetFinishDate?: string | null;
  dailyPageTarget?: number | null;
  domainId?: string | null;
};

export async function createBook(input: CreateBookInput): Promise<Book> {
  const [row] = await db
    .insert(books)
    .values({
      userId: input.userId,
      title: input.title.trim(),
      author: input.author?.trim() || null,
      totalPages: input.totalPages ?? null,
      status: input.status ?? "want_to_read",
      targetFinishDate: input.targetFinishDate || null,
      dailyPageTarget: input.dailyPageTarget ?? null,
      domainId: input.domainId || null,
      startedAt: input.status === "reading" ? new Date() : null,
    })
    .returning();
  return row!;
}

export type UpdateBookInput = Partial<Omit<CreateBookInput, "userId">> & {
  rating?: number | null;
  review?: string | null;
  archived?: boolean;
};

export async function updateBook(userId: string, bookId: string, patch: UpdateBookInput): Promise<Book | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) values.title = patch.title.trim();
  if (patch.author !== undefined) values.author = patch.author?.trim() || null;
  if (patch.totalPages !== undefined) values.totalPages = patch.totalPages ?? null;
  if (patch.targetFinishDate !== undefined) values.targetFinishDate = patch.targetFinishDate || null;
  if (patch.dailyPageTarget !== undefined) values.dailyPageTarget = patch.dailyPageTarget ?? null;
  if (patch.domainId !== undefined) values.domainId = patch.domainId || null;
  if (patch.rating !== undefined) values.rating = patch.rating;
  if (patch.review !== undefined) values.review = patch.review;
  if (patch.archived !== undefined) values.archivedAt = patch.archived ? new Date() : null;

  if (patch.status !== undefined) {
    values.status = patch.status;
    if (patch.status === "reading") {
      // Only stamp a start the first time — restarting a book shouldn't erase history.
      const [existing] = await db.select({ startedAt: books.startedAt }).from(books).where(eq(books.id, bookId)).limit(1);
      if (existing && !existing.startedAt) values.startedAt = new Date();
    }
    if (patch.status === "completed") values.finishedAt = new Date();
  }

  const [row] = await db
    .update(books)
    .set(values)
    .where(and(eq(books.userId, userId), eq(books.id, bookId)))
    .returning();
  return row ?? null;
}

export type LogReadingInput = {
  userId: string;
  bookId: string;
  /** page the reader is now on — the server computes the delta */
  pagesTo: number;
  durationMinutes?: number | null;
  notes?: string | null;
  startedAt?: Date | null;
};

/**
 * Records a reading session and advances the book's page marker in one
 * transaction. The pages-read delta is computed here, never accepted from the
 * client, so the reading log and the book can never disagree.
 */
export async function logReading(input: LogReadingInput) {
  return db.transaction(async (tx) => {
    const [book] = await tx
      .select()
      .from(books)
      .where(and(eq(books.userId, input.userId), eq(books.id, input.bookId)))
      .limit(1);
    if (!book) throw new Error("Book not found");

    const pagesFrom = book.currentPage;
    const pagesTo = Math.max(0, Math.floor(input.pagesTo));
    if (book.totalPages && pagesTo > book.totalPages) {
      throw new Error(`This book has ${book.totalPages} pages — you cannot be on page ${pagesTo}.`);
    }
    const pagesRead = Math.max(0, pagesTo - pagesFrom);

    const startedAt = input.startedAt ?? new Date();
    const durationSeconds = Math.max(0, Math.round((input.durationMinutes ?? 0) * 60));

    const [session] = await tx
      .insert(readingSessions)
      .values({
        userId: input.userId,
        bookId: book.id,
        pagesFrom,
        pagesTo,
        pagesRead,
        startedAt,
        endedAt: durationSeconds ? new Date(startedAt.getTime() + durationSeconds * 1000) : startedAt,
        durationSeconds,
        notes: input.notes?.trim() || null,
      })
      .returning();

    const completed = book.totalPages !== null && pagesTo >= book.totalPages;
    const nextStatus: BookStatus = completed ? "completed" : pagesTo > 0 ? "reading" : book.status;

    const [updated] = await tx
      .update(books)
      .set({
        currentPage: pagesTo,
        status: nextStatus,
        startedAt: book.startedAt ?? (pagesTo > 0 ? startedAt : null),
        finishedAt: completed ? (book.finishedAt ?? new Date()) : null,
        updatedAt: new Date(),
      })
      .where(eq(books.id, book.id))
      .returning();

    return { session: session!, book: updated! };
  });
}

export async function listReadingSessions(userId: string, bookId?: string, limit = 50) {
  const conditions = [eq(readingSessions.userId, userId)];
  if (bookId) conditions.push(eq(readingSessions.bookId, bookId));

  const rows = await db
    .select({ session: readingSessions, title: books.title, author: books.author })
    .from(readingSessions)
    .innerJoin(books, eq(books.id, readingSessions.bookId))
    .where(and(...conditions))
    .orderBy(desc(readingSessions.startedAt))
    .limit(limit);

  return rows.map(({ session, title, author }) => ({ ...session, bookTitle: title, bookAuthor: author }));
}

export type BookStats = {
  total: number;
  reading: number;
  completed: number;
  wantToRead: number;
  paused: number;
  pagesRead: number;
  totalSeconds: number;
  pagesThisWeek: number;
  booksFinishedThisYear: number;
  /** per-book pages this week, for the "on track?" panel */
  weeklyTargets: { id: string; title: string; target: number; actual: number; percent: number }[];
};

export async function bookStats(userId: string): Promise<BookStats> {
  const [counts] = await db
    .select({
      total: sql<number>`count(*) filter (where ${books.archivedAt} is null)`,
      reading: sql<number>`count(*) filter (where ${books.status} = 'reading')`,
      completed: sql<number>`count(*) filter (where ${books.status} = 'completed' and ${books.archivedAt} is null)`,
      wantToRead: sql<number>`count(*) filter (where ${books.status} = 'want_to_read' and ${books.archivedAt} is null)`,
      paused: sql<number>`count(*) filter (where ${books.status} = 'paused')`,
      booksFinishedThisYear: sql<number>`count(*) filter (where ${books.status} = 'completed' and extract(year from ${books.finishedAt}) = extract(year from now()))`,
    })
    .from(books)
    .where(eq(books.userId, userId));

  const [pages] = await db
    .select({
      pagesRead: sql<number>`coalesce(sum(${readingSessions.pagesRead}), 0)`,
      totalSeconds: sql<number>`coalesce(sum(${readingSessions.durationSeconds}), 0)`,
      pagesThisWeek: sql<number>`coalesce(sum(${readingSessions.pagesRead}) filter (where ${readingSessions.startedAt} >= date_trunc('week', now())), 0)`,
    })
    .from(readingSessions)
    .where(eq(readingSessions.userId, userId));

  const weekly = await db
    .select({
      id: books.id,
      title: books.title,
      target: books.dailyPageTarget,
      actual: sql<number>`coalesce(sum(${readingSessions.pagesRead}), 0)`,
    })
    .from(books)
    .leftJoin(
      readingSessions,
      and(
        eq(readingSessions.bookId, books.id),
        sql`${readingSessions.startedAt} >= date_trunc('week', now())`,
      ),
    )
    .where(and(eq(books.userId, userId), eq(books.status, "reading"), isNull(books.archivedAt)))
    .groupBy(books.id, books.title, books.dailyPageTarget);

  return {
    total: Number(counts?.total ?? 0),
    reading: Number(counts?.reading ?? 0),
    completed: Number(counts?.completed ?? 0),
    wantToRead: Number(counts?.wantToRead ?? 0),
    paused: Number(counts?.paused ?? 0),
    pagesRead: Number(pages?.pagesRead ?? 0),
    totalSeconds: Number(pages?.totalSeconds ?? 0),
    pagesThisWeek: Number(pages?.pagesThisWeek ?? 0),
    booksFinishedThisYear: Number(counts?.booksFinishedThisYear ?? 0),
    weeklyTargets: weekly
      .filter((row) => row.target && row.target > 0)
      .map((row) => {
        const target = Number(row.target) * 7;
        const actual = Number(row.actual);
        return {
          id: row.id,
          title: row.title,
          target,
          actual,
          percent: target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0,
        };
      }),
  };
}

export async function bookOptions(userId: string) {
  const rows = await db
    .select({ id: books.id, title: books.title, author: books.author, status: books.status })
    .from(books)
    .where(and(eq(books.userId, userId), isNull(books.archivedAt)))
    .orderBy(desc(books.updatedAt))
    .limit(200);
  return rows;
}

export async function domainOptions(userId: string) {
  const rows = await db
    .select({ id: polymathDomains.id, name: polymathDomains.name, category: polymathDomains.category })
    .from(polymathDomains)
    .where(and(eq(polymathDomains.userId, userId), isNull(polymathDomains.archivedAt)))
    .orderBy(polymathDomains.sortOrder, polymathDomains.name);
  return rows;
}

export async function readingStreak(userId: string): Promise<{ current: number; longest: number }> {
  const rows = await db
    .select({ day: sql<string>`to_char(date(${readingSessions.startedAt}), 'YYYY-MM-DD')` })
    .from(readingSessions)
    .where(and(eq(readingSessions.userId, userId), sql`${readingSessions.pagesRead} > 0`))
    .groupBy(sql`to_char(date(${readingSessions.startedAt}), 'YYYY-MM-DD')`);

  const days = rows.map((row) => row.day).sort();
  if (days.length === 0) return { current: 0, longest: 0 };

  const set = new Set(days);
  const has = (key: string) => set.has(key);
  const keyOf = (d: Date) => d.toISOString().slice(0, 10);

  // Current streak tolerates "today not logged yet" by starting from yesterday.
  let current = 0;
  const cursor = new Date();
  if (!has(keyOf(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (has(keyOf(cursor))) {
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i += 1) {
    if (i === 0) run = 1;
    else {
      const prev = new Date(`${days[i - 1]}T00:00:00Z`);
      const gap = (new Date(`${days[i]}T00:00:00Z`).getTime() - prev.getTime()) / MS_PER_DAY;
      run = gap === 1 ? run + 1 : 1;
    }
    longest = Math.max(longest, run);
  }

  return { current, longest };
}

export type { Book };
export const BOOK_STATUSES: BookStatus[] = ["want_to_read", "reading", "paused", "completed"];

export async function countBooksByStatus(userId: string, statuses: BookStatus[]) {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(books)
    .where(and(eq(books.userId, userId), inArray(books.status, statuses), isNull(books.archivedAt)));
  return Number(row?.n ?? 0);
}
