"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import { createBook, getBook, logReading, updateBook } from "@/server/services/books";
import {
  createBookSchema,
  logReadingSchema,
  serializeBook,
  serializeReadingSession,
  updateBookSchema,
  type SerializedBook,
  type SerializedReadingSession,
} from "@/server/services/books-validation";

async function currentUserId(): Promise<string | null> {
  const record = await getSessionUser();
  return record?.user.id ?? null;
}

function revalidate() {
  revalidatePath("/learning/books");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/analytics");
}

export async function createBookAction(input: unknown): Promise<ActionResult<SerializedBook>> {
  return safeAction("book:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createBookSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the book details");

    const book = await createBook({ ...parsed.data, userId });
    const full = await requireBook(userId, book.id);
    revalidate();
    return ok(full);
  });
}

export async function updateBookAction(bookId: string, input: unknown): Promise<ActionResult<SerializedBook>> {
  return safeAction("book:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = updateBookSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the book details");

    const updated = await updateBook(userId, bookId, parsed.data);
    if (!updated) return fail("That book no longer exists.");

    const full = await requireBook(userId, updated.id);
    revalidate();
    return ok(full);
  });
}

export async function logReadingAction(
  input: unknown,
): Promise<ActionResult<{ book: SerializedBook; session: SerializedReadingSession }>> {
  return safeAction("book:logReading", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = logReadingSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the reading entry");

    try {
      const { session, book } = await logReading({ ...parsed.data, userId });
      const full = await requireBook(userId, book.id);
      revalidate();
      return ok({ book: full, session: serializeReadingSession(session) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save the reading session";
      return fail(message);
    }
  });
}

async function requireBook(userId: string, bookId: string): Promise<SerializedBook> {
  const book = await getBook(userId, bookId);
  if (!book) throw new Error("Book not found");
  return serializeBook(book);
}
