# reels-editor

محرّر ريلز لـ Claude مبني على Remotion. تعطيه تسجيل لشخص يتكلم قدام الكاميرا ويرجّعه مقطع طولي قصير: يقصّ الوقفات الفاضية، يحرّك الكادر مع كل قصّة، يكتب الكلام على الشاشة كلمة بكلمة، ويرسم لكل فيديو رسمات متحركة تخصه. التعليمات بلهجة سعودية، ويشتغل على ويندوز وماك.

## التنصيب

افتح Claude واكتب له:

```
نصّب لي هالمهارة https://github.com/ahmedflow/reels-editor
```

أو نزّلها بنفسك من الطرفية داخل مجلد المهارات.

ويندوز (PowerShell):

```powershell
git clone https://github.com/ahmedflow/reels-editor "$env:USERPROFILE\.claude\skills\reels-editor"
```

ماك:

```bash
git clone https://github.com/ahmedflow/reels-editor ~/.claude/skills/reels-editor
```

أول مرة تستخدمها، المهارة تنزّل أدواتها بنفسها بعد ما تستأذنك (قرابة 2 قيقا).

## وش تحتاج

- Node 18 أو أحدث. لو مو موجود المهارة تنزّله.
- على ماك: أدوات البناء حقت أبل (`xcode-select --install`).
- نت وقت الرندر، لأن الخطوط تتحمّل من Google Fonts.

## الرخص

- **المهارة نفسها:** رخصة MIT (ملف `LICENSE`).

- **Remotion:** مجاني للأفراد، وللشركات لين 3 موظفين، وللجهات غير الربحية. الشركات الأكبر تحتاج رخصة مدفوعة من https://remotion.dev/license
- **موديل رصد الوجه** (`engine/models/face.onnx`): Ultra-Light-Fast-Generic-Face-Detector، رخصة MIT.
- **whisper.cpp:** رخصة MIT.
- **الخطوط** (IBM Plex Sans Arabic، Readex Pro، Almarai): رخصة OFL.

## الحالة

مجرّبة على ويندوز. نسخة الماك مكتوبة متوافقة لكنها ما انجرّبت على جهاز ماك فعلي.
