/* ==========================================
   1. CONFIGURATION & GLOBAL IDENTITY
   ========================================== */
const CLIENT_ID = '145116633029-6ujgciuv8f3c9901c8uaorr6qopsaa4v.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks';
const API_KEY = 'AIzaSyBgMck-FAK8w_oGrZhpfiOy17kHbmpkNJE'

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
let currentEditEvent = null; 
let isCountdownMode = false; 
let countdownInterval = null; 
let weatherForecast = null; 

// Secure token persistence getter
function getValidAccessToken() {
    const token = localStorage.getItem('google_access_token');
    const expiry = localStorage.getItem('google_token_expiry');
    
    if (!token || !expiry) return null;
    
    // Check if token has expired (with a 2-minute buffer)
    if (Date.now() > parseInt(expiry) - 120000) {
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expiry');
        return null;
    }
    return token;
}

/* ==========================================
   2. GOOGLE API LOADING & CORE LIFECYCLE
   ========================================== */
function gapiLoaded() {
    gapi.load('client', async () => {
        await gapi.client.init({});
        await gapi.client.load('calendar', 'v3');
        await gapi.client.load('tasks', 'v1');
        console.log("Google Libraries Loaded");
        
        const activeToken = getValidAccessToken();
        
        if (activeToken) {
            gapi.client.setToken({ access_token: activeToken });
            if (document.getElementById('calendar-grid')) {
                fetchWeatherData();
            }
            if (window.syncGoogleTasks) {
                window.syncGoogleTasks();
            }
        } else if (localStorage.getItem('google_session_active') === 'true' && tokenClient) {
            // Standard silent refresh using prompt: 'none'
            tokenClient.requestAccessToken({ prompt: 'none' }); 
        } else {
            const grid = document.getElementById('calendar-grid');
            if (grid) {
                grid.innerHTML = '<div class="blank-state-card" style="grid-column: 1/-1; text-align: center; padding: 40px; color: #777;"><i class="fas fa-lock" style="font-size: 2.5rem; margin-bottom: 15px; color: #ccc;"></i><p>Sign in via Settings to view your Family Calendars.</p></div>';
            }
        }
    });
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse.error !== undefined) throw (tokenResponse);
            
            const expiryTime = Date.now() + (parseInt(tokenResponse.expires_in) * 1000);
            localStorage.setItem('google_access_token', tokenResponse.access_token);
            localStorage.setItem('google_token_expiry', expiryTime.toString());
            localStorage.setItem('google_session_active', 'true');
            
            gapi.client.setToken({ access_token: tokenResponse.access_token });
            updateSettingsUI(true);

            if (document.getElementById('calendar-grid')) {
                fetchWeatherData();
            }
            if (window.syncGoogleTasks) {
                window.syncGoogleTasks();
            }
        },
    });

    if (!getValidAccessToken() && localStorage.getItem('google_session_active') === 'true') {
        console.log("Cached token missing/expired. Requesting background refresh...");
        // 'none' is crucial for silent background authentication
        tokenClient.requestAccessToken({ prompt: 'none' });
    }
}

function handleAuthClick() {
    // This triggers the popup flow which does not require a page reload
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleDisconnectClick() {
    if (confirm("Disconnect from Google Cloud? This will clear local tokens and disable sync features.")) {
        const token = localStorage.getItem('google_access_token');

        localStorage.removeItem('calendar_cache');
        localStorage.removeItem('calendar_cache_time');
        localStorage.removeItem('google_session_active');
        
        if (token) {
            // Using the specific revoke method provided by GIS
            google.accounts.oauth2.revoke(token, () => {
                console.log("Google session revoked successfully.");
            });
        }
        
        // Clear local storage entries
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expiry');
        localStorage.removeItem('google_session_active');
        
        // Reset the client token
        if (gapi.client) {
            gapi.client.setToken(null);
        }
        
        // Update the UI via the consolidated function
        updateSettingsUI(false);
        
        // Optional: Clear calendar view
        const grid = document.getElementById('calendar-grid');
        if (grid) {
            grid.innerHTML = '<div class="blank-state-card" style="grid-column: 1/-1; text-align: center; padding: 40px; color: #777;"><i class="fas fa-lock" style="font-size: 2.5rem; margin-bottom: 15px; color: #ccc;"></i><p>Sign in via Settings to view your Family Calendars.</p></div>';
        }
    }
}

function updateSettingsUI(isConnected) {
    const statusBadge = document.getElementById('auth-status-badge');
    const statusText = document.getElementById('status-text');
    const authBtn = document.getElementById('auth_button');
    const disconnectBtn = document.getElementById('disconnect_button');

    if (!statusBadge) return;

    if (isConnected) {
        // UI State: Connected
        statusBadge.className = "status-badge connected";
        statusText.innerText = "Connected";
        
        // Show re-authenticate, hide initial Sign In if necessary
        authBtn.innerText = "Re-authenticate Account";
        
        // Ensure disconnect button is visible
        if (disconnectBtn) disconnectBtn.classList.remove('hidden');
    } else {
        // UI State: Disconnected
        statusBadge.className = "status-badge disconnected";
        statusText.innerText = "Disconnected";
        
        // Reset to initial state
        authBtn.innerText = "Sign In with Google";
        
        // Hide disconnect button
        if (disconnectBtn) disconnectBtn.classList.add('hidden');
    }
}

/* ==========================================
   3. WEATHER SYNC DATA PIPE
   ========================================== */
function fetchWeatherData() {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=-32.3044&longitude=115.7119&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Australia%2FPerth')
        .then(response => response.json())
        .then(data => {
            weatherForecast = {};
            for(let i=0; i<data.daily.time.length; i++) {
                weatherForecast[data.daily.time[i]] = {
                    maxTemp: Math.round(data.daily.temperature_2m_max[i]),
                    minTemp: Math.round(data.daily.temperature_2m_min[i]),
                    code: data.daily.weathercode[i]
                };
            }
            fetchCalendarEvents();
        })
        .catch(err => {
            console.error("Weather data pipeline error:", err);
            fetchCalendarEvents(); 
        });
}

/* ==========================================
   4. DATA INGESTION (GOOGLE CALENDAR API)
   ========================================== */
async function fetchCalendarEvents() {
    const CACHE_KEY = 'calendar_cache';
    const TIME_KEY = 'calendar_cache_time';
    const CACHE_DURATION = 900000; // 15 minutes

    // 1. Check if cache is still valid
    const cachedData = localStorage.getItem(CACHE_KEY);
    const lastFetch = localStorage.getItem(TIME_KEY);

    if (cachedData && lastFetch && (Date.now() - parseInt(lastFetch) < CACHE_DURATION)) {
        console.log("Loading events from cache...");
        renderCalendarGrid(JSON.parse(cachedData));
        return;
    }

    // 2. Fetch fresh data if no cache exists or it has expired
    console.log("Fetching fresh events from Google...");
    const startOfWeek = getMonday(new Date());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 42); 

    const timeMin = startOfWeek.toISOString();
    const timeMax = endOfWeek.toISOString();

    const promises = FAMILY_CALENDARS.map(cal => {
        return gapi.client.calendar.events.list({
            'calendarId': cal.id,
            'timeMin': timeMin,
            'timeMax': timeMax,
            'singleEvents': true,
            'orderBy': 'startTime'
        }).then(response => {
            return response.result.items.map(event => ({
                ...event,
                calendarName: cal.name,
                calendarColor: cal.color,
                calendarId: cal.id
            }));
        }).catch(err => {
            console.warn(`Failed parsing pipeline array on calendar: ${cal.name}`, err);
            return [];
        });
    });

    // 3. Await all results to ensure data integrity
    const results = await Promise.all(promises);
    const allEvents = results.flat();
    
    // 4. Update storage with fresh data
    localStorage.setItem(CACHE_KEY, JSON.stringify(allEvents));
    localStorage.setItem(TIME_KEY, Date.now().toString());
    
    // 5. Render the grid with the new data
    renderCalendarGrid(allEvents);
}

/* ==========================================
   5. UI GENERATION & CALENDAR GRID
   ========================================== */
function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(d.setDate(diff));
}

function formatDateString(date) {
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
}

function renderCalendarGrid(events) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return; 
    grid.innerHTML = '';

    const monday = getMonday(new Date());

    for (let i = 0; i < 42; i++) {
        const currentDay = new Date(monday);
        currentDay.setDate(monday.getDate() + i);
        const dateString = formatDateString(currentDay);

        const cell = document.createElement('div');
        cell.className = 'day-cell';

        cell.onclick = (e) => {
            // Only trigger if clicking the cell background or header, not an event
            if (e.target.classList.contains('day-cell') || 
                e.target.classList.contains('day-top-row') || 
                e.target.classList.contains('day-num')) {
                
                openEventModal(null); // Open modal for adding
                document.getElementById('eventDate').value = dateString; // Auto-set clicked date
            }
        };
        
        const todayStr = formatDateString(new Date());
        if (dateString === todayStr) {
            cell.classList.add('today-day'); 
        } else {
            const yesterday = new Date();
            yesterday.setHours(0,0,0,0);
            if (currentDay < yesterday) {
                cell.classList.add('past-day'); 
            }
        }

        const dayTopRow = document.createElement('div');
        dayTopRow.className = 'day-top-row';
        
        const dateLabel = document.createElement('span');
        dateLabel.className = 'day-num'; 
        dateLabel.innerText = currentDay.getDate();
        dayTopRow.appendChild(dateLabel);

        if (weatherForecast && weatherForecast[dateString]) {
            const w = weatherForecast[dateString];
            const weatherLabel = document.createElement('div');
            weatherLabel.className = 'cell-weather';
            weatherLabel.innerHTML = `
                <span class="cell-temp">${w.maxTemp}°<span>/${w.minTemp}°</span></span>
            `;
            dayTopRow.appendChild(weatherLabel);
        }

        cell.appendChild(dayTopRow);

        const dayEvents = events.filter(e => {
            // 1. Strict null-check for the start property
            if (!e || !e.start) return false;
            const datePart = (e.start.date || e.start.dateTime || "").substring(0, 10);
            return datePart === dateString;
        });

        // 2. Sort with absolute safety
        dayEvents.sort((a, b) => {
            // Treat null/undefined starts as lowest priority (at the end)
            if (!a.start) return 1;
            if (!b.start) return -1;

            // All-day event check
            const aIsAllDay = !!a.start.date;
            const bIsAllDay = !!b.start.date;

            if (aIsAllDay && !bIsAllDay) return -1;
            if (!aIsAllDay && bIsAllDay) return 1;
            if (aIsAllDay && bIsAllDay) return 0;

            // Timed events: Safe string comparison
            return (a.start.dateTime || "").localeCompare(b.start.dateTime || "");
        });

        // 3. Render
        dayEvents.forEach(event => {
            const evEl = document.createElement('div');
            evEl.className = 'event'; 
            evEl.style.backgroundColor = event.calendarColor || '#4285f4'; // Fallback color

            let timeStr = "";
            if (event.start.dateTime) {
                // Use try-catch here to ensure one bad date string doesn't break the whole loop
                try {
                    const d = new Date(event.start.dateTime);
                    timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) + " ";
                } catch (e) {
                    timeStr = "";
                }
            }

            evEl.innerText = `${timeStr}${event.summary || 'Untitled Event'}`;
            evEl.onclick = (e) => {
                e.stopPropagation(); 
                openEventModal(event);
            };

            cell.appendChild(evEl);
        });

        grid.appendChild(cell);
    }
}

/* ==========================================
   6. INTERACTIVE ACTIONS & MODALS
   ========================================== */
function openEventModal(event = null) {
    if (!getValidAccessToken()) {
        alert("Action Locked: Please sign in via System Settings first.");
        return;
    }

    currentEditEvent = event;
    const modal = document.getElementById('eventModal');
    const select = document.getElementById('eventCalendar');
    
    if(!modal || !select) return;

    select.innerHTML = '';
    FAMILY_CALENDARS.forEach(cal => {
        const opt = document.createElement('option');
        opt.value = cal.id;
        opt.innerText = cal.name;
        select.appendChild(opt);
    });

    if (event) {
        document.getElementById('modalTitle').innerText = "Edit Family Event";
        document.getElementById('eventSummary').value = event.summary;
        document.getElementById('eventCalendar').value = event.calendarId;
        document.getElementById('calendar-select-group').style.display = 'none'; 
        document.getElementById('deleteEventBtn').style.display = 'inline-block';

        if (event.start.date) {
            document.getElementById('eventDate').value = event.start.date;
            document.getElementById('eventTime').value = '';
        } else {
            const d = new Date(event.start.dateTime);
            document.getElementById('eventDate').value = formatDateString(d);
            document.getElementById('eventTime').value = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        }
    } else {
        document.getElementById('modalTitle').innerText = "Add Family Event";
        document.getElementById('eventSummary').value = '';
        document.getElementById('eventCalendar').value = 'primary';
        document.getElementById('calendar-select-group').style.display = 'block';

        // ONLY set to today if the input is currently empty 
        // (This allows the cell click handler to pass the date through first)
        if (!document.getElementById('eventDate').value) {
            document.getElementById('eventDate').value = formatDateString(new Date());
        }

        document.getElementById('eventTime').value = '12:00';
        document.getElementById('deleteEventBtn').style.display = 'none';
    }
    modal.style.display = 'block';
}

function closeEventModal() {
    const modal = document.getElementById('eventModal');
    if (modal) modal.style.display = 'none';
    currentEditEvent = null;
}

function submitEvent() {
    const summary = document.getElementById('eventSummary').value;
    const calendarId = document.getElementById('eventCalendar').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;

    if (!summary) return alert("Please specify an event title name.");

    let start = {}, end = {};
    if (!time) {
        // All-day event: Google API expects a simple date string
        start.date = date;
        end.date = date;
    } else {
        // Timed event: Use ISO strings for both start and end
        start.dateTime = `${date}T${time}:00`;
        start.timeZone = 'Australia/Perth';
        
        const endDateObj = new Date(`${date}T${time}:00`);
        endDateObj.setHours(endDateObj.getHours() + 1); 
        
        end.dateTime = endDateObj.toISOString();
        end.timeZone = 'Australia/Perth';
    }

    const resource = { summary, start, end };

    // FIX: Always use the ID stored in the object being edited, 
    // rather than relying on the (hidden) select dropdown
    const targetCalendarId = currentEditEvent ? currentEditEvent.calendarId : calendarId;

    if (currentEditEvent) { 
        gapi.client.calendar.events.update({
            calendarId: targetCalendarId,
            eventId: currentEditEvent.id,
            resource: resource
        }).then(() => {
            // Clear cache to force fresh fetch
            localStorage.removeItem('calendar_cache');
            localStorage.removeItem('calendar_cache_time');
            
            closeEventModal();
            fetchCalendarEvents();
        }).catch(err => {
            console.error("Update failed:", err);
            alert("Error updating event. Check console.");
        });
    } else {
        // This is the "else" statement you asked about
        gapi.client.calendar.events.insert({
            calendarId: calendarId,
            resource: resource
        }).then(() => {
            // Also clear cache here so new events appear immediately
            localStorage.removeItem('calendar_cache');
            localStorage.removeItem('calendar_cache_time');
            
            closeEventModal();
            fetchCalendarEvents();
        }).catch(err => {
            console.error("Insert failed:", err);
            alert("Error creating event. Check console.");
        });
    }
}

function deleteEvent() {
    if (currentEditEvent && confirm("Permanently delete this event entry from the calendar?")) {
        gapi.client.calendar.events.delete({
            calendarId: currentEditEvent.calendarId,
            eventId: currentEditEvent.id
        }).then(() => {
            // ADD THESE LINES TO CLEAR CACHE AFTER DELETION
            localStorage.removeItem('calendar_cache');
            localStorage.removeItem('calendar_cache_time');
            
            closeEventModal();
            fetchCalendarEvents(); // This will now fetch fresh data from Google
        }).catch(err => {
            console.error("Delete failed:", err);
            alert("Error deleting event. Check console.");
        });
    }
}

function forceRefreshCalendar() {
    if (!getValidAccessToken()) {
        alert("Please sign in to sync events.");
        return;
    }
    
    // Clear the cache to force a fresh network request
    localStorage.removeItem('calendar_cache');
    localStorage.removeItem('calendar_cache_time');
    
    console.log("Manual refresh triggered.");
    fetchCalendarEvents(); // Re-sync all events
}

/* ==========================================
   7. SPECIAL AD-HOC APPS: COUNTDOWN ENGINE
   ========================================== */
function initCountdown() {
    const target = localStorage.getItem('countdown_target_datetime');
    const label = localStorage.getItem('countdown_target_label');
    const widget = document.getElementById('countdown-widget');
    const addBtn = document.getElementById('add-countdown-btn');

    if (target && widget) {
        if (addBtn) addBtn.style.display = 'none';
        widget.classList.remove('hidden');
        document.getElementById('widget-label').innerText = label || "Countdown Event";
        
        if (countdownInterval) clearInterval(countdownInterval);
        
        const targetDate = new Date(target).getTime();
        
        function updateTimer() {
            const now = Date.now();
            const distance = targetDate - now;
            
            if (distance < 0) {
                document.getElementById('widget-timer').innerText = "00d 00h 00m 00s";
                document.getElementById('widget-timer').style.color = "#db4437";
                clearInterval(countdownInterval);
                return;
            }
            
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            document.getElementById('widget-timer').innerText = 
                `${String(days).padStart(2,'0')}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m ${String(seconds).padStart(2,'0')}s`;
        }
        
        updateTimer();
        countdownInterval = setInterval(updateTimer, 1000);
    } else {
        if (widget) widget.classList.add('hidden');
        if (addBtn) addBtn.style.display = 'inline-block';
    }
}

function openCountdownModal() {
    const target = localStorage.getItem('countdown_target_datetime');
    const label = localStorage.getItem('countdown_target_label');
    
    let modal = document.getElementById('countdownModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'countdownModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Configure Event Countdown</h2>
                <label for="countLabel">Event Title:</label>
                <input type="text" id="countLabel" placeholder="e.g., Family Vacation!">
                <label for="countDate">Target Date:</label>
                <input type="date" id="countDate">
                <label for="countTime">Target Time:</label>
                <input type="time" id="countTime" value="00:00">
                <div class="modal-buttons" style="margin-top:20px;">
                    <button id="clearCountdownBtn" style="background-color:#db4437;">Delete</button>
                    <button style="background-color:#aaa;" onclick="document.getElementById('countdownModal').style.display='none'">Cancel</button>
                    <button id="saveCountdownBtn">Save Widget</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('clearCountdownBtn').onclick = () => {
            localStorage.removeItem('countdown_target_datetime');
            localStorage.removeItem('countdown_target_label');
            if (countdownInterval) clearInterval(countdownInterval);
            modal.style.display = 'none';
            initCountdown();
        };
        
        document.getElementById('saveCountdownBtn').onclick = () => {
            const lbl = document.getElementById('countLabel').value || "Countdown Event";
            const dt = document.getElementById('countDate').value;
            const tm = document.getElementById('countTime').value || "00:00";
            if (!dt) return alert("Please supply a valid future target calendar date.");
            
            localStorage.setItem('countdown_target_datetime', `${dt}T${tm}`);
            localStorage.setItem('countdown_target_label', lbl);
            modal.style.display = 'none';
            initCountdown();
        };
    }
    
    if (target) {
        const parts = target.split('T');
        document.getElementById('countLabel').value = label || '';
        document.getElementById('countDate').value = parts[0];
        document.getElementById('countTime').value = parts[1] || '00:00';
    } else {
        document.getElementById('countLabel').value = '';
        document.getElementById('countDate').value = formatDateString(new Date());
    }
    
    modal.style.display = 'block';
}

/* ==========================================
   8. CORE ONLOAD RUNTIME SETUP
   ========================================== */
function runtimeInitEngine() {
    initCountdown();
    
    // Check if we have both the token and the session flag
    const hasToken = !!getValidAccessToken();
    const isSessionActive = localStorage.getItem('google_session_active') === 'true';

    if (hasToken && isSessionActive) {
        updateSettingsUI(true);
    } else {
        // Force cleanup if session is marked active but token is invalid
        localStorage.removeItem('google_session_active');
        updateSettingsUI(false);
        
        // ADD THIS: If we are on index.html, force the UI into the locked state
        const grid = document.getElementById('calendar-grid');
        if (grid) {
            grid.innerHTML = '<div class="blank-state-card">...Please sign in...</div>';
        }
    }
}

// ==========================================
// IMMEDIATE INSTANT SIDEBAR CONTROLLER 
// ==========================================
function setupSidebarBehavior() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const contentToggleBtn = document.getElementById('contentMenuToggle');

    if (!sidebar) return;

    // 1. Temporarily freeze CSS width transitions to prevent visual layout snap frames
    sidebar.classList.add('no-transition');

    // 2. Read saved local memory layout state immediately before parsing slower API assets
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    } else {
        sidebar.classList.remove('collapsed');
    }

    // 3. Force a quick browser layout calculation to lock state, then restore animations smoothly
    requestAnimationFrame(() => {
        sidebar.classList.remove('no-transition');
    });

    function toggleSidebar() {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    }

    if (toggleBtn) toggleBtn.onclick = toggleSidebar;
    if (contentToggleBtn) contentToggleBtn.onclick = toggleSidebar;
}

// Run immediately upon script load rather than waiting for structural window loops
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", setupSidebarBehavior);
} else {
    setupSidebarBehavior();
}

/* ==========================================
   9. MEAL PLANNER ENGINE (PAGE SPECIFIC)
   ========================================== */
function initMealPlannerEngine() {
    const mealContainer = document.querySelector('.meal-rows-container');
    if (!mealContainer) return; // Exit cleanly if loaded on non-meal sub-pages

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // 1. Ingest existing states and assign auto-saving event tracks
    days.forEach(day => {
        const inputField = document.getElementById(`meal-${day}`);
        if (!inputField) return;
        
        const savedMeal = localStorage.getItem(`familyMeal_${day}`);
        if (savedMeal) {
            inputField.value = savedMeal;
        }

        inputField.addEventListener('input', (e) => {
            localStorage.setItem(`familyMeal_${day}`, e.target.value);
        });
    });

    // 2. Clear All Engine mapping using explicit DOM binding
    const clearBtn = document.getElementById('clearAllMealsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear the entire week's meal plan? This cannot be undone.")) {
                days.forEach(day => {
                    const inputField = document.getElementById(`meal-${day}`);
                    if (inputField) {
                        inputField.value = '';
                        localStorage.removeItem(`familyMeal_${day}`);
                    }
                });
            }
        });
    }
}

/* ==========================================
   10. SHOPPING LIST ENGINE (GOOGLE TASKS SYNCED)
   ========================================== */
function initShoppingListEngine() {
    const shoppingContainer = document.getElementById('shopping-list-container') || document.querySelector('.shopping-content-area');
    if (!shoppingContainer) return; 

    console.log("Shopping List Engine Activated");

    const itemInput = document.getElementById('shopping-item-input');
    const addBtn = document.getElementById('add-item-btn');
    const listContainer = document.getElementById('shopping-list');
    const clearCompletedBtn = document.getElementById('clear-completed-btn');

    let shoppingList = JSON.parse(localStorage.getItem('family_shopping_list')) || [];
    let googleTasksEnabled = false;
    let shoppingListId = null;
    let pollInterval = null;

    // Render current items directly on setup
    saveAndRenderList();

    // 1. Local Rendering Pipeline
    function saveAndRenderList() {
        localStorage.setItem('family_shopping_list', JSON.stringify(shoppingList));
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        
        if (shoppingList.length === 0) {
            listContainer.innerHTML = '<li class="empty-state" style="color: #777; padding: 15px; text-align: center;">Your shopping list is clear!</li>';
            return;
        }

        shoppingList.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = `shopping-item ${item.completed ? 'completed' : ''}`;
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.justifyContent = 'space-between';
            li.style.padding = '10px';
            li.style.borderBottom = '1px solid #eee';

            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" class="item-toggle-zone">
                    <input 
                        type="checkbox" 
                        ${item.completed ? 'checked' : ''} 
                        style="cursor: pointer; width: 18px; height: 18px;"
                    >
                    <span style="text-decoration: ${item.completed ? 'line-through' : 'none'}; color: ${item.completed ? '#aaa' : '#333'}">
                        ${item.text}
                    </span>
                </div>
                <button class="delete-item-btn" style="background: none; border: none; color: #db4437; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            `;

            // Toggle completion handler
            li.querySelector('.item-toggle-zone').onclick = async () => {
                shoppingList[index].completed = !shoppingList[index].completed;
                saveAndRenderList();
                if (googleTasksEnabled && item.id) {
                    try {
                        await gapi.client.tasks.tasks.update({
                            tasklist: shoppingListId,
                            task: item.id,
                            resource: {
                                id: item.id,
                                title: item.text,
                                status: shoppingList[index].completed ? 'completed' : 'needsAction'
                            }
                        });
                    } catch (err) {
                        console.error("Failed to update remote task:", err);
                    }
                }
            };

            // Delete item handler
            li.querySelector('.delete-item-btn').onclick = async () => {
                const removedItem = shoppingList.splice(index, 1)[0];
                saveAndRenderList();
                if (googleTasksEnabled && removedItem.id) {
                    try {
                        await gapi.client.tasks.tasks.delete({
                            tasklist: shoppingListId,
                            task: removedItem.id
                        });
                    } catch (err) {
                        console.error("Failed to delete remote task:", err);
                    }
                }
            };

            listContainer.appendChild(li);
        });
    }

    // 2. Core Mutations
    async function addNewItem() {
        if (!itemInput) return;
        const text = itemInput.value.trim();
        if (!text) return;

        const newItem = { text: text, completed: false, id: null };
        shoppingList.push(newItem);
        itemInput.value = '';
        saveAndRenderList();

        if (googleTasksEnabled) {
            try {
                const res = await gapi.client.tasks.tasks.insert({
                    tasklist: shoppingListId,
                    resource: {
                        title: text,
                        status: 'needsAction'
                    }
                });
                newItem.id = res.result.id;
                saveAndRenderList();
            } catch (err) {
                console.error("Failed to insert remote task:", err);
            }
        }
    }

    // 3. Google Tasks Synchronization Logic
    window.syncGoogleTasks = async function() {
        const token = getValidAccessToken();
        if (!token || !gapi.client.tasks) {
            console.log("Sync skipped: No active connection details found in Settings.");
            return;
        }

        try {
            googleTasksEnabled = true;

            // Step A: Find or Create 'Shopping List' TaskList container
            const listsRes = await gapi.client.tasks.tasklists.list();
            const lists = listsRes.result.items || [];
            let targetList = lists.find(l => l.title === "Shopping List");

            if (!targetList) {
                console.log("Creating default 'Shopping List' on Google Tasks...");
                const newListRes = await gapi.client.tasks.tasklists.insert({
                    resource: { title: "Shopping List" }
                });
                targetList = newListRes.result;
            }
            shoppingListId = targetList.id;

            // Step B: Pull remote tasks and merge
            await fetchAndMergeRemoteTasks();

            // Step C: Set up background engine loop (Poll every 10 seconds)
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = setInterval(fetchAndMergeRemoteTasks, 10000);

        } catch (err) {
            console.error("Google Tasks Sync Handshake failed:", err);
            googleTasksEnabled = false;
        }
    };

    async function fetchAndMergeRemoteTasks() {
        if (!shoppingListId) return;
        try {
            const tasksRes = await gapi.client.tasks.tasks.list({
                tasklist: shoppingListId,
                showCompleted: true,
                showHidden: true
            });
            const remoteTasks = tasksRes.result.items || [];

            // Simple reconcile strategy: Remote acts as absolute master
            shoppingList = remoteTasks.map(task => ({
                id: task.id,
                text: task.title,
                completed: task.status === 'completed'
            }));

            saveAndRenderList();
        } catch (err) {
            console.warn("Unable to pull updates from Google Tasks cloud:", err);
        }
    }

    // Bind event handlers dynamically to strip inline HTML triggers
    if (addBtn) {
        addBtn.addEventListener('click', addNewItem);
    }

    if (itemInput) {
        itemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addNewItem();
        });
    }

    if (clearCompletedBtn) {
        clearCompletedBtn.addEventListener('click', async () => {
            const completedItems = shoppingList.filter(item => item.completed);
            shoppingList = shoppingList.filter(item => !item.completed);
            saveAndRenderList();

            if (googleTasksEnabled) {
                for (let item of completedItems) {
                    if (item.id) {
                        try {
                            await gapi.client.tasks.tasks.delete({
                                tasklist: shoppingListId,
                                task: item.id
                            });
                        } catch (err) {
                            console.error("Failed to clear remote task:", err);
                        }
                    }
                }
            }
        });
    }

    // Trigger instant API handoff if GAPI is loaded early
    if (typeof gapi !== 'undefined' && gapi.client && gapi.client.tasks) {
        window.syncGoogleTasks();
    }
}

// Tasks

async function initTasksEngine() {
    const tasksContainer = document.getElementById('tasks-container');
    if (!tasksContainer) return;

    const selectedLists = JSON.parse(localStorage.getItem('selected_task_lists') || '[]');
    
    // Fetch tasks for each selected list
    for (const listId of selectedLists) {
        const tasksRes = await gapi.client.tasks.tasks.list({ tasklist: listId });
        renderTasks(tasksRes.result.items, listId);
    }
}

// Example CRUD helper for adding a task
async function addTask(listId, title) {
    await gapi.client.tasks.tasks.insert({
        tasklist: listId,
        resource: { title: title, status: 'needsAction' }
    });
    initTasksEngine(); // Refresh view
}

async function loadTaskListsForSettings() {
    const container = document.getElementById('task-lists-container');
    if (!container) return;

    try {
        const response = await gapi.client.tasks.tasklists.list();
        const lists = response.result.items || [];
        const savedSelection = JSON.parse(localStorage.getItem('selected_task_lists') || '[]');

        container.innerHTML = lists.map(list => `
            <div>
                <input type="checkbox" id="list-${list.id}" value="${list.id}" 
                    ${savedSelection.includes(list.id) ? 'checked' : ''}
                    onchange="toggleTaskList('${list.id}')">
                <label for="list-${list.id}">${list.title}</label>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error loading task lists:", err);
    }
}

function toggleTaskList(listId) {
    let selection = JSON.parse(localStorage.getItem('selected_task_lists') || '[]');
    if (selection.includes(listId)) {
        selection = selection.filter(id => id !== listId);
    } else {
        selection.push(listId);
    }
    localStorage.setItem('selected_task_lists', JSON.stringify(selection));
}


/* ==========================================
   11. LIFECYCLE HANDOFF ENGINE
   ========================================== */
// Unifies the execution chain to prevent multiple `window.onload` overwrites
function masterOnloadPipeline() {
    runtimeInitEngine();
    initMealPlannerEngine();
    initShoppingListEngine();
    
    // Add conditional check for Tasks page
    if (document.getElementById('tasks-container')) {
        initTasksEngine();
    }
}

window.onload = masterOnloadPipeline;


