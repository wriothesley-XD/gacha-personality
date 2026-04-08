# 📖 Panduan Lengkap Gacha Personality

**Bahasa Indonesia** | Dibuat untuk pengguna umum & admin

---

## 🎯 Daftar Isi

1. [Cara Pakai Web](#cara-pakai-web)
2. [Cara Menambah Character Baru](#cara-menambah-character-baru)
3. [Cara Edit Character](#cara-edit-character)
4. [Cara Upload Background Custom](#cara-upload-background-custom)
5. [Import Otomatis dari Excel](#import-otomatis-dari-excel)
6. [Troubleshooting & Tips](#troubleshooting--tips)

---

## 🚀 Cara Pakai Web

### Langkah 1: Buka Halaman Utama
1. Buka file `index.html` di browser (tekan `index.html` → buka dengan browser)
2. atau, jika tidak bisa, jalankan server lokal:
   ```
   python -m http.server 8080
   ```
   Lalu buka `http://localhost:8080` di browser

### Langkah 2: Masuk Nama
- Ketik nama kamu di input "✦ Masukkan nama kamu..."
- Nama ini tidak wajib, tapi membantu personalisasi hasil

### Langkah 3: Pilih Salah Satu Mode

#### 🔍 **Kamu Mirip Siapa?** (Mode Personality)
- Jawab 10 pertanyaan tentang kepribadianmu
- Setiap jawaban ada pilihan: Sangat Setuju, Setuju, Tidak Setuju
- Sistem akan menghitung trait mu (Brave, Smart, Gentle, Leader, Warm, Cautious)
- Hasil: karakter yang paling mirip dengan kepribadianmu ± persentase kecocokan

#### 💕 **Pasangan Mu?** (Mode Compatibility)
- Sama seperti mode Personality
- Tapi hasil menampilkan karakter yang paling cocok sebagai pasangan
- Kompatibilitas dihitung dari trait yang saling melengkapi

#### 🎲 **Gacha Acak**
- Langsung dapat karakter random tanpa jawab soal
- Tekan tombol → langsung keluar karakter surprise

#### 📚 **Jelajahi Karakter**
- Lihat semua karakter dalam format grid
- Filter berdasarkan:
  - **🔍 Cari nama**: ketik nama atau deskripsi
  - **Gender**: Laki-laki, Perempuan, Anomali
  - **Trait**: Brave, Smart, Gentle, Leader, Warm, Cautious
- Klik "Lihat" untuk detail lengkap karakter

### Langkah 4: Lihat Hasil
- Foto karakter
- Nama & jenis kelamin
- Deskripsi singkat & lengkap
- Trait breakdown
- Kata-kata khas yang dilakukan
- **Suara otomatis** akan diputar (klik foto untuk replay)

### Langkah 5: Mulai Lagi
- Tekan tombol di bawah hasil untuk:
  - **🔄 Gacha Ulang**: gunakan nama yang sama, gacha lagi
  - **🏠 Kembali ke Awal**: reset semua, masuk nama baru

---

## 👤 Cara Menambah Character Baru

### ⚙️ Buka Panel Admin
1. Di halaman utama, tekan tombol **"⚙️ Kelola Karakter"**
2. Atau di halaman mana pun, tekan tombol sudut kanan atas (jika ada)

### 📋 Tab "👤 Karakter" (Default)
Jika belum di tab Karakter, klik tombol **"👤 Karakter"**

### Isi Form Menambah Karakter

| Field | Penjelasan | Contoh |
|-------|-----------|--------|
| **Nama karakter** | Nama unik karakter. Jangan duplikat! | Clorinde, Phainon |
| **Gender** | Pilih: ♂ Laki-laki, ♀ Perempuan, ⚠ Anomali | ♀ Perempuan |
| **📷 Pilih Foto Karakter** | Klik untuk upload gambar. Otomatis dikonversi Base64, disimpan di browser. Max 2MB. | file.png |
| **Deskripsi Singkat** | Kalimat 1-2 baris tentang karakter. Ditampilkan di grid. | "Mantap, tegas, penuh alasan" |
| **Deskripsi Lengkap** | Cerita lebih detail tentang karakter (opsional). | "Clorinde adalah... dst" |
| **🔊 Pilih File Suara** | Klik untuk upload MP3/WAV. Otomatis Base64, disimpan di browser. Max 5MB. | voice.mp3 |
| **Kata-kata Khas** | Kutipan atau phrase unik karakter. | "Semoga besok lebih baik" |
| **Trait** | Isi angka 0-3 untuk setiap trait (semakin tinggi = semakin kuat) | Brave: 3, Smart: 2, dst |

### Trait Penjelasan

| Trait | Arti |
|-------|------|
| **⚔️ Brave** | Keberanian, agresif, berani ambil risiko |
| **🧠 Smart** | Cerdas, logis, analitik, detail |
| **🌸 Gentle** | Lembut, sensitif, perhatian, empati |
| **👑 Leader** | Kepemimpinan, dominan, tegas, pengaruhful |
| **🔥 Warm** | Hangat, ramah, positif, energik |
| **🛡️ Cautious** | Hati-hati, protektif, careful, overthinking |

### Contoh Trait Character

**Clorinde** (Pemberani):
- Brave: **3** (sangat berani)
- Smart: **2** (cukup cerdas)
- Gentle: **1** (sedikit lembut)
- Leader: **3** (leader kuat)
- Warm: **2** (cukup hangat)
- Cautious: **0** (tidak hati-hati)

**Phainon** (Cerdas & Lembut):
- Brave: **1** (kurang berani)
- Smart: **3** (sangat cerdas)
- Gentle: **3** (sangat lembut)
- Leader: **1** (tidak leader)
- Warm: **2** (cukup hangat)
- Cautious: **2** (cukup hati-hati)

### Tombol Action

- **✦ Tambah Karakter**: simpan karakter baru
- **🔄 Reset**: hapus isi form, mulai dari awal

---

## 🖊️ Cara Edit Character

### Edit Trait / Deskripsi Saja
1. Di tab "👤 Karakter", scroll ke bawah → **"Daftar Karakter"**
2. Cari karakter yang ingin diedit
3. Klik tombol **"✏️ Edit"**
4. Form akan terisi dengan data lama
5. Ubah bagian yang ingin diganti (trait, deskripsi, dst)
6. Klik **"✦ Simpan Perubahan"**

### Ganti Foto Karakter
1. Klik **"📷 Pilih Foto Karakter"** di form edit
2. Upload foto baru
3. Foto lama otomatis tergantikan
4. Klik **"✦ Simpan Perubahan"**

### Ganti Suara Karakter
1. Klik **"🔊 Pilih File Suara"** di form edit
2. Upload MP3 baru
3. Suara lama otomatis tergantikan
4. Klik **"✦ Simpan Perubahan"**

### Hapus Karakter
1. Di tab "👤 Karakter" → scroll ke **"Daftar Karakter"**
2. Cari karakter
3. Klik tombol **"🗑️ Hapus"**
4. Karakter hilang selamanya (tidak ada konfirmasi!)

---

## 🖼️ Cara Upload Background Custom

### Buka Background Panel
1. Buka **"⚙️ Kelola Karakter"**
2. Klik tab **"🖼️ Background"** di menu admin

### Upload Background Baru
1. Klik tombol **"📷 Pilih Gambar Background"**
2. Pilih gambar dari komputer
   - Format: PNG, JPG, GIF (direkomendasikan 1920x1080px atau lebih)
   - Ukuran max: 5MB
3. Gambar otomatis dikonversi Base64 & disimpan
4. Refresh halaman untuk melihat perubahan
5. Jika ingin ganti, upload gambar baru (otomatis replace)

### Reset Background
1. Jika ingin kembali ke background bawaan
2. Klik tombol **"🔄 Reset ke Background Bawaan"**
3. Refresh halaman

### Tips Background
- Gunakan gambar yang tidak terlalu terang supaya text tetap terbaca
- Gunakan gradient overlay atau semi-transparent dark untuk readability
- Ukuran file kecil = loading lebih cepat

---

## 📊 Cara Import Otomatis dari Excel

### ✨ Metode Tercepat: Pakai Python Script

Jika ingin menambah ratusan character sekaligus, gunakan file `convert.py` yang sudah disediakan.

#### Step 1: Siapkan Excel
1. Buat file Excel baru dengan nama **`template_karakter.xlsx`**
2. Letakkan di folder yang sama dengan `convert.py`
3. Struktur Excel:

   | Kolom | Isi |
   |-------|-----|
   | A | Nama karakter |
   | B | Gender (male/female/anomali) |
   | C | Path foto (opsional, misal: images/nama.png) |
   | D | Path suara (opsional, misal: sounds/nama.mp3) |
   | E | Deskripsi singkat |
   | F | Deskripsi lengkap |
   | G | Kata-kata khas |
   | H | Brave (0-3) |
   | I | Smart (0-3) |
   | J | Gentle (0-3) |
   | K | Leader (0-3) |
   | L | Warm (0-3) |
   | M | Cautious (0-3) |
   | N | Mapping nama (opsional) |

#### Step 2: Download & Install Python (Jika Belum Ada)
1. Download Python dari [python.org](https://python.org)
2. Jalankan installer, centang "Add Python to PATH"
3. Buka Command Prompt / Terminal
4. Ketik:
   ```
   pip install openpyxl
   ```

#### Step 3: Jalankan Converter
1. Buka Command Prompt / Terminal
2. Masuk ke folder project:
   ```
   cd path/ke/folder/gacha-personality
   ```
3. Jalankan script:
   ```
   python convert.py
   ```
4. Script akan membaca `template_karakter.xlsx` & output **`characters.json`**

#### Step 4: Pindah File
1. Copy file `characters.json` ke folder yang sama dengan `index.html`
2. Buka web di browser → characters akan termuat otomatis

#### Step 5: (Optional) Edit Foto & Suara Manual
1. Jika ingin tambah foto/suara sendiri untuk characters dari Excel:
   - Buka **"⚙️ Kelola Karakter"** → tab **"👤 Karakter"**
   - Cari character, klik edit
   - Upload foto baru via "📷 Pilih Foto"
   - Klik save

### Contoh Excel File (`template_karakter.xlsx`)

```
Row 1: (Header)
Row 2-onwards: Data karakter
```

Contoh isi:

| Nama | Gender | Foto | Suara | Desc | Details | Words | Brave | Smart | Gentle | Leader | Warm | Cautious | Mapping |
|------|--------|------|-------|------|---------|-------|-------|-------|--------|--------|------|----------|---------|
| Clorinde | female | images/clorinde.png | sounds/clorinde.mp3 | Tegas, mantap | Dia adalah... | Semoga besok lebih baik | 3 | 2 | 1 | 3 | 2 | 0 | clorinde,klo |
| Phainon | male | images/phainon.png | sounds/phainon.mp3 | Cerdas, lembut | Dia adalah... | Hati-hati! | 1 | 3 | 3 | 1 | 2 | 2 | phainon,phai |

### Import dari Backup JSON (Manual)

Jika sudah punya backup JSON dari export sebelumnya:

1. Buka **"⚙️ Kelola Karakter"** → tab **"📁 Import/Export"**
2. Klik **"📁 Pilih File JSON"** atau paste JSON langsung
3. Klik **"📥 Import dari Teks"**
4. Characters lama + baru akan digabung (bukan replace)

---

## 🎨 Cara Edit Halaman (HTML/CSS)

### Edit Judul Halaman
1. Buka file `index.html` dengan text editor (Notepad, VS Code, dll)
2. Cari baris:
   ```html
   <h1 class="main-title">✦ Gacha Personality</h1>
   <p class="subtitle">Temukan karakter yang cocok dengan kepribadianmu</p>
   ```
3. Ubah text sesuai keinginan:
   ```html
   <h1 class="main-title">✦ Gacha Milikmu!</h1>
   <p class="subtitle">Cari karakter yang cocok buatmu</p>
   ```

### Edit Warna Tombol
1. Buka file `style.css`
2. Cari baris:
   ```css
   .personality-btn  { background: #2563eb; }
   ```
3. Ubah kode warnanya:
   - Merah: `#ef4444`
   - Hijau: `#22c55e`
   - Ungu: `#7c3aed`
   - Biru: `#2563eb`

### Edit Font
1. Buka `style.css`
2. Cari baris:
   ```css
   body {
     font-family: 'Nunito', sans-serif;
   }
   ```
3. Ganti nama font ke pilihan lain

### Tambah Custom Styling
1. Buka `style.css`
2. Scroll ke bawah
3. Tambah rule baru:
   ```css
   /* Custom styling */
   .custom-class {
     color: red;
     font-size: 20px;
   }
   ```

---

## 🔧 Troubleshooting & Tips

### Problem: Web Tidak Muncul Character Sama Sekali

**Solusi:**
1. Refresh halaman (Ctrl+F5)
2. Cek console (F12 → Console) untuk error
3. Pastikan file `characters.json` ada di folder yang sama dengan `index.html`
4. Jika masih error, hapus semua custom character:
   - Buka Admin → Import/Export → Reset Data Custom

### Problem: Foto Tidak Tampil

**Kemungkinan:**
- Path foto salah atau file tidak ada
- Ukuran foto terlalu besar

**Solusi:**
1. Jika pakai path lama (misal `images/nama.png`), pastikan folder `images/` ada
2. Jika upload foto baru, pastikan ukuran < 2MB
3. Format harus: PNG, JPG, GIF

### Problem: Suara Tidak Terdengar

**Kemungkinan:**
- File tidak ada atau path salah
- Browser sudah muted
- Format tidak didukung

**Solusi:**
1. Pastikan format: MP3, OGG, WAV
2. Cek speaker → volumenya on
3. Jika pakai path lama, pastikan folder `sounds/` ada
4. Re-upload file suara baru via admin panel

### Problem: Search Lag / Slow

**Jika ada ratusan character & search terasa lambat:**
- Sudah di-fix di update terbaru dengan debounce & caching
- Tunggu 0.3 detik setelah selesai typing untuk hasil
- Browser akan cache hasil search otomatis

### Problem: Custom Character Hilang Setelah Refresh

**Kemungkinan:**
- localStorage terhapus (misal: clear cache browser)
- Bug rare tapi bisa terjadi

**Solusi:**
1. **Export backup** secara berkala:
   - Admin → Import/Export → Download Backup JSON
   - Simpan file ini di tempat aman
2. Jika hilang, jangan panik:
   - Import kembali dari backup JSON yang sudah disimpan

### Performance Tips untuk 500+ Characters

1. **Jangan menyimpan foto 12MB per character** - compress dulu
2. **Gunakan format WebP** untuk ukuran lebih kecil
3. **Lazy loading gambar** otomatis aktif - tidak perlu setup
4. **Backup berkala** supaya tidak hilang data

### Tips Mengelola Database

| Task | Cara |
|------|------|
| **Backup regular** | Admin → Import/Export → Download JSON setiap 2 minggu |
| **Batch add 100+ char** | Gunakan Python `convert.py` + Excel |
| **Edit 1 karakter** | Admin → Karakter → cari → Edit |
| **Hapus karakter lama** | Admin → Karakter → cari → Hapus |
| **Reset semua** | Admin → Import/Export → Reset Data Custom |
| **Lihat semua character** | Jelajahi Karakter → filter sesuai perlu |

---

## 📞 Bantuan Lebih Lanjut

### Jika Ada Error atau Pertanyaan:
1. Buka **Console** (F12 → Console tab)
2. Screenshot error message
3. Note: di step apa error terjadi

### File Penting:
- `index.html` - Halaman utama
- `style.css` - Styling & warna
- `script.js` - Logika aplikasi
- `characters.json` - Database karakter (auto-generated dari Excel)
- `convert.py` - Script untuk convert Excel → JSON

### Folder Struktur:
```
gacha-personality/
├── index.html
├── style.css
├── script.js
├── characters.json (bawaan)
├── convert.py
├── images/ (folder foto bawaan - opsional)
├── sounds/ (folder suara bawaan - opsional)
├── PANDUAN.md (file ini)
└── README.md (dokumentasi teknis)
```

---

**Selamat bermain! ✦ Semoga menyenangkan! 💕**

Dibuat dengan 💖 untuk pengalaman gacha yang lebih baik
