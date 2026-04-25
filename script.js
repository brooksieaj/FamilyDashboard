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
    
    // Force Monday Start Math
    const day = now.getDay(); // Sun=0, Mon=1... Sat=6
    const diff = (day === 0 ? -6 : 1) - day; 
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0); // Start at the very beginning of Monday

    // For debugging - this will show up in your Console (Ctrl+Shift+J)
    console.log("Calculated Monday Start:", startOfWeek.toDateString());

    const endOfPeriod = new Date(startOfWeek);
    endOfPeriod.setDate(startOfWeek.getDate() + 42); // Exactly 6 weeks

    try {
        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': startOfWeek.toISOString(),
            'timeMax': endOfPeriod.toISOString(),
            'singleEvents': true,
            'orderBy': 'startTime',
        });

        const events = response.result.items;
        // Pass the startOfWeek into the renderer so the grid knows where to begin
        renderCalendarGrid(startOfWeek, events);
    } catch (err) {
        console.error("Error fetching calendar:", err);
    }
}

function renderCalendarGrid(startDate, events) {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = ''; 

    // Create a NEW date object based on the start date so we don't mess up the original
    let loopDate = new Date(startDate);

    for (let i = 0; i < 42; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        
        // Add the date number
        dayCell.innerHTML = `<div class="day-num">${loopDate.getDate()}</div>`;

        // Check if this date is "Today" to highlight it (Optional but helpful!)
        const today = new Date();
        if (loopDate.toDateString() === today.toDateString()) {
            dayCell.style.border = "2px solid #4285f4";
            dayCell.style.backgroundColor = "#e8f0fe";
        }

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
        
        // Move to the next day for the next loop iteration
        loopDate.setDate(loopDate.getDate() + 1);
    }
}

window.onload = () => { gapiLoaded(); gisLoaded(); };