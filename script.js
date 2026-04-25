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
let countdownInterval = null; // Stores the ticking clock

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
            
            fetchCalendarEvents();
            fetchTasks(); 

            setInterval(() => {
                fetchCalendarEvents();
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
   3. CALENDAR RENDERING LOGIC
   ========================================== */
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

        const monthLabel = monthNames[loopDate.getMonth()];
        dayCell.innerHTML = `<div class="day-num">${monthLabel} ${loopDate.getDate()}</div>`;

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
   4. EVENT MODAL LOGIC (ADD / EDIT / DELETE)
   ========================================== */
function openEventModal(event = null) {
    const modal = document.getElementById('eventModal');
    const select = document.getElementById('eventCalendar');
    const deleteBtn = document.getElementById('deleteEventBtn');
    const title = document.getElementById('modalTitle');
    
    select.innerHTML = FAMILY_CALENDARS.map(p => 
        `<option value="${p.id}">${p.name}</option>`
    ).join('');

    // Pre-fill Countdown fields from localStorage
    document.getElementById('countdownEventName').value = localStorage.getItem('countdownName') || '';
    document.getElementById('countdownTargetDate').value = localStorage.getItem('countdownDate') || '';
    document.getElementById('countdownTargetTime').value = localStorage.getItem('countdownTime') || '';

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

function closeEventModal() {
    document.getElementById('eventModal').style.display = "none";
}

async function submitEvent() {
    const summary = document.getElementById('eventSummary').value;
    const calendarId = document.getElementById('eventCalendar').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;

    // 1. Handle Countdown Logic
    const cName = document.getElementById('countdownEventName').value;
    const cDate = document.getElementById('countdownTargetDate').value;
    const cTime = document.getElementById('countdownTargetTime').value;

    if (cName && cDate) {
        localStorage.setItem('countdownName', cName);
        localStorage.setItem('countdownDate', cDate);
        localStorage.setItem('countdownTime', cTime);
        initCountdown(); // Refresh the timer display
    }

    // 2. Handle Calendar Logic
    if (summary && date) {
        let startObj = time ? { 'dateTime': `${date}T${time}:00+08:00` } : { 'date': date };
        let endObj = time ? { 'dateTime': `${date}T${addOneHour(time)}:00+08:00` } : { 'date': date };

        try {
            const resource = { 'summary': summary, 'start': startObj, 'end': endObj };
            if (currentEditEvent) {
                await gapi.client.calendar.events.update({
                    'calendarId': currentEditEvent.calendarId,
                    'eventId': currentEditEvent.id,
                    'resource': resource
                });
            } else {
                await gapi.client.calendar.events.insert({ 'calendarId': calendarId, 'resource': resource });
            }
        } catch (err) {
            console.error("Calendar Save Error:", err);
        }
    }

    closeEventModal();
    fetchCalendarEvents();
}

async function deleteEvent() {
    if (!currentEditEvent || !confirm("Delete this event?")) return;
    try {
        await gapi.client.calendar.events.delete({
            'calendarId': currentEditEvent.calendarId,
            'eventId': currentEditEvent.id
        });
        closeEventModal();
        fetchCalendarEvents();
    } catch (err) {
        console.error("Delete Error:", err);
    }
}

function addOneHour(timeStr) {
    let [h, m] = timeStr.split(':').map(Number);
    return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ==========================================
   5. COUNTDOWN ENGINE
   ========================================== */
function initCountdown() {
    const name = localStorage.getItem('countdownName');
    const date = localStorage.getItem('countdownDate');
    const time = localStorage.getItem('countdownTime') || "00:00";

    if (!name || !date) return;

    document.getElementById('countdown-label').innerText = name.toUpperCase();
    
    if (countdownInterval) clearInterval(countdownInterval);

    const target = new Date(`${date}T${time}:00+08:00`).getTime();

    countdownInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = target - now;

        if (distance < 0) {
            clearInterval(countdownInterval);
            document.getElementById('countdown-timer').innerText = "EVENT STARTED!";
            return;
        }

        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById('countdown-timer').innerText = 
            `${d}d ${h.toString().padStart(2,'0')}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
    }, 1000);
}

/* ==========================================
   6. TASKS LOGIC
   ========================================== */
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
        
        const syncTime = document.createElement('p');
        syncTime.style = "font-size:0.7rem; color:#ccc; text-align:center; margin-top: 20px;";
        syncTime.innerText = `Last sync: ${new Date().toLocaleTimeString()}`;
        container.appendChild(syncTime);
    } catch (err) {
        console.error("Tasks Fetch Error:", err);
    }
}

window.onload = () => { 
    gapiLoaded(); 
    gisLoaded(); 
    initCountdown(); // Start the timer when the page opens
};