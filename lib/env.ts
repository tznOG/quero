import { getDatabase } from './sqlite';

// Lazy initialization avoids creating a database during the image build.
export const env = {
  get DB() {
    return getDatabase();
  },
  get SERPAPI_KEY() {
    return process.env.SERPAPI_KEY;
  },
  get RESEND_API_KEY() {
    return process.env.RESEND_API_KEY;
  },
  get MAIL_FROM() {
    return process.env.MAIL_FROM;
  },
};
