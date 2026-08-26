// One-off utility: uploads email assets (logo) to Supabase Storage public bucket.
// Usage: node src/scripts/upload-email-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET = 'email-assets';
const LOGO_PATH = path.resolve(__dirname, '../../../client/src/assets/main_logo.png');

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
    if (error) throw error;
    console.log(`Created public bucket: ${BUCKET}`);
  } else {
    console.log(`Bucket exists: ${BUCKET}`);
  }
}

async function upload(filePath, destName) {
  const body = fs.readFileSync(filePath);
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(destName, body, { contentType: 'image/png', upsert: true });
  if (error) throw error;
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(destName);
  console.log(`Uploaded ${destName} -> ${data.publicUrl}`);
  return data.publicUrl;
}

try {
  await ensureBucket();
  await upload(LOGO_PATH, 'main_logo.png');
} catch (err) {
  console.error('Upload failed:', err.message);
  process.exit(1);
}
