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
        callback: (tokenResponse) => {
            if (tokenResponse.error !== undefined) throw (tokenResponse);
            accessToken = tokenResponse.access_token;
            document.getElementById('auth_button').innerText = "Refresh Board";
            refreshDashboard();
            setInterval(refreshDashboard, 1000 * 60 * 10);
        },
    });
}

function handleAuthClick() {
    tokenClient.requestAccessToken({ prompt: accessToken === null ? 'consent' : '' });
}

function refreshDashboard() {
    fetchWeatherData();
    fetchTasks();
}

/* --- Weather --- */
async function fetchWeatherData() {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=-32.30&longitude=115.71&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
        const data = await response.json();
        weatherForecast = data.daily;
        fetchCalendarEvents();
    } catch (err) {
        console.error("Weather Error:", err);
        fetchCalendarEvents();
    }
}

function getWeatherIcon(code) {
    if (code === 0) return 'https://openweathermap.org/img/wn/01d@2x.png';
    if (code <= 3) return 'https://openweathermap.org/img/wn/02d@2x.png';
    if (code >= 51 && code <= 67) return 'https://openweathermap.org/img/wn/10d@2x.png';
    return 'https://openweathermap.org/img/wn/03d@2x.png';
}

/* --- Calendar --- */
async function fetchCalendarEvents() {
    const now = new Date();
    const diff = (now.getDay() === 0 ? -6 : 1) - now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfPeriod = new Date(startOfWeek);
    endOfPeriod.setDate(startOfWeek.getDate() + 42);

    try {
        let allEvents = [];
        for (const person of FAMILY_CALENDARS) {
            const response = await gapi.client.calendar.events.list({
                'calendarId': person.id,
                'timeMin': startOfWeek.toISOString(),
                'timeMax': endOfPeriod.toISOString(),
                'singleEvents': true,
            });
            const events = (response.result.items || []).map(event => ({
                ...event,
                personColor: person.color,
                calendarId: person.id 
            }));
            allEvents = allEvents.concat(events);
        }
        renderCalendarGrid(startOfWeek, allEvents);
    } catch (err) { console.error(err); }
}

function renderCalendarGrid(startDate, allEvents) {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = ''; 
    let loopDate = new Date(startDate);
    const today = new Date(); today.setHours(0,0,0,0);

    for (let i = 0; i < 42; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        const compareDate = new Date(loopDate); compareDate.setHours(0,0,0,0);
        
        if (compareDate < today) dayCell.classList.add('past-day');
        else if (compareDate.getTime() === today.getTime()) dayCell.classList.add('today-day');

        let weatherHTML = '';
        if (weatherForecast) {
            const dateStr = loopDate.toISOString().split('T')[0];
            const wIndex = weatherForecast.time.indexOf(dateStr);
            if (wIndex !== -1) {
                const max = Math.round(weatherForecast.temperature_2m_max[wIndex]);
                const min = Math.round(weatherForecast.temperature_2m_min[wIndex]);
                weatherHTML = `
                    <div class="cell-weather">
                        <div class="cell-temp">${max}°<span>${min}°</span></div>
                        <img src="${getWeatherIcon(weatherForecast.weather_code[wIndex])}">
                    </div>`;
            }
        }

        dayCell.innerHTML = `
            <div class="day-top-row">
                <div class="day-num">${loopDate.toLocaleString('default', { month: 'short' })} ${loopDate.getDate()}</div>
                ${weatherHTML}
            </div>
        `;

        allEvents.filter(e => new Date(e.start.dateTime || e.start.date).toDateString() === loopDate.toDateString())
            .sort((a,b) => (a.start.dateTime ? new Date(a.start.dateTime) : 0) - (b.start.dateTime ? new Date(b.start.dateTime) : 0))
            .forEach(event => {
                const eventDiv = document.createElement('div');
                eventDiv.className = 'event';
                eventDiv.style.backgroundColor = event.personColor;
                eventDiv.onclick = () => openEventModal(event);
                let time = event.start.dateTime ? new Date(event.start.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + " " : "";
                eventDiv.innerText = time + event.summary;
                dayCell.appendChild(eventDiv);
            });

        grid.appendChild(dayCell);
        loopDate.setDate(loopDate.getDate() + 1);
    }
}

/* --- Modals & Helpers --- */
function openEventModal(event = null) {
    isCountdownMode = false;
    const modal = document.getElementById('eventModal');
    const select = document.getElementById('eventCalendar');
    document.getElementById('calendar-select-group').classList.remove('hidden');
    
    select.innerHTML = FAMILY_CALENDARS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    if (event) {
        currentEditEvent = event;
        document.getElementById('modalTitle').innerText = "Edit Event";
        document.getElementById('eventSummary').value = event.summary;
        select.value = event.calendarId;
        const start = new Date(event.start.dateTime || event.start.date);
        document.getElementById('eventDate').value = start.toISOString().split('T')[0];
        document.getElementById('eventTime').value = event.start.dateTime ? start.toTimeString().slice(0, 5) : '';
        document.getElementById('deleteEventBtn').style.display = "block";
    } else {
        currentEditEvent = null;
        document.getElementById('modalTitle').innerText = "Add Family Event";
        document.getElementById('eventSummary').value = '';
        document.getElementById('eventDate').valueAsDate = new Date();
        document.getElementById('eventTime').value = '';
        document.getElementById('deleteEventBtn').style.display = "none";
    }
    modal.style.display = "block";
}

function openCountdownModal() {
    isCountdownMode = true;
    const modal = document.getElementById('eventModal');
    document.getElementById('modalTitle').innerText = "Set Wall Countdown";
    document.getElementById('calendar-select-group').classList.add('hidden');
    document.getElementById('eventSummary').value = localStorage.getItem('wallCountdownName') || '';
    document.getElementById('eventDate').value = localStorage.getItem('wallCountdownDate') || '';
    document.getElementById('eventTime').value = localStorage.getItem('wallCountdownTime') || '';
    document.getElementById('deleteEventBtn').style.display = localStorage.getItem('wallCountdownName') ? "block" : "none";
    modal.style.display = "block";
}

function closeEventModal() { document.getElementById('eventModal').style.display = "none"; }

async function submitEvent() {
    const summary = document.getElementById('eventSummary').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    if (!summary || !date) return;

    if (isCountdownMode) {
        localStorage.setItem('wallCountdownName', summary);
        localStorage.setItem('wallCountdownDate', date);
        localStorage.setItem('wallCountdownTime', time);
        initCountdown();
        closeEventModal();
    } else {
        const calId = document.getElementById('eventCalendar').value;
        const start = time ? { 'dateTime': `${date}T${time}:00+08:00` } : { 'date': date };
        const end = time ? { 'dateTime': `${date}T${addOneHour(time)}:00+08:00` } : { 'date': date };
        const resource = { 'summary': summary, 'start': start, 'end': end };
        
        if (currentEditEvent) {
            await gapi.client.calendar.events.update({ 'calendarId': currentEditEvent.calendarId, 'eventId': currentEditEvent.id, 'resource': resource });
        } else {
            await gapi.client.calendar.events.insert({ 'calendarId': calId, 'resource': resource });
        }
        closeEventModal();
        fetchCalendarEvents();
    }
}

async function deleteEvent() {
    if (isCountdownMode) {
        localStorage.removeItem('wallCountdownName'); localStorage.removeItem('wallCountdownDate');
        initCountdown(); closeEventModal();
    } else {
        await gapi.client.calendar.events.delete({ 'calendarId': currentEditEvent.calendarId, 'eventId': currentEditEvent.id });
        closeEventModal(); fetchCalendarEvents();
    }
}

function addOneHour(timeStr) {
    let [h, m] = timeStr.split(':').map(Number);
    return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function initCountdown() {
    const name = localStorage.getItem('wallCountdownName');
    const date = localStorage.getItem('wallCountdownDate');
    const time = localStorage.getItem('wallCountdownTime') || "00:00";
    if (!name || !date) {
        document.getElementById('countdown-widget').classList.add('hidden');
        document.getElementById('add-countdown-btn').classList.remove('hidden');
        return;
    }
    document.getElementById('countdown-widget').classList.remove('hidden');
    document.getElementById('add-countdown-btn').classList.add('hidden');
    document.getElementById('widget-label').innerText = name;
    if (countdownInterval) clearInterval(countdownInterval);
    const target = new Date(`${date}T${time}:00+08:00`).getTime();
    countdownInterval = setInterval(() => {
        const now = new Date().getTime();
        const dist = target - now;
        if (dist < 0) { document.getElementById('widget-timer').innerText = "LIVE!"; return; }
        const d = Math.floor(dist / (1000*60*60*24)), h = Math.floor((dist%(1000*60*60*24))/(1000*60*60)), m = Math.floor((dist%(1000*60*60))/(1000*60)), s = Math.floor((dist%(1000*60))/1000);
        document.getElementById('widget-timer').innerText = `${d}d ${h}h ${m}m ${s}s`;
    }, 1000);
}

async function fetchTasks() {
    const res = await gapi.client.tasks.tasklists.list();
    const lists = res.result.items || [];
    const container = document.getElementById('task-lists-container');
    container.innerHTML = ''; 
    for (const list of lists) {
        const tRes = await gapi.client.tasks.tasks.list({ tasklist: list.id, showCompleted: false });
        const tasks = tRes.result.items || [];
        const div = document.createElement('div');
        div.className = 'task-group';
        div.innerHTML = `<h3>${list.title}</h3>`;
        tasks.forEach(t => div.innerHTML += `<div><input type="checkbox"> <span>${t.title}</span></div>`);
        container.appendChild(div);
    }
}

window.onload = () => { gapiLoaded(); gisLoaded(); initCountdown(); };