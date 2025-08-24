document.addEventListener('DOMContentLoaded', () => {

    // --- SEKCJA 1: REFERENCJE DO ELEMENTÓW DOM ---
    const welcomeScreen = document.getElementById('welcome-screen');
    const appScreen = document.getElementById('app-screen');
    const loadFileBtn = document.getElementById('load-file-btn');
    const createNewBtn = document.getElementById('create-new-btn');
    const fileInput = document.getElementById('file-input');
    const addCardBtn = document.getElementById('add-card-btn');
    const exportFileBtn = document.getElementById('export-file-btn');
    const cardsContainer = document.getElementById('cards-container');
    const cardTemplate = document.getElementById('card-template');
    const searchInput = document.getElementById('search-input');

    // Modale
    const passwordModal = document.getElementById('password-modal');
    const passwordForm = document.getElementById('password-form');
    const passwordInput = document.getElementById('password-input');
    const modalTitle = document.getElementById('modal-title');
    const cancelPasswordBtn = document.getElementById('cancel-password-btn');

    const entryModal = document.getElementById('entry-modal');
    const entryForm = document.getElementById('entry-form');
    const entryModalTitle = document.getElementById('entry-modal-title');
    const cancelEntryBtn = document.getElementById('cancel-entry-btn');
    const generatePasswordBtn = document.getElementById('generate-password-btn');

    // Pola formularza wpisu
    const entryIndexInput = document.getElementById('entry-index-input');
    const serviceInput = document.getElementById('service-input');
    const urlInput = document.getElementById('url-input');
    const loginInput = document.getElementById('login-input');
    const entryPasswordInput = document.getElementById('entry-password-input');


    // --- SEKCJA 2: STAN APLIKACJI ---
    let appState = {
        passwords: [],
        isDirty: false,
        passwordResolve: null,
        passwordReject: null,
    };

    // --- SEKCJA 3: LOGIKA KRYPTOGRAFICZNA (Bez zmian, jest solidna) ---
    const cryptoHelper = {
        arrayBufferToBase64: (buffer) => { let binary = ''; const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); } return window.btoa(binary); },
        base64ToArrayBuffer: (base64) => { const binary_string = window.atob(base64); const len = binary_string.length; const bytes = new Uint8Array(len); for (let i = 0; i < len; i++) { bytes[i] = binary_string.charCodeAt(i); } return bytes.buffer; },
        getKey: (password, salt) => {
            const enc = new TextEncoder();
            return window.crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"])
            .then(baseKey => window.crypto.subtle.deriveKey({ "name": "PBKDF2", salt: salt, "iterations": 100000, "hash": "SHA-256" }, baseKey, { "name": "AES-GCM", "length": 256 }, true, ["encrypt", "decrypt"]));
        },
        encrypt: async (password, data) => {
            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const key = await cryptoHelper.getKey(password, salt);
            const encodedData = new TextEncoder().encode(JSON.stringify(data));
            const encryptedContent = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encodedData);
            return { salt: cryptoHelper.arrayBufferToBase64(salt), iv: cryptoHelper.arrayBufferToBase64(iv), data: cryptoHelper.arrayBufferToBase64(encryptedContent) };
        },
        decrypt: async (password, encryptedPayload) => {
            try {
                const salt = cryptoHelper.base64ToArrayBuffer(encryptedPayload.salt);
                const iv = cryptoHelper.base64ToArrayBuffer(encryptedPayload.iv);
                const data = cryptoHelper.base64ToArrayBuffer(encryptedPayload.data);
                const key = await cryptoHelper.getKey(password, salt);
                const decryptedContent = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
                return JSON.parse(new TextDecoder().decode(decryptedContent));
            } catch (error) { console.error("Błąd deszyfrowania:", error); return null; }
        }
    };
    
    // --- SEKCJA 4: NOWE FUNKCJE POMOCNICZE ---

    // Generator haseł
    const generatePassword = (length = 16) => {
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
        let password = "";
        const randomValues = new Uint32Array(length);
        window.crypto.getRandomValues(randomValues);
        for (let i = 0; i < length; i++) {
            password += charset[randomValues[i] % charset.length];
        }
        return password;
    };

    // Kopiowanie do schowka
    const copyToClipboard = (text, button) => {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = button.textContent;
            button.textContent = '✅';
            setTimeout(() => { button.textContent = originalText; }, 1500);
        }).catch(err => {
            console.error('Błąd kopiowania:', err);
            alert('Nie udało się skopiować do schowka.');
        });
    };

    // --- SEKCJA 5: OBSŁUGA INTERFEJSU UŻYTKOWNIKA (UI) ---

    const switchView = (view) => {
        welcomeScreen.classList.toggle('hidden', view === 'app');
        appScreen.classList.toggle('hidden', view !== 'app');
    };
    
    const renderCards = (filter = '') => {
        cardsContainer.innerHTML = '';
        const lowerCaseFilter = filter.toLowerCase();
        
        const filteredPasswords = appState.passwords.filter(item => 
            item.service.toLowerCase().includes(lowerCaseFilter) ||
            item.url.toLowerCase().includes(lowerCaseFilter) ||
            item.login.toLowerCase().includes(lowerCaseFilter)
        );

        filteredPasswords.forEach(item => {
            const index = appState.passwords.indexOf(item); // Znajdź oryginalny indeks
            const cardClone = cardTemplate.content.cloneNode(true);
            const cardElement = cardClone.querySelector('.card');
            
            cardElement.dataset.index = index;
            cardClone.querySelector('.card-title').textContent = item.service;
            cardClone.querySelector('.card-url').textContent = item.url || 'Brak';
            if (item.url) cardClone.querySelector('.card-url').href = item.url;
            cardClone.querySelector('.card-login').textContent = item.login;
            cardClone.querySelector('.card-password').value = item.password;

            // Delegacja zdarzeń na poziomie karty
            cardElement.addEventListener('click', (e) => {
                const target = e.target.closest('button');
                if (!target) return;

                if (target.classList.contains('delete-btn')) {
                    if (confirm(`Czy na pewno chcesz usunąć wpis dla "${item.service}"?`)) {
                        appState.passwords.splice(index, 1);
                        appState.isDirty = true;
                        renderCards(searchInput.value);
                    }
                }
                else if (target.classList.contains('edit-btn')) {
                    showEntryModal('edit', index);
                }
                else if (target.classList.contains('toggle-visibility-btn')) {
                    const passInput = target.previousElementSibling;
                    passInput.type = passInput.type === 'password' ? 'text' : 'password';
                    target.textContent = passInput.type === 'password' ? '👁️' : '🙈';
                }
                else if (target.classList.contains('copy-btn')) {
                    const fieldToCopy = target.title.includes('login') ? item.login : item.password;
                    copyToClipboard(fieldToCopy, target);
                }
            });

            cardsContainer.appendChild(cardClone);
        });
    };
    
    const getPasswordFromModal = (title) => {
        modalTitle.textContent = title;
        passwordInput.value = '';
        passwordModal.classList.remove('hidden');
        passwordInput.focus();

        return new Promise((resolve, reject) => {
            appState.passwordResolve = resolve;
            appState.passwordReject = reject;
        });
    };

    const showEntryModal = (mode = 'add', index = null) => {
        entryForm.reset();
        if (mode === 'add') {
            entryModalTitle.textContent = 'Nowy wpis';
            entryIndexInput.value = '';
        } else {
            entryModalTitle.textContent = 'Edytuj wpis';
            const entry = appState.passwords[index];
            entryIndexInput.value = index;
            serviceInput.value = entry.service;
            urlInput.value = entry.url;
            loginInput.value = entry.login;
            entryPasswordInput.value = entry.password;
        }
        entryModal.classList.remove('hidden');
        serviceInput.focus();
    };
    
    // --- SEKCJA 6: GŁÓWNA LOGIKA APLIKACJI I OBSŁUGA ZDARZEŃ ---

    loadFileBtn.addEventListener('click', () => fileInput.click());
    createNewBtn.addEventListener('click', () => {
        appState.passwords = [];
        appState.isDirty = true;
        switchView('app');
        renderCards();
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const encryptedPayload = JSON.parse(e.target.result);
                const password = await getPasswordFromModal('Podaj hasło, aby odszyfrować sejf');
                const decryptedData = await cryptoHelper.decrypt(password, encryptedPayload);

                if (decryptedData) {
                    appState.passwords = decryptedData;
                    appState.isDirty = false;
                    switchView('app');
                    renderCards();
                } else {
                    alert('Nie udało się odszyfrować pliku. Sprawdź hasło.');
                }
            } catch (err) {
                alert('Błąd podczas wczytywania pliku. Upewnij się, że jest to poprawny plik sejfu.');
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    });
    
    addCardBtn.addEventListener('click', () => showEntryModal('add'));

    exportFileBtn.addEventListener('click', async () => {
        if (appState.passwords.length === 0) {
            alert("Nie ma żadnych danych do zapisania.");
            return;
        }
        try {
            const password = await getPasswordFromModal('Podaj hasło, aby zaszyfrować sejf');
            const encryptedData = await cryptoHelper.encrypt(password, appState.passwords);
            const fileContent = JSON.stringify(encryptedData, null, 2);
            
            const blob = new Blob([fileContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sejf_haseł.json';
            a.click();
            URL.revokeObjectURL(url);
            a.remove();
            
            appState.isDirty = false;
            alert('Sejf został pomyślnie wyeksportowany!');
            
        } catch(err) {
            console.log("Eksport anulowany.");
        }
    });

    searchInput.addEventListener('input', () => renderCards(searchInput.value));

    // Obsługa modali
    passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (appState.passwordResolve) appState.passwordResolve(passwordInput.value);
        passwordModal.classList.add('hidden');
    });

    cancelPasswordBtn.addEventListener('click', () => {
        if (appState.passwordReject) appState.passwordReject(new Error("Anulowano."));
        passwordModal.classList.add('hidden');
    });

    entryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newEntry = {
            service: serviceInput.value,
            url: urlInput.value,
            login: loginInput.value,
            password: entryPasswordInput.value,
        };

        if (entryIndexInput.value !== '') { // Tryb edycji
            appState.passwords[entryIndexInput.value] = newEntry;
        } else { // Tryb dodawania
            appState.passwords.push(newEntry);
        }

        appState.isDirty = true;
        renderCards(searchInput.value);
        entryModal.classList.add('hidden');
    });

    cancelEntryBtn.addEventListener('click', () => entryModal.classList.add('hidden'));

    generatePasswordBtn.addEventListener('click', () => {
        entryPasswordInput.value = generatePassword();
    });
    
    window.addEventListener('beforeunload', (e) => {
        if (appState.isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // --- SEKCJA 7: REJESTRACJA SERVICE WORKERA (DODANY KOD) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then((reg) => {
                    console.log('Service Worker zarejestrowany pomyślnie!', reg);
                })
                .catch((err) => {
                    console.error('Błąd rejestracji Service Workera:', err);
                });
        });
    }

});