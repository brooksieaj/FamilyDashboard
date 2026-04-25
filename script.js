const CLIENT_ID = '145116633029-6ujgciuv8f3c9901c8uaorr6qopsaa4v.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks';

let tokenClient;
let accessToken = null;

// Load Google API Libraries
function gapiLoaded() {
    gapi.load('client', async () => {
        await gapi.client.init({});
        await gapi.client.load('calendar', 'v3');
        await gapi.client.load('tasks', 'v1');
        console.log("Google Libraries Loaded");
    });
}

// Handle the Login Popup
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse.error !== undefined) {
                throw (tokenResponse);
            }
            accessToken = tokenResponse.access_token;
            document.getElementById('auth_button').innerText = "Refresh Data";
            fetchCalendarEvents();
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

async function fetchCalendarEvents() {
    const now = new Date();
    
    // 1. Find the current day of the week (0 = Sun, 1 = Mon, etc.)
    const day = now.getDay();
    
    // 2. Calculate how many days to subtract to get back to Monday
    // If it's Sunday (0), we go back 6 days. 
    // Otherwise, we go back (day - 1) days.
    const diff = (day === 0 ? -6 : 1) - day;
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // 3. Keep the 42-day (6-week) range
    const endOfPeriod = new Date(startOfWeek);
    endOfPeriod.setDate(startOfWeek.getDate() + 42);

    try {
        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': startOfWeek.toISOString(),
            'timeMax': endOfPeriod.toISOString(),
            'showDeleted': false,
            'singleEvents': true,
            'orderBy': 'startTime',
        });

        const events = response.result.items;
        renderCalendarGrid(startOfWeek, events);
    } catch (err) {
        console.error("Error fetching calendar:", err);
    }
}

function renderCalendarGrid(startDate, events) {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = ''; 

    let loopDate = new Date(startDate);
    
    // Array to convert month numbers (0-11) to names
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 42; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        
        // This line now combines the month name and the date number
        const monthLabel = monthNames[loopDate.getMonth()];
        const dateNum = loopDate.getDate();
        
        dayCell.innerHTML = `<div class="day-num">${monthLabel} ${dateNum}</div>`;

        // ... keep the rest of your event filtering code below ...
        const dateString = loopDate.toISOString().split('T')[0];
        const dailyEvents = events.filter(e => {
            const eventDate = (e.start.dateTime || e.start.date).split('T')[0];
            return eventDate === dateString;
        });

        dailyEvents.forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event';
            eventDiv.innerText = event.summary;
            dayCell.appendChild(eventDiv);
        });

        grid.appendChild(dayCell);
        loopDate.setDate(loopDate.getDate() + 1);
    }
}

window.onload = () => { gapiLoaded(); gisLoaded(); };