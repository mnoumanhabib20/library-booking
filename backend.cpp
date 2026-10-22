// Smart Lab Seat Reservation - beginner-level C++ console version
// Uses a 2D array, loops, functions, and fstream with lab_seats.txt.
#include <ctime>
#include <cctype>
#include <fstream>
#include <iostream>
#include <limits>
#include <string>
using namespace std;

const int ROWS = 5;
const int COLS = 6;
const string FILE_NAME = "lab_seats.txt";

int lab[ROWS][COLS];
string studentIds[ROWS][COLS];
string studentNames[ROWS][COLS];
long long reservedAt[ROWS][COLS];

void clearSeats() {
    for (int row = 0; row < ROWS; row++) {
        for (int col = 0; col < COLS; col++) {
            lab[row][col] = 0;
            studentIds[row][col] = "0";
            studentNames[row][col] = "0";
            reservedAt[row][col] = 0;
        }
    }
}

bool readMatrix(ifstream &file, int values[ROWS][COLS]) {
    for (int row = 0; row < ROWS; row++) {
        for (int col = 0; col < COLS; col++) {
            if (!(file >> values[row][col])) return false;
        }
    }
    return true;
}

bool readTimestampMatrix(ifstream &file, long long values[ROWS][COLS]) {
    for (int row = 0; row < ROWS; row++) {
        for (int col = 0; col < COLS; col++) {
            if (!(file >> values[row][col])) return false;
        }
    }
    return true;
}

bool readStringMatrix(ifstream &file, string values[ROWS][COLS]) {
    for (int row = 0; row < ROWS; row++) {
        for (int col = 0; col < COLS; col++) {
            if (!(file >> values[row][col])) return false;
        }
    }
    return true;
}

bool isValidId(const string &id) {
    if (id.length() != 9 || (id[0] != 'F' && id[0] != 'f')) return false;
    for (int i = 1; i < 9; i++)
        if (id[i] < '0' || id[i] > '9') return false;
    return true;
}

bool isUnreserved(unsigned char value) {
    return (value >= 'A' && value <= 'Z') ||
        (value >= 'a' && value <= 'z') ||
        (value >= '0' && value <= '9') ||
        value == '-' || value == '_' || value == '.' || value == '~';
}

int hexValue(char value) {
    if (value >= '0' && value <= '9') return value - '0';
    if (value >= 'A' && value <= 'F') return value - 'A' + 10;
    if (value >= 'a' && value <= 'f') return value - 'a' + 10;
    return -1;
}

string encodeName(const string &name) {
    const char HEX[] = "0123456789ABCDEF";
    string encoded = "N";
    for (size_t i = 0; i < name.length(); i++) {
        unsigned char value = static_cast<unsigned char>(name[i]);
        if (isUnreserved(value)) {
            encoded += static_cast<char>(value);
        } else {
            encoded += '%';
            encoded += HEX[value >> 4];
            encoded += HEX[value & 15];
        }
    }
    return encoded;
}

bool decodeName(const string &encoded, string &name) {
    if (encoded.length() < 2 || encoded[0] != 'N') return false;
    name.clear();
    for (size_t i = 1; i < encoded.length(); i++) {
        unsigned char value = static_cast<unsigned char>(encoded[i]);
        if (value == '%') {
            if (i + 2 >= encoded.length()) return false;
            int high = hexValue(encoded[i + 1]);
            int low = hexValue(encoded[i + 2]);
            if (high < 0 || low < 0) return false;
            value = static_cast<unsigned char>(high * 16 + low);
            i += 2;
        } else if (!isUnreserved(value)) {
            return false;
        }
        if (value < 32 || value == 127) return false;
        name += static_cast<char>(value);
    }
    if (name.empty() || name.length() > 320) return false;
    if (isspace(static_cast<unsigned char>(name[0])) ||
        isspace(static_cast<unsigned char>(name[name.length() - 1]))) return false;
    return true;
}

string trimName(const string &value) {
    size_t first = value.find_first_not_of(" \t\r\n");
    if (first == string::npos) return "";
    size_t last = value.find_last_not_of(" \t\r\n");
    return value.substr(first, last - first + 1);
}

int utf8CharacterCount(const string &value) {
    int count = 0;
    for (size_t i = 0; i < value.length(); i++) {
        if ((static_cast<unsigned char>(value[i]) & 0xC0) != 0x80) count++;
    }
    return count;
}

void loadSeats() {
    clearSeats();
    ifstream file(FILE_NAME.c_str());
    if (!file) return;

    string marker;
    int occupancy[ROWS][COLS];
    if (!(file >> marker) || marker != "SMART_LAB_SEATS_V2" ||
        !(file >> marker) || marker != "OCCUPANCY" ||
        !readMatrix(file, occupancy) ||
        !(file >> marker) || marker != "STUDENT_IDS" ||
        !readStringMatrix(file, studentIds) ||
        !(file >> marker) || marker != "STUDENT_NAMES" ||
        !readStringMatrix(file, studentNames) ||
        !(file >> marker) || marker != "RESERVED_AT" ||
        !readTimestampMatrix(file, reservedAt)) {
        clearSeats();
        cout << "Warning: lab_seats.txt is invalid; all seats were opened.\n";
        return;
    }

    for (int row = 0; row < ROWS; row++) {
        for (int col = 0; col < COLS; col++) {
            string decodedName;
            bool validReservation = occupancy[row][col] == 1 &&
                isValidId(studentIds[row][col]) &&
                decodeName(studentNames[row][col], decodedName) &&
                reservedAt[row][col] > 0;
            bool validFreeSeat = occupancy[row][col] == 0 &&
                studentIds[row][col] == "0" && studentNames[row][col] == "0" &&
                reservedAt[row][col] == 0;
            if (!validReservation && !validFreeSeat) {
                clearSeats();
                cout << "Warning: lab_seats.txt contains invalid seat data; all seats were opened.\n";
                return;
            }
            lab[row][col] = occupancy[row][col];
            if (lab[row][col] == 1) studentNames[row][col] = decodedName;
            if (lab[row][col] == 1 && studentIds[row][col][0] == 'f')
                studentIds[row][col][0] = 'F';
            if (lab[row][col] == 1) {
                for (int previousRow = 0; previousRow <= row; previousRow++) {
                    int lastColumn = previousRow == row ? col : COLS;
                    for (int previousCol = 0; previousCol < lastColumn; previousCol++) {
                        if (studentIds[previousRow][previousCol] == studentIds[row][col]) {
                            clearSeats();
                            cout << "Warning: lab_seats.txt contains a duplicate student ID; all seats were opened.\n";
                            return;
                        }
                    }
                }
            }
        }
    }
    file.close();
}

void saveSeats() {
    ofstream file(FILE_NAME.c_str());
    if (!file) {
        cout << "Could not open lab_seats.txt for saving.\n";
        return;
    }

    file << "SMART_LAB_SEATS_V2\nOCCUPANCY\n";
    for (int row = 0; row < ROWS; row++) {
        for (int col = 0; col < COLS; col++)
            file << lab[row][col] << (col == COLS - 1 ? '\n' : ' ');
    }
    file << "STUDENT_IDS\n";
    for (int row = 0; row < ROWS; row++) {
        for (int col = 0; col < COLS; col++)
            file << studentIds[row][col] << (col == COLS - 1 ? '\n' : ' ');
    }
    file << "STUDENT_NAMES\n";
    for (int row = 0; row < ROWS; row++) {
        for (int col = 0; col < COLS; col++)
            file << (lab[row][col] == 0 ? "0" : encodeName(studentNames[row][col]))
                 << (col == COLS - 1 ? '\n' : ' ');
    }
    file << "RESERVED_AT\n";
    for (int row = 0; row < ROWS; row++) {
        for (int col = 0; col < COLS; col++)
            file << reservedAt[row][col] << (col == COLS - 1 ? '\n' : ' ');
    }
    if (!file) cout << "An error occurred while writing lab_seats.txt.\n";
    file.close();
}

void showSeats() {
    cout << "\n         ";
    for (int col = 1; col <= COLS; col++) cout << col << "       ";
    cout << "\n";
    for (int row = 0; row < ROWS; row++) {
        cout << "   " << char('A' + row) << "   ";
        for (int col = 0; col < COLS; col++) {
            if (lab[row][col] == 0) cout << "[ Free  ] ";
            else cout << "[" << studentIds[row][col] << ": "
                      << studentNames[row][col] << "] ";
        }
        cout << "\n";
    }
}

bool idAlreadyUsed(const string &id) {
    for (int row = 0; row < ROWS; row++)
        for (int col = 0; col < COLS; col++)
            if (lab[row][col] == 1 && studentIds[row][col] == id) return true;
    return false;
}

bool readSeat(int &row, int &col) {
    char letter;
    int seatNumber;
    cout << "Seat (example B3): ";
    if (!(cin >> letter >> seatNumber)) return false;
    if (letter >= 'a' && letter <= 'z') letter = char(letter - 'a' + 'A');
    row = letter - 'A';
    col = seatNumber - 1;
    return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

void reserveSeat() {
    int row, col;
    string id, studentName;
    if (!readSeat(row, col)) { cout << "Invalid seat.\n"; return; }
    if (lab[row][col] != 0) { cout << "Seat already reserved.\n"; return; }
    cin.ignore(numeric_limits<streamsize>::max(), '\n');
    cout << "Student ID (F followed by 8 digits): ";
    if (!getline(cin, id) || !isValidId(id)) { cout << "Invalid ID. Example: F26607109.\n"; return; }
    if (id[0] == 'f') id[0] = 'F';
    if (idAlreadyUsed(id)) { cout << "This ID already has a seat.\n"; return; }
    cout << "Student name: ";
    if (!getline(cin, studentName)) { cout << "Could not read student name.\n"; return; }
    studentName = trimName(studentName);
    if (studentName.empty() || utf8CharacterCount(studentName) > 80) {
        cout << "Enter a name between 1 and 80 characters.\n";
        return;
    }
    lab[row][col] = 1;
    studentIds[row][col] = id;
    studentNames[row][col] = studentName;
    reservedAt[row][col] = static_cast<long long>(time(0)) * 1000;
    saveSeats();
    cout << "Seat reserved.\n";
}

void cancelSeat() {
    int row, col;
    if (!readSeat(row, col)) { cout << "Invalid seat.\n"; return; }
    if (lab[row][col] == 0) { cout << "Seat is not reserved.\n"; return; }
    lab[row][col] = 0;
    studentIds[row][col] = "0";
    studentNames[row][col] = "0";
    reservedAt[row][col] = 0;
    saveSeats();
    cout << "Reservation cancelled.\n";
}

void resetRow() {
    char letter;
    cout << "Row to clear (A-E): ";
    cin >> letter;
    if (letter >= 'a' && letter <= 'z') letter = char(letter - 'a' + 'A');
    int row = letter - 'A';
    if (row < 0 || row >= ROWS) { cout << "Invalid row.\n"; return; }
    for (int col = 0; col < COLS; col++) {
        lab[row][col] = 0;
        studentIds[row][col] = "0";
        studentNames[row][col] = "0";
        reservedAt[row][col] = 0;
    }
    saveSeats();
    cout << "Row " << letter << " cleared.\n";
}

int main() {
    loadSeats();
    int choice = 0;
    do {
        showSeats();
        cout << "\n1. Reserve seat\n2. Cancel seat\n3. Clear a row\n"
             << "4. Clear all seats\n5. Exit\nChoice: ";
        if (!(cin >> choice)) {
            cout << "Please enter a number from 1 to 5.\n";
            return 1;
        }
        if (choice == 1) reserveSeat();
        else if (choice == 2) cancelSeat();
        else if (choice == 3) resetRow();
        else if (choice == 4) {
            clearSeats();
            saveSeats();
            cout << "All seats cleared.\n";
        }
        else if (choice != 5) cout << "Choose a number from 1 to 5.\n";
    } while (choice != 5);
    return 0;
}
