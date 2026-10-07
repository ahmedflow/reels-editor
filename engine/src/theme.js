// باقات الألوان: bg خلفية اللوحات · ink النص · acc التمييز · onAcc النص فوق التمييز · soft لون ثانوي هادي
export const PALETTES = {
  mono: {name: 'أسود وأبيض', bg: '#0B0B0C', ink: '#FFFFFF', acc: '#FFFFFF', onAcc: '#0B0B0C', soft: '#8E8E93'},
  nakheel: {name: 'نخيل', bg: '#0C3B2E', ink: '#F6F1E7', acc: '#C5E86C', onAcc: '#0C3B2E', soft: '#8DB5A4'},
  annabi: {name: 'عنّابي', bg: '#4A0E1F', ink: '#FFF3EC', acc: '#FF9FB0', onAcc: '#4A0E1F', soft: '#C48A96'},
  bahr: {name: 'بحر', bg: '#06283D', ink: '#EAF6FF', acc: '#4CC2FF', onAcc: '#06283D', soft: '#7FA6BD'},
  fajr: {name: 'فجر', bg: '#211A3D', ink: '#F4F0FF', acc: '#FFB86B', onAcc: '#211A3D', soft: '#9C92C4'},
  ramli: {name: 'رملي', bg: '#F1E7D3', ink: '#2A2118', acc: '#D9482B', onAcc: '#FFFFFF', soft: '#8C7B66'},
  thalj: {name: 'ثلجي', bg: '#F7F8FA', ink: '#14171F', acc: '#2F5BFF', onAcc: '#FFFFFF', soft: '#7C8496'},
};

export function resolveTheme(plan) {
  const base = PALETTES[plan?.palette] || PALETTES.mono;
  return {...base, ...(plan?.colors || {})};
}

export const rgba = (hex, a) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
