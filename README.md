# 📦 Hadya Sklad Backend

Bu loyiha **Hadya** shirinlik korxonasi uchun ombor (sklad) va moliyaviy balans boshqaruvi tizimining
backend qismidir. U Node.js, Express.js va MongoDB texnologiyalaridan foydalangan holda ishlab chiqilgan.

## 🚀 Asosiy Imkoniyatlar

- 🧁 **Mahsulotlar boshqaruvi** – mahsulotlar, narxlar, ingredientlar.
- 🖼️ **Base64 rasmlar** – mahsulot rasmlari base64 formatida saqlanadi.
- 🥣 **Ingredientlar nazorati** – har bir mahsulot tarkibidagi ingredientlar va ularning ombordagi miqdori.
- 👨‍🍳 **Cheflar bilan bog'liq logika** – har bir mahsulot yoki tranzaksiya qaysi oshpaz (chef) tomonidan tayyorlanganligi qayd etiladi.
- 📉 **Balans monitoringi** – mahsulot sotilishi va boshqa pul oqimlari (kirim/chiqim) asosida balans hisoblanadi.
- 💸 **Tranzaksiyalar tarixi** – barcha sotuvlar, xarajatlar va tushumlar alohida log qilinadi.
- 📊 **Statistik tahlillar** (frontend orqali kengaytiriladi).

## 🖼️ Rasm Yuklash Yangiligi

Endi mahsulot rasmlari **base64** formatida saqlanadi. Bu quyidagi afzalliklarni beradi:
- ✅ Sodda deployment (fayl tizimi zarur emas)
- ✅ Atom operatsiyalar (rasm va ma'lumot birgalikda saqlanadi)
- ✅ Portable ma'lumotlar bazasi
- ✅ Xavfsizlik (fayl tizimiga kirish zarur emas)

Batafsil ma'lumot uchun: [Base64 Images Documentation](./docs/BASE64_IMAGES.md)

---

## 🛠 Texnologiyalar

- **Node.js** – server ishlovi uchun
- **Express.js** – REST API lar uchun
- **MongoDB + Mongoose** – ma'lumotlar bazasi va ORM
- **JWT** – autentifikatsiya
- **dotenv** – maxfiy sozlamalar uchun

---

## 📂 Loyihaning Tuzilishi

```
hadya-sklad-backend/
│
├── controllers/       # API funksiyalari
├── models/            # Mongoose modellari
├── routes/            # API yo‘llari
├── middleware/        # Auth va boshqa oraliq funksiyalar
├── utils/             # Yordamchi funksiyalar
├── config/            # Bazaga ulanish va sozlamalar
├── .env               # Maxfiy sozlamalar (token, db URI)
├── server.js          # Asosiy kirish fayli
└── package.json       # Loyiha ma'lumotlari va scriptlar
```

---

## ⚙️ O‘rnatish

1. Reponi klon qiling:

```bash
git clone https://github.com/UlugbekMirdadayev/hadya-sklad-backend.git
cd hadya-sklad-backend
```

2. Bog‘liqliklarni o‘rnating:

```bash
npm install
```

3. `.env` faylini yarating va quyidagilarni yozing:

```env
PORT=8080
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

4. Serverni ishga tushuring:

```bash
npm run dev
```

---

## 📌 API Yo‘llari (asosiylari)

| Yo‘l              | Tavsif                            | Metod |
|-------------------|------------------------------------|-------|
| `/api/products`   | Mahsulotlar CRUD                  | GET/POST/PUT/DELETE |
| `/api/ingredients`| Ingredientlar CRUD                | GET/POST/PUT/DELETE |
| `/api/inventory`  | Ombor holatini boshqarish         | GET/POST/PUT/DELETE |
| `/api/balance`    | Umumiy balansni ko‘rish           | GET |
| `/api/transaction/sell`     | Mahsulot sotish va kirim      | POST |
| `/api/transaction/cash-out` | Naqd chiqim (xarajat)         | POST |

---

## 🔐 Autentifikatsiya

API lar `Bearer Token` asosida himoyalangan. Kirish uchun admin foydalanuchi roli mavjud.

---

## 👨‍🍳 Cheflar Logikasi

- Har bir mahsulot uchun `chef` maydoni mavjud (masalan: kim tayyorladi, kim bezadi).
- Tranzaksiyalarda `chef` lar ishtiroki alohida log qilinadi.
- Har bir mahsulot + chef kombinatsiyasi bo‘yicha ombor alohida yuritiladi.

---

## 📝 Litsenziya

Bu loyiha shaxsiy foydalanish uchun mo‘ljallangan. Tarqatish va ko‘paytirish faqat loyiha egasining ruxsati bilan.

---

## 🤝 Muallif

**Ulug‘bek Mirdadayev**  
📧 ulugbekmirdadayev1211@gmail.com  
🔗 [GitHub Profilim](https://github.com/UlugbekMirdadayev)