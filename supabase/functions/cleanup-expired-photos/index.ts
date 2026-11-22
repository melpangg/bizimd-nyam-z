import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cleanupSecret = Deno.env.get("PHOTO_CLEANUP_SECRET");
const MAX_PHOTOS_PER_RUN = 100;
const PHOTO_PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[/][0-9]{13}-[A-Za-z0-9.-]{1,973}$/i;

declare global {
  namespace Deno {
    type Request = globalThis.Request;
  }
}

type SafeError = {
  message: string;
  code?: string;
  statusCode?: number;
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isValidPhotoPath(path: unknown, uploadedBy: unknown): path is string {
  return typeof path === "string"
    && typeof uploadedBy === "string"
    && path.slice(0, 36).toLowerCase() === uploadedBy.toLowerCase()
    && path.length <= 1024
    && PHOTO_PATH_PATTERN.test(path);
}

function describeError(error: unknown, redactions: string[]): SafeError {
  const details = typeof error === "object" && error !== null
    ? error as { message?: unknown; code?: unknown; statusCode?: unknown }
    : {};
  let message = error instanceof Error
    ? error.message
    : typeof details.message === "string" ? details.message : "Beklenmeyen hata";

  for (const secret of redactions) {
    if (secret) message = message.split(secret).join("[redacted]");
  }

  const result: SafeError = { message: message.slice(0, 500) };
  if (typeof details.code === "string") result.code = details.code.slice(0, 64);
  if (typeof details.statusCode === "number") result.statusCode = details.statusCode;
  return result;
}

async function matchesCleanupSecret(providedSecret: string, expectedSecret: string) {
  const encoder = new TextEncoder();
  const [providedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(providedSecret)),
    crypto.subtle.digest("SHA-256", encoder.encode(expectedSecret)),
  ]);
  const providedBytes = new Uint8Array(providedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < providedBytes.length; index++) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

Deno.serve(async (request: Deno.Request) => {
  if (!cleanupSecret) {
    console.error(JSON.stringify({ event: "photo_cleanup_config_error", missing: "PHOTO_CLEANUP_SECRET" }));
    return jsonResponse({ error: "Server configuration is incomplete" }, 500);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const providedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!providedSecret || !await matchesCleanupSecret(providedSecret, cleanupSecret)) {
    console.warn(JSON.stringify({ event: "photo_cleanup_unauthorized" }));
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(JSON.stringify({
      event: "photo_cleanup_config_error",
      supabaseUrlConfigured: Boolean(supabaseUrl),
      serviceRoleKeyConfigured: Boolean(serviceRoleKey),
    }));
    return jsonResponse({ error: "Server configuration is incomplete" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const redactions = [supabaseUrl, serviceRoleKey, cleanupSecret];

  try {
    const { data: expiredPhotos, error: selectError } = await supabase
      .from("photos")
      .select("id,uploaded_by,storage_path")
      .lte("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true })
      .limit(MAX_PHOTOS_PER_RUN);

    if (selectError) {
      const details = describeError(selectError, redactions);
      console.error(JSON.stringify({ event: "photo_cleanup_query_failed", error: details }));
      return jsonResponse({ error: "Expired photos could not be loaded" }, 500);
    }

    let recordsDeleted = 0;
    let storageObjectsDeleted = 0;
    let skippedInvalidPaths = 0;
    const failed: Array<{ id: string; stage: string; error: SafeError }> = [];

    for (const photo of expiredPhotos ?? []) {
      const photoId = typeof photo.id === "string" ? photo.id : "unknown";
      if (!isValidPhotoPath(photo.storage_path, photo.uploaded_by)) {
        skippedInvalidPaths++;
        failed.push({
          id: photoId,
          stage: "validate_path",
          error: { message: "Invalid photo storage path; no deletion was attempted." },
        });
        console.warn(JSON.stringify({ event: "photo_cleanup_invalid_path", photoId }));
        continue;
      }

      try {
        const { error: storageError } = await supabase.storage
          .from("love-photos")
          .remove([photo.storage_path]);
        if (storageError) {
          const details = describeError(storageError, [...redactions, photo.storage_path]);
          failed.push({ id: photoId, stage: "storage_delete", error: details });
          console.error(JSON.stringify({
            event: "photo_cleanup_storage_delete_failed",
            photoId,
            error: details,
          }));
          continue;
        }
        storageObjectsDeleted++;

        const { data: deletedRows, error: databaseError } = await supabase
          .from("photos")
          .delete()
          .eq("id", photo.id)
          .lte("expires_at", new Date().toISOString())
          .select("id");
        if (databaseError) {
          const details = describeError(databaseError, [...redactions, photo.storage_path]);
          failed.push({ id: photoId, stage: "database_delete", error: details });
          console.error(JSON.stringify({
            event: "photo_cleanup_database_delete_failed",
            photoId,
            error: details,
          }));
          continue;
        }

        if (deletedRows?.length) recordsDeleted++;
      } catch (error) {
        const details = describeError(error, [...redactions, photo.storage_path]);
        failed.push({ id: photoId, stage: "processing", error: details });
        console.error(JSON.stringify({
          event: "photo_cleanup_processing_failed",
          photoId,
          error: details,
        }));
      }
    }

    const result = {
      processed: expiredPhotos?.length ?? 0,
      storageObjectsDeleted,
      recordsDeleted,
      skippedInvalidPaths,
      failed,
    };
    if (failed.length) {
      console.warn(JSON.stringify({ event: "photo_cleanup_partial_failure", ...result }));
      return jsonResponse(result, 207);
    }

    console.info(JSON.stringify({ event: "photo_cleanup_completed", ...result }));
    return jsonResponse(result, 200);
  } catch (error) {
    const details = describeError(error, redactions);
    console.error(JSON.stringify({ event: "photo_cleanup_unexpected_failure", error: details }));
    return jsonResponse({ error: "Photo cleanup failed" }, 500);
  }
});
