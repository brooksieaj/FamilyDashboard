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
    // Start of current week (Monday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfPeriod = new Date(startOfWeek);
    endOfPeriod.setDate(startOfWeek.getDate() + 42);

    try {
        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': startOfWeek.toISOString(),
            'timeMax': endOfPeriod.toISOString(),
            'singleEvents': true,
            'orderBy': 'startTime',
        });
        renderCalendarGrid(startOfWeek, response.result.items);
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

function renderCalendarGrid(startDate, events) {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    let currentDate = new Date(startDate);

    for (let i = 0; i < 42; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        dayCell.innerHTML = `<div class="day-num">${currentDate.getDate()}</div>`;

        const dateString = currentDate.toISOString().split('T')[0];
        const dailyEvents = events.filter(e => (e.start.dateTime || e.start.date).startsWith(dateString));

        dailyEvents.forEach(event => {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event';
            eventDiv.innerText = event.summary;
            dayCell.appendChild(eventDiv);
        });

        grid.appendChild(dayCell);
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

window.onload = () => { gapiLoaded(); gisLoaded(); };