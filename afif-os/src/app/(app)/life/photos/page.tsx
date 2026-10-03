import { requireUser } from "@/server/auth/session";
import { PhotosClient } from "@/components/life/PhotosClient";
import { listPhotos } from "@/server/services/life";
import { serializePhoto } from "@/server/services/life-validation";

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const user = await requireUser();
  const photos = await listPhotos(user.id);

  return <PhotosClient photos={photos.map(serializePhoto)} timeZone={user.timezone} />;
}
