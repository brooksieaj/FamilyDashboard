function openEventModal(event = null, defaultDate = null) {
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
        
        // If clicked on a specific grid cell, use its date. Otherwise default to today.
        if (defaultDate) {
            document.getElementById('eventDate').value = defaultDate;
        } else {
            document.getElementById('eventDate').valueAsDate = new Date();
        }
        
        document.getElementById('eventTime').value = '';
        deleteBtn.style.display = "none";
    }
    modal.style.display = "block";
}