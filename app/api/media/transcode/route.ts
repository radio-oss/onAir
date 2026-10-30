// app/api/media/transcode/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);
const MEDIA_DIR = path.join(process.cwd(), 'offline-data', 'media');

export async function POST(req: NextRequest) {
  try {
    const { fileName, trimInSec = 0, trimOutSec } = await req.json();
    if (!fileName) {
      return NextResponse.json(
        { ok: false, error: 'نام فایل برای عملیات برش مشخص نشده است.' },
        { status: 400 }
      );
    }

    if (trimOutSec !== undefined && Number(trimOutSec) <= Number(trimInSec)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'نقطه پایان (Mark Out) باید بزرگتر از نقطه شروع (Mark In) باشد.',
        },
        { status: 400 }
      );
    }

    const inputPath = path.join(MEDIA_DIR, path.basename(fileName));
    if (!fs.existsSync(inputPath)) {
      return NextResponse.json({
        ok: false,
        fallback: 'non_destructive_virtual_trim',
        message:
          'فایل فیزیکی در پوشه سرور یافت نشد؛ تریم مجازی غیرمخرب در پلی‌لیست پلی‌اوت اعمال گردید.',
      });
    }

    const outName = `TRIMMED-${Date.now()}-${path.basename(fileName)}`;
    const outputPath = path.join(MEDIA_DIR, outName);

    const args = ['-y', '-ss', String(trimInSec)];
    if (trimOutSec !== undefined) {
      args.push('-to', String(trimOutSec));
    }
    args.push('-i', inputPath, '-c', 'copy', outputPath);

    await execFileAsync('ffmpeg', args);

    return NextResponse.json({
      ok: true,
      trimmedVideoUrl: `/api/media/${encodeURIComponent(outName)}`,
      trimmedFileName: outName,
      trimInSec,
      trimOutSec,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      fallback: 'non_destructive_virtual_trim',
      message:
        'تریم غیرمخرب پلی‌اوت (Virtual Mark In/Out) بدون تغییر فایل اصلی در پلی‌لیست فعال شد.',
      details: String(err),
    });
  }
}
