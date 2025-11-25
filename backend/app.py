from typing import List, Optional
import hashlib
import secrets
import sqlite3
import json
from pathlib import Path
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, timedelta


app = FastAPI(title="Hyuga Recovery API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = Path(__file__).parent / "hyuga.db"


def _get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _init_db():
    conn = _get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tokens (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            is_done INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            payload_json TEXT NOT NULL,
            result_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_routine_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            duration_min INTEGER DEFAULT 0,
            note TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );
        """
    )
    conn.commit()
    conn.close()


_init_db()


class WorkoutInput(BaseModel):
    duration_min: float = Field(ge=0)
    avg_hr: Optional[int] = Field(default=None, ge=30, le=220)
    max_hr: Optional[int] = Field(default=None, ge=100, le=230)
    rpe: Optional[float] = Field(default=None, ge=0, le=10)
    sleep_hours: float = Field(ge=0, le=14)
    sleep_quality: Optional[int] = Field(default=3, ge=1, le=5)
    temp_c: Optional[float] = None
    humidity: Optional[float] = Field(default=None, ge=0, le=100)
    last7_load: float = Field(default=0, ge=0)
    last28_load: float = Field(default=0, ge=0)
    hi_streak_days: int = Field(default=0, ge=0)


class RecoveryWindow(BaseModel):
    label: str
    recommend_min: int
    expected_roi_pct: int
    note: Optional[str] = None


class PredictOutput(BaseModel):
    fatigue_score: int
    recovery_windows: List[RecoveryWindow]
    overtraining_risk: Optional[str]


class ROIReportInput(BaseModel):
    weekly_sessions: List[WorkoutInput]
    next_workout_time: Optional[datetime] = None


class ROIDataPoint(BaseModel):
    day: str
    workout_load: float
    recovery_load: float
    ratio: float


class ROIReportOutput(BaseModel):
    recovery_efficiency_score: int
    weekly_recovery_ratio: List[ROIDataPoint]
    expected_next_performance_change_pct: int
    rest_accrual_badge: str


class Routine(BaseModel):
    title: str
    minutes: int
    steps: List[str]
    type: str


class GuardDay(BaseModel):
    date: str
    risk: str  # green/yellow/red


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(default="", max_length=50)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=50)
    password: Optional[str] = Field(default=None, min_length=8)


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    name: str
    created_at: datetime


class AuthToken(BaseModel):
    token: str
    user: UserPublic


class RoutineRunCreate(BaseModel):
    title: str
    duration_min: Optional[int] = 0
    note: Optional[str] = ''


class ReportSummary(BaseModel):
    total_predictions: int
    last_fatigue: Optional[int]
    last_overtraining_risk: Optional[str]
    avg_fatigue: Optional[float]
    routine_runs: int
    last_run_title: Optional[str]
    last_run_at: Optional[str]
    last_roi_pct: Optional[int]
    recent_windows: Optional[List[RecoveryWindow]]


class TodoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: str = Field(description="YYYY-MM-DD")
    time: str = Field(description="HH:MM")


class TodoUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    date: Optional[str] = None
    time: Optional[str] = None
    is_done: Optional[bool] = None


class TodoOut(BaseModel):
    id: int
    title: str
    date: str
    time: str
    is_done: bool
    created_at: datetime


def _session_trimp(inp: WorkoutInput) -> float:
    if inp.avg_hr and inp.max_hr:
        hr_ratio = max(0.0, min(1.0, (inp.avg_hr) / float(inp.max_hr)))
    else:
        # Fallback to RPE-based when HR not available
        hr_ratio = (inp.rpe or 5.0) / 10.0
    # Simple TRIMP-like scaling
    return inp.duration_min * (0.64 * (2.71828 ** (1.92 * hr_ratio)))


def _fatigue_score(inp: WorkoutInput) -> int:
    load = _session_trimp(inp)
    acute = inp.last7_load + load
    chronic = max(1.0, inp.last28_load / 4.0)
    atl_ctl = acute / chronic
    sleep_debt = max(0.0, 8.0 - inp.sleep_hours)
    env_penalty = 0.0
    if inp.temp_c is not None and inp.humidity is not None:
        # Add penalty for heat/humidity load
        heat_indexish = max(0.0, (inp.temp_c - 20.0)) * (0.5 + (inp.humidity / 200.0))
        env_penalty = min(20.0, heat_indexish)
    streak_penalty = min(20.0, inp.hi_streak_days * 3.0)
    base = 50 * (atl_ctl - 1.0) + sleep_debt * 5 + env_penalty + streak_penalty
    # Normalize to 0-100
    score = int(max(0, min(100, round(40 + base / 2.0))))
    return score


def _roi_for_rest(fatigue: int, minutes: int, sleep_hours: float) -> int:
    # Diminishing returns curve based on fatigue and duration
    rest_factor = (1 - (2.71828 ** (-minutes / 60.0)))
    sleep_factor = min(1.0, (sleep_hours / 8.0))
    fatigue_gain = (fatigue / 100.0) * 30  # higher fatigue → more to gain
    roi = int(round((10 + fatigue_gain) * rest_factor * (0.6 + 0.4 * sleep_factor)))
    return max(0, min(50, roi))


def _risk_bucket(fatigue: int, sleep_debt: float, hi_streak: int) -> Optional[str]:
    if fatigue >= 80 or (sleep_debt >= 2 and hi_streak >= 2):
        return "red"
    if fatigue >= 65 or sleep_debt >= 1.5 or hi_streak >= 2:
        return "yellow"
    return None


def _hash_password(raw: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", raw.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"{salt}${hashed.hex()}"


def _verify_password(raw: str, stored: str) -> bool:
    try:
        salt, hex_hash = stored.split("$", 1)
    except ValueError:
        return False
    new_hash = hashlib.pbkdf2_hmac("sha256", raw.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return secrets.compare_digest(new_hash.hex(), hex_hash)


def _row_to_user(row: sqlite3.Row) -> UserPublic:
    return UserPublic(
        id=row["id"],
        email=row["email"],
        name=row["name"],
        created_at=datetime.fromisoformat(row["created_at"]),
    )


def _issue_token(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT OR REPLACE INTO tokens (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user_id, now),
    )
    conn.commit()
    return token


def _get_user_by_token(authorization: Optional[str]) -> UserPublic:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰이 필요합니다.")
    token = authorization.split(" ", 1)[1]
    conn = _get_db()
    try:
        cur = conn.execute(
            """
            SELECT u.* FROM tokens t
            JOIN users u ON u.id = t.user_id
            WHERE t.token = ?
            """,
            (token,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다.")
        return _row_to_user(row)
    finally:
        conn.close()


def _todo_row_to_out(row: sqlite3.Row) -> TodoOut:
    return TodoOut(
        id=row["id"],
        title=row["title"],
        date=row["date"],
        time=row["time"],
        is_done=bool(row["is_done"]),
        created_at=datetime.fromisoformat(row["created_at"]),
    )


@app.post("/api/auth/register", response_model=AuthToken, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserCreate):
    conn = _get_db()
    try:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (payload.email,)).fetchone()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 가입된 이메일입니다.")
        password_hash = _hash_password(payload.password)
        created_at = datetime.utcnow().isoformat()
        cur = conn.execute(
            "INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)",
            (payload.email, password_hash, payload.name, created_at),
        )
        user_id = cur.lastrowid
        conn.commit()
        token = _issue_token(conn, user_id)
        user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return AuthToken(token=token, user=_row_to_user(user_row))
    finally:
        conn.close()


@app.post("/api/auth/login", response_model=AuthToken)
def login_user(payload: UserLogin):
    conn = _get_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (payload.email,)).fetchone()
        if not row or not _verify_password(payload.password, row["password_hash"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
        token = _issue_token(conn, row["id"])
        return AuthToken(token=token, user=_row_to_user(row))
    finally:
        conn.close()


@app.get("/api/auth/me", response_model=UserPublic)
def get_me(authorization: Optional[str] = Header(default=None, alias="Authorization")):
    return _get_user_by_token(authorization)


@app.put("/api/auth/me", response_model=UserPublic)
def update_me(
    payload: UserUpdate,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    user = _get_user_by_token(authorization)
    conn = _get_db()
    try:
        updates = {}
        if payload.name is not None:
            updates["name"] = payload.name
        if payload.password:
            updates["password_hash"] = _hash_password(payload.password)
        if updates:
            set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
            conn.execute(
                f"UPDATE users SET {set_clause} WHERE id = ?",
                (*updates.values(), user.id),
            )
            conn.commit()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user.id,)).fetchone()
        return _row_to_user(row)
    finally:
        conn.close()


@app.delete("/api/auth/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(authorization: Optional[str] = Header(default=None, alias="Authorization")):
    user = _get_user_by_token(authorization)
    conn = _get_db()
    try:
        conn.execute("DELETE FROM users WHERE id = ?", (user.id,))
        conn.commit()
    finally:
        conn.close()
    return


@app.get("/api/todos", response_model=List[TodoOut])
def list_todos(authorization: Optional[str] = Header(default=None, alias="Authorization")):
    user = _get_user_by_token(authorization)
    conn = _get_db()
    try:
        cur = conn.execute(
            """
            SELECT * FROM user_todos
            WHERE user_id = ?
            ORDER BY date ASC, time ASC, created_at ASC
            """,
            (user.id,),
        )
        rows = cur.fetchall()
        return [_todo_row_to_out(r) for r in rows]
    finally:
        conn.close()


@app.post("/api/todos", response_model=TodoOut, status_code=status.HTTP_201_CREATED)
def create_todo(payload: TodoCreate, authorization: Optional[str] = Header(default=None, alias="Authorization")):
    user = _get_user_by_token(authorization)
    conn = _get_db()
    try:
        now = datetime.utcnow().isoformat()
        cur = conn.execute(
            """
            INSERT INTO user_todos (user_id, title, date, time, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user.id, payload.title.strip(), payload.date, payload.time, now),
        )
        todo_id = cur.lastrowid
        conn.commit()
        row = conn.execute("SELECT * FROM user_todos WHERE id = ?", (todo_id,)).fetchone()
        return _todo_row_to_out(row)
    finally:
        conn.close()


@app.put("/api/todos/{todo_id}", response_model=TodoOut)
def update_todo(
    todo_id: int,
    payload: TodoUpdate,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    user = _get_user_by_token(authorization)
    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT * FROM user_todos WHERE id = ? AND user_id = ?",
            (todo_id, user.id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="항목을 찾을 수 없습니다.")
        updates = {}
        if payload.title is not None:
            updates["title"] = payload.title.strip()
        if payload.date is not None:
            updates["date"] = payload.date
        if payload.time is not None:
            updates["time"] = payload.time
        if payload.is_done is not None:
            updates["is_done"] = 1 if payload.is_done else 0
        if updates:
            set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
            conn.execute(
                f"UPDATE user_todos SET {set_clause} WHERE id = ? AND user_id = ?",
                (*updates.values(), todo_id, user.id),
            )
            conn.commit()
        row = conn.execute(
            "SELECT * FROM user_todos WHERE id = ? AND user_id = ?",
            (todo_id, user.id),
        ).fetchone()
        return _todo_row_to_out(row)
    finally:
        conn.close()


@app.delete("/api/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(todo_id: int, authorization: Optional[str] = Header(default=None, alias="Authorization")):
    user = _get_user_by_token(authorization)
    conn = _get_db()
    try:
        conn.execute(
            "DELETE FROM user_todos WHERE id = ? AND user_id = ?",
            (todo_id, user.id),
        )
        conn.commit()
    finally:
        conn.close()
    return


@app.post("/api/routines/run", status_code=status.HTTP_201_CREATED)
def run_routine(payload: RoutineRunCreate, authorization: Optional[str] = Header(default=None, alias="Authorization")):
    user = _get_user_by_token(authorization)
    conn = _get_db()
    try:
        conn.execute(
            """
            INSERT INTO user_routine_runs (user_id, title, duration_min, note, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user.id, payload.title, payload.duration_min or 0, payload.note or '', datetime.utcnow().isoformat()),
        )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


@app.post("/api/predict", response_model=PredictOutput)
def predict(
    inp: WorkoutInput,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    user = _get_user_by_token(authorization)
    fatigue = _fatigue_score(inp)
    sleep_debt = max(0.0, 8.0 - inp.sleep_hours)
    risk = _risk_bucket(fatigue, sleep_debt, inp.hi_streak_days)

    # Recovery windows: immediate, short-term, overnight
    windows = [
        RecoveryWindow(label="즉시", recommend_min=20, expected_roi_pct=_roi_for_rest(fatigue, 20, inp.sleep_hours), note="짧은 브리딩+스트레칭"),
        RecoveryWindow(label="단기", recommend_min=120, expected_roi_pct=_roi_for_rest(fatigue, 120, inp.sleep_hours), note="낮잠 20분 또는 냉온 교대"),
        RecoveryWindow(label="야간", recommend_min=8 * 60, expected_roi_pct=_roi_for_rest(fatigue, 8 * 60, inp.sleep_hours), note="7~9시간 수면")
    ]
    # If risk high, be more conservative: bump durations a bit
    if risk == "red":
        for w in windows:
            w.recommend_min = int(w.recommend_min * 1.2)
    elif risk == "yellow":
        for w in windows:
            w.recommend_min = int(w.recommend_min * 1.1)

    result = PredictOutput(fatigue_score=fatigue, recovery_windows=windows, overtraining_risk=risk)
    # 저장
    conn = _get_db()
    try:
        conn.execute(
            "INSERT INTO user_predictions (user_id, payload_json, result_json, created_at) VALUES (?, ?, ?, ?)",
            (user.id, json.dumps(inp.model_dump()), json.dumps(result.model_dump()), datetime.utcnow().isoformat()),
        )
        conn.commit()
    finally:
        conn.close()

    return result


@app.post("/api/roi-report", response_model=ROIReportOutput)
def roi_report(
    inp: ROIReportInput,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    user = _get_user_by_token(authorization)
    points: List[ROIDataPoint] = []
    total_work = 0.0
    total_recov = 0.0
    for i, w in enumerate(inp.weekly_sessions):
        load = _session_trimp(w)
        # Assume recovery actions are proportional to rest taken (sleep + micro breaks)
        recovery = max(0.0, (w.sleep_hours - 6.0)) * 10.0
        total_work += load
        total_recov += recovery
        ratio = recovery / (load + 1e-6)
        points.append(ROIDataPoint(day=f"D{i+1}", workout_load=round(load, 1), recovery_load=round(recovery, 1), ratio=round(ratio, 2)))

    # Efficiency is ratio scaled and capped
    avg_ratio = (total_recov / (total_work + 1e-6)) if total_work > 0 else 0.0
    efficiency = int(max(0, min(100, round(60 + (avg_ratio - 0.2) * 100))))

    # Expected next performance change: depend on last day fatigue and planned rest window (estimate)
    last = inp.weekly_sessions[-1] if inp.weekly_sessions else WorkoutInput(duration_min=0, avg_hr=120, max_hr=190, rpe=3, sleep_hours=7, temp_c=22, humidity=40, last7_load=0, last28_load=0, hi_streak_days=0)
    fatigue = _fatigue_score(last)
    # Assume user rests 3h before next workout by default
    perf_change = _roi_for_rest(fatigue, 180, last.sleep_hours)

    badge = "Bronze"
    if efficiency >= 75:
        badge = "Gold"
    elif efficiency >= 65:
        badge = "Silver"

    result = ROIReportOutput(
        recovery_efficiency_score=efficiency,
        weekly_recovery_ratio=points,
        expected_next_performance_change_pct=perf_change,
        rest_accrual_badge=badge,
    )
    conn = _get_db()
    try:
        conn.execute(
            "INSERT INTO user_predictions (user_id, payload_json, result_json, created_at) VALUES (?, ?, ?, ?)",
            (user.id, json.dumps({"weekly_sessions": [w.model_dump() for w in inp.weekly_sessions]}), json.dumps(result.model_dump()), datetime.utcnow().isoformat()),
        )
        conn.commit()
    finally:
        conn.close()
    return result


@app.get("/api/routines", response_model=List[Routine])
def routines(
    type: Optional[str] = None,
    wind: Optional[float] = None,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    _get_user_by_token(authorization)
    base = [
        Routine(title="4-7-8 브리딩", minutes=3, type="breathing", steps=["4초 들이마시기", "7초 멈춤", "8초 내쉬기", "5회 반복"]),
        Routine(title="하체 스트레칭", minutes=5, type="stretch", steps=["햄스트링 60초", "종아리 60초", "둔근 60초", "3세트"]),
        Routine(title="얼-온 교대", minutes=6, type="contrast", steps=["차갑게 1분", "따뜻하게 2분", "3세트"]),
        Routine(title="파워냅", minutes=10, type="nap", steps=["밝기 낮추기", "20분 타이머", "깨고 가벼운 워크"]),
    ]
    out = base
    if type == "muscle":
        out = [r for r in base if r.type in ("stretch", "contrast")] + [base[0]]
    elif type == "central":
        out = [r for r in base if r.type in ("breathing", "nap")]
    elif type == "heat":
        out = [r for r in base if r.type in ("contrast", "breathing")]
    if wind and wind >= 5.0:
        out.append(Routine(title="10분 산책", minutes=10, type="walk", steps=["바람 맞으며 가볍게 걷기"]))
    return out[:4]


@app.get("/api/report/latest", response_model=ReportSummary)
def report_latest(authorization: Optional[str] = Header(default=None, alias="Authorization")):
    user = _get_user_by_token(authorization)
    conn = _get_db()
    try:
        # 예측 통계
        cur = conn.execute(
            "SELECT result_json, created_at FROM user_predictions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
            (user.id,),
        )
        rows = cur.fetchall()
        total_predictions = len(rows)
        last_fatigue = None
        last_risk = None
        last_windows = None
        fat_scores: List[int] = []
        last_roi_pct = None
        if rows:
            last = rows[0]
            res = json.loads(last["result_json"])
            last_fatigue = res.get("fatigue_score")
            last_risk = res.get("overtraining_risk")
            last_windows = res.get("recovery_windows")
        for r in rows:
            data = json.loads(r["result_json"])
            if "fatigue_score" in data:
                fat_scores.append(int(data["fatigue_score"]))
            if data.get("recovery_windows"):
                last_roi_pct = data["recovery_windows"][0].get("expected_roi_pct")
        avg_fatigue = round(sum(fat_scores) / len(fat_scores), 1) if fat_scores else None

        # 루틴 실행
        run_row = conn.execute(
            "SELECT title, created_at FROM user_routine_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
            (user.id,),
        ).fetchone()
        runs_count = conn.execute(
            "SELECT COUNT(*) AS c FROM user_routine_runs WHERE user_id = ?",
            (user.id,),
        ).fetchone()["c"]

        return ReportSummary(
            total_predictions=total_predictions,
            last_fatigue=last_fatigue,
            last_overtraining_risk=last_risk,
            avg_fatigue=avg_fatigue,
            routine_runs=runs_count,
            last_run_title=run_row["title"] if run_row else None,
            last_run_at=run_row["created_at"] if run_row else None,
            last_roi_pct=last_roi_pct,
            recent_windows=last_windows,
        )
    finally:
        conn.close()


@app.get("/api/overtraining-guard", response_model=List[GuardDay])
def guard(authorization: Optional[str] = Header(default=None, alias="Authorization")):
    _get_user_by_token(authorization)
    today = datetime.now().date()
    days: List[GuardDay] = []
    for i in range(14):
        d = today + timedelta(days=i)
        # Simple pattern: heavier risk on Wed/Sat
        wd = d.weekday()
        risk = "green"
        if wd in (2, 5):
            risk = "yellow"
        if wd == 5 and i <= 7:
            risk = "red"
        days.append(GuardDay(date=d.isoformat(), risk=risk))
    return days


@app.get("/api/coach-insights")
def coach_insights(authorization: Optional[str] = Header(default=None, alias="Authorization")):
    _get_user_by_token(authorization)
    return {
        "alerts": [
            "근육 피로 75% → 하체 회복 루틴 권장",
            "내일 경사 러닝 예정 → 오늘은 하체 회복에 집중",
            "수면부채 1.5시간 → 파워냅 20분 제안",
        ]
    }


# Entry
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
