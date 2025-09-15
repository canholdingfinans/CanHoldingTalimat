# Cari Hesap Ödemesi Özelliği

Bu belge, "Cari Hesap Ödemesi" özelliğinin uygulamaya nasıl entegre edildiğini açıklamaktadır.

## Özellikler

### 1. Navbar ve Kullanıcı Arayüzü Güncellemesi

- Talimat Türü menüsüne "Cari Hesap Ödemeleri" kategorisi eklendi
- Bu kategori altında iki alt seçenek mevcut:
  - Satıcı Ödemesi
  - Müşteri Ödemesi
- Kullanıcı "Satıcı Ödemesi" seçtiğinde, alıcı firma listesinde yalnızca "Satıcı" türündeki şirketler gösterilir
- Kullanıcı "Müşteri Ödemesi" seçtiğinde, alıcı firma listesinde yalnızca "Müşteri" türündeki şirketler gösterilir

### 2. Çoklu Ödeme İşlevi

- Formun altına "Yeni Ödeme Ekle" butonu eklendi
- Bu butona tıklandığında, aynı ödeme formunun (alıcı firma, IBAN, miktar vb.) yeni bir kopyası dinamik olarak oluşturulur
- Her ödeme için ayrı alıcı firma, banka hesabı, tutar ve açıklama bilgileri girilebilir
- Tüm ödeme verileri JavaScript nesnesinde toplanır ve işlenir

### 3. Veritabanı Entegrasyonu

- Mevcut Supabase entegrasyonu, çoklu ödeme verilerini alıp veritabanına kaydedecek şekilde güncellendi
- Her ödeme için ayrı bir talimat kaydı oluşturulur
- Talimatlar aynı talimat numarası serisini paylaşır

## Teknik Detaylar

### Modül Değişiklikleri

1. **talimatlar.js**
   - Yeni instruction type'lar eklendi: 'cari-satici' ve 'cari-musteri'
   - createCariInstruction fonksiyonu eklendi

2. **ui-etkilesimleri.js**
   - Cari ödeme türleri için dinamik form oluşturma eklendi
   - "Yeni Ödeme Ekle" butonu işlevselliği eklendi
   - Firma türü filtreleme işlevselliği geliştirildi
   - Dinamik ödeme alanları için para birimi kontrolü eklendi

3. **main.js**
   - Cari ödeme oluşturma işlevselliği eklendi
   - Çoklu ödeme işleme desteği eklendi
   - createCariInstructionFromForm fonksiyonu eklendi

4. **supabase-entegrasyonu.js**
   - createCari fonksiyonu eklendi
   - checkDuplicateCari fonksiyonu eklendi

## Kullanım

1. Uygulamayı başlatın
2. "Talimat Türü" menüsünden "Cari Hesap Ödemeleri" seçeneğini seçin
3. Alt menüden "Satıcı Ödemesi" veya "Müşteri Ödemesi" seçin
4. Gönderici bilgilerini doldurun (Grup şirketi olmalıdır)
5. Alıcı bilgilerini doldurun (türüne göre filtrelenmiş şirketlerden seçin)
6. Tekil ödeme için doğrudan "Talimat Oluştur" butonuna tıklayın
7. Çoklu ödeme için "Yeni Ödeme Ekle" butonuna tıklayın ve yeni ödeme alanlarını doldurun
8. "Talimat Oluştur" butonuna tıklayın
9. Oluşturulan talimatı inceleyin ve yazdırın

## Test Senaryoları

1. **Firma Türü Filtreleme Testi**
   - "Satıcı Ödemesi" seçildiğinde yalnızca satıcı firmaların görünüp görünmediğini kontrol edin
   - "Müşteri Ödemesi" seçildiğinde yalnızca müşteri firmaların görünüp görünmediğini kontrol edin

2. **Tekil Ödeme Testi**
   - Tek bir ödeme oluşturun ve doğru şekilde kaydedildiğini doğrulayın

3. **Çoklu Ödeme Testi**
   - Birden fazla ödeme ekleyin ve hepsinin doğru şekilde işlendiğini doğrulayın

4. **Doğrulama Testi**
   - Gerekli alanların boş bırakılması durumunda hata mesajlarının gösterilip gösterilmediğini kontrol edin
   - Para birimi uyumsuzluğu durumunda hata mesajlarının gösterilip gösterilmediğini kontrol edin

## Geliştirme Notları

- Çoklu ödeme verileri şu anda her biri için ayrı bir veritabanı kaydı olarak saklanmaktadır
- Gelecekte, tüm ödemeleri tek bir JSON yapısında saklamak için veritabanı şeması güncellenebilir
- UI'da yapılan iyileştirmeler, kullanıcı deneyimini artırmak için yapılmıştır