// app/api/media/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const MEDIA_DIR = path.join(process.cwd(), 'offline-data', 'media');

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.mxf': 'application/mxf',
  '.ts': 'video/mp2t',
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const rawName = decodeURIComponent(resolvedParams.filename || '');
    const safeName = path.basename(rawName);
    const filePath = path.join(MEDIA_DIR, safeName);

    const buffer = await fs.readFile(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'فایل مدیای درخواستی در مخزن سرور یافت نشد.' },
      { status: 404 }
    );
  }
}
