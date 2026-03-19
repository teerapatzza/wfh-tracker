import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { ref, onValue, set, push, update } from "firebase/database";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// ── Constants ──────────────────────────────────────────────────────────────────
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

const TASK_STATUS = {
  planned: { label: "วางแผน", color: "#6366f1", bg: "#6366f115", icon: "📋" },
  inprogress: { label: "กำลังทำ", color: "#f59e0b", bg: "#f59e0b15", icon: "⚙️" },
  done: { label: "เสร็จแล้ว", color: "#10b981", bg: "#10b98115", icon: "✅" },
  incomplete: { label: "ไม่เสร็จ", color: "#ef4444", bg: "#ef444415", icon: "❌" },
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }
function formatDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState({});
  const [plans, setPlans] = useState({});

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthUser(u);
      if (!u) { setLoading(false); setUserProfile(null); return; }
      const userRef = ref(db, `users/${u.uid}`);
      onValue(userRef, (snap) => {
        setUserProfile(snap.val());
        setLoading(false);
      });
    });
    return () => unsub();
  }, []);

  // Load all users & plans
  useEffect(() => {
    if (!authUser) return;
    const usersUnsub = onValue(ref(db, "users"), (snap) => setUsers(snap.val() || {}));
    const plansUnsub = onValue(ref(db, "plans"), (snap) => setPlans(snap.val() || {}));
    return () => { usersUnsub(); plansUnsub(); };
  }, [authUser]);

  if (loading) return <LoadingScreen />;
  if (!authUser || !userProfile) return <LoginScreen />;

  return (
    <MainApp
      authUser={authUser}
      userProfile={userProfile}
      users={users}
      plans={plans}
    />
  );
}

// ── Loading ────────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={S.center}>
      <div style={S.spinner} />
      <p style={{ color: "#666", marginTop: 16 }}>กำลังโหลด...</p>
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!email || !password) { setError("กรุณากรอกอีเมลและรหัสผ่าน"); return; }
    setLoading(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      setLoading(false);
    }
  };

  return (
    <div style={S.center}>
      <div style={S.loginCard}>
        <div style={S.loginLogo}>🏠</div>
        <h1 style={S.loginTitle}>WFH Planner</h1>
        <p style={S.loginSub}>ระบบวางแผนและติดตามงาน WFH</p>
        {error && <div style={S.errorBox}>{error}</div>}
        <input
          style={S.input}
          type="email"
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
        />
        <input
          style={S.input}
          type="password"
          placeholder="รหัสผ่าน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
        />
        <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 8 }} onClick={login} disabled={loading}>
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
        <p style={S.loginNote}>ติดต่อ Admin หากยังไม่มีบัญชี</p>
      </div>
    </div>
  );
}

// ── Main App Shell ─────────────────────────────────────────────────────────────
function MainApp({ authUser, userProfile, users, plans }) {
  const [view, setView] = useState("dashboard");
  const [notif, setNotif] = useState(null);

  const showNotif = (msg, type = "success") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3000);
  };

  const dept = DEPARTMENTS.find((d) => d.id === userProfile?.dept);
  const isAdmin = userProfile?.role === "admin";
  const isLeader = userProfile?.role === "leader" || isAdmin;

  const navItems = [
    { key: "dashboard", icon: "📊", label: "ภาพรวม" },
    { key: "calendar", icon: "📅", label: "Calendar" },
    { key: "myplan", icon: "📝", label: "แผนของฉัน" },
    ...(isLeader ? [{ key: "team", icon: "👥", label: "ทีม" }] : []),
    ...(isAdmin ? [{ key: "admin", icon: "⚙️", label: "Admin" }] : []),
  ];

  return (
    <div style={S.app}>
      {notif && (
        <div style={{ ...S.notif, background: notif.type === "error" ? "#ef4444" : "#10b981" }}>
          {notif.msg}
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.headerLogo}>🏠</span>
          <div>
            <div style={S.headerTitle}>WFH Planner</div>
            <div style={{ fontSize: 11, color: dept?.color || "#888" }}>
              {userProfile?.name} · {dept?.name}
              {isAdmin && " · Admin"}
              {!isAdmin && isLeader && " · Leader"}
            </div>
          </div>
        </div>
        <button style={S.logoutBtn} onClick={() => signOut(auth)}>ออกจากระบบ</button>
      </div>

      {/* Nav */}
      <div style={S.nav}>
        {navItems.map((n) => (
          <button
            key={n.key}
            style={{ ...S.navBtn, ...(view === n.key ? S.navBtnActive : {}) }}
            onClick={() => setView(n.key)}
          >
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={S.content}>
        {view === "dashboard" && <DashboardView plans={plans} users={users} userProfile={userProfile} />}
        {view === "calendar" && <CalendarView plans={plans} users={users} userProfile={userProfile} />}
        {view === "myplan" && <MyPlanView plans={plans} users={users} authUser={authUser} userProfile={userProfile} showNotif={showNotif} />}
        {view === "team" && <TeamView plans={plans} users={users} userProfile={userProfile} showNotif={showNotif} />}
        {view === "admin" && <AdminView users={users} showNotif={showNotif} authUser={authUser} />}
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function DashboardView({ plans, users, userProfile }) {
  const today = getToday();
  const todayPlans = Object.values(plans).filter((p) => p.date === today);
  const myDeptPlans = todayPlans.filter((p) => {
    const u = users[p.uid];
    return u?.dept === userProfile?.dept;
  });

  // Task stats
  const allTasks = Object.values(plans).flatMap((p) => Object.values(p.tasks || {}));
  const taskStats = {
    planned: allTasks.filter((t) => t.status === "planned").length,
    inprogress: allTasks.filter((t) => t.status === "inprogress").length,
    done: allTasks.filter((t) => t.status === "done").length,
    incomplete: allTasks.filter((t) => t.status === "incomplete").length,
  };

  return (
    <div>
      {/* Stats */}
      <div style={S.statsGrid}>
        <div style={S.statCard}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#6366f1" }}>{todayPlans.length}</div>
          <div style={S.statLabel}>WFH วันนี้ (ทั้งบริษัท)</div>
        </div>
        <div style={S.statCard}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#10b981" }}>{myDeptPlans.length}</div>
          <div style={S.statLabel}>WFH วันนี้ (แผนกฉัน)</div>
        </div>
        <div style={S.statCard}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>{taskStats.inprogress}</div>
          <div style={S.statLabel}>งานที่กำลังทำ</div>
        </div>
        <div style={S.statCard}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#10b981" }}>{taskStats.done}</div>
          <div style={S.statLabel}>งานเสร็จแล้ว</div>
        </div>
      </div>

      {/* Today's WFH */}
      <div style={S.card}>
        <div style={S.cardTitle}>🏠 ใครอยู่บ้านวันนี้ ({formatDate(today)})</div>
        {todayPlans.length === 0 ? (
          <div style={S.empty}>ไม่มีใคร WFH วันนี้</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {todayPlans.map((plan) => {
              const u = users[plan.uid];
              const dept = DEPARTMENTS.find((d) => d.id === u?.dept);
              const tasks = Object.values(plan.tasks || {});
              const done = tasks.filter((t) => t.status === "done").length;
              return (
                <div key={plan.id} style={S.planRow}>
                  <div style={S.planRowLeft}>
                    <div style={{ ...S.avatar, background: dept?.color + "30", color: dept?.color }}>
                      {u?.name?.[0] || "?"}
                    </div>
                    <div>
                      <div style={S.planName}>{u?.name || "Unknown"}</div>
                      <div style={{ fontSize: 11, color: dept?.color }}>{dept?.name}</div>
                    </div>
                  </div>
                  <div style={S.planRowRight}>
                    <div style={S.progressWrap}>
                      <div style={S.progressBar}>
                        <div style={{ ...S.progressFill, width: tasks.length ? `${(done / tasks.length) * 100}%` : "0%", background: dept?.color }} />
                      </div>
                      <span style={S.progressText}>{done}/{tasks.length} งาน</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Status Summary */}
      <div style={S.card}>
        <div style={S.cardTitle}>📊 สรุปสถานะงานทั้งหมด</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.entries(TASK_STATUS).map(([key, val]) => (
            <div key={key} style={{ ...S.statusChip, background: val.bg, border: `1px solid ${val.color}30` }}>
              <span>{val.icon}</span>
              <span style={{ color: val.color, fontWeight: 600, fontSize: 13 }}>{val.label}</span>
              <span style={{ color: val.color, fontWeight: 800, fontSize: 18, marginLeft: "auto" }}>{taskStats[key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Calendar View ──────────────────────────────────────────────────────────────
function CalendarView({ plans, users, userProfile }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const today = getToday();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const monthName = new Date(year, month, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });

  function getDatePlans(day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { dateStr, items: Object.values(plans).filter((p) => p.date === dateStr) };
  }

  const selectedPlans = selectedDate ? Object.values(plans).filter((p) => p.date === selectedDate) : [];

  return (
    <div>
      <div style={S.card}>
        <div style={S.calNav}>
          <button style={S.calNavBtn} onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>‹</button>
          <span style={S.calMonthLabel}>{monthName}</span>
          <button style={S.calNavBtn} onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>›</button>
        </div>
        <div style={S.calGrid}>
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
            <div key={d} style={S.calHeader}>{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const { dateStr, items } = getDatePlans(day);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const isWeekend = new Date(dateStr).getDay() === 0 || new Date(dateStr).getDay() === 6;
            const depts = [...new Set(items.map((p) => users[p.uid]?.dept).filter(Boolean))];
            return (
              <div
                key={day}
                style={{
                  ...S.calDay,
                  ...(isToday ? S.calDayToday : {}),
                  ...(isSelected ? S.calDaySelected : {}),
                  ...(isWeekend ? S.calDayWeekend : {}),
                  cursor: "pointer",
                }}
                onClick={() => setSelectedDate(selectedDate === dateStr ? null : dateStr)}
              >
                <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500 }}>{day}</span>
                {items.length > 0 && (
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                    {depts.slice(0, 3).map((dept) => {
                      const d = DEPARTMENTS.find((x) => x.id === dept);
                      return <span key={dept} style={{ width: 6, height: 6, borderRadius: "50%", background: d?.color }} />;
                    })}
                    {items.length > 0 && <span style={{ fontSize: 9, color: "#10b981", fontWeight: 700 }}>{items.length}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Detail */}
      {selectedDate && (
        <div style={S.card}>
          <div style={S.cardTitle}>📅 {formatDate(selectedDate)} — {selectedPlans.length} คน WFH</div>
          {selectedPlans.length === 0 ? (
            <div style={S.empty}>ไม่มีใคร WFH วันนี้</div>
          ) : (
            selectedPlans.map((plan) => {
              const u = users[plan.uid];
              const dept = DEPARTMENTS.find((d) => d.id === u?.dept);
              const tasks = Object.values(plan.tasks || {});
              return (
                <div key={plan.id} style={{ ...S.planRow, marginBottom: 12 }}>
                  <div style={S.planRowLeft}>
                    <div style={{ ...S.avatar, background: dept?.color + "30", color: dept?.color }}>{u?.name?.[0]}</div>
                    <div>
                      <div style={S.planName}>{u?.name}</div>
                      <div style={{ fontSize: 11, color: dept?.color }}>{dept?.name}</div>
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                        {tasks.map((t) => {
                          const st = TASK_STATUS[t.status];
                          return (
                            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                              <span>{st?.icon}</span>
                              <span style={{ color: "#bbb" }}>{t.title}</span>
                              <span style={{ ...S.badge, background: st?.bg, color: st?.color }}>{st?.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── My Plan ────────────────────────────────────────────────────────────────────
function MyPlanView({ plans, users, authUser, userProfile, showNotif }) {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [newTask, setNewTask] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = getToday();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const myPlans = Object.values(plans).filter((p) => p.uid === authUser.uid);
  const currentPlan = myPlans.find((p) => p.date === selectedDate);
  const tasks = Object.values(currentPlan?.tasks || {});

  const toggleWFH = async () => {
    if (currentPlan) {
      // Remove plan
      const updated = { ...plans };
      delete updated[currentPlan.id];
      const obj = {};
      Object.values(updated).forEach((p) => { obj[p.id] = p; });
      await set(ref(db, "plans"), obj);
      showNotif("ยกเลิก WFH วันนั้นแล้ว");
    } else {
      // Add plan
      const newRef = push(ref(db, "plans"));
      await set(newRef, {
        id: newRef.key,
        uid: authUser.uid,
        date: selectedDate,
        tasks: {},
        createdAt: Date.now(),
      });
      showNotif("เพิ่มวัน WFH แล้ว! 🏠");
    }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    if (!currentPlan) { showNotif("กด 'WFH วันนี้' ก่อนเพิ่มงาน", "error"); return; }
    const taskRef = push(ref(db, `plans/${currentPlan.id}/tasks`));
    await set(taskRef, {
      id: taskRef.key,
      title: newTask.trim(),
      status: "planned",
      createdAt: Date.now(),
    });
    setNewTask("");
    showNotif("เพิ่มงานแล้ว!");
  };

  const updateTaskStatus = async (taskId, status) => {
    await update(ref(db, `plans/${currentPlan.id}/tasks/${taskId}`), { status });
  };

  const deleteTask = async (taskId) => {
    const updated = { ...currentPlan.tasks };
    delete updated[taskId];
    await set(ref(db, `plans/${currentPlan.id}/tasks`), updated);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const monthName = new Date(year, month, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });

  return (
    <div>
      {/* Mini Calendar */}
      <div style={S.card}>
        <div style={S.calNav}>
          <button style={S.calNavBtn} onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>‹</button>
          <span style={S.calMonthLabel}>{monthName}</span>
          <button style={S.calNavBtn} onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>›</button>
        </div>
        <div style={S.calGrid}>
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => <div key={d} style={S.calHeader}>{d}</div>)}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const isWFH = myPlans.some((p) => p.date === dateStr);
            const isWeekend = new Date(dateStr).getDay() === 0 || new Date(dateStr).getDay() === 6;
            return (
              <div
                key={day}
                style={{
                  ...S.calDay,
                  ...(isToday ? S.calDayToday : {}),
                  ...(isSelected ? S.calDaySelected : {}),
                  ...(isWeekend ? S.calDayWeekend : {}),
                  cursor: isWeekend ? "default" : "pointer",
                }}
                onClick={() => !isWeekend && setSelectedDate(dateStr)}
              >
                <span style={{ fontSize: 12 }}>{day}</span>
                {isWFH && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Plan */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={S.cardTitle} >📅 {formatDate(selectedDate)}</div>
          <button
            style={{ ...S.btn, ...(currentPlan ? S.btnDanger : S.btnPrimary) }}
            onClick={toggleWFH}
          >
            {currentPlan ? "❌ ยกเลิก WFH" : "🏠 WFH วันนี้"}
          </button>
        </div>

        {currentPlan ? (
          <>
            {/* Add Task */}
            <div style={S.addTaskRow}>
              <input
                style={{ ...S.input, flex: 1, marginBottom: 0 }}
                placeholder="เพิ่มงานที่จะทำ..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
              />
              <button style={{ ...S.btn, ...S.btnPrimary }} onClick={addTask}>+ เพิ่ม</button>
            </div>

            {/* Task List */}
            {tasks.length === 0 ? (
              <div style={S.empty}>ยังไม่มีงาน กดเพิ่มงานด้านบน</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {tasks.map((task) => {
                  const st = TASK_STATUS[task.status];
                  return (
                    <div key={task.id} style={{ ...S.taskCard, borderLeft: `3px solid ${st.color}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: "#ddd", marginBottom: 6 }}>{task.title}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {Object.entries(TASK_STATUS).map(([key, val]) => (
                            <button
                              key={key}
                              style={{
                                ...S.statusBtn,
                                background: task.status === key ? val.bg : "transparent",
                                color: task.status === key ? val.color : "#555",
                                border: `1px solid ${task.status === key ? val.color : "#2e2e40"}`,
                              }}
                              onClick={() => updateTaskStatus(task.id, key)}
                            >
                              {val.icon} {val.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button style={S.deleteBtn} onClick={() => deleteTask(task.id)}>🗑</button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div style={S.empty}>กด "🏠 WFH วันนี้" เพื่อเพิ่มแผนการทำงาน</div>
        )}
      </div>
    </div>
  );
}

// ── Team View (Leader/Admin) ───────────────────────────────────────────────────
function TeamView({ plans, users, userProfile, showNotif }) {
  const [filterDept, setFilterDept] = useState(userProfile?.role === "admin" ? "all" : userProfile?.dept);
  const [filterDate, setFilterDate] = useState(getToday());

  const isAdmin = userProfile?.role === "admin";

  const filteredPlans = Object.values(plans).filter((p) => {
    const u = users[p.uid];
    const deptMatch = filterDept === "all" || u?.dept === filterDept;
    const dateMatch = !filterDate || p.date === filterDate;
    return deptMatch && dateMatch;
  });

  const updateTaskStatus = async (planId, taskId, status) => {
    await update(ref(db, `plans/${planId}/tasks/${taskId}`), { status });
    showNotif("อัปเดตสถานะแล้ว");
  };

  return (
    <div>
      {/* Filters */}
      <div style={S.card}>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && (
            <select style={S.select} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="all">ทุกแผนก</option>
              {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <input type="date" style={S.select} value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        </div>
      </div>

      {/* Team Plans */}
      {filteredPlans.length === 0 ? (
        <div style={S.card}><div style={S.empty}>ไม่มีแผน WFH ในวันที่เลือก</div></div>
      ) : (
        filteredPlans.map((plan) => {
          const u = users[plan.uid];
          const dept = DEPARTMENTS.find((d) => d.id === u?.dept);
          const tasks = Object.values(plan.tasks || {});
          const done = tasks.filter((t) => t.status === "done").length;
          const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

          return (
            <div key={plan.id} style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ ...S.avatar, background: dept?.color + "30", color: dept?.color }}>{u?.name?.[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={S.planName}>{u?.name}</div>
                  <div style={{ fontSize: 11, color: dept?.color }}>{dept?.name} · {formatDate(plan.date)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: pct === 100 ? "#10b981" : "#f59e0b" }}>{pct}%</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{done}/{tasks.length} งาน</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ ...S.progressBar, marginBottom: 12 }}>
                <div style={{ ...S.progressFill, width: `${pct}%`, background: pct === 100 ? "#10b981" : dept?.color }} />
              </div>

              {/* Tasks */}
              {tasks.length === 0 ? (
                <div style={S.empty}>ยังไม่มีงาน</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {tasks.map((task) => {
                    const st = TASK_STATUS[task.status];
                    return (
                      <div key={task.id} style={{ ...S.taskCard, borderLeft: `3px solid ${st.color}` }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: "#ddd" }}>{task.title}</div>
                        </div>
                        <select
                          style={{ ...S.select, width: "auto", padding: "4px 8px", fontSize: 12 }}
                          value={task.status}
                          onChange={(e) => updateTaskStatus(plan.id, task.id, e.target.value)}
                        >
                          {Object.entries(TASK_STATUS).map(([key, val]) => (
                            <option key={key} value={key}>{val.icon} {val.label}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Admin View ─────────────────────────────────────────────────────────────────
function AdminView({ users, showNotif, authUser }) {
  const [tab, setTab] = useState("users");
  const [form, setForm] = useState({ name: "", email: "", password: "", dept: DEPARTMENTS[0].id, role: "employee" });
  const [creating, setCreating] = useState(false);

  const createUser = async () => {
    if (!form.name || !form.email || !form.password) {
      showNotif("กรุณากรอกข้อมูลให้ครบ", "error"); return;
    }
    setCreating(true);
    try {
      // Create user via REST API (secondary auth)
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyBV3uaLt32-LHdIJn5gRTI-qSdZAK-jnyE`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password, returnSecureToken: true }),
      });
      const data = await res.json();
      if (data.error) { showNotif(data.error.message, "error"); setCreating(false); return; }
      // Save profile
      await set(ref(db, `users/${data.localId}`), {
        uid: data.localId,
        name: form.name,
        email: form.email,
        dept: form.dept,
        role: form.role,
        createdAt: Date.now(),
      });
      setForm({ name: "", email: "", password: "", dept: DEPARTMENTS[0].id, role: "employee" });
      showNotif(`สร้างบัญชี ${form.name} แล้ว! ✅`);
    } catch (e) {
      showNotif("เกิดข้อผิดพลาด", "error");
    }
    setCreating(false);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["users", "create"].map((t) => (
          <button key={t} style={{ ...S.btn, ...(tab === t ? S.btnPrimary : {}) }} onClick={() => setTab(t)}>
            {t === "users" ? "👥 รายชื่อ" : "➕ สร้าง User"}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div style={S.card}>
          <div style={S.cardTitle}>👥 รายชื่อพนักงานทั้งหมด ({Object.keys(users).length} คน)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.values(users).map((u) => {
              const dept = DEPARTMENTS.find((d) => d.id === u.dept);
              return (
                <div key={u.uid} style={S.userRow}>
                  <div style={{ ...S.avatar, background: dept?.color + "30", color: dept?.color }}>{u.name?.[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{u.email}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...S.badge, background: dept?.color + "20", color: dept?.color }}>{dept?.name}</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{u.role}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "create" && (
        <div style={S.card}>
          <div style={S.cardTitle}>➕ สร้างบัญชีพนักงานใหม่</div>
          <div style={S.fieldGroup}>
            <label style={S.label}>ชื่อ-นามสกุล</label>
            <input style={S.input} placeholder="ชื่อ-นามสกุล" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>อีเมล</label>
            <input style={S.input} type="email" placeholder="email@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>รหัสผ่านเริ่มต้น</label>
            <input style={S.input} type="password" placeholder="อย่างน้อย 6 ตัวอักษร" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>แผนก</label>
            <select style={S.select} value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>
              {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>Role</label>
            <select style={S.select} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="employee">Employee — ดูและกรอกแผนตัวเอง</option>
              <option value="leader">Leader — ดูและแก้สถานะทีมได้</option>
              <option value="admin">Admin — จัดการทุกอย่าง</option>
            </select>
          </div>
          <button style={{ ...S.btn, ...S.btnPrimary, width: "100%" }} onClick={createUser} disabled={creating}>
            {creating ? "กำลังสร้าง..." : "✅ สร้างบัญชี"}
          </button>
          <p style={{ fontSize: 12, color: "#555", marginTop: 10, textAlign: "center" }}>
            พนักงานสามารถเปลี่ยนรหัสผ่านเองได้หลัง login ครั้งแรก
          </p>
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight: "100vh", background: "#0a0a0f", color: "#f1f1f5", fontFamily: "'Segoe UI', sans-serif", maxWidth: 560, margin: "0 auto", paddingBottom: 40 },
  center: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: "#0a0a0f" },
  spinner: { width: 36, height: 36, border: "3px solid #1e1e2e", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" },

  loginCard: { background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 24, padding: "40px 32px", width: "90%", maxWidth: 380, textAlign: "center" },
  loginLogo: { fontSize: 52, marginBottom: 12 },
  loginTitle: { fontSize: 26, fontWeight: 800, margin: "0 0 6px" },
  loginSub: { color: "#666", fontSize: 14, marginBottom: 24 },
  loginNote: { fontSize: 12, color: "#444", marginTop: 16 },
  errorBox: { background: "#ef444415", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 },

  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#13131a", borderBottom: "1px solid #1e1e2e" },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  headerLogo: { fontSize: 26 },
  headerTitle: { fontWeight: 700, fontSize: 16 },
  logoutBtn: { background: "transparent", border: "1px solid #2e2e40", color: "#888", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" },

  nav: { display: "flex", padding: "10px 14px", gap: 4, background: "#13131a", borderBottom: "1px solid #1e1e2e", overflowX: "auto" },
  navBtn: { padding: "8px 12px", borderRadius: 10, border: "none", background: "transparent", color: "#666", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" },
  navBtnActive: { background: "#6366f120", color: "#6366f1", fontWeight: 700 },

  content: { padding: 14 },
  card: { background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 16, padding: 16, marginBottom: 14 },
  cardTitle: { fontWeight: 700, fontSize: 14, marginBottom: 14, color: "#ddd" },
  empty: { textAlign: "center", padding: 30, color: "#444", fontSize: 13 },

  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
  statCard: { background: "#13131a", border: "1px solid #1e1e2e", borderRadius: 14, padding: 14, textAlign: "center" },
  statLabel: { fontSize: 11, color: "#555", marginTop: 4 },

  calNav: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  calNavBtn: { background: "#1e1e2e", border: "none", color: "#ddd", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 16 },
  calMonthLabel: { fontWeight: 700, fontSize: 14 },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 },
  calHeader: { textAlign: "center", fontSize: 10, color: "#444", padding: "3px 0" },
  calDay: { background: "#0f0f18", border: "1px solid #1a1a28", borderRadius: 7, minHeight: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: 2 },
  calDayToday: { border: "1.5px solid #6366f1", background: "#6366f110" },
  calDaySelected: { background: "#6366f125", border: "1.5px solid #6366f1" },
  calDayWeekend: { opacity: 0.35 },

  planRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  planRowLeft: { display: "flex", alignItems: "flex-start", gap: 10, flex: 1 },
  planRowRight: { minWidth: 100 },
  planName: { fontWeight: 600, fontSize: 14 },
  avatar: { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 },
  progressWrap: { display: "flex", alignItems: "center", gap: 8 },
  progressBar: { flex: 1, height: 6, background: "#1e1e2e", borderRadius: 3, overflow: "hidden", minWidth: 60 },
  progressFill: { height: "100%", borderRadius: 3, transition: "width 0.4s ease" },
  progressText: { fontSize: 11, color: "#666", whiteSpace: "nowrap" },

  statusChip: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, fontSize: 13 },

  addTaskRow: { display: "flex", gap: 8, alignItems: "center" },
  taskCard: { background: "#0f0f18", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 10 },
  statusBtn: { padding: "3px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 500 },
  deleteBtn: { background: "transparent", border: "none", color: "#444", cursor: "pointer", fontSize: 16, padding: "2px 4px" },

  userRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1a1a28" },

  input: { width: "100%", background: "#0f0f18", border: "1px solid #1e1e2e", borderRadius: 10, color: "#ddd", padding: "10px 12px", fontSize: 13, boxSizing: "border-box", marginBottom: 12, outline: "none" },
  select: { width: "100%", background: "#0f0f18", border: "1px solid #1e1e2e", borderRadius: 10, color: "#ddd", padding: "10px 12px", fontSize: 13, cursor: "pointer" },
  fieldGroup: { marginBottom: 12 },
  label: { display: "block", fontSize: 11, color: "#666", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },

  btn: { background: "#1e1e2e", border: "1px solid #2e2e40", color: "#aaa", borderRadius: 10, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 500 },
  btnPrimary: { background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none" },
  btnDanger: { background: "#ef444420", color: "#ef4444", border: "1px solid #ef4444" },
  badge: { display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6 },

  notif: { position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1000, padding: "12px 24px", borderRadius: 12, color: "#fff", fontWeight: 600, fontSize: 14, boxShadow: "0 4px 24px #0008", whiteSpace: "nowrap" },
};
