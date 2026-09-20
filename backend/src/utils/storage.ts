import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Загружает base64-изображение в Supabase Storage (бакет 'stores')
 * и возвращает публичный URL.
 *
 * @param base64Image - строка вида "data:image/png;base64,..."
 * @param pathPrefix  - префикс пути в бакете (например, "products" или "store_abc123")
 * @returns публичный URL загруженного файла, или null при ошибке парсинга
 */
export async function uploadBase64Image(
  base64Image: string,
  pathPrefix: string
): Promise<string | null> {
  const matches = base64Image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return null;
  }

  const contentType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const ext = contentType.split('/')[1] || 'png';
  const filePath = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from('stores')
    .upload(filePath, buffer, { contentType, upsert: true });

  if (error) {
    console.error('[Storage Upload Error]:', error.message);
    throw new Error(`Ошибка загрузки файла: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from('stores').getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Если передан base64_image — загружает и возвращает URL.
 * Иначе возвращает переданный photo_url (или null).
 *
 * Это удобная обёртка для контроллеров, где может прийти
 * либо прямая ссылка, либо base64.
 */
export async function resolvePhotoUrl(
  base64Image?: string,
  photoUrl?: string | null,
  pathPrefix: string = 'products'
): Promise<string | null> {
  if (base64Image) {
    return uploadBase64Image(base64Image, pathPrefix);
  }
  return photoUrl || null;
}
