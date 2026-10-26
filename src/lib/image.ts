/**
 * Reduz a foto da câmera (vários MB) para um JPEG pequeno, ~30–60 KB,
 * que cabe no IndexedDB e no backup JSON sem pesar.
 */
export async function compressImage(file: File, maxSide = 640, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}
