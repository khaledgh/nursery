import { api } from "./api";
import type { ItemResponse, Media } from "../types/api";

interface PresignUploadResponse {
  media_id: number;
  upload_url: string;
}

/**
 * Uploads a file straight to R2, bypassing this API for the bytes: reserve a
 * key (POST /media/presign-upload) -> PUT the file directly to the returned
 * URL -> tell the API the upload landed (POST /media/:id/confirm).
 */
export async function uploadMedia(file: File): Promise<Media> {
  const presign = await api.post<ItemResponse<PresignUploadResponse>>("/media/presign-upload", {
    mime: file.type,
    size: file.size,
  });
  const { media_id, upload_url } = presign.data.data;

  const put = await fetch(upload_url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!put.ok) {
    throw new Error(`upload to storage failed with status ${put.status}`);
  }

  const confirmed = await api.post<ItemResponse<Media>>(`/media/${media_id}/confirm`);
  return confirmed.data.data;
}
