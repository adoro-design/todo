const todayDateEl = document.getElementById("today-date");
const todayTasksEl = document.getElementById("today-tasks");
const allTasksEl = document.getElementById("all-tasks");
const calendarViewEl = document.getElementById("calendar-view");

const openModalBtn = document.getElementById("open-modal-btn");
const modalOverlay = document.getElementById("task-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const cancelBtn = document.getElementById("cancel-btn");
const taskForm = document.getElementById("task-form");
const dateModalOverlay = document.getElementById("date-modal");
const dateCloseBtn = document.getElementById("date-close-btn");
const dateDetailText = document.getElementById("date-detail-text");
const dateTaskListEl = document.getElementById("date-task-list");
const dateNewTaskBtn = document.getElementById("date-new-task-btn");
const titleInput = document.getElementById("task-title");
const descInput = document.getElementById("task-desc");
const dateInput = document.getElementById("task-date");
const modalTitleEl = document.getElementById("modal-title");
const submitBtn = document.getElementById("submit-btn");
const filterButtons = document.querySelectorAll(".chip-btn");
const viewToggleButtons = document.querySelectorAll(".icon-toggle-btn[data-view]");

let currentFilter = "all"; // all | today | week
let currentView = "calendar"; // list | calendar
let tasks = []; // Firebase에서 동기화해 사용하는 메모리 캐시

// 달력에서 현재 보고 있는 연/월
const todayForCalendar = new Date();
let calendarYear = todayForCalendar.getFullYear();
let calendarMonth = todayForCalendar.getMonth(); // 0-index
let editingTaskId = null;
let currentDateForModal = null; // ISO string
let db = null;

// Firebase 초기화
if (window.firebase && window.firebase.apps && window.firebase.apps.length === 0) {
  const firebaseConfig = {
    apiKey: "AIzaSyBbr1uDWpmGM3u9llQ9rIMLojO1yeCUhu8",
    authDomain: "todo-19b1d.firebaseapp.com",
    databaseURL: "https://todo-19b1d-default-rtdb.firebaseio.com",
    projectId: "todo-19b1d",
    storageBucket: "todo-19b1d.firebasestorage.app",
    messagingSenderId: "887203659375",
    appId: "1:887203659375:web:e8afb293001989ed66179a",
    measurementId: "G-3T388XBDNH",
  };

  try {
    window.firebase.initializeApp(firebaseConfig);
    db = window.firebase.database();
  } catch (e) {
    console.error("Firebase 초기화 실패:", e);
  }
} else if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
  db = window.firebase.database();
}

// Firebase에서 tasks 실시간 동기화
function watchTasksFromFirebase() {
  if (!db) {
    render(); // Firebase가 없으면 비어 있는 상태로 렌더링
    return;
  }

  db.ref("tasks").on("value", (snapshot) => {
    const val = snapshot.val() || {};
    const next = [];

    Object.keys(val).forEach((key) => {
      const item = val[key] || {};
      if (!item.date || !item.title) return;
      next.push({
        id: key, // Firebase key
        title: item.title || "",
        description: item.description || "",
        date: item.date,
        completed: !!item.completed,
      });
    });

    tasks = next;
    render();
  });
}

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatKoreanDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function createTaskCard(task, isTodaySection) {
  const wrapper = document.createElement("div");
  wrapper.className =
    "task-card task-card--clickable" + (isTodaySection ? "" : " task-card--muted");

  if (task.completed) {
    wrapper.classList.add("task-card--done");
  }

  const main = document.createElement("div");
  main.className = "task-main";

  const titleRow = document.createElement("div");
  titleRow.className = "task-title-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = !!task.completed;

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title;
  if (task.completed) {
    title.classList.add("task-title--done");
  }

  const desc = document.createElement("div");
  desc.className = "task-desc";
  desc.textContent = task.description || "상세 내용 없음";

  titleRow.appendChild(checkbox);
  titleRow.appendChild(title);

  main.appendChild(titleRow);
  main.appendChild(desc);

  const meta = document.createElement("div");
  meta.className = "task-meta";

  const datePill = document.createElement("div");
  datePill.className = "task-date-pill";
  datePill.textContent = task.date;

  meta.appendChild(datePill);

  if (task.date === getTodayISO()) {
    const badge = document.createElement("div");
    badge.className = "badge-today";
    badge.textContent = "오늘";
    meta.appendChild(badge);
  }

  if (!isTodaySection) {
    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "text-btn";
    editBtn.textContent = "수정";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(task.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "text-btn text-btn--danger";
    deleteBtn.textContent = "삭제";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    meta.appendChild(actions);
  }

  wrapper.appendChild(main);
  wrapper.appendChild(meta);

  // 카드 전체 클릭 시 상세/수정 모달
  wrapper.addEventListener("click", () => {
    openEditModal(task.id);
  });

  // 체크박스는 완료 상태만 토글
  checkbox.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTaskCompleted(task.id, checkbox.checked);
  });

  return wrapper;
}

function render() {
  const sorted = [...tasks].sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
  const todayISO = getTodayISO();

  // 오늘 날짜 표시
  todayDateEl.textContent = formatKoreanDate(todayISO);

  // 오늘의 할 일 렌더링
  todayTasksEl.innerHTML = "";
  const todayTasks = sorted.filter((t) => t.date === todayISO);

  if (todayTasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "오늘은 등록된 할 일이 없습니다.";
    todayTasksEl.appendChild(empty);
  } else {
    todayTasks.forEach((task) => {
      todayTasksEl.appendChild(createTaskCard(task, true));
    });
  }

  renderAllTasksSection(sorted, todayISO);
}

function getFilteredTasks(tasks, todayISO) {
  if (currentFilter === "today") {
    return tasks.filter((t) => t.date === todayISO);
  }
  if (currentFilter === "week") {
    return tasks.filter((t) => isInThisWeek(t.date, todayISO));
  }
  return tasks;
}

function renderAllTasksSection(tasks, todayISO) {
  const filtered = getFilteredTasks(tasks, todayISO);

  if (currentView === "list") {
    calendarViewEl.innerHTML = "";
    calendarViewEl.style.display = "none";

    allTasksEl.style.display = "flex";
    allTasksEl.innerHTML = "";

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      if (tasks.length === 0) {
        empty.textContent =
          '등록된 할 일이 없습니다. 상단의 "새로운 할 일" 버튼을 눌러 추가해 보세요.';
      } else {
        empty.textContent = "선택한 필터에 해당하는 할 일이 없습니다.";
      }
      allTasksEl.appendChild(empty);
    } else {
      filtered.forEach((task) => {
        allTasksEl.appendChild(createTaskCard(task, false));
      });
    }
  } else {
    allTasksEl.style.display = "none";
    renderCalendar(filtered, todayISO);
  }
}

function isInThisWeek(dateStr, baseIso) {
  const [by, bm, bd] = baseIso.split("-").map(Number);
  const base = new Date(by, bm - 1, bd);
  const baseDay = base.getDay(); // 0(일)~6(토)
  const diffToMonday = (baseDay + 6) % 7; // 월요일 기준

  const weekStart = new Date(base);
  weekStart.setDate(base.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);

  return target >= weekStart && target <= weekEnd;
}

function renderCalendar(tasksForView, baseIso) {
  calendarViewEl.style.display = "block";
  calendarViewEl.innerHTML = "";

  if (currentFilter === "week") {
    renderWeekCalendar(tasksForView, baseIso);
  } else {
    renderMonthCalendar(tasksForView, baseIso);
  }
}

function renderMonthCalendar(tasksForView, baseIso) {
  const todayIso = baseIso;

  const year = calendarYear;
  const month = calendarMonth; // 0-index

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const firstDay = (firstOfMonth.getDay() + 6) % 7; // 월요일 시작으로 보정
  const daysInMonth = lastOfMonth.getDate();

  const tasksByDate = tasksForView.reduce((map, task) => {
    if (!map[task.date]) map[task.date] = [];
    map[task.date].push(task);
    return map;
  }, {});

  const calendar = document.createElement("div");
  calendar.className = "calendar";

  const header = document.createElement("div");
  header.className = "calendar-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "calendar-header-left";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "icon-toggle-btn";
  prevBtn.textContent = "‹";
  prevBtn.title = "이전 달";
  prevBtn.addEventListener("click", () => {
    calendarMonth -= 1;
    if (calendarMonth < 0) {
      calendarMonth = 11;
      calendarYear -= 1;
    }
    render();
  });

  const monthLabel = document.createElement("span");
  monthLabel.textContent = `${year}년 ${month + 1}월`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "icon-toggle-btn";
  nextBtn.textContent = "›";
  nextBtn.title = "다음 달";
  nextBtn.addEventListener("click", () => {
    calendarMonth += 1;
    if (calendarMonth > 11) {
      calendarMonth = 0;
      calendarYear += 1;
    }
    render();
  });

  headerLeft.appendChild(prevBtn);
  headerLeft.appendChild(monthLabel);
  headerLeft.appendChild(nextBtn);

  const filterLabel = document.createElement("span");
  filterLabel.textContent = `필터: ${
    currentFilter === "all" ? "전체" : currentFilter === "today" ? "오늘" : "이번 주"
  }`;

  header.appendChild(headerLeft);
  header.appendChild(filterLabel);

  const weekdays = document.createElement("div");
  weekdays.className = "calendar-weekdays";
  ["월", "화", "수", "목", "금", "토", "일"].forEach((label) => {
    const d = document.createElement("div");
    d.className = "calendar-weekday";
    d.textContent = label;
    weekdays.appendChild(d);
  });

  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  const cellsBefore = firstDay;
  for (let i = 0; i < cellsBefore; i += 1) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell calendar-cell--muted";
    grid.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    const headerRow = document.createElement("div");
    headerRow.className = "calendar-cell-header";

    const dayNum = document.createElement("div");
    dayNum.className = "calendar-day-number";
    dayNum.textContent = day;

    headerRow.appendChild(dayNum);

    const dayTasks = tasksByDate[iso] || [];

    if (iso === todayIso || dayTasks.length > 0) {
      const badge = document.createElement("div");
      badge.className = "calendar-day-badge";
      if (iso === todayIso) {
        badge.classList.add("calendar-day-badge--today");
      }
      badge.textContent = dayTasks.length > 0 ? `${dayTasks.length}건` : "오늘";
      headerRow.appendChild(badge);
    }

    cell.appendChild(headerRow);

    if (dayTasks.length > 0) {
      cell.classList.add("calendar-cell--has-tasks");
      cell.addEventListener("click", () => {
        openDateDetailModal(iso);
      });

      const list = document.createElement("div");
      list.className = "calendar-task-list";

      const maxItems = 2;
      dayTasks.slice(0, maxItems).forEach((task) => {
        const item = document.createElement("div");
        item.className = "calendar-task-item";
        if (task.completed) {
          item.classList.add("calendar-task-item--done");
        }
        item.textContent = task.title;
        list.appendChild(item);
      });

      if (dayTasks.length > maxItems) {
        const more = document.createElement("div");
        more.className = "calendar-task-item";
        more.textContent = `+${dayTasks.length - maxItems} 더 보기`;
        list.appendChild(more);
      }

      cell.appendChild(list);
    }

    grid.appendChild(cell);
  }

  calendar.appendChild(header);
  calendar.appendChild(weekdays);
  calendar.appendChild(grid);

  if (tasksForView.length === 0) {
    const empty = document.createElement("div");
    empty.className = "calendar-empty-state";
    empty.textContent = "선택한 필터에 해당하는 할 일이 없습니다.";
    calendar.appendChild(empty);
  }

  calendarViewEl.appendChild(calendar);
}

function renderWeekCalendar(tasksForView, baseIso) {
  const [by, bm, bd] = baseIso.split("-").map(Number);
  const base = new Date(by, bm - 1, bd);
  const baseDay = base.getDay(); // 0(일)~6(토)
  const diffToMonday = (baseDay + 6) % 7; // 월요일 기준

  const weekStart = new Date(base);
  weekStart.setDate(base.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const tasksByDate = tasksForView.reduce((map, task) => {
    if (!map[task.date]) map[task.date] = [];
    map[task.date].push(task);
    return map;
  }, {});

  const calendar = document.createElement("div");
  calendar.className = "calendar";

  const header = document.createElement("div");
  header.className = "calendar-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "calendar-header-left";

  const rangeLabel = document.createElement("span");
  const sY = weekStart.getFullYear();
  const sM = weekStart.getMonth() + 1;
  const sD = weekStart.getDate();
  const eY = weekEnd.getFullYear();
  const eM = weekEnd.getMonth() + 1;
  const eD = weekEnd.getDate();
  rangeLabel.textContent = `${sY}년 ${sM}월 ${sD}일 ~ ${eY}년 ${eM}월 ${eD}일`;

  headerLeft.appendChild(rangeLabel);

  const filterLabel = document.createElement("span");
  filterLabel.textContent = "필터: 이번 주";

  header.appendChild(headerLeft);
  header.appendChild(filterLabel);

  const weekdays = document.createElement("div");
  weekdays.className = "calendar-weekdays";
  ["월", "화", "수", "목", "금", "토", "일"].forEach((label) => {
    const d = document.createElement("div");
    d.className = "calendar-weekday";
    d.textContent = label;
    weekdays.appendChild(d);
  });

  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    const headerRow = document.createElement("div");
    headerRow.className = "calendar-cell-header";

    const dayNum = document.createElement("div");
    dayNum.className = "calendar-day-number";
    dayNum.textContent = day;

    headerRow.appendChild(dayNum);

    const dayTasks = tasksByDate[iso] || [];

    if (iso === baseIso || dayTasks.length > 0) {
      const badge = document.createElement("div");
      badge.className = "calendar-day-badge";
      if (iso === baseIso) {
        badge.classList.add("calendar-day-badge--today");
      }
      badge.textContent = dayTasks.length > 0 ? `${dayTasks.length}건` : "오늘";
      headerRow.appendChild(badge);
    }

    cell.appendChild(headerRow);

    if (dayTasks.length > 0) {
      cell.classList.add("calendar-cell--has-tasks");
      cell.addEventListener("click", () => {
        openDateDetailModal(iso);
      });

      const list = document.createElement("div");
      list.className = "calendar-task-list";

      const maxItems = 3;
      dayTasks.slice(0, maxItems).forEach((task) => {
        const item = document.createElement("div");
        item.className = "calendar-task-item";
        if (task.completed) {
          item.classList.add("calendar-task-item--done");
        }
        item.textContent = task.title;
        list.appendChild(item);
      });

      if (dayTasks.length > maxItems) {
        const more = document.createElement("div");
        more.className = "calendar-task-item";
        more.textContent = `+${dayTasks.length - maxItems} 더 보기`;
        list.appendChild(more);
      }

      cell.appendChild(list);
    }

    grid.appendChild(cell);
  }

  calendar.appendChild(header);
  calendar.appendChild(weekdays);
  calendar.appendChild(grid);

  if (tasksForView.length === 0) {
    const empty = document.createElement("div");
    empty.className = "calendar-empty-state";
    empty.textContent = "이번 주에는 등록된 할 일이 없습니다.";
    calendar.appendChild(empty);
  }

  calendarViewEl.appendChild(calendar);
}

function openCreateModal(defaultDate) {
  editingTaskId = null;
  modalTitleEl.textContent = "새로운 할 일 추가";
  submitBtn.textContent = "추가하기";

  taskForm.reset();
  modalOverlay.classList.remove("hidden");
  const base = defaultDate || getTodayISO();
  dateInput.value = base;
  setTimeout(() => {
    titleInput.focus();
  }, 0);
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  editingTaskId = null;
  currentDateForModal = null;
}

function openEditModal(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  editingTaskId = taskId;
  modalTitleEl.textContent = "할 일 상세 / 수정";
  submitBtn.textContent = "수정 저장";

  titleInput.value = task.title;
  descInput.value = task.description || "";
  dateInput.value = task.date;

  modalOverlay.classList.remove("hidden");
  setTimeout(() => {
    titleInput.focus();
  }, 0);
}

function openDateDetailModal(dateIso) {
  const dateTasks = tasks.filter((t) => t.date === dateIso);
  currentDateForModal = dateIso;

  dateDetailText.textContent = formatKoreanDate(dateIso);

  dateTaskListEl.innerHTML = "";
  if (dateTasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "이 날짜에는 등록된 할 일이 없습니다.";
    dateTaskListEl.appendChild(empty);
  } else {
    dateTasks.forEach((task) => {
      const card = createTaskCard(task, false);
      dateTaskListEl.appendChild(card);
    });
  }

  if (dateModalOverlay) {
    dateModalOverlay.classList.remove("hidden");
  }
}

function toggleTaskCompleted(taskId, completed) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  if (db) {
    db.ref(`tasks/${task.id}`)
      .update({ completed })
      .catch((err) => {
        console.error("Firebase 완료 상태 업데이트 실패:", err);
      });
  } else {
    task.completed = completed;
    render();
  }
}

function deleteTask(taskId) {
  const target = tasks.find((t) => t.id === taskId);
  if (!target) return;

  const confirmed = window.confirm(`"${target.title}" 할 일을 삭제하시겠어요?`);
  if (!confirmed) return;

  if (db) {
    db.ref(`tasks/${target.id}`)
      .remove()
      .then(() => {
        closeModal();
      })
      .catch((err) => {
        console.error("Firebase에서 삭제 실패:", err);
      });
  } else {
    tasks = tasks.filter((t) => t.id !== taskId);
    closeModal();
    render();
  }
}

openModalBtn.addEventListener("click", () => openCreateModal());
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", () => {
  closeModal();
});

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    closeModal();
  }
});

if (dateCloseBtn && dateModalOverlay) {
  dateCloseBtn.addEventListener("click", () => {
    dateModalOverlay.classList.add("hidden");
    currentDateForModal = null;
  });

  dateModalOverlay.addEventListener("click", (e) => {
    if (e.target === dateModalOverlay) {
      dateModalOverlay.classList.add("hidden");
      currentDateForModal = null;
    }
  });
}

if (dateNewTaskBtn) {
  dateNewTaskBtn.addEventListener("click", () => {
    // 날짜 모달은 닫고, 해당 날짜로 추가 모달 열기
    if (dateModalOverlay) {
      dateModalOverlay.classList.add("hidden");
    }
    openCreateModal(currentDateForModal || getTodayISO());
  });
}

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const title = titleInput.value.trim();
  const description = descInput.value.trim();
  const date = dateInput.value;

  if (!title) {
    alert("제목을 입력해 주세요.");
    titleInput.focus();
    return;
  }

  if (!date) {
    alert("일자를 선택해 주세요.");
    dateInput.focus();
    return;
  }

  if (editingTaskId == null) {
    if (db) {
      db.ref("tasks")
        .push({
          title,
          description,
          date,
          completed: false,
        })
        .catch((err) => {
          console.error("Firebase에 저장하는 중 오류가 발생했습니다:", err);
        });
    } else {
      const newTask = {
        id: String(Date.now()),
        title,
        description,
        date,
        completed: false,
      };
      tasks.push(newTask);
    }
  } else {
    if (db) {
      db.ref(`tasks/${editingTaskId}`)
        .update({
          title,
          description,
          date,
        })
        .catch((err) => {
          console.error("Firebase에서 수정하는 중 오류가 발생했습니다:", err);
        });
    } else {
      const idx = tasks.findIndex((t) => t.id === editingTaskId);
      if (idx !== -1) {
        tasks[idx] = {
          ...tasks[idx],
          title,
          description,
          date,
        };
      }
    }
  }

  taskForm.reset();
  dateInput.value = getTodayISO();
  closeModal();
  render();
});

// 필터 버튼
filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const value = btn.dataset.filter;
    if (!value) return;
    currentFilter = value;

    filterButtons.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    render();
  });
});

// 보기 전환 버튼
viewToggleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    if (!view || view === currentView) return;

    currentView = view;

    viewToggleButtons.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    render();
  });
});

// Firebase에서 할 일 감시 시작 후 렌더링
watchTasksFromFirebase();

