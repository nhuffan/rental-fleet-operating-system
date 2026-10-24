"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EvidenceUploadAuthorization, EvidenceUpload } from "../types";
import { EvidenceError, evidenceRequest, signedStorageUpload } from "./client";
import { prepareMedia, type PreparedMedia } from "./prepare-media";
import { mediaLimits, type MediaKind } from "./media-policy";
import { transferMedia } from "./transfer-media";
export const evidenceCategories = {
  FRONT: "Phía trước",
  REAR: "Phía sau",
  LEFT: "Bên trái",
  RIGHT: "Bên phải",
  INTERIOR: "Nội thất",
  DASHBOARD: "Đồng hồ / nhiên liệu",
  DAMAGE: "Hư hỏng",
  OTHER: "Khác",
} as const;
export type EvidenceCategory = keyof typeof evidenceCategories;
export type EvidenceTask = {
  id: string;
  original: File;
  originalUrl: string;
  preparedUrl?: string;
  posterUrl?: string;
  prepared?: PreparedMedia;
  kind: MediaKind;
  category: EvidenceCategory;
  stage:
    | "preparing"
    | "compressing"
    | "ready"
    | "uploading"
    | "verifying"
    | "verified"
    | "failed"
    | "cancelled";
  progress: number;
  error?: string;
  authorization?: EvidenceUploadAuthorization;
};
export function useEvidenceDraft(
  rentalId: string,
  businessId: string,
  type: "HANDOVER" | "RETURN",
) {
  const router = useRouter();
  const [tasks, setTasks] = useState<EvidenceTask[]>([]);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const items = useRef<EvidenceTask[]>([]);
  const active = useRef<AbortController | null>(null);
  const activeId = useRef<string | null>(null);
  const workingRef = useRef(false);
  const disposed = useRef(false);
  const urls = useRef(new Set<string>());
  const completed = useRef(false);
  const path = `/rentals/${rentalId}/evidence/uploads`;
  const update = useCallback((id: string, value: Partial<EvidenceTask>) => {
    items.current = items.current.map((item) =>
      item.id === id ? { ...item, ...value } : item,
    );
    if (!disposed.current) setTasks([...items.current]);
  }, []);
  function objectUrl(blob: Blob) {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  }
  function release(item: EvidenceTask) {
    for (const url of [item.originalUrl, item.preparedUrl, item.posterUrl])
      if (url) {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }
  }
  async function prepare(item: EvidenceTask, controller: AbortController) {
    update(item.id, { stage: "compressing", progress: 0, error: undefined });
    const prepared = await prepareMedia(
      item.original,
      item.kind,
      controller.signal,
      (progress) => update(item.id, { progress }),
    );
    if (controller.signal.aborted || disposed.current)
      throw new DOMException("Đã hủy", "AbortError");
    update(item.id, {
      prepared,
      preparedUrl: objectUrl(prepared.blob),
      posterUrl: prepared.poster ? objectUrl(prepared.poster) : undefined,
      stage: "ready",
      progress: 100,
    });
  }
  async function run(job: () => Promise<void>) {
    if (workingRef.current) return;
    workingRef.current = true;
    setWorking(true);
    try {
      await job();
    } finally {
      workingRef.current = false;
      active.current = null;
      activeId.current = null;
      if (!disposed.current) setWorking(false);
    }
  }
  async function add(files: FileList | null, kind: MediaKind) {
    if (!files?.length || workingRef.current) return;
    setMessage("");
    const maximum =
      kind === "IMAGE" ? mediaLimits.maxImages : mediaLimits.maxVideos;
    const available =
      maximum -
      items.current.filter(
        (item) => item.kind === kind && item.stage !== "cancelled",
      ).length;
    if (files.length > available) {
      setMessage(
        `Mỗi biên bản tối đa ${mediaLimits.maxImages} ảnh và ${mediaLimits.maxVideos} video. Hãy chọn ít file hơn.`,
      );
      return;
    }
    const added = Array.from(files).map((original) => ({
      id: crypto.randomUUID(),
      original,
      originalUrl: objectUrl(original),
      kind,
      category: "OTHER" as const,
      stage: "preparing" as const,
      progress: 0,
    }));
    items.current = [...items.current, ...added];
    setTasks([...items.current]);
    await run(async () => {
      for (const item of added) {
        if (disposed.current) break;
        if (!items.current.some((value) => value.id === item.id)) continue;
        const controller = new AbortController();
        active.current = controller;
        activeId.current = item.id;
        try {
          await prepare(item, controller);
        } catch (error) {
          update(item.id, {
            stage: controller.signal.aborted ? "cancelled" : "failed",
            error:
              error instanceof Error
                ? error.message
                : "Không thể chuẩn bị file.",
          });
        }
      }
    });
  }
  async function uploadOne(id: string) {
    let item = items.current.find((item) => item.id === id);
    if (!item || item.stage === "verified" || item.stage === "cancelled")
      return;
    const controller = new AbortController();
    active.current = controller;
    activeId.current = id;
    try {
      if (!item.prepared) {
        await prepare(item, controller);
        item = items.current.find((value) => value.id === id)!;
      }
      const prepared = item.prepared!;
      if (
        items.current
          .filter((value) => value.stage !== "cancelled")
          .reduce((sum, value) => sum + (value.prepared?.blob.size ?? 0), 0) >
        mediaLimits.maxInspectionBytes
      )
        throw new Error("Tổng ảnh/video sau nén vượt 20 MB. Hãy bỏ bớt file.");
      const selected = item;
      await transferMedia({
        authorization: selected.authorization,
        signal: controller.signal,
        authorize: () =>
          evidenceRequest<EvidenceUploadAuthorization>(
            businessId,
            path,
            "POST",
            {
              idempotencyKey: selected.id,
              type,
              kind: selected.kind,
              category: selected.category,
              mimeType: prepared.blob.type,
              bytes: prepared.blob.size,
            },
            controller.signal,
          ),
        verify: (authorization) =>
          evidenceRequest<EvidenceUpload>(
            businessId,
            `${path}/${authorization.id}/verify`,
            "POST",
            {},
            controller.signal,
          ),
        upload: (authorization) =>
          signedStorageUpload(
            authorization.signedUrl,
            prepared.blob,
            controller.signal,
            (progress) => update(id, { progress }),
          ),
        onAuthorized: (authorization) => update(id, { authorization }),
        onStage: (stage) =>
          update(id, { stage, progress: 0, error: undefined }),
      });
      update(id, { stage: "verified", progress: 100 });
    } catch (error) {
      if (error instanceof EvidenceError && error.status === 401)
        router.replace("/login");
      if (controller.signal.aborted) {
        const authorization = items.current.find(
          (value) => value.id === id,
        )?.authorization;
        if (authorization)
          void evidenceRequest(
            businessId,
            `${path}/${authorization.id}/cancel`,
            "POST",
            {},
          ).catch(() => undefined);
      }
      update(id, {
        stage: controller.signal.aborted ? "cancelled" : "failed",
        error:
          error instanceof Error ? error.message : "Không thể upload file.",
      });
    }
  }
  async function upload(id?: string) {
    await run(async () => {
      for (const item of [...items.current])
        if ((!id || item.id === id) && ["ready", "failed"].includes(item.stage))
          await uploadOne(item.id);
    });
  }
  async function remove(id: string) {
    const item = items.current.find((item) => item.id === id);
    if (!item) return;
    if (active.current && activeId.current === item.id) active.current.abort();
    if (item.authorization)
      void evidenceRequest(
        businessId,
        `${path}/${item.authorization.id}/cancel`,
        "POST",
        {},
      ).catch(() => undefined);
    release(item);
    items.current = items.current.filter((value) => value.id !== id);
    setTasks([...items.current]);
  }
  function cancelActive() {
    if (activeId.current) void remove(activeId.current);
  }
  function validate() {
    const selected = items.current.filter((item) => item.stage !== "cancelled");
    if (
      workingRef.current ||
      selected.some((item) => item.stage !== "verified")
    )
      return "Chờ upload và kiểm tra xong tất cả file, hoặc bỏ các file chưa hoàn tất.";
    if (
      selected.some(
        (item) =>
          !item.authorization ||
          new Date(item.authorization.expiresAt).getTime() <= Date.now(),
      )
    )
      return "Có phiên chứng cứ hết hạn. Bỏ file đó và chọn lại trước khi xác nhận.";
    return "";
  }
  useEffect(() => {
    disposed.current = false;
    const allUrls = urls.current;
    return () => {
      disposed.current = true;
      active.current?.abort();
      for (const url of allUrls) URL.revokeObjectURL(url);
      allUrls.clear();
      for (const item of items.current)
        if (
          item.authorization &&
          (!completed.current || item.stage !== "verified")
        )
          void evidenceRequest(
            businessId,
            `${path}/${item.authorization.id}/cancel`,
            "POST",
            {},
          ).catch(() => undefined);
    };
  }, [businessId, path]);
  return {
    tasks,
    message,
    working,
    add,
    upload,
    remove,
    cancelActive,
    validate,
    uploadedIds: tasks
      .filter((item) => item.stage === "verified" && item.authorization)
      .map((item) => item.authorization!.id),
    markAttached: () => {
      completed.current = true;
    },
    setCategory: (id: string, category: EvidenceCategory) =>
      update(id, { category }),
  };
}
