import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { ref, onValue, set } from "firebase/database";

const DEPARTMENTS = [
  { id: "engineering", name: "Engineering", color: "#6366f1" },
  { id: "design", name: "Design", color: "#ec4899" },
  { id: "marketing", name: "Marketing", color: "#f59e0b" },
  { id: "sales", name: "Sales", color: "#10b981" },
  { id: "hr", name: "HR", color: "#3b82f6" },
  { id: "finance", name: "Finance", color: "#8b5cf6" },
  { id: "product", name: "Product", color: "#ef4444" },
  { id: "operations", name: "Operations", color: "#14b8a6" },
];

const SAMPLE_MEMBERS = {
  engineering: ["Somchai K.", "Ploy N.", "Nat W.", "Krit P."],
  design: ["Mink S.", "Aom T.", "Pong C."],
  marketing: ["Fah R.", "Beau L.", "Nook A."],
  sales: ["Pat M.", "Tarn B.", "Golf D.", "Bow E."],
  hr: ["Noon V.", "Pim U."],
  finance: ["Arthit J.", "Wan K.", "Lek P."],
  product: ["Khun O.", "Sam I.", "Bee Y."],
  operations: ["Dao Q.", "Nut X.", "Tuk Z."],
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function WFHTracker() {
  const [view, setView] = useState("calendar");
  const [role, setRole] = useState(null);
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0].id);
  const [selectedMember, setSelectedMember] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(getToday());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [form, setForm] = useState({ dates: [], reason: "" });
  const [notification, setNotification] = useState(null);
  const [isOnline, setIsOnline] = useState(true);

  // ── Firebase realtime listener ──
  useEffect(() => {
    const dbRef = ref(db, "wfh_requests");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const val = snapshot.val();
      setRequests(val ? Object.values(val) : []);
      setLoading(false);
      setIsOnline(true);
    }, (error) => {
      console.error(error);
      setIsOnline(false);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showNotif = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const submitRequest = async () => {
    if (!selectedMember || form.dates.length === 0) {
      showNotif("กรุณาเลือกชื่อและวันที่", "error");
      return;
    }
    try {
      const dbRef = ref(db, "wfh_requests");
      const newRequests = [...requests];
      form.dates.forEach((date) => {
        const id = `${Date.now()}-${date}-${Math.random().toString(36).slice(2)}`;
        newRequests.push({
          id,
          dept: selectedDept,
          member: selectedMember,
          date,
          reason: form.reason,
          status: "pending",
          createdAt: Date.now(),
        });
      });
      // Save as object keyed by id
      const obj = {};
      newRequests.forEach((r) => { obj[r.id] = r; });
      await set(dbRef, obj);
      setForm({ dates: [], reason: "" });
      showNotif(`ส่งคำขอ WFH ${form.dates.length} วันเรียบร้อย! 🎉`);
      setView("calendar");
    } catch (e) {
      showNotif("เกิดข้อผิดพลาด กรุณาลองใหม่", "error");
    }
  };

  const handleApproval = async (id, status) => {
    try {
      const dbRef = ref(db, "wfh_requests");
      const updated = requests.map((r) => (r.id === id ? { ...r, status } : r));
      const obj = {};
      updated.forEach((r) => { obj[r.id] = r; });
      await set(dbRef, obj);
      showNotif(status === "approved" ? "✅ อนุมัติแล้ว" : "❌ ปฏิเสธแล้ว", status === "approved" ? "success" : "error");
    } catch (e) {
      showNotif("เกิดข้อผิดพลาด", "error");
    }
  };

  const toggleDate = (dateStr) => {
    setForm((f) => ({
      ...f,
      dates: f.dates.includes(dateStr) ? f.dates.filter((d) => d !== dateStr) : [...f.dates, dateStr],
    }));
  };

  if (!role) return <RoleSelector onSelect={setRole} />;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  return (
    <div style={styles.app}>
      {notification && (
        <div style={{ ...styles.notif, background: notification.type === "error" ? "#ef4444" : "#10b981" }}>
          {notification.msg}
        </div>
      )}

      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>🏠</div>
          <div>
            <div style={styles.appTitle}>WFH Tracker</div>
            <div style={styles.appSub}>{role === "manager" ? "Manager View" : "Employee View"}</div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={{ ...styles.liveChip, background: isOnline ? "#10b98120" : "#ef444420", color: isOnline ? "#10b981" : "#ef4444" }}>
            <span style={{ ...styles.liveDot, background: isOnline ? "#10b981" : "#ef4444" }} />
            {isOnline ? "LIVE" : "OFFLINE"}
          </div>
          <button style={styles.switchBtn} onClick={() => setRole(null)}>เปลี่ยน Role</button>
        </div>
      </div>

      <div style={styles.nav}>
        {[
          { key: "calendar", label: "📅 Calendar" },
          { key: "requests", label: `📋 คำขอ` },
          ...(role === "employee" ? [{ key: "submit", label: "➕ ขอ WFH" }] : []),
        ].map((t) => (
          <button
            key={t.key}
            style={{ ...styles.navBtn, ...(view === t.key ? styles.navBtnActive : {}) }}
            onClick={() => setView(t.key)}
          >
            {t.label}
            {t.key === "requests" && role === "manager" && requests.filter(r => r.status === "pending").length > 0 && (
              <span style={styles.badge}>{requests.filter(r => r.status === "pending").length}</span>
            )}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {loading ? (
          <div style={styles.loadingBox}>
            <div style={styles.spinner} />
            <div>กำลังเชื่อมต่อ Firebase...</div>
          </div>
        ) : view === "calendar" ? (
          <CalendarView
            requests={requests}
            year={year}
            month={month}
            today={today}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
          />
        ) : view === "requests" ? (
          <RequestsView requests={requests} role={role} onApproval={handleApproval} />
        ) : (
          <SubmitView
            selectedDept={selectedDept}
            setSelectedDept={setSelectedDept}
            selectedMember={selectedMember}
            setSelectedMember={setSelectedMember}
            form={form}
            setForm={setForm}
            toggleDate={toggleDate}
            onSubmit={submitRequest}
            year={year}
            month={month}
            today={today}
          />
        )}
      </div>
    </div>
  );
}

// ─── Role Selector ─────────────────────────────────────────────────────────────
function RoleSelector({ onSelect }) {
  return (
    <div style={styles.roleScreen}>
      <div style={styles.roleCard}>
        <div style={styles.roleEmoji}>🏠</div>
        <h1 style={styles.roleTitle}>WFH Tracker</h1>
        <p style={styles.roleSub}>เลือกประเภทการใช้งาน</p>
        <div style={styles.roleButtons}>
          <button style={{ ...styles.roleBtn, background: "#6366f1" }} onClick={() => onSelect("employee")}>
            <span style={styles.roleBtnIcon}>👤</span>
            <div>
              <span style={styles.roleBtnLabel}>พนักงาน</span>
              <span style={styles.roleBtnDesc}>ขอ WFH & ดู calendar</span>
            </div>
          </button>
          <button style={{ ...styles.roleBtn, background: "#10b981" }} onClick={() => onSelect("manager")}>
            <span style={styles.roleBtnIcon}>👔</span>
            <div>
              <span style={styles.roleBtnLabel}>Manager</span>
              <span style={styles.roleBtnDesc}>อนุมัติ / ปฏิเสธคำขอ</span>
            </div>
          </button>
        </div>
        <p style={styles.roleNote}>⚡ ข้อมูล sync กับ Firebase Realtime Database ทุกคนเห็นเหมือนกัน</p>
      </div>
    </div>
  );
}

// ─── Calendar View ─────────────────────────────────────────────────────────────
function CalendarView({ requests, year, month, today, currentDate, setCurrentDate }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = new Date(year, month, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  const approvedReqs = requests.filter((r) => r.status === "approved");
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const totalThisMonth = approvedReqs.filter((r) => r.date.startsWith(monthStr)).length;
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const deptSummary = DEPARTMENTS.map((d) => ({
    ...d,
    count: approvedReqs.filter((r) => r.dept === d.id && r.date.startsWith(monthStr)).length,
  })).filter((d) => d.count > 0);

  function getDateInfo(day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayReqs = approvedReqs.filter((r) => r.date === dateStr);
    return { dateStr, count: dayReqs.length, depts: [...new Set(dayReqs.map((r) => r.dept))], members: dayReqs };
  }

  return (
    <div>
      <div style={styles.statsRow}>
        <div style={styles.statBox}>
          <div style={styles.statNum}>{totalThisMonth}</div>
          <div style={styles.statLabel}>WFH เดือนนี้</div>
        </div>
        <div style={{ ...styles.statBox, borderColor: "#f59e0b" }}>
          <div style={{ ...styles.statNum, color: "#f59e0b" }}>{pendingCount}</div>
          <div style={styles.statLabel}>รอการอนุมัติ</div>
        </div>
        <div style={{ ...styles.statBox, borderColor: "#6366f1" }}>
          <div style={{ ...styles.statNum, color: "#6366f1" }}>{deptSummary.length}</div>
          <div style={styles.statLabel}>แผนกที่ WFH</div>
        </div>
      </div>

      <div style={styles.calendarCard}>
        <div style={styles.calNav}>
          <button style={styles.calNavBtn} onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>‹</button>
          <span style={styles.calMonthLabel}>{monthName}</span>
          <button style={styles.calNavBtn} onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>›</button>
        </div>
        <div style={styles.calGrid}>
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
            <div key={d} style={styles.calDayHeader}>{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const { dateStr, count, depts, members } = getDateInfo(i + 1);
            const isWeekend = new Date(dateStr).getDay() === 0 || new Date(dateStr).getDay() === 6;
            return (
              <DayCell key={i + 1} day={i + 1} isToday={dateStr === today} isWeekend={isWeekend} count={count} depts={depts} members={members} />
            );
          })}
        </div>
      </div>

      {deptSummary.length > 0 && (
        <div style={styles.deptSummary}>
          <div style={styles.sectionTitle}>แผนกที่ WFH เดือนนี้</div>
          <div style={styles.deptBars}>
            {deptSummary.sort((a, b) => b.count - a.count).map((d) => (
              <div key={d.id} style={styles.deptBarRow}>
                <div style={styles.deptBarLabel}>
                  <span style={{ ...styles.deptDot, background: d.color }} />{d.name}
                </div>
                <div style={styles.deptBarTrack}>
                  <div style={{ ...styles.deptBarFill, width: `${Math.min((d.count / Math.max(...deptSummary.map(x => x.count))) * 100, 100)}%`, background: d.color }} />
                </div>
                <div style={styles.deptBarCount}>{d.count} วัน</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DayCell({ day, isToday, isWeekend, count, depts, members }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{ ...styles.dayCell, ...(isToday ? styles.dayCellToday : {}), ...(isWeekend ? styles.dayCellWeekend : {}), position: "relative" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={styles.dayNum}>{day}</span>
      {count > 0 && (
        <div style={styles.dayDots}>
          {depts.slice(0, 3).map((dept) => {
            const d = DEPARTMENTS.find((x) => x.id === dept);
            return <span key={dept} style={{ ...styles.dayDot, background: d?.color || "#ccc" }} />;
          })}
          <span style={styles.dayCount}>{count}</span>
        </div>
      )}
      {hover && members.length > 0 && (
        <div style={styles.dayTooltip}>
          <div style={styles.tooltipTitle}>🏠 WFH ({members.length} คน)</div>
          {members.map((m) => {
            const dept = DEPARTMENTS.find((d) => d.id === m.dept);
            return (
              <div key={m.id} style={styles.tooltipRow}>
                <span style={{ ...styles.tooltipDot, background: dept?.color }} />
                {m.member} <span style={styles.tooltipDept}>({dept?.name})</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Requests View ─────────────────────────────────────────────────────────────
function RequestsView({ requests, role, onApproval }) {
  const [filterDept, setFilterDept] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = requests
    .filter((r) => filterDept === "all" || r.dept === filterDept)
    .filter((r) => filterStatus === "all" || r.status === filterStatus)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <div style={styles.filterRow}>
        <select style={styles.select} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="all">ทุกแผนก</option>
          {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select style={styles.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">ทุกสถานะ</option>
          <option value="pending">รอการอนุมัติ</option>
          <option value="approved">อนุมัติแล้ว</option>
          <option value="rejected">ปฏิเสธ</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <div style={styles.emptyBox}>ไม่มีคำขอ WFH</div>
      ) : (
        <div style={styles.requestList}>
          {filtered.map((r) => {
            const dept = DEPARTMENTS.find((d) => d.id === r.dept);
            return (
              <div key={r.id} style={styles.requestCard}>
                <div style={styles.reqLeft}>
                  <span style={{ ...styles.reqDeptTag, background: dept?.color + "20", color: dept?.color }}>{dept?.name}</span>
                  <div style={styles.reqMember}>{r.member}</div>
                  <div style={styles.reqDate}>📅 {formatDate(r.date)}</div>
                  {r.reason && <div style={styles.reqReason}>💬 {r.reason}</div>}
                </div>
                <div style={styles.reqRight}>
                  <div style={{ ...styles.statusBadge, ...statusStyle(r.status) }}>{statusLabel(r.status)}</div>
                  {role === "manager" && r.status === "pending" && (
                    <div style={styles.approvalBtns}>
                      <button style={styles.approveBtn} onClick={() => onApproval(r.id, "approved")}>✓</button>
                      <button style={styles.rejectBtn} onClick={() => onApproval(r.id, "rejected")}>✗</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function statusLabel(s) {
  return s === "pending" ? "⏳ รอ" : s === "approved" ? "✅ อนุมัติ" : "❌ ปฏิเสธ";
}
function statusStyle(s) {
  return s === "pending" ? { background: "#fef3c7", color: "#92400e" } : s === "approved" ? { background: "#d1fae5", color: "#065f46" } : { background: "#fee2e2", color: "#991b1b" };
}

// ─── Submit View ───────────────────────────────────────────────────────────────
function SubmitView({ selectedDept, setSelectedDept, selectedMember, setSelectedMember, form, setForm, toggleDate, onSubmit, year, month, today }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = new Date(year, month, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });

  return (
    <div style={styles.submitWrap}>
      <div style={styles.submitCard}>
        <div style={styles.sectionTitle}>ข้อมูลพนักงาน</div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>แผนก</label>
          <select style={styles.select} value={selectedDept} onChange={(e) => { setSelectedDept(e.target.value); setSelectedMember(""); }}>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>ชื่อ</label>
          <select style={styles.select} value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)}>
            <option value="">-- เลือกชื่อ --</option>
            {(SAMPLE_MEMBERS[selectedDept] || []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div style={styles.submitCard}>
        <div style={styles.sectionTitle}>เลือกวันที่ WFH — {monthName}</div>
        <div style={styles.calGrid}>
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
            <div key={d} style={styles.calDayHeader}>{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const selected = form.dates.includes(dateStr);
            const isWeekend = new Date(dateStr).getDay() === 0 || new Date(dateStr).getDay() === 6;
            const isPast = dateStr < today;
            return (
              <div
                key={day}
                style={{ ...styles.dayCell, ...(isWeekend || isPast ? { opacity: 0.3, cursor: "not-allowed" } : { cursor: "pointer" }), ...(selected ? styles.dayCellSelected : {}) }}
                onClick={() => !isWeekend && !isPast && toggleDate(dateStr)}
              >
                <span style={styles.dayNum}>{day}</span>
              </div>
            );
          })}
        </div>
        {form.dates.length > 0 && (
          <div style={styles.selectedDates}>เลือกแล้ว: {form.dates.sort().map((d) => formatDate(d)).join(", ")}</div>
        )}
      </div>

      <div style={styles.submitCard}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>เหตุผล (ไม่บังคับ)</label>
          <textarea style={styles.textarea} placeholder="ระบุเหตุผลการ WFH..." value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </div>
        <button style={styles.submitBtn} onClick={onSubmit}>
          📤 ส่งคำขอ WFH {form.dates.length > 0 && `(${form.dates.length} วัน)`}
        </button>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  app: { minHeight: "100vh", background: "#0f0f13", color: "#f1f1f5", fontFamily: "'Segoe UI', sans-serif", maxWidth: 520, margin: "0 auto", paddingBottom: 40 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #1e1e2e", background: "#12121a" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontSize: 28, background: "#6366f120", borderRadius: 12, padding: "6px 10px" },
  appTitle: { fontWeight: 700, fontSize: 18 },
  appSub: { fontSize: 11, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1 },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  liveChip: { display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 20, letterSpacing: 1 },
  liveDot: { width: 6, height: 6, borderRadius: "50%" },
  switchBtn: { background: "transparent", border: "1px solid #2e2e40", color: "#aaa", borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer" },
  nav: { display: "flex", gap: 4, padding: "12px 16px", background: "#12121a", borderBottom: "1px solid #1e1e2e" },
  navBtn: { flex: 1, padding: "8px 6px", borderRadius: 10, border: "none", background: "transparent", color: "#888", fontSize: 12, cursor: "pointer", fontWeight: 500, position: "relative" },
  navBtnActive: { background: "#6366f120", color: "#6366f1", fontWeight: 700 },
  badge: { position: "absolute", top: 2, right: 4, background: "#ef4444", color: "#fff", borderRadius: 10, fontSize: 9, padding: "1px 5px", fontWeight: 700 },
  content: { padding: 16 },
  loadingBox: { textAlign: "center", padding: 60, color: "#666", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 },
  spinner: { width: 32, height: 32, border: "3px solid #2e2e40", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" },
  notif: { position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1000, padding: "12px 24px", borderRadius: 12, color: "#fff", fontWeight: 600, fontSize: 14, boxShadow: "0 4px 24px #0008" },
  statsRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 },
  statBox: { background: "#1a1a24", border: "1px solid #2e2e40", borderTop: "2px solid #10b981", borderRadius: 12, padding: 14, textAlign: "center" },
  statNum: { fontSize: 26, fontWeight: 800, color: "#10b981" },
  statLabel: { fontSize: 11, color: "#666", marginTop: 2 },
  calendarCard: { background: "#1a1a24", border: "1px solid #2e2e40", borderRadius: 16, padding: 16, marginBottom: 16 },
  calNav: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  calNavBtn: { background: "#2e2e40", border: "none", color: "#ddd", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18 },
  calMonthLabel: { fontWeight: 700, fontSize: 15 },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 },
  calDayHeader: { textAlign: "center", fontSize: 11, color: "#555", padding: "4px 0", fontWeight: 600 },
  dayCell: { background: "#12121a", border: "1px solid #1e1e2e", borderRadius: 8, minHeight: 48, padding: 4, display: "flex", flexDirection: "column", alignItems: "center", cursor: "default", position: "relative" },
  dayCellToday: { border: "1.5px solid #6366f1", background: "#6366f115" },
  dayCellWeekend: { opacity: 0.4 },
  dayCellSelected: { background: "#6366f130", border: "1.5px solid #6366f1" },
  dayNum: { fontSize: 12, fontWeight: 600 },
  dayDots: { display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", justifyContent: "center" },
  dayDot: { width: 6, height: 6, borderRadius: "50%" },
  dayCount: { fontSize: 9, color: "#10b981", fontWeight: 700 },
  dayTooltip: { position: "absolute", bottom: "105%", left: "50%", transform: "translateX(-50%)", background: "#1e1e2e", border: "1px solid #2e2e40", borderRadius: 10, padding: "8px 12px", zIndex: 100, minWidth: 180, boxShadow: "0 8px 32px #0009" },
  tooltipTitle: { fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#ddd" },
  tooltipRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#bbb", marginBottom: 3 },
  tooltipDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  tooltipDept: { color: "#666", fontSize: 11 },
  deptSummary: { background: "#1a1a24", border: "1px solid #2e2e40", borderRadius: 16, padding: 16 },
  sectionTitle: { fontWeight: 700, fontSize: 14, marginBottom: 14, color: "#ddd" },
  deptBars: { display: "flex", flexDirection: "column", gap: 10 },
  deptBarRow: { display: "flex", alignItems: "center", gap: 10 },
  deptBarLabel: { width: 100, fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "#bbb" },
  deptDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  deptBarTrack: { flex: 1, height: 8, background: "#2e2e40", borderRadius: 4, overflow: "hidden" },
  deptBarFill: { height: "100%", borderRadius: 4 },
  deptBarCount: { fontSize: 12, color: "#666", width: 40, textAlign: "right" },
  filterRow: { display: "flex", gap: 8, marginBottom: 14 },
  select: { flex: 1, background: "#1a1a24", border: "1px solid #2e2e40", borderRadius: 10, color: "#ddd", padding: "10px 12px", fontSize: 13, cursor: "pointer" },
  requestList: { display: "flex", flexDirection: "column", gap: 10 },
  requestCard: { background: "#1a1a24", border: "1px solid #2e2e40", borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  reqLeft: { flex: 1 },
  reqRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 },
  reqDeptTag: { fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, display: "inline-block", marginBottom: 4 },
  reqMember: { fontWeight: 600, fontSize: 14, marginBottom: 3 },
  reqDate: { fontSize: 12, color: "#888" },
  reqReason: { fontSize: 12, color: "#666", marginTop: 4, fontStyle: "italic" },
  statusBadge: { fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8 },
  approvalBtns: { display: "flex", gap: 6 },
  approveBtn: { background: "#10b98120", color: "#10b981", border: "1px solid #10b981", borderRadius: 8, padding: "5px 12px", fontSize: 14, cursor: "pointer", fontWeight: 700 },
  rejectBtn: { background: "#ef444420", color: "#ef4444", border: "1px solid #ef4444", borderRadius: 8, padding: "5px 12px", fontSize: 14, cursor: "pointer", fontWeight: 700 },
  emptyBox: { textAlign: "center", padding: 60, color: "#555", fontSize: 14 },
  submitWrap: { display: "flex", flexDirection: "column", gap: 14 },
  submitCard: { background: "#1a1a24", border: "1px solid #2e2e40", borderRadius: 16, padding: 16 },
  fieldGroup: { marginBottom: 14 },
  label: { display: "block", fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  textarea: { width: "100%", background: "#12121a", border: "1px solid #2e2e40", borderRadius: 10, color: "#ddd", padding: "10px 12px", fontSize: 13, minHeight: 80, resize: "vertical", boxSizing: "border-box" },
  selectedDates: { marginTop: 10, fontSize: 12, color: "#6366f1", background: "#6366f115", borderRadius: 8, padding: "8px 12px" },
  submitBtn: { width: "100%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  roleScreen: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f13" },
  roleCard: { background: "#1a1a24", border: "1px solid #2e2e40", borderRadius: 24, padding: "40px 32px", maxWidth: 360, width: "90%", textAlign: "center" },
  roleEmoji: { fontSize: 56, marginBottom: 12 },
  roleTitle: { fontSize: 28, fontWeight: 800, margin: "0 0 6px" },
  roleSub: { color: "#888", marginBottom: 28, fontSize: 14 },
  roleButtons: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 },
  roleBtn: { border: "none", borderRadius: 14, padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left", color: "#fff" },
  roleBtnIcon: { fontSize: 28 },
  roleBtnLabel: { fontWeight: 700, fontSize: 16, display: "block" },
  roleBtnDesc: { fontSize: 12, opacity: 0.8, display: "block", marginTop: 2 },
  roleNote: { fontSize: 12, color: "#555", background: "#12121a", borderRadius: 8, padding: 10 },
};
