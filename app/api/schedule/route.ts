// app/api/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { ATTACHED_CONDUCTOR_SCHEDULE } from '@/lib/conductor-data';

const DATA_DIR = path.join(process.cwd(), 'offline-data');
const SCHEDULE_FILE = path.join(DATA_DIR, 'conductor-state.json');
const BACKUP_FILE = path.join(DATA_DIR, 'conductor-backup.json');

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(SCHEDULE_FILE);
  } catch {
    await fs.writeFile(
      SCHEDULE_FILE,
      JSON.stringify(ATTACHED_CONDUCTOR_SCHEDULE, null, 2),
      'utf-8'
    );
  }
}

export async function GET() {
  try {
    await ensureDataFile();
    const raw = await fs.readFile(SCHEDULE_FILE, 'utf-8');
    return NextResponse.json(JSON.parse(raw), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(ATTACHED_CONDUCTOR_SCHEDULE, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDataFile();
    const updatedSchedule = await req.json();
    if (!updatedSchedule || !Array.isArray(updatedSchedule.items)) {
      return NextResponse.json(
        { error: 'ساختار داده ارسالی کنداکتور نامعتبر است.' },
        { status: 400 }
      );
    }

    // Create atomic local backup before writing new state
    try {
      await fs.copyFile(SCHEDULE_FILE, BACKUP_FILE);
    } catch {
      // Ignore if initial file does not exist yet
    }

    const serialized =
      JSON.stringify(updatedSchedule, null, 2) ||
      JSON.stringify(ATTACHED_CONDUCTOR_SCHEDULE, null, 2);
    await fs.writeFile(SCHEDULE_FILE, serialized, 'utf-8');

    return NextResponse.json({
      ok: true,
      updatedAt: updatedSchedule.updatedAt,
      itemCount: updatedSchedule.items.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'خطا در ذخیره‌سازی وضعیت کنداکتور روی سرور شبکه محلی (LAN)',
        details: String(err),
      },
      { status: 500 }
    );
  }
}
