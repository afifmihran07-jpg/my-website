import "server-only";
import { z } from "zod";

import {
  dateKey,
  iso,
  optionalInt,
  optionalText,
  requiredText,
  uuid,
} from "@/server/services/common-validation";
import type { BookWithStats } from "@/server/services/books";
import { BOOK_STATUS_NAMES } from "@/lib/labels";

/**
 * Book validation + wire format.
 *
 * Lives outside the `"use server"` module: Next requires every export of a
 * server-action file to be an async function, and client components need these
 * schemas and the serialiser for form state.
 */

export const bookStatus = z.enum(BOOK_STATUS_NAMES);

export const createBookSchema = z.object({
  title: requiredText(200, "Title"),
  author: optionalText(160, "Author"),
  totalPages: optionalInt(1, 50_000, "Page count"),
  status: bookStatus.default("want_to_read"),
  targetFinishDate: dateKey,
  dailyPageTarget: optionalInt(1, 5000, "Daily page target"),
  domainId: uuid,
});

export const updateBookSchema = createBookSchema.partial().extend({
  rating: optionalInt(1, 5, "Rating"),
  review: optionalText(8000, "Review"),
  archived: z.boolean().optional(),
});

export const logReadingSchema = z.object({
  bookId: z.uuid("Choose a book"),
  pagesTo: z.coerce.number().int("Pages must be a whole number").min(0, "Pages cannot be negative").max(50_000),
  durationMinutes: optionalInt(0, 24 * 60, "Duration"),
  notes: optionalText(4000, "Notes"),
});

export type CreateBookInput = z.input<typeof createBookSchema>;
export type UpdateBookInput = z.input<typeof updateBookSchema>;
export type LogReadingInput = z.input<typeof logReadingSchema>;

export function serializeBook(book: BookWithStats) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    totalPages: book.totalPages,
    currentPage: book.currentPage,
    status: book.status,
    startedAt: iso(book.startedAt),
    finishedAt: iso(book.finishedAt),
    targetFinishDate: book.targetFinishDate,
    dailyPageTarget: book.dailyPageTarget,
    rating: book.rating,
    review: book.review,
    domainId: book.domainId,
    domainName: book.domainName,
    progressPercent: book.progressPercent,
    pagesRead: book.pagesRead,
    sessionsCount: book.sessionsCount,
    totalSeconds: book.totalSeconds,
    recentPagesPerDay: book.recentPagesPerDay,
    daysToTarget: book.daysToTarget,
    requiredPagesPerDay: book.requiredPagesPerDay,
    createdAt: iso(book.createdAt),
    updatedAt: iso(book.updatedAt),
  };
}

export type SerializedBook = ReturnType<typeof serializeBook>;

export function serializeReadingSession(session: {
  id: string;
  bookId: string;
  pagesFrom: number;
  pagesTo: number;
  pagesRead: number;
  startedAt: Date | string;
  durationSeconds: number;
  notes: string | null;
  bookTitle?: string;
}) {
  return {
    id: session.id,
    bookId: session.bookId,
    bookTitle: session.bookTitle ?? null,
    pagesFrom: session.pagesFrom,
    pagesTo: session.pagesTo,
    pagesRead: session.pagesRead,
    startedAt: iso(session.startedAt),
    durationSeconds: session.durationSeconds,
    notes: session.notes,
  };
}

export type SerializedReadingSession = ReturnType<typeof serializeReadingSession>;