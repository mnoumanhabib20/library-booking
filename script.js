"use strict";

const ROWS = 5;
const COLS = 6;
const STORAGE_KEY = "smartLabSeats.v1";
const ADMIN_USERNAME = "mnoumanhabib";
const ADMIN_PASSWORD = "Nouman";

let seats = createEmptyMatrix();
let selected = null;
let isAdmin = false;
const adminSelection = new Set();

const grid = document.getElementById("seatGrid");
const seatInput = document.getElementById("seatLabel");
const idInput = document.getElementById("studentId");
const studentNameInput = document.getElementById("studentName");
const message = document.getElementById("message");
const adminModal = document.getElementById("adminModal");
const loginMessage = document.getElementById("loginMessage");

function createEmptyMatrix() {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
}

function seatName(row, column) {
  return String.fromCharCode(65 + row) + (column + 1);
}

function isValidStudentId(id) {
  return /^F\d{8}$/i.test(id);
}

function isValidStudentName(name) {
  return typeof name === "string" &&
    name.trim().length > 0 &&
    name.length <= 80 &&
    !/[\u0000-\u001f\u007f]/.test(name);
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = type ? "message " + type : "message";
}

function showLoginMessage(text, type) {
  loginMessage.textContent = text;
  loginMessage.className = type ? "message " + type : "message";
}

function isValidEntry(entry) {
  if (entry === null) return true;
  return entry !== null &&
    typeof entry === "object" &&
    isValidStudentId(String(entry.studentId)) &&
    isValidStudentName(entry.studentName) &&
    entry.studentName.trim() === entry.studentName &&
    Number.isSafeInteger(entry.timestamp) &&
    entry.timestamp > 0;
}

function validateMatrix(candidate) {
  return Array.isArray(candidate) &&
    candidate.length === ROWS &&
    candidate.every(row => Array.isArray(row) && row.length === COLS && row.every(isValidEntry)) &&
    new Set(candidate.flatMap(row => row.filter(Boolean).map(entry => entry.studentId.toUpperCase()))).size ===
      candidate.flatMap(row => row.filter(Boolean)).length;
}

function readStoredState(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || (parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.seats)) {
    throw new Error("Saved seat data has an unsupported or invalid format.");
  }
  const migrated = parsed.seats.map(row => row.map(entry => {
    if (!entry || parsed.version === 2 || entry.studentName) return entry;
    return { ...entry, studentName: "Name not recorded" };
  }));
  if (!validateMatrix(migrated)) {
    throw new Error("Saved seat data has an unsupported or invalid format.");
  }
  return migrated;
}

function loadStoredSeats() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) return;
  seats = readStoredState(saved);
}

function commitSeats(nextSeats, successMessage) {
  if (!validateMatrix(nextSeats)) {
    showMessage("Seat data could not be saved because it is invalid.", "error");
    return false;
  }

  try {
    const currentValue = localStorage.getItem(STORAGE_KEY);
    const latestSeats = currentValue === null ? createEmptyMatrix() : readStoredState(currentValue);
    if (JSON.stringify(latestSeats) !== JSON.stringify(seats)) {
      seats = latestSeats;
      render();
      showMessage("Reservations changed in another tab. Review the latest seat map and try again.", "error");
      return false;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, seats: nextSeats }));
  } catch (error) {
    showMessage("Could not save reservations to this browser. Check storage availability and try again.", "error");
    console.error("Unable to persist lab reservations:", error);
    return false;
  }

  seats = nextSeats;
  render();
  if (successMessage) showMessage(successMessage, "ok");
  return true;
}

function render() {
  grid.replaceChildren();
  let reservedCount = 0;

  const corner = document.createElement("span");
  corner.className = "column-name";
  corner.setAttribute("aria-hidden", "true");
  grid.appendChild(corner);
  for (let column = 0; column < COLS; column++) {
    const heading = document.createElement("span");
    heading.className = "column-name";
    heading.textContent = String(column + 1);
    grid.appendChild(heading);
  }

  for (let row = 0; row < ROWS; row++) {
    const rowHeading = document.createElement("span");
    rowHeading.className = "row-name";
    rowHeading.textContent = String.fromCharCode(65 + row);
    grid.appendChild(rowHeading);

    for (let column = 0; column < COLS; column++) {
      const entry = seats[row][column];
      const seat = document.createElement("button");
      const name = seatName(row, column);
      seat.type = "button";
      seat.className = "seat";
      seat.setAttribute("aria-label", entry
        ? `Seat ${name}, reserved${isAdmin ? ` by ${entry.studentName}, student ${entry.studentId}` : ""}${isAdmin ? ` at ${new Date(entry.timestamp).toLocaleString()}` : ""}`
        : `Seat ${name}, available`);
      seat.setAttribute("aria-pressed", String(Boolean(selected && selected.row === row && selected.column === column)));

      const number = document.createElement("span");
      number.className = "seat-number";
      number.textContent = name;
      seat.appendChild(number);

      if (entry) {
        reservedCount++;
        seat.classList.add("taken");
        const student = document.createElement("span");
        student.className = "seat-student";
        student.textContent = `ID ${entry.studentId}`;
        seat.appendChild(student);
      }
      if (isAdmin ? adminSelection.has(name) : selected && selected.row === row && selected.column === column) {
        seat.classList.add("picked");
      }
      seat.addEventListener("click", () => selectSeat(row, column));
      grid.appendChild(seat);
    }
  }

  document.getElementById("takenCount").textContent = String(reservedCount);
  document.getElementById("freeCount").textContent = String(ROWS * COLS - reservedCount);
  document.getElementById("clearSelectedBtn").textContent =
    `Cancel selected reservations${adminSelection.size ? ` (${adminSelection.size})` : ""}`;
}

function selectSeat(row, column) {
  const name = seatName(row, column);
  const entry = seats[row][column];
  if (isAdmin && entry) {
    if (adminSelection.has(name)) {
      adminSelection.delete(name);
      showMessage(`Seat ${name} removed from the cancellation selection.`, "");
    } else {
      adminSelection.add(name);
      showMessage(`Seat ${name} is assigned to ${entry.studentName} (ID ${entry.studentId}), reserved ${new Date(entry.timestamp).toLocaleString()}. ${adminSelection.size} seat(s) selected.`, "error");
    }
    selected = { row, column };
    seatInput.value = name;
    render();
    return;
  }

  selected = { row, column };
  seatInput.value = seatName(row, column);
  if (entry) {
    showMessage(`Seat ${seatName(row, column)} is already reserved. Select an available seat instead.`, "error");
  } else {
    showMessage(`Seat ${seatName(row, column)} is available.`, "ok");
  }
  render();
}

function reserveSeat(event) {
  event.preventDefault();
  const id = idInput.value.trim();
  const studentName = studentNameInput.value.trim();

  if (!selected) return showMessage("Choose an available seat on the map first.", "error");
  if (!isValidStudentId(id)) return showMessage("Enter your F-number: F followed by exactly 8 digits (example: F26607109).", "error");
  if (!isValidStudentName(studentName)) return showMessage("Enter the student's name (up to 80 characters).", "error");
  if (seats[selected.row][selected.column]) return showMessage("That seat is already reserved. Choose another seat.", "error");
  const normalizedId = id.toUpperCase();
  if (seats.some(row => row.some(entry => entry && entry.studentId.toUpperCase() === normalizedId))) {
    return showMessage("This student ID already has a reservation.", "error");
  }

  const nextSeats = seats.map(row => row.slice());
  nextSeats[selected.row][selected.column] = {
    studentId: normalizedId,
    studentName,
    timestamp: Date.now()
  };
  if (commitSeats(nextSeats, `Seat ${seatName(selected.row, selected.column)} reserved successfully.`)) {
    idInput.value = "";
    studentNameInput.value = "";
  }
}

function clearSelectedSeat() {
  if (!isAdmin) return showMessage("Sign in as an administrator to cancel a reservation.", "error");
  const targets = new Set(adminSelection);
  if (targets.size === 0) return showMessage("Select one or more reserved seats on the map first.", "error");
  const nextSeats = seats.map(row => row.slice());
  targets.forEach(name => {
    const row = name.charCodeAt(0) - 65;
    const column = Number(name.slice(1)) - 1;
    nextSeats[row][column] = null;
  });
  if (commitSeats(nextSeats, `${targets.size} selected reservation(s) cancelled.`)) {
    adminSelection.clear();
    selected = null;
    seatInput.value = "";
    render();
  }
}

function clearRow() {
  if (!isAdmin) return;
  const row = Number(document.getElementById("rowSelect").value);
  if (!Number.isInteger(row) || row < 0 || row >= ROWS) {
    showMessage("Choose a valid row to reset.", "error");
    return;
  }
  const rowName = String.fromCharCode(65 + row);
  if (!confirm(`Cancel all reservations in row ${rowName}?`)) return;
  const nextSeats = seats.map(currentRow => currentRow.slice());
  nextSeats[row] = Array.from({ length: COLS }, () => null);
  const rowWasSelected = selected && selected.row === row;
  if (commitSeats(nextSeats, `All reservations in row ${rowName} have been cleared.`)) {
    Array.from(adminSelection).filter(name => name.charCodeAt(0) - 65 === row).forEach(name => adminSelection.delete(name));
    if (rowWasSelected) {
      selected = null;
      seatInput.value = "";
    }
    render();
  }
}

function resetAll() {
  if (!isAdmin) return;
  if (!confirm("Clear every reservation and reset the lab? This cannot be undone.")) return;
  if (commitSeats(createEmptyMatrix(), "All seats are free again.")) {
    adminSelection.clear();
    selected = null;
    seatInput.value = "";
    render();
  }
}

function encodeSeatFile(matrix) {
  const occupancy = matrix.map(row => row.map(entry => entry ? 1 : 0).join(" ")).join("\n");
  const ids = matrix.map(row => row.map(entry => entry ? entry.studentId.toUpperCase() : 0).join(" ")).join("\n");
  const names = matrix.map(row => row.map(entry => entry ? encodeStudentName(entry.studentName) : 0).join(" ")).join("\n");
  const timestamps = matrix.map(row => row.map(entry => entry ? entry.timestamp : 0).join(" ")).join("\n");
  return `SMART_LAB_SEATS_V2\nOCCUPANCY\n${occupancy}\nSTUDENT_IDS\n${ids}\nSTUDENT_NAMES\n${names}\nRESERVED_AT\n${timestamps}\n`;
}

function encodeStudentName(name) {
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, character =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `N${encoded}`;
}

function decodeSeatFile(text) {
  const lines = text.trim().split(/\r?\n/).map(line => line.trim());
  const expectedLineCount = 1 + 1 + ROWS + 1 + ROWS + 1 + ROWS + 1 + ROWS;
  if (lines.length !== expectedLineCount ||
      lines[0] !== "SMART_LAB_SEATS_V2" ||
      lines[1] !== "OCCUPANCY") {
    throw new Error("The file does not match the lab_seats.txt format.");
  }

  const occupancyStart = 2;
  const idMarker = occupancyStart + ROWS;
  const idsStart = idMarker + 1;
  const namesMarker = idsStart + ROWS;
  const namesStart = namesMarker + 1;
  const timestampMarker = namesStart + ROWS;
  const timestampsStart = timestampMarker + 1;
  if (lines[idMarker] !== "STUDENT_IDS" ||
      lines[namesMarker] !== "STUDENT_NAMES" ||
      lines[timestampMarker] !== "RESERVED_AT") {
    throw new Error("The file is missing a required section.");
  }

  function readNumericSection(start) {
    return lines.slice(start, start + ROWS).map(line => {
      const values = line.split(/\s+/);
      if (values.length !== COLS || values.some(value => !/^\d+$/.test(value))) {
        throw new Error("Each file section must contain exactly 6 numeric values per row.");
      }
      return values.map(Number);
    });
  }

  function readNameSection(start) {
    return lines.slice(start, start + ROWS).map(line => {
      const values = line.split(/\s+/);
      if (values.length !== COLS) {
        throw new Error("Each student name row must contain exactly 6 values.");
      }
      return values.map(value => {
        if (value === "0") return null;
        if (!value.startsWith("N")) throw new Error("Student names in the file are not encoded correctly.");
        try {
          return decodeURIComponent(value.slice(1));
        } catch {
          throw new Error("The file contains an invalid encoded student name.");
        }
      });
    });
  }

  function readIdSection(start) {
    return lines.slice(start, start + ROWS).map(line => {
      const values = line.split(/\s+/);
      if (values.length !== COLS || values.some(value => value !== "0" && !isValidStudentId(value))) {
        throw new Error("Each student ID row must contain 6 F-numbers or 0 values.");
      }
      return values;
    });
  }

  const occupied = readNumericSection(occupancyStart);
  const ids = readIdSection(idsStart);
  const names = readNameSection(namesStart);
  const timestamps = readNumericSection(timestampsStart);
  const restored = createEmptyMatrix();

  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLS; column++) {
      const isOccupied = occupied[row][column];
      const id = ids[row][column];
      const studentName = names[row][column];
      const timestamp = timestamps[row][column];
      if ((isOccupied !== 0 && isOccupied !== 1) ||
          (isOccupied === 0 && (id !== "0" || studentName !== null || timestamp !== 0)) ||
          (isOccupied === 1 && (!isValidStudentId(id) || !isValidStudentName(studentName) ||
            studentName.trim() !== studentName || !Number.isSafeInteger(timestamp) || timestamp <= 0))) {
        throw new Error(`Invalid occupancy, student details, or timestamp at seat ${seatName(row, column)}.`);
      }
      if (isOccupied === 1) restored[row][column] = {
        studentId: id.toUpperCase(),
        studentName,
        timestamp
      };
    }
  }

  if (!validateMatrix(restored)) throw new Error("The file contains duplicate student IDs.");
  return restored;
}

function exportFile() {
  if (!isAdmin) return showMessage("Sign in as an administrator to access file operations.", "error");
  const blob = new Blob([encodeSeatFile(seats)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "lab_seats.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showMessage("Current reservations exported to lab_seats.txt.", "ok");
}

function importFile(file) {
  if (!isAdmin) return showMessage("Sign in as an administrator to access file operations.", "error");
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (typeof reader.result !== "string") throw new Error("The selected file could not be read as text.");
      const imported = decodeSeatFile(reader.result);
      if (commitSeats(imported, "lab_seats.txt loaded successfully.")) {
        selected = null;
        seatInput.value = "";
        render();
      }
    } catch (error) {
      showMessage(error.message || "Could not load the selected seat file.", "error");
    }
  };
  reader.onerror = () => showMessage("The selected file could not be read. Please try again.", "error");
  reader.readAsText(file);
}

function openAdminModal() {
  if (isAdmin) {
    document.getElementById("adminPanel").scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("adminHeading").focus({ preventScroll: true });
    return;
  }
  showLoginMessage("", "");
  adminModal.hidden = false;
  document.getElementById("adminUsername").focus();
}

function closeAdminModal() {
  adminModal.hidden = true;
  document.getElementById("adminPortalBtn").focus();
}

function loginAdmin(event) {
  event.preventDefault();
  const username = document.getElementById("adminUsername").value.trim();
  const password = document.getElementById("adminPassword").value;
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    showLoginMessage("Those credentials were not recognized. Please try again.", "error");
    return;
  }
  isAdmin = true;
  adminModal.hidden = true;
  document.getElementById("adminPanel").hidden = false;
  document.getElementById("adminLoginForm").reset();
  document.getElementById("adminPortalBtn").setAttribute("aria-pressed", "true");
  render();
  showMessage("Admin access enabled. Select a reserved seat to inspect the student's name and assignment.", "ok");
  document.getElementById("adminLogoutBtn").focus();
}

function logoutAdmin() {
  isAdmin = false;
  adminSelection.clear();
  document.getElementById("adminPanel").hidden = true;
  document.getElementById("adminPortalBtn").removeAttribute("aria-pressed");
  if (selected) {
    const entry = seats[selected.row][selected.column];
    showMessage(entry ? `Seat ${seatName(selected.row, selected.column)} is reserved.` : `Seat ${seatName(selected.row, selected.column)} is available.`, entry ? "error" : "ok");
  }
  render();
  document.getElementById("adminPortalBtn").focus();
}

function handleStorageChange(event) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try {
    seats = event.newValue === null ? createEmptyMatrix() : readStoredState(event.newValue);
    Array.from(adminSelection).forEach(name => {
      const row = name.charCodeAt(0) - 65;
      const column = Number(name.slice(1)) - 1;
      if (!seats[row][column]) adminSelection.delete(name);
    });
    render();
    showMessage("Seat availability updated from another browser tab.", "ok");
  } catch (error) {
    showMessage("A different tab saved invalid reservation data. This view has not been changed.", "error");
    console.error("Unable to sync lab reservations:", error);
  }
}

document.getElementById("seatForm").addEventListener("submit", reserveSeat);
document.getElementById("adminPortalBtn").addEventListener("click", openAdminModal);
document.getElementById("adminLoginForm").addEventListener("submit", loginAdmin);
document.getElementById("closeModalBtn").addEventListener("click", closeAdminModal);
document.querySelectorAll("[data-close-modal]").forEach(element => element.addEventListener("click", closeAdminModal));
document.getElementById("adminLogoutBtn").addEventListener("click", logoutAdmin);
document.getElementById("clearSelectedBtn").addEventListener("click", clearSelectedSeat);
document.getElementById("clearRowBtn").addEventListener("click", clearRow);
document.getElementById("resetBtn").addEventListener("click", resetAll);
document.getElementById("exportBtn").addEventListener("click", exportFile);
document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", event => {
  const file = event.target.files && event.target.files[0];
  if (file) importFile(file);
  event.target.value = "";
});
idInput.addEventListener("input", () => {
  const value = idInput.value;
  const digits = value.replace(/\D/g, "").slice(0, 8);
  idInput.value = (/[f]/i.test(value) ? "F" : "") + digits;
});
adminModal.addEventListener("keydown", event => {
  if (event.key === "Escape") closeAdminModal();
});
window.addEventListener("storage", handleStorageChange);

try {
  loadStoredSeats();
} catch (error) {
  showMessage("Saved reservation data could not be loaded. Clear the browser's site data or contact an administrator.", "error");
  console.error("Unable to load lab reservations:", error);
}
render();
