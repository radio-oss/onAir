// app/api/backup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'offline-data');

const STATE_FILES = {
  schedule: 'conductor-state.json',
  audit: 'audit-trail.json',
  cg: 'cg-state.json',
  auth: 'roles-auth.json',
};

async function readJsonSafe(fileName: string) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, fileName), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const [schedule, audit, cg, auth] = await Promise.all([
      readJsonSafe(STATE_FILES.schedule),
      readJsonSafe(STATE_FILES.audit),
      readJsonSafe(STATE_FILES.cg),
      readJsonSafe(STATE_FILES.auth),
    ]);

    const bundle = {
      bundleVersion: '2.0',
      exportedAt: new Date().toISOString(),
      station: 'IRIB Isfahan - Jahan-Nama Network',
      data: {
        schedule,
        audit,
        cg,
        auth,
      },
    };

    return NextResponse.json(bundle, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="irib-isfahan-full-backup-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'خطا در ایجاد فایل پشتیبان جامع سرور',
        details: String(err),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const bundle = await req.json();
    const data = bundle?.data;

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'ساختار فایل پشتیبان جامع معتبر نیست.' },
        { status: 400 }
      );
    }

    if (data.schedule) {
      await fs.writeFile(
        path.join(DATA_DIR, STATE_FILES.schedule),
        JSON.stringify(data.schedule, null, 2),
        'utf-8'
      );
    }
    if (data.audit) {
      await fs.writeFile(
        path.join(DATA_DIR, STATE_FILES.audit),
        JSON.stringify(data.audit, null, 2),
        'utf-8'
      );
    }
    if (data.cg) {
      await fs.writeFile(
        path.join(DATA_DIR, STATE_FILES.cg),
        JSON.stringify(data.cg, null, 2),
        'utf-8'
      );
    }
    if (data.auth) {
      await fs.writeFile(
        path.join(DATA_DIR, STATE_FILES.auth),
        JSON.stringify(data.auth, null, 2),
        'utf-8'
      );
    }

    return NextResponse.json({
      ok: true,
      restoredAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'خطا در بازیابی فایل پشتیبان جامع سرور',
        details: String(err),
      },
      { status: 500 }
    );
  }
}
