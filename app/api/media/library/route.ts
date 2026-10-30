import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const MEDIA_DIR = path.join(process.cwd(), 'offline-data', 'media');
const WATCH_FOLDER = path.join(process.cwd(), 'offline-data', 'watchfolder');

const ALLOWED_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  '.mxf',
  '.ts',
]);

export interface LocalMediaFileEntry {
  fileName: string;
  videoUrl: string;
  sizeBytes: number;
  sizeMB: string;
  modifiedAt: string;
  extension: string;
  detectedVersion: string;
  integrityStatus: 'valid' | 'corrupted_zero_byte';
  checksumShort: string;
}

export async function GET() {
  try {
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.mkdir(WATCH_FOLDER, { recursive: true });

    const entries = await fs.readdir(MEDIA_DIR, { withFileTypes: true });
    const files: LocalMediaFileEntry[] = [];
    let totalBytes = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      const fullPath = path.join(MEDIA_DIR, entry.name);
      const stat = await fs.stat(fullPath);
      totalBytes += stat.size;

      // Extract version tag if filename starts with v1-, v2-, etc.
      const verMatch =
        entry.name.match(/^v(\d+)-/i) || entry.name.match(/[-_]v(\d+)\./i);
      const detectedVersion = verMatch ? `v${verMatch[1]}` : 'v1';

      if (stat.size === 0) {
        errors.push(
          `خطای سلامت فایل: «${entry.name}» دارای حجم ۰ بایت (ناقص در انتقال شبکه) است.`
        );
        files.push({
          fileName: entry.name,
          videoUrl: `/api/media/${encodeURIComponent(entry.name)}`,
          sizeBytes: 0,
          sizeMB: '0.00',
          modifiedAt: stat.mtime.toLocaleString('fa-IR'),
          extension: ext.replace('.', '').toUpperCase(),
          detectedVersion,
          integrityStatus: 'corrupted_zero_byte',
          checksumShort: 'INVALID-0B',
        });
        continue;
      }

      // Compute fast deterministic fingerprint from file metadata + header bytes
      const fd = await fs.open(fullPath, 'r');
      const headerBuf = Buffer.alloc(Math.min(4096, stat.size));
      await fd.read(headerBuf, 0, headerBuf.length, 0);
      await fd.close();

      const checksumShort = crypto
        .createHash('sha256')
        .update(headerBuf)
        .update(String(stat.size))
        .digest('hex')
        .slice(0, 12)
        .toUpperCase();

      files.push({
        fileName: entry.name,
        videoUrl: `/api/media/${encodeURIComponent(entry.name)}`,
        sizeBytes: stat.size,
        sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
        modifiedAt: stat.mtime.toLocaleString('fa-IR'),
        extension: ext.replace('.', '').toUpperCase(),
        detectedVersion,
        integrityStatus: 'valid',
        checksumShort,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        storagePath: MEDIA_DIR,
        watchFolderPath: WATCH_FOLDER,
        totalFiles: files.length,
        totalSizeMB: (totalBytes / (1024 * 1024)).toFixed(2),
        files,
        errors,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'خطا در خواندن مخزن متمرکز فایل‌های ویدئویی در سرور محلی',
        details: String(err),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { fileName } = await req.json();
    if (!fileName) {
      return NextResponse.json(
        { ok: false, error: 'نام فایل مشخص نشده است.' },
        { status: 400 }
      );
    }
    const safeName = path.basename(fileName);
    const fullPath = path.join(MEDIA_DIR, safeName);
    await fs.unlink(fullPath);
    return NextResponse.json({ ok: true, deleted: safeName });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'خطا در حذف فایل از استوریج محلی',
        details: String(err),
      },
      { status: 500 }
    );
  }
}
