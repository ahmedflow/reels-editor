// أدوات الرسم المشتركة بين القوالب والرسمات المكتوبة لكل تسجيل
import React from 'react';
import {rgba} from './theme.js';

export {rgba};
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = (k) => 1 - Math.pow(1 - clamp(k), 3);
export const easeInOut = (k) => {
  k = clamp(k);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
// رقم يطلع من صفر لواحد، بدايته at ومدّته dur
export const prog = (t, at, dur = 0.3) => ease((t - at) / dur);
// ظهور ناعم: يبان ويرتفع شوي ويكبر لحجمه ثم يثبت
export const enter = (t, at, dur = 0.28) => {
  const k = prog(t, at, dur);
  return {opacity: k, transform: `translateY(${(1 - k) * 18}px) scale(${0.96 + 0.04 * k})`};
};

export const Box = ({children, hot, th, style}) => (
  <div
    style={{
      background: hot ? th.acc : rgba(th.ink, 0.08),
      color: hot ? th.onAcc : th.ink,
      border: hot ? 'none' : `3px solid ${rgba(th.ink, 0.16)}`,
      borderRadius: 28,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      ...style,
    }}
  >
    {children}
  </div>
);
