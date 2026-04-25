/* ==========================================
   1. CONFIGURATION & IDENTITY
   ========================================== */
const CLIENT_ID = '145116633029-6ujgciuv8f3c9901c8uaorr6qopsaa4v.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks';

// Add your family members and their IDs from Google Calendar Settings
const FAMILY_CALENDARS = [
    { name: 'Dad', id: 'primary', color: '#4285f4' }, 
    { name: 'Mum', id: '9qbap7bc4933q6ujmpmo0p88kg@group.calendar.google.com', color: '#0f9d58' }, 
    { name: 'Clemence', id: 'lj8rt1jbb51g1rf31db3suus1s@group.calendar.google.com',  color: '#db4437'}
    { name: 'Grace', id: 'jjfqnrfqa9jvuc7j3nfu07qj1c@group.calendar.google.com', color: '#ffa8cf' }
    { name: 'Eadie', id: 'ed08111eb8ad386bd9798fd71e2e754da01c6eb2ab8ad203db20d5436e10a5d2@group.calendar.google.com', color: '#9867C5' }
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
            
            // Trigger both Calendar and Tasks
            fetchCalendarEvents();
            fetchTasks(); 
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
   3. CALENDAR LOGIC (6-Week Monday Start)
   ========================================== */
async function fetchCalendarEvents() {
    const now = new Date();
    const day = now.getDay(); 
    
    // Calculate Monday Start
    const diff = (day === 0 ? -6 : 1) - day;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfPeriod = new Date(startOfWeek);
    endOfPeriod.setDate(startOfWeek.getDate() + 42);

    try {
        let allEvents = [];

        // Fetch events for every person in the list
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

    for (let i = 0; i < 42; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        
        // Month and Date Label
        const monthLabel = monthNames[loopDate.getMonth()];
        dayCell.innerHTML = `<div class="day-num">${monthLabel} ${loopDate.getDate()}</div>`;

        // Highlight Today
        const today = new Date();
        if (loopDate.toDateString() === today.toDateString()) {
            dayCell.style.border = "2px solid #4285f4";
            dayCell.style.backgroundColor = "#fdfdfd";
        }

        const dateString = loopDate.toISOString().split('T')[0];
        const dailyEvents = allEvents.filter(e => (e.start.dateTime || e.start.date).startsWith(dateString));

        dailyEvents.forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event';
            eventDiv.style.backgroundColor = event.personColor;
            eventDiv.innerText = `${event.personName}: ${event.summary}`;
            dayCell.appendChild(eventDiv);
        });

        grid.appendChild(dayCell);
        loopDate.setDate(loopDate.getDate() + 1);
    }
}

/* ==========================================
   4. TASKS LOGIC (Sidebar)
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
    } catch (err) {
        console.error("Tasks Fetch Error:", err);
    }
}

// Start the engines
window.onload = () => { 
    gapiLoaded(); 
    gisLoaded(); 
};