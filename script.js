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

const STORAGE_KEY = "todo_tasks_v1";

let currentFilter = "all"; // all | today | week
let currentView = "list"; // list | calendar

// 달력에서 현재 보고 있는 연/월
const todayForCalendar = new Date();
let calendarYear = todayForCalendar.getFullYear();
let calendarMonth = todayForCalendar.getMonth(); // 0-index
let editingTaskId = null;
let currentDateForModal = null; // ISO string

function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
}

function formatKoreanDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
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
  const tasks = loadTasks().sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
  const todayISO = getTodayISO();

  // 오늘 날짜 표시
  todayDateEl.textContent = formatKoreanDate(todayISO);

  // 오늘의 할 일 렌더링
  todayTasksEl.innerHTML = "";
  const todayTasks = tasks.filter((t) => t.date === todayISO);

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

  renderAllTasksSection(tasks, todayISO);
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

function renderCalendar(tasks, baseIso) {
  calendarViewEl.style.display = "block";
  calendarViewEl.innerHTML = "";

  const todayIso = baseIso;

  const year = calendarYear;
  const month = calendarMonth; // 0-index

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const firstDay = (firstOfMonth.getDay() + 6) % 7; // 월요일 시작으로 보정
  const daysInMonth = lastOfMonth.getDate();

  const tasksByDate = tasks.reduce((map, task) => {
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
    const dateObj = new Date(year, month, day);
    const iso = dateObj.toISOString().split("T")[0];
    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    const headerRow = document.createElement("div");
    headerRow.className = "calendar-cell-header";

    const dayNum = document.createElement("div");
    dayNum.className = "calendar-day-number";
    dayNum.textContent = day;

    headerRow.appendChild(dayNum);

    const todaysIso = todayIso;
    const dayTasks = tasksByDate[iso] || [];

    if (iso === todaysIso || dayTasks.length > 0) {
      const badge = document.createElement("div");
      badge.className = "calendar-day-badge";
      if (iso === todaysIso) {
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

  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "calendar-empty-state";
    empty.textContent = "선택한 필터에 해당하는 할 일이 없습니다.";
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
  const tasks = loadTasks();
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
  const tasks = loadTasks().filter((t) => t.date === dateIso);
  currentDateForModal = dateIso;

  dateDetailText.textContent = formatKoreanDate(dateIso);

  dateTaskListEl.innerHTML = "";
  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "이 날짜에는 등록된 할 일이 없습니다.";
    dateTaskListEl.appendChild(empty);
  } else {
    tasks.forEach((task) => {
      const card = createTaskCard(task, false);
      dateTaskListEl.appendChild(card);
    });
  }

  if (dateModalOverlay) {
    dateModalOverlay.classList.remove("hidden");
  }
}

function toggleTaskCompleted(taskId, completed) {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return;
  tasks[idx] = { ...tasks[idx], completed };
  saveTasks(tasks);
  render();
}

function deleteTask(taskId) {
  const tasks = loadTasks();
  const target = tasks.find((t) => t.id === taskId);
  if (!target) return;

  const confirmed = window.confirm(`"${target.title}" 할 일을 삭제하시겠어요?`);
  if (!confirmed) return;

  const next = tasks.filter((t) => t.id !== taskId);
  saveTasks(next);
  closeModal();
  render();
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

  const tasks = loadTasks();

  if (editingTaskId == null) {
    tasks.push({
      id: Date.now(),
      title,
      description,
      date,
      completed: false,
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

  saveTasks(tasks);

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

// 초기 렌더링
render();

