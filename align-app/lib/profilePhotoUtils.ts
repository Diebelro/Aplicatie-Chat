/** Latura lungă maximă după resize (înainte era 400px → foarte neclar pe carduri/retina). */
export const PHOTO_MAX_SIZE = 1600;
export const MAX_PHOTOS = 5;

export function resizeImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > PHOTO_MAX_SIZE || height > PHOTO_MAX_SIZE) {
        if (width > height) {
          height = (height * PHOTO_MAX_SIZE) / width;
          width = PHOTO_MAX_SIZE;
        } else {
          width = (width * PHOTO_MAX_SIZE) / height;
          height = PHOTO_MAX_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load"));
    };
    img.src = url;
  });
}
