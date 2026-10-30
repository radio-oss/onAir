// app/api/media/watchfolder/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WATCH_FOLDER = path.join(process.cwd(), 'offline-data', 'watchfolder');
const MEDIA_DIR = path.join(process.cwd(), 'offline-data', 'media');

const ALLOWED_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  '.mxf',
  '.ts',
]);

export async function GET() {
  try {
    await fs.mkdir(WATCH_FOLDER, { recursive: true });
    await fs.mkdir(MEDIA_DIR, { recursive: true });

    const entries = await fs.readdir(WATCH_FOLDER, { withFileTypes: true });
    const detectedFiles: Array<{
      fileName: string;
      sizeBytes: number;
      sizeMB: string;
      modifiedAt: string;
      videoUrl: string;
      status: 'ready' | 'corrupted';
    }> = [];
    const transferErrors: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      const srcPath = path.join(WATCH_FOLDER, entry.name);
      const srcStat = await fs.stat(srcPath);

      if (srcStat.size === 0) {
        transferErrors.push(
          `فایل «${entry.name}» دارای حجم صفر بایت (انتقال ناقص در شبکه) است.`
        );
        continue;
      }

      const destPath = path.join(MEDIA_DIR, entry.name);

      try {
        await fs.access(destPath);
      } catch {
        await fs.copyFile(srcPath, destPath);
      }

      const stat = await fs.stat(destPath);
      detectedFiles.push({
        fileName: entry.name,
        sizeBytes: stat.size,
        sizeMB: (stat.size / (1024 * 1024)).toFixed(1),
        modifiedAt: stat.mtime.toISOString(),
        videoUrl: `/api/media/${encodeURIComponent(entry.name)}`,
        status: stat.size === srcStat.size ? 'ready' : 'corrupted',
      });
    }

    return NextResponse.json({
      ok: true,
      watchFolderPath: WATCH_FOLDER,
      files: detectedFiles,
      transferErrors,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'خطا در بررسی پوشه شبکه داخلی (Watch-Folder)',
        details: String(err),
      },
      { status: 500 }
    );
  }
}
