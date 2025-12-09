import { state } from './state.js';
import { db } from './auth.js'; // Veritabanını çağır
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_USER = "admin";
const ADMIN_PASS = "1234";

// --- YENİ: UYGULAMALARI BAŞLAT VE DİNLE ---
// Bu fonksiyon main.js'de sayfa yüklenince çağrılacak
export function initApps() {
    // 'apps' koleksiyonunu tarihe göre sıralı dinle
    const q = query(collection(db, "apps"), orderBy("timestamp", "desc"));
    
    // Veritabanında her değişiklik olduğunda bu çalışır (Gerçek Zamanlı)
    onSnapshot(q, (snapshot) => {
        state.apps = snapshot.docs.map(doc => ({
            id: doc.id, // Silme işlemi için ID gerekli
            ...doc.data()
        }));
        renderApps(); // Listeyi yenile
    });
}

export function toggleAppsPanel() {
    // Diğer panelleri kapat
    const panels = ['chat-panel', 'youtube-panel', 'participants-panel', 'spotify-panel'];
    panels.forEach(id => {
        const p = document.getElementById(id);
        if(p && p.classList.contains('open')) p.classList.remove('open');
    });

    const panel = document.getElementById('apps-panel');
    panel.classList.toggle('open');
    // Panel açıldığında render etmeye gerek yok, onSnapshot zaten güncel tutuyor
}

export function adminLogin() {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        state.isAdmin = true;
        alert("Admin girişi başarılı!");
        document.getElementById('admin-login-form').classList.add('hidden');
        document.getElementById('admin-controls').classList.remove('hidden');
        
        // Admin oldu, silme butonlarını göstermek için listeyi yenile
        renderApps();
    } else {
        alert("Hatalı bilgiler!");
    }
}

export function openAddModal(type) {
    document.getElementById('add-app-modal').classList.remove('hidden');
    document.getElementById('app-type-input').value = type;
    const label = document.getElementById('app-target-label');
    const input = document.getElementById('app-target-input');
    
    if(type === 'web') {
        label.innerText = "Website Linki (URL)";
        input.placeholder = "https://...";
    } else {
        label.innerText = "Dosya Yolu (.exe)";
        input.placeholder = "C:/Program Files/...";
    }
}

// --- YENİ: VERİTABANINA KAYDET ---
export async function saveNewApp() {
    const type = document.getElementById('app-type-input').value;
    const name = document.getElementById('app-name-input').value;
    const logo = document.getElementById('app-logo-input').value;
    const target = document.getElementById('app-target-input').value;

    if(!name || !logo || !target) {
        alert("Lütfen tüm alanları doldurun.");
        return;
    }

    try {
        // Firestore'a ekle
        await addDoc(collection(db, "apps"), {
            type, name, logo, target,
            timestamp: Date.now()
        });
        
        // Modal'ı temizle ve kapat
        document.getElementById('app-name-input').value = "";
        document.getElementById('app-logo-input').value = "";
        document.getElementById('app-target-input').value = "";
        document.getElementById('add-app-modal').classList.add('hidden');
        
        // renderApps çağırmaya gerek yok, onSnapshot otomatik yapacak

    } catch (e) {
        console.error("Ekleme hatası:", e);
        alert("Uygulama eklenirken hata oluştu.");
    }
}

// --- YENİ: VERİTABANINDAN SİL ---
export async function deleteApp(id) {
    if(confirm("Bu uygulamayı kalıcı olarak silmek istiyor musunuz?")) {
        try {
            await deleteDoc(doc(db, "apps", id));
            // Silindiğinde onSnapshot tetiklenir ve listeden otomatik kalkar
        } catch (e) {
            console.error("Silme hatası:", e);
            alert("Silinemedi.");
        }
    }
}

function renderApps() {
    const container = document.getElementById('apps-grid');
    if(!container) return;
    
    container.innerHTML = "";

    // Admin butonları
    if (state.isAdmin) {
        const adminTools = document.createElement('div');
        adminTools.className = 'admin-tools-row';
        adminTools.innerHTML = `
            <button onclick="window.openAddModal('web')" class="btn-add-app"><i class="fa-solid fa-globe"></i> Web</button>
            <button onclick="window.openAddModal('app')" class="btn-add-app"><i class="fa-brands fa-windows"></i> App</button>
        `;
        container.appendChild(adminTools);
    }

    // Listeyi oluştur
    if(state.apps) {
        state.apps.forEach(app => {
            const item = document.createElement('div');
            item.className = 'app-item';
            
            // Tıklama olayı (Sadece karta tıklayınca aç)
            item.addEventListener('click', (e) => {
                // Eğer silme butonuna tıklandıysa açma
                if (e.target.closest('.btn-delete-app')) return;
                launchApp(app);
            });
            
            let deleteBtnHTML = '';
            if (state.isAdmin) {
                // Silme butonu (onclick'i HTML içinde değil listener ile verelim veya inline onclick kullanıp stopPropagation yapalım)
                deleteBtnHTML = `<button class="btn-delete-app" onclick="window.deleteApp('${app.id}'); event.stopPropagation();"><i class="fa-solid fa-trash"></i></button>`;
            }

            item.innerHTML = `
                <img src="${app.logo}" alt="logo" class="app-item-logo">
                <span class="app-item-name">${app.name}</span>
                ${deleteBtnHTML}
            `;
            container.appendChild(item);
        });
    }
}

function launchApp(app) {
    if (app.type === 'web') {
        window.open(app.url || app.target, '_blank');
    } else {
        alert(`Uygulama Başlatılıyor:\n${app.name}\n${app.target}`);
    }
}