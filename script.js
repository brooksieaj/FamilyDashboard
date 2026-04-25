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
let weatherForecast = null; // Stores the daily forecast data

/* ==========================================
   2. GOOGLE API LOADING
   ========================================== */
function gapiLoaded() {
    gapi.load('client', async () => {
        await gapi.client.init({});
        await gapi.client.load('calendar', 'v3');
        await gapi.client.load('tasks', 'v1');
        console.log("Google Libraries Loaded");
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
            
            // Initial Load
            fetchWeatherData(); // Weather triggers calendar fetch once data is in
            fetchTasks(); 

            // Auto-refresh every 5 mins
            setInterval(() => {
                fetchWeatherData();
                fetchTasks();
            }, 1000 * 60 * 5);
        },
    });
}

function handleAuthClick() {
    if (accessToken === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

/* ==========================================
   3. WEATHER FETCHING (Safety Bay)
   ========================================== */
async function fetchWeatherData() {
    const lat = -32.30;
    const lon = 115.71;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        weatherForecast = data.daily;
        // Now that weather is here, fetch and render calendar
        fetchCalendarEvents();
    } catch (err) {
        console.error("Weather Fetch Error:", err);
        fetchCalendarEvents(); // Fallback: render calendar without weather
    }
}

function getWeatherIcon(code) {
    if (code === 0) return 'https://openweathermap.org/img/wn/01d@2x.png'; 
    if (code >= 1 && code <= 3) return 'https://openweathermap.org/img/wn/02d@2x.png'; 
    if (code >= 45 && code <= 48) return 'https://openweathermap.org/img/wn/50d@2x.png'; 
    if (code >= 51 && code <= 67) return 'https://openweathermap.org/img/wn/10d@2x.png'; 
    if (code >= 80 && code <= 82) return 'https://openweathermap.org/img/wn/09d@2x.png'; 
    if (code >= 95) return 'https://openweathermap.org/img/wn/11d@2x.png'; 
    return 'https://openweathermap.org/img/wn/03d@2x.png'; 
}

/* ==========================================
   4. CALENDAR RENDERING LOGIC
   ========================================= */
async function fetchCalendarEvents() {
    const now = new Date();
    const day = now.getDay(); 
    const diff = (day === 0 ? -6 : 1) - day;
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
                personName: person.name,
                personColor: person.color,
                calendarId: person.id 
            }));
            allEvents = allEvents.concat(events);
        }
        renderCalendarGrid(startOfWeek, allEvents);
    } catch (err) {
        console.error("Calendar Fetch Error:", err);
    }
}

function renderCalendarGrid(startDate, allEvents) {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = ''; 
    let loopDate = new Date(startDate);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 42; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        
        const compareDate = new Date(loopDate);
        compareDate.setHours(0, 0, 0, 0);

        if (compareDate < today) {
            dayCell.classList.add('past-day');
        } else if (compareDate.getTime() === today.getTime()) {
            dayCell.classList.add('today-day');
        }

        // WEATHER LOGIC FOR CELL
        let weatherHTML = '';
        if (weatherForecast) {
            const dateISO = loopDate.toISOString().split('T')[0];
            const wIdx = weatherForecast.time.indexOf(dateISO);
            if (wIdx !== -1) {
                const max = Math.round(weatherForecast.temperature_2m_max[wIdx]);
                const min = Math.round(weatherForecast.temperature_2m_min[wIdx]);
                const code = weatherForecast.weather_code[wIdx];
                weatherHTML = `
                    <div class="cell-weather">
                        <div class="cell-temp">${max}°<span>${min}°</span></div>
                        <img src="${getWeatherIcon(code)}" alt="weather">
                    </div>`;
            }
        }

        // TOP ROW: Date (Left) and Weather (Right)
        const monthLabel = monthNames[loopDate.getMonth()];
        dayCell.innerHTML = `
            <div class="day-top-row">
                <div class="day-num">${monthLabel} ${loopDate.getDate()}</div>
                ${weatherHTML}
            </div>
        `;

        const dayYear = loopDate.getFullYear();
        const dayMonth = loopDate.getMonth();
        const dayDate = loopDate.getDate();

        const dailyEvents = allEvents.filter(e => {
            const eventStart = new Date(e.start.dateTime || e.start.date);
            return eventStart.getFullYear() === dayYear &&
                   eventStart.getMonth() === dayMonth &&
                   eventStart.getDate() === dayDate;
        });

        dailyEvents.sort((a, b) => {
            const aTime = a.start.dateTime ? new Date(a.start.dateTime).getTime() : 0;
            const bTime = b.start.dateTime ? new Date(b.start.dateTime).getTime() : 0;
            return aTime - bTime;
        });

        dailyEvents.forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event';
            eventDiv.style.backgroundColor = event.personColor;
            eventDiv.onclick = () => openEventModal(event);

            let timeString = "";
            if (event.start.dateTime) {
                const start = new Date(event.start.dateTime);
                timeString = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + " ";
            }

            eventDiv.innerText = timeString + event.summary;
            dayCell.appendChild(eventDiv);
        });

        grid.appendChild(dayCell);
        loopDate.setDate(loopDate.getDate() + 1);
    }
}

/* ==========================================
   5. MODALS, COUNTDOWN, TASKS (Remaining Same)
   ========================================== */
function openCountdownModal() {
    isCountdownMode = true;
    const modal = document.getElementById('eventModal');
    const deleteBtn = document.getElementById('deleteEventBtn');
    const selectGroup = document.getElementById('calendar-select-group');
    document.getElementById('modalTitle').innerText = "Set Wall Countdown";
    selectGroup.classList.add('hidden');
    document.getElementById('eventSummary').value = localStorage.getItem('wallCountdownName') || '';
    document.getElementById('eventDate').value = localStorage.getItem('wallCountdownDate') || '';
    document.getElementById('eventTime').value = localStorage.getItem('wallCountdownTime') || '';
    deleteBtn.style.display = localStorage.getItem('wallCountdownName') ? "block" : "none";
    deleteBtn.innerText = "Remove Countdown";
    modal.style.display = "block";
}

function openEventModal(event = null) {
    isCountdownMode = false;
    const modal = document.getElementById('eventModal');
    const select = document.getElementById('eventCalendar');
    const selectGroup = document.getElementById('calendar-select-group');
    const deleteBtn = document.getElementById('deleteEventBtn');
    const title = document.getElementById('modalTitle');
    selectGroup.classList.remove('hidden');
    deleteBtn.innerText = "Delete";
    select.innerHTML = FAMILY_CALENDARS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    if (event) {
        currentEditEvent = event;
        title.innerText = "Edit Event";
        document.getElementById('eventSummary').value = event.summary;
        select.value = event.calendarId;
        const start = new Date(event.start.dateTime || event.start.date);
        document.getElementById('eventDate').value = start.toISOString().split('T')[0];
        document.getElementById('eventTime').value = event.start.dateTime ? start.toTimeString().slice(0, 5) : '';
        deleteBtn.style.display = "block";
    } else {
        currentEditEvent = null;
        title.innerText = "Add Family Event";
        document.getElementById('eventSummary').value = '';
        document.getElementById('eventDate').valueAsDate = new Date();
        document.getElementById('eventTime').value = '';
        deleteBtn.style.display = "none";
    }
    modal.style.display = "block";
}

function closeEventModal() { document.getElementById('eventModal').style.display = "none"; }

async function submitEvent() {
    const summary = document.getElementById('eventSummary').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    if (!summary || !date) { alert("Please enter a name and date."); return; }
    if (isCountdownMode) {
        localStorage.setItem('wallCountdownName', summary);
        localStorage.setItem('wallCountdownDate', date);
        localStorage.setItem('wallCountdownTime', time);
        initCountdown();
        closeEventModal();
    } else {
        const calendarId = document.getElementById('eventCalendar').value;
        let startObj = time ? { 'dateTime': `${date}T${time}:00+08:00` } : { 'date': date };
        let endObj = time ? { 'dateTime': `${date}T${addOneHour(time)}:00+08:00` } : { 'date': date };
        try {
            const resource = { 'summary': summary, 'start': startObj, 'end': endObj };
            if (currentEditEvent) {
                await gapi.client.calendar.events.update({ 'calendarId': currentEditEvent.calendarId, 'eventId': currentEditEvent.id, 'resource': resource });
            } else {
                await gapi.client.calendar.events.insert({ 'calendarId': calendarId, 'resource': resource });
            }
            closeEventModal();
            fetchCalendarEvents();
        } catch (err) { console.error("Calendar Save Error:", err); }
    }
}

async function deleteEvent() {
    if (isCountdownMode) {
        if (confirm("Remove the countdown timer?")) {
            localStorage.removeItem('wallCountdownName');
            localStorage.removeItem('wallCountdownDate');
            localStorage.removeItem('wallCountdownTime');
            initCountdown();
            closeEventModal();
        }
    } else {
        if (!currentEditEvent || !confirm("Delete this event?")) return;
        try {
            await gapi.client.calendar.events.delete({ 'calendarId': currentEditEvent.calendarId, 'eventId': currentEditEvent.id });
            closeEventModal();
            fetchCalendarEvents();
        } catch (err) { console.error("Delete Error:", err); }
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
    const widget = document.getElementById('countdown-widget');
    const addBtn = document.getElementById('add-countdown-btn');
    if (!name || !date) {
        widget.classList.add('hidden');
        addBtn.classList.remove('hidden');
        if (countdownInterval) clearInterval(countdownInterval);
        return;
    }
    widget.classList.remove('hidden');
    addBtn.classList.add('hidden');
    document.getElementById('widget-label').innerText = name;
    if (countdownInterval) clearInterval(countdownInterval);
    const target = new Date(`${date}T${time}:00+08:00`).getTime();
    countdownInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = target - now;
        if (distance < 0) {
            clearInterval(countdownInterval);
            document.getElementById('widget-timer').innerText = "LIVE!";
            return;
        }
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        document.getElementById('widget-timer').innerText = `${d}d ${h.toString().padStart(2,'0')}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
    }, 1000);
}

async function fetchTasks() {
    try {
        const tasklistResponse = await gapi.client.tasks.tasklists.list();
        const taskLists = tasklistResponse.result.items || [];
        const container = document.getElementById('task-lists-container');
        container.innerHTML = ''; 
        for (const list of taskLists) {
            const taskResponse = await gapi.client.tasks.tasks.list({ tasklist: list.id, showCompleted: false });
            const tasks = taskResponse.result.items || [];
            const listDiv = document.createElement('div');
            listDiv.className = 'task-group';
            listDiv.innerHTML = `<h3>${list.title}</h3>`;
            tasks.forEach(task => {
                const item = document.createElement('div');
                item.style.padding = "4px 0";
                item.innerHTML = `<input type="checkbox"> <span style="font-size:0.9rem;">${task.title}</span>`;
                listDiv.appendChild(item);
            });
            container.appendChild(listDiv);
        }
    } catch (err) { console.error("Tasks Fetch Error:", err); }
}

window.onload = () => { 
    gapiLoaded(); 
    gisLoaded(); 
    initCountdown(); 
};