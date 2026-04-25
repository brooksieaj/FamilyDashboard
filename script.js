/* ==========================================
   1. CONFIGURATION & IDENTITY
   ========================================== */
const CLIENT_ID = '145116633029-6ujgciuv8f3c9901c8uaorr6qopsaa4v.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks';

const FAMILY_CALENDARS = [
    { name: 'Dad', id: 'primary', color: '#4285f4' }, 
    { name: 'Mum', id: '9qbap7bc4933q6ujmpmo0p88kg@group.calendar.google.com', color: '#0f9d58' }, 
    { name: 'Clemence', id: 'lj8rt1jbb51g1rf31db3suus1s@group.calendar.google.com',  color: '#db4437'},
    { name: 'Grace', id: 'jjfqnrfqa9jvuc7j3nfu07qj1c@group.calendar.google.com', color: '#ffa8cf' },
    { name: 'Eadie', id: 'ed08111eb8ad386bd9798fd71e2e754da01c6eb2ab8ad203db20d5436e10a5d2@group.calendar.google.com', color: '#710193' }
];

let tokenClient;
let accessToken = null;

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
            if (tokenResponse.error !== undefined) {
                throw (tokenResponse);
            }
            accessToken = tokenResponse.access_token;
            document.getElementById('auth_button').innerText = "Refresh Board";
            
            fetchCalendarEvents();
            fetchTasks(); 

            // Auto-refresh every 5 minutes (300,000 ms)
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
   3. CALENDAR LOGIC (Sorted, Past-Greyed, & Cleaned)
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
                personColor: person.color
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
    today.setHours(0, 0, 0, 0); // Normalized for comparison

    for (let i = 0; i < 42; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        
        // 1. Determine if day is Past, Today, or Future
        const compareDate = new Date(loopDate);
        compareDate.setHours(0, 0, 0, 0);

        if (compareDate < today) {
            dayCell.classList.add('past-day');
        } else if (compareDate.getTime() === today.getTime()) {
            dayCell.classList.add('today-day');
        }

        const monthLabel = monthNames[loopDate.getMonth()];
        dayCell.innerHTML = `<div class="day-num">${monthLabel} ${loopDate.getDate()}</div>`;

        // 2. Local Date Comparison (Timezone Safe)
        const dayYear = loopDate.getFullYear();
        const dayMonth = loopDate.getMonth();
        const dayDate = loopDate.getDate();

        const dailyEvents = allEvents.filter(e => {
            const eventStart = new Date(e.start.dateTime || e.start.date);
            return eventStart.getFullYear() === dayYear &&
                   eventStart.getMonth() === dayMonth &&
                   eventStart.getDate() === dayDate;
        });

        // 3. Chronological Sort (All-Day first)
        dailyEvents.sort((a, b) => {
            const aTime = a.start.dateTime ? new Date(a.start.dateTime).getTime() : 0;
            const bTime = b.start.dateTime ? new Date(b.start.dateTime).getTime() : 0;
            return aTime - bTime;
        });

        dailyEvents.forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event';
            eventDiv.style.backgroundColor = event.personColor;

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
   4. TASKS LOGIC
   ========================================== */
async function fetchTasks() {
    try {
        const tasklistResponse = await gapi.client.tasks.tasklists.list();
        const taskLists = tasklistResponse.result.items;
        const container = document.getElementById('task-lists-container');
        container.innerHTML = ''; 

        for (const list of taskLists) {
            const taskResponse = await gapi.client.tasks.tasks.list({
                tasklist: list.id,
                showCompleted: false
            });

            const tasks = taskResponse.result.items || [];
            const listDiv = document.createElement('div');
            listDiv.className = 'task-group';
            listDiv.innerHTML = `<h3 style="border-bottom:1px solid #eee; margin-top:15px;">${list.title}</h3>`;
            
            tasks.forEach(task => {
                const item = document.createElement('div');
                item.style.padding = "4px 0";
                item.innerHTML = `<input type="checkbox"> <span style="font-size:0.9rem;">${task.title}</span>`;
                listDiv.appendChild(item);
            });
            
            container.appendChild(listDiv);
        }

        // Add "Last Sync" timestamp to the bottom of the sidebar once all tasks are loaded
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
};