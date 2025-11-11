from typing import List, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime, timedelta


app = FastAPI(title="Hyuga Recovery API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.post("/api/predict", response_model=PredictOutput)
def predict(inp: WorkoutInput):
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

    return PredictOutput(fatigue_score=fatigue, recovery_windows=windows, overtraining_risk=risk)


@app.post("/api/roi-report", response_model=ROIReportOutput)
def roi_report(inp: ROIReportInput):
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

    return ROIReportOutput(
        recovery_efficiency_score=efficiency,
        weekly_recovery_ratio=points,
        expected_next_performance_change_pct=perf_change,
        rest_accrual_badge=badge,
    )


@app.get("/api/routines", response_model=List[Routine])
def routines(type: Optional[str] = None, wind: Optional[float] = None):
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


@app.get("/api/overtraining-guard", response_model=List[GuardDay])
def guard():
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
def coach_insights():
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

