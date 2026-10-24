import {
  fittedSize,
  mediaLimits,
  originalVideoAllowed,
  videoEncoder,
  type MediaKind,
} from "./media-policy";
export type PreparedMedia = {
  blob: Blob;
  width: number;
  height: number;
  durationSeconds: number | null;
  message: string;
  poster: Blob | null;
};
function stopped(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Đã hủy", "AbortError");
}
function canvasBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob?.size
          ? resolve(blob)
          : reject(
              new Error(
                "Trình duyệt không thể mã hóa ảnh. Vui lòng thử ảnh khác.",
              ),
            ),
      mime,
      quality,
    ),
  );
}
async function imageSource(
  file: File,
  signal: AbortSignal,
): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      if (signal.aborted) {
        bitmap.close();
        stopped(signal);
      }
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch (error) {
      stopped(signal);
      if (error instanceof DOMException && error.name === "AbortError")
        throw error;
    }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        image.onload = null;
        image.onerror = null;
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Đã hủy", "AbortError"));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Không đọc được ảnh trong thời gian cho phép."));
      }, 15000);
      image.onload = () => {
        cleanup();
        resolve();
      };
      image.onerror = () => {
        cleanup();
        reject(
          new Error("Không đọc được ảnh. Hãy chọn JPEG, PNG hoặc WebP hợp lệ."),
        );
      };
      signal.addEventListener("abort", abort, { once: true });
      image.src = url;
    });
    stopped(signal);
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => {
        image.src = "";
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
async function prepareImage(
  file: File,
  signal: AbortSignal,
  progress: (value: number) => void,
): Promise<PreparedMedia> {
  if (
    file.size > 40 * 1024 * 1024 ||
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ].includes(file.type)
  )
    throw new Error("Chọn ảnh JPEG, PNG hoặc WebP dưới 40 MB.");
  const image = await imageSource(file, signal);
  try {
    if (
      !image.width ||
      !image.height ||
      image.width * image.height > 48_000_000
    )
      throw new Error("Ảnh vượt giới hạn 48 megapixel. Hãy chọn ảnh nhỏ hơn.");
    const canvas = document.createElement("canvas");
    let output: Blob | null = null;
    for (const [round, max] of [1920, 1600].entries()) {
      const dimensions = fittedSize(image.width, image.height, max);
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context)
        throw new Error(
          "Trình duyệt chưa hỗ trợ nén ảnh. Hãy thử trình duyệt khác.",
        );
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
      for (const [index, quality] of [0.86, 0.78, 0.7, 0.62].entries()) {
        stopped(signal);
        let encoded = await canvasBlob(canvas, "image/webp", quality);
        if (encoded.type !== "image/webp")
          encoded = await canvasBlob(canvas, "image/jpeg", quality);
        if (!["image/webp", "image/jpeg"].includes(encoded.type))
          throw new Error("Không có bộ mã hóa ảnh JPEG/WebP phù hợp.");
        output = encoded;
        progress(Math.round(((round * 4 + index + 1) / 8) * 100));
        if (encoded.size <= 500 * 1024) break;
      }
      if (output && output.size <= mediaLimits.maxImageBytes) break;
    }
    stopped(signal);
    if (!output || output.size > mediaLimits.maxImageBytes)
      throw new Error(
        "Ảnh sau nén vẫn quá 1 MB. Chọn góc chụp/ảnh nhỏ hơn để giữ rõ hư hỏng.",
      );
    return {
      blob: output,
      width: canvas.width,
      height: canvas.height,
      durationSeconds: null,
      poster: null,
      message:
        "Đã xoay theo ảnh gốc, giảm kích thước và loại bỏ EXIF/GPS. Kiểm tra ảnh sau nén trước khi upload.",
    };
  } finally {
    image.close();
  }
}
function waitVideo(video: HTMLVideoElement, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadedmetadata", loaded);
      video.removeEventListener("error", error);
      signal.removeEventListener("abort", abort);
    };
    const loaded = () => {
      cleanup();
      resolve();
    };
    const error = () => {
      cleanup();
      reject(new Error("Trình duyệt không đọc được video này."));
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Đã hủy", "AbortError"));
    };
    const timer = setTimeout(error, 15000);
    video.addEventListener("loadedmetadata", loaded, { once: true });
    video.addEventListener("error", error, { once: true });
    signal.addEventListener("abort", abort, { once: true });
    video.load();
  });
}
async function prepareVideo(
  file: File,
  signal: AbortSignal,
  progress: (value: number) => void,
): Promise<PreparedMedia> {
  if (file.size > 100 * 1024 * 1024 || !file.type.startsWith("video/"))
    throw new Error("Chọn video dưới 100 MB, tối đa 30 giây.");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await waitVideo(video, signal);
    stopped(signal);
    const seconds = video.duration;
    if (
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      seconds > mediaLimits.maxVideoSeconds
    )
      throw new Error(
        "Video cần có thời lượng xác định từ hơn 0 đến 30 giây. Hãy quay clip ngắn hơn.",
      );
    if (
      !video.videoWidth ||
      !video.videoHeight ||
      Math.max(video.videoWidth, video.videoHeight) > 3840 ||
      video.videoWidth * video.videoHeight > 3840 * 2160
    )
      throw new Error(
        "Video đầu vào vượt 4K. Hãy giảm độ phân giải trước khi chọn.",
      );
    const dimensions = fittedSize(
      video.videoWidth,
      video.videoHeight,
      1280,
      720,
    );
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d", { alpha: false });
    let poster: Blob | null = null;
    const fallback = (detail: string): PreparedMedia => {
      if (
        !originalVideoAllowed(
          file.size,
          seconds,
          video.videoWidth,
          video.videoHeight,
          file.type,
        )
      )
        throw new Error(
          `${detail} File gốc chưa đạt giới hạn 12 MB / 30 giây / 1080p. Hãy giảm dung lượng hoặc quay clip ngắn hơn.`,
        );
      return {
        blob: file,
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: seconds,
        poster,
        message: `${detail} Dùng file gốc vì đã đạt giới hạn 12 MB / 30 giây / 1080p; không nén thêm.`,
      };
    };
    const mime =
      typeof MediaRecorder === "undefined"
        ? null
        : videoEncoder((value) => MediaRecorder.isTypeSupported(value));
    if (!mime || !canvas.captureStream || !context)
      return fallback("Trình duyệt không có bộ mã hóa video phù hợp.");
    try {
      const stream = canvas.captureStream(24);
      let recorder: MediaRecorder | null = null;
      let frame = 0;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: mime,
          videoBitsPerSecond: 1_800_000,
        });
        const activeRecorder = recorder;
        const output = await new Promise<Blob>((resolve, reject) => {
          const chunks: Blob[] = [];
          let total = 0;
          let finished = false;
          const cleanup = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", abort);
            video.onended = null;
            video.onerror = null;
            cancelAnimationFrame(frame);
            video.pause();
          };
          const fail = (error: Error) => {
            if (finished) return;
            finished = true;
            cleanup();
            if (activeRecorder.state !== "inactive") activeRecorder.stop();
            reject(error);
          };
          const abort = () => fail(new DOMException("Đã hủy", "AbortError"));
          const timer = setTimeout(
            () => fail(new Error("Nén video mất quá nhiều thời gian.")),
            Math.min(40000, seconds * 1000 + 7000),
          );
          const draw = () => {
            if (finished) return;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            progress(
              Math.min(99, Math.round((video.currentTime / seconds) * 100)),
            );
            frame = requestAnimationFrame(draw);
          };
          activeRecorder.ondataavailable = (event) => {
            if (event.data.size) {
              chunks.push(event.data);
              total += event.data.size;
              if (total > mediaLimits.maxVideoBytes)
                fail(new Error("Video nén vượt 12 MB."));
            }
          };
          activeRecorder.onerror = () =>
            fail(new Error("Bộ mã hóa video không hoàn thành."));
          activeRecorder.onstop = () => {
            if (finished) return;
            finished = true;
            cleanup();
            const blob = new Blob(chunks, {
              type: activeRecorder.mimeType.split(";")[0],
            });
            if (blob.size) resolve(blob);
            else reject(new Error("Video sau nén rỗng."));
          };
          video.onended = () => {
            if (activeRecorder.state !== "inactive") activeRecorder.stop();
          };
          video.onerror = () => fail(new Error("Không thể đọc hết video."));
          signal.addEventListener("abort", abort, { once: true });
          video
            .play()
            .then(() => {
              if (finished) return;
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              activeRecorder.start(500);
              draw();
              void canvasBlob(canvas, "image/jpeg", 0.75)
                .then((blob) => {
                  poster = blob;
                })
                .catch(() => undefined);
            })
            .catch(() =>
              fail(new Error("Trình duyệt chưa cho phép phát video để nén.")),
            );
        });
        stopped(signal);
        if (output.size > mediaLimits.maxVideoBytes)
          return fallback("Video sau nén vượt giới hạn.");
        return {
          blob: output,
          width: dimensions.width,
          height: dimensions.height,
          durationSeconds: seconds,
          poster,
          message:
            "Đã nén bằng bộ mã hóa trình duyệt, tối đa 720p; video minh chứng không giữ âm thanh.",
        };
      } finally {
        cancelAnimationFrame(frame);
        video.pause();
        if (recorder && recorder.state !== "inactive") recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (error) {
      stopped(signal);
      return fallback(
        error instanceof Error ? error.message : "Không thể nén video tin cậy.",
      );
    }
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
export async function prepareMedia(
  file: File,
  kind: MediaKind,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  stopped(signal);
  return kind === "IMAGE"
    ? prepareImage(file, signal, progress)
    : prepareVideo(file, signal, progress);
}
