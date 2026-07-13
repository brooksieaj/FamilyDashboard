/* ==========================================
   1. CONFIGURATION & IDENTITY
   ========================================== */
const CLIENT_ID = '145116633029-6ujgciuv8f3c9901c8uaorr6qopsaa4v.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks';

const FAMILY_CALENDARS = [
    { name: 'Dad', id: 'primary', color: '#4285f4' }, 
    { name: 'Mum', id: '9qbap7bc4933q6ujmpmo0p88kg@group.calendar.google.com', color: '#0f9d58' }, 
    { name: 'Clemence', id: 'lj8rt1jbb51g1rf31db3suus1s@group.calendar.google.com',  color: '#db4437'},
    { name: 'Grace', id: 'jjfqnrfqa9jvuc7j3nfu07qj1c@group.calendar.google.com', color: '#ff6ec7' },
    { name: 'Eadie', id: 'ed08111eb8ad386bd9798fd71e2e754da01c6eb2ab8ad203db20d5436e10a5d2@group.calendar.google.com', color: '#710193' },
    { name: 'Family', id: 'family05671236762801895077@group.calendar.google.com', color: '#fc6a03' },
    { name: 'Birthdays and Anniversaries', id: 'lcjs20o1reo0k0cct1uupp3p00@group.calendar.google.com', color: '#65350f' }
];

let tokenClient;
let accessToken = null;
let currentEditEvent = null; 
let isCountdownMode = false; 
let countdownInterval = null; 
let weatherForecast = null; 

/* ==========================================
   2. GOOGLE API LOADING WITH AUTO-RESTORE
   ========================================== */
function gapiLoaded() {
    gapi.load('client', async () => {
        await gapi.client.init({});
        await gapi.client.load('calendar', 'v3');
        await gapi.client.load('tasks', 'v1');
        console.log("Google Libraries Loaded");
        
        // If calendar-grid exists on this page, look for data immediately if authorized
        if (accessToken && document.getElementById('calendar-grid')) {
            fetchWeatherData();
        }
    });
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse.error !== undefined) throw (tokenResponse);
            
            accessToken = tokenResponse.access_token;
            localStorage.setItem('google_session_active', 'true');
            
            // Sync UI elements on Settings Page
            updateSettingsUI(true);

            // Execute core routines for Calendar page if present
            if (document.getElementById('calendar-grid')) {
                fetchWeatherData();
            }
        },
    });

    // AUTO-LOGIN RESCUE FOR PAGE REFRESHES:
    // If the flag is set, request a token silently without standard prompt interruptions
    if (localStorage.getItem('google_session_active') === 'true') {
        console.log("Restoring Google token session in background...");
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function handleAuthClick() {
    // If user interacts directly, prompt consent just to ensure fresh scopes
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleDisconnectClick() {
    if (confirm("Disconnect from Google Cloud? This will clear local tokens and disable sync features.")) {
        if (accessToken) {
            google.accounts.oauth2.revokeToken(accessToken, () => {
                console.log("Google Session Revoked.");
            });
        }
        accessToken = null;
        localStorage.removeItem('google_session_active');
        updateSettingsUI(false);
        
        // If on calendar page, wipe grid area clean
        const grid = document.getElementById('calendar-grid');
        if (grid) grid.innerHTML = '<div class="blank-state-card"><i class="fas fa-lock placeholder-icon"></i><p>Sign in via Settings to view calendars.</p></div>';
    }
}

function updateSettingsUI(isConnected) {
    const statusBadge = document.getElementById('auth-status-badge');
    const statusText = document.getElementById('status-text');
    const authBtn = document.getElementById('auth_button');
    const disconnectBtn = document.getElementById('disconnect_button');

    // Only attempt updates if elements are found on current screen
    if (!statusBadge) return;

    if (isConnected) {
        statusBadge.className = "status-badge connected";
        statusText.innerText = "Connected";
        authBtn.innerText = "Re-authenticate";
        if (disconnectBtn) disconnectBtn.classList.remove('hidden');
    } else {
        statusBadge.className = "status-badge disconnected";
        statusText.innerText = "Disconnected";
        authBtn.innerText = "Sign In with Google";
        if (disconnectBtn) disconnectBtn.classList.add('hidden');
    }
}

// Modify your window.onload script entry wrapper in script.js to execute UI checks:
const existingOnload = window.onload;
window.onload = () => {
    if (typeof existingOnload === 'function') existingOnload();
    initCountdown();
    // Run an immediate UI check for the settings state badge on page render
    if (localStorage.getItem('google_session_active') === 'true') {
        updateSettingsUI(true);
    }
};
