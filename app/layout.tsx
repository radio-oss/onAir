import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'شبکه اصفهان',
  description: 'سامانه جامع مدیریت و تنظیم جدول کنداکتور پخش شبکه اصفهان',
  openGraph: {
    title: 'شبکه اصفهان',
    description: 'سامانه جامع مدیریت و تنظیم جدول کنداکتور پخش شبکه اصفهان',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className="dark">
      <body
        suppressHydrationWarning
        className="bg-slate-950 text-slate-100 antialiased selection:bg-teal-500/30 selection:text-teal-200 min-h-screen"
        style={{
          fontFamily:
            'Vazirmatn, IRANSans, Tahoma, "Segoe UI", system-ui, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
