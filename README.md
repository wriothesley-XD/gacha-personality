# ✦ Gacha Personality — Dokumentasi Project

## 📁 Struktur Folder

```
gacha-personality/
│
├── index.html              ← Halaman utama (Frontend)
├── style.css               ← Semua styling (Frontend)  
├── script.js               ← Semua logika aplikasi (Frontend)
│
├── characters.json         ← Database karakter (bisa diedit manual)
├── characters_fixed.json   ← Backup jika characters.json rusak
├── character_template.json ← Template untuk menambah karakter baru
│
├── images/                 ← Foto karakter bawaan
│   ├── clorinde.png
│   ├── phainon.png
│   └── ... (dst)
│
├── sounds/                 ← File suara karakter bawaan
│   ├── clorinde.mp3
│   ├── phainon.mp3
│   └── ... (dst)
│
└── README.md               ← Dokumentasi ini
```

---

## ⚠️ Arsitektur: Pure Frontend (Tanpa Backend/Server)

Project ini tidak menggunakan backend. Data disimpan di:

| Data | Disimpan Di | Catatan |
|------|-------------|---------|
| Karakter bawaan | script.js + characters.json | Tidak bisa dihapus |
| Karakter custom | localStorage browser | Permanen sampai clear cache |
| Foto karakter baru | localStorage (Base64) | File dikonversi otomatis |
| Suara karakter baru | localStorage (Base64) | File dikonversi otomatis |
| Mapping nama | localStorage | Permanen sampai clear cache |

---

## 🔧 Cara Menambah Karakter Baru

1. Buka web → klik Kelola Karakter
2. Isi form: nama, gender, deskripsi, dll
3. Klik Pilih Foto → upload gambar (max 2MB)
4. Klik Pilih Suara → upload MP3 (max 5MB)
5. Klik Tambah Karakter
6. PENTING: Backup via tab Import/Export → Download Backup JSON

---

## 💾 Backup & Restore

Export: Kelola Karakter → Import/Export → Download Backup JSON
Import: Kelola Karakter → Import/Export → Pilih File JSON

---

## 🗺️ Alur Sistem

User input nama → Pilih mode (Mirip/Pasangan/Acak/Jelajah)
→ Jawab pertanyaan (jika mode quiz)
→ Hitung trait match
→ Tampilkan karakter + persentase + suara otomatis

---

## 🔗 Mapping Nama

Nama tertentu → langsung dapat karakter spesifik tanpa quiz.
Kelola di: Kelola Karakter → Tab Mapping

---

## 🖥️ Cara Jalankan

Buka index.html langsung di browser.
Untuk characters.json eksternal bekerja, gunakan server lokal:
  python -m http.server 8080
  lalu buka http://localhost:8080
