export async function prepareWallpaper(source: Blob | string): Promise<Uint8Array<ArrayBuffer>> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error("无法解码壁纸，请选择有效图片"));
      value.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("壁纸尺寸无效");
    const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前环境无法压缩图片");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (type: string) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("压缩壁纸失败")), type, 0.82);
    });
    let compressed = await encode("image/webp");
    if (compressed.type !== "image/webp") compressed = await encode("image/jpeg");
    if (compressed.size > 10 * 1024 * 1024) throw new Error("压缩后的壁纸仍超过 10MB");
    return new Uint8Array(await compressed.arrayBuffer());
  } finally { if (typeof source !== "string") URL.revokeObjectURL(url); }
}
