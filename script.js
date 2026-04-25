/* ==========================================
   1. CONFIGURATION
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

let tokenClient, accessToken = null, currentEditEvent = null;
let isCountdownMode = false, countdownInterval = null, weatherForecast = null;

/* ==========================================
   2. API LOADING & AUTH
   ========================================== */
function gapiLoaded() {
    gapi.load('client', async () => {
        await gapi.client.init({});
        await gapi.client.load('calendar', 'v3');
        await gapi.client.load('tasks', 'v1');
    });
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (res) => {
            accessToken = res.access_token;
            document.getElementById('auth_button').innerText = "Refresh Board";
            refreshData();
            setInterval(refreshData, 1000 * 60 * 15);
        },
    });
}

function handleAuthClick() {
    tokenClient.requestAccessToken({ prompt: accessToken === null ? 'consent' : '' });
}

function refreshData() {
    fetchWeatherData();
    fetchTasks();
}

/* ==========================================
   3. WEATHER LOGIC (Safety Bay)
   ========================================== */
async function fetchWeatherData() {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=-32.30&longitude=115.71&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
        const data = await res.json();
        weatherForecast = data.daily;
    } catch (e) { console.error("Weather Error", e); }
    fetchCalendarEvents();
}

function getWeatherIcon(code) {
    if (code === 0) return 'https://openweathermap.org/img/wn/01d@2x.png';
    if (code <= 3) return 'https://openweathermap.org/img/wn/02d@2x.png';
    if (code >= 51 && code <= 67) return 'https://openweathermap.org/img/wn/10d@2x.png';
    if (code >= 80) return 'https://openweathermap.org/img/wn/09d@2x.png';
    return 'https://openweathermap.org/img/wn/03d@2x.png';
}

/* ==========================================
   4. CALENDAR LOGIC
   ========================================== */
async function fetchCalendarEvents() {
    const now = new Date();
    const diff = (now.getDay() === 0 ? -6 : 1) - now.getDay();
    const start = new Date(now.setDate(now.getDate() + diff));
    start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(end.getDate() + 42);

    let allEvents = [];
    for (const p of FAMILY_CALENDARS) {
        const res = await gapi.client.calendar.events.list({ calendarId: p.id, timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: true });
        allEvents = allEvents.concat((res.result.items || []).map(e => ({ ...e, personColor: p.color, calendarId: p.id })));
    }
    renderGrid(start, allEvents);
}

function renderGrid(startDate, allEvents) {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    let loopDate = new Date(startDate);
    const today = new Date(); today.setHours(0,0,0,0);

    for (let i = 0; i < 42; i++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        const compare = new Date(loopDate); compare.setHours(0,0,0,0);
        if (compare < today) cell.classList.add('past-day');
        else if (compare.getTime() === today.getTime()) cell.classList.add('today-day');

        let weatherHTML = '';
        if (weatherForecast) {
            const idx = weatherForecast.time.indexOf(loopDate.toISOString().split('T')[0]);
            if (idx !== -1) {
                weatherHTML = `<div class="cell-weather"><div class="cell-temp">${Math.round(weatherForecast.temperature_2m_max[idx])}°<span>${Math.round(weatherForecast.temperature_2m_min[idx])}°</span></div><img src="${getWeatherIcon(weatherForecast.weather_code[idx])}"></div>`;
            }
        }

        cell.innerHTML = `<div class="day-top-row"><div class="day-num">${loopDate.toLocaleString('default', { month: 'short' })} ${loopDate.getDate()}</div>${weatherHTML}</div>`;

        allEvents.filter(e => new Date(e.start.dateTime || e.start.date).toDateString() === loopDate.toDateString())
            .forEach(e => {
                const div = document.createElement('div');
                div.className = 'event'; div.style.backgroundColor = e.personColor;
                div.innerText = (e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) + ' ' : '') + e.summary;
                div.onclick = () => openEventModal(e);
                cell.appendChild(div);
            });
        grid.appendChild(cell);
        loopDate.setDate(loopDate.getDate() + 1);
    }
}

/* ==========================================
   5. MODAL LOGIC
   ========================================== */
function openEventModal(event = null) {
    isCountdownMode = false;
    const select = document.getElementById('eventCalendar');
    document.getElementById('calendar-select-group').classList.remove('hidden');
    
    // Color-coded options
    select.innerHTML = FAMILY_CALENDARS.map(p => `<option value="${p.id}" style="color:${p.color}; font-weight:bold;">● ${p.name}</option>`).join('');
    select.onchange = () => { select.style.color = FAMILY_CALENDARS.find(p => p.id === select.value).color; };

    if (event) {
        currentEditEvent = event;
        document.getElementById('modalTitle').innerText = "Edit Event";
        document.getElementById('eventSummary').value = event.summary;
        select.value = event.calendarId;
        select.style.color = event.personColor;
        const d = new Date(event.start.dateTime || event.start.date);
        document.getElementById('eventDate').value = d.toISOString().split('T')[0];
        document.getElementById('eventTime').value = event.start.dateTime ? d.toTimeString().slice(0,5) : '';
        document.getElementById('deleteEventBtn').style.display = "block";
    } else {
        currentEditEvent = null;
        document.getElementById('modalTitle').innerText = "Add Family Event";
        document.getElementById('eventSummary').value = '';
        document.getElementById('eventDate').valueAsDate = new Date();
        select.style.color = FAMILY_CALENDARS[0].color;
        document.getElementById('deleteEventBtn').style.display = "none";
    }
    document.getElementById('eventModal').style.display = "block";
}

// ... include closeEventModal, submitEvent, deleteEvent, fetchTasks, and initCountdown from your previous version ...

window.onload = () => { gapiLoaded(); gisLoaded(); initCountdown(); };