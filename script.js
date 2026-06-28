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
    // Modified: Expanded timeline to 52 weeks (52 weeks * 7 days)
    endOfPeriod.setDate(startOfWeek.getDate() + (52 * 7));

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

    // Modified: Loop 364 days (52 weeks * 7 elements per week)
    for (let i = 0; i < (52 * 7); i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        
        const compareDate = new Date(loopDate);
        compareDate.setHours(0, 0, 0, 0);

        if (compareDate < today) {
            dayCell.classList.add('past-day');
        } else if (compareDate.getTime() === today.getTime()) {
            dayCell.classList.add('today-day');
        }

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
