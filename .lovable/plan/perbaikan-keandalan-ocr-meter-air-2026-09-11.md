# Perbaikan keandalan OCR meter air

## Yang akan diperbaiki
- Samakan area gambar yang diproses dengan kotak panduan yang terlihat pada kamera, termasuk pada layar dengan rasio berbeda.
- Jangan lagi menyembunyikan kegagalan pemuatan mesin OCR; tampilkan penyebab yang jelas dan izinkan percobaan ulang.
- Catat teks mentah dan tingkat keyakinan setiap percobaan agar hasil hampir benar dapat didiagnosis.
- Turunkan ambang penerimaan secara hati-hati dan tetap arahkan hasil meragukan ke input manual.
- Tampilkan hasil debug OCR pada layar saat pembacaan gagal atau keyakinannya rendah.

## Detail teknis
- Hitung crop berdasarkan bagian video yang benar-benar terlihat melalui `object-cover`, bukan seluruh frame kamera.
- Reset worker Tesseract jika inisialisasi gagal agar kegagalan pertama tidak merusak semua percobaan berikutnya.
- Bedakan error pemuatan worker/data bahasa dari hasil OCR kosong.
- Pilih percobaan valid dengan confidence tertinggi; gunakan ambang penerimaan awal 55 dan confidence tinggi 80.
- Pertahankan whitelist digit, PSM 7/8, preprocessing, pemeriksaan glare, galeri, dan input manual.

## Verifikasi
- Jalankan pemeriksaan kode dan build otomatis.
- Uji OCR dengan gambar angka sintetis dan periksa hasil mentah/confidence.
- Periksa tampilan halaman pada ukuran ponsel tanpa mengubah fitur lain.
