import { requireUser } from "@/server/auth/session";
import { NotesClient } from "@/components/notes/NotesClient";
import { bookOptions, domainOptions } from "@/server/services/books";
import { listNotes, noteTags } from "@/server/services/learning";
import { serializeNote } from "@/server/services/learning-validation";
import { projectOptions } from "@/server/services/projects";
import { conceptOptions } from "@/server/services/learning";
import { courseOptions } from "@/server/services/achievements";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const user = await requireUser();

  const [notes, tags, courses, books, concepts, projects, domains] = await Promise.all([
    listNotes(user.id),
    noteTags(user.id),
    courseOptions(user.id),
    bookOptions(user.id),
    conceptOptions(user.id),
    projectOptions(user.id),
    domainOptions(user.id),
  ]);

  return (
    <NotesClient
      notes={notes.map(serializeNote)}
      tags={tags}
      courses={courses}
      books={books.map((book) => ({ id: book.id, name: book.title }))}
      concepts={concepts}
      projects={projects.map((project) => ({ id: project.id, name: project.name }))}
      domains={domains}
      timeZone={user.timezone}
    />
  );
}
