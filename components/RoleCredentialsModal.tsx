// components/RoleCredentialsModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { ROLES } from '@/lib/conductor-data';
import { X, KeyRound, Save, ShieldAlert } from 'lucide-react';

interface RoleCredentialsModalProps {
  isOpen: boolean;
  canManageSecurity: boolean;
  onClose: () => void;
  onSavedToast: (msg: string) => void;
}

export default function RoleCredentialsModal({
  isOpen,
  canManageSecurity,
  onClose,
  onSavedToast,
}: RoleCredentialsModalProps) {
  const [pins, setPins] = useState<Record<string, string>>({
    producer_editor: '1100',
    level_2: '2200',
    qc_inspector: '3300',
    level_1: '1405',
    level_3: '4400',
    operator: '5500',
    masterPin: '1405',
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/auth')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.credentials) {
            setPins(data.credentials);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSecurity) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pins),
      });
      if (res.ok) {
        onSavedToast(
          'پین‌کدهای امنیتی ۶ نقش کاربری در سرور محلی (roles-auth.json) بروزرسانی شد.'
        );
        onClose();
      }
    } catch {
      onSavedToast('خطا در ذخیره پین‌کدها روی سرور محلی.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spatial-modal-content w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">
                مدیریت احراز هویت محلی و پین‌کدهای ۶ نقش کاربری
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ذخیره‌سازی در فایل محلی{' '}
                <code className="font-mono-tabular text-teal-300">
                  ./offline-data/roles-auth.json
                </code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {!canManageSecurity && (
            <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-lg text-rose-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                تغییر پین‌کدهای سازمانی فقط با سطح دسترسی «مدیر پخش» امکان‌پذیر
                است.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLES.map((role) => (
              <div
                key={role.id}
                className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5"
              >
                <div className="font-bold text-slate-200">{role.title}</div>
                <div className="text-[11px] text-slate-400">
                  {role.personName}
                </div>
                <input
                  type="text"
                  dir="ltr"
                  required
                  disabled={!canManageSecurity}
                  value={pins[role.id] || ''}
                  onChange={(e) =>
                    setPins({ ...pins, [role.id]: e.target.value.trim() })
                  }
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-center font-mono-tabular text-teal-300 disabled:opacity-50"
                />
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-950 border border-amber-500/30 rounded-lg flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-amber-300">
                پین‌کد ارشد سازمان (Master PIN)
              </div>
              <div className="text-[11px] text-slate-400">
                قابل استفاده توسط مدیر پخش برای دسترسی اضطراری به تمامی کارتابل‌ها
              </div>
            </div>
            <input
              type="text"
              dir="ltr"
              required
              disabled={!canManageSecurity}
              value={pins.masterPin || ''}
              onChange={(e) =>
                setPins({ ...pins, masterPin: e.target.value.trim() })
              }
              className="w-28 px-3 py-1.5 bg-slate-900 border border-amber-500/50 rounded text-center font-mono-tabular font-bold text-amber-300 disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg cursor-pointer"
            >
              انصراف
            </button>
            {canManageSecurity && (
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold rounded-lg cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSaving
                    ? 'در حال ذخیره...'
                    : 'ذخیره پین‌کدها در سرور محلی'}
                </span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
