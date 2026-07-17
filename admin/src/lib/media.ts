import { api } from "./api";
import type { ItemResponse, Media } from "../types/api";

/** Uploads one file to POST /media and returns the stored media row. */
export async function uploadMedia(file: File): Promise<Media> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<ItemResponse<Media>>("/media", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}
