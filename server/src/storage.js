import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

// Local-disk storage for attachments. Only this module knows what a
// storage_path means, so moving to S3 or MinIO later replaces this file and
// nothing else.

const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// Accepted types, identified by their leading bytes. The browser's declared
// MIME type and the file extension are both attacker-controlled; the content
// is checked against them, never the other way round.
const TYPES = {
  'application/pdf': { ext: '.pdf', magic: Buffer.from('%PDF-') },
  'image/png': { ext: '.png', magic: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  'image/jpeg': { ext: '.jpg', magic: Buffer.from([0xff, 0xd8, 0xff]) },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', magic: ZIP },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', magic: ZIP },
};

export const ACCEPTED_TYPES = Object.keys(TYPES);

/** The accepted type the bytes match, or null. */
export function detectType(buffer, declaredMime) {
  const type = TYPES[declaredMime];
  if (!type) return null;
  const head = buffer.subarray(0, type.magic.length);
  return head.equals(type.magic) ? { mime: declaredMime, ext: type.ext } : null;
}

/**
 * A display name safe to store and echo back in a download header: path
 * components stripped, control characters, quotes and slashes replaced.
 */
export function cleanFileName(name) {
  const base = path
    .basename(String(name ?? 'file'))
    .replace(/[\p{Cc}"\\/]/gu, '_');
  return base.slice(0, 200) || 'file';
}

function resolveInside(storagePath) {
  const full = path.resolve(config.uploadDir, storagePath);
  // storage_path always comes from our own database, but a path that resolves
  // outside the upload directory is refused rather than trusted.
  if (!full.startsWith(config.uploadDir + path.sep)) {
    throw new Error(`storage path escapes the upload directory: ${storagePath}`);
  }
  return full;
}

/** Writes the bytes under a generated name; returns the storage_path to record. */
export async function saveFile(buffer, ext) {
  const now = new Date();
  const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const storagePath = `${dir}/${crypto.randomUUID()}${ext}`;
  const full = resolveInside(storagePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer, { flag: 'wx' });
  return storagePath;
}

export function absolutePath(storagePath) {
  return resolveInside(storagePath);
}

/** Best-effort removal; a file that is already gone is not an error. */
export async function removeFile(storagePath) {
  try {
    await fs.unlink(resolveInside(storagePath));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`could not remove ${storagePath}:`, err.message);
    }
  }
}
