// Supabase Storage replacement for base44.integrations.Core.UploadFile.
// Returns { file_url } like the Base44 SDK.

import { supabase } from './supabaseClient';

const BUCKET = 'uploads';

function extOf(name) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name || '');
  return m ? `.${m[1].toLowerCase()}` : '';
}

export const integrationsCompat = {
  Core: {
    async UploadFile({ file }) {
      if (!file) throw new Error('No file provided');
      const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9._-]+/g, '_');
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}${''}`;
      void extOf;
      const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
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
