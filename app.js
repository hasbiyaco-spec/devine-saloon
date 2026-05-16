// ================= FIREBASE CONFIG =================
// अपने Firebase Project की config यहाँ डालें (Firebase Console से)
const firebaseConfig = {
  apiKey: "AIzaSyDJQAFJQ1bYDTJ-9u40DACYf2twC1WcRpk",
  authDomain: "devine-saloon.firebaseapp.com",
  projectId: "devine-saloon",
  storageBucket: "devine-saloon.firebasestorage.app",
  messagingSenderId: "688719858618",
  appId: "1:688719858618:web:31d588e045e078d5ffeb83",
  measurementId: "G-T2LTK645YN"
};

// ================= IMPORTS (CDN से) =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= GLOBAL STATE =================
let currentUser = null;          // Firebase Auth user
let userRole = null;            // "customer" or "barber"
let currentListeners = [];      // Real-time listener cleanup functions

// ================= HELPER: Clear old listeners =================
function clearListeners() {
  currentListeners.forEach(unsub => unsub());
  currentListeners = [];
}

// ================= ROUTING (Hash-based) =================
window.addEventListener("hashchange", () => {
  if (currentUser) {
    // Already logged in – redirect based on role
    if (userRole === "barber") renderBarberDashboard();
    else if (userRole === "customer") renderCustomerDashboard();
    else renderHome();
  } else {
    handleRoute();
  }
});

function handleRoute() {
  const hash = location.hash.slice(1) || "home";
  const appDiv = document.getElementById("app");
  appDiv.innerHTML = "";
  clearListeners();

  switch (hash) {
    case "login":
      renderLogin();
      break;
    case "signup":
      renderSignup();
      break;
    case "home":
    default:
      renderHome();
      break;
  }
}

// ================= AUTH STATE LISTENER =================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    // Fetch user role from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      userRole = userDoc.data().role;
      // Show logout, hide login/signup in nav
      document.getElementById("navLogin").style.display = "none";
      document.getElementById("navSignup").style.display = "none";
      document.getElementById("navLogout").style.display = "block";

      if (userRole === "barber") {
        renderBarberDashboard();
      } else {
        renderCustomerDashboard();
      }
    } else {
      // Should not happen normally (signup creates doc)
      console.error("User document missing");
      await signOut(auth);
    }
  } else {
    currentUser = null;
    userRole = null;
    document.getElementById("navLogin").style.display = "block";
    document.getElementById("navSignup").style.display = "block";
    document.getElementById("navLogout").style.display = "none";
    handleRoute(); // show home/login
  }
});

// ================= LOGOUT =================
document.getElementById("logoutBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  location.hash = "home";
});

// ================= RENDER FUNCTIONS =================

function renderHome() {
  const html = `
    <div class="text-center mt-5">
      <h1>Welcome to Devine Saloon 💈</h1>
      <p class="lead">Book your appointment with Ayaan or Arman.</p>
      <a href="#signup" class="btn btn-primary btn-lg">Sign Up</a>
      <a href="#login" class="btn btn-outline-secondary btn-lg ms-2">Login</a>
    </div>
  `;
  document.getElementById("app").innerHTML = html;
}

function renderLogin() {
  const html = `
    <div class="row justify-content-center">
      <div class="col-md-5">
        <h2 class="mb-3">Login</h2>
        <form id="loginForm">
          <div class="mb-3">
            <input type="email" class="form-control" id="loginEmail" placeholder="Email" required>
          </div>
          <div class="mb-3">
            <input type="password" class="form-control" id="loginPassword" placeholder="Password" required>
          </div>
          <button type="submit" class="btn btn-dark w-100">Login</button>
        </form>
        <p class="mt-3">Don't have an account? <a href="#signup">Sign Up</a></p>
        <div id="loginError" class="text-danger mt-2"></div>
      </div>
    </div>
  `;
  document.getElementById("app").innerHTML = html;

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle redirect
    } catch (error) {
      document.getElementById("loginError").textContent = error.message;
    }
  });
}

function renderSignup() {
  const html = `
    <div class="row justify-content-center">
      <div class="col-md-5">
        <h2 class="mb-3">Create Account</h2>
        <form id="signupForm">
          <div class="mb-3">
            <input type="text" class="form-control" id="signupName" placeholder="Full Name" required>
          </div>
          <div class="mb-3">
            <input type="email" class="form-control" id="signupEmail" placeholder="Email" required>
          </div>
          <div class="mb-3">
            <input type="password" class="form-control" id="signupPassword" placeholder="Password (min 6 chars)" required minlength="6">
          </div>
          <button type="submit" class="btn btn-dark w-100">Sign Up</button>
        </form>
        <p class="mt-3">Already have an account? <a href="#login">Login</a></p>
        <div id="signupError" class="text-danger mt-2"></div>
      </div>
    </div>
  `;
  document.getElementById("app").innerHTML = html;

  document.getElementById("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      // Save user role & name in Firestore
      await setDoc(doc(db, "users", userCred.user.uid), {
        name: name,
        email: email,
        role: "customer"
      });
      // onAuthStateChanged will redirect to customer dashboard
    } catch (error) {
      document.getElementById("signupError").textContent = error.message;
    }
  });
}

// ================= CUSTOMER DASHBOARD =================
async function renderCustomerDashboard() {
  clearListeners();
  const html = `
    <div class="row">
      <div class="col-md-5">
        <h3>Book Appointment</h3>
        <div class="mb-3">
          <label>Select Barber</label>
          <select id="barberSelect" class="form-select">
            <option value="">-- Choose --</option>
          </select>
        </div>
        <div class="mb-3">
          <label>Date</label>
          <input type="date" id="bookingDate" class="form-control" min="${new Date().toISOString().split('T')[0]}">
        </div>
        <div id="timeSlotsContainer" class="mb-3"></div>
        <button id="bookBtn" class="btn btn-primary" disabled>Book Appointment</button>
        <div id="bookingMsg" class="mt-2"></div>
      </div>
      <div class="col-md-7">
        <h3>My Appointments</h3>
        <div id="appointmentsList"></div>
      </div>
    </div>
  `;
  document.getElementById("app").innerHTML = html;

  // Load barbers from Firestore (role = barber)
  const barberSelect = document.getElementById("barberSelect");
  const barbersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "barber")));
  barbersSnap.forEach(doc => {
    const data = doc.data();
    const option = document.createElement("option");
    option.value = doc.id;       // barber uid
    option.textContent = data.name;
    barberSelect.appendChild(option);
  });

  // Generate time slots 9:00 AM - 5:30 PM, 30 min interval
  function generateTimeSlots() {
    const slots = [];
    for (let h = 9; h < 18; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hour = h.toString().padStart(2, '0');
        const min = m.toString().padStart(2, '0');
        slots.push(`${hour}:${min}`);
      }
    }
    return slots;
  }
  const allSlots = generateTimeSlots();

  let selectedBarberId = null;
  let selectedDate = null;

  barberSelect.addEventListener("change", () => {
    selectedBarberId = barberSelect.value;
    updateTimeSlots();
  });
  document.getElementById("bookingDate").addEventListener("change", (e) => {
    selectedDate = e.target.value;
    updateTimeSlots();
  });

  async function getBookedSlots(barberId, date) {
    if (!barberId || !date) return [];
    const q = query(
      collection(db, "appointments"),
      where("barberId", "==", barberId),
      where("date", "==", date),
      where("status", "in", ["pending", "accepted"])
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data().timeSlot);
  }

  async function updateTimeSlots() {
    const container = document.getElementById("timeSlotsContainer");
    const bookBtn = document.getElementById("bookBtn");
    container.innerHTML = "";
    bookBtn.disabled = true;
    if (!selectedBarberId || !selectedDate) return;

    const booked = await getBookedSlots(selectedBarberId, selectedDate);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const isToday = (selectedDate === todayStr);

    allSlots.forEach(slot => {
      const btn = document.createElement("button");
      btn.className = "btn btn-outline-dark slot-btn";
      btn.textContent = slot;
      // Disable if already booked
      if (booked.includes(slot)) {
        btn.classList.add("disabled");
        btn.disabled = true;
      } else if (isToday) {
        // Disable past times
        const [h, m] = slot.split(":").map(Number);
        const slotTime = new Date();
        slotTime.setHours(h, m, 0, 0);
        if (slotTime <= now) {
          btn.classList.add("disabled");
          btn.disabled = true;
        }
      }
      if (!btn.disabled) {
        btn.addEventListener("click", () => {
          // Remove active from others
          document.querySelectorAll(".slot-btn.active").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          bookBtn.disabled = false;
          bookBtn.dataset.slot = slot;
        });
      }
      container.appendChild(btn);
    });
  }

  document.getElementById("bookBtn").addEventListener("click", async () => {
    const slot = document.getElementById("bookBtn").dataset.slot;
    if (!slot) return;
    // Get barber name
    const barberDoc = await getDoc(doc(db, "users", selectedBarberId));
    const barberName = barberDoc.data().name;
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const customerName = userDoc.data().name;

    try {
      await addDoc(collection(db, "appointments"), {
        customerId: currentUser.uid,
        customerEmail: currentUser.email,
        customerName: customerName,
        barberId: selectedBarberId,
        barberName: barberName,
        date: selectedDate,
        timeSlot: slot,
        status: "pending",
        createdAt: serverTimestamp()
      });
      document.getElementById("bookingMsg").innerHTML = `<span class="text-success">Appointment booked!</span>`;
      // Reset selection
      document.querySelectorAll(".slot-btn.active").forEach(b => b.classList.remove("active"));
      document.getElementById("bookBtn").disabled = true;
      updateTimeSlots(); // refresh slots
    } catch (err) {
      document.getElementById("bookingMsg").innerHTML = `<span class="text-danger">Error: ${err.message}</span>`;
    }
  });

  // Real‑time booking history for current customer
  const q = query(
    collection(db, "appointments"),
    where("customerId", "==", currentUser.uid),
    orderBy("createdAt", "desc")
  );
  const unsub = onSnapshot(q, (snapshot) => {
    const listDiv = document.getElementById("appointmentsList");
    listDiv.innerHTML = "";
    if (snapshot.empty) {
      listDiv.innerHTML = "<p>No appointments yet.</p>";
      return;
    }
    snapshot.forEach(doc => {
      const appt = doc.data();
      const statusClass = `status-${appt.status}`;
      const card = document.createElement("div");
      card.className = "card appointment-card p-3";
      card.innerHTML = `
        <strong>${appt.barberName}</strong> – ${appt.date} ${appt.timeSlot} 
        <span class="${statusClass} fw-bold">${appt.status.toUpperCase()}</span>
      `;
      listDiv.appendChild(card);
    });
  });
  currentListeners.push(unsub);
}

// ================= BARBER DASHBOARD =================
async function renderBarberDashboard() {
  clearListeners();
  // Fetch current barber's name
  const userDoc = await getDoc(doc(db, "users", currentUser.uid));
  const barberName = userDoc.data().name;

  const html = `
    <h2>Welcome, ${barberName}</h2>
    <div class="mb-3">
      <label>Select Date</label>
      <input type="date" id="barberDate" class="form-control" min="${new Date().toISOString().split('T')[0]}" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <div id="barberAppointmentsList"></div>
  `;
  document.getElementById("app").innerHTML = html;

  const dateInput = document.getElementById("barberDate");
  // Real-time listener for selected date
  function listenAppointments(dateStr) {
    // Clear previous listener
    if (currentListeners.length > 0) {
      clearListeners();
    }
    const q = query(
      collection(db, "appointments"),
      where("barberId", "==", currentUser.uid),
      where("date", "==", dateStr)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const listDiv = document.getElementById("barberAppointmentsList");
      listDiv.innerHTML = "";
      if (snapshot.empty) {
        listDiv.innerHTML = "<p>No appointments for this date.</p>";
        return;
      }
      snapshot.forEach(docSnap => {
        const appt = docSnap.data();
        const apptId = docSnap.id;
        const statusClass = `status-${appt.status}`;
        const div = document.createElement("div");
        div.className = "card appointment-card p-3 d-flex justify-content-between align-items-center";
        div.innerHTML = `
          <div>
            <strong>${appt.customerName}</strong> (${appt.customerEmail})<br>
            Time: ${appt.timeSlot} – 
            <span class="${statusClass} fw-bold">${appt.status.toUpperCase()}</span>
          </div>
          <div id="actions-${apptId}">
            ${appt.status === "pending" ? `
              <button class="btn btn-success btn-sm accept-btn" data-id="${apptId}">Accept</button>
              <button class="btn btn-danger btn-sm reject-btn" data-id="${apptId}">Reject</button>
            ` : ''}
          </div>
        `;
        listDiv.appendChild(div);
      });

      // Add event listeners to Accept/Reject buttons
      document.querySelectorAll(".accept-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.dataset.id;
          await updateDoc(doc(db, "appointments", id), { status: "accepted" });
        });
      });
      document.querySelectorAll(".reject-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.dataset.id;
          await updateDoc(doc(db, "appointments", id), { status: "rejected" });
        });
      });
    });
    currentListeners.push(unsub);
  }

  dateInput.addEventListener("change", (e) => listenAppointments(e.target.value));
  // Initial load
  listenAppointments(dateInput.value);
}

// ================= INITIAL ROUTE =================
if (!currentUser) handleRoute();