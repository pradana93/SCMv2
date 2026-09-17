// Dispatcher replacing base44.functions.invoke().
// Keeps the same contract: invoke(name, payload) -> { data: <result> }.

import { manageUsers } from './manageUsers';
import { accurateApi } from './accurateApi';
import { parsePdfReport } from './parsePdf';

const HANDLERS = {
  manageUsers,
  accurateApi,
  parsePdfReport,
};

export const functionsCompat = {
  async invoke(name, payload = {}) {
    const handler = HANDLERS[name];
    if (!handler) {
      const err = new Error(`Unknown function: ${name}`);
      err.status = 404;
      throw err;
    }
    try {
      const result = await handler(payload);
      return { data: result };
    } catch (e) {
      // Preserve Base44 error shape (message + status) for existing UI handlers
      const err = new Error(e.message || 'Function failed');
      err.status = e.status || 500;
      err.data = e.data;
      throw err;
    }
  },
};
