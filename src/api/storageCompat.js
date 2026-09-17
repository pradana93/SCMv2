// Supabase Storage replacement for base44.integrations.Core.UploadFile.
// Returns { file_url } like the Base44 SDK.

import { supabase } from './supabaseClient';

const BUCKET = 'uploads';

// Camera photos are huge (several MB) and slow/fragile on mobile data — and
// big bitmaps raise the chance the OS kills the tab mid-upload. Downscale
// photos in-browser before upload (proof photos don't need 12MP).
// Returns the original file for non-images, small files, or on any failure.
async function maybeCompressImage(file, maxDim = 1600, quality = 0.82) {
  try {
    if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) return file;
    if (file.size < 400 * 1024) return file;
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
    if (!bitmap) return file;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width || 1, bitmap.height || 1));
    if (scale >= 1) {
      try {
        bitmap.close();
      } catch {
        // ignore
      }
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      try {
        bitmap.close();
      } catch {
        // ignore
      }
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    try {
      bitmap.close();
    } catch {
      // ignore
    }
    const blob = await new Promise((resolve) => {
      try {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      } catch {
        resolve(null);
      }
    });
    if (!blob) return file;
    const base = (file.name || 'photo').replace(/\.[a-zA-Z0-9]+$/, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function extOf(name) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name || '');
  return m ? `.${m[1].toLowerCase()}` : '';
}

export const integrationsCompat = {
  Core: {
    async UploadFile({ file }) {
      if (!file) throw new Error('No file provided');
      const compact = await maybeCompressImage(file);
      const payload = compact || file;
      const safeName = (payload.name || 'upload').replace(/[^a-zA-Z0-9._-]+/g, '_');
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}${''}`;
      void extOf;
      const { error } = await supabase.storage.from(BUCKET).upload(key, payload, {
        cacheControl: '3600',
        upsert: false,
        contentType: payload.type || undefined,
      });
      if (error) throw new Error(error.message || 'Upload failed');
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
      return { file_url: data.publicUrl };
    },

    // Base44 LLM helper used only by parsePdfReport backend fn.
    // In the independent app, PDF parsing runs locally (see functions/parsePdf.js).
    async InvokeLLM() {
      throw new Error('InvokeLLM is not available in the independent app. Use functions/parsePdf instead.');
    },
  },
};
