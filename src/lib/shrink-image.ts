// Browser only: uses createImageBitmap and canvas.

/** Sharp enough to read text, yet each image is only a few hundred KB. */
const MAX_WIDTH = 900;

/** Shrink images on the client. An iPhone original is 2-3 MB; sending 5 is slow and costly. */
export async function shrink(file: File): Promise<{ mimeType: string; data: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { mimeType: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
}
