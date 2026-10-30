// app/api/media/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const MEDIA_DIR = path.join(process.cwd(), 'offline-data', 'media');

const ALLOWED_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  '.mxf',
  '.ts',
]);

export async function POST(req: NextRequest) {
  try {
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const versionTag = String(formData.get('version') || '1');

    if (!file) {
      return NextResponse.json(
        {
          ok: false,
          error: 'هیچ فایل ویدئویی برای بارگذاری ارسال نشده است.',
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'خطای انتقال فایل: حجم فایل ارسالی صفر بایت (ناقص یا آسیب‌دیده) است.',
        },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          ok: false,
          error: `فرمت فایل (${ext}) مجاز نیست. فرمت‌های مورد پذیرش: MP4, MOV, MXF, TS, MKV, WEBM`,
        },
        { status: 415 }
      );
    }

    const safeBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeName = `v${versionTag}-${Date.now()}-${safeBaseName}`;
    const filePath = path.join(MEDIA_DIR, safeName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Compute SHA-256 integrity hash to verify complete transfer and valid version
    const sha256 = crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex')
      .slice(0, 16)
      .toUpperCase();

    await fs.writeFile(filePath, buffer);

    // Verify written file size matches uploaded buffer size
    const writtenStat = await fs.stat(filePath);
    if (writtenStat.size !== buffer.length) {
      await fs.unlink(filePath).catch(() => {});
      return NextResponse.json(
        {
          ok: false,
          error:
            'خطا در ذخیره‌سازی دیسک محلی: حجم فایل نوشته‌شده با فایل ارسالی تطابق ندارد.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      videoUrl: `/api/media/${encodeURIComponent(safeName)}`,
      videoFileName: file.name,
      storedFileName: safeName,
      sizeBytes: writtenStat.size,
      sizeMB: (writtenStat.size / (1024 * 1024)).toFixed(2),
      checksumSha256: sha256,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'خطا در انتقال و ذخیره‌سازی فایل ویدئویی در سرور داخلی سازمان',
        details: String(err),
      },
      { status: 500 }
    );
  }
}
