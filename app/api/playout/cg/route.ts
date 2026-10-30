// app/api/playout/cg/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
export interface OnAirGraphicsState {
  showChannelBug: boolean;
  showLiveBadge: boolean;
  showClockOverlay: boolean;
  showCrawlTicker: boolean;
  crawlText: string;
  lowerThirdTitle: string;
  lowerThirdSubtitle: string;
  showLowerThird: boolean;
}

const DEFAULT_GRAPHICS_STATE: OnAirGraphicsState = {
  showChannelBug: true,
  showLiveBadge: false,
  showClockOverlay: true,
  showCrawlTicker: true,
  crawlText:
    'بینندگان عزیز شبکه اصفهان؛ سریال شبانگاهی «نون خ» امشب ساعت ۱۸:۱۵ و فیلم سینمایی «موقعیت مهدی» ساعت ۲۱:۴۵ پخش خواهد شد.',
  lowerThirdTitle: 'برنامه زنده صبح نصف جهان',
  lowerThirdSubtitle: 'ارتباط مستقیم با اداره کل هواشناسی استان اصفهان',
  showLowerThird: false,
};

const DATA_DIR = path.join(process.cwd(), 'offline-data');
const CG_FILE = path.join(DATA_DIR, 'cg-state.json');

async function readCgState(): Promise<OnAirGraphicsState> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(CG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_GRAPHICS_STATE,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
    };
  } catch {
    const serialized = JSON.stringify(DEFAULT_GRAPHICS_STATE, null, 2);
    await fs.writeFile(CG_FILE, serialized, 'utf-8');
    return DEFAULT_GRAPHICS_STATE;
  }
}

export async function GET() {
  const state = await readCgState();
  return NextResponse.json(state, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  try {
    const nextState = (await req.json()) as OnAirGraphicsState;
    const safeState =
      nextState && typeof nextState === 'object'
        ? { ...DEFAULT_GRAPHICS_STATE, ...nextState }
        : DEFAULT_GRAPHICS_STATE;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      CG_FILE,
      JSON.stringify(safeState, null, 2) || '{}',
      'utf-8'
    );
    return NextResponse.json({ ok: true, state: safeState });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Failed to persist CG state on LAN', details: String(err) },
      { status: 500 }
    );
  }
}
