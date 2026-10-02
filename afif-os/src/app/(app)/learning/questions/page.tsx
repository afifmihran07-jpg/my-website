import { requireUser } from "@/server/auth/session";
import { QuestionsClient } from "@/components/questions/QuestionsClient";
import { bookOptions, domainOptions } from "@/server/services/books";
import { courseOptions } from "@/server/services/achievements";
import { conceptOptions, listQuestions } from "@/server/services/learning";
import { serializeQuestion } from "@/server/services/learning-validation";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const user = await requireUser();

  const [questions, courses, books, concepts, domains] = await Promise.all([
    listQuestions(user.id),
    courseOptions(user.id),
    bookOptions(user.id),
    conceptOptions(user.id),
    domainOptions(user.id),
  ]);

  return (
    <QuestionsClient
      questions={questions.map(serializeQuestion)}
      courses={courses}
      books={books.map((book) => ({ id: book.id, name: book.title }))}
      concepts={concepts}
      domains={domains}
      timeZone={user.timezone}
    />
  );
}
