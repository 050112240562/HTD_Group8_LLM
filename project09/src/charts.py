"""Person 3 presentation adapters: accept real or mock result dictionaries.

No engine calls and no mutation of input data. Monetary rounding is display-only.
"""
from __future__ import annotations

import math

from src.scenarios import SCENARIO_NAMES, ScenarioInputError


INK = "#111827"
MUTED = "#5F6F85"
GRID = "#D7E2F1"
SURFACE = "#FFFFFF"
SCENARIO_COLORS = ("#7C8B9B", "#173D62", "#9A772E")
LABEL_COLORS = dict(zip(("Thận trọng", "Cơ sở", "Tích cực"), SCENARIO_COLORS))
LABEL_COLORS.update(dict(zip(("Conservative", "Base", "Optimistic"), SCENARIO_COLORS)))


def _vnd_text(value: float) -> str:
    """Return an exact Vietnamese-style display label without changing data."""

    return f"{value:,.0f}".replace(",", ".") + " ₫"


def _premium_layout(title: str, subtitle: str, *, height: int = 470) -> dict:
    """Shared institutional chart styling for all Project 09 figures."""

    return {
        "title": {
            "text": f"<b>{title}</b><br><span style='font-size:12px;color:{MUTED}'>{subtitle}</span>",
            "x": 0.025,
            "xanchor": "left",
            "font": {"family": "Project Sans, Arial, sans-serif", "size": 17, "color": INK},
        },
        "height": height,
        "hovermode": "x unified",
        "paper_bgcolor": "#FFFFFF",
        "plot_bgcolor": SURFACE,
        "font": {"family": "Project Sans, Arial, sans-serif", "color": INK, "size": 14},
        "hoverlabel": {"bgcolor": INK, "bordercolor": INK, "font": {"color": "#FFFFFF", "size": 12}},
        "legend": {
            "orientation": "h", "yanchor": "top", "y": -.17,
            "xanchor": "left", "x": 0, "font": {"size": 13, "color": MUTED},
        },
        "margin": {"l": 40, "r": 26, "t": 80, "b": 75},
        "xaxis": {
            "title": None, "showgrid": False, "zeroline": False,
            "showline": True, "linecolor": GRID, "tickfont": {"color": MUTED},
        },
        "yaxis": {
            "title": None, "gridcolor": GRID, "gridwidth": 1,
            "zeroline": False, "tickfont": {"color": MUTED}, "tickformat": "~s",
        },
    }


def _items(result: dict) -> list[dict]:
    if not isinstance(result, dict):
        raise ScenarioInputError("Kết quả biểu đồ phải là dict.")
    try:
        if all(name in result for name in SCENARIO_NAMES):
            items = [result[name] for name in SCENARIO_NAMES]
        elif "stressed" in result:
            items = [result["baseline"], result["stressed"]]
        elif "modified" in result:
            items = [result["baseline"], result["modified"]]
        else:
            raise ScenarioInputError("Thiếu các kịch bản để so sánh.")
        for item in items:
            if not isinstance(item["label"], str) or not item["monthly_projection"]:
                raise ScenarioInputError("Thiếu nhãn hoặc chuỗi số dư.")
            metrics = item["calculation_result"]
            if not math.isfinite(metrics["fv_total"]):
                raise ScenarioInputError("Số dư biểu đồ phải hữu hạn.")
            rows = item["monthly_projection"]
            if not math.isclose(rows[-1]["balance"], metrics["fv_total"], rel_tol=1e-10, abs_tol=0.01):
                raise ScenarioInputError("Điểm cuối biểu đồ không khớp fv_total.")
        return items
    except (KeyError, TypeError, IndexError) as exc:
        raise ScenarioInputError(f"Dữ liệu biểu đồ không đúng cấu trúc: {exc}") from exc


def build_comparison_table(result: dict):
    """Return a numeric pandas DataFrame (metrics as rows, scenarios as columns).

    Accept build_scenarios/run_what_if/run_stress_test output or equivalent mocks.
    Raises ScenarioInputError on malformed data; requires pandas at presentation time.
    """
    import pandas as pd

    columns = {}
    try:
        for item in _items(result):
            m = item["calculation_result"]
            columns[item["label"]] = {
                "monthly_contribution": m.get("monthly_contribution"),
                "fv_total": m["fv_total"], "goal_gap": m["goal_gap"],
                "goal_reached_by_horizon": m["goal_reached_by_horizon"],
                "estimated_month_to_goal": m["estimated_month_to_goal"],
                "required_monthly_contribution": m.get("required_monthly_contribution"),
                "contribution_affordability_gap": m.get("contribution_affordability_gap"),
                "required_contribution_gap": m.get("required_contribution_gap"),
                "emergency_fund_available": item["emergency_fund_available"],
                "total_contributions": item["total_contributions"],
                "investment_gain": item["investment_gain"],
            }
        return pd.DataFrame(columns, dtype=object)
    except (KeyError, TypeError) as exc:
        raise ScenarioInputError(f"Thiếu chỉ tiêu so sánh: {exc}") from exc


def create_balance_chart(result: dict):
    """Return Plotly lines for each balance and its own (possibly inflated) goal.

    Raises ScenarioInputError for malformed/mismatched series; requires Plotly.
    """
    import plotly.graph_objects as go

    figure = go.Figure()
    try:
        for index, item in enumerate(_items(result)):
            rows = item["monthly_projection"]
            color = (("#06B6D4", "#F06464")[index] if "stressed" in result
                     else LABEL_COLORS.get(item["label"], SCENARIO_COLORS[index % len(SCENARIO_COLORS)]))
            months = [row["month"] for row in rows]
            balances = [row["balance"] for row in rows]
            targets = [row["target_amount"] for row in rows]
            figure.add_scatter(
                x=months, y=balances, mode="lines", name=item["label"],
                line={"color": color, "width": 3.4, "dash": "dash" if index == 0 else "solid"},
                hovertext=[_vnd_text(value) for value in balances],
                hovertemplate=f"<b>{item['label']}</b><br>%{{hovertext}}<extra></extra>",
            )
            figure.add_scatter(
                x=months, y=targets, mode="lines", name="Mục tiêu", showlegend=index == 0,
                line={"color": "#8794A0", "width": 1.45, "dash": "dot"}, opacity=0.62,
                hovertext=[_vnd_text(value) for value in targets],
                hovertemplate=f"<b>Mục tiêu · {item['label']}</b><br>%{{hovertext}}<extra></extra>",
            )
    except (KeyError, TypeError) as exc:
        raise ScenarioInputError(f"Chuỗi thời gian không hợp lệ: {exc}") from exc
    figure.update_layout(**_premium_layout(
        "Số dư dự kiến theo thời gian",
        "Đường liền là số dư mô phỏng · đường chấm là mục tiêu tương ứng",
    ))
    figure.update_xaxes(title_text="Tháng", title_font={"size": 13, "color": MUTED})
    return figure


def create_final_value_chart(result: dict):
    """Return Plotly grouped bars for final balance and each final target.

    Uses engine results exactly; raises ScenarioInputError for malformed inputs.
    """
    import plotly.graph_objects as go

    items = _items(result)
    try:
        labels = [item["label"] for item in items]
        balances = [item["calculation_result"]["fv_total"] for item in items]
        targets = [item["calculation_result"]["adjusted_goal_amount"] for item in items]
        figure = go.Figure(go.Bar(
            name="Số dư cuối kỳ", x=labels, y=balances,
            marker={"color": list(SCENARIO_COLORS)[:len(items)]},
            text=[_vnd_text(value) for value in balances], textposition="outside", cliponaxis=False,
            hovertext=[_vnd_text(value) for value in balances],
            hovertemplate="<b>%{x}</b><br>Số dư: %{hovertext}<extra></extra>",
        ))
        # A shared goal is a reference line. What-if horizons can have different goals.
        if all(math.isclose(targets[0], value, abs_tol=.01) for value in targets):
            figure.add_hline(y=targets[0], line_dash="dot", line_color="#AD4343",
                             annotation_text="Mục tiêu: " + _vnd_text(targets[0]), annotation_position="top left")
        else:
            figure.add_scatter(name="Mục tiêu theo từng thời hạn", x=labels, y=targets, mode="markers",
                               marker={"symbol": "line-ew", "size": 30, "color": "#AD4343", "line": {"width": 3}},
                               hovertext=[_vnd_text(value) for value in targets],
                               hovertemplate="Mục tiêu: %{hovertext}<extra></extra>")
    except (KeyError, TypeError) as exc:
        raise ScenarioInputError(f"Thiếu số liệu cuối kỳ: {exc}") from exc
    layout = _premium_layout("Giá trị cuối kỳ so với mục tiêu", "Kết quả theo giả định · không thể hiện xác suất", height=430)
    layout.update({"bargap": .5})
    figure.update_layout(**layout)
    figure.update_yaxes(rangemode="tozero", range=[0, max(1, *balances, *targets) * 1.25], title_text="Đồng")
    return figure


def create_goal_progress_chart(item: dict):
    """Return a compact gauge for one scenario's end-of-horizon progress."""
    import plotly.graph_objects as go

    try:
        metrics = item["calculation_result"]
        balance = float(metrics["fv_total"])
        target = float(metrics["adjusted_goal_amount"])
        if not math.isfinite(balance) or not math.isfinite(target) or target <= 0:
            raise ValueError("invalid balance or target")
    except (KeyError, TypeError, ValueError) as exc:
        raise ScenarioInputError(f"Thiếu số liệu tiến độ mục tiêu: {exc}") from exc
    progress = max(balance / target * 100, 0.0)
    axis_max = max(110, math.ceil(progress / 10) * 10)
    figure = go.Figure(go.Indicator(
        mode="gauge+number",
        value=progress,
        number={"suffix": "%", "valueformat": ".0f", "font": {"size": 34, "color": INK}},
        title={"text": "<b>Tiến độ mục tiêu</b><br><span style='font-size:12px;color:#5F6F85'>" + item["label"] + " · dự kiến cuối thời hạn</span>"},
        gauge={
            "axis": {"range": [0, axis_max], "tickwidth": 0, "tickcolor": MUTED},
            "bar": {"color": LABEL_COLORS.get(item["label"], "#2563EB"), "thickness": 0.34},
            "bgcolor": "#EEF1F3", "borderwidth": 0,
            "steps": [{"range": [0, min(100, axis_max)], "color": "#EEF4FF"}],
            "threshold": {"line": {"color": "#B77915", "width": 3}, "thickness": .78, "value": 100},
        },
    ))
    figure.update_layout(
        height=290, margin={"l": 28, "r": 28, "t": 70, "b": 20},
        paper_bgcolor="#FFFFFF", font={"family": "Project Sans, Arial, sans-serif", "color": INK},
    )
    return figure


def create_cashflow_chart(item: dict):
    """Horizontal amounts, with any unfunded spending shown separately."""
    import plotly.graph_objects as go
    try:
        p, m = item["profile_used"], item["calculation_result"]
        values = [float(p[key]) for key in ("monthly_essential_expense", "monthly_discretionary_expense", "monthly_debt_payment")]
        values += [float(m["monthly_contribution"]), max(float(m["monthly_surplus"]) - float(m["monthly_contribution"]), 0)]
        income = float(m["total_monthly_income"])
        shortfall = max(sum(values) - income, 0)
    except (KeyError, TypeError, ValueError) as exc:
        raise ScenarioInputError(f"Thiếu số liệu dòng tiền tháng: {exc}") from exc
    labels = ["Thiết yếu", "Linh hoạt", "Trả nợ", "Góp cho mục tiêu", "Còn lại"]
    palette = ["#758DA3", "#AEBDCA", "#9A772E", "#173D62", "#D5E1D8"]
    figure = go.Figure()
    for label, value, color in zip(labels, values, palette):
        figure.add_bar(name=label, y=["Phân bổ"], x=[value], orientation="h", marker_color=color,
                       hovertemplate=label + ": " + _vnd_text(value) + "<extra></extra>")
    figure.add_vline(x=income, line_dash="dot", line_color="#AD4343",
                     annotation_text="Thu nhập: " + _vnd_text(income))
    subtitle = ("Thiếu nguồn tiền " + _vnd_text(shortfall) + "/tháng" if shortfall > .01 else "Các khoản phân bổ nằm trong thu nhập")
    layout = _premium_layout("Phân bổ tiền mỗi tháng · " + item["label"], subtitle, height=300)
    layout.update(barmode="stack", hovermode="closest")
    figure.update_layout(**layout)
    figure.update_xaxes(title_text="Đồng / tháng", range=[0, max(1, income, sum(values)) * 1.12])
    figure.update_yaxes(showgrid=False, showticklabels=False)
    return figure


def create_scenario_detail_chart(item: dict):
    """Return a focused balance-versus-target chart for one selected scenario."""
    import plotly.graph_objects as go

    try:
        rows = item["monthly_projection"]
        months = [row["month"] for row in rows]
        balances = [row["balance"] for row in rows]
        targets = [row["target_amount"] for row in rows]
        label = item["label"]
        if not rows or not all(math.isfinite(float(value)) for value in balances + targets):
            raise ValueError("invalid series")
    except (KeyError, TypeError, ValueError) as exc:
        raise ScenarioInputError(f"Thiếu chuỗi dữ liệu phương án: {exc}") from exc
    figure = go.Figure()
    figure.add_scatter(
        x=months, y=balances, mode="lines", name="Số dư dự kiến",
        fill="tozeroy", fillcolor="rgba(37,99,235,.06)",
        line={"color": LABEL_COLORS.get(label, "#2563EB"), "width": 3.5},
        hovertext=[_vnd_text(value) for value in balances],
        hovertemplate="Tháng %{x}<br><b>%{hovertext}</b><extra></extra>",
    )
    figure.add_scatter(
        x=months, y=targets, mode="lines", name="Mục tiêu",
        line={"color": "#B77915", "width": 2, "dash": "dot"},
        hovertext=[_vnd_text(value) for value in targets],
        hovertemplate="Mục tiêu tháng %{x}<br><b>%{hovertext}</b><extra></extra>",
    )
    figure.update_layout(**_premium_layout(
        f"Diễn biến của phương án {label.lower()}",
        "Chạm vào từng điểm để xem số tiền ở mỗi tháng",
        height=330,
    ))
    horizon = metrics_horizon = item["calculation_result"]["goal_horizon_months"]
    figure.add_vline(x=horizon, line_dash="dash", line_color="#9BAAB8")
    hit = item["calculation_result"].get("estimated_month_to_goal")
    if hit is not None and 0 <= hit <= metrics_horizon:
        point = next((r for r in rows if r["month"] == hit), None)
        if point:
            figure.add_scatter(x=[hit], y=[point["balance"]], mode="markers", name="Lần đầu chạm mục tiêu",
                               marker={"size": 10, "color": "#173D62"},
                               hovertemplate="Tháng %{x} · lần đầu chạm mục tiêu<extra></extra>")
    figure.update_xaxes(title_text="Tháng", title_font={"size": 13, "color": MUTED})
    return figure
