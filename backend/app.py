from typing import List, Optional
import hashlib
import secrets
import sqlite3
import json
import os
from pathlib import Path
from fastapi import FastAPI, Header, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, timedelta
import requests
from dotenv import load_dotenv
from typing import Any


app = FastAPI(title="Hyuga Recovery API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = Path(__file__).parent / "hyuga.db"
ENV_PATH = Path(__file__).parent / ".env"

if ENV_PATH.exists():
  load_dotenv(ENV_PATH)
else:
  load_dotenv()


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
    nfa_delta: Optional[int] = None
    nfa_source: Optional[str] = None


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
    nfa_delta: Optional[int] = None
    nfa_source: Optional[str] = None


class NFABaselineRow(BaseModel):
    age_band: str
    gender: str
    metric: str
    baseline_score: int
    source: str


class RecoverySpot(BaseModel):
    name: str
    category: str
    lat: float
    lng: float
    is_open: bool
    distance_km: Optional[float] = None
    safety_flag: Optional[bool] = None


class RecoveryCourse(BaseModel):
    title: str
    category: str
    location: Optional[str] = None
    eligible: bool
    note: Optional[str] = None
    url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    distance_km: Optional[float] = None


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


def _get_user_by_token_optional(authorization: Optional[str]) -> Optional[UserPublic]:
    try:
        return _get_user_by_token(authorization)
    except HTTPException:
        return None


def _fetch_external(url: str, params: dict, headers: dict) -> Optional[dict]:
    try:
        res = requests.get(url, params=params, headers=headers, timeout=8)
        if res.ok:
            return res.json()
        print(f"[external] {url} status={res.status_code} body={res.text[:200]}")
    except Exception as e:
        print(f"[external] error fetching {url} params={params} err={e}")
    return None


def _nfa_reference(age: Optional[int] = None, gender: Optional[str] = None, metric: Optional[str] = None) -> Optional[tuple[int, str]]:
    """NFA 기준 점수와 출처를 반환 (없으면 None)"""
    url = os.getenv("NFA_API_URL")
    key = os.getenv("NFA_API_KEY")
    if not url or not key:
        return None
    params = {
        "serviceKey": key,
        "pageNo": 1,
        "numOfRows": 1,
        "resultType": "json",
    }
    if age is not None:
        params["age_class"] = age
    if gender:
        params["sex"] = gender
    if metric:
        params["item"] = metric
    clean_url = url.replace("https://https://", "https://").rstrip("?&/ ")
    if "todz_nfa_test_result" not in clean_url.lower():
        clean_url = clean_url.rstrip("/") + "/TODZ_NFA_TEST_RESULT_NEW"
    data = _fetch_external(clean_url, params, {})
    if data is None:
        from urllib.parse import quote_plus
        params["serviceKey"] = quote_plus(key)
        data = _fetch_external(clean_url, params, {})
    if data is None:
        full_url = f"{clean_url}?serviceKey={key}&pageNo=1&numOfRows=1&resultType=json"
        data = _fetch_external(full_url, {}, {})
    if not data:
        return None
    items = None
    if isinstance(data, dict) and "response" in data:
        items = (
            data.get("response", {})
            .get("body", {})
            .get("items", {})
            .get("item", [])
        )
    elif isinstance(data, dict) and "body" in data:
        items = (
            data.get("body", {})
            .get("items", {})
            .get("item", [])
        )
    if isinstance(items, dict):
        items = [items]
    if not items:
        return None
    it = items[0]
    try:
        score = int(float(it.get("score") or it.get("item_f003") or it.get("item_f002") or it.get("item_f001") or 60))
    except Exception:
        score = 60
    source = str(it.get("cert_gbn") or it.get("source") or "NFA")
    return score, source


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    from math import radians, cos, sin, asin, sqrt

    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    c = 2 * asin(sqrt(a))
    return 6371 * c


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

    nfa_delta = None
    nfa_source = "NFA 샘플 기준 60점 대비"
    ref = _nfa_reference()
    if ref:
        ref_score, ref_src = ref
        nfa_delta = fatigue - ref_score
        nfa_source = f"NFA {ref_score}점 기준 ({ref_src})"
    else:
        nfa_delta = fatigue - 60

    result = PredictOutput(
        fatigue_score=fatigue,
        recovery_windows=windows,
        overtraining_risk=risk,
        nfa_delta=nfa_delta,
        nfa_source=nfa_source,
    )
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
            nfa_delta=last_fatigue - 60 if last_fatigue is not None else None,
            nfa_source="NFA 샘플 기준 60점 대비",
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


@app.get("/api/nfa-baseline", response_model=Any)
def nfa_baseline(
    age: Optional[int] = Query(default=None, ge=10, le=90),
    gender: Optional[str] = None,
    metric: Optional[str] = None,
    page: int = 1,
    rows: int = 20,
    raw: bool = Query(default=False, description="원본 항목 그대로 반환"),
):
    url = os.getenv("NFA_API_URL")
    key = os.getenv("NFA_API_KEY")
    if url and key:
        base_params = {
            "serviceKey": key,
            "pageNo": page,
            "numOfRows": rows,
            "resultType": "json",
        }
        if age is not None:
            base_params["age_class"] = age
        if gender:
            base_params["sex"] = gender
        if metric:
            base_params["item"] = metric
        clean_url = url.replace("https://https://", "https://").rstrip("?&/ ")
        if "todz_nfa_test_result" not in clean_url.lower():
            clean_url = clean_url.rstrip("/") + "/TODZ_NFA_TEST_RESULT_NEW"
        data = _fetch_external(clean_url, base_params, {})
        if data is None:
            from urllib.parse import quote_plus
            encoded_key = quote_plus(key)
            alt_params = {**base_params, "serviceKey": encoded_key}
            data = _fetch_external(clean_url, alt_params, {})
        if data is None:
            full_url = f"{clean_url}?serviceKey={key}&pageNo={page}&numOfRows={rows}&resultType=json"
            if age is not None:
                full_url += f"&age_class={age}"
            if gender:
                full_url += f"&sex={gender}"
            if metric:
                full_url += f"&item={metric}"
            data = _fetch_external(full_url, {}, {})
        # 디버그용: 외부 응답을 로그로 확인
        print("NFA external raw:", data)
        if data:
            out: List[NFABaselineRow] = []
            raw_items: List[Any] = []
            # helper for safe number parsing
            def _num(v):
                try:
                    return int(float(v))
                except Exception:
                    return 0
            # 형태 1: response.body.items.item
            if isinstance(data, dict) and "response" in data:
                items = (
                    data.get("response", {})
                    .get("body", {})
                    .get("items", {})
                    .get("item", [])
                )
                if isinstance(items, dict):
                    items = [items]
                raw_items = items or []
                for it in items or []:
                    out.append(
                        NFABaselineRow(
                            age_band=str(it.get("age_class") or it.get("age_degree") or it.get("age") or ""),
                            gender=str(it.get("test_sex") or it.get("sex") or it.get("gender") or ""),
                            metric=str(it.get("item") or "recovery"),
                            baseline_score=_num(it.get("score") or it.get("item_f003") or 0),
                            source=str(it.get("cert_gbn") or "NFA"),
                        )
                    )
            # 형태 2: body.items.item (response 래퍼 없음)
            elif isinstance(data, dict) and "body" in data:
                items = (
                    data.get("body", {})
                    .get("items", {})
                    .get("item", [])
                )
                if isinstance(items, dict):
                    items = [items]
                raw_items = items or []
                for it in items or []:
                    out.append(
                        NFABaselineRow(
                            age_band=str(it.get("age_class") or it.get("age_degree") or it.get("age") or ""),
                            gender=str(it.get("test_sex") or it.get("sex") or it.get("gender") or ""),
                            metric=str(it.get("item") or "recovery"),
                            baseline_score=_num(it.get("score") or it.get("item_f003") or 0),
                            source=str(it.get("cert_gbn") or "NFA"),
                        )
                    )
            elif isinstance(data, list):
                try:
                    out = [NFABaselineRow(**row) for row in data]
                except Exception:
                    out = []
                raw_items = data
            if raw and raw_items:
                return raw_items
            if out:
                return out
    # fallback sample
    return [
        NFABaselineRow(age_band="30-39", gender="M", metric="recovery", baseline_score=60, source="NFA 샘플"),
        NFABaselineRow(age_band="30-39", gender="F", metric="recovery", baseline_score=58, source="NFA 샘플"),
    ]


@app.get("/api/recovery-spots", response_model=List[RecoverySpot])
def recovery_spots(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    _get_user_by_token_optional(authorization)
    url = os.getenv("SPOT_API_URL")
    key = os.getenv("SPOT_API_KEY")
    if url and key:
        params = {
            "serviceKey": key,
            "pageNo": 1,
            "numOfRows": 20,
            "resultType": "json",
        }
        clean_url = url.rstrip("?&")
        data = _fetch_external(clean_url, params, {})
        if data:
            spots_out: List[RecoverySpot] = []
            if isinstance(data, list):
                try:
                    spots_out = [RecoverySpot(**row) for row in data]
                except Exception:
                    spots_out = []
            elif isinstance(data, dict) and "response" in data:
                items = (
                    data.get("response", {})
                    .get("body", {})
                    .get("items", {})
                    .get("item", [])
                )
                if isinstance(items, dict):
                    items = [items]
                for it in items or []:
                    name = it.get("faci_nm") or it.get("name")
                    if not name:
                        continue
                    lat_val = it.get("faci_lat") or it.get("la") or it.get("lat") or it.get("ypos")
                    lng_val = it.get("faci_lot") or it.get("lo") or it.get("lng") or it.get("xpos")
                    try:
                        lat_f = float(lat_val) if lat_val is not None else None
                        lng_f = float(lng_val) if lng_val is not None else None
                    except Exception:
                        lat_f = None
                        lng_f = None
                    distance = None
                    if lat is not None and lng is not None and lat_f is not None and lng_f is not None:
                        distance = round(_haversine_km(lat, lng, lat_f, lng_f), 2)
                    spots_out.append(
                        RecoverySpot(
                            name=name,
                            category=it.get("ftype_nm") or it.get("fcob_nm") or it.get("faci_spec_lc") or it.get("category") or "시설",
                            lat=lat_f or 0.0,
                            lng=lng_f or 0.0,
                            is_open=(it.get("faci_stat_nm") == "정상운영"),
                            distance_km=distance,
                            safety_flag=(it.get("atnm_chk_yn") == "Y"),
                        )
                    )
            if lat is not None and lng is not None:
                spots_out = [s for s in spots_out if s.lat and s.lng]
                spots_out.sort(key=lambda s: s.distance_km or 9999)
            return spots_out
    # 외부 호출 실패 또는 URL/KEY 없으면 샘플
    return [
        RecoverySpot(name="중앙공원 산책로", category="산책", lat=37.5, lng=127.0, is_open=True, distance_km=1.2, safety_flag=True),
        RecoverySpot(name="시청 수영장", category="수영", lat=37.51, lng=127.01, is_open=False, distance_km=2.4, safety_flag=True),
    ]


@app.get("/api/recovery-courses", response_model=List[RecoveryCourse])
def recovery_courses(authorization: Optional[str] = Header(default=None, alias="Authorization")):
    _get_user_by_token_optional(authorization)
    url = os.getenv("COURSES_API_URL")
    key = os.getenv("COURSES_API_KEY")
    if url and key:
        params = {
            "serviceKey": key,
            "pageNo": 1,
            "numOfRows": 20,
            "resultType": "json",
        }
        # URL에 프로토콜이 중복된 경우를 대비해 정리
        clean_url = url.replace("https://https://", "https://").rstrip("?&")
        data = _fetch_external(clean_url, params, {})
        if data:
            out: List[RecoveryCourse] = []
            # 공공데이터 포털 응답 형태 1: response.body.items.item
            if isinstance(data, dict) and "response" in data:
                items = (
                    data.get("response", {})
                    .get("body", {})
                    .get("items", {})
                    .get("item", [])
                )
                if isinstance(items, dict):
                    items = [items]
                for it in items or []:
                    title = it.get("course_nm") or it.get("item_nm") or "강좌"
                    category = it.get("item_nm") or it.get("item_cd") or ""
                    location = it.get("lectr_nm") or it.get("course_seta_desc_cn") or ""
                    note_parts = [it.get("lectr_weekday_val") or "", it.get("start_tm") or "", it.get("course_seta_desc_cn") or ""]
                    note = " ".join([p for p in note_parts if p]).strip() or None
                    lat_val = it.get("faci_lat") or it.get("lat")
                    lng_val = it.get("faci_lot") or it.get("lng") or it.get("faci_lon")
                    try:
                        lat = float(lat_val) if lat_val not in (None, "") else None
                        lng = float(lng_val) if lng_val not in (None, "") else None
                    except Exception:
                        lat = lng = None
                    out.append(
                        RecoveryCourse(
                            title=title,
                            category=category,
                            location=location,
                            eligible=True,
                            note=note,
                            url=None,
                            lat=lat,
                            lng=lng,
                        )
                    )
            # 공공데이터 포털 응답 형태 2: header/body/items/item (response 래퍼 없음)
            elif isinstance(data, dict) and "body" in data:
                items = data.get("body", {}).get("items", {}).get("item", [])
                if isinstance(items, dict):
                    items = [items]
                for it in items or []:
                    title = it.get("course_nm") or it.get("item_nm") or "강좌"
                    category = it.get("item_nm") or it.get("item_cd") or ""
                    location = it.get("lectr_nm") or it.get("course_seta_desc_cn") or ""
                    note_parts = [it.get("lectr_weekday_val") or "", it.get("start_tm") or "", it.get("course_seta_desc_cn") or ""]
                    note = " ".join([p for p in note_parts if p]).strip() or None
                    lat_val = it.get("faci_lat") or it.get("lat")
                    lng_val = it.get("faci_lot") or it.get("lng") or it.get("faci_lon")
                    try:
                        lat = float(lat_val) if lat_val not in (None, "") else None
                        lng = float(lng_val) if lng_val not in (None, "") else None
                    except Exception:
                        lat = lng = None
                    out.append(
                        RecoveryCourse(
                            title=title,
                            category=category,
                            location=location,
                            eligible=True,
                            note=note,
                            url=None,
                            lat=lat,
                            lng=lng,
                        )
                    )
            elif isinstance(data, list):
                try:
                    out = [RecoveryCourse(**row) for row in data]
                except Exception:
                    out = []
            if out:
                return out
    return [
        RecoveryCourse(title="요가 · 스포츠강좌이용권 적용", category="요가", location="시청 주민센터", eligible=True, note="저녁반", url=None, lat=37.5, lng=127.0, distance_km=1.0),
        RecoveryCourse(title="재활 필라테스", category="필라테스", location="스포츠 복지관", eligible=False, note="대기중", url=None, lat=37.51, lng=127.01, distance_km=2.3),
    ]


# Entry
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
