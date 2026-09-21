"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadBase64Image = uploadBase64Image;
exports.resolvePhotoUrl = resolvePhotoUrl;
const supabase_js_1 = require("../lib/supabase.js");
/**
 * Загружает base64-изображение в Supabase Storage (бакет 'stores')
 * и возвращает публичный URL.
 *
 * @param base64Image - строка вида "data:image/png;base64,..."
 * @param pathPrefix  - префикс пути в бакете (например, "products" или "store_abc123")
 * @returns публичный URL загруженного файла, или null при ошибке парсинга
 */
async function uploadBase64Image(base64Image, pathPrefix) {
    const matches = base64Image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return null;
    }
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const ext = contentType.split('/')[1] || 'png';
    const filePath = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase_js_1.supabaseAdmin.storage
        .from('stores')
        .upload(filePath, buffer, { contentType, upsert: true });
    if (error) {
        console.error('[Storage Upload Error]:', error.message);
        throw new Error(`Ошибка загрузки файла: ${error.message}`);
    }
    const { data } = supabase_js_1.supabaseAdmin.storage.from('stores').getPublicUrl(filePath);
    return data.publicUrl;
}
/**
 * Если передан base64_image — загружает и возвращает URL.
 * Иначе возвращает переданный photo_url (или null).
 *
 * Это удобная обёртка для контроллеров, где может прийти
 * либо прямая ссылка, либо base64.
 */
async function resolvePhotoUrl(base64Image, photoUrl, pathPrefix = 'products') {
    if (base64Image) {
        return uploadBase64Image(base64Image, pathPrefix);
    }
    return photoUrl || null;
}
