import { requireUser } from "@/server/auth/session";
import { TasksBoard, type TaskRow } from "@/components/tasks/TasksBoard";
import { getTaskBuckets } from "@/server/services/tasks";
import { getOptionsAction } from "@/server/services/options-actions";
import { todayKey } from "@/server/lib/time";

export const dynamic = "force-dynamic";

function toRow(task: Awaited<ReturnType<typeof getTaskBuckets>>["today"][number]): TaskRow {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    courseCode: task.courseCode,
    projectName: task.projectName,
    estimatedMinutes: task.estimatedMinutes,
  };
}

export default async function TasksPage() {
  const user = await requireUser();
  const dayKey = todayKey(user.timezone);
  const [buckets, options] = await Promise.all([getTaskBuckets(user.id, user.timezone), getOptionsAction()]);

  return (
    <TasksBoard
      today={dayKey}
      options={options.ok ? options.data : { courses: [], books: [], projects: [], goals: [] }}
      buckets={{
        today: buckets.today.map(toRow),
        overdue: buckets.overdue.map(toRow),
        upcoming: buckets.upcoming.map(toRow),
        someday: buckets.someday.map(toRow),
        done: buckets.recentlyCompleted.map(toRow),
      }}
    />
  );
}
