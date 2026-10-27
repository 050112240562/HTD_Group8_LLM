"""Translate existing engine metrics into actionable, consistent display facts.

No alternative FV formulas and no LLM arithmetic. Shared by HTML and Streamlit.
"""
from __future__ import annotations


def build_plan_guidance(profile: dict, metrics: dict, scenario: dict | None = None) -> dict:
    def money(value):
        return f'{value:,.0f}'.replace(',', '.') + ' ₫'

    available = metrics['affordable_monthly_contribution']
    contribution = metrics['monthly_contribution']
    required = metrics['required_monthly_contribution']
    need_more = max(required - contribution, 0)
    budget_gap = metrics['contribution_affordability_gap']
    cash_deficit = max(-metrics['monthly_surplus'], 0)
    gap = metrics['goal_gap']
    feasible = budget_gap <= .01 and cash_deficit <= .01
    if not feasible:
        headline = 'Kế hoạch đang vượt khả năng dòng tiền'
        reason = ('Chi tiêu và trả nợ vượt thu nhập ' + money(cash_deficit) + '/tháng.'
                  if cash_deficit > .01 else
                  'Khoản góp dự kiến vượt tiền có thể dành ' + money(budget_gap) + '/tháng.')
    elif gap > 0:
        headline = 'Chưa đủ tiền cho mục tiêu đúng hạn'
        reason = 'Theo giả định hiện tại, cuối kỳ còn thiếu ' + money(gap) + '.'
    else:
        headline = 'Dự kiến đủ tiền cho mục tiêu đúng hạn'
        reason = 'Theo giả định hiện tại, cuối kỳ vượt mục tiêu ' + money(-gap) + '.'

    actions = []
    if cash_deficit > .01:
        actions.append({'title': 'Cân đối sinh hoạt trước', 'text':
            'Cần giảm chi hoặc bổ sung thu nhập ít nhất ' + money(cash_deficit) +
            '/tháng để hết âm dòng tiền, trước khi dành thêm tiền cho mục tiêu.'})
    if budget_gap > .01:
        actions.append({'title': 'Đưa khoản góp về mức có nguồn tiền', 'text':
            'Hiện có thể dành tối đa ' + money(available) + '/tháng. Khoản góp đang dùng là ' +
            money(contribution) + '/tháng; phần vượt chưa có nguồn bù.'})
    if gap > 0:
        affordability = ('Mức này nằm trong dòng tiền hiện tại, nhưng làm giảm tiền còn lại.'
                         if required <= available + .01 else
                         'Mức này vượt khả năng hiện tại ' + money(max(required - available, 0)) + '/tháng.')
        actions.append({'title': 'Nếu giữ nguyên thời hạn', 'text':
            'Cần dành ' + money(required) + '/tháng, tăng ' + money(need_more) +
            ' so với khoản góp đang mô phỏng. ' + affordability})
        month = metrics['estimated_month_to_goal']
        if month is not None and month > metrics['goal_horizon_months']:
            actions.append({'title': 'Nếu giữ khoản góp hiện tại', 'text':
                'Lần đầu số dư dự kiến chạm mục tiêu là tháng ' + str(month) +
                ', muộn hơn hạn gốc ' + str(month - metrics['goal_horizon_months']) +
                ' tháng. Đây là kết quả mở rộng theo cùng giả định, chưa bảo đảm duy trì đủ tiền sau đó.'})
        else:
            actions.append({'title': 'Nếu giữ khoản góp hiện tại', 'text':
                'Kéo dài thời gian chưa được xác nhận là đủ. Có thể thử giảm quy mô mục tiêu hoặc điều chỉnh ngân sách ở phần thông tin.'})
    else:
        actions.append({'title': 'Theo dõi và giữ phần dự phòng', 'text':
            'Đối chiếu khoản góp và chi tiêu thực tế mỗi tháng; cập nhật kế hoạch khi thu nhập hoặc mục tiêu thay đổi.'})
    if profile['liquidity_need'] == 'high':
        actions.append({'title': 'Bạn có nhu cầu rút tiền sớm cao', 'text':
            'Kết quả chưa trừ các lần rút tiền trong tương lai. Hãy kiểm tra riêng số tiền cần giữ sẵn trước khi dùng toàn bộ vốn khả dụng.'})

    principal = metrics['initial_available_amount'] + contribution * metrics['goal_horizon_months']
    return {'headline': headline, 'reason': reason, 'feasible': feasible,
            'positive': feasible and gap <= 0, 'actions': actions,
            'budget': {'income': metrics['total_monthly_income'], 'outflow': metrics['total_monthly_outflow'],
                       'surplus': metrics['monthly_surplus'], 'contribution': contribution,
                       'remaining': max(metrics['monthly_surplus'] - contribution, 0),
                       'shortfall': max(metrics['total_monthly_outflow'] + contribution - metrics['total_monthly_income'], 0),
                       'reserve': profile['emergency_fund_reserved'],
                       'initial_available': metrics['initial_available_amount']},
            'principal': principal, 'investment_gain': metrics['fv_total'] - principal,
            'numeric_facts': {'principal_amount': principal, 'investment_gain': metrics['fv_total'] - principal,
                              'additional_monthly_contribution': need_more, 'cashflow_deficit': cash_deficit,
                              'surplus_goal_amount': max(-gap, 0),
                              'extension_months': max((metrics['estimated_month_to_goal'] or 0) - metrics['goal_horizon_months'], 0)}}
