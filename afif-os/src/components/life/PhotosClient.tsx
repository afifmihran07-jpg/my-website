"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
} from "@/components/ui/primitives";
import { formatShortDate } from "@/lib/format";
import { addPhotoAction, updatePhotoAction } from "@/server/services/life-actions";
import type { SerializedPhoto } from "@/server/services/life-validation";

const emptyForm = {
  path: "",
  caption: "",
  takenAt: "",
  tags: "",
  location: "",
};

export function PhotosClient({ photos, timeZone }: { photos: SerializedPhoto[]; timeZone: string }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SerializedPhoto | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(photo: SerializedPhoto) {
    setEditing(photo);
    setForm({
      path: photo.path,
      caption: photo.caption ?? "",
      takenAt: photo.takenAt ? photo.takenAt.slice(0, 16) : "",
      tags: photo.tags.join(", "),
      location: photo.location ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload = {
      caption: form.caption,
      takenAt: form.takenAt ? new Date(form.takenAt).toISOString() : null,
      tags: form.tags,
      location: form.location,
    };
    const result = editing
      ? await updatePhotoAction(editing.id, payload)
      : await addPhotoAction({ ...payload, path: form.path });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function archive(photo: SerializedPhoto) {
    setBusy(true);
    const result = await updatePhotoAction(photo.id, { archived: true });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  const allTags = [...new Set(photos.flatMap((photo) => photo.tags))];

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <Alert variant="info" title="Photos are referenced, not stored">
        This deployment keeps the caption, date, location and tags in PostgreSQL and points at a file path or URL.
        It does not hold the image bytes — so nothing here invents an upload that is not wired up.
      </Alert>

      <Card>
        <CardHeader
          title="Photos"
          subtitle={`${photos.length} saved${allTags.length ? ` · ${allTags.length} tags` : ""}`}
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add photo
            </Button>
          }
        />
        {photos.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="h-8 w-8" />}
            title="No photos yet"
            description="Add the path or URL of a photo along with when and where it was taken."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add your first
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-md border border-border">
                {/^https?:\/\//.test(photo.path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.path} alt={photo.caption ?? "Photo"} className="h-40 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-muted/40 text-xs text-muted-foreground">
                    <span className="max-w-[90%] truncate px-2">{photo.path}</span>
                  </div>
                )}
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{photo.caption ?? "Untitled"}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {photo.takenAt ? formatShortDate(photo.takenAt, timeZone) : "Date not set"}
                    {photo.location ? ` · ${photo.location}` : ""}
                  </p>
                  {photo.tags.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {photo.tags.map((tag) => (
                        <Badge key={tag} tone="neutral">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(photo)} aria-label="Edit photo">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => archive(photo)} disabled={busy} aria-label="Archive photo">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit photo" : "Add a photo"}
        description="A URL renders as a preview; a file path is stored as text."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} disabled={!form.path.trim()}>
              {editing ? "Save changes" : "Add photo"}
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Path or URL"
            required
            className="sm:col-span-2"
            hint={editing ? "The path cannot be changed after adding — add a new photo instead." : undefined}
          >
            <Input
              value={form.path}
              disabled={Boolean(editing)}
              onChange={(event) => setForm({ ...form, path: event.target.value })}
              placeholder="https://… or /photos/2026-01-04.jpg"
            />
          </Field>
          <Field label="Caption" className="sm:col-span-2">
            <Input value={form.caption} onChange={(event) => setForm({ ...form, caption: event.target.value })} />
          </Field>
          <Field label="Taken at">
            <Input type="datetime-local" value={form.takenAt} onChange={(event) => setForm({ ...form, takenAt: event.target.value })} />
          </Field>
          <Field label="Location">
            <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Dhaka" />
          </Field>
          <Field label="Tags" className="sm:col-span-2" hint="Comma separated">
            <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="family, trip" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
